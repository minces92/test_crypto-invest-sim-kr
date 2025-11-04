import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const markets = url.searchParams.get('markets');
    const defaultMarkets = 'KRW-BTC,KRW-ETH,KRW-XRP,KRW-DOGE';
    const finalMarkets = markets || defaultMarkets;
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${finalMarkets}`);

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
