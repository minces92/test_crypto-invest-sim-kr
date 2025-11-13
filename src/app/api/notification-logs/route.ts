import { NextResponse } from 'next/server';
import { getNotificationLogs } from '@/lib/cache';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : 100;
    const logs = getNotificationLogs(limit);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error reading notification logs:', error);
    return NextResponse.json({ error: 'Failed to read notification logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // validate minimal fields
    const {
      transactionId = null,
      sourceType = 'unknown',
      channel = 'unknown',
      payload = '',
      success = false,
      responseCode = null,
      responseBody = null,
    } = body || {};

    // server-side DB write
    try {
      const cache = await import('@/lib/cache');
      cache.logNotificationAttempt({
        transactionId,
        sourceType,
        channel,
        payload: String(payload).slice(0, 2000),
        success: !!success,
        responseCode: responseCode === null ? null : Number(responseCode),
        responseBody: responseBody ? String(responseBody).slice(0, 2000) : null,
      });

      // If this log indicates a successful notification for a specific transaction, mark it
      if (transactionId && success) {
        try {
          const { markTransactionNotified } = await import('@/lib/cache');
          markTransactionNotified(transactionId);
        } catch (markErr) {
          console.error('Failed to mark transaction notification_sent:', markErr);
        }
      }
    } catch (err) {
      console.error('Failed to write notification log:', err);
      return NextResponse.json({ error: 'Failed to write notification log' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('Invalid notification log body:', error);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
