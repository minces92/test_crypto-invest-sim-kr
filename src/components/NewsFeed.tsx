'use client';

import { useState, useEffect } from 'react';

interface Article {
  title: string;
  description: string;
  url: string;
  source: { name: string };
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export default function NewsFeed() {
  const [news, setNews] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/news');
        if (!response.ok) {
          throw new Error('Failed to fetch news from server');
        }
        const data: Article[] = await response.json();
        setNews(data);
        setError(null);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 60000 * 5); // Fetch news every 5 minutes

    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (sentiment: Article['sentiment']) => {
    switch (sentiment) {
      case 'positive': return 'color-fg-success';
      case 'negative': return 'color-fg-danger';
      default: return 'color-fg-muted';
    }
  };

  return (
    <div className="Box mt-4 border">
      <div className="Box-header">
        <h2 className="Box-title">암호화폐 뉴스</h2>
      </div>
      <div className="Box-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading && <p className="text-center p-3">뉴스 로딩 중...</p>}
        {error && <p className="text-center color-fg-danger p-3">뉴스를 불러오는 데 실패했습니다: {error}</p>}
        {!loading && !error && news.length === 0 && <p className="text-center color-fg-muted p-3">표시할 뉴스가 없습니다.</p>}
        {!loading && !error && news.length > 0 && (
          <ul className="list-style-none p-0 m-0">
            {news.map((article, index) => (
              <li key={index} className="py-2 border-bottom">
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="d-block Link--primary">
                  <strong className="f5">{article.title}</strong>
                </a>
                <p className="text-small color-fg-muted mb-1">{article.description}</p>
                <div className="d-flex flex-justify-between flex-items-center">
                  <span className="text-small color-fg-muted">{article.source.name} - {new Date(article.publishedAt).toLocaleDateString('ko-KR')}</span>
                  <span className={`text-small text-bold ${getSentimentColor(article.sentiment)}`}>
                    {article.sentiment === 'positive' && '호재'}
                    {article.sentiment === 'negative' && '악재'}
                    {article.sentiment === 'neutral' && '중립'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
