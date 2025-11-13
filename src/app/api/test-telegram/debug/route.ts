import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const overrideChatId = searchParams.get('chatId');
    const chatId = overrideChatId || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return NextResponse.json({ ok: false, error: 'chat id not provided' }, { status: 400 });

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: `Debug message from server: ${new Date().toISOString()}`,
      parse_mode: 'HTML',
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({ ok: false, error: 'invalid json from telegram' }));
    return NextResponse.json({ status: resp.status, telegram: data });
  } catch (e) {
    console.error('test-telegram-debug error:', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
