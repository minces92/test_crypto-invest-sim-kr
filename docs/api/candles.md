# API Endpoint: `/api/candles`

## 1. 개요

Upbit API를 사용하여 지정된 암호화폐 시장의 일봉 데이터를 조회합니다.

## 2. Endpoint

`GET /api/candles`

## 3. 요청

### Query Parameters

| 파라미터 | 타입   | 필수 | 설명                                      | 기본값 |
| -------- | ------ | ---- | ----------------------------------------- | ------ |
| `market` | string | 예   | 마켓 코드 (예: `KRW-BTC`)                 |        |
| `count`  | string | 아니오 | 조회할 캔들 수 (일)                     | `30`   |

## 4. 응답

### 성공 (Status 200)

Upbit API의 응답을 그대로 반환합니다. 배열 형태의 JSON 객체이며, 각 객체는 다음 정보를 포함합니다.

```json
[
  {
    "market": "KRW-BTC",
    "candle_date_time_utc": "2024-01-01T00:00:00",
    "candle_date_time_kst": "2024-01-01T09:00:00",
    "opening_price": 50000000,
    "high_price": 51000000,
    "low_price": 49000000,
    "trade_price": 50500000,
    "timestamp": 1672531200000,
    "candle_acc_trade_price": 5050000000,
    "candle_acc_trade_volume": 100,
    "prev_closing_price": 50000000,
    "change_price": 500000,
    "change_rate": 0.01
  }
]
```

### 실패

#### Status 400 (Bad Request)

`market` 파라미터가 누락되었을 경우 발생합니다.

```json
{
  "error": "Market parameter is required"
}
```

#### Status 500 (Internal Server Error)

Upbit API 연동 중 오류가 발생했을 경우, 다음과 같은 JSON 객체를 반환합니다.

```json
{
  "error": "Failed to fetch candle data from Upbit API.",
  "details": "..."
}
```
