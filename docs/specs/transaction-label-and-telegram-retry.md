# Spec: Transaction Label Fix & Telegram Retry

## Summary

Two related fixes and improvements are implemented:

1. Transaction label fix
   - Problem: 매도 거래가 거래 내역에 `수동 구매`로 표시되는 버그.
   - Fix: UI 로직을 변경하여 `strategyType === 'manual'`일 때 거래 `type` (`buy`/`sell`)을 확인해 `수동 구매` 또는 `수동 판매`로 올바르게 표기합니다.
   - File changed: `src/components/TransactionHistory.tsx`

2. Telegram send reliability
   - Problem: Telegram 전송 실패 시 원인 파악이 어렵고 재시도 로직이 없음.
   - Fix: `src/lib/telegram.ts`에 재시도 로직(최대 3회, 지수 백오프)과 상세 로깅을 추가했습니다. HTTP 5xx 응답에 대해 재시도합니다.
   - File changed: `src/lib/telegram.ts`

---

## Transaction label: detailed spec

Inputs / Outputs
- Input: `tx` object used in `TransactionHistory` with fields: `{ type: 'buy' | 'sell', strategyType?: string }`
- Output: display label in `전략` column.

Contract
- If `tx.strategyType` is one of supported strategy ids (e.g., 'dca', 'ma', ...), show the human-friendly label.
- If `tx.strategyType === 'manual'`, show '수동 구매' when `tx.type === 'buy'` and '수동 판매' when `tx.type === 'sell'`.

Edge cases
- Missing `tx.type` or invalid value: treat as unknown and fall back to `tx.strategyType` raw string.
- Null/undefined `tx.strategyType`: show nothing.

Verification steps
1. Create a manual buy transaction (type=buy, strategyType='manual') and confirm the UI shows `수동 구매`.
2. Create a manual sell transaction (type=sell, strategyType='manual') and confirm the UI shows `수동 판매`.
3. Create auto strategy transactions and confirm labels match previous behavior.

---

## Telegram retry: detailed spec

Behavior
- Attempts up to 3 sends to Telegram API.
- On HTTP 5xx responses or network errors, retry with exponential backoff: delay = 2^attempt * 250ms.
- On non-retriable errors (4xx or body.ok === false), do not retry and log the body for debugging.
- Logs attempt number, HTTP status, response body, and any thrown errors.

Verification steps
1. With valid `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, call `/api/test-telegram` and confirm response `{"sent":true}` and server logs show `Telegram message sent successfully`.
2. With invalid chat id, call `/api/test-telegram/debug?chatId=<invalid>` and confirm Telegram API returns `ok:false` and logs show the 400 response body.
3. Simulate network or server 5xx error (use a proxy or mock) and confirm the send is retried up to 3 times.

---

## Files changed
- `src/components/TransactionHistory.tsx` — label logic fix
- `src/lib/telegram.ts` — retry and logging improvements
- `docs/specs/transaction-label-and-telegram-retry.md` — this spec file

## Commit & Push
- Commit message: `fix: correct manual transaction label; feat(telegram): add retry + logging`

---

If you want, I can also add unit tests for the label rendering and a small integration test for the telegram client (mocking fetch). Let me know if you'd like that added.
