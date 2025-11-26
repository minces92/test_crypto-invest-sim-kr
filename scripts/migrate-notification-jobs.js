const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'crypto_cache.db');
const db = new Database(dbPath);

console.log('Opening DB at', dbPath);

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

console.log('Migration completed: notification_jobs table ensured.');
process.exit(0);
