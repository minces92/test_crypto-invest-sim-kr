'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface Ticker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
}

interface DataProviderContextType {
  tickers: Ticker[];
  loading: boolean;
  error: string | null;
}

const DataProviderContext = createContext<DataProviderContextType | undefined>(undefined);

const ALL_MARKETS = [
  'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA', 
  'KRW-AVAX', 'KRW-DOT', 'KRW-POL', 'KRW-TRX', 'KRW-SHIB', 'KRW-ETC', 
  'KRW-BCH', 'KRW-LINK'
];

const REFRESH_INTERVAL = process.env.NEXT_PUBLIC_REFRESH_INTERVAL 
  ? parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL, 10) 
  : 5000;

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const response = await fetch(`/api/tickers?markets=${ALL_MARKETS.join(',')}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch tickers: ${response.status}`);
        }
        const data = await response.json();
        setTickers(data);
        setError(null);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        setError(errorMessage);
        console.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <DataProviderContext.Provider value={{ tickers, loading, error }}>
      {children}
    </DataProviderContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataProviderContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
