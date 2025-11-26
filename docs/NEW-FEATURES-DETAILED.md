# Crypto Invest Sim KR - 신규 기능 제안서 (New Features Proposal)

**향후 개발할 신규 기능들에 대한 상세 설계 및 구현 가이드**

---

## 🎯 Feature Proposal #1: 포트폴리오 성과 분석 대시보드

### 개요
사용자의 투자 성과를 시각적으로 분석하는 대시보드. 일일 포트폴리오 스냅샷을 기반으로 성과 지표를 제공합니다.

### 핵심 메트릭
| 지표 | 설명 | 계산식 |
|-----|------|--------|
| **Total Return** | 누적 수익률 | (현재가 - 초기자본) / 초기자본 × 100% |
| **Daily Return** | 일일 수익률 | (금일 포트폴리오 - 전일) / 전일 × 100% |
| **Sharpe Ratio** | 위험조정 수익 | (평균수익 - 무위험율) / 표준편차 |
| **Max Drawdown** | 최대 낙폭 | (최고점 - 최저점) / 최고점 × 100% |
| **Win Rate** | 수익 거래 비율 | 수익 거래수 / 전체 거래수 × 100% |

### 데이터 모델

#### portfolio_snapshots 테이블
```sql
CREATE TABLE portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- 자산 구성
  total_value REAL NOT NULL,      -- 총 자산가
  cash_balance REAL NOT NULL,      -- 현금 잔액
  holdings JSON NOT NULL,          -- {"BTC": 0.5, "ETH": 10, ...}
  holdings_value REAL NOT NULL,    -- 보유 자산 가치
  
  -- 수익/손실
  total_gain REAL NOT NULL,        -- 총 수익금
  total_return_pct REAL NOT NULL,  -- 누적 수익률 (%)
  daily_return_pct REAL NOT NULL,  -- 일일 수익률 (%)
  
  -- 위험 지표
  volatility REAL,                 -- 변동성
  sharpe_ratio REAL,               -- 샤프 지수
  max_drawdown_pct REAL,           -- 최대 낙폭 (%)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, snapshot_date)
);

-- 인덱스
CREATE INDEX idx_portfolio_snapshots_user_date 
  ON portfolio_snapshots(user_id, snapshot_date DESC);
```

#### portfolio_statistics 테이블
```sql
CREATE TABLE portfolio_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  
  -- 거래 통계
  total_trades INTEGER,          -- 전체 거래 수
  winning_trades INTEGER,        -- 수익 거래 수
  losing_trades INTEGER,         -- 손실 거래 수
  win_rate REAL,                 -- 승률 (%)
  
  -- 수익 분석
  avg_win REAL,                  -- 평균 수익금
  avg_loss REAL,                 -- 평균 손실금
  profit_factor REAL,            -- 수익지수 (총수익/총손실)
  
  -- 시간 분석
  best_day DATE,                 -- 최고 수익 날짜
  worst_day DATE,                -- 최악 손실 날짜
  consecutive_wins INTEGER,      -- 연속 수익 거래 수
  consecutive_losses INTEGER,    -- 연속 손실 거래 수
  
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
```

### UI 컴포넌트 구조

```
PortfolioAnalytics.tsx (메인)
├── KPICards
│   ├── TotalReturnCard (누적 수익률)
│   ├── SharpeRatioCard (위험조정 수익)
│   ├── MaxDrawdownCard (최대 낙폭)
│   └── WinRateCard (승률)
├── PerformanceCharts
│   ├── PortfolioValueChart (포트폴리오 가치 추이)
│   ├── DailyReturnChart (일일 수익률 히스토그램)
│   ├── DrawdownChart (낙폭 누적 그래프)
│   └── HoldingsCompositionPie (자산 구성)
├── TradeStatistics
│   ├── WinLossTable (수익/손실 거래)
│   ├── ConsecutiveWinsChart (연속 승패 분석)
│   └── MonthlyReturnTable (월별 수익률)
└── ExportOptions
    ├── CSV 다운로드
    ├── PDF 보고서
    └── 이메일 전송
```

### 구현 흐름

#### 1단계: 일일 스냅샷 생성 (Cron Job)

```typescript
// src/lib/portfolio-snapshot.ts
import schedule from 'node-schedule';

export async function createDailySnapshot(userId: string) {
  // 1. 현재 포트폴리오 계산
  const portfolio = await calculatePortfolio(userId);
  
  // 2. 이전 날짜 스냅샷 조회
  const prevSnapshot = await getPreviousSnapshot(userId);
  
  // 3. 수익률 계산
  const dailyReturn = prevSnapshot
    ? ((portfolio.totalValue - prevSnapshot.total_value) / prevSnapshot.total_value) * 100
    : 0;
  
  // 4. DB 저장
  await db.insert('portfolio_snapshots', {
    user_id: userId,
    snapshot_date: new Date().toISOString().split('T')[0],
    total_value: portfolio.totalValue,
    cash_balance: portfolio.cashBalance,
    holdings: JSON.stringify(portfolio.holdings),
    holdings_value: portfolio.holdingsValue,
    total_gain: portfolio.totalGain,
    total_return_pct: portfolio.returnPercent,
    daily_return_pct: dailyReturn,
    volatility: calculateVolatility(await getLast30Snapshots(userId)),
    sharpe_ratio: calculateSharpeRatio(await getLast30Snapshots(userId)),
    max_drawdown_pct: calculateMaxDrawdown(await getAllSnapshots(userId))
  });
  
  // 5. 통계 업데이트
  await updatePortfolioStatistics(userId);
}

// Cron: 매일 자정 스냅샷 생성
schedule.scheduleJob('0 0 * * *', async () => {
  const users = await getAllUsers();
  await Promise.all(users.map(u => createDailySnapshot(u.id)));
});
```

#### 2단계: API 엔드포인트

```typescript
// src/app/api/portfolio/snapshots/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30');
  const userId = await getUserId(req);
  
  // 지난 N일의 스냅샷 조회
  const snapshots = await db.query(`
    SELECT * FROM portfolio_snapshots
    WHERE user_id = ? AND snapshot_date >= date('now', '-' || ? || ' days')
    ORDER BY snapshot_date ASC
  `, [userId, days]);
  
  return json(snapshots);
}

// src/app/api/portfolio/statistics/route.ts
export async function GET(req: Request) {
  const userId = await getUserId(req);
  
  const stats = await db.queryOne(`
    SELECT * FROM portfolio_statistics WHERE user_id = ?
  `, [userId]);
  
  return json(stats);
}
```

#### 3단계: React 컴포넌트

```typescript
// src/components/PortfolioAnalytics.tsx
export function PortfolioAnalytics() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  
  useEffect(() => {
    const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, 'all': 10000 }[period];
    
    Promise.all([
      fetch(`/api/portfolio/snapshots?days=${days}`).then(r => r.json()),
      fetch('/api/portfolio/statistics').then(r => r.json())
    ]).then(([snaps, stats]) => {
      setSnapshots(snaps);
      setStats(stats);
    });
  }, [period]);
  
  if (!snapshots.length) return <div>데이터 없음</div>;
  
  return (
    <div className="portfolio-analytics">
      {/* 기간 선택 */}
      <div className="period-selector">
        {(['7d', '30d', '90d', '1y', 'all'] as const).map(p => (
          <button
            key={p}
            className={period === p ? 'active' : ''}
            onClick={() => setPeriod(p)}
          >
            {p === 'all' ? '전체' : p}
          </button>
        ))}
      </div>
      
      {/* KPI 카드 */}
      <div className="kpi-grid">
        <KPICard
          title="누적 수익률"
          value={`${snapshots[snapshots.length - 1].total_return_pct.toFixed(2)}%`}
          change={snapshots[snapshots.length - 1].daily_return_pct}
        />
        <KPICard
          title="Sharpe Ratio"
          value={stats?.sharpe_ratio.toFixed(2) || '-'}
          subtitle="위험조정 수익"
        />
        <KPICard
          title="최대 낙폭"
          value={`${stats?.max_drawdown_pct?.toFixed(2) || 0}%`}
          subtitle="MDD"
          type="negative"
        />
        <KPICard
          title="승률"
          value={`${stats?.win_rate?.toFixed(1) || 0}%`}
          subtitle={`${stats?.winning_trades || 0}승 ${stats?.losing_trades || 0}패`}
        />
      </div>
      
      {/* 차트 */}
      <div className="charts">
        <PortfolioValueChart data={snapshots} />
        <DailyReturnChart data={snapshots} />
        <DrawdownChart data={snapshots} />
        <HoldingsCompositionPie data={snapshots[snapshots.length - 1]} />
      </div>
      
      {/* 거래 통계 */}
      <TradeStatistics stats={stats} snapshots={snapshots} />
      
      {/* 내보내기 */}
      <div className="export-buttons">
        <button onClick={() => exportToCSV(snapshots)}>
          CSV 다운로드
        </button>
        <button onClick={() => exportToPDF(snapshots, stats)}>
          PDF 보고서
        </button>
      </div>
    </div>
  );
}
```

---

## 🎯 Feature Proposal #2: 커스텀 거래 전략 빌더

### 개요
사용자가 시각적 인터페이스를 통해 자신만의 거래 전략을 만들고, 백테스트하며, 실시간 거래에 적용할 수 있는 기능입니다.

### 전략 구조

```typescript
interface CustomStrategy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // 매수 조건
  buyCondition: {
    indicators: Indicator[];     // EMA, RSI, MACD 등
    logicType: 'AND' | 'OR';    // 조건 결합 방식
    expression: string;         // "RSI < 30 AND EMA12 > EMA26"
  };
  
  // 매도 조건
  sellCondition: {
    indicators: Indicator[];
    logicType: 'AND' | 'OR';
    expression: string;
  };
  
  // 위험 관리
  riskManagement: {
    positionSize: number;       // 거래량 (%)
    stopLoss?: number;          // 손절가 (%)
    takeProfit?: number;        // 익절가 (%)
    maxPositions?: number;      // 최대 동시 포지션 수
  };
  
  // 성과 통계
  stats: {
    totalTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

interface Indicator {
  name: 'EMA' | 'RSI' | 'MACD' | 'ATR' | 'STOCH';
  params: Record<string, number>;
  // e.g. { name: 'EMA', params: { period: 12 } }
}
```

### 데이터베이스 스키마

```sql
CREATE TABLE custom_strategies (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  
  -- 조건 (JSON)
  buy_condition JSON NOT NULL,
  sell_condition JSON NOT NULL,
  
  -- 위험 관리
  position_size REAL NOT NULL,     -- %
  stop_loss REAL,                  -- %
  take_profit REAL,                -- %
  max_positions INTEGER,
  
  -- 통계
  total_trades INTEGER DEFAULT 0,
  win_rate REAL,
  avg_win REAL,
  avg_loss REAL,
  sharpe_ratio REAL,
  max_drawdown REAL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_custom_strategies_user 
  ON custom_strategies(user_id);
```

### UI 컴포넌트

```typescript
// src/components/StrategyBuilder.tsx
export function StrategyBuilder() {
  const [strategy, setStrategy] = useState<CustomStrategy | null>(null);
  const [tab, setTab] = useState<'builder' | 'backtest' | 'live'>('builder');
  
  return (
    <div className="strategy-builder">
      {/* 탭 */}
      <Tabs value={tab} onChange={setTab}>
        <Tab label="전략 작성">
          <StrategyEditorPanel strategy={strategy} onChange={setStrategy} />
        </Tab>
        <Tab label="백테스트">
          <BacktestPanel strategy={strategy} />
        </Tab>
        <Tab label="실시간">
          <LiveTradingPanel strategy={strategy} />
        </Tab>
      </Tabs>
    </div>
  );
}

// 전략 편집 패널
function StrategyEditorPanel({ strategy, onChange }: Props) {
  return (
    <div className="editor-panel">
      {/* 기본 정보 */}
      <div className="section">
        <label>전략 이름</label>
        <input
          value={strategy?.name || ''}
          onChange={(e) => onChange({ ...strategy, name: e.target.value })}
        />
      </div>
      
      {/* 매수 조건 */}
      <div className="section">
        <h3>매수 조건</h3>
        <ConditionBuilder
          condition={strategy?.buyCondition}
          onChange={(cond) => onChange({ ...strategy, buyCondition: cond })}
        />
      </div>
      
      {/* 매도 조건 */}
      <div className="section">
        <h3>매도 조건</h3>
        <ConditionBuilder
          condition={strategy?.sellCondition}
          onChange={(cond) => onChange({ ...strategy, sellCondition: cond })}
        />
      </div>
      
      {/* 위험 관리 */}
      <div className="section">
        <h3>위험 관리</h3>
        <RiskManagementPanel
          riskManagement={strategy?.riskManagement}
          onChange={(rm) => onChange({ ...strategy, riskManagement: rm })}
        />
      </div>
      
      {/* 저장/삭제 */}
      <div className="actions">
        <button className="btn-primary" onClick={() => saveStrategy(strategy)}>
          저장
        </button>
        {strategy?.id && (
          <button className="btn-danger" onClick={() => deleteStrategy(strategy.id)}>
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

// 조건 빌더
function ConditionBuilder({ condition, onChange }: Props) {
  return (
    <div className="condition-builder">
      {/* 지표 선택 */}
      <div className="indicators">
        {condition?.indicators.map((ind, idx) => (
          <IndicatorSelector
            key={idx}
            indicator={ind}
            onChange={(newInd) => {
              const newIndicators = [...condition.indicators];
              newIndicators[idx] = newInd;
              onChange({ ...condition, indicators: newIndicators });
            }}
            onRemove={() => {
              const newIndicators = condition.indicators.filter((_, i) => i !== idx);
              onChange({ ...condition, indicators: newIndicators });
            }}
          />
        ))}
      </div>
      
      {/* 조건 추가 */}
      <button onClick={() => {
        onChange({
          ...condition,
          indicators: [...(condition?.indicators || []), { name: 'EMA', params: { period: 12 } }]
        });
      }}>
        + 조건 추가
      </button>
      
      {/* 표현식 미리보기 */}
      <div className="expression-preview">
        <code>{condition?.expression}</code>
      </div>
    </div>
  );
}

// 지표 선택기
function IndicatorSelector({ indicator, onChange, onRemove }: Props) {
  return (
    <div className="indicator-selector">
      <select value={indicator.name} onChange={(e) => {
        onChange({
          ...indicator,
          name: e.target.value as Indicator['name']
        });
      }}>
        <option value="EMA">EMA (이동평균)</option>
        <option value="RSI">RSI (상대강도지수)</option>
        <option value="MACD">MACD (이동평균 수렴/확산)</option>
        <option value="ATR">ATR (평균 진정 범위)</option>
        <option value="STOCH">STOCH (스토캐스틱)</option>
      </select>
      
      {/* 파라미터 입력 */}
      {indicator.name === 'EMA' && (
        <input
          type="number"
          value={indicator.params.period}
          onChange={(e) => onChange({
            ...indicator,
            params: { ...indicator.params, period: parseInt(e.target.value) }
          })}
          placeholder="기간"
        />
      )}
      
      {/* 비교 연산자 */}
      <select>
        <option>&lt;</option>
        <option>&gt;</option>
        <option>&lt;=</option>
        <option>&gt;=</option>
        <option>==</option>
        <option>CROSS</option>
      </select>
      
      {/* 값 입력 */}
      <input type="number" placeholder="값" />
      
      {/* 제거 버튼 */}
      <button className="btn-remove" onClick={onRemove}>✕</button>
    </div>
  );
}
```

### 백테스트 엔진

```typescript
// src/lib/strategy-backtest.ts
export async function runStrategyBacktest(
  strategy: CustomStrategy,
  market: string,
  startDate: Date,
  endDate: Date
) {
  // 1. 캔들 데이터 로드
  const candles = await getCandles(market, startDate, endDate);
  
  // 2. 지표 계산
  const indicators = calculateIndicators(candles, strategy);
  
  // 3. 거래 시뮬레이션
  let cash = 1000000;  // 초기 자본
  let positions: Position[] = [];
  const trades: Trade[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const candle_indicators = indicators[i];
    
    // 4. 매수 신호 확인
    if (evaluateCondition(strategy.buyCondition, candle_indicators)) {
      const quantity = (cash * strategy.riskManagement.positionSize) / 100 / candle.close;
      
      if (quantity > 0 && positions.length < (strategy.riskManagement.maxPositions || Infinity)) {
        positions.push({
          market,
          quantity,
          entryPrice: candle.close,
          entryTime: candle.time
        });
        
        cash -= quantity * candle.close;
      }
    }
    
    // 5. 매도 신호 확인
    for (let j = 0; j < positions.length; j++) {
      const pos = positions[j];
      const exit_price = candle.close;
      
      // 손절/익절 확인
      const pnl_pct = (exit_price - pos.entryPrice) / pos.entryPrice * 100;
      
      if (
        strategy.riskManagement.stopLoss && pnl_pct <= -strategy.riskManagement.stopLoss ||
        strategy.riskManagement.takeProfit && pnl_pct >= strategy.riskManagement.takeProfit ||
        evaluateCondition(strategy.sellCondition, candle_indicators)
      ) {
        trades.push({
          type: 'sell',
          market: pos.market,
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          exitPrice: exit_price,
          pnl: (exit_price - pos.entryPrice) * pos.quantity,
          pnl_pct
        });
        
        cash += exit_price * pos.quantity;
        positions.splice(j, 1);
        j--;
      }
    }
  }
  
  // 6. 통계 계산
  const stats = calculateBacktestStats(trades, 1000000);
  
  return {
    trades,
    stats,
    portfolio_value_history: calculatePortfolioValueHistory(trades, candles)
  };
}

function evaluateCondition(condition: Condition, indicators: Indicators): boolean {
  // 조건 표현식 평가 (샌드박스 필요)
  const sandbox = { ...indicators };
  return eval(`(${condition.expression})`) === true;
}
```

---

## 🎯 Feature Proposal #3: 거래 일지 (Trading Journal)

### 개요
각 거래마다 근거와 분석을 기록하고, 나중에 성과를 분석하는 학습 도구입니다.

### 데이터 모델

```sql
CREATE TABLE trade_journals (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  transaction_id TEXT NOT NULL,
  
  -- 거래 근거
  reason TEXT NOT NULL,           -- "RSI < 30 + 호재 뉴스"
  market TEXT NOT NULL,
  type TEXT NOT NULL,             -- 'buy' | 'sell'
  
  -- 예상
  expected_return_pct REAL,       -- 목표 수익률 (%)
  expected_timeframe TEXT,        -- "3일" | "1주" | "1개월"
  risk_assessment TEXT,           -- "낮음" | "중간" | "높음"
  
  -- 실제 결과 (체결 후)
  actual_return_pct REAL,         -- 실제 수익률 (%)
  lessons_learned TEXT,           -- 배운 점
  mistakes TEXT,                  -- 실수 포인트
  success_factors TEXT,           -- 성공 요인
  
  -- 참고 자료
  chart_snapshot BLOB,            -- 거래 당시 차트 스크린샷
  news_reference TEXT,            -- 관련 뉴스 URL
  tags TEXT,                      -- 쉼표 구분 태그
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP,         -- 거래 완료 시간
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX idx_trade_journals_user ON trade_journals(user_id);
CREATE INDEX idx_trade_journals_date ON trade_journals(created_at DESC);
```

### UI 컴포넌트

```typescript
// src/components/TradeJournalModal.tsx
export function TradeJournalModal({ transaction, isOpen, onClose }: Props) {
  const [journal, setJournal] = useState<TradeJournal | null>(null);
  const [tab, setTab] = useState<'entry' | 'review' | 'stats'>('entry');
  
  useEffect(() => {
    if (isOpen && transaction) {
      fetchJournal(transaction.id).then(setJournal);
    }
  }, [isOpen, transaction]);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Tabs value={tab} onChange={setTab}>
        {/* 거래 당시 입력 */}
        <Tab label="거래 기록">
          <TradeEntryForm
            transaction={transaction}
            journal={journal}
            onSave={(j) => {
              saveJournal(j);
              setJournal(j);
            }}
          />
        </Tab>
        
        {/* 사후 분석 */}
        <Tab label="거래 분석" disabled={!journal?.completed_at}>
          <TradeReviewForm
            journal={journal}
            onSave={(j) => {
              updateJournal(j);
              setJournal(j);
            }}
          />
        </Tab>
        
        {/* 통계 */}
        <Tab label="성과 분석">
          <TradeJournalStats user_id={transaction?.user_id} />
        </Tab>
      </Tabs>
    </Modal>
  );
}

// 거래 입력 폼
function TradeEntryForm({ transaction, journal, onSave }: Props) {
  const [form, setForm] = useState(journal || {
    reason: '',
    expected_return_pct: 0,
    expected_timeframe: '',
    risk_assessment: '중간'
  });
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSave({ ...journal, ...form });
    }}>
      {/* 거래 정보 (읽기 전용) */}
      <div className="transaction-info">
        <p><strong>암호화폐:</strong> {transaction.market}</p>
        <p><strong>타입:</strong> {transaction.type === 'buy' ? '매수' : '매도'}</p>
        <p><strong>수량:</strong> {transaction.quantity}</p>
        <p><strong>가격:</strong> {transaction.price.toLocaleString()} 원</p>
        <p><strong>시간:</strong> {new Date(transaction.timestamp).toLocaleString()}</p>
      </div>
      
      {/* 거래 근거 */}
      <div className="form-group">
        <label><strong>거래 근거</strong></label>
        <textarea
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="이 거래를 한 이유를 자세히 설명해주세요. 기술적 신호, 뉴스, 심리 상태 등..."
          rows={4}
          required
        />
      </div>
      
      {/* 예상 수익률 */}
      <div className="form-row">
        <div className="form-group">
          <label>목표 수익률</label>
          <input
            type="number"
            value={form.expected_return_pct}
            onChange={(e) => setForm({ ...form, expected_return_pct: parseFloat(e.target.value) })}
            placeholder="%"
            step="0.1"
          />
        </div>
        
        <div className="form-group">
          <label>예상 기간</label>
          <select
            value={form.expected_timeframe}
            onChange={(e) => setForm({ ...form, expected_timeframe: e.target.value })}
          >
            <option>선택</option>
            <option value="1시간">1시간</option>
            <option value="1일">1일</option>
            <option value="3일">3일</option>
            <option value="1주">1주</option>
            <option value="2주">2주</option>
            <option value="1개월">1개월</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>위험도</label>
          <select
            value={form.risk_assessment}
            onChange={(e) => setForm({ ...form, risk_assessment: e.target.value })}
          >
            <option value="낮음">낮음</option>
            <option value="중간">중간</option>
            <option value="높음">높음</option>
          </select>
        </div>
      </div>
      
      {/* 차트 스냅샷 */}
      <div className="form-group">
        <label>차트 스냅샷 (선택)</label>
        <input type="file" accept="image/*" />
      </div>
      
      <button type="submit" className="btn-primary">저장</button>
    </form>
  );
}

// 거래 분석 폼
function TradeReviewForm({ journal, onSave }: Props) {
  const [form, setForm] = useState(journal || {});
  
  const actual_vs_expected = journal
    ? journal.actual_return_pct - journal.expected_return_pct
    : 0;
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSave({ ...journal, ...form, completed_at: new Date() });
    }}>
      {/* 실제 수익률 */}
      <div className="form-group">
        <label><strong>실제 수익률</strong></label>
        <div className="result-display">
          <span className={actual_vs_expected >= 0 ? 'positive' : 'negative'}>
            {journal?.actual_return_pct?.toFixed(2) || 0}%
          </span>
          <span className="diff">
            (예상: {journal?.expected_return_pct?.toFixed(2)}% 
            {actual_vs_expected >= 0 ? '+' : ''}{actual_vs_expected?.toFixed(2)}%)
          </span>
        </div>
      </div>
      
      {/* 배운 점 */}
      <div className="form-group">
        <label>배운 점</label>
        <textarea
          value={form.lessons_learned || ''}
          onChange={(e) => setForm({ ...form, lessons_learned: e.target.value })}
          placeholder="이 거래로부터 배운 교훈..."
          rows={3}
        />
      </div>
      
      {/* 실수 포인트 */}
      <div className="form-group">
        <label>실수 포인트</label>
        <textarea
          value={form.mistakes || ''}
          onChange={(e) => setForm({ ...form, mistakes: e.target.value })}
          placeholder="이 거래에서 개선할 사항..."
          rows={3}
        />
      </div>
      
      {/* 성공 요인 */}
      <div className="form-group">
        <label>성공 요인</label>
        <textarea
          value={form.success_factors || ''}
          onChange={(e) => setForm({ ...form, success_factors: e.target.value })}
          placeholder="이 거래가 성공한 이유..."
          rows={3}
        />
      </div>
      
      {/* 태그 */}
      <div className="form-group">
        <label>태그 (쉼표 구분)</label>
        <input
          type="text"
          value={form.tags || ''}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="기술적신호, 호재, 손절 실패, ..."
        />
      </div>
      
      <button type="submit" className="btn-primary">분석 저장</button>
    </form>
  );
}

// 거래 일지 통계
function TradeJournalStats({ user_id }: Props) {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetch(`/api/trade-journals/stats?user_id=${user_id}`)
      .then(r => r.json())
      .then(setStats);
  }, [user_id]);
  
  if (!stats) return <Spinner />;
  
  return (
    <div className="journal-stats">
      <h3>거래 분석</h3>
      
      {/* 근거별 승률 */}
      <div className="stat-card">
        <h4>근거별 성공률</h4>
        <Table
          data={stats.reasonStats}
          columns={[
            { label: '근거', key: 'reason' },
            { label: '거래수', key: 'count' },
            { label: '승률', key: 'win_rate' },
            { label: '평균수익률', key: 'avg_return' }
          ]}
        />
      </div>
      
      {/* 위험도별 분석 */}
      <div className="stat-card">
        <h4>위험도별 성과</h4>
        <BarChart
          data={stats.riskStats}
          x="risk_level"
          y="avg_return"
          labels={{ 낮음: '낮음', 중간: '중간', 높음: '높음' }}
        />
      </div>
      
      {/* 예상 vs 실제 */}
      <div className="stat-card">
        <h4>예상 vs 실제 수익률</h4>
        <ScatterChart
          data={stats.predictions}
          x="expected_return_pct"
          y="actual_return_pct"
          title="예상 수익률 vs 실제 수익률"
        />
      </div>
    </div>
  );
}
```

---

## 🎯 Feature Proposal #4: 포트폴리오 공유 및 벤치마킹

### 개요
사용자가 자신의 포트폴리오를 선택적으로 공유하고, 다른 사용자의 전략을 참고할 수 있는 기능입니다.

### 데이터 모델

```sql
CREATE TABLE portfolio_shares (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  
  name TEXT NOT NULL,            -- "내 공격적 포트폴리오"
  description TEXT,
  
  -- 공개 설정
  is_public BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE,       -- 비공개 링크용
  share_expiry TIMESTAMP,        -- 링크 만료 시간
  
  -- 공유 범위
  show_holdings BOOLEAN DEFAULT true,     -- 보유 자산 공개
  show_trades BOOLEAN DEFAULT true,       -- 거래 이력 공개
  show_returns BOOLEAN DEFAULT true,      -- 수익률 공개
  show_journal BOOLEAN DEFAULT false,     -- 거래 일지 공개
  
  -- 조회 통계
  view_count INTEGER DEFAULT 0,
  liked_count INTEGER DEFAULT 0,
  last_viewed TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE portfolio_share_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL,
  viewer_user_id INTEGER,        -- NULL이면 익명
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (share_id) REFERENCES portfolio_shares(id)
);

CREATE TABLE portfolio_likes (
  user_id INTEGER NOT NULL,
  share_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, share_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (share_id) REFERENCES portfolio_shares(id)
);
```

### API 엔드포인트

```typescript
// POST /api/portfolio/share
export async function POST(req: Request) {
  const { name, description, showHoldings, showTrades } = await req.json();
  const userId = await getUserId(req);
  
  const shareToken = crypto.randomBytes(24).toString('hex');
  const shareId = generateId();
  
  await db.insert('portfolio_shares', {
    id: shareId,
    user_id: userId,
    name,
    description,
    share_token: shareToken,
    show_holdings: showHoldings,
    show_trades: showTrades
  });
  
  return json({
    shareId,
    shareUrl: `/portfolio/share/${shareToken}`,
    copied: false
  });
}

// GET /api/portfolio/share/:token
export async function GET(req: Request, { params }: Props) {
  const { token } = params;
  
  const share = await db.queryOne(`
    SELECT ps.*, u.id as owner_id
    FROM portfolio_shares ps
    JOIN users u ON ps.user_id = u.id
    WHERE ps.share_token = ? AND (ps.is_public = true OR ps.share_expiry > NOW())
  `, [token]);
  
  if (!share) return json({ error: 'Not found' }, { status: 404 });
  
  // 조회수 기록
  await db.insert('portfolio_share_views', {
    share_id: share.id,
    viewer_user_id: (await getUserId(req).catch(() => null))
  });
  
  // 포트폴리오 데이터 조회 (권한 확인)
  const portfolio = await getPortfolioData(share.user_id, {
    show_holdings: share.show_holdings,
    show_trades: share.show_trades,
    show_journal: share.show_journal
  });
  
  return json({ share, portfolio });
}

// POST /api/portfolio/share/:id/like
export async function POST(req: Request, { params }: Props) {
  const { id } = params;
  const userId = await getUserId(req);
  
  try {
    await db.insert('portfolio_likes', { user_id: userId, share_id: id });
    return json({ liked: true });
  } catch {
    return json({ error: 'Already liked' }, { status: 400 });
  }
}
```

### UI 컴포넌트

```typescript
// src/components/PortfolioShareModal.tsx
export function PortfolioShareModal({ isOpen, onClose }: Props) {
  const [shares, setShares] = useState<PortfolioShare[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      fetch('/api/portfolio/shares').then(r => r.json()).then(setShares);
    }
  }, [isOpen]);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="portfolio-share">
        <h2>포트폴리오 공유</h2>
        
        {showForm && <ShareCreateForm onSuccess={() => setShowForm(false)} />}
        
        {!showForm && (
          <>
            <button onClick={() => setShowForm(true)}>
              + 새 공유 링크 만들기
            </button>
            
            {/* 기존 공유 목록 */}
            <div className="shares-list">
              {shares.map(share => (
                <ShareCard key={share.id} share={share} />
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// 공유 생성 폼
function ShareCreateForm({ onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    show_holdings: true,
    show_trades: true,
    show_returns: true,
    is_public: false
  });
  
  const handleSubmit = async () => {
    const response = await fetch('/api/portfolio/share', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    
    const { shareUrl } = await response.json();
    
    // 클립보드 복사
    await navigator.clipboard.writeText(window.location.origin + shareUrl);
    toast.success('공유 링크가 클립보드에 복사되었습니다!');
    
    onSuccess();
  };
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div className="form-group">
        <label>공유 이름</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="예: 내 공격적 포트폴리오"
          required
        />
      </div>
      
      <div className="form-group">
        <label>설명 (선택)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="이 포트폴리오에 대해 설명해주세요"
        />
      </div>
      
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={form.show_holdings}
            onChange={(e) => setForm({ ...form, show_holdings: e.target.checked })}
          />
          보유 자산 공개
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.show_trades}
            onChange={(e) => setForm({ ...form, show_trades: e.target.checked })}
          />
          거래 이력 공개
        </label>
      </div>
      
      <button type="submit" className="btn-primary">공유 링크 생성</button>
    </form>
  );
}

// 공개 포트폴리오 뷰
export function PublicPortfolioView({ token }: Props) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch(`/api/portfolio/share/${token}`).then(r => r.json()).then(setData);
  }, [token]);
  
  if (!data) return <Spinner />;
  
  const { share, portfolio } = data;
  
  return (
    <div className="public-portfolio">
      <div className="header">
        <h1>{share.name}</h1>
        <p>{share.description}</p>
        <div className="stats">
          <span>👁 {share.view_count} 조회</span>
          <span>❤️ {share.liked_count} 좋아요</span>
          <LikeButton shareId={share.id} />
        </div>
      </div>
      
      {/* 포트폴리오 정보 */}
      {share.show_holdings && <PortfolioHoldings data={portfolio.holdings} />}
      {share.show_trades && <TradesList data={portfolio.trades} />}
      {share.show_returns && <PerformanceChart data={portfolio.performance} />}
      {share.show_journal && <JournalSummary data={portfolio.journal} />}
    </div>
  );
}
```

---

## 📊 새 기능별 구현 우선순위

| 기능 | 복잡도 | 가치 | 난이도 | 추천 순서 |
|------|--------|------|--------|----------|
| 포트폴리오 분석 | 중간 | 높음 | 중간 | 1순위 |
| 커스텀 전략 | 높음 | 높음 | 높음 | 2순위 |
| 거래 일지 | 중간 | 중간 | 중간 | 3순위 |
| 포트폴리오 공유 | 중간 | 중간 | 중간 | 4순위 |
| 멀티 포트폴리오 | 높음 | 낮음 | 높음 | 5순위 |

---

**문서 버전:** 1.0.0  
**마지막 수정:** 2025-11-26

