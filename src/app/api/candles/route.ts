import { NextResponse } from 'next/server';
import { getCandlesWithCache } from '@/lib/cache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');
    const count = parseInt(searchParams.get('count') || '90', 10);
    const interval = searchParams.get('interval') || 'day';

    if (!market) {
      return NextResponse.json({ error: 'Market parameter is required' }, { status: 400 });
    }

    // 캐시를 사용하여 데이터 가져오기
    const data = await getCandlesWithCache(market, count, interval, 1);
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching candle data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch candle data.', details: errorMessage },
      { status: 500 }
    );
  }
}
