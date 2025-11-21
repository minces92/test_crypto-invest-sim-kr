const Database = require('better-sqlite3');
const path = require('path');

// This is a one-time migration script.
// We use the value directly for simplicity, avoiding TS/JS module issues.
const DEFAULT_INITIAL_CASH = 1000000;

const dbPath = path.join(__dirname, '..', 'crypto_cache.db');
const db = new Database(dbPath);

console.log('Running migration: Add settings table...');

try {
  // 1. Create settings table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  console.log('Table "settings" created or already exists.');

  // 2. Insert default initial_cash if it doesn't exist
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const existingSetting = stmt.get('initial_cash');

  if (!existingSetting) {
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insert.run('initial_cash', DEFAULT_INITIAL_CASH.toString());
    console.log(`Default setting "initial_cash" inserted with value: ${DEFAULT_INITIAL_CASH}`);
  } else {
    console.log('"initial_cash" setting already exists.');
  }

  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
