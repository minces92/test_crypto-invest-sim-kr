const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'crypto_cache.db');
const db = new Database(dbPath);

console.log(`[optimize-db] Connecting to database at ${dbPath}...`);

try {
  // 1. Add Indices
  console.log('[optimize-db] Creating indices...');

  const indices = [
    // News Cache: Optimize sorting by date
    'CREATE INDEX IF NOT EXISTS idx_news_cache_published_at ON news_cache(published_at DESC)',

    // Notification Log: Optimize lookups by hash (deduplication)
    'CREATE INDEX IF NOT EXISTS idx_notification_log_message_hash ON notification_log(message_hash)',

    // Notification Log: Optimize retry logic
    'CREATE INDEX IF NOT EXISTS idx_notification_log_retry ON notification_log(next_retry_at, success)',

    // Transactions: Optimize history view by market and time
    'CREATE INDEX IF NOT EXISTS idx_transactions_market_timestamp ON transactions(market, timestamp DESC)',

    // Candle Cache: Optimize retrieval by market and interval
    'CREATE INDEX IF NOT EXISTS idx_candle_cache_market_interval ON candle_cache(market, interval, candle_date_time_utc DESC)'
  ];

  db.transaction(() => {
    for (const sql of indices) {
      db.exec(sql);
      console.log(`  - Executed: ${sql.split('ON')[0]}...`);
    }
  })();

  console.log('[optimize-db] Indices created successfully.');

  // 2. Run Maintenance
  console.log('[optimize-db] Running maintenance commands...');

  console.log('  - PRAGMA optimize...');
  db.pragma('optimize');

  console.log('  - ANALYZE...');
  db.exec('ANALYZE');

  console.log('  - VACUUM...');
  db.exec('VACUUM');

  console.log('[optimize-db] Database optimization complete.');

} catch (err) {
  console.error('[optimize-db] Error optimizing database:', err);
  process.exit(1);
} finally {
  db.close();
}
