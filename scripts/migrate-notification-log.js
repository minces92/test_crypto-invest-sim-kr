/**
 * notification_log 테이블 마이그레이션 스크립트
 * 누락된 컬럼(message_hash, attempt_number, next_retry_at)을 추가합니다.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'crypto_cache.db');

console.log('Starting notification_log table migration...');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // 테이블 정보 확인
  const columns = db.pragma('table_info(notification_log)');
  const columnNames = columns.map(c => c.name);

  console.log('Current columns:', columnNames);

  let migrated = false;

  // message_hash 컬럼 추가
  if (!columnNames.includes('message_hash')) {
    try {
      db.exec('ALTER TABLE notification_log ADD COLUMN message_hash TEXT');
      console.log('✓ Added message_hash column');
      migrated = true;
    } catch (err) {
      console.error('✗ Failed to add message_hash:', err.message);
    }
  } else {
    console.log('✓ message_hash column already exists');
  }

  // attempt_number 컬럼 추가
  if (!columnNames.includes('attempt_number')) {
    try {
      db.exec('ALTER TABLE notification_log ADD COLUMN attempt_number INTEGER DEFAULT 1');
      console.log('✓ Added attempt_number column');
      migrated = true;
    } catch (err) {
      console.error('✗ Failed to add attempt_number:', err.message);
    }
  } else {
    console.log('✓ attempt_number column already exists');
  }

  // next_retry_at 컬럼 추가
  if (!columnNames.includes('next_retry_at')) {
    try {
      db.exec('ALTER TABLE notification_log ADD COLUMN next_retry_at TIMESTAMP NULL');
      console.log('✓ Added next_retry_at column');
      migrated = true;
    } catch (err) {
      console.error('✗ Failed to add next_retry_at:', err.message);
    }
  } else {
    console.log('✓ next_retry_at column already exists');
  }

  // message_hash 인덱스 추가
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_notification_message_hash ON notification_log(message_hash)');
    console.log('✓ Created index on message_hash');
  } catch (err) {
    console.warn('⚠ Index creation warning:', err.message);
  }

  // 기존 데이터의 attempt_number 업데이트 (NULL인 경우)
  try {
    const updated = db.prepare('UPDATE notification_log SET attempt_number = 1 WHERE attempt_number IS NULL').run();
    if (updated.changes > 0) {
      console.log(`✓ Updated ${updated.changes} rows with default attempt_number`);
      migrated = true;
    }
  } catch (err) {
    console.warn('⚠ Failed to update existing data:', err.message);
  }

  db.close();

  if (migrated) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n✅ Database is already up to date.');
  }
} catch (err) {
  console.error('✗ Migration failed:', err);
  process.exit(1);
}



