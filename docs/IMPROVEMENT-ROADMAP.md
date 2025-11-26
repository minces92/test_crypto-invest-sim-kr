# Crypto Invest Sim KR - 개선 로드맵 (Improvement Roadmap)

**수정 및 개선 우선순위 분석 (Priority: 높음→중간→낮음)**

---

## 🔴 **즉시 수정 필요 (Critical - Sprint 0)**

### #1. 뉴스 API 다중 키워드 검색 결과 개선
**심각도:** 🔴 높음  
**영향:** 사용자가 관심 뉴스를 받지 못할 가능성 높음  
**예상 소요 시간:** 2-3시간

**현재 상태:**
```javascript
// src/lib/cache.ts - getNewsWithCache()
const query = keywords.join(' ');  // "cryptocurrency bitcoin ethereum 암호화폐 코인"
// NewsAPI 요청: q=cryptocurrency+bitcoin+ethereum+암호화폐+코인&language=ko
// 결과: 0개 (모든 키워드를 AND로 처리)
```

**개선안 (권장):**
```javascript
// 방법 1: OR 연산자 활용 (간단, 현재 적용)
const query = keywords.map(k => `"${k}"`).join(' OR ');
// "cryptocurrency" OR "bitcoin" OR "ethereum" OR "암호화폐" OR "코인"

// 방법 2: 이중 요청 (더 나음, 권장)
async function getNewsWithCache(keywords) {
  // 1. 영어 키워드로 영문 뉴스 검색
  const enNews = await NewsAPI({
    q: enKeywords.join(' OR '),
    language: 'en',
    sortBy: 'publishedAt'
  });
  
  // 2. 한글 키워드로 한국어 뉴스 검색
  const koNews = await NewsAPI({
    q: koKeywords.join(' OR '),
    language: 'ko',
    sortBy: 'publishedAt'
  });
  
  // 3. 병합 및 중복 제거
  const merged = [...enNews, ...koNews]
    .filter((item, idx, arr) => 
      arr.findIndex(a => a.url === item.url) === idx
    )
    .slice(0, 50);
  
  return merged;
}
```

**구현 단계:**
1. `src/lib/cache.ts` 수정: `getNewsWithCache()` 이중 요청 방식 구현
2. 테스트: 영어 뉴스 + 한국어 뉴스 모두 반환 확인
3. 커밋: `fix: Improve multi-language news search with dual requests`

**테스트 명령:**
```bash
npm run dev
# 뉴스 피드에서 영문 뉴스(e.g., CoinDesk) + 한국 뉴스(e.g., 블록미디어) 모두 표시 확인
```

---

### #2. 서버-클라이언트 설정 동기화 실패
**심각도:** 🔴 높음  
**영향:** 사용자 설정이 부분적으로만 적용됨  
**예상 소요 시간:** 3-4시간

**현재 상태:**
```javascript
// NotificationLogs.tsx - 사용자가 갱신 주기를 30분으로 설정
localStorage.setItem('newsRefreshInterval', '30');
window.dispatchEvent(new CustomEvent('newsRefreshIntervalChanged', { detail: 30 }));

// 하지만 server-init.ts의 백그라운드 워커는 여전히 기본값(15분)으로 갱신
setInterval(() => processNotifications(), 15 * 60 * 1000);  // 하드코딩
```

**개선안:**
```typescript
// 1. 새 API 엔드포인트: PATCH /api/settings
// src/app/api/settings/route.ts
export async function PATCH(req: Request) {
  const { newsRefreshInterval } = await req.json();
  
  // DB 저장 (또는 .env.local 파일 수정)
  updateSetting('newsRefreshInterval', newsRefreshInterval);
  
  return json({ success: true, interval: newsRefreshInterval });
}

// 2. 클라이언트: 설정 변경 시 서버 호출
// NotificationLogs.tsx - handleSaveSettings()
const response = await fetch('/api/settings', {
  method: 'PATCH',
  body: JSON.stringify({ newsRefreshInterval: value })
});

// 3. 서버: 런타임 동적 갱신 (Advanced)
// src/lib/server-init.ts
let newsRefreshInterval = loadSetting('newsRefreshInterval') || 15 * 60 * 1000;

async function reloadSettings() {
  const newInterval = loadSetting('newsRefreshInterval') || 15 * 60 * 1000;
  if (newInterval !== newsRefreshInterval) {
    newsRefreshInterval = newInterval;
    console.log(`뉴스 갱신 주기 변경: ${newInterval / 60000}분`);
  }
}

// 주기적으로 설정 다시 로드
setInterval(reloadSettings, 60 * 1000);  // 1분마다
```

**구현 단계:**
1. `src/app/api/settings/route.ts` 생성 (PATCH 엔드포인트)
2. `src/lib/settings.ts` 생성 (설정 저장/로드 유틸)
3. `src/components/NotificationLogs.tsx` 수정: API 호출 추가
4. `src/lib/server-init.ts` 수정: 동적 갱신 적용
5. 커밋: `fix: Add server-client settings synchronization`

---

### #3. 알림 API 타임아웃 모니터링 부재
**심각도:** 🟠 중간-높음  
**영향:** 느린 응답으로 인한 로그 손실 가능성  
**예상 소요 시간:** 1-2시간

**현재 상태:**
```typescript
// src/app/api/notification-logs/route.ts
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), 2000)
);

try {
  const result = await Promise.race([getNotificationLogs(), timeout]);
  return json(result);
} catch (e) {
  if (e.message === 'Timeout') {
    return json({ logs: [], warning: '로드 시간 초과' }, { status: 408 });
  }
}
```

**개선안:**
```typescript
// 1. 모니터링 및 로깅
const startTime = Date.now();
try {
  const result = await Promise.race([getNotificationLogs(), timeout]);
  const duration = Date.now() - startTime;
  console.log(`[API] /notification-logs: ${duration}ms`);
  
  if (duration > 1500) {
    console.warn(`⚠️ 알림 로그 조회 느림: ${duration}ms (2초 타임아웃 임박)`);
  }
  
  return json(result);
} catch (e) {
  const duration = Date.now() - startTime;
  console.error(`❌ /notification-logs 실패: ${duration}ms, 사유: ${e.message}`);
  
  // 메트릭 수집 (선택사항)
  recordMetric('api_notification_logs_timeout', 1);
}

// 2. 클라이언트 경고
if (response.status === 408) {
  toast.warning('알림 로그 로드 중 시간 초과. 나중에 다시 시도해주세요.');
}
```

---

## 🟠 **중간 우선순위 개선 (High Priority - Sprint 1-2)**

### #4. 데이터베이스 성능 최적화
**심각도:** 🟠 중간  
**영향:** 대량 거래/뉴스 시 쿼리 느림  
**예상 소요 시간:** 3-4시간

**조치 사항:**
```sql
-- 1. 인덱스 추가
CREATE INDEX idx_news_cache_query_lang 
  ON news_cache(query, language, timestamp DESC);

CREATE INDEX idx_notification_log_message_hash 
  ON notification_log(message_hash);

CREATE INDEX idx_notification_log_retry 
  ON notification_log(next_retry_at, success);

CREATE INDEX idx_transactions_market_timestamp 
  ON transactions(market, timestamp DESC);

-- 2. 쿼리 최적화
-- 기존:
SELECT * FROM notification_log 
  ORDER BY created_at DESC LIMIT 50;
-- 개선: created_at DESC 인덱스 필요

-- 3. 통계 수집
PRAGMA optimize;
ANALYZE;
```

**구현:**
1. `scripts/optimize-db.js` 생성
2. `npm run optimize:db` 커맨드 추가 (package.json)
3. 프로덕션 배포 전 실행

---

### #5. 에러 처리 개선 및 복원력 강화
**심각도:** 🟠 중간  
**영향:** 유효성 검사 부족으로 인한 예상치 못한 오류  
**예상 소요 시간:** 4-5시간

**추가해야 할 검증:**
```typescript
// 1. TradeModal 검증 강화
function validateTrade(trade: Trade): ValidationResult {
  if (trade.quantity <= 0) {
    return { valid: false, error: '수량은 0보다 커야 합니다' };
  }
  
  if (trade.price <= 0) {
    return { valid: false, error: '가격은 0보다 커야 합니다' };
  }
  
  if (trade.type === 'sell' && !hasEnoughBalance(trade)) {
    return { valid: false, error: '보유하지 않은 코인은 매도 불가' };
  }
  
  const requiredFunds = trade.quantity * trade.price;
  if (trade.type === 'buy' && !hasEnoughCash(requiredFunds)) {
    return { valid: false, error: '자금 부족' };
  }
  
  return { valid: true };
}

// 2. API 응답 타입 검증
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Zod 스키마 검증
    const schema = z.object({
      market: z.string().regex(/^KRW-[A-Z]+$/),
      quantity: z.number().positive(),
      price: z.number().positive(),
      type: z.enum(['buy', 'sell'])
    });
    
    const validated = schema.parse(body);
    // 실행...
    
  } catch (e) {
    if (e instanceof z.ZodError) {
      return json({ error: e.errors[0].message }, { status: 400 });
    }
    throw e;
  }
}

// 3. 상세한 에러 로깅
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    console.error(`[${error.code}] ${error.message}`, error.context);
    return json(
      { code: error.code, message: error.message },
      { status: error.statusCode }
    );
  }
  
  // 예상치 못한 오류
  console.error('❌ Unexpected error:', error);
  return json(
    { code: 'INTERNAL_ERROR', message: '서버 오류 발생' },
    { status: 500 }
  );
}
```

---

### #6. 거래 진행 상태 UI 개선
**심각도:** 🟠 중간  
**영향:** 사용자 경험(UX) 저하  
**예상 소요 시간:** 2-3시간

**TradeModal.tsx 개선:**
```typescript
interface TradeState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  message?: string;
  progress?: number;
}

export function TradeModal({ isOpen, onClose }: Props) {
  const [state, setState] = useState<TradeState>({ status: 'idle' });
  
  const handleSubmit = async (formData: TradeForm) => {
    setState({ status: 'submitting', progress: 0 });
    
    try {
      // 진행률 시뮬레이션
      setState(s => ({ ...s, progress: 30 }));
      
      const response = await fetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      setState(s => ({ ...s, progress: 70 }));
      
      if (!response.ok) throw new Error(await response.text());
      
      setState(s => ({ ...s, progress: 100 }));
      setState({ status: 'success', message: '거래가 완료되었습니다!' });
      
      setTimeout(() => onClose(), 1500);
      
    } catch (error) {
      setState({
        status: 'error',
        message: error.message || '거래 실패'
      });
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {state.status === 'submitting' && (
        <div className="progress-container">
          <Spinner size="lg" />
          <div className="progress-text">주문 처리 중... {state.progress}%</div>
          <div className="progress-bar" style={{ width: `${state.progress}%` }} />
        </div>
      )}
      
      {state.status === 'success' && (
        <Alert type="success">
          ✓ {state.message}
        </Alert>
      )}
      
      {state.status === 'error' && (
        <Alert type="error">
          ✗ {state.message}
        </Alert>
      )}
      
      {state.status === 'idle' && (
        // 기존 폼...
      )}
    </Modal>
  );
}
```

---

## 🟡 **낮은 우선순위 개선 (Nice-to-have - Sprint 3+)**

### #7. 거래 내역 필터링 및 검색
**심각도:** 🟡 낮음  
**영향:** 대량 거래 시 찾기 어려움  
**예상 소요 시간:** 4-5시간

**구현 개요:**
```typescript
// TransactionHistory.tsx에 필터 바 추가
interface TransactionFilters {
  type?: 'buy' | 'sell';
  market?: string;
  source?: 'manual' | 'auto';
  dateRange?: [Date, Date];
  searchText?: string;
}

function applyFilters(transactions: Transaction[], filters: TransactionFilters) {
  return transactions.filter(tx => {
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.market && tx.market !== filters.market) return false;
    if (filters.source && tx.source !== filters.source) return false;
    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      if (tx.timestamp < start || tx.timestamp > end) return false;
    }
    if (filters.searchText) {
      const text = filters.searchText.toLowerCase();
      if (!tx.market.toLowerCase().includes(text)) return false;
    }
    return true;
  });
}
```

---

### #8. 포트폴리오 스냅샷 기능
**심각도:** 🟡 낮음  
**영향:** 장기 성과 추적 불가  
**예상 소요 시간:** 5-6시간

**구현 개요:**
```typescript
// 1. 테이블 추가
CREATE TABLE portfolio_snapshots (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  snapshot_date DATE,
  total_value REAL,
  cash_balance REAL,
  holdings JSON,
  daily_return_pct REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// 2. 일일 스냅샷 작업 (Cron)
async function createDailySnapshot() {
  const portfolio = calculatePortfolio();
  await db.insert('portfolio_snapshots', {
    snapshot_date: new Date().toISOString().split('T')[0],
    total_value: portfolio.totalValue,
    holdings: JSON.stringify(portfolio.holdings),
    daily_return_pct: portfolio.dailyReturn
  });
}

// Cron 설정: 매일 자정 실행
schedule.scheduleJob('0 0 * * *', createDailySnapshot);

// 3. API 제공
GET /api/portfolio/snapshots?days=30
// 응답: [{ date: '2025-01-01', value: 1000000, return: 5.2 }, ...]
```

---

### #9. 커스텀 거래 전략 생성기
**심각도:** 🟡 낮음  
**영향:** 사용자 맞춤 거래 로직 부재  
**예상 소요 시간:** 8-10시간

**구현 개요:**
```typescript
// 1. 전략 스키마
interface CustomStrategy {
  id: string;
  name: string;
  buyCondition: string;   // e.g. "RSI < 30 AND EMA12 > EMA26"
  sellCondition: string;  // e.g. "RSI > 70"
  positionSize: number;   // 거래량 %
  stopLoss?: number;      // 손절가 %
  takeProfit?: number;    // 익절가 %
}

// 2. 조건 파서 및 실행자
function parseCondition(condition: string, indicators: Indicators) {
  const expr = condition
    .replace(/RSI/g, `${indicators.rsi}`)
    .replace(/EMA12/g, `${indicators.ema12}`)
    .replace(/EMA26/g, `${indicators.ema26}`)
    .replace(/MACD/g, `${indicators.macd}`);
  
  return eval(expr);  // ⚠️ 보안 주의: Sandbox 필요
}

// 3. 컴포넌트
<StrategyBuilder
  onSave={(strategy) => saveCustomStrategy(strategy)}
  onBacktest={(strategy) => runBacktest(strategy)}
/>
```

---

### #10. 포트폴리오 공유 링크
**심각도:** 🟡 낮음  
**영향:** 사용자 간 협력/벤치마킹 불가  
**예상 소요 시간:** 6-8시간

**구현 개요:**
```typescript
// 1. 공유 토큰 생성
async function createShareLink(userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.insert('portfolio_shares', {
    user_id: userId,
    token,
    expiry: Date.now() + 30 * 24 * 60 * 60 * 1000  // 30일
  });
  return `/portfolio/share/${token}`;
}

// 2. 공개 포트폴리오 뷰
GET /api/portfolio/share/:token
// 응답: { holdings, performance, trades: [] }

// 3. 공개 컴포넌트
<PublicPortfolioView token={token} />
```

---

## 📊 우선순위 매트릭스

| 우선순위 | 기능 | 복잡도 | 영향도 | 소요시간 | 담당자 |
|---------|------|--------|--------|---------|--------|
| 🔴 Critical | 다중 키워드 뉴스 | 중간 | 높음 | 2-3h | - |
| 🔴 Critical | 설정 동기화 | 높음 | 높음 | 3-4h | - |
| 🔴 Critical | 타임아웃 모니터링 | 낮음 | 중간 | 1-2h | - |
| 🟠 High | DB 최적화 | 중간 | 중간 | 3-4h | - |
| 🟠 High | 에러 처리 | 높음 | 중간 | 4-5h | - |
| 🟠 High | 거래 UI 개선 | 중간 | 중간 | 2-3h | - |
| 🟡 Low | 거래 필터링 | 중간 | 낮음 | 4-5h | - |
| 🟡 Low | 포트폴리오 스냅샷 | 높음 | 낮음 | 5-6h | - |
| 🟡 Low | 커스텀 전략 | 높음 | 낮음 | 8-10h | - |
| 🟡 Low | 포트폴리오 공유 | 높음 | 낮음 | 6-8h | - |

---

## 🛠 단계별 구현 일정 (Suggested Timeline)

### **Sprint 0 (2-3일)** - 임계적 버그 수정
- ✅ 다중 키워드 뉴스 검색 개선
- ✅ 서버-클라이언트 설정 동기화
- ✅ 타임아웃 모니터링 추가

### **Sprint 1 (5-7일)** - 핵심 기능 완성
- ✅ DB 성능 최적화
- ✅ 에러 처리 강화
- ✅ 거래 UI 개선

### **Sprint 2 (7-10일)** - 사용자 경험 향상
- ✅ 거래 내역 필터링
- ✅ 포트폴리오 분석 시작

### **Sprint 3+ (진행 중)** - 고급 기능
- ✅ 커스텀 전략
- ✅ 포트폴리오 공유
- ✅ 멀티 포트폴리오

---

## ✅ 체크리스트: 각 개선사항 검증 방법

### 다중 키워드 뉴스 검색
- [ ] npm run dev 후 뉴스 피드 확인
- [ ] 영어 뉴스(CoinDesk, Cointelegraph) 표시
- [ ] 한국어 뉴스(블록미디어, 뉴스페퍼) 표시
- [ ] 20개 이상의 뉴스 표시 (0개 아님)

### 설정 동기화
- [ ] 햄버거 메뉴에서 갱신 주기 변경
- [ ] 페이지 새로고침 후 설정 유지
- [ ] 뉴스 갱신 주기 실제 변경 확인 (로그)

### DB 최적화
- [ ] `npm run optimize:db` 실행
- [ ] 쿼리 성능 50% 이상 개선 확인
- [ ] EXPLAIN QUERY PLAN 분석

---

