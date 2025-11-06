# 암호화폐 투자 시뮬레이터 고도화 로드맵

이 문서는 `crypto-invest-sim-kr` 프로젝트의 차트 고도화, 로컬 AI 최적화, 자동 매매 전략 개선 방안을 다룹니다.

---

## 1. 차트 고도화 방안

### 1.1 개요

현재 프로젝트는 `lightweight-charts`를 사용하여 기본적인 캔들 차트와 SMA(단순 이동평균선)를 제공합니다. 이를 고급 차트 라이브러리로 전환하여 더 풍부한 기능을 제공할 수 있습니다.

### 1.2 추천 라이브러리

#### TradingView Charting Library (권장)
- **장점**: 업계 표준, 강력한 기능, 무료 사용 가능
- **특징**:
  - 캔들/라인/바/에리어 차트 복수 표시
  - 여러 코인 동시 비교
  - 시간/범위별 확대/축소 (Pan/Zoom)
  - 커스텀 오버레이 및 인디케이터
  - 실시간 데이터 업데이트
- **설치**: `npm install lightweight-charts` (현재 사용 중) 또는 `@tradingview/charting_library` (고급 버전)

#### 대안 라이브러리
- **Recharts**: React 기반, 간단한 차트에 적합
- **Chart.js**: 범용 차트 라이브러리, 커뮤니티 인디케이터 풍부
- **ApexCharts**: 인터랙티브 차트, 상업적 사용 가능

### 1.3 고급 기술지표 구현

#### 1.3.1 이평선 (MA/EMA)
```typescript
// 현재 구현: SMA만 제공
// 개선: EMA, 가중이동평균(WMA) 추가

interface IndicatorConfig {
  type: 'MA' | 'EMA' | 'WMA';
  period: number;
  color: string;
  lineWidth: number;
}

// EMA 계산 함수
export function calculateEMA(data: Candle[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // 첫 번째 EMA는 SMA로 시작
  const firstSMA = data.slice(0, period).reduce((sum, d) => sum + d.trade_price, 0) / period;
  ema.push(firstSMA);
  
  for (let i = period; i < data.length; i++) {
    const currentEMA = (data[i].trade_price - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }
  
  return ema;
}
```

**사용자 설정 가능 항목**:
- 기간: 5, 10, 20, 50, 100, 200일 등
- 타입: MA, EMA 선택
- 색상 및 라인 두께 커스터마이징

#### 1.3.2 RSI (Relative Strength Index)
```typescript
// 현재: utils.ts에 calculateRSI 구현됨
// 개선: 차트에 표시 및 실시간 업데이트

interface RSIConfig {
  period: number; // 기본값: 14
  overbought: number; // 기본값: 70
  oversold: number; // 기본값: 30
  showLevels: boolean; // 기준선 표시 여부
}
```

**차트 표시**:
- 별도 서브 차트에 RSI 라인 표시
- 과매수(70) / 과매도(30) 구간 하이라이트
- 다이버전스 감지 및 알림

#### 1.3.3 MACD (Moving Average Convergence Divergence)
```typescript
interface MACDConfig {
  fastPeriod: number; // 기본값: 12
  slowPeriod: number; // 기본값: 26
  signalPeriod: number; // 기본값: 9
}

export function calculateMACD(data: Candle[], fast: number, slow: number, signal: number) {
  const fastEMA = calculateEMA(data, fast);
  const slowEMA = calculateEMA(data, slow);
  const macdLine = fastEMA.map((val, i) => val - slowEMA[i]);
  const signalLine = calculateEMA(
    macdLine.map((val, i) => ({ trade_price: val } as Candle)),
    signal
  );
  const histogram = macdLine.map((val, i) => val - signalLine[i]);
  
  return { macdLine, signalLine, histogram };
}
```

**차트 표시**:
- MACD 라인, 시그널 라인, 히스토그램 표시
- 골든 크로스/데드 크로스 시각화

#### 1.3.4 볼린저 밴드 (Bollinger Bands)
```typescript
// 현재: utils.ts에 calculateBollingerBands 구현됨
// 개선: 차트에 시각화

interface BollingerConfig {
  period: number; // 기본값: 20
  multiplier: number; // 기본값: 2.0
  showPercentB: boolean; // %B 표시 여부
}
```

**차트 표시**:
- 상단/중간/하단 밴드 표시
- 가격이 밴드 밖으로 나갈 때 알림
- 밴드 폭(밴드폭) 표시

#### 1.3.5 ATR (Average True Range)
```typescript
export function calculateATR(data: CandleData[], period: number): number[] {
  const trueRanges: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high_price;
    const low = data[i].low_price;
    const prevClose = data[i - 1].trade_price;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  // 이동평균 계산
  const atr: number[] = [];
  for (let i = 0; i <= trueRanges.length - period; i++) {
    const sum = trueRanges.slice(i, i + period).reduce((a, b) => a + b, 0);
    atr.push(sum / period);
  }
  
  return atr;
}
```

**사용 목적**:
- 변동성 측정
- 손절매/익절매 레벨 설정
- 포지션 사이징 결정

### 1.4 여러 코인 동시 비교

#### 구현 방안
```typescript
interface MultiChartProps {
  markets: string[]; // 예: ['KRW-BTC', 'KRW-ETH', 'KRW-XRP']
  chartType: 'candlestick' | 'line' | 'area';
  comparisonMode: 'absolute' | 'percentage'; // 절대값 vs 상대변화율
}

// 차트에 여러 시리즈 추가
markets.forEach(market => {
  const series = chart.addLineSeries({
    title: market,
    color: getMarketColor(market),
  });
  series.setData(getChartData(market));
});
```

**기능**:
- 드래그 앤 드롭으로 코인 추가/제거
- 상대 성과 비교 (퍼센트 변화)
- 상관관계 매트릭스 표시

### 1.5 시간/범위별 확대/축소

#### TradingView Charting Library 기능 활용
- **마우스 휠**: 확대/축소
- **드래그**: 시간 범위 이동
- **더블클릭**: 전체 범위로 리셋
- **타임프레임 선택**: 1분, 5분, 1시간, 1일, 1주 등

```typescript
chart.timeScale().setVisibleRange({
  from: timestamp1,
  to: timestamp2,
});

// 시간 프레임 변경
chart.timeScale().applyOptions({
  timeVisible: true,
  secondsVisible: false,
});
```

### 1.6 거래 내역 연동

#### 매수/매도 시점 시각화
```typescript
interface TradeMarker {
  time: UTCTimestamp;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  profit?: number; // 매도 시 실현 손익
}

// 차트에 마커 추가
transactions.forEach(tx => {
  chart.addLineSeries({
    title: tx.type === 'buy' ? '매수' : '매도',
    color: tx.type === 'buy' ? '#00ff00' : '#ff0000',
    lineWidth: 0,
    pointMarkersVisible: true,
  });
  
  // 마커로 표시
  chart.addLineSeries({
    markers: [{
      time: tx.timestamp,
      position: 'belowBar',
      color: tx.type === 'buy' ? '#00ff00' : '#ff0000',
      shape: tx.type === 'buy' ? 'arrowUp' : 'arrowDown',
      text: `${tx.type === 'buy' ? '매수' : '매도'} ${tx.amount}`,
    }],
  });
});
```

**표시 정보**:
- 매수/매도 아이콘 (위/아래 화살표)
- 거래 가격 및 수량
- 실현 손익 (매도 시)
- 평균 매수가 표시 (수평선)

### 1.7 체결/호가/유동성 차트

#### 1.7.1 실시간 오더북
```typescript
interface OrderBookData {
  bids: { price: number; quantity: number }[]; // 매수 호가
  asks: { price: number; quantity: number }[]; // 매도 호가
}

// Depth Chart (깊이 차트)
function renderOrderBook(orderBook: OrderBookData) {
  // 양쪽으로 누적된 거래량 표시
  // 가격 레벨별 색상 구분
}
```

**기능**:
- 실시간 호가 업데이트 (WebSocket)
- 가격 레벨별 거래량 시각화
- 매수/매도 호가 차이 (스프레드) 표시

#### 1.7.2 유동성 변동
```typescript
interface LiquidityData {
  timestamp: string;
  liquidity: number; // 유동성 점수
  bidDepth: number; // 매수 호가 누적량
  askDepth: number; // 매도 호가 누적량
}

// 유동성 지표 계산
function calculateLiquidity(orderBook: OrderBookData): number {
  const bidVolume = orderBook.bids.reduce((sum, bid) => sum + bid.quantity, 0);
  const askVolume = orderBook.asks.reduce((sum, ask) => sum + ask.quantity, 0);
  return (bidVolume + askVolume) / 2;
}
```

#### 1.7.3 거래량 인터랙티브 그래프
```typescript
// 거래량 바 차트 (Volume Bars)
interface VolumeData {
  time: UTCTimestamp;
  value: number;
  color: string; // 상승 = 녹색, 하락 = 빨강
}

// 차트 하단에 거래량 바 표시
const volumeSeries = chart.addHistogramSeries({
  priceFormat: {
    type: 'volume',
  },
  priceScaleId: 'volume',
  scaleMargins: {
    top: 0.8,
    bottom: 0,
  },
});
```

**기능**:
- 시간대별 거래량 표시
- 거래량 급증/급감 하이라이트
- 거래량 이동평균선 표시

### 1.8 구현 우선순위

1. **Phase 1 (기본 고도화)**
   - EMA, RSI, MACD, 볼린저밴드 차트 표시
   - 거래 내역 마커 표시
   - 시간 범위 확대/축소

2. **Phase 2 (고급 기능)**
   - 여러 코인 동시 비교
   - ATR 및 추가 지표
   - 거래량 인터랙티브 그래프

3. **Phase 3 (실시간 기능)**
   - 실시간 오더북
   - 유동성 변동 모니터링
   - WebSocket 기반 실시간 업데이트

---

## 2. 로컬 AI 효율 최적화

### 2.1 개요

현재 시스템은 NewsAPI를 통해 뉴스를 가져오고 간단한 키워드 기반 감성 분석을 수행합니다. 로컬 AI 모델을 도입하여 클라우드 의존성을 줄이고 분석 품질을 향상시킬 수 있습니다.

### 2.2 경량 모델 선택

#### 2.2.1 추천 모델 (2B~7B 파라미터)

**한국어 특화 모델**:
- **KULLM-2** (2B): 한국어 최적화, 빠른 추론
- **Polyglot-Ko** (1.3B~5.8B): 다국어 지원, 한국어 성능 우수
- **SOLAR-10.7B**: 한국어와 영어 모두 우수

**범용 경량 모델**:
- **Mistral-7B**: 강력한 성능, 상대적으로 경량
- **Llama-2-7B**: 널리 사용, 커뮤니티 지원 풍부
- **Phi-2 (2.7B)**: Microsoft, 매우 경량이면서 우수한 성능

#### 2.2.2 모델 포맷 및 실행 엔진

**llama.cpp (권장)**
```bash
# 설치
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# 모델 변환 (GGUF 포맷)
python convert.py model.ggml

# 추론 실행
./main -m model.gguf -p "프롬프트" -n 128
```

**장점**:
- CPU/GPU 모두 지원
- 메모리 효율적
- 다양한 양자화 지원 (Q4, Q5, Q8)

**KoboldCpp**
```bash
# 설치
# Windows: https://github.com/LostRuins/koboldcpp/releases
# 또는 Python으로 실행
pip install koboldcpp

# 실행
python koboldcpp.py --model model.gguf
```

**장점**:
- 웹 인터페이스 제공
- API 엔드포인트 자동 생성
- 여러 모델 동시 로드 가능

**Ollama (권장)**
```bash
# 설치
curl -fsSL https://ollama.com/install.sh | sh

# 모델 다운로드
ollama pull mistral
ollama pull llama2

# API 사용
curl http://localhost:11434/api/generate -d '{
  "model": "mistral",
  "prompt": "프롬프트",
  "stream": false
}'
```

**장점**:
- 설치 및 사용이 매우 간단
- 자동 모델 관리
- REST API 제공

### 2.3 온체인/뉴스 데이터 로컬 캐싱

#### 2.3.1 데이터베이스 설계

**SQLite (권장) / PostgreSQL**
```sql
-- 코인 시세 캐시 테이블
CREATE TABLE candle_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market TEXT NOT NULL,
  candle_date_time_utc TEXT NOT NULL,
  opening_price REAL,
  high_price REAL,
  low_price REAL,
  low_price REAL,
  trade_price REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(market, candle_date_time_utc)
);

-- 뉴스 캐시 테이블
CREATE TABLE news_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE,
  source_name TEXT,
  published_at TEXT,
  sentiment TEXT, -- 'positive', 'negative', 'neutral'
  keywords TEXT, -- JSON 배열
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_candle_market_time ON candle_cache(market, candle_date_time_utc);
CREATE INDEX idx_news_published ON news_cache(published_at);
```

#### 2.3.2 캐싱 전략

```typescript
// src/lib/cache.ts
import Database from 'better-sqlite3';

const db = new Database('crypto_cache.db');

export async function getCandlesWithCache(
  market: string,
  count: number
): Promise<CandleData[]> {
  // 1. 캐시 확인 (최근 1시간 이내 데이터)
  const cached = db.prepare(`
    SELECT * FROM candle_cache
    WHERE market = ? 
    AND created_at > datetime('now', '-1 hour')
    ORDER BY candle_date_time_utc DESC
    LIMIT ?
  `).all(market, count);

  if (cached.length >= count * 0.8) {
    return cached as CandleData[];
  }

  // 2. API 호출
  const fresh = await fetchCandlesFromAPI(market, count);
  
  // 3. 캐시 저장
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO candle_cache 
    (market, candle_date_time_utc, opening_price, high_price, low_price, trade_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  fresh.forEach(candle => {
    stmt.run(
      candle.market,
      candle.candle_date_time_utc,
      candle.opening_price,
      candle.high_price,
      candle.low_price,
      candle.trade_price
    );
  });

  return fresh;
}
```

**캐시 만료 정책**:
- 시세 데이터: 1시간
- 뉴스 데이터: 24시간
- 기술지표: 계산 시점 기준 (원본 데이터에 의존)

#### 2.3.3 Batch 추론 병렬화

```typescript
// 여러 코인/뉴스 동시 분석
async function batchAnalyzeWithAI(
  items: Array<{ market?: string; news?: NewsArticle }>,
  model: string = 'mistral'
): Promise<AnalysisResult[]> {
  const batchSize = 10; // 동시 처리 개수
  const results: AnalysisResult[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // 병렬 처리
    const batchPromises = batch.map(item => 
      analyzeWithAI(item, model)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}
```

**GPU 활용**:
```python
# Python 백엔드에서 vLLM 사용
from vllm import LLM, SamplingParams

llm = LLM(model="mistral-7b", tensor_parallel_size=2)  # 멀티 GPU

sampling_params = SamplingParams(temperature=0.7, top_p=0.9)
prompts = ["프롬프트1", "프롬프트2", ...]

outputs = llm.generate(prompts, sampling_params)
```

### 2.4 Task 분리 처리

#### 2.4.1 역할별 모델 분리

**1. 시세 분석 전용 (기술적 분석)**
```python
# 모델: Mistral-7B (기술적 분석에 특화)
# 프롬프트: 간결하고 구조화된 입력

prompt = """
다음 코인 시세 데이터를 분석하세요:
- 현재가: {price}
- 24시간 변동률: {change_24h}%
- 거래량: {volume}
- RSI: {rsi}
- MACD: {macd_signal}

분석 결과를 JSON 형식으로 반환:
{
  "trend": "상승/하락/횡보",
  "strength": 1-10,
  "recommendation": "매수/매도/보유",
  "confidence": 0-1
}
"""
```

**2. 전략 추천 전용 (전략 생성)**
```python
# 모델: KULLM-2 (한국어 최적화)
# 프롬프트: 전략적 사고 유도

prompt = """
사용자 포트폴리오:
- 보유 현금: {cash}원
- 보유 코인: {assets}
- 리스크 선호도: {risk_tolerance}

다음 조건을 고려하여 최적의 매매 전략을 제안하세요:
1. 현재 시장 상황
2. 기술적 지표
3. 뉴스 감성

전략을 JSON 형식으로 반환:
{
  "strategy_type": "DCA/MA/RSI/BBand/News",
  "parameters": {...},
  "reasoning": "전략 선택 이유"
}
"""
```

**3. 거래 알림 전용 (요약 및 알림)**
```python
# 모델: Phi-2 (경량, 빠른 추론)
# 프롬프트: 간단한 요약

prompt = """
다음 거래 내역을 요약하세요:
{transactions}

사용자에게 보낼 알림 메시지 (50자 이내):
"""
```

#### 2.4.2 미니멀 프롬프트 설계

**원칙**:
1. **간결성**: 불필요한 설명 제거
2. **구조화**: JSON 형식 강제
3. **컨텍스트 최소화**: 필요한 정보만 포함
4. **Few-shot 예시**: 1-2개 예시 제공

**예시**:
```
입력: BTC 가격 100만원, RSI 25, 볼린저 하단 터치
출력: {"action": "buy", "confidence": 0.8, "reason": "과매도 구간"}

입력: {current_data}
출력:
```

### 2.5 CLI 호환 AI 도구 통합

#### 2.5.1 시스템 아키텍처

```
┌─────────────────┐
│  Next.js Frontend│
└────────┬─────────┘
         │ HTTP/WebSocket
┌────────▼─────────┐
│  Next.js API Route│
└────────┬─────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    │         │         │          │
┌───▼───┐ ┌──▼───┐ ┌───▼───┐ ┌───▼────┐
│Ollama │ │llama │ │Kobold │ │vLLM    │
│API    │ │.cpp  │ │Cpp API│ │Server  │
└───────┘ └──────┘ └───────┘ └────────┘
```

#### 2.5.2 API 통합 예시

```typescript
// src/lib/ai-client.ts
interface AIClient {
  generate(prompt: string, options?: GenerationOptions): Promise<string>;
}

class OllamaClient implements AIClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(
    prompt: string,
    options: { model?: string; temperature?: number } = {}
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'mistral',
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
        },
      }),
    });

    const data = await response.json();
    return data.response;
  }
}

class LlamaCppClient implements AIClient {
  // llama.cpp 서버 모드 또는 HTTP API 사용
  async generate(prompt: string): Promise<string> {
    // 구현
  }
}

// 사용
const aiClient = new OllamaClient();
const analysis = await aiClient.generate(analysisPrompt);
```

#### 2.5.3 환경 설정

```typescript
// .env.local
AI_BACKEND=ollama  # 'ollama' | 'llamacpp' | 'koboldcpp' | 'vllm'
AI_BASE_URL=http://localhost:11434
AI_MODEL_ANALYSIS=mistral-7b
AI_MODEL_STRATEGY=kullm-2
AI_MODEL_ALERT=phi-2
AI_ENABLED=true
```

```typescript
// src/lib/ai-factory.ts
export function createAIClient(): AIClient {
  const backend = process.env.AI_BACKEND || 'ollama';
  
  switch (backend) {
    case 'ollama':
      return new OllamaClient(process.env.AI_BASE_URL);
    case 'llamacpp':
      return new LlamaCppClient();
    case 'koboldcpp':
      return new KoboldCppClient();
    default:
      throw new Error(`Unknown AI backend: ${backend}`);
  }
}
```

### 2.6 구현 우선순위

1. **Phase 1 (기본 통합)**
   - Ollama 설치 및 기본 모델 다운로드
   - API 통합 코드 작성
   - 간단한 감성 분석 모델 교체

2. **Phase 2 (캐싱 및 최적화)**
   - SQLite 캐시 시스템 구축
   - Batch 추론 구현
   - Task 분리 (시세 분석, 전략 추천)

3. **Phase 3 (고급 기능)**
   - GPU 가속 (vLLM)
   - 실시간 추론 파이프라인
   - 모델 파인튜닝 (선택사항)

---

## 3. 자동 매매 전략 + AI CLI 연계

### 3.1 개요

기존 자동 매매 전략(DCA, MA, RSI, 볼린저밴드, 뉴스 기반)을 AI와 연계하여 더 지능적인 의사결정을 제공합니다.

### 3.2 전략 예시

#### 3.2.1 DCA (적립식) + AI 검증

**기본 DCA 전략**:
- 정기적으로 고정 금액 매수
- 시장 타이밍 고려 없음

**AI 개선**:
```typescript
async function executeDCAWithAI(strategy: DcaConfig) {
  // 1. 기본 DCA 실행
  const shouldBuy = await checkAIBuySignal(strategy.market);
  
  if (!shouldBuy) {
    console.log(`[${strategy.market}] AI가 매수 신호를 차단했습니다.`);
    return; // 이번 주기는 건너뛰기
  }
  
  // 2. 매수 금액 조정 (AI 추천)
  const recommendedAmount = await getAIRecommendedAmount(
    strategy.market,
    strategy.amount
  );
  
  // 3. 매수 실행
  buyAsset(strategy.market, currentPrice, recommendedAmount, strategy.id);
}
```

**AI 프롬프트 예시**:
```
프롬프트: DCA 매수 검증

현재 시장 상황:
- 코인: {market}
- 현재가: {price}
- 24h 변동률: {change_24h}%
- RSI: {rsi}
- 최근 뉴스 감성: {sentiment}

DCA 전략에 따라 {amount}원 매수를 계획 중입니다.
이 시점에 매수하는 것이 적절한가요?

답변 형식: JSON
{
  "should_buy": true/false,
  "reason": "이유",
  "recommended_amount": 원래금액의_퍼센트 (0-150),
  "confidence": 0-1
}
```

#### 3.2.2 이동평균선/RSI/볼린저 + AI 조합

**기존 전략**: 기술적 지표만으로 매매 결정

**AI 개선**: 여러 지표를 종합 분석하여 최적 타이밍 결정

```typescript
async function executeMAWithAI(strategy: MaConfig) {
  // 1. 기술적 지표 계산
  const maSignals = calculateMASignals(strategy);
  const rsi = calculateRSI(candles, 14);
  const bb = calculateBollingerBands(candles, 20, 2);
  
  // 2. AI 종합 분석
  const aiAnalysis = await analyzeWithAI({
    market: strategy.market,
    ma: {
      short: maSignals.shortMA,
      long: maSignals.longMA,
      cross: maSignals.goldenCross,
    },
    rsi: rsi[rsi.length - 1],
    bollinger: {
      upper: bb.upper[bb.upper.length - 1],
      lower: bb.lower[bb.lower.length - 1],
      current: currentPrice,
    },
    volume: currentVolume,
    news: recentNews,
  });
  
  // 3. AI 추천에 따른 매매 실행
  if (aiAnalysis.action === 'buy' && aiAnalysis.confidence > 0.7) {
    const amount = calculatePositionSize(aiAnalysis);
    buyAsset(strategy.market, currentPrice, amount, strategy.id);
  }
}
```

**AI 프롬프트 예시**:
```
프롬프트: 기술적 지표 종합 분석

코인: {market}
현재가: {price}

기술적 지표:
- 단기 이평선(5): {ma_short}
- 장기 이평선(20): {ma_long}
- 골든크로스 발생: {golden_cross}
- RSI: {rsi} (과매도: 30, 과매수: 70)
- 볼린저 밴드: 현재가 {price}, 상단 {bb_upper}, 하단 {bb_lower}
- 거래량: {volume} (24h 평균 대비 {volume_ratio}%)

뉴스 감성: {sentiment}

위 지표들을 종합하여 매매 결정을 내려주세요.

답변 형식: JSON
{
  "action": "buy" | "sell" | "hold",
  "confidence": 0-1,
  "reasoning": "각 지표의 해석과 종합 판단",
  "position_size_percent": 0-100,  // 보유 현금의 몇 % 사용
  "stop_loss": 가격,  // 손절매 가격
  "take_profit": 가격  // 익절매 가격
}
```

#### 3.2.3 뉴스 기반 단기 변동 포착 + AI 감성 분석

**기존 전략**: 키워드 기반 단순 감성 분석

**AI 개선**: 고급 감성 분석 및 맥락 이해

```typescript
async function executeNewsStrategyWithAI(strategy: NewsStrategyConfig) {
  // 1. 뉴스 가져오기
  const news = await fetchNews(strategy.market);
  
  // 2. AI 감성 분석
  const sentimentAnalysis = await analyzeNewsWithAI(news);
  
  // 3. 매매 결정
  if (sentimentAnalysis.action === 'buy' && sentimentAnalysis.confidence > 0.75) {
    // 긍정 뉴스 + 높은 신뢰도 → 매수
    buyAsset(strategy.market, currentPrice, amount, strategy.id);
  }
}
```

**AI 프롬프트 예시**:
```
프롬프트: 뉴스 감성 분석 및 매매 추천

코인: {market}
현재가: {price}

최근 뉴스:
{news_articles}

각 뉴스의 감성(긍정/부정/중립), 중요도(1-10), 시장 영향도(1-10)를 분석하고,
종합적으로 매매 결정을 내려주세요.

답변 형식: JSON
{
  "overall_sentiment": "positive" | "negative" | "neutral",
  "sentiment_score": -1 ~ 1,
  "news_analysis": [
    {
      "title": "뉴스 제목",
      "sentiment": "positive",
      "importance": 8,
      "market_impact": 7,
      "summary": "요약"
    }
  ],
  "action": "buy" | "sell" | "hold",
  "confidence": 0-1,
  "reasoning": "종합 판단 이유",
  "expected_impact": "단기/중기/장기",
  "recommended_action_timing": "즉시/1시간 후/관찰"
}
```

#### 3.2.4 변동성 돌파 전략

**전략 설명**:
- 전일 고가/저가 범위를 기준으로 변동성 돌파 시 매수
- AI가 돌파 강도를 평가하여 실행 여부 결정

```typescript
async function executeVolatilityBreakout(strategy: VolatilityConfig) {
  // 1. 전일 고가/저가 계산
  const yesterdayHigh = candles[1].high_price;
  const yesterdayLow = candles[1].low_price;
  const range = yesterdayHigh - yesterdayLow;
  const targetPrice = yesterdayHigh + (range * strategy.multiplier);
  
  // 2. 현재가가 목표가 돌파 여부 확인
  if (currentPrice > targetPrice) {
    // 3. AI가 돌파 강도 평가
    const aiAssessment = await assessBreakoutWithAI({
      market: strategy.market,
      currentPrice,
      targetPrice,
      range,
      volume: currentVolume,
      rsi: currentRSI,
    });
    
    if (aiAssessment.is_valid_breakout && aiAssessment.confidence > 0.7) {
      buyAsset(strategy.market, currentPrice, amount, strategy.id);
    }
  }
}
```

**AI 프롬프트 예시**:
```
프롬프트: 변동성 돌파 평가

코인: {market}
전일 고가: {yesterday_high}
전일 저가: {yesterday_low}
변동성 범위: {range}
목표 돌파가: {target_price}
현재가: {current_price}
돌파 여부: {is_breakout}

추가 지표:
- 거래량: {volume} (평균 대비 {volume_ratio}%)
- RSI: {rsi}
- 거래량 급증: {volume_spike}

이 돌파가 유효한 돌파(진짜 돌파)인지, 아니면 가짜 돌파(False Breakout)인지 판단해주세요.

답변 형식: JSON
{
  "is_valid_breakout": true/false,
  "confidence": 0-1,
  "breakout_strength": "weak" | "moderate" | "strong",
  "reasoning": "판단 이유",
  "recommended_action": "buy" | "wait" | "ignore",
  "stop_loss": 가격,
  "take_profit": 가격
}
```

#### 3.2.5 모멘텀 전략

**전략 설명**:
- 가격 모멘텀과 거래량 모멘텀을 결합
- AI가 모멘텀 지속 가능성 평가

```typescript
async function executeMomentumStrategy(strategy: MomentumConfig) {
  // 1. 모멘텀 지표 계산
  const priceMomentum = calculatePriceMomentum(candles, 10);
  const volumeMomentum = calculateVolumeMomentum(volumes, 10);
  const rsi = calculateRSI(candles, 14);
  
  // 2. AI 모멘텀 평가
  const aiMomentumAnalysis = await analyzeMomentumWithAI({
    market: strategy.market,
    priceMomentum,
    volumeMomentum,
    rsi,
    trend: currentTrend,
  });
  
  // 3. 매매 실행
  if (aiMomentumAnalysis.should_enter && aiMomentumAnalysis.confidence > 0.75) {
    buyAsset(strategy.market, currentPrice, amount, strategy.id);
  }
}
```

**AI 프롬프트 예시**:
```
프롬프트: 모멘텀 분석

코인: {market}
현재가: {price}

모멘텀 지표:
- 가격 모멘텀 (10일): {price_momentum}%
- 거래량 모멘텀 (10일): {volume_momentum}%
- RSI: {rsi}
- 추세: {trend} (상승/하락/횡보)
- 최근 뉴스: {recent_news_sentiment}

이 모멘텀이 지속될 가능성이 높은가요? 매수 진입 타이밍인가요?

답변 형식: JSON
{
  "momentum_strength": "weak" | "moderate" | "strong",
  "is_sustainable": true/false,
  "should_enter": true/false,
  "confidence": 0-1,
  "reasoning": "분석 이유",
  "entry_price": 권장_진입가,
  "stop_loss": 가격,
  "take_profit": 가격,
  "holding_period_estimate": "단기/중기/장기"
}
```

### 3.3 AI CLI 연계 프롬프트 예시 모음

#### 3.3.1 시세 분석 프롬프트

```bash
# CLI 사용 예시
ollama run mistral "코인: BTC, 현재가: 100만원, RSI: 25, 볼린저 하단 터치. 매수 적기인가요?"
```

**구조화된 프롬프트**:
```
시세 분석 요청:

코인: {market}
현재가: {price}
24h 변동률: {change_24h}%
거래량: {volume}
RSI: {rsi}
MACD: {macd_signal}
볼린저 밴드: {bollinger_position}
이평선: 단기 {ma_short}, 장기 {ma_long}

JSON 형식으로 분석 결과 반환:
{
  "trend": "상승/하락/횡보",
  "strength": 1-10,
  "recommendation": "매수/매도/보유",
  "confidence": 0-1,
  "key_levels": {
    "support": 가격,
    "resistance": 가격
  }
}
```

#### 3.3.2 전략 추천 프롬프트

```
전략 추천 요청:

사용자 프로필:
- 보유 현금: {cash}원
- 보유 코인: {assets}
- 리스크 선호도: {risk_tolerance} (보수/중립/공격)

시장 상황:
- 현재 시장 국면: {market_phase} (상승/하락/횡보)
- 변동성: {volatility} (낮음/보통/높음)
- 기술적 지표 요약: {technical_summary}

사용 가능한 전략:
1. DCA (적립식)
2. 이동평균선 교차
3. RSI
4. 볼린저 밴드
5. 뉴스 기반
6. 변동성 돌파
7. 모멘텀

위 조건에 맞는 최적의 전략을 1-3개 추천하고, 각 전략의 파라미터를 제안해주세요.

답변 형식: JSON
{
  "recommended_strategies": [
    {
      "strategy_type": "DCA",
      "parameters": {
        "amount": 10000,
        "interval": "daily"
      },
      "reasoning": "추천 이유",
      "expected_return": "보수적/중립/공격적",
      "risk_level": "low/medium/high"
    }
  ],
  "overall_advice": "종합 조언"
}
```

#### 3.3.3 거래 알림 프롬프트

```
거래 알림 요약:

거래 내역:
{transactions}

포트폴리오 현황:
- 총 자산: {total_value}원
- 현금: {cash}원
- 코인 가치: {crypto_value}원
- 손익: {profit_loss}원 ({profit_loss_percent}%)

사용자에게 보낼 알림 메시지를 작성해주세요.
- 50자 이내
- 친근한 톤
- 중요한 정보 포함

답변 형식:
{
  "message": "알림 메시지",
  "priority": "low/medium/high",
  "action_required": true/false
}
```

### 3.4 구현 예시 코드

```typescript
// src/lib/ai-strategy.ts
import { createAIClient } from './ai-factory';

export async function executeStrategyWithAI(
  strategy: Strategy,
  marketData: MarketData
): Promise<TradeDecision> {
  const aiClient = createAIClient();
  
  // 전략별 프롬프트 생성
  const prompt = generateStrategyPrompt(strategy, marketData);
  
  // AI 분석
  const aiResponse = await aiClient.generate(prompt);
  const analysis = JSON.parse(aiResponse);
  
  // 매매 결정
  if (analysis.action === 'buy' && analysis.confidence > 0.7) {
    return {
      action: 'buy',
      amount: calculateAmount(analysis.position_size_percent),
      stopLoss: analysis.stop_loss,
      takeProfit: analysis.take_profit,
    };
  } else if (analysis.action === 'sell' && analysis.confidence > 0.7) {
    return {
      action: 'sell',
      amount: calculateAmount(analysis.position_size_percent),
    };
  }
  
  return { action: 'hold' };
}

function generateStrategyPrompt(
  strategy: Strategy,
  marketData: MarketData
): string {
  switch (strategy.strategyType) {
    case 'dca':
      return generateDCAPrompt(strategy, marketData);
    case 'ma':
      return generateMAPrompt(strategy, marketData);
    case 'rsi':
      return generateRSIPrompt(strategy, marketData);
    // ... 기타 전략
    default:
      return generateGeneralPrompt(strategy, marketData);
  }
}
```

### 3.5 구현 우선순위

1. **Phase 1 (기본 AI 통합)**
   - AI 클라이언트 통합
   - DCA + AI 검증
   - 뉴스 감성 분석 AI 교체

2. **Phase 2 (전략별 AI 연계)**
   - MA/RSI/볼린저 + AI 종합 분석
   - 변동성 돌파 전략 구현
   - 모멘텀 전략 구현

3. **Phase 3 (고급 기능)**
   - AI 전략 추천 시스템
   - 자동 파라미터 최적화
   - 백테스팅 및 성과 분석

---

## 4. 결론 및 다음 단계

### 4.1 구현 로드맵 요약

1. **차트 고도화** (2-3주)
   - 고급 지표 추가 (EMA, MACD, ATR)
   - 거래 내역 시각화
   - 여러 코인 비교 기능

2. **로컬 AI 최적화** (3-4주)
   - Ollama 설치 및 통합
   - 로컬 캐싱 시스템
   - Task 분리 및 최적화

3. **AI 전략 연계** (2-3주)
   - 전략별 AI 프롬프트 구현
   - AI 검증 시스템
   - 실시간 의사결정 개선

### 4.2 참고 자료

- **TradingView Charting Library**: https://www.tradingview.com/charting-library/
- **Ollama**: https://ollama.com/
- **llama.cpp**: https://github.com/ggerganov/llama.cpp
- **vLLM**: https://github.com/vllm-project/vllm

### 4.3 주의사항

- AI 모델은 추론 결과의 정확성을 보장하지 않습니다. 실제 투자 결정에 사용하지 마세요.
- 로컬 AI 모델은 충분한 메모리(최소 8GB RAM, 권장 16GB+)가 필요합니다.
- GPU 가속을 사용하려면 NVIDIA GPU가 필요합니다.
- 모든 전략은 백테스팅을 통해 검증 후 사용하는 것을 권장합니다.

---

**작성일**: 2024년
**버전**: 1.0

