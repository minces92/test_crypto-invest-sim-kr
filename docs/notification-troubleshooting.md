# Notification changes, fixes and how to verify

This document summarizes changes made on Nov 13, 2025 to improve Telegram notifications and fix repeated message resends. It also includes steps to verify locally and push the changes to the repository.

## Summary of fixes

1. Include automatic/manual and AI evaluation in transaction notification messages
   - The server now composes the Telegram message to include a field `자동/수동` and `전략`.
   - The server calls `/api/analyze-trade` when available and includes a short AI evaluation snippet (trimmed to ~300 chars) as `평가:` in the message.

2. Stop infinite resend loop
   - Root cause: the resend worker retried notifications based solely on `notification_log` rows where `success=0`. However, the initial notification attempt for transactions used an asynchronous background flow. If a notification was later recorded as success, duplicate rows or missing transaction notification flags could cause the resend worker to re-send repeatedly.
   - Fixes applied:
     - `saveTransaction` now correctly writes the transaction row (including `is_auto` and `strategy_type`) using consistent column ordering.
     - When a transaction notification is successfully sent, `markTransactionNotified(transactionId)` is called to set `notification_sent = 1` on the `transactions` row.
     - The resend worker now only re-sends rows from `notification_log` where `success = 0`. It logs a summary each run. The worker also sets `notification_sent` on the associated transaction when resend succeeds.
     - Important: ensure `notification_log` entries created for successful sends have `success = 1`. The code logs each attempt right after the send attempt.

3. Added a global-news strategy entry (`strategyType: "news", market: "ALL", sentimentThreshold: "both"`) that scans all KRW markets periodically and buys on positive news, sells on negative news.

## How to test (smoke test)

1. Ensure your `.env.local` contains valid Telegram credentials:

```powershell
# .env.local (project root)
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

2. Start the dev server:

```powershell
npm run dev
```

3. Verify strategy listing

- GET http://localhost:3000/api/strategies and confirm the `ALL` news strategy exists and isActive.

4. Create a manual transaction to trigger a transaction notification (or trigger a strategy buy)

- Use the UI to buy a small amount, or POST to `/api/transactions` with the transaction JSON.
- Watch server logs for `[telegram]` and `[notification]` entries. The message should include `자동/수동` and `평가:` (if AI analysis ran).

5. Confirm logs and DB state

- GET http://localhost:3000/api/notification-logs to inspect records. Successful attempts should have `success: true` and show `createdAtKst`.
   - Failed attempts will now include a `nextRetryAt` (ISO timestamp) which indicates when the worker will next attempt to resend the message. The UI (`NotificationLogs`) shows this as "다음 재시도" and disables manual retry until that time.
- Query the `transactions` table (e.g., open `crypto_cache.db` with a sqlite viewer) and check `notification_sent` for the transaction is 1.

### Quick API examples (curl)

Check notification logs (returns recent logs):

```bash
curl -sS http://localhost:3000/api/notification-logs | jq '.'
# Expected: JSON array. Each item contains `attemptNumber`, `messageHash`, `success`, and `createdAtKst`.
```

Test Telegram endpoint (requires env vars set):

```bash
# If TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in .env.local
curl -sS http://localhost:3000/api/test-telegram | jq '.'
# Expected: { "sent": true } on success, or a JSON error when credentials/chat-id invalid.

# Debug with custom chat id (reproduce 400 "chat not found")
curl -sS "http://localhost:3000/api/test-telegram/debug?chatId=123456789" | jq '.'
# Expected: Telegram API response with ok:false and a `description` field describing the error.
```

## If you still see duplicates

- Check server console for repeated `[telegram]` logs with the same payload. It means multiple notification triggers happened; check if client also sends messages directly (older code) — client should not call Telegram directly anymore.
- Check notification_log for multiple entries with the same payload and different timestamps. One failed attempt will be retried; successful attempt should stop resends.

## Retry/backoff policy (현재 구현)

- 재시도 대상: `notification_log` 테이블에서 `success = 0` 이고 `next_retry_at IS NULL` 또는 `next_retry_at <= 현재 시각` 인 항목만 처리됩니다.
- 최대 재시도 횟수: 5회 (초기 시도 포함하면 실제 시도 횟수는 최대 5번)
- 백오프: 기본 지연(base) 30초에 지수적으로 증가합니다. 예: 1회 실패 -> 30s, 2회 실패 -> 60s, 3회 실패 -> 120s ...
- `nextRetryAt`은 실패 시 계산되어 로그에 기록됩니다. 재시도 성공 시 해당 트랜잭션의 `notification_sent`이 1로 설정됩니다.

이 정책은 `src/lib/cache.ts`의 `resendFailedNotifications`와 `logNotificationAttempt`에서 구현되어 있습니다.

## Git push steps

Below commands will add, commit and push the changes to remote (assuming `origin` is configured and you have permission):

```powershell
git add -A
git commit -m "feat: include auto/manual and AI evaluation in Telegram notifications; fix resend loop; add global news strategy and docs"
git push origin HEAD
```

If you want, I can run those git commands from this environment for you.

---

If you want me to also:
- Add a manual "re-send" button in the NotificationLogs UI (for operators) — I can implement it.
- Add attempt counters and max-retries to the notification_log table — I can implement that too.
- Convert the resend worker to exponential backoff per notification rather than fixed-interval global sweep — I can propose a design and implement it.

Tell me which of the above you'd like next.