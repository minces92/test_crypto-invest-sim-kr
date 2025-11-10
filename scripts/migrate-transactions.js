const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'crypto_cache.db');
const transactionsJsonPath = path.join(__dirname, '..', 'transactions.json');

console.log('Migrating transactions from JSON to database...');
console.log('Database path:', dbPath);
console.log('JSON file path:', transactionsJsonPath);

try {
  // JSON 파일 읽기
  let transactions = [];
  if (fs.existsSync(transactionsJsonPath)) {
    const jsonData = fs.readFileSync(transactionsJsonPath, 'utf-8');
    const trimmedData = jsonData.trim();
    if (trimmedData && trimmedData !== '') {
      try {
        transactions = JSON.parse(trimmedData);
        if (!Array.isArray(transactions)) {
          console.log('JSON file does not contain an array, skipping migration.');
          process.exit(0);
        }
      } catch (error) {
        console.error('Failed to parse JSON file:', error);
        process.exit(1);
      }
    }
  } else {
    console.log('transactions.json file does not exist. Nothing to migrate.');
    process.exit(0);
  }

  if (transactions.length === 0) {
    console.log('No transactions to migrate.');
    process.exit(0);
  }

  console.log(`Found ${transactions.length} transactions to migrate.`);

  // DB 연결
  const db = new Database(dbPath);

  // transactions 테이블이 없으면 생성
  db.exec(`
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

  // 기존 거래 내역 확인
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
  console.log(`Existing transactions in DB: ${existingCount}`);

  // 거래 내역 삽입
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO transactions 
    (id, type, market, price, amount, timestamp, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransaction = db.transaction((tx) => {
    stmt.run(
      tx.id,
      tx.type,
      tx.market,
      tx.price,
      tx.amount,
      tx.timestamp,
      tx.source || null
    );
  });

  let migrated = 0;
  let skipped = 0;

  transactions.forEach(tx => {
    if (tx && tx.id && tx.type && tx.market && tx.price != null && tx.amount != null && tx.timestamp) {
      try {
        insertTransaction(tx);
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate transaction ${tx.id}:`, error);
        skipped++;
      }
    } else {
      console.warn('Skipping invalid transaction:', tx);
      skipped++;
    }
  });

  console.log(`Migration completed!`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Skipped: ${skipped}`);

  // JSON 파일 백업
  const backupPath = transactionsJsonPath + '.backup';
  fs.copyFileSync(transactionsJsonPath, backupPath);
  console.log(`Original JSON file backed up to: ${backupPath}`);

  db.close();
} catch (error) {
  console.error('Error during migration:', error);
  process.exit(1);
}



