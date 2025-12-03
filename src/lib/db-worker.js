const { parentPort } = require('worker_threads');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'crypto_cache.db');
let db = null;

function initDatabase() {
  if (db) return;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  // Initialize schema if not exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS candle_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market TEXT NOT NULL,
        interval TEXT NOT NULL DEFAULT 'day',
        candle_date_time_utc TEXT NOT NULL,
        opening_price REAL NOT NULL,
        high_price REAL NOT NULL,
        low_price REAL NOT NULL,
        trade_price REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(market, interval, candle_date_time_utc)
      );

      CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT,
        source_type TEXT,
        channel TEXT,
        payload TEXT,
        success INTEGER,
        response_code INTEGER,
        response_body TEXT,
        attempt_number INTEGER DEFAULT 1,
        message_hash TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        next_retry_at TEXT
      );

      CREATE TABLE IF NOT EXISTS news_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        url TEXT UNIQUE,
        source_name TEXT,
        published_at TEXT,
        sentiment TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT,
        market TEXT,
        price REAL,
        amount REAL,
        timestamp TEXT,
        source TEXT,
        is_auto INTEGER DEFAULT 0,
        strategy_type TEXT,
        notification_sent INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS transaction_analysis_cache (
        transaction_id TEXT PRIMARY KEY,
        analysis TEXT,
        market TEXT,
        transaction_type TEXT,
        price REAL,
        amount REAL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Jobs table with migration support
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        payload TEXT,
        status TEXT DEFAULT 'pending',
        result TEXT,
        attempt_count INTEGER DEFAULT 0,
        last_error TEXT,
        next_run_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Check and migrate jobs table if needed
    try {
      const columns = db.prepare("PRAGMA table_info(jobs)").all();
      const hasNextRunAt = columns.some(c => c.name === 'next_run_at');
      if (!hasNextRunAt) {
        console.log('Migrating jobs table: adding next_run_at column');
        db.exec("ALTER TABLE jobs ADD COLUMN next_run_at TEXT");
      }
    } catch (e) {
      console.error('Migration error for jobs table:', e);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_type_status_next
        ON jobs(type, status, next_run_at);

      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        snapshot_date DATE NOT NULL,
        total_value REAL NOT NULL,
        cash_balance REAL NOT NULL,
        holdings JSON NOT NULL,
        holdings_value REAL NOT NULL,
        total_gain REAL NOT NULL,
        total_return_pct REAL NOT NULL,
        daily_return_pct REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, snapshot_date)
      );

      CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date 
        ON portfolio_snapshots(snapshot_date DESC);

      CREATE TABLE IF NOT EXISTS portfolio_shares (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        share_token TEXT UNIQUE,
        share_expiry TIMESTAMP,
        show_holdings BOOLEAN DEFAULT true,
        show_trades BOOLEAN DEFAULT true,
        show_returns BOOLEAN DEFAULT true,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS custom_strategies (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT false,
        buy_condition JSON NOT NULL,
        sell_condition JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS active_strategies (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        strategy_type TEXT NOT NULL,
        market TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        config JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize default settings if not exists
    const checkSettings = db.prepare('SELECT count(*) as count FROM settings WHERE key = ?').get('newsRefreshInterval');
    if (!checkSettings || checkSettings.count === 0) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('newsRefreshInterval', '15');
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize DB schema:', err);
  }
}

function sendResponse(id, data) {
  parentPort.postMessage({ id, ok: true, result: data });
}

function sendError(id, error) {
  parentPort.postMessage({ id, ok: false, error: String(error) });
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
      const stmt = db.prepare(sql);
      const rows = stmt.all(...(params || []));
      sendResponse(id, rows);
    } else if (action === 'queryGet') {
      initDatabase();
      const { sql, params } = msg;
      const stmt = db.prepare(sql);
      const row = stmt.get(...(params || []));
      sendResponse(id, row);
    } else if (action === 'run') {
      initDatabase();
      const { sql, params } = msg;
      const stmt = db.prepare(sql);
      const res = stmt.run(...(params || []));
      sendResponse(id, res);
    } else if (action === 'transaction') {
      initDatabase();
      const { statements } = msg; // [{sql, params}]
      const transaction = db.transaction(() => {
        const results = [];
        for (const s of statements) {
          const stmt = db.prepare(s.sql);
          results.push(stmt.run(...(s.params || [])));
        }
        return results;
      });
      const res = transaction();
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
