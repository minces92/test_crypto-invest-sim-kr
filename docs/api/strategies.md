# API Endpoint: `/api/strategies`

## 1. 개요

자동 매매 전략을 관리(조회, 추가, 삭제)합니다. 전략 데이터는 서버의 `strategies.json` 파일에 저장됩니다.

---

## 2. `GET /api/strategies`

### 2.1. 설명

저장된 모든 자동 매매 전략 목록을 조회합니다.

### 2.2. 응답

#### 성공 (Status 200)

전략 객체 배열을 반환합니다.

```json
[
  {
    "id": "...",
    "name": "...",
    "market": "...",
    "condition": "...",
    "value": "...",
    "action": "...",
    "isActive": true
  }
]
```

#### 실패 (Status 500)

파일을 읽는 중 오류가 발생하면 다음을 반환합니다.

```json
{
  "error": "Failed to read strategies"
}
```

---

## 3. `POST /api/strategies`

### 3.1. 설명

새로운 자동 매매 전략을 추가합니다.

### 3.2. 요청

#### Body

새로운 전략 정보를 담은 JSON 객체를 전송합니다.

```json
{
  "id": "unique-id-123",
  "name": "BTC 5천만원 돌파 시 매수",
  "market": "KRW-BTC",
  "condition": "price_above",
  "value": "50000000",
  "action": "buy",
  "isActive": true
}
```

### 3.3. 응답

#### 성공 (Status 201)

성공적으로 추가된 전략 객체를 반환합니다.

```json
{
  "id": "unique-id-123",
  "name": "BTC 5천만원 돌파 시 매수",
  "market": "KRW-BTC",
  "condition": "price_above",
  "value": "50000000",
  "action": "buy",
  "isActive": true
}
```

#### 실패 (Status 500)

파일에 쓰는 중 오류가 발생하면 다음을 반환합니다.

```json
{
  "error": "Failed to write strategy"
}
```

---

## 4. `DELETE /api/strategies`

### 4.1. 설명

특정 ID를 가진 자동 매매 전략을 삭제합니다.

### 4.2. 요청

#### Body

삭제할 전략의 `id`를 포함한 JSON 객체를 전송합니다.

```json
{
  "id": "unique-id-123"
}
```

### 4.3. 응답

#### 성공 (Status 200)

삭제 성공 메시지를 반환합니다.

```json
{
  "message": "Strategy deleted"
}
```

#### 실패 (Status 500)

파일에 쓰는 중 오류가 발생하면 다음을 반환합니다.

```json
{
  "error": "Failed to delete strategy"
}
```
