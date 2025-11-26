import { NextResponse } from 'next/server';
import { getCandlesWithCache, recordApiMetric } from '@/lib/cache';

export async function GET(request: Request) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');
    const count = parseInt(searchParams.get('count') || '90', 10);
    // Normalize interval: clients may send the literal string 'undefined' or empty values
    let intervalRaw = searchParams.get('interval');
    let interval = 'day';
    if (intervalRaw && intervalRaw !== 'undefined' && intervalRaw.trim() !== '') {
      interval = intervalRaw;
    }

    if (!market) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      recordApiMetric('GET /api/candles', responseTimeMs, false, 'Missing market parameter');
      return NextResponse.json({ error: 'Market parameter is required' }, { status: 400 });
    }

  // 캐시를 사용하여 데이터 가져오기
  console.log('[API] GET /api/candles', { market, count, interval });
  const data = await getCandlesWithCache(market, count, interval, 1);
  
  const responseTimeMs = Math.round(performance.now() - startTime);
  recordApiMetric('GET /api/candles', responseTimeMs);
  
    return NextResponse.json(data);

  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('GET /api/candles', responseTimeMs, false, String(error));
    
    console.error('Error fetching candle data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch candle data.', details: errorMessage },
      { status: 500 }
    );
  }
}
