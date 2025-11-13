/**
 * Telegram Bot Client
 */

export async function sendMessage(text: string, parse_mode: 'HTML' | 'MarkdownV2' = 'HTML'): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram Bot Token or Chat ID is not configured. Skipping message.');
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode,
          disable_web_page_preview: false,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(`[telegram]\tattempt:${attempt}\tstatus:${response.status}\tchat:${chatId}\tok:false\tbody:${JSON.stringify(body)}`);
        // Retry for 5xx or transient network errors
        if (response.status >= 500 && attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 250;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return false;
      }

      if (!body || body.ok !== true) {
        console.error(`[telegram]\tattempt:${attempt}\tchat:${chatId}\tok:false\tbody:${JSON.stringify(body)}`);
        return false;
      }

      console.log(`[telegram]\tattempt:${attempt}\tchat:${chatId}\tok:true\tmessage_id:${body.result?.message_id}`);
      return true;
    } catch (error) {
      console.error(`[telegram]\tattempt:${attempt}\terror:${error instanceof Error ? error.message : String(error)}`);
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 250;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return false;
    }
  }

  return false;
}
