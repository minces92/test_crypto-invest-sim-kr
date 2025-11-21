# API Endpoint: `/api/ai/analyze`

## 1. 개요

기술적 지표, 변동성·모멘텀 신호, 뉴스 감성 등 다양한 맥락을 AI(Ollama)에게 전달해 종합 매매 의견을 JSON으로 받는 엔드포인트입니다.  
전략 엔진(`PortfolioContext`)은 이 응답을 활용해 자동 매매를 필터링하거나 강화합니다.

## 2. Endpoint

`POST /api/ai/analyze`

## 3. 요청 스키마

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `market` | string | ✅ | 예: `KRW-BTC` |
| `currentPrice` | number | ✅ | 현재가 (KRW) |
| `change24h` | number | ✅ | 24시간 변동률(%) |
| `rsi` | number | ❌ | RSI 값 |
| `macd.signal` | string | ❌ | 예: `bullish`, `bearish` |
| `bollinger.position` | string | ❌ | `above`, `middle`, `below` |
| `bollinger.upper/lower/middle` | number | ❌ | 밴드 가격 |
| `ma` | object | ❌ | `short`, `long`, `cross`(golden/dead/none) |
| `volatility` | object | ❌ | 변동성 돌파 컨텍스트 (`range`, `targetPrice`, `isBreakout`) |
| `momentum` | object | ❌ | 모멘텀 컨텍스트 (`priceMomentum`, `volumeMomentum`, `isStrong`) |
| `sentiment` | object | ❌ | 뉴스/시장 심리 (`label`, `score`) |
| `volume` | object | ❌ | 거래량 (`current`, `average`, `ratio`) |

### 예시 요청

```json
{
  "market": "KRW-BTC",
  "currentPrice": 52300000,
  "change24h": 2.8,
  "rsi": 64.2,
  "bollinger": {
    "position": "above",
    "upper": 52800000,
    "lower": 48800000,
    "middle": 50800000
  },
  "ma": {
    "short": 52000000,
    "long": 50500000,
    "cross": "golden"
  },
  "volatility": {
    "range": 1100000,
    "targetPrice": 52100000,
    "isBreakout": true
  },
  "volume": {
    "current": 95000000000,
    "ratio": 145
  }
}
```

## 4. 응답

### 200 OK

```json
{
  "analysis": {
    "trend": "상승",
    "strength": 7,
    "recommendation": "매수",
    "confidence": 0.73,
    "key_levels": {
      "support": 50800000,
      "resistance": 53200000
    },
    "reasoning": "골든크로스와 거래량 동반 돌파가 확인되어 추세 지속 가능성이 높습니다.",
    "full_report": {
      "short_term_forecast": "...",
      "mid_term_forecast": "...",
      "long_term_forecast": "...",
      "recommended_strategy": "단기 변동성 매매"
    }
  },
  "rawResponse": "{... AI 원문 ...}"
}
```

- `analysis`는 `createPriceAnalysisPrompt`가 강제한 JSON 구조입니다.
- `rawResponse`는 파싱 전 모델 응답(디버깅용)입니다.

### 오류

| 상태 코드 | 원인 |
| --- | --- |
| 400 | `market`/`currentPrice`/`change24h` 누락 |
| 503 | Ollama 미기동 또는 AI 클라이언트 생성 실패 |
| 500 | 프롬프트 생성/응답 파싱 예외 |

## 5. 활용 팁

- 변동성 돌파/모멘텀 전략은 `volatility`, `momentum`, `volume` 필드를 반드시 채우면 판단 근거가 명확해집니다.
- 뉴스 기반 전략과 연계하려면 `sentiment.label = 'positive' | 'negative' | 'neutral'`를 전달하세요.
- 디버깅 시 `.env.local`에서 `AI_LOG_ENABLED=true`를 설정하면 `logs/ai-debug.log`에 프롬프트와 응답이 저장됩니다.

