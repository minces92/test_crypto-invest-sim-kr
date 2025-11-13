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

    const fetchPromises = marketChunks.map(chunk => 
      fetch(`https://api.upbit.com/v1/ticker?markets=${chunk.join(',')}`)
        .then(async (response) => {
          if (!response.ok) {
            // Upbit 에러 응답을 포함하여 더 자세한 에러를 던집니다.
            const errorBody = await response.json().catch(() => ({ message: 'Unknown Upbit error' }));
            throw new Error(`Upbit API request failed with status ${response.status}: ${errorBody.error?.message || 'No details'}`);
          }
          return response.json();
        })
    );

    const results = await Promise.all(fetchPromises);
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
