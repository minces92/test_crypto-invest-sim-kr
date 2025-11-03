import React, { createContext, useState, useContext, ReactNode, useRef } from 'react';

// --- (기존 interface 정의들은 변경 없음) ---
interface Asset {
  market: string;
  quantity: number;
  avg_buy_price: number;
}
interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  market: string;
  price: number;
  amount: number;
  timestamp: string;
}

// DCA 설정 타입 정의
interface DcaConfig {
  isActive: boolean;
  market?: string;
  amount?: number;
  interval?: 'daily' | 'weekly' | 'monthly';
}

interface PortfolioContextType {
  cash: number;
  assets: Asset[];
  transactions: Transaction[];
  dcaConfig: DcaConfig;
  buyAsset: (market: string, price: number, amount: number) => boolean;
  sellAsset: (market: string, price: number, amount: number) => boolean;
  startDCA: (market: string, amount: number, interval: string) => void;
  stopDCA: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const [cash, setCash] = useState(10000000);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dcaConfig, setDcaConfig] = useState<DcaConfig>({ isActive: false });

  const dcaIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addTransaction = (type: 'buy' | 'sell', market: string, price: number, amount: number) => {
    const newTransaction: Transaction = {
      id: new Date().toISOString() + Math.random(),
      type,
      market,
      price,
      amount,
      timestamp: new Date().toISOString(),
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const buyAsset = (market: string, price: number, amount: number): boolean => {
    const cost = price * amount;
    if (cash < cost) {
      console.error('DCA: 현금이 부족하여 매수를 중단합니다.');
      stopDCA(); // 현금 부족 시 자동매매 중단
      return false;
    }

    setCash(prevCash => prevCash - cost);
    addTransaction('buy', market, price, amount);

    setAssets(prevAssets => {
      const existingAssetIndex = prevAssets.findIndex(a => a.market === market);
      if (existingAssetIndex > -1) {
        const existingAsset = prevAssets[existingAssetIndex];
        const totalQuantity = existingAsset.quantity + amount;
        const totalCost = (existingAsset.avg_buy_price * existingAsset.quantity) + cost;
        const newAvgBuyPrice = totalCost / totalQuantity;
        const updatedAssets = [...prevAssets];
        updatedAssets[existingAssetIndex] = { ...existingAsset, quantity: totalQuantity, avg_buy_price: newAvgBuyPrice };
        return updatedAssets;
      } else {
        return [...prevAssets, { market, quantity: amount, avg_buy_price: price }];
      }
    });
    return true;
  };

  const sellAsset = (market: string, price: number, amount: number): boolean => {
    const existingAsset = assets.find(a => a.market === market);
    if (!existingAsset || existingAsset.quantity < amount) {
      alert('보유 수량이 부족합니다.');
      return false;
    }

    const income = price * amount;
    setCash(cash + income);
    addTransaction('sell', market, price, amount);

    const remainingQuantity = existingAsset.quantity - amount;
    if (remainingQuantity > 0) {
      const updatedAssets = assets.map(a => 
        a.market === market ? { ...a, quantity: remainingQuantity } : a
      );
      setAssets(updatedAssets);
    } else {
      setAssets(assets.filter(a => a.market !== market));
    }
    return true;
  };

  const executeDcaBuy = async (market: string, krwAmount: number) => {
    try {
      const response = await fetch(`/api/tickers?markets=${market}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const currentPrice = data[0].trade_price;
        const amountToBuy = krwAmount / currentPrice;
        buyAsset(market, currentPrice, amountToBuy);
      }
    } catch (error) {
      console.error('DCA execution failed:', error);
    }
  };

  const startDCA = (market: string, amount: number, interval: string) => {
    if (dcaIntervalRef.current) clearInterval(dcaIntervalRef.current);

    const intervalMilliseconds = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    }[interval] || 24 * 60 * 60 * 1000; // 기본값: daily

    // 즉시 1회 실행
    executeDcaBuy(market, amount);

    const intervalId = setInterval(() => executeDcaBuy(market, amount), intervalMilliseconds);
    dcaIntervalRef.current = intervalId;
    setDcaConfig({ isActive: true, market, amount, interval: interval as DcaConfig['interval'] });
  };

  const stopDCA = () => {
    if (dcaIntervalRef.current) {
      clearInterval(dcaIntervalRef.current);
      dcaIntervalRef.current = null;
    }
    setDcaConfig({ isActive: false });
  };

  return (
    <PortfolioContext.Provider value={{ cash, assets, transactions, dcaConfig, buyAsset, sellAsset, startDCA, stopDCA }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
