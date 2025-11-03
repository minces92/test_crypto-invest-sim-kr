import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');
    const count = searchParams.get('count') || '30'; // 기본값 30일

    if (!market) {
      return NextResponse.json({ error: 'Market parameter is required' }, { status: 400 });
    }

    // Upbit API는 UTC 기준이므로, KST와 다를 수 있음
    const response = await fetch(`https://api.upbit.com/v1/candles/days?market=${market}&count=${count}`);

    if (!response.ok) {
      throw new Error(`Upbit Candles API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching candle data from Upbit API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch candle data from Upbit API.', details: errorMessage },
      { status: 500 }
    );
  }
}
