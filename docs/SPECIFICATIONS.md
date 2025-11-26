# Crypto Invest Sim KR - 스팩주도기반(BDD) 개발 명세서

**버전:** 1.0.0  
**최종 업데이트:** 2025-11-26  
**작성 방식:** Behavior-Driven Development (BDD) - Gherkin 스타일

---

## 📋 문서 개요

본 문서는 **Crypto Invest Sim KR** 프로젝트의 모든 기능을 스팩주도기반(Behavior-Driven Development, BDD) 방식으로 명세합니다. 각 Feature는 사용자 관점의 시나리오(Scenario)로 표현되며, Acceptance Criteria(수용 기준)를 포함합니다.

---

## 🎯 Feature 1: 실시간 시세 조회 (Real-time Price Tracking)

### Feature Description
암호화폐 거래소 API(Upbit)를 통해 주요 암호화폐의 실시간 시세를 원화(KRW)로 조회하고 주기적으로 갱신한다.

### Scenario 1.1: 사용자가 암호화폐 목록을 조회한다
```gherkin
Given 사용자가 Crypto Invest Sim 웹페이지에 접속했을 때
When CryptoTable 섹션이 로드된다
Then 주요 암호화폐(BTC, ETH, XRP 등)의 현재 시세가 KRW 단위로 표시되어야 한다
And 각 암호화폐의 24시간 변화율(%)이 색상과 함께 표시되어야 한다
And 시세는 5초마다 자동으로 갱신되어야 한다
```

### Scenario 1.2: 네트워크 오류 시 캐시 데이터 표시
```gherkin
Given Upbit API가 응답하지 않을 때
When 사용자가 페이지를 새로고침한다
Then 로컬 SQLite 캐시에서 마지막 조회한 시세를 표시해야 한다
And "캐시 데이터입니다 (시간)" 같은 안내 메시지를 표시해야 한다
And 시세는 갱신되지 않고 고정되어야 한다
```

### Acceptance Criteria
- ✅ 시세 데이터는 1시간 주기로 SQLite에 캐시된다
- ✅ API 요청 타임아웃은 기본값 7초로 설정된다
- ✅ 실패 시 최대 3회까지 재시도된다
- ✅ 변화율은 +는 빨강색, -는 파랑색으로 표시된다

---

## 🎯 Feature 2: 가상 거래 (Virtual Trading)

### Feature Description
사용자는 가상 자본으로 암호화폐를 매수/매도하며, 모든 거래는 시스템에 기록되고 포트폴리오에 반영된다.

### Scenario 2.1: 사용자가 암호화폐를 매수한다
```gherkin
Given 사용자의 계좌에 500,000원의 가용 자금이 있고
And BTC의 현재 시세가 50,000,000원일 때
When TradeModal에서 "매수" 버튼을 클릭하고
And 수량 0.01 BTC를 입력하고
And "주문 완료" 버튼을 클릭한다
Then 거래가 즉시 실행되어야 하고
And 포트폴리오에 "0.01 BTC" 입력되어야 하고
And 가용 자금이 "500,000 - 500,000 = 0원"으로 차감되어야 하고
And 거래 내역이 TransactionHistory에 기록되어야 한다
```

### Scenario 2.2: 가용 자금 부족 시 경고
```gherkin
Given 사용자의 가용 자금이 100,000원일 때
When BTC 0.1개(5,000,000원)를 매수하려 한다
Then 경고 메시지 "자금이 부족합니다"를 표시해야 하고
And 거래는 실행되지 않아야 한다
```

### Acceptance Criteria
- ✅ 거래 데이터는 SQLite transactions 테이블에 저장된다
- ✅ 매도 시 보유하지 않은 암호화폐 거래는 불가능하다
- ✅ 거래 수수료는 현재 0%이다 (향후 구성 가능)
- ✅ 거래는 ACID 트랜잭션으로 보호된다

---

## 🎯 Feature 3: 포트폴리오 관리 (Portfolio Management)

### Feature Description
사용자의 보유 자산, 평가 금액, 수익률을 한눈에 보여주는 대시보드를 제공한다.

### Scenario 3.1: 포트폴리오 현황 조회
```gherkin
Given 사용자가 BTC 0.5개(보유, 평균 매수가 30,000,000원)와
And ETH 10개(보유, 평균 매수가 2,000,000원)를 보유했을 때
And 현재 BTC 시세가 50,000,000원이고
And 현재 ETH 시세가 2,500,000원일 때
When Portfolio 섹션을 확인한다
Then BTC 평가 금액 = 0.5 × 50,000,000 = 25,000,000원 표시
And BTC 수익률 = (25,000,000 - 15,000,000) / 15,000,000 × 100 = 66.7% 표시
And 전체 자산 = 초기 자본 + 평가 수익 표시
And 수익률은 빨강색(양수) 또는 파랑색(음수)로 표시
```

### Scenario 3.2: 거래 후 포트폴리오 자동 갱신
```gherkin
Given 포트폴리오에 BTC 1개가 표시되어 있을 때
When 새로운 BTC 구매 거래가 완료된다
Then Portfolio는 자동으로 새로운 평균 매수가를 계산하고
And 수량이 업데이트되고
And 평가 금액과 수익률이 재계산되어야 한다
```

### Acceptance Criteria
- ✅ 평균 매수가는 (이전 총액 + 신규 총액) / (이전 수량 + 신규 수량)으로 계산
- ✅ 수익률 계산 시 현재 시세 반영
- ✅ 매도 시 선입선출(FIFO) 방식 적용 가능 (향후)

---

## 🎯 Feature 4: 차트 및 기술적 분석 (Charts & Technical Analysis)

### Feature Description
캔들 차트, 이동평균선(EMA), MACD, RSI, ATR 등 기술적 지표를 제공하여 사용자의 투자 의사결정을 지원한다.

### Scenario 4.1: 차트 로드 및 지표 표시
```gherkin
Given 사용자가 암호화폐(예: BTC)를 선택했을 때
When ChartComponent가 렌더링된다
Then 최근 200개의 일봉(day) 캔들이 표시되고
And EMA(12, 26)이 차트에 오버레이되고
And 차트 아래에 거래량(Volume) 차트가 표시되고
And 서브 차트에 RSI와 MACD가 표시되어야 한다
```

### Scenario 4.2: 사용자의 거래 내역이 차트에 마커로 표시
```gherkin
Given 차트가 로드되었을 때
When 사용자가 과거에 BTC를 매수/매도했을 때
Then 거래 날짜의 캔들에 녹색(매수) 또는 빨강색(매도) 마커가 표시되고
And 마커를 호버하면 거래 정보(수량, 가격, 시간)가 툴팁으로 표시되어야 한다
```

### Acceptance Criteria
- ✅ 캔들 데이터는 1시간 주기로 캐시된다
- ✅ EMA, MACD, RSI, ATR 계산은 Lightweight Charts 라이브러리 활용 또는 자체 구현
- ✅ 차트 로딩 시간은 2초 이내여야 한다

---

## 🎯 Feature 5: 자동 거래 (Auto-Trading)

### Feature Description
사용자가 정의한 거래 전략에 따라 시스템이 자동으로 매수/매도 주문을 실행한다.

### Scenario 5.1: 거래 전략 활성화
```gherkin
Given AutoTrader 컴포넌트에 추천 전략이 표시되어 있을 때
When 사용자가 "MAAlternate" 전략의 "활성화" 버튼을 클릭한다
Then 전략이 즉시 활성화되고
And 시스템은 5초마다 전략의 조건을 확인하기 시작하고
And 조건이 충족되면 자동으로 거래를 실행하고
And 거래 내역은 거래 이력에 "[Auto]" 라벨과 함께 기록되어야 한다
```

### Scenario 5.2: 자동 거래 중 전략 비활성화
```gherkin
Given "MAAlternate" 전략이 활성화되어 있을 때
When 사용자가 "비활성화" 버튼을 클릭한다
Then 진행 중인 거래는 완료되고
And 이후 새로운 신호는 무시되고
And 전략 상태가 "비활성화"로 변경되어야 한다
```

### Acceptance Criteria
- ✅ 추천 전략(MAAlternate, GridTrading 등) 포함
- ✅ 자동 거래 신호 로직은 서버에서 계산
- ✅ 전략별 매개변수(기간, 임계값 등) 사용자 지정 가능
- ✅ 백테스트 기능 제공

---

## 🎯 Feature 6: 암호화폐 뉴스 피드 (News Feed)

### Feature Description
암호화폐 관련 뉴스를 자동으로 수집하여 감정 분석(Sentiment Analysis)과 함께 표시한다. 주요 뉴스는 Telegram으로도 알림을 보낸다.

### Scenario 6.1: 뉴스 자동 갱신 및 감정 분석
```gherkin
Given 사용자가 NewsFeed 섹션을 보고 있을 때
When 페이지가 로드되고 15분 주기로 갱신될 때
Then NewsAPI에서 최신 암호화폐 뉴스를 조회하고
And 각 뉴스에 감정 분석(긍정/부정/중립)을 표시하고
And 호재(📢)와 악재(⚠️) 라벨을 붙이고
And 24시간 캐시된 데이터를 우선 표시해야 한다
```

### Scenario 6.2: 중요 뉴스 Telegram 알림
```gherkin
Given 감정 분석 결과가 '긍정' 또는 '부정'인 뉴스가 발견되었을 때
When 뉴스가 신규로 감지되었을 때
Then Telegram Bot을 통해 즉시 알림을 보내고
And 제목, 출처, 감정, 링크를 포함한 메시지 전송
And 알림 이력이 notification_log 테이블에 기록되고
And 실패 시 30초 × 2^(시도횟수-1) 초 후 지수 백오프로 재시도해야 한다
```

### Scenario 6.3: 사용자가 뉴스 갱신 주기를 변경한다
```gherkin
Given 햄버거 버튼(☰) 메뉴가 열려 있을 때
When "설정" 탭에서 "뉴스 갱신 주기"를 15분에서 30분으로 변경하고
And "저장" 버튼을 클릭한다
Then 설정이 localStorage에 저장되고
And 뉴스 컴포넌트가 새로운 갱신 주기(30분)를 적용하고
And "✓ 설정이 저장되었습니다" 메시지 표시
```

### Acceptance Criteria
- ✅ NewsAPI 키 설정 필수
- ✅ 기본 검색 키워드: "cryptocurrency bitcoin ethereum 암호화폐 코인"
- ✅ 언어 필터: ko (한국어)
- ✅ 중복 뉴스는 URL 기반 해시로 감지
- ✅ 감정 분석은 한국어 키워드 기반 (호재/악재)
- ✅ Telegram 알림 실패 시 최대 5회 재시도

---

## 🎯 Feature 7: 설정 및 알림 관리 (Settings & Notifications)

### Feature Description
사용자가 애플리케이션의 설정을 관리하고, 알림 이력을 확인하며, 실패한 알림을 재전송할 수 있다.

### Scenario 7.1: 설정 패널 열기
```gherkin
Given 사용자가 우측 상단의 햄버거 버튼(☰)을 클릭했을 때
When 패널이 열린다
Then "설정 및 알림" 헤더가 표시되고
And "알림 이력" 탭(기본) 선택 상태
And "설정" 탭이 별도로 표시되고
And 각 탭 간 전환 가능해야 한다
```

### Scenario 7.2: 알림 이력 조회
```gherkin
Given "알림 이력" 탭이 활성화되었을 때
When 페이지 로드 시 또는 "새로고침" 버튼 클릭 시
Then 최근 50개의 알림 기록이 표시되고
And 각 기록에 성공/실패, 채널, 시간, 재시도 정보 표시
And 실패한 알림은 "재전송" 또는 "강제 재전송" 버튼 제공
And 응답 본문 전체 보기 가능 ("전체" 버튼)
And 2초 타임아웃 후 결과 없으면 경고 메시지 표시
```

### Scenario 7.3: 설정 변경
```gherkin
Given "설정" 탭이 활성화되었을 때
When 사용자가 "뉴스 갱신 주기"를 입력 필드에서 변경한다
And "저장" 버튼을 클릭한다
Then 값이 localStorage에 저장되고
And 다른 컴포넌트에 CustomEvent 발송하여 실시간 적용
And 성공 메시지 표시 후 2.5초 후 자동 사라짐
```

### Acceptance Criteria
- ✅ 알림 패널은 UI 블로킹 없이 논블로킹으로 동작 (AbortController 사용)
- ✅ 타임아웃: 클라이언트 5초, 서버 2초
- ✅ 설정은 localStorage에 저장 (향후 서버 DB로 확장 가능)
- ✅ 사용자 권한 확인 (현재: 없음, 향후 추가 권장)

---

## 🎯 Feature 8: Ollama 로컬 AI 지원 (Local Ollama Support)

### Feature Description
로컬 Ollama 서버를 통해 거래 분석 및 추천을 제공한다 (선택적).

### Scenario 8.1: Ollama 연결 상태 확인
```gherkin
Given 사용자가 페이지에 접속했을 때
When 시스템이 Ollama 서버(기본: http://localhost:11434)에 연결 시도
Then Ollama 상태 컴포넌트(OllamaStatus)에 연결 상태 표시
And 연결 성공 시 "✓ Ollama 연결 성공" 표시
And 연결 실패 시 "✗ Ollama 연결 실패" 표시 및 설정 안내
```

### Scenario 8.2: 거래 분석 (Ollama 사용)
```gherkin
Given Ollama가 연결되어 있을 때
When 사용자가 거래를 완료한 후
And AI 분석 버튼을 클릭한다
Then 시스템이 해당 거래의 맥락을 Ollama 모델에 전송
And LLM이 분석 결과를 생성
And 분석 결과(시장 평가, 위험 평가 등)를 UI에 표시해야 한다
```

### Acceptance Criteria
- ✅ Ollama 연결 타임아웃: 3초
- ✅ 연결 불가 시 오류 표시 (UI 블로킹 없음)
- ✅ 분석은 비동기로 처리
- ✅ 환경 변수: `OLLAMA_BASE_URL` (기본값: http://localhost:11434)

---

## 📊 현재 구현 상태 (Current Implementation Status)

| Feature | 상태 | 비고 |
|---------|------|------|
| 1. 실시간 시세 조회 | ✅ 완료 | Upbit API, 1시간 캐시, 5초 갱신 |
| 2. 가상 거래 | ✅ 완료 | SQLite 저장, ACID 트랜잭션 |
| 3. 포트폴리오 관리 | ✅ 완료 | 평균 매수가, 수익률 계산 |
| 4. 차트 및 분석 | ✅ 완료 | EMA, MACD, RSI, ATR, 거래 마커 |
| 5. 자동 거래 | ✅ 완료 | 4가지 추천 전략, 백테스트 기능 |
| 6. 뉴스 피드 | ✅ 완료 | NewsAPI, 감정분석, Telegram 알림 |
| 7. 설정 및 알림 | ✅ 완료 | 알림 이력, 지수 백오프 재시도 |
| 8. Ollama 지원 | ✅ 완료 | 로컬 LLM 분석 (선택적) |

---

## 🔧 개선 및 수정이 필요한 사항 (Improvements & Fixes)

### 🐛 버그 및 성능 이슈

#### Issue 1: 뉴스 API 다중 키워드 검색 결과 부족
**문제:** 공백으로 구분된 여러 키워드(예: "cryptocurrency bitcoin ethereum 암호화폐 코인")를 NewsAPI에 전달할 때 검색 결과가 0개 반환될 수 있음

**근본 원인:** 
- NewsAPI가 모든 키워드를 AND 조건으로 처리하는 경우 결과 부족
- 혼합 언어(영어+한글) 쿼리에서 language=ko 필터와 충돌 가능

**개선안:**
```
현재: q="cryptocurrency bitcoin ethereum 암호화폐 코인"
개선: q=("cryptocurrency" OR "bitcoin" OR "ethereum" OR "암호화폐" OR "코인")
또는 별도 요청 후 합치기:
  - 요청1: q="cryptocurrency bitcoin ethereum", language=en
  - 요청2: q="암호화폐 코인", language=ko
  - 결과 통합 및 중복 제거
```

**상태:** ✅ 임시 해결 (OR 연산자 사용, language=ko 강제)  
**권장:** 더블 요청 방식 구현으로 향상

---

#### Issue 2: 알림 패널 API 호출 블로킹
**문제:** 햄버거 버튼 클릭 시 NotificationLogs 패널이 로드되면서 DB 쿼리가 동기식으로 실행되어 UI가 순간 반응성 저하

**근본 원인:** 
- `getNotificationLogs()`가 SQLite 동기 DB 호출
- API 라우트에서 대기 중 메인 스레드 블로킹

**개선안:**
```typescript
// 현재 (개선됨): 2초 타임아웃 wrapper + AbortController
// 권장: Worker Thread 또는 Worker Pool 활용
- DB 쿼리를 별도 Worker에서 실행
- 또는 async 래퍼 활용 (setImmediate)
```

**상태:** ✅ 해결 (2초 타임아웃 추가)  
**권장:** 프로덕션에서 Worker Pool 도입

---

#### Issue 3: 뉴스 갱신 주기 설정이 클라이언트에만 적용
**문제:** 사용자가 뉴스 갱신 주기를 변경해도 서버의 백그라운드 작업은 여전히 기본값(15분)으로 갱신

**근본 원인:** 
- 갱신 주기가 useNewsData 훅의 refreshInterval에만 적용
- 서버 측 캐시 갱신 주기는 하드코딩

**개선안:**
```typescript
// 현재 (예정): useNewsData 훅이 localStorage 감시
// 권장: 
1. 서버 DB에 사용자 설정 저장
2. news API 호출 시 쿼리 파라미터로 갱신 주기 지정
3. 또는 클라이언트가 설정 변경 시 서버 엔드포인트 호출
```

**상태:** ⚠️ 부분 해결 (클라이언트만 적용)  
**권장:** 서버 설정 동기화 필수

---

### ⚡ 성능 최적화

#### Optimization 1: 데이터베이스 인덱싱 부족
**현재 상태:** notification_log, transactions, news_cache 테이블에 기본 인덱스만 존재

**제안:**
```sql
-- news_cache 테이블에 query, language 인덱스 추가
CREATE INDEX idx_news_cache_query_lang ON news_cache(query, language);

-- notification_log에 message_hash, next_retry_at 인덱스
CREATE INDEX idx_notif_message_hash ON notification_log(message_hash);
CREATE INDEX idx_notif_retry_at ON notification_log(next_retry_at, success);

-- transactions에 timestamp, market 인덱스
CREATE INDEX idx_tx_timestamp_market ON transactions(timestamp, market);
```

**기대 효과:** 쿼리 속도 50~80% 향상

---

#### Optimization 2: API 요청 배치화 및 캐싱
**현재 상태:** 매 요청마다 개별 Upbit API 호출

**제안:**
```typescript
// 1. 여러 심볼 요청을 한 번에 배치화
GET /api/candles?markets=KRW-BTC,KRW-ETH,KRW-XRP

// 2. Redis 기반 분산 캐시 도입 (향후)
// 3. GraphQL 제공으로 필드 선택 최적화
```

**기대 효과:** API 호출 횟수 70% 감소, 응답 시간 개선

---

### 🎨 UX/UI 개선

#### UX 1: 거래 진행 중 상태 표시
**문제:** 거래 주문 클릭 후 로딩 상태가 명확하지 않음

**제안:**
```typescript
// TradeModal에 다음 상태 표시:
- "주문 대기 중..." (로딩)
- "체결됨" (성공)
- "오류: 자금 부족" (실패)
- 진행률 바 또는 스피너 표시
```

---

#### UX 2: 거래 내역 필터링 및 검색
**문제:** TransactionHistory에서 거래 내역이 많으면 찾기 어려움

**제안:**
```typescript
interface TransactionHistoryFilters {
  type: 'buy' | 'sell' | 'all';        // 매수/매도 필터
  market: string;                        // 암호화폐 선택
  source: 'manual' | 'auto' | 'all';    // 수동/자동 필터
  dateRange: [Date, Date];               // 기간 검색
  sortBy: 'date' | 'amount' | 'return'; // 정렬 옵션
}
```

---

#### UX 3: 반응형 차트 개선
**문제:** 모바일에서 차트가 너무 작음

**제안:**
```css
/* 모바일 전용 차트 레이아웃 */
@media (max-width: 768px) {
  .chart-container {
    height: 400px; /* 데스크톱보다 비율 조정 */
  }
  .chart-legend {
    display: none; /* 범례 숨김 */
  }
}
```

---

### 🆕 새로운 기능 제안 (Proposed Features)

#### Feature A: 포트폴리오 스냅샷 및 성과 분석
```gherkin
Feature: 포트폴리오 성과 분석

Scenario: 사용자가 일별 포트폴리오 가치 변화를 조회한다
Given 사용자가 "분석" 탭을 클릭했을 때
When 시스템이 매일 자정 기준으로 포트폴리오 스냅샷을 저장했을 때
Then 지난 30일간의 포트폴이 가치 변화 그래프 표시
And 일일 수익률, 누적 수익률, MDD(최대 낙폭) 표시
And 각 암호화폐의 기여도 파이 차트 표시
And CSV 다운로드 기능 제공
```

**구현:**
- DB: portfolio_snapshots 테이블 추가 (daily 스케줄)
- API: GET /api/portfolio/snapshots?days=30
- Component: PortfolioAnalytics.tsx

---

#### Feature B: 사용자 정의 거래 전략 생성기
```gherkin
Feature: 커스텀 거래 전략 생성

Scenario: 사용자가 자신만의 거래 전략을 만든다
Given AutoTrader의 "커스텀 전략" 섹션에서
When 다음을 설정한다:
  - 지표: EMA, MACD, RSI 선택
  - 매수 조건: "EMA12 > EMA26 AND RSI < 30"
  - 매도 조건: "RSI > 70"
  - 거래량: 10%
Then 전략이 "내 전략"에 저장되고
And 해당 전략으로 백테스트 가능
And 전략을 활성화하면 자동 거래 시작
```

**구현:**
- DB: custom_strategies 테이블
- Parser: 조건 문자열을 JavaScript 함수로 변환
- Component: StrategyBuilder.tsx

---

#### Feature C: 거래 일지 및 학습 노트
```gherkin
Feature: 거래 일지 기록

Scenario: 사용자가 거래 일지를 작성한다
Given 거래 후 "일지 작성" 버튼 클릭
When 다음을 입력한다:
  - 거래 근거 (차트 신호, 뉴스 등)
  - 예상 수익률
  - 실제 수익률 (체결 후)
Then 거래와 함께 일지가 저장되고
And 나중에 통계 분석: "근거별 승률", "예상 vs 실제" 비교 가능
```

**구현:**
- DB: trade_journals 테이블
- API: POST/GET /api/trade-journals/:transactionId
- Component: TradeJournalModal.tsx

---

#### Feature D: 포트폴리오 공유 및 벤치마킹
```gherkin
Feature: 포트폴이 공유 링크 생성

Scenario: 사용자가 자신의 성과를 공유한다
Given Portfolio 섹션에서 "공유" 버튼 클릭
When 비공개 공유 링크 생성 (예: /portfolio/abc123def456)
Then 링크를 받는 사람이:
  - 포트폴리오 구성 확인 가능
  - 수익률, 거래 이력 확인 가능
  - 실명 및 거래 세부사항 비공개
  - 참고 및 전략 벤치마킹 가능
```

**구현:**
- DB: portfolio_shares 테이블 (share_id, user_id, token, expiry)
- API: POST /api/portfolio/share, GET /api/portfolio/share/:token
- Component: PortfolioShareModal.tsx, PublicPortfolioView.tsx

---

#### Feature E: 알림 채널 확장 (이메일, Slack, Discord)
```gherkin
Feature: 다중 알림 채널

Scenario: 사용자가 알림 채널을 설정한다
Given 설정 > 알림 채널 섹션
When 다음 채널 활성화:
  - Telegram (기존)
  - Email (새로움)
  - Slack (새로움)
  - Discord (새로움)
Then 각 채널별로 알림 필터 설정 가능
And 주요 거래/뉴스는 모든 채널로 전송
And 일반 알림은 선택한 채널로만 전송
```

**구현:**
- DB: notification_channels 테이블
- Service: slack-service.ts, email-service.ts, discord-service.ts
- API: POST /api/notification-channels/test (테스트 메시지 전송)

---

#### Feature F: 백테스트 고급 기능
```gherkin
Feature: 백테스트 고급 분석

Scenario: 사용자가 백테스트 결과를 상세 분석한다
Given 백테스트 완료 후
When "상세 분석" 버튼 클릭
Then 다음 지표 표시:
  - Sharpe Ratio (샤프 지수)
  - Sortino Ratio
  - Max Drawdown (최대 낙폭)
  - Win Rate (승률)
  - Profit Factor (수익 비율)
  - 월별/분기별 수익률 분해
  - 리스크 히트맵
And Monte Carlo 시뮬레이션 결과
And Parameter Optimization (매개변수 최적화) 수행 가능
```

**구현:**
- Library: ta-lib, backtrader 포팅 또는 자체 계산
- Component: BacktestDetailedAnalysis.tsx

---

#### Feature G: 계층화된 권한 및 멀티 포트폴리오
```gherkin
Feature: 멀티 포트폴이

Scenario: 사용자가 여러 포트폴리오를 관리한다
Given 사용자 계정이 있을 때
When 사용자가 "새 포트폴리오" 버튼 클릭
And "공격적 전략", "보수적 전략" 등 만든다
Then 각 포트폴리오별:
  - 독립적인 초기 자본 설정
  - 거래 내역 분리 저장
  - 성과 비교 분석 가능
  - 다른 사용자와 협력 가능 (권한 설정)
```

**구현:**
- DB: portfolios 테이블 (user_id, name, initial_capital)
- 권한 체계: owner, collaborator, viewer
- Component: PortfolioSelector, MultiPortfolioComparison.tsx

---

#### Feature H: AI 기반 거래 추천
```gherkin
Feature: AI 거래 추천

Scenario: AI가 사용자에게 거래 추천을 한다
Given 사용자의 거래 이력 및 포트폴리오 상태
When Ollama LLM이 시장 데이터 분석
Then 다음을 추천:
  - "BTC는 RSI 과매도, 매수 기회"
  - "ETH는 역삼각형 패턴, 주의"
  - 추천 진입가, 손절가, 익절가 제시
And 추천 신뢰도(%) 표시
And 사용자는 "수용", "거부", "수정" 가능
```

**구현:**
- LLM Prompt: 시장 데이터 + 기술적 지표 분석
- API: POST /api/ai/recommend
- Component: AIRecommendation.tsx

---

## 📋 체크리스트: 배포 전 필수 확인사항

- [ ] 모든 환경 변수 (.env.local) 설정 확인
  - `NEWS_API_KEY`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - `OLLAMA_BASE_URL`
  - `SITE_URL`
  
- [ ] 데이터베이스 마이그레이션 실행
  ```bash
  npm run migrate:notification-log
  npm run migrate:notification-jobs
  ```

- [ ] 프로덕션 빌드 테스트
  ```bash
  npm run build
  npm start
  ```

- [ ] 단위 테스트 및 통합 테스트 실행
  ```bash
  npm test
  ```

- [ ] 보안 점검
  - API 엔드포인트 인증/인가 확인
  - 민감한 정보(토큰) 노출 확인
  - CORS 정책 검토

- [ ] 성능 프로파일링
  - 차트 렌더링 시간 < 2초
  - API 응답 시간 < 1초
  - 초기 로드 시간 < 3초

- [ ] 다양한 브라우저 및 기기에서 테스트
  - Chrome, Firefox, Safari
  - 모바일 (iOS, Android)
  - 태블릿

---

## 📞 연락처 및 피드백

프로젝트에 대한 질문이나 개선 제안이 있으면 GitHub Issues 또는 PR로 연락 주시기 바랍니다.

---

**문서 버전 히스토리**
- v1.0.0 (2025-11-26): 초기 BDD 스펙 작성, 현재 기능 명세, 개선사항 및 새로운 기능 제안

