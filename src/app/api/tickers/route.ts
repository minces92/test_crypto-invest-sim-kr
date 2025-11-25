import { NextResponse } from 'next/server';

// Helper function to split an array into chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunkedArr: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunkedArr.push(array.slice(i, i + size));
  }
  return chunkedArr;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const marketsParam = url.searchParams.get('markets');
    const defaultMarkets = 'KRW-BTC,KRW-ETH,KRW-XRP,KRW-DOGE';
    
    const finalMarkets = marketsParam ? marketsParam.split(',').filter(Boolean) : defaultMarkets.split(',');

    // Upbit API는 한 번에 최대 100개의 마켓을 조회할 수 있지만, URL 길이 제한 등을 고려하여 10개씩チャン크로 나눕니다.
    const marketChunks = chunkArray(finalMarkets, 10);

    // Helper: fetch with timeout and simple retries
    const fetchWithTimeoutAndRetries = async (url: string, timeoutMs = 5000, maxAttempts = 3) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) {
            const errorBody = await res.text().catch(() => '');
            throw new Error(`Upbit API status ${res.status}: ${errorBody}`);
          }
          const json = await res.json();
          return json;
        } catch (err) {
          if (attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 200;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw err;
        } finally {
          clearTimeout(id);
        }
      }
    };

    const results = await Promise.all(
      marketChunks.map(chunk => fetchWithTimeoutAndRetries(`https://api.upbit.com/v1/ticker?markets=${chunk.join(',')}`, 5000, 3))
    );
    const combinedData = results.flat(); // 모든 チャン크 결과를 하나의 배열로 합칩니다.

    return NextResponse.json(combinedData);

  } catch (error) {
    console.error('Error fetching from Upbit API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch data from Upbit API.', details: errorMessage },
      { status: 500 }
    );
  }
}
