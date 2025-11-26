import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'crypto_cache.db');

function getDb() {
  return new Database(dbPath);
}

export async function GET(request: Request) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM notification_jobs ORDER BY created_at DESC LIMIT 200').all() as any[];
  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { action, id } = body as { action?: string; id?: number };
  const db = getDb();

  if (!action || !id) return NextResponse.json({ ok: false, error: 'missing action or id' }, { status: 400 });

  if (action === 'delete') {
    db.prepare('DELETE FROM notification_jobs WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'run' || action === 'retry') {
    // mark job ready immediately
    db.prepare("UPDATE notification_jobs SET status='pending', next_run_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
}
