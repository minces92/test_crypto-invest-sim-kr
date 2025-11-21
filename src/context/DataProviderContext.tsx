'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useTickerData } from '@/hooks/useTickerData';

interface Ticker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
}

interface DataContextType {
  tickers: Ticker[];
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { tickers, isLoading, isError } = useTickerData();

  return (
    <DataContext.Provider value={{ tickers, loading: isLoading, error: isError ? 'Failed to load tickers' : null }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
