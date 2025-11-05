# API Endpoint: `/api/analyze-trade`

## 1. 개요

완료된 거래에 대한 AI 기반 분석을 제공합니다. 현재는 플레이스홀더(Placeholder) 응답을 반환하며, 실제 LLM 연동이 필요합니다.

## 2. Endpoint

`POST /api/analyze-trade`

## 3. 요청

### Body

분석할 거래 정보(`transaction`)와 현재 시장 가격(`marketPrice`)을 JSON 객체로 전송합니다.

```json
{
  "transaction": {
    "id": "unique-tx-id-456",
    "market": "KRW-BTC",
    "type": "buy",
    "price": 50500000,
    "volume": 0.1,
    "timestamp": "2024-01-01T12:00:00Z"
  },
  "marketPrice": 51000000
}
```

## 4. 응답

### 성공 (Status 200)

거래에 대한 분석 텍스트를 포함한 JSON 객체를 반환합니다.

**참고:** 현재는 실제 분석이 아닌, 정해진 형식의 텍스트를 반환합니다.

```json
{
  "analysis": "이 매수 결정은 저가에 이루어졌습니다. 시장 상황을 고려할 때, 추가적인 분할 매수 또는 관망이 필요해 보입니다."
}
```

### 실패

요청 처리 중 오류 발생 시, Next.js 기본 오류 응답을 반환할 수 있습니다.
