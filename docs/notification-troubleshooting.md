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
- Query the `transactions` table (e.g., open `crypto_cache.db` with a sqlite viewer) and check `notification_sent` for the transaction is 1.

## If you still see duplicates

- Check server console for repeated `[telegram]` logs with the same payload. It means multiple notification triggers happened; check if client also sends messages directly (older code) — client should not call Telegram directly anymore.
- Check notification_log for multiple entries with the same payload and different timestamps. One failed attempt will be retried; successful attempt should stop resends.

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