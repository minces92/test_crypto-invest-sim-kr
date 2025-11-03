import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // KRW 마켓의 주요 코인 목록
    const markets = 'KRW-BTC,KRW-ETH,KRW-XRP,KRW-DOGE,KRW-SOL,KRW-ADA,KRW-AVAX,KRW-DOT,KRW-MATIC,KRW-TRX,KRW-SHIB,KRW-ETC,KRW-BCH,KRW-LINK';
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`);

    if (!response.ok) {
      throw new Error(`Upbit API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching from Upbit API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch data from Upbit API.', details: errorMessage },
      { status: 500 }
    );
  }
}
