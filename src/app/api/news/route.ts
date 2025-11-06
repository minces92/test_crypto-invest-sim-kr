import { NextResponse } from 'next/server';
import { getNewsWithCache } from '@/lib/cache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'cryptocurrency';
    const language = searchParams.get('language') || 'ko';

    // 캐시를 사용하여 데이터 가져오기 (24시간 캐시)
    const articles = await getNewsWithCache(query, language, 24);
    
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
