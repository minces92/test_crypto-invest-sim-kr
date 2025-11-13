import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { sendMessage } from './telegram';

const dbPath = path.join(process.cwd(), 'crypto_cache.db');

// 데이터베이스 초기화
let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database: Database.Database) {
  // 캔들 데이터 캐시 테이블
  database.exec(`
    CREATE TABLE IF NOT EXISTS candle_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market TEXT NOT NULL,
      interval TEXT NOT NULL DEFAULT 'day',
      candle_date_time_utc TEXT NOT NULL,
      opening_price REAL,
      high_price REAL,
      low_price REAL,
      trade_price REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(market, interval, candle_date_time_utc)
    );

    CREATE INDEX IF NOT EXISTS idx_candle_market_time 
      ON candle_cache(market, interval, candle_date_time_utc);
    
    CREATE INDEX IF NOT EXISTS idx_candle_created 
      ON candle_cache(created_at);
  `);

  // Check if 'interval' column exists and add it if it doesn't
  const candleColumns: { name: string }[] = database.pragma('table_info(candle_cache)') as any;
  if (!candleColumns.some(c => c.name === 'interval')) {
    database.exec("ALTER TABLE candle_cache ADD COLUMN interval TEXT NOT NULL DEFAULT 'day'");
    // Recreate unique index for backward compatibility
    database.exec('DROP INDEX IF EXISTS idx_candle_market_time');
    database.exec('DROP INDEX IF EXISTS candle_cache_market_candle_date_time_utc_unique'); // Old implicit index name
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_candle_market_interval_time 
      ON candle_cache(market, interval, candle_date_time_utc)
    `);
  }

  // 뉴스 캐시 테이블
  database.exec(`
    CREATE TABLE IF NOT EXISTS news_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT UNIQUE,
      source_name TEXT,
      published_at TEXT,
      sentiment TEXT,
      keywords TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notified INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_news_published 
      ON news_cache(published_at);
    
    CREATE INDEX IF NOT EXISTS idx_news_created 
      ON news_cache(created_at);
  `);

  // Check if 'notified' column exists and add it if it doesn't
  const newsColumns: { name: string }[] = database.pragma('table_info(news_cache)') as any;
  if (!newsColumns.some(c => c.name === 'notified')) {
    database.exec('ALTER TABLE news_cache ADD COLUMN notified INTEGER DEFAULT 0');
  }

  // 거래 분석 캐시 테이블
  database.exec(`
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
  `);

  // 거래 내역 테이블 (기본 구조)
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      market TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // PRAGMA를 사용하여 테이블 정보 가져오기
  const columns: { name: string }[] = database.pragma('table_info(transactions)') as any;
  const columnNames = columns.map(c => c.name);

  // 누락된 컬럼 추가
  if (!columnNames.includes('source')) {
    database.exec('ALTER TABLE transactions ADD COLUMN source TEXT');
  }
  if (!columnNames.includes('is_auto')) {
    database.exec('ALTER TABLE transactions ADD COLUMN is_auto INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('strategy_type')) {
    database.exec('ALTER TABLE transactions ADD COLUMN strategy_type TEXT');
  }

  // 인덱스 생성
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_timestamp 
      ON transactions(timestamp DESC);
    
    CREATE INDEX IF NOT EXISTS idx_transactions_market 
      ON transactions(market);
    
    CREATE INDEX IF NOT EXISTS idx_transactions_type 
      ON transactions(type);
    
    CREATE INDEX IF NOT EXISTS idx_transactions_is_auto 
      ON transactions(is_auto);
  `);
}

export interface CandleCacheData {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume?: number;
}

export interface NewsCacheData {
  title: string;
  description: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
  sentiment?: string;
}

/**
 * 캔들 데이터를 캐시에서 가져오거나 API에서 가져옵니다.
 * @param market - 코인 마켓 (예: 'KRW-BTC')
 * @param count - 가져올 캔들 개수
 * @param cacheHours - 캐시 유효 시간 (시간 단위, 기본값: 1)
 * @returns 캔들 데이터 배열
 */
export async function getCandlesWithCache(
  market: string,
  count: number,
  interval: string = 'day', // e.g., 'day', 'minute240', 'minute60', 'minute30'
  cacheHours: number = 1
): Promise<CandleCacheData[]> {
  const database = getDatabase();
  const cacheExpiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);

  // Normalize interval: guard against literal 'undefined' or empty strings coming from query params
  if (!interval || interval === 'undefined' || (typeof interval === 'string' && interval.trim() === '')) {
    console.warn('[cache] getCandlesWithCache received invalid interval, defaulting to "day"', { market, count, interval });
    interval = 'day';
  }

  // 캐시에서 최근 데이터 확인
  const cached = database
    .prepare(`
      SELECT * FROM candle_cache
      WHERE market = ? AND interval = ? AND created_at > ?
      ORDER BY candle_date_time_utc DESC
      LIMIT ?
    `)
    .all(market, interval, cacheExpiry.toISOString(), count) as Array<{
    candle_date_time_utc: string;
    opening_price: number;
    high_price: number;
    low_price: number;
    trade_price: number;
  }>;

  // 캐시에 충분한 데이터가 있으면 반환
  if (cached.length >= count * 0.9) {
    return cached.map(row => ({
      candle_date_time_utc: row.candle_date_time_utc,
      opening_price: row.opening_price,
      high_price: row.high_price,
      low_price: row.low_price,
      trade_price: row.trade_price,
    })).sort((a, b) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime());
  }

  // API URL 동적 구성
  let apiUrl = 'https://api.upbit.com/v1/candles/';
  if (interval === 'day') {
    apiUrl += `days?market=${market}&count=${count}`;
  } else if (typeof interval === 'string' && interval.startsWith('minute')) {
    const unit = interval.replace('minute', '');
    // unit should be numeric (e.g., minute60 -> '60')
    if (!/^[0-9]+$/.test(unit)) {
      console.error('[cache] getCandlesWithCache invalid minute unit', { market, interval });
      throw new Error(`Unsupported minute interval format: ${interval}`);
    }
    apiUrl += `minutes/${unit}?market=${market}&count=${count}`;
  } else {
    const supported = ['day', 'minute1', 'minute3', 'minute5', 'minute10', 'minute15', 'minute30', 'minute60', 'minute240'];
    console.error('[cache] getCandlesWithCache unsupported interval', { market, interval, supported });
    throw new Error(`Unsupported interval: ${interval}. Supported: ${supported.join(', ')}`);
  }

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Upbit API request failed: ${response.status} for URL: ${apiUrl}`);
  }
  const freshData: CandleCacheData[] = await response.json();

  // 캐시에 저장
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO candle_cache 
    (market, interval, candle_date_time_utc, opening_price, high_price, low_price, trade_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = database.transaction(() => {
    for (const candle of freshData) {
      stmt.run(
        market,
        interval,
        candle.candle_date_time_utc,
        candle.opening_price,
        candle.high_price,
        candle.low_price,
        candle.trade_price
      );
    }
  });

  transaction();

  return freshData.sort((a, b) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime());
}

/**
 * 뉴스 데이터를 캐시에서 가져오거나 API에서 가져옵니다.
 * @param query - 검색 쿼리
 * @param language - 언어 (기본값: 'ko')
 * @param cacheHours - 캐시 유효 시간 (시간 단위, 기본값: 24)
 * @returns 뉴스 데이터 배열
 */
export async function getNewsWithCache(
  query: string,
  language: string = 'ko',
  cacheHours: number = 1,
  forceRefresh: boolean = false
): Promise<NewsCacheData[]> {
  const database = getDatabase();
  const cacheExpiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);

  // API 키 확인
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  if (!NEWS_API_KEY) {
    console.error("NEWS_API_KEY is not configured in environment variables. News fetching is disabled.");
    // 키가 없으면 캐시된 데이터라도 보여주되, 강제 갱신 시에는 빈 배열을 반환하여 UI에 상태를 반영
    if (forceRefresh) return [];
    
    const fallbackCached = database
      .prepare('SELECT * FROM news_cache ORDER BY published_at DESC LIMIT 50')
      .all() as any[];
    
    return fallbackCached.map(row => ({
      title: row.title,
      description: row.description,
      url: row.url,
      source: { name: row.source_name },
      publishedAt: row.published_at,
      sentiment: row.sentiment || 'neutral',
    }));
  }

  // 강제 갱신이 아니면 캐시 확인
  if (!forceRefresh) {
    const cached = database
      .prepare('SELECT * FROM news_cache WHERE created_at > ? ORDER BY published_at DESC LIMIT 50')
      .all(cacheExpiry.toISOString()) as any[];

    if (cached.length >= 5) {
      return cached.map(row => ({
        title: row.title,
        description: row.description,
        url: row.url,
        source: { name: row.source_name },
        publishedAt: row.published_at,
        sentiment: row.sentiment || 'neutral',
      }));
    }
  }

  // API에서 데이터 가져오기
  const response = await fetch(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${language}&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`NewsAPI request failed: ${response.status}`, errorBody);
    // API 실패 시, 에러를 던져서 호출 측에서 처리하도록 함
    throw new Error(`NewsAPI request failed with status ${response.status}`);
  }

  const data = await response.json();
  const freshData: NewsCacheData[] = data.articles || [];

  if (freshData.length === 0) {
    // 새 뉴스가 없으면 빈 배열 반환 (오래된 캐시를 저장하지 않음)
    return [];
  }
  
  // 감성 분석 (간단한 키워드 기반)
  const analyzeSentiment = (title: string, description: string | null): string => {
    const text = (title + ' ' + (description || '')).toLowerCase();
    const positiveKeywords = ['호재', '상승', '급등', '돌파', '성장', '발전', '협력', '파트너십', '출시', '성공', '기대', '긍정', '강세', '회복', '안정'];
    const negativeKeywords = ['악재', '하락', '급락', '폭락', '붕괴', '규제', '경고', '위험', '해킹', '사기', '조작', '부정', '약세', '침체', '불안'];
    
    let sentimentScore = 0;
    positiveKeywords.forEach(keyword => {
      if (text.includes(keyword)) sentimentScore++;
    });
    negativeKeywords.forEach(keyword => {
      if (text.includes(keyword)) sentimentScore--;
    });
    
    if (sentimentScore > 0) return 'positive';
    if (sentimentScore < 0) return 'negative';
    return 'neutral';
  };

  // 캐시에 저장하고 알림 보내기
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO news_cache 
    (title, description, url, source_name, published_at, sentiment, notified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateNotifiedStmt = database.prepare('UPDATE news_cache SET notified = 1 WHERE url = ?');

  const transaction = database.transaction(() => {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

    for (const article of freshData) {
      const sentiment = analyzeSentiment(article.title, article.description);
      
      // DB에 이미 존재하는지, 그리고 notified 상태인지 확인
      const existing = database.prepare('SELECT notified FROM news_cache WHERE url = ?').get(article.url) as { notified: number } | undefined;

      // 새롭고(존재하지 않거나), 아직 알림이 가지 않은(notified=0) 주요 뉴스인 경우 알림 전송
      if ((!existing || existing.notified === 0) && (sentiment === 'positive' || sentiment === 'negative')) {
        const sentimentText = sentiment === 'positive' ? '📢 호재' : '⚠️ 악재';
        const message = `
<b>${sentimentText} 뉴스 알림</b>
-------------------------
<b>제목:</b> ${article.title}
<b>출처:</b> ${article.source.name}
<b>요약:</b> ${article.description || 'N/A'}
-------------------------
<a href="${article.url}">원문 보기</a> | <a href="${siteUrl}">사이트 방문</a>
        `;
        sendMessage(message, 'HTML');
        
        // 알림 상태와 함께 저장
        stmt.run(
          article.title,
          article.description,
          article.url,
          article.source.name,
          article.publishedAt,
          sentiment,
          1 // notified = 1
        );
      } else {
        // 그 외의 경우, 기존 notified 상태를 유지하며 저장
        stmt.run(
          article.title,
          article.description,
          article.url,
          article.source.name,
          article.publishedAt,
          sentiment,
          existing?.notified || 0
        );
      }
    }
  });

  transaction();

  return freshData.map(article => ({
    ...article,
    sentiment: analyzeSentiment(article.title, article.description),
  }));
}

/**
 * 거래 분석 결과를 캐시에서 가져오거나 저장합니다.
 * @param transactionId - 거래 ID
 * @param analysis - 분석 결과 (저장 시에만 필요)
 * @param transactionData - 거래 데이터 (저장 시에만 필요)
 * @returns 분석 결과 또는 null
 */
export function getOrSaveTransactionAnalysis(
  transactionId: string,
  analysis?: string,
  transactionData?: {
    market?: string;
    type?: string;
    price?: number;
    amount?: number;
  }
): string | null {
  const database = getDatabase();

  // 조회
  if (!analysis) {
    const cached = database
      .prepare('SELECT analysis FROM transaction_analysis_cache WHERE transaction_id = ?')
      .get(transactionId) as { analysis: string } | undefined;

    return cached ? cached.analysis : null;
  }

  // 저장
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO transaction_analysis_cache 
    (transaction_id, analysis, market, transaction_type, price, amount, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    transactionId,
    analysis,
    transactionData?.market || null,
    transactionData?.type || null,
    transactionData?.price || null,
    transactionData?.amount || null
  );

  return analysis;
}

/**
 * 모든 거래 분석 결과를 가져옵니다.
 * @returns 거래 ID를 키로 하는 분석 결과 맵
 */
export function getAllTransactionAnalyses(): Record<string, string> {
  const database = getDatabase();
  const results = database
    .prepare('SELECT transaction_id, analysis FROM transaction_analysis_cache')
    .all() as Array<{ transaction_id: string; analysis: string }>;

  const analysisMap: Record<string, string> = {};
  results.forEach(row => {
    analysisMap[row.transaction_id] = row.analysis;
  });

  return analysisMap;
}

/**
 * 거래 분석 캐시를 삭제합니다.
 * @param transactionId - 거래 ID (선택적, 없으면 전체 삭제)
 */
export function deleteTransactionAnalysis(transactionId?: string): void {
  const database = getDatabase();
  if (transactionId) {
    database
      .prepare('DELETE FROM transaction_analysis_cache WHERE transaction_id = ?')
      .run(transactionId);
  } else {
    database.prepare('DELETE FROM transaction_analysis_cache').run();
  }
}

/**
 * 오래된 캐시 데이터 정리
 * @param days - 보관할 일수 (기본값: 7)
 */
export function cleanOldCache(days: number = 7): void {
  const database = getDatabase();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  database
    .prepare('DELETE FROM candle_cache WHERE created_at < ?')
    .run(cutoff.toISOString());

  database
    .prepare('DELETE FROM news_cache WHERE created_at < ?')
    .run(cutoff.toISOString());
}

/**
 * 거래 내역을 가져옵니다.
 * @returns 거래 내역 배열 (최신순)
 */
export function getTransactions(): Array<{
  id: string;
  type: 'buy' | 'sell';
  market: string;
  price: number;
  amount: number;
  timestamp: string;
  source?: string;
  isAuto: boolean;
  strategyType?: string;
}> {
  const database = getDatabase();
  const results = database
    .prepare('SELECT * FROM transactions ORDER BY timestamp DESC')
    .all() as Array<{
    id: string;
    type: string;
    market: string;
    price: number;
    amount: number;
    timestamp: string;
    source: string | null;
    is_auto: number;
    strategy_type: string | null;
  }>;

  return results.map(row => ({
    id: row.id,
    type: row.type as 'buy' | 'sell',
    market: row.market,
    price: row.price,
    amount: row.amount,
    timestamp: row.timestamp,
    source: row.source || undefined,
    isAuto: row.is_auto === 1,
    strategyType: row.strategy_type || undefined,
  }));
}

/**
 * 거래 내역을 저장합니다.
 * @param transaction - 거래 내역 객체
 */
export function saveTransaction(transaction: {
  id: string;
  type: 'buy' | 'sell';
  market: string;
  price: number;
  amount: number;
  timestamp: string;
  source?: string;
  isAuto?: boolean;
  strategyType?: string;
}): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO transactions 
    (id, type, market, price, amount, timestamp, source, is_auto, strategy_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // source가 'manual'이면 isAuto = 0, 그 외는 1
  const isAuto = transaction.isAuto !== undefined 
    ? transaction.isAuto 
    : (transaction.source !== 'manual' && transaction.source !== undefined);
  
  const strategyType = transaction.strategyType;

  stmt.run(
    transaction.id,
    transaction.type,
    transaction.market,
    transaction.price,
    transaction.amount,
    transaction.timestamp,
    transaction.source || null,
    isAuto ? 1 : 0,
    strategyType || null
  );
}

/**
 * 거래 내역을 삭제합니다.
 * @param transactionId - 거래 ID (선택적, 없으면 전체 삭제)
 */
export function deleteTransaction(transactionId?: string): void {
  const database = getDatabase();
  if (transactionId) {
    database
      .prepare('DELETE FROM transactions WHERE id = ?')
      .run(transactionId);
  } else {
    database.prepare('DELETE FROM transactions').run();
  }
}

/**
 * 데이터베이스 초기화 (모든 테이블 삭제 후 재생성)
 */
export function resetDatabase(): void {
  const database = getDatabase();
  
  // 모든 테이블 삭제
  database.exec(`
    DROP TABLE IF EXISTS candle_cache;
    DROP TABLE IF EXISTS news_cache;
    DROP TABLE IF EXISTS transaction_analysis_cache;
    DROP TABLE IF EXISTS transactions;
  `);
  
  // 테이블 재생성
  initializeDatabase(database);
}

