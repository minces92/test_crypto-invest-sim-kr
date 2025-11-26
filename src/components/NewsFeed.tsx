'use client';

import { useNews } from '@/context/NewsContext';

interface Article {
  title: string;
  description: string;
  url: string;
  source: { name: string };
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export default function NewsFeed() {
  const { news, loading, error, fetchNews } = useNews();

  const getSentimentColor = (sentiment: Article['sentiment']) => {
    switch (sentiment) {
      case 'positive': return 'color-fg-success';
      case 'negative': return 'color-fg-danger';
      default: return 'color-fg-muted';
    }
  };

  return (
    <div className="Box mt-4 border">
      <div className="Box-header d-flex flex-justify-between flex-items-center">
        <div>
          <h2 className="Box-title">암호화폐 뉴스</h2>
          <p className="text-small color-fg-muted mt-1 mb-0">자동 갱신: 15분마다</p>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => fetchNews(true)}
          disabled={loading}
        >
          {loading ? '갱신 중...' : '새로고침'}
        </button>
      </div>
      <div className="Box-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading && news.length === 0 && <p className="text-center p-3">뉴스 로딩 중...</p>}
        {error && (
          <div className="text-center p-3">
            <p className="color-fg-danger mb-2">뉴스를 불러오는 데 실패했습니다.</p>
            {error.includes('MISSING_API_KEY') || error.includes('503') ? (
              <div className="flash flash-warn">
                <strong>설정 필요:</strong> <code>NEWS_API_KEY</code>가 설정되지 않았습니다.<br />
                <code>.env.local</code> 파일에 NewsAPI 키를 추가해주세요.
              </div>
            ) : (
              <p className="text-small color-fg-muted">{error}</p>
            )}
          </div>
        )}
        {!loading && !error && news.length === 0 && <p className="text-center color-fg-muted p-3">표시할 뉴스가 없습니다.</p>}
        {news.length > 0 && (
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
