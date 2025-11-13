import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionId } = body || {};
    if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 });

    const cache = await import('@/lib/cache');
    const txs = cache.getTransactions();
    const tx = txs.find((t: any) => t.id === transactionId);
    if (!tx) return NextResponse.json({ error: 'transaction not found' }, { status: 404 });

    try {
      const telegram = await import('@/lib/telegram');
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const typeText = tx.type === 'buy' ? '📈 매수' : '📉 매도';
      const marketName = tx.market.replace('KRW-', '');
      const totalCost = (tx.price * tx.amount).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
      const message = `\n<b>🔔 신규 거래 알림 (재전송)</b>\n-------------------------\n<b>종류:</b> ${typeText}\n<b>종목:</b> ${marketName}\n<b>수량:</b> ${Number(tx.amount).toFixed(6)}\n<b>가격:</b> ${Number(tx.price).toLocaleString('ko-KR')} 원\n<b>총액:</b> ${totalCost} 원\n-------------------------\n<a href="${siteUrl}">사이트에서 확인하기</a>`;

      const sent = await telegram.sendMessage(message, 'HTML');
      cache.logNotificationAttempt({
        transactionId,
        sourceType: 'transaction',
        channel: 'telegram',
        payload: message,
        success: !!sent,
        responseCode: sent ? 200 : 0,
        responseBody: sent ? 'ok' : 'failed',
      });

      if (sent) cache.markTransactionNotified(transactionId);

      return NextResponse.json({ ok: true, sent });
    } catch (err) {
      console.error('Resend failed:', err);
      return NextResponse.json({ error: 'Resend failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Invalid body for resend:', error);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
