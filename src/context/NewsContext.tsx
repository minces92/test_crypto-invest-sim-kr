'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useNewsData } from '@/hooks/useNewsData';

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
  const [forceRefresh, setForceRefresh] = useState(false);
  const { news, isLoading, isError, mutate } = useNewsData('crypto', forceRefresh);

  useEffect(() => {
    // forceRefresh가 true였다가 데이터 로딩이 끝나면 다시 false로 돌려놓습니다.
    if (forceRefresh && !isLoading) {
      setForceRefresh(false);
    }
  }, [forceRefresh, isLoading]);

  const fetchNews = useCallback(async (refresh: boolean = false) => {
    if (refresh) {
      setForceRefresh(true);
      // useNewsData 훅이 forceRefresh 상태 변화에 따라 자동으로 데이터를 가져옵니다.
      // 수동으로 mutate를 호출할 필요가 없습니다.
    } else {
      // 기본 SWR 재검증
      await mutate();
    }
  }, [mutate]);

  return (
    <NewsContext.Provider value={{ news, loading: isLoading, error: isError ? 'Failed to load news' : null, fetchNews }}>
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
