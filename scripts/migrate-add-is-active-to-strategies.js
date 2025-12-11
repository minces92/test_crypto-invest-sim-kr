const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'crypto_cache.db');
const db = new Database(dbPath);

console.log('Running migration: Add is_active column to strategies table...');

try {
  // Check if the column already exists
  const columns = db.pragma('table_info(strategies)');
  const columnExists = columns.some(col => col.name === 'is_active');

  if (!columnExists) {
    db.exec(`
      ALTER TABLE strategies
      ADD COLUMN is_active BOOLEAN DEFAULT 1
    `);
    console.log('Column "is_active" added to "strategies" table with default value 1.');
  } else {
    console.log('Column "is_active" already exists in "strategies" table.');
  }

  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
