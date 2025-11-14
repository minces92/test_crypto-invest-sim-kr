import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body || {};
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const cache = await import('@/lib/cache');
    const logs = cache.getNotificationLogs(1000);
    const entry = logs.find((l: any) => l.id === id);
    if (!entry) return NextResponse.json({ error: 'log entry not found' }, { status: 404 });

    try {
      const telegram = await import('@/lib/telegram');
      const sent = await telegram.sendMessage(entry.payload, 'HTML');

      cache.logNotificationAttempt({
        transactionId: entry.transactionId || null,
        sourceType: entry.sourceType,
        channel: entry.channel,
        payload: entry.payload,
        attemptNumber: (entry.attemptNumber ?? 1) + 1,
        success: !!sent,
        responseCode: sent ? 200 : 0,
        responseBody: sent ? 'ok' : 'failed',
      });

      if (sent && entry.transactionId) {
        cache.markTransactionNotified(entry.transactionId);
      }

      return NextResponse.json({ ok: true, sent });
    } catch (err) {
      console.error('Manual resend failed:', err);
      return NextResponse.json({ error: 'Resend failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Invalid body for manual resend:', error);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
