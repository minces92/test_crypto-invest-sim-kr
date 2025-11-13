'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface Article {
  title: string;
  description: string;
  url: string;
  source: { name: string };
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface NewsContextType {
  news: Article[];
  loading: boolean;
  error: string | null;
  fetchNews: (forceRefresh?: boolean) => Promise<void>;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

export const NewsProvider = ({ children }: { children: ReactNode }) => {
  const [news, setNews] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async (forceRefresh: boolean = false) => {
    // Only set loading to true on the initial load or a forced refresh
    if (news.length === 0 || forceRefresh) {
        setLoading(true);
    }
    try {
      const url = forceRefresh ? '/api/news?refresh=true' : '/api/news';
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`Failed to fetch news: ${response.status} ${errorData?.details || ''}`);
      }
      const data: Article[] = await response.json();
      setNews(data);
      setError(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error("Error fetching news:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchNews(false);

    // Set up interval for background refreshing
    const interval = setInterval(() => fetchNews(true), REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <NewsContext.Provider value={{ news, loading, error, fetchNews }}>
      {children}
    </NewsContext.Provider>
  );
};

export const useNews = () => {
  const context = useContext(NewsContext);
  if (context === undefined) {
    throw new Error('useNews must be used within a NewsProvider');
  }
  return context;
};
