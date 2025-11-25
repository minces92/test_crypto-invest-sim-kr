const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'crypto_cache.db');
const db = new Database(dbPath);

function columnExists(table, column) {
  const rows = db.pragma(`table_info(${table})`);
  return rows.some(r => r.name === column);
}

console.log('Checking notification_log columns...');
const table = 'notification_log';

try {
  if (!columnExists(table, 'message_hash')) {
    console.log('Adding column: message_hash');
    db.exec(`ALTER TABLE ${table} ADD COLUMN message_hash TEXT`);
  }
  if (!columnExists(table, 'attempt_number')) {
    console.log('Adding column: attempt_number');
    db.exec(`ALTER TABLE ${table} ADD COLUMN attempt_number INTEGER DEFAULT 1`);
  }
  if (!columnExists(table, 'response_code')) {
    console.log('Adding column: response_code');
    db.exec(`ALTER TABLE ${table} ADD COLUMN response_code INTEGER`);
  }
  if (!columnExists(table, 'response_body')) {
    console.log('Adding column: response_body');
    db.exec(`ALTER TABLE ${table} ADD COLUMN response_body TEXT`);
  }
  if (!columnExists(table, 'next_retry_at')) {
    console.log('Adding column: next_retry_at');
    db.exec(`ALTER TABLE ${table} ADD COLUMN next_retry_at TIMESTAMP NULL`);
  }
  console.log('Migration completed.');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  db.close();
}
