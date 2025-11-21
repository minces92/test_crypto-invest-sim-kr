# API Endpoint: `/api/analyze-trade`

## 1. 개요

완료된 거래에 대해 **실제 Ollama LLM**을 호출하여 한국어 요약/평가를 생성합니다.  
최근 분석 결과는 SQLite 캐시에 저장되며, 동일 거래 ID로 재요청 시 즉시 캐시 결과를 반환합니다.

## 2. Endpoint

`POST /api/analyze-trade`

## 3. 요청 본문

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `transaction.id` | string | ✅ | 거래 고유 ID (캐시 키로 사용) |
| `transaction.market` | string | ✅ | 예: `KRW-BTC` |
| `transaction.type` | `'buy' \| 'sell'` | ✅ | 매수/매도 |
| `transaction.price` | number | ✅ | 체결가 (KRW) |
| `transaction.amount` | number | ✅ | 체결 수량 |
| `transaction.timestamp` | string | ✅ | ISO8601 |
| `marketPrice` | number | ❌ | 비교용 현재가 (없으면 동일가로 간주) |

```json
{
  "transaction": {
    "id": "unique-tx-id-456",
    "market": "KRW-BTC",
    "type": "buy",
    "price": 50500000,
    "amount": 0.1,
    "timestamp": "2025-11-20T10:00:00Z"
  },
  "marketPrice": 51000000
}
```

## 4. 응답

### 200 OK

```json
{
  "analysis": "이 매수는 현재가 대비 0.98% 낮게 체결되어 나쁘지 않습니다. 단기 변동성이 높으므로 분할 매수로 리스크를 관리하는 편이 안전합니다.",
  "cached": false
}
```

- `cached: true` 이면 동일 거래에 대한 과거 분석을 재사용했다는 의미입니다.

### 오류 응답

| 상태 코드 | 원인 |
| --- | --- |
| 400 | 필수 필드 누락 또는 데이터 형식 오류 |
| 503 | Ollama 미기동 또는 AI 백엔드 미선택 |
| 500 | 예외 처리 실패 (서버 로그 확인) |

## 5. 동작 흐름

1. 요청 유효성 검증 (`transaction.id/market/price/type` 필수)
2. `getOrSaveTransactionAnalysis`를 통해 SQLite 캐시 확인
3. 캐시 미존재 시 `createAIClient()` → Ollama `generate` 호출
4. 응답 텍스트 정제 후 캐시에 저장
5. 실패 시 한국어 폴백 메시지를 생성하여 반환

## 6. 필요한 환경 변수

`.env.local`

```
AI_BACKEND=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL_ANALYSIS=mistral
```

> `AI_MODEL_ANALYSIS`는 원하는 Ollama 모델 이름으로 교체 가능합니다 (예: `gemma3:4b`).
