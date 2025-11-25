import { NextResponse } from 'next/server';
import { getNewsWithCache } from '@/lib/cache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
  // include common English and Korean crypto-related keywords by default
  const query = searchParams.get('query') || 'cryptocurrency bitcoin ethereum 암호화폐 코인';
    const language = searchParams.get('language') || 'ko';
    const forceRefresh = searchParams.get('refresh') === 'true';

    // API 키 확인
    if (!process.env.NEWS_API_KEY) {
      // 키가 없으면 캐시된 데이터만 반환 시도 (캐시 로직 내부에서 처리됨)
      const articles = await getNewsWithCache(query, language, 1, forceRefresh);

      if (articles.length === 0) {
        // 캐시도 없으면 모의 데이터 반환 (사용자 경험을 위해)
        console.log('NEWS_API_KEY missing and no cache. Returning mock data.');
        return NextResponse.json([
          {
            title: '[Mock] 비트코인, 1억 원 돌파 가능성 주목',
            description: 'API 키가 설정되지 않아 표시되는 모의 뉴스입니다. 비트코인이 상승세를 보이고 있습니다.',
            url: '#',
            source: { name: 'CryptoSim News' },
            publishedAt: new Date().toISOString(),
            sentiment: 'positive'
          },
          {
            title: '[Mock] 이더리움 네트워크 업그레이드 예정',
            description: '이더리움 재단이 새로운 네트워크 업그레이드 일정을 발표했습니다.',
            url: '#',
            source: { name: 'CryptoSim News' },
            publishedAt: new Date().toISOString(),
            sentiment: 'neutral'
          },
          {
            title: '[Mock] 시장 변동성 주의보',
            description: '주요 거시경제 지표 발표를 앞두고 시장 변동성이 확대될 수 있습니다.',
            url: '#',
            source: { name: 'CryptoSim News' },
            publishedAt: new Date().toISOString(),
            sentiment: 'negative'
          }
        ]);
      }
      return NextResponse.json(articles);
    }

    // 캐시를 사용하여 데이터 가져오기 (1시간 캐시, 강제 갱신 옵션)
    const articles = await getNewsWithCache(query, language, 1, forceRefresh);

    console.log(`Fetched ${articles.length} news articles (forceRefresh: ${forceRefresh})`);

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching news:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch news.', details: errorMessage },
      { status: 500 }
    );
  }
}
