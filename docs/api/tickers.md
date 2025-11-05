# API Endpoint: `/api/tickers`

## 1. 개요

Upbit API를 사용하여 지정된 암호화폐 시장의 현재가 정보를 조회합니다.

## 2. Endpoint

`GET /api/tickers`

## 3. 요청

### Query Parameters

| 파라미터 | 타입   | 필수 | 설명                                                                 | 기본값                               |
| -------- | ------ | ---- | -------------------------------------------------------------------- | ------------------------------------ |
| `markets`  | string | 아니오 | 쉼표(,)로 구분된 마켓 코드 목록 (예: `KRW-BTC,KRW-ETH`) | `KRW-BTC,KRW-ETH,KRW-XRP,KRW-DOGE` |

## 4. 응답

### 성공 (Status 200)

Upbit API의 응답을 그대로 반환합니다. 배열 형태의 JSON 객체이며, 각 객체는 다음 정보를 포함합니다.

```json
[
  {
    "market": "KRW-BTC",
    "trade_date": "20240101",
    "trade_time": "120000",
    "trade_timestamp": 1672545600000,
    "opening_price": 50000000,
    "high_price": 51000000,
    "low_price": 49000000,
    "trade_price": 50500000,
    "prev_closing_price": 50000000,
    "change": "RISE",
    "change_price": 500000,
    "change_rate": 0.01,
    "signed_change_price": 500000,
    "signed_change_rate": 0.01,
    "trade_volume": 100,
    "acc_trade_price": 5050000000,
    "acc_trade_price_24h": 10100000000,
    "acc_trade_volume": 200,
    "acc_trade_volume_24h": 400,
    "highest_52_week_price": 60000000,
    "highest_52_week_date": "2023-12-01",
    "lowest_52_week_price": 30000000,
    "lowest_52_week_date": "2023-03-01",
    "timestamp": 1672545600000
  }
]
```

### 실패 (Status 500)

Upbit API 연동 중 오류가 발생했을 경우, 다음과 같은 JSON 객체를 반환합니다.

```json
{
  "error": "Failed to fetch data from Upbit API.",
  "details": "..."
}
```
