import Database from 'better-sqlite3';
import path from 'path';
import { logNotificationAttempt, consoleLogNotification } from './cache';

const dbPath = path.join(process.cwd(), 'crypto_cache.db');

function getDatabase(): Database.Database {
  // keep a lightweight getter to avoid circular import issues
  return new Database(dbPath);
}

export interface EnqueueArgs {
  transactionId?: string | null;
  sourceType: string;
  channel: string;
  payload: string;
  meta?: Record<string, any> | null;
}

export function ensureJobsTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      source_type TEXT,
      channel TEXT,
      payload TEXT,
      meta TEXT,
      attempt_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      last_error TEXT,
      next_run_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notification_jobs_status_next
      ON notification_jobs(status, next_run_at);
  `);
}

export function enqueueNotification(args: EnqueueArgs) {
  const db = getDatabase();
  ensureJobsTable();
  const stmt = db.prepare(`
    INSERT INTO notification_jobs
    (transaction_id, source_type, channel, payload, meta, attempt_count, status, next_run_at)
    VALUES (?, ?, ?, ?, ?, 0, 'pending', datetime('now'))
  `);
  stmt.run(
    args.transactionId || null,
    args.sourceType,
    args.channel,
    args.payload.slice(0, 2000),
    args.meta ? JSON.stringify(args.meta) : null
  );
}

async function sendViaTelegram(payload: string) {
  const telegram = await import('./telegram');
  return telegram.sendMessage(payload, 'HTML');
}

export async function processPendingJobs(limit = 20) {
  const db = getDatabase();
  ensureJobsTable();

  const rows = db
    .prepare("SELECT * FROM notification_jobs WHERE (status = 'pending' OR (status='failed' AND next_run_at <= datetime('now'))) ORDER BY next_run_at ASC LIMIT ?")
    .all(limit) as any[];

  if (!rows || rows.length === 0) return 0;

  let successCount = 0;
  for (const r of rows) {
    try {
      const jobDb = db; // same DB instance

      // mark processing
      jobDb.prepare("UPDATE notification_jobs SET status='processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(r.id);

      const payloadStr = r.payload;
      const meta = r.meta ? JSON.parse(r.meta) : null;

      const sent = await sendViaTelegram(payloadStr);

      const now = new Date().toISOString();

      // log attempt via notification_log table to keep visibility
        await logNotificationAttempt({
        transactionId: r.transaction_id || null,
        sourceType: r.source_type,
        channel: r.channel,
        payload: payloadStr,
        attemptNumber: (r.attempt_count || 0) + 1,
        success: !!sent,
        responseCode: sent ? 200 : 0,
        responseBody: sent ? 'ok' : 'failed',
        nextRetryAt: null,
      });

      if (sent) {
        // mark done
        jobDb.prepare("UPDATE notification_jobs SET status='done', attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(r.id);
        successCount++;

        // if meta contains url for news, mark news_cache notified
        if (meta && meta.url) {
          jobDb.prepare('UPDATE news_cache SET notified = 1 WHERE url = ?').run(meta.url);
        }
        // if job references a transaction, mark transaction notified
        if (r.transaction_id) {
          jobDb.prepare('UPDATE transactions SET notification_sent = 1 WHERE id = ?').run(r.transaction_id);
        }
      } else {
        // failure: schedule retry with backoff
        const prev = r.attempt_count || 0;
        const nextAttempt = prev + 1;
        const MAX = Number(process.env.NOTIFICATION_MAX_RETRIES) || 5;
        if (nextAttempt > MAX) {
          jobDb.prepare("UPDATE notification_jobs SET status='failed', attempt_count = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextAttempt, 'max_retries_exceeded', r.id);
        } else {
          const baseSec = Number(process.env.NOTIFICATION_BACKOFF_BASE_SEC) || 30;
          const backoff = baseSec * Math.pow(2, nextAttempt - 1);
          const nextRunAt = new Date(Date.now() + backoff * 1000).toISOString();
          jobDb.prepare("UPDATE notification_jobs SET status='failed', attempt_count = ?, last_error = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextAttempt, 'send_failed', nextRunAt, r.id);
        }
      }
    } catch (err) {
      console.error('Job processing error id=', r.id, err);
      try {
        const db2 = getDatabase();
        db2.prepare("UPDATE notification_jobs SET status='failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(String(err instanceof Error ? err.message : err), r.id);
      } catch (e) {
        // ignore
      }
    }
  }

  if (successCount > 0) consoleLogNotification('JobProcessor', { succeeded: successCount });
  return successCount;
}

// Auto-start worker in non-test environments
if (process.env.NODE_ENV !== 'test') {
  ensureJobsTable();
  const INTERVAL_SEC = Number(process.env.NOTIFICATION_JOB_WORKER_INTERVAL_SEC) || 15;
  setInterval(() => {
    processPendingJobs(50).catch(err => console.error('Notification job worker error:', err));
  }, INTERVAL_SEC * 1000);
}

export default {
  enqueueNotification,
  processPendingJobs,
};
