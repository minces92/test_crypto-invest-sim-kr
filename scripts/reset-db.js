const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'crypto_cache.db');

console.log('Resetting database...');
console.log('Database path:', dbPath);

try {
  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath);
    
    // 모든 테이블 삭제
    db.exec(`
      DROP TABLE IF EXISTS candle_cache;
      DROP TABLE IF EXISTS news_cache;
      DROP TABLE IF EXISTS transaction_analysis_cache;
      DROP TABLE IF EXISTS transactions;
    `);
    
    console.log('All tables dropped.');
    
    // 테이블 재생성
    db.exec(`
      CREATE TABLE IF NOT EXISTS candle_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market TEXT NOT NULL,
        candle_date_time_utc TEXT NOT NULL,
        opening_price REAL,
        high_price REAL,
        low_price REAL,
        trade_price REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(market, candle_date_time_utc)
      );

      CREATE INDEX IF NOT EXISTS idx_candle_market_time 
        ON candle_cache(market, candle_date_time_utc);
      
      CREATE INDEX IF NOT EXISTS idx_candle_created 
        ON candle_cache(created_at);

      CREATE TABLE IF NOT EXISTS news_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT UNIQUE,
        source_name TEXT,
        published_at TEXT,
        sentiment TEXT,
        keywords TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_news_published 
        ON news_cache(published_at);
      
      CREATE INDEX IF NOT EXISTS idx_news_created 
        ON news_cache(created_at);

      CREATE TABLE IF NOT EXISTS transaction_analysis_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL UNIQUE,
        analysis TEXT NOT NULL,
        market TEXT,
        transaction_type TEXT,
        price REAL,
        amount REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_analysis_transaction_id 
        ON transaction_analysis_cache(transaction_id);
      
      CREATE INDEX IF NOT EXISTS idx_analysis_created 
        ON transaction_analysis_cache(created_at);

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        market TEXT NOT NULL,
        price REAL NOT NULL,
        amount REAL NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_timestamp 
        ON transactions(timestamp DESC);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_market 
        ON transactions(market);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_type 
        ON transactions(type);
    `);
    
    console.log('Database reset completed successfully!');
    db.close();
  } else {
    console.log('Database file does not exist. Creating new database...');
    const db = new Database(dbPath);
    
    // 테이블 생성
    db.exec(`
      CREATE TABLE IF NOT EXISTS candle_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market TEXT NOT NULL,
        candle_date_time_utc TEXT NOT NULL,
        opening_price REAL,
        high_price REAL,
        low_price REAL,
        trade_price REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(market, candle_date_time_utc)
      );

      CREATE INDEX IF NOT EXISTS idx_candle_market_time 
        ON candle_cache(market, candle_date_time_utc);
      
      CREATE INDEX IF NOT EXISTS idx_candle_created 
        ON candle_cache(created_at);

      CREATE TABLE IF NOT EXISTS news_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT UNIQUE,
        source_name TEXT,
        published_at TEXT,
        sentiment TEXT,
        keywords TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_news_published 
        ON news_cache(published_at);
      
      CREATE INDEX IF NOT EXISTS idx_news_created 
        ON news_cache(created_at);

      CREATE TABLE IF NOT EXISTS transaction_analysis_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL UNIQUE,
        analysis TEXT NOT NULL,
        market TEXT,
        transaction_type TEXT,
        price REAL,
        amount REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_analysis_transaction_id 
        ON transaction_analysis_cache(transaction_id);
      
      CREATE INDEX IF NOT EXISTS idx_analysis_created 
        ON transaction_analysis_cache(created_at);

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        market TEXT NOT NULL,
        price REAL NOT NULL,
        amount REAL NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_timestamp 
        ON transactions(timestamp DESC);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_market 
        ON transactions(market);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_type 
        ON transactions(type);
    `);
    
    console.log('New database created successfully!');
    db.close();
  }
} catch (error) {
  console.error('Error resetting database:', error);
  process.exit(1);
}

