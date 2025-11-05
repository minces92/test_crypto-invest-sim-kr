# API Endpoint: `/api/transactions`

## 1. 개요

거래 내역을 관리(조회, 추가)합니다. 거래 내역 데이터는 서버의 `transactions.json` 파일에 저장됩니다.

---

## 2. `GET /api/transactions`

### 2.1. 설명

저장된 모든 거래 내역 목록을 조회합니다.

### 2.2. 응답

#### 성공 (Status 200)

거래 내역 객체 배열을 반환합니다. 최신 거래가 배열의 맨 앞에 위치합니다.

```json
[
  {
    "id": "...",
    "market": "KRW-BTC",
    "type": "buy", // or "sell"
    "price": 50500000,
    "volume": 0.1,
    "timestamp": "..."
  }
]
```

#### 실패 (Status 500)

파일을 읽는 중 오류가 발생하면 다음을 반환합니다.

```json
{
  "error": "Failed to read transactions"
}
```

---

## 3. `POST /api/transactions`

### 3.1. 설명

새로운 거래 내역을 추가합니다. 데이터는 배열의 맨 앞에 추가됩니다.

### 3.2. 요청

#### Body

새로운 거래 내역 정보를 담은 JSON 객체를 전송합니다.

```json
{
  "id": "unique-tx-id-456",
  "market": "KRW-BTC",
  "type": "buy",
  "price": 50500000,
  "volume": 0.1,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.3. 응답

#### 성공 (Status 201)

성공적으로 추가된 거래 내역 객체를 반환합니다.

```json
{
  "id": "unique-tx-id-456",
  "market": "KRW-BTC",
  "type": "buy",
  "price": 50500000,
  "volume": 0.1,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 실패 (Status 500)

파일에 쓰는 중 오류가 발생하면 다음을 반환합니다.

```json
{
  "error": "Failed to write transaction"
}
```
