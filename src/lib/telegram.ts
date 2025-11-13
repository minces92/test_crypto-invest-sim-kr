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

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to send Telegram message:', errorData);
      return false;
    }
    
    console.log('Telegram message sent successfully.');
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}
