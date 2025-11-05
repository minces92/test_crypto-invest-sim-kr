import { NextResponse } from 'next/server';

const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Simple keyword-based sentiment analysis
const analyzeSentiment = (title: string, description: string | null) => {
  const text = (title + ' ' + (description || '')).toLowerCase();

  const positiveKeywords = ['호재', '상승', '급등', '돌파', '성장', '발전', '협력', '파트너십', '출시', '성공', '기대', '긍정', '강세', '회복', '안정'];
  const negativeKeywords = ['악재', '하락', '급락', '폭락', '붕괴', '규제', '경고', '위험', '해킹', '사기', '조작', '부정', '약세', '침체', '불안'];

  let sentimentScore = 0;

  positiveKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      sentimentScore++;
    }
  });

  negativeKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      sentimentScore--;
    }
  });

  if (sentimentScore > 0) return 'positive';
  if (sentimentScore < 0) return 'negative';
  return 'neutral';
};

export async function GET(request: Request) {
  if (!NEWS_API_KEY) {
    return NextResponse.json({ error: 'NEWS_API_KEY is not set' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'cryptocurrency';
  const language = searchParams.get('language') || 'ko'; // Prioritize Korean news

  try {
    const newsResponse = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=${language}&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
    );

    if (!newsResponse.ok) {
      const errorData = await newsResponse.json();
      console.error('NewsAPI error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch news', details: errorData }, { status: newsResponse.status });
    }

    const data = await newsResponse.json();
    const articlesWithSentiment = data.articles.map((article: any) => ({
      ...article,
      sentiment: analyzeSentiment(article.title, article.description),
    }));

    return NextResponse.json(articlesWithSentiment);
  } catch (error) {
    console.error('Error fetching news:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch news from external API.', details: errorMessage },
      { status: 500 }
    );
  }
}
