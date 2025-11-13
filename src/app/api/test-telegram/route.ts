import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/telegram';

export async function GET() {
  try {
    const message = `테스트 메시지: 서버에서 보낸 Telegram 확인용 메시지 ✅`;
    const ok = await sendMessage(message, 'HTML');
    return NextResponse.json({ sent: ok });
  } catch (e) {
    console.error('test-telegram error:', e);
    return NextResponse.json({ sent: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
