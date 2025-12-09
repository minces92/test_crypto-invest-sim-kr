import { queryAll, queryGet, run as workerRun, transaction as workerTransaction } from '@/lib/db-client';
import crypto from 'crypto';
import { sendMessage } from './telegram';

// In-flight request dedupe map to avoid parallel identical API calls
const inFlightRequests: Map<string, Promise<any>> = new Map();

async function fetchWithRetries(apiUrl: string, maxAttempts = 4, baseDelayMs = 500) {
  // If another fetch for the same URL is in progress, reuse it
  if (inFlightRequests.has(apiUrl)) {
    return inFlightRequests.get(apiUrl)!;
  }

  const p = (async () => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) {
          // Rate limit or server errors -> retry
          if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
            const delay = Math.pow(2, attempt - 1) * baseDelayMs;
            console.warn(`[cache] Upbit fetch attempt ${attempt} failed with status ${res.status}, retrying after ${delay}ms`, { apiUrl });
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          const text = await res.text().catch(() => '');
          throw new Error(`Upbit API request failed: ${res.status} for URL: ${apiUrl} ${text ? '- ' + text : ''}`);
        }

        const json = await res.json();
        return json;
      } catch (err) {
        // network or other error
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt - 1) * baseDelayMs;
          console.warn(`[cache] Upbit fetch attempt ${attempt} error, retrying after ${delay}ms`, { apiUrl, err });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  })();

  inFlightRequests.set(apiUrl, p);
  try {
    const result = await p;
    return result;
  } finally {
    inFlightRequests.delete(apiUrl);
  }
}

/**
 * Simple fetch wrapper with AbortController-based timeout.
 */
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
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
  const cacheExpiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);

  // Normalize interval: guard against literal 'undefined' or empty strings coming from query params
  if (!interval || interval === 'undefined' || (typeof interval === 'string' && interval.trim() === '')) {
    console.warn(`[cache]\tgetCandlesWithCache\tmarket:${market}\tcount:${count}\tinterval:invalid->day`);
    interval = 'day';
  }

  // 캐시에서 최근 데이터 확인
  const cached = await queryAll(`
      SELECT * FROM candle_cache
      WHERE market = ? AND interval = ? AND created_at > ?
      ORDER BY candle_date_time_utc DESC
      LIMIT ?
    `, [market, interval, cacheExpiry.toISOString(), count]) as Array<{
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

  let freshData: CandleCacheData[] = [];
  try {
    const json = await fetchWithRetries(apiUrl);
    freshData = json as CandleCacheData[];
  } catch (err) {
    console.error('[cache] Upbit fetch failed after retries:', err);
    // If cached data exists (even stale), return it as fallback
    const fallback = await queryAll(`
        SELECT * FROM candle_cache
        WHERE market = ? AND interval = ?
        ORDER BY candle_date_time_utc DESC
        LIMIT ?
      `, [market, interval, count]) as any[];

    if (fallback && fallback.length > 0) {
      console.warn(`[cache]\tFallbackCandles\tmarket:${market}\tinterval:${interval}\tcached:${fallback.length}`);
      return fallback.map(row => ({
        candle_date_time_utc: row.candle_date_time_utc,
        opening_price: row.opening_price,
        high_price: row.high_price,
        low_price: row.low_price,
        trade_price: row.trade_price,
      })).sort((a, b) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime());
    }

    // No fallback available, rethrow to caller
    throw err;
  }

  // 캐시에 저장
  const statements = freshData.map(candle => ({
    sql: `INSERT OR IGNORE INTO candle_cache (market, interval, candle_date_time_utc, opening_price, high_price, low_price, trade_price) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params: [market, interval, candle.candle_date_time_utc, candle.opening_price, candle.high_price, candle.low_price, candle.trade_price]
  }));
  try {
    await workerTransaction(statements);
  } catch (err) {
    console.warn('[cache] workerTransaction insert failed:', err);
  }

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
  const cacheExpiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);

  // API 키 확인
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  if (!NEWS_API_KEY) {
    console.error("NEWS_API_KEY is not configured in environment variables. News fetching is disabled.");
    // 키가 없으면 캐시된 데이터라도 보여주되, 강제 갱신 시에는 빈 배열을 반환하여 UI에 상태를 반영
    if (forceRefresh) return [];

    const fallbackCached = await queryAll('SELECT * FROM news_cache ORDER BY published_at DESC LIMIT 50') as any[];

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
    const cached = await queryAll('SELECT * FROM news_cache WHERE created_at > ? ORDER BY published_at DESC LIMIT 50', [cacheExpiry.toISOString()]) as any[];

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

  // API에서 데이터 가져오기: 이중 요청 방식 (영어/한국어 분리)
  // 방법: 영어 키워드와 한글 키워드를 분리하여 각각 요청 후 병합
  const rawQuery = (query || '').trim();
  const defaultQuery = 'cryptocurrency bitcoin ethereum 암호화폐 코인';
  const effectiveQuery = rawQuery.length > 0 ? rawQuery : defaultQuery;

  // 영어/한글 키워드 분리
  const allTokens = effectiveQuery.split(/\s+/).filter(Boolean);
  const enTokens = allTokens.filter(t => /^[a-zA-Z0-9\-]+$/.test(t)); // 영어 및 숫자만
  const koTokens = allTokens.filter(t => /[가-힣]/.test(t)); // 한글 포함

  const NEWS_API_KEY_VAL = NEWS_API_KEY;

  // 각 언어별 요청 함수
  async function fetchNewsWithLang(tokens: string[], lang: string): Promise<any[]> {
    if (tokens.length === 0) return [];

    const qParam = tokens.length > 1
      ? tokens.map(t => `"${t}"`).join(' OR ')
      : tokens[0];

    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(qParam)}&language=${lang}&sortBy=publishedAt&apiKey=${NEWS_API_KEY_VAL}`;

    const start = Date.now();
    console.log(`[cache] Fetching news (${lang}): ${tokens.join(', ')}`);

    try {
      const response = await fetchWithTimeout(newsUrl, {}, 7000);
      const duration = Date.now() - start;

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`NewsAPI request failed (${lang}): ${response.status}`, errorBody);
        return [];
      }

      const data = await response.json();
      console.log(`[cache] News fetch completed (${lang}) in ${duration}ms, got ${(data.articles || []).length} articles`);
      return data.articles || [];
    } catch (err) {
      const duration = Date.now() - start;
      console.warn(`[cache] News fetch error (${lang}) after ${duration}ms:`, err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  // 병렬로 영어/한글 뉴스 요청
  const [enNews, koNews] = await Promise.all([
    enTokens.length > 0 ? fetchNewsWithLang(enTokens, 'en') : Promise.resolve([]),
    koTokens.length > 0 ? fetchNewsWithLang(koTokens, 'ko') : Promise.resolve([])
  ]);

  // 결과 병합 및 중복 제거 (URL 기반)
  const mergedArticles = [...enNews, ...koNews];
  const seen = new Set<string>();
  const freshData: NewsCacheData[] = mergedArticles
    .filter(article => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    })
    .slice(0, 50); // 최대 50개

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

  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

  // Notify queue - collect items to notify after the DB transaction
  const notifyQueue: Array<{ url: string; message: string; sentiment: string }> = [];
  const statements: Array<{ sql: string; params?: any[] }> = [];

  // Fetch existing notified status for all fresh URLs
  const urls = freshData.map(a => a.url);
  const existingMap = new Map<string, number>();

  if (urls.length > 0) {
    const placeholders = urls.map(() => '?').join(',');
    const existingRows = await queryAll(`SELECT url, notified FROM news_cache WHERE url IN (${placeholders})`, urls) as any[];
    existingRows.forEach(row => existingMap.set(row.url, row.notified));
  }

  for (const article of freshData) {
    const sentiment = analyzeSentiment(article.title, article.description);
    const existingNotified = existingMap.get(article.url);

    if ((existingNotified === undefined || existingNotified === 0) && (sentiment === 'positive' || sentiment === 'negative')) {
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

      // 일단 DB에 저장하되 notified는 0으로 둠; 전송 성공 시 업데이트
      statements.push({
        sql: `INSERT OR REPLACE INTO news_cache (title, description, url, source_name, published_at, sentiment, notified) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [article.title, article.description, article.url, article.source.name, article.publishedAt, sentiment, 0]
      });

      notifyQueue.push({ url: article.url, message, sentiment });
    } else {
      // 기존 notified 상태를 유지하며 저장
      statements.push({
        sql: `INSERT OR REPLACE INTO news_cache (title, description, url, source_name, published_at, sentiment, notified) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [article.title, article.description, article.url, article.source.name, article.publishedAt, sentiment, existingNotified || 0]
      });
    }
  }

  if (statements.length > 0) {
    await workerTransaction(statements);
  }

  // 트랜잭션 커밋 후 알림을 큐에 등록 (영속 작업 큐)
  (async () => {
    try {
      const q = await import('./notification-queue');
      for (const item of notifyQueue) {
        q.enqueueNotification({
          transactionId: null,
          sourceType: 'news',
          channel: 'telegram',
          payload: item.message,
          meta: { url: item.url, sentiment: item.sentiment }
        });
      }
      if (notifyQueue.length > 0) {
        // consoleLogNotification('NewsEnqueued', { count: notifyQueue.length });
      }
    } catch (err) {
      console.error('Enqueue news notifications failed:', err instanceof Error ? err.message : String(err));
    }
  })();

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
export async function getOrSaveTransactionAnalysis(
  transactionId: string,
  analysis?: string,
  transactionData?: {
    market?: string;
    type?: string;
    price?: number;
    amount?: number;
  }
): Promise<string | null> {
  // 조회
  if (!analysis) {
    try {
      const cached: any = await queryGet('SELECT analysis FROM transaction_analysis_cache WHERE transaction_id = ?', [transactionId]);
      return cached && cached.analysis ? (cached.analysis as string) : null;
    } catch (err) {
      console.warn('[cache] getOrSaveTransactionAnalysis query failed:', err);
      return null;
    }
  }

  // 저장
  try {
    await workerRun(`INSERT OR REPLACE INTO transaction_analysis_cache (transaction_id, analysis, market, transaction_type, price, amount, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [
      transactionId,
      analysis,
      transactionData?.market || null,
      transactionData?.type || null,
      transactionData?.price || null,
      transactionData?.amount || null
    ]);
    return analysis;
  } catch (err) {
    console.warn('[cache] getOrSaveTransactionAnalysis insert failed:', err);
    return analysis; // still return provided analysis
  }
}

/**
 * 모든 거래 분석 결과를 가져옵니다.
 * @returns 거래 ID를 키로 하는 분석 결과 맵
 */
export async function getAllTransactionAnalyses(): Promise<Record<string, string>> {
  try {
    const results: any[] = await queryAll('SELECT transaction_id, analysis FROM transaction_analysis_cache') as any[];
    const analysisMap: Record<string, string> = {};
    results.forEach(row => {
      analysisMap[row.transaction_id] = row.analysis;
    });
    return analysisMap;
  } catch (err) {
    console.warn('[cache] getAllTransactionAnalyses failed:', err);
    return {};
  }
}

/**
 * 거래 분석 캐시를 삭제합니다.
 * @param transactionId - 거래 ID (선택적, 없으면 전체 삭제)
 */
export async function deleteTransactionAnalysis(transactionId?: string): Promise<void> {
  try {
    if (transactionId) {
      await workerRun('DELETE FROM transaction_analysis_cache WHERE transaction_id = ?', [transactionId]);
    } else {
      await workerRun('DELETE FROM transaction_analysis_cache');
    }
  } catch (err) {
    console.warn('[cache] deleteTransactionAnalysis failed:', err);
  }
}

/**
 * 오래된 캐시 데이터 정리
 * @param days - 보관할 일수 (기본값: 7)
 */
export async function cleanOldCache(days: number = 7): Promise<void> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    await workerRun('DELETE FROM candle_cache WHERE created_at < ?', [cutoff.toISOString()]);
    await workerRun('DELETE FROM news_cache WHERE created_at < ?', [cutoff.toISOString()]);
  } catch (err) {
    console.warn('[cache] cleanOldCache failed:', err);
  }
}

/**
 * 거래 내역을 가져옵니다.
 * @returns 거래 내역 배열 (최신순)
 */
export async function getTransactions(): Promise<Array<{
  id: string;
  type: 'buy' | 'sell';
  market: string;
  price: number;
  amount: number;
  timestamp: string;
  source?: string;
  isAuto: boolean;
  strategyType?: string;
  notificationSent?: boolean;
}>> {
  try {
    const results = await queryAll('SELECT * FROM transactions ORDER BY timestamp DESC');

    return (results as Array<any>).map(row => ({
      id: row.id,
      type: row.type as 'buy' | 'sell',
      market: row.market,
      price: row.price,
      amount: row.amount,
      timestamp: row.timestamp,
      source: row.source || undefined,
      isAuto: row.is_auto === 1,
      notificationSent: row.notification_sent === 1,
      strategyType: row.strategy_type || undefined,
    }));
  } catch (err) {
    console.error('[cache] getTransactions failed:', err);
    return [];
  }
}

/**
 * 알림(푸시) 시도 정보를 DB에 기록합니다.
 * @param args - 로그 정보
 */
export async function logNotificationAttempt(args: {
  transactionId?: string | null;
  sourceType: string; // e.g., 'transaction', 'news'
  channel: string; // e.g., 'telegram'
  payload: string; // message body (truncated if needed)
  success: boolean;
  attemptNumber?: number;
  responseCode?: number | null;
  responseBody?: string | null;
  nextRetryAt?: string | null;
}) {
  const stmtSql = `
    INSERT INTO notification_log
    (transaction_id, source_type, channel, payload, message_hash, attempt_number, success, response_code, response_body, next_retry_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Truncate payload/responseBody to reasonable size to avoid DB bloat
  const maxLen = 2000;
  const payloadStr = args.payload ? String(args.payload).slice(0, maxLen) : null;
  const responseBodyStr = args.responseBody ? String(args.responseBody).slice(0, maxLen) : null;
  const msgHash = payloadStr ? crypto.createHash('sha256').update(payloadStr).digest('hex') : null;
  const attemptNumber = args.attemptNumber && args.attemptNumber > 0 ? args.attemptNumber : 1;

  const nextRetryAt = (args as any).nextRetryAt || null;
  try {
    await workerRun(stmtSql, [
      args.transactionId || null,
      args.sourceType,
      args.channel,
      payloadStr,
      msgHash,
      attemptNumber,
      args.success ? 1 : 0,
      args.responseCode || null,
      responseBodyStr || null,
      nextRetryAt
    ]);
  } catch (err) {
    console.error('[cache] logNotificationAttempt failed:', err);
  }
}

export async function getNotificationLogs(limit: number = 100) {
  // SIMULATE TIMEOUT FOR TESTING
  // await new Promise(resolve => setTimeout(resolve, 2500));

  try {
    const rows = await queryAll('SELECT * FROM notification_log ORDER BY created_at DESC LIMIT ?', [limit]);
    return (rows as Array<any>).map(r => ({
      id: r.id,
      transactionId: r.transaction_id,
      sourceType: r.source_type,
      channel: r.channel,
      payload: r.payload,
      success: r.success === 1,
      attemptNumber: r.attempt_number,
      messageHash: r.message_hash,
      responseCode: r.response_code,
      responseBody: r.response_body,
      createdAt: r.created_at,
      nextRetryAt: r.next_retry_at,
      // createdAt in KST for convenience
      createdAtKst: new Date(r.created_at + 'Z').toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    }));
  } catch (err) {
    console.warn('[cache] getNotificationLogs DB query failed:', err);
    return [];
  }
}

/**
 * 거래의 notification_sent 플래그를 설정합니다.
 * @param transactionId
 */
export async function markTransactionNotified(transactionId: string) {
  try {
    await workerRun('UPDATE transactions SET notification_sent = 1 WHERE id = ?', [transactionId]);
  } catch (err) {
    console.error('[cache] markTransactionNotified failed:', err);
  }
}

/**
 * 콘솔 로그 출력 포맷 헬퍼
 */
export function consoleLogNotification(label: string, details: Record<string, any>) {
  // 깔끔한 탭 정렬 출력
  const kst = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const base = `[notification]\t${label}\t${kst}`;
  const detailStr = Object.entries(details)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\t');
  console.log(`${base}\t${detailStr}`);
}

/**
 * 재시도: 실패한 알림들을 주기적으로 확인하고 재전송합니다.
 */
export async function resendFailedNotifications(limit = 20) {
  const rows = await queryAll("SELECT * FROM notification_log WHERE success = 0 AND (next_retry_at IS NULL OR next_retry_at <= datetime('now')) ORDER BY created_at ASC LIMIT ?", [limit]) as Array<any>;

  if (!rows || rows.length === 0) return 0;

  const telegram = await import('./telegram');
  let successCount = 0;

  for (const r of rows) {
    try {
      // If this notification is tied to a transaction that is already marked notified, skip
      if (r.transaction_id) {
        const tx = await queryGet('SELECT notification_sent FROM transactions WHERE id = ?', [r.transaction_id]) as { notification_sent?: number } | undefined;
        if (tx && tx.notification_sent === 1) {
          // Insert a success log to record that we skipped because transaction already notified
          await logNotificationAttempt({
            transactionId: r.transaction_id,
            sourceType: r.source_type,
            channel: r.channel,
            payload: r.payload,
            attemptNumber: 1,
            success: true,
            responseCode: 200,
            responseBody: 'skipped_already_notified',
          });
          continue;
        }
      }
      // compute message hash for this payload
      const payloadStr = r.payload ? String(r.payload).slice(0, 2000) : null;
      const msgHash = payloadStr ? crypto.createHash('sha256').update(payloadStr).digest('hex') : null;

      // determine previous attempts for this message_hash
      let prevAttempt = 0;
      if (msgHash) {
        const row = await queryGet('SELECT MAX(attempt_number) as maxAttempt FROM notification_log WHERE message_hash = ?', [msgHash]) as { maxAttempt?: number } | undefined;
        prevAttempt = row && row.maxAttempt ? Number(row.maxAttempt) : 0;
      }

      const nextAttempt = prevAttempt + 1;
      const MAX_RETRIES = 5;
      if (nextAttempt > MAX_RETRIES) {
        // give up and write a final failed log
        await logNotificationAttempt({
          transactionId: r.transaction_id,
          sourceType: r.source_type,
          channel: r.channel,
          payload: r.payload,
          attemptNumber: nextAttempt,
          success: false,
          responseCode: 429,
          responseBody: 'max_retries_exceeded',
        });
        continue;
      }

      const sent = await telegram.sendMessage(r.payload, 'HTML');

      if (sent && r.transaction_id) {
        await workerRun('UPDATE transactions SET notification_sent = 1 WHERE id = ?', [r.transaction_id]);
      }

      // compute backoff: base 30s * 2^(attempt-1)
      const baseDelaySec = 30;
      const backoffSeconds = baseDelaySec * Math.pow(2, nextAttempt - 1);
      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      await logNotificationAttempt({
        transactionId: r.transaction_id,
        sourceType: r.source_type,
        channel: r.channel,
        payload: r.payload,
        attemptNumber: nextAttempt,
        success: !!sent,
        responseCode: sent ? 200 : 0,
        responseBody: sent ? 'ok' : 'failed',
        nextRetryAt: sent ? null : nextRetryAt,
      });

      successCount += sent ? 1 : 0;
    } catch (err) {
      console.error('Resend notification error for id', r.id, err);
    }
  }

  return successCount;
}

// 시작: 개발 환경에서 자동으로 주기적 재시도 작업 등록
if (process.env.NODE_ENV !== 'test') {
  let isResending = false;
  // 30초마다 실패 알림 재시도
  setInterval(async () => {
    if (isResending) return;
    isResending = true;
    try {
      const cnt = await resendFailedNotifications(50);
      if (cnt > 0) consoleLogNotification('ResendSummary', { resent: cnt });
    } catch (err) {
      console.error('Resend worker error:', err);
    } finally {
      isResending = false;
    }
  }, 30 * 1000);
}

/**
 * 거래 내역을 저장합니다.
 * @param transaction - 거래 내역 객체
 */
export async function saveTransaction(transaction: {
  id: string;
  type: 'buy' | 'sell';
  market: string;
  price: number;
  amount: number;
  timestamp: string;
  source?: string;
  isAuto?: boolean;
  strategyType?: string;
  notificationSent?: boolean;
}): Promise<void> {
  const stmtSql = `
    INSERT OR REPLACE INTO transactions 
    (id, type, market, price, amount, timestamp, source, is_auto, strategy_type, notification_sent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // source가 'manual'이면 isAuto = 0, 그 외는 1
  const isAuto = transaction.isAuto !== undefined
    ? transaction.isAuto
    : (transaction.source !== 'manual' && transaction.source !== undefined);

  const strategyType = transaction.strategyType;

  try {
    await workerRun(stmtSql, [
      transaction.id,
      transaction.type,
      transaction.market,
      transaction.price,
      transaction.amount,
      transaction.timestamp,
      transaction.source || null,
      isAuto ? 1 : 0,
      strategyType || null,
      transaction.notificationSent ? 1 : 0
    ]);
  } catch (err) {
    console.error('[cache] saveTransaction failed:', err);
  }
}

/**
 * 모든 거래 내역을 삭제합니다.
 */
export async function clearAllTransactions(): Promise<void> {
  try {
    await workerRun('DELETE FROM transactions');
    console.log('[cache] All transactions cleared.');
  } catch (err) {
    console.error('[cache] clearAllTransactions failed:', err);
    throw err;
  }
}

// --- Background job helpers ---
export interface JobRecord {
  id: number;
  type: string;
  payload: string;
  status: string;
  result?: string | null;
  attempt_count?: number;
  last_error?: string | null;
  next_run_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function createJob(type: string, payload: any, nextRunAt: string | null = null): Promise<number | null> {
  try {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const res: any = await workerRun('INSERT INTO jobs (type, payload, next_run_at) VALUES (?, ?, ?)', [type, payloadStr, nextRunAt]);
    // Try to read last insert id from run result; if not present, query it
    const newId = res && (res.lastInsertRowid || res.lastInsertROWID || res.lastInsertId || (res?.lastID || null));
    if (newId) return Number(newId);
    // Fallback to SELECT last_insert_rowid()
    const row = await queryGet('SELECT last_insert_rowid() as id') as any;
    return row && row.id ? Number(row.id) : null;
  } catch (err) {
    console.error('[cache] createJob failed:', err);
    return null;
  }
}

export async function getPendingJobs(type: string, limit: number = 5): Promise<JobRecord[]> {
  try {
    const rows = await queryAll("SELECT * FROM jobs WHERE type = ? AND (status = 'pending' OR (status='failed' AND next_run_at <= datetime('now'))) ORDER BY next_run_at ASC, created_at ASC LIMIT ?", [type, limit]);
    return (rows as any[]).map(r => ({
      id: r.id,
      type: r.type,
      payload: r.payload,
      status: r.status,
      result: r.result || null,
      attempt_count: r.attempt_count || 0,
      last_error: r.last_error || null,
      next_run_at: r.next_run_at || null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (err) {
    console.error('[cache] getPendingJobs failed:', err);
    return [];
  }
}

export async function startJob(jobId: number): Promise<void> {
  try {
    await workerRun("UPDATE jobs SET status = 'processing', attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [jobId]);
  } catch (err) {
    console.error('[cache] startJob failed:', err);
  }
}

export async function updateJobStatus(jobId: number, status: string, meta: any = null): Promise<void> {
  try {
    if (status === 'completed') {
      const resultStr = meta ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : null;
      await workerRun('UPDATE jobs SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, resultStr, jobId]);
    } else if (status === 'failed') {
      const lastError = meta && meta.error ? String(meta.error) : (meta ? String(meta) : null);
      await workerRun('UPDATE jobs SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, lastError, jobId]);
    } else {
      await workerRun('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, jobId]);
    }
  } catch (err) {
    console.error('[cache] updateJobStatus failed:', err);
  }
}

/**
 * 거래 내역을 삭제합니다.
 * @param transactionId - 거래 ID (선택적, 없으면 전체 삭제)
 */
export async function deleteTransaction(transactionId?: string): Promise<void> {
  try {
    if (transactionId) {
      await workerRun('DELETE FROM transactions WHERE id = ?', [transactionId]);
    } else {
      await workerRun('DELETE FROM transactions');
    }
  } catch (err) {
    console.error('[cache] deleteTransaction failed:', err);
  }
}

/**
 * 데이터베이스 초기화 (모든 테이블 삭제 후 재생성)
 */
export async function resetDatabase(): Promise<void> {
  // 모든 테이블 삭제
  await workerRun('DROP TABLE IF EXISTS candle_cache');
  await workerRun('DROP TABLE IF EXISTS news_cache');
  await workerRun('DROP TABLE IF EXISTS transaction_analysis_cache');
  await workerRun('DROP TABLE IF EXISTS transactions');
  await workerRun('DROP TABLE IF EXISTS notification_log');
  await workerRun('DROP TABLE IF EXISTS jobs');

  // Worker를 닫으면 다음 요청 시 재시작하며 initDatabase가 실행됨
  const { closeWorker } = await import('@/lib/db-client');
  await closeWorker();
}

/**
 * 모든 설정 가져오기 (Issue #2: 서버-클라이언트 설정 동기화)
 */
export function getAllSettings(): Record<string, any> {

  try {
    // 현재는 환경 변수 및 localStorage 기반이므로
    // 향후 DB 테이블을 추가할 때를 대비해 구조만 반환
    const newsRefreshInterval = Number(process.env.NEWS_REFRESH_INTERVAL_MIN) || 15;
    const initialCash = Number(process.env.NEXT_PUBLIC_DEFAULT_INITIAL_CASH) || 1000000;

    return {
      newsRefreshInterval,
      initialCash,
      notificationEnabled: true,
      telegramNotifications: !!process.env.TELEGRAM_BOT_TOKEN,
    };
  } catch (err) {
    console.error('[cache] Error fetching settings:', err);
    return {
      newsRefreshInterval: 15,
      initialCash: 1000000,
    };
  }
}

/**
 * 개별 설정 업데이트 (Issue #2: 서버-클라이언트 설정 동기화)
 * 향후 DB 저장 또는 .env 파일 수정으로 확장 가능
 */
const dynamicSettings: Map<string, any> = new Map();

export function updateSetting(key: string, value: any): void {
  try {
    // 현재는 메모리 기반, 향후 DB 또는 .env 파일로 확장
    dynamicSettings.set(key, value);
    console.log(`[settings] Updated ${key} = ${value}`);
  } catch (err) {
    console.error('[cache] Error updating setting:', err);
  }
}

/**
 * 특정 설정값 조회 (메모리 또는 .env에서)
 */
export function getSetting(key: string, defaultValue?: any): any {
  // 우선 동적 설정에서 조회
  if (dynamicSettings.has(key)) {
    return dynamicSettings.get(key);
  }

  // 환경 변수에서 조회
  const envKey = `NEWS_${key.toUpperCase()}` || `${key.toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    return envValue;
  }

  return defaultValue;
}

/**
 * Issue #3: 알림 API 타임아웃 모니터링 메트릭
 * 응답 시간 및 타임아웃 빈도 추적
 */
interface ApiResponseMetric {
  endpoint: string;
  responseTimeMs: number;
  timestamp: number;
  timedOut: boolean;
  error?: string;
}

const apiMetrics: ApiResponseMetric[] = [];

export function recordApiMetric(
  endpoint: string,
  responseTimeMs: number,
  timedOut: boolean = false,
  error?: string
) {
  const metric: ApiResponseMetric = {
    endpoint,
    responseTimeMs,
    timestamp: Date.now(),
    timedOut,
    error,
  };

  apiMetrics.push(metric);

  // 최근 1000개만 유지
  if (apiMetrics.length > 1000) {
    apiMetrics.shift();
  }

  // 타임아웃 또는 응답 시간 1500ms 초과 시 경고 로그
  const RESPONSE_TIME_THRESHOLD = 1500;
  if (timedOut) {
    console.warn(`[API Timeout] ${endpoint}: ${responseTimeMs}ms (TIMEOUT)`, {
      endpoint,
      responseTimeMs,
      timestamp: new Date(metric.timestamp).toISOString(),
      error: error || 'Request timed out'
    });
  } else if (responseTimeMs > RESPONSE_TIME_THRESHOLD) {
    console.warn(`[API Slow Response] ${endpoint}: ${responseTimeMs}ms (threshold: ${RESPONSE_TIME_THRESHOLD}ms)`, {
      endpoint,
      responseTimeMs,
      timestamp: new Date(metric.timestamp).toISOString(),
    });
  }
}

export function getApiMetrics(endpoint?: string, lastNSeconds: number = 300): {
  metrics: ApiResponseMetric[];
  stats: {
    totalRequests: number;
    timeoutCount: number;
    slowResponseCount: number;
    avgResponseTimeMs: number;
    maxResponseTimeMs: number;
  };
} {
  const cutoffTime = Date.now() - (lastNSeconds * 1000);

  // 필터링
  let filtered = apiMetrics.filter(m => m.timestamp > cutoffTime);
  if (endpoint) {
    filtered = filtered.filter(m => m.endpoint === endpoint);
  }

  // 통계 계산
  const RESPONSE_TIME_THRESHOLD = 1500;
  const stats = {
    totalRequests: filtered.length,
    timeoutCount: filtered.filter(m => m.timedOut).length,
    slowResponseCount: filtered.filter(m => m.responseTimeMs > RESPONSE_TIME_THRESHOLD).length,
    avgResponseTimeMs: filtered.length > 0
      ? Math.round(filtered.reduce((sum, m) => sum + m.responseTimeMs, 0) / filtered.length)
      : 0,
    maxResponseTimeMs: filtered.length > 0
      ? Math.max(...filtered.map(m => m.responseTimeMs))
      : 0,
  };

  return {
    metrics: filtered,
    stats,
  };
}

