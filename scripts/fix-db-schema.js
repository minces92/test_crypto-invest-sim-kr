const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'crypto_cache.db');
console.log(`Opening database at ${dbPath}...`);

try {
    const db = new Database(dbPath);

    // Check settings table info
    const columns = db.pragma('table_info(settings)');
    const hasUpdatedAt = columns.some(c => c.name === 'updated_at');

    if (hasUpdatedAt) {
        console.log('✅ "updated_at" column already exists in "settings" table.');
    } else {
        console.log('⚠️ "updated_at" column missing. Adding it now...');
        // Add column without dynamic default to avoid SQLite limitation
        db.exec('ALTER TABLE settings ADD COLUMN updated_at DATETIME');
        console.log('✅ Successfully added "updated_at" column.');

        // Optional: Update existing rows
        db.exec("UPDATE settings SET updated_at = datetime('now') WHERE updated_at IS NULL");
        console.log('✅ Updated existing rows with current time.');
    }

    db.close();
} catch (error) {
    console.error('❌ Error fixing database schema:', error);
    process.exit(1);
}
