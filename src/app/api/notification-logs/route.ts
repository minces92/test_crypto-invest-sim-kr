import { NextResponse } from 'next/server';
import { getNotificationLogs, recordApiMetric } from '@/lib/cache';

// Helper to wrap sync DB call with timeout to prevent blocking
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<{ result: T | null; timedOut: boolean }> {
  const timeout = new Promise<{ result: T | null; timedOut: boolean }>((resolve) => {
    const t = setTimeout(() => resolve({ result: null, timedOut: true }), timeoutMs);
  });
  try {
    const result = await Promise.race([fn(), timeout]) as { result: T | null; timedOut: boolean } | T;
    // If result is the 'timeout' object, return it; otherwise return the result
    if ((result as any)?.timedOut) return result as any;
    return { result: result as T, timedOut: false };
  } catch (err) {
    console.error('DB query error:', err);
    return { result: null, timedOut: false };
  }
}

export async function GET(request: Request) {
  const startTime = performance.now();
  
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : 100;
    
    // Attempt to fetch logs with a 2-second timeout to prevent UI freeze
    const { result: logs, timedOut } = await withTimeout(() => getNotificationLogs(limit), 2000);
    
    const responseTimeMs = Math.round(performance.now() - startTime);
    
    // Issue #3: 타임아웃 모니터링 (1.5초 기준)
    recordApiMetric('GET /api/notification-logs', responseTimeMs, timedOut);
    
    if (timedOut) {
      console.warn('Notification logs query timed out after 2s; returning empty logs');
      return NextResponse.json({ logs: [], warning: 'Database query timed out; no logs available' });
    }
    
    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('GET /api/notification-logs', responseTimeMs, false, String(error));
    
    console.error('Error reading notification logs:', error);
    return NextResponse.json({ logs: [], error: 'Failed to read notification logs' }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const startTime = performance.now();
  
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
        await cache.logNotificationAttempt({
          transactionId,
          sourceType,
          channel,
          payload: String(payload).slice(0, 2000),
          attemptNumber: body.attemptNumber && Number(body.attemptNumber) > 0 ? Number(body.attemptNumber) : 1,
          success: !!success,
          responseCode: responseCode === null ? null : Number(responseCode),
          responseBody: responseBody ? String(responseBody).slice(0, 2000) : null,
        });

      // If this log indicates a successful notification for a specific transaction, mark it
      if (transactionId && success) {
        try {
          const { markTransactionNotified } = await import('@/lib/cache');
          await markTransactionNotified(transactionId);
        } catch (markErr) {
          console.error('Failed to mark transaction notification_sent:', markErr);
        }
      }
    } catch (err) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      recordApiMetric('POST /api/notification-logs', responseTimeMs, false, String(err));
      
      console.error('Failed to write notification log:', err);
      return NextResponse.json({ error: 'Failed to write notification log' }, { status: 500 });
    }

    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('POST /api/notification-logs', responseTimeMs);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('POST /api/notification-logs', responseTimeMs, false, String(error));
    
    console.error('Invalid notification log body:', error);
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
