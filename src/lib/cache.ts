import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
  `);

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_news_published 
      ON news_cache(published_at);
    
    CREATE INDEX IF NOT EXISTS idx_news_created 
      ON news_cache(created_at);
  `);
}

export interface CandleCacheData {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
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
  cacheHours: number = 1
): Promise<CandleCacheData[]> {
  const database = getDatabase();
  const cacheExpiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);

  // 캐시에서 최근 데이터 확인
  const cached = database
    .prepare(`
      SELECT * FROM candle_cache
      WHERE market = ? 
      AND created_at > ?
      ORDER BY candle_date_time_utc DESC
      LIMIT ?
    `)
    .all(market, cacheExpiry.toISOString(), count) as Array<{
    candle_date_time_utc: string;
    opening_price: number;
    high_price: number;
    low_price: number;
    trade_price: number;
  }>;

  // 캐시에 충분한 데이터가 있으면 반환
  if (cached.length >= count * 0.8) {
    return cached.map(row => ({
      candle_date_time_utc: row.candle_date_time_utc,
      opening_price: row.opening_price,
      high_price: row.high_price,
      low_price: row.low_price,
      trade_price: row.trade_price,
    }));
  }

  // API에서 데이터 가져오기
  const response = await fetch(`https://api.upbit.com/v1/candles/days?market=${market}&count=${count}`);
  if (!response.ok) {
    throw new Error(`Upbit API request failed: ${response.status}`);
  }
  const freshData: CandleCacheData[] = await response.json();

  // 캐시에 저장
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO candle_cache 
    (market, candle_date_time_utc, opening_price, high_price, low_price, trade_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = database.transaction(() => {
    for (const candle of freshData) {
      stmt.run(
        market,
        candle.candle_date_time_utc,
        candle.opening_price,
        candle.high_price,
        candle.low_price,
        candle.trade_price
      );
    }
  });

  transaction();

  return freshData;
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
  cacheHours: number = 24
): Promise<NewsCacheData[]> {
  const database = getDatabase();
  const cacheExpiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);

  // 캐시에서 최근 데이터 확인
  const cached = database
    .prepare(`
      SELECT * FROM news_cache
      WHERE created_at > ?
      ORDER BY published_at DESC
      LIMIT 50
    `)
    .all(cacheExpiry.toISOString()) as Array<{
    title: string;
    description: string | null;
    url: string;
    source_name: string;
    published_at: string;
    sentiment: string | null;
  }>;

  // 캐시에 데이터가 있으면 반환
  if (cached.length > 0) {
    return cached.map(row => ({
      title: row.title,
      description: row.description,
      url: row.url,
      source: { name: row.source_name },
      publishedAt: row.published_at,
      sentiment: row.sentiment || undefined,
    }));
  }

  // API에서 데이터 가져오기 (NewsAPI 사용)
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  if (!NEWS_API_KEY) {
    return cached.map(row => ({
      title: row.title,
      description: row.description,
      url: row.url,
      source: { name: row.source_name },
      publishedAt: row.published_at,
      sentiment: row.sentiment || undefined,
    }));
  }

  const response = await fetch(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${language}&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
  );

  if (!response.ok) {
    return cached.map(row => ({
      title: row.title,
      description: row.description,
      url: row.url,
      source: { name: row.source_name },
      publishedAt: row.published_at,
      sentiment: row.sentiment || undefined,
    }));
  }

  const data = await response.json();
  const freshData: NewsCacheData[] = data.articles || [];

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

  // 캐시에 저장
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO news_cache 
    (title, description, url, source_name, published_at, sentiment)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = database.transaction(() => {
    for (const article of freshData) {
      const sentiment = analyzeSentiment(article.title, article.description);
      stmt.run(
        article.title,
        article.description,
        article.url,
        article.source.name,
        article.publishedAt,
        sentiment
      );
    }
  });

  transaction();

  return freshData.map(article => ({
    ...article,
    sentiment: analyzeSentiment(article.title, article.description),
  }));
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

