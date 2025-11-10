import { NextResponse } from 'next/server';
import { getNewsWithCache } from '@/lib/cache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'cryptocurrency bitcoin ethereum';
    const language = searchParams.get('language') || 'ko';
    const forceRefresh = searchParams.get('refresh') === 'true';

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
