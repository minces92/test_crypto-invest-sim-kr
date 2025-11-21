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
  const { news, isLoading, isError, mutate } = useNewsData();

  const fetchNews = useCallback(async (forceRefresh: boolean = false) => {
    if (forceRefresh) {
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
