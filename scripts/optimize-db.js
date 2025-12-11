// scripts/optimize-db.js
// notification_log 테이블 인덱스 추가 스크립트
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'crypto_cache.db');
const db = new Database(dbPath);

console.log('Adding index to notification_log.created_at ...');
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log(created_at DESC);');
  console.log('Index created successfully.');
} catch (err) {
  console.error('Failed to create index:', err);
}
db.close();
