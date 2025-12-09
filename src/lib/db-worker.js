const { parentPort } = require('worker_threads');
const path = require('path');
const Database = require('better-sqlite3');
const { performance } = require('perf_hooks');

const dbPath = path.join(process.cwd(), 'crypto_cache.db');
let db = null;

function logSlowQuery(duration, sql) {
  if (duration > 500) { // Warn if query takes > 500ms
    console.warn(`[DB Worker] Slow query (${duration.toFixed(2)}ms): ${sql.substring(0, 200)}...`);
  }
}

function initDatabase() {
  if (db) return;

  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Transactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        market TEXT NOT NULL,
        price REAL NOT NULL,
        amount REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        isAuto INTEGER DEFAULT 0,
        strategyType TEXT,
        source TEXT
      )
    `);

    // Notification Log table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        message TEXT,
        message_hash TEXT,
        status TEXT,
        success INTEGER DEFAULT 0,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        next_retry_at DATETIME,
        retry_count INTEGER DEFAULT 0
      )
    `);

    // Strategies table
    db.exec(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        market TEXT NOT NULL,
        strategyType TEXT NOT NULL,
        name TEXT,
        params TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Check if updated_at exists in settings
    try {
      const columns = db.pragma('table_info(settings)');
      const hasUpdatedAt = columns.some(c => c.name === 'updated_at');
      if (!hasUpdatedAt) {
        console.log('[DB Worker] Migrating settings table: adding updated_at column');
        db.exec('ALTER TABLE settings ADD COLUMN updated_at DATETIME');
        db.exec("UPDATE settings SET updated_at = datetime('now') WHERE updated_at IS NULL");
      }
    } catch (e) {
      console.error('[DB Worker] Settings migration failed:', e);
    }

    // Portfolio Snapshots table
    db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        snapshot_date DATE,
        total_value REAL,
        cash_balance REAL,
        holdings TEXT,
        holdings_value REAL,
        total_gain REAL,
        total_return_pct REAL,
        daily_return_pct REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Portfolio Shares table
    db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        share_token TEXT UNIQUE NOT NULL,
        name TEXT,
        description TEXT,
        show_holdings INTEGER DEFAULT 1,
        show_returns INTEGER DEFAULT 1,
        show_trades INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `);

    // Indices
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notification_retry 
      ON notification_log(success, next_retry_at) 
      WHERE success = 0
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notification_hash 
      ON notification_log(message_hash)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_market_time 
      ON transactions(market, timestamp DESC)
    `);

  } catch (err) {
    console.error('[DB Worker] Failed to initialize database:', err);
    throw err;
  }
}

function sendResponse(id, result) {
  parentPort.postMessage({ id, ok: true, result });
}

function sendError(id, error) {
  console.error('[DB Worker Error]', error);
  parentPort.postMessage({ id, ok: false, error: error.message || String(error) });
}

parentPort.on('message', async (msg) => {
  const { id, action } = msg;
  try {
    if (action === 'init') {
      initDatabase();
      sendResponse(id, 'ok');
    } else if (action === 'queryAll') {
      initDatabase();
      const { sql, params } = msg;
      const start = performance.now();
      const stmt = db.prepare(sql);
      const rows = stmt.all(...(params || []));
      const duration = performance.now() - start;
      logSlowQuery(duration, sql);
      sendResponse(id, rows);
    } else if (action === 'queryGet') {
      initDatabase();
      const { sql, params } = msg;
      const start = performance.now();
      const stmt = db.prepare(sql);
      const row = stmt.get(...(params || []));
      const duration = performance.now() - start;
      logSlowQuery(duration, sql);
      sendResponse(id, row);
    } else if (action === 'run') {
      initDatabase();
      const { sql, params } = msg;
      const start = performance.now();
      const stmt = db.prepare(sql);
      const res = stmt.run(...(params || []));
      const duration = performance.now() - start;
      logSlowQuery(duration, sql);
      sendResponse(id, res);
    } else if (action === 'transaction') {
      initDatabase();
      const { statements } = msg; // [{sql, params}]
      const start = performance.now();
      const transaction = db.transaction(() => {
        const results = [];
        for (const s of statements) {
          const stmt = db.prepare(s.sql);
          results.push(stmt.run(...(s.params || [])));
        }
        return results;
      });
      const res = transaction();
      const duration = performance.now() - start;
      if (duration > 1000) {
        console.warn(`[DB Worker] Slow transaction (${duration.toFixed(2)}ms) with ${statements.length} statements`);
      }
      sendResponse(id, res);
    } else if (action === 'close') {
      if (db) db.close();
      db = null;
      sendResponse(id, 'closed');
    } else {
      throw new Error('Unknown action: ' + action);
    }
  } catch (err) {
    sendError(id, err);
  }
});
