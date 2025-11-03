import React, { createContext, useState, useContext, ReactNode, useRef } from 'react';
import { calculateSMA } from '@/lib/utils';

// --- Interface 정의들 ---
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
interface DcaConfig {
  isActive: boolean;
  market?: string;
  amount?: number;
  interval?: string;
}
interface MaConfig {
  isActive: boolean;
  market?: string;
  shortPeriod?: number;
  longPeriod?: number;
}

interface PortfolioContextType {
  cash: number;
  assets: Asset[];
  transactions: Transaction[];
  dcaConfig: DcaConfig;
  maConfig: MaConfig;
  buyAsset: (market: string, price: number, amount: number) => boolean;
  sellAsset: (market: string, price: number, amount: number) => boolean;
  startDCA: (market: string, amount: number, interval: string) => void;
  stopDCA: () => void;
  startMA: (market: string, shortPeriod: number, longPeriod: number) => void;
  stopMA: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const [cash, setCash] = useState(10000000);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dcaConfig, setDcaConfig] = useState<DcaConfig>({ isActive: false });
  const [maConfig, setMaConfig] = useState<MaConfig>({ isActive: false });

  const tradeIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      console.error('현금이 부족하여 매수할 수 없습니다.');
      if (dcaConfig.isActive) stopDCA();
      if (maConfig.isActive) stopMA();
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
      console.error('매도할 수량이 부족합니다.');
      return false;
    }

    const income = price * amount;
    setCash(prevCash => prevCash + income);
    addTransaction('sell', market, price, amount);

    const remainingQuantity = existingAsset.quantity - amount;
    if (remainingQuantity > 0.00001) { // 부동소수점 오차 감안
      const updatedAssets = assets.map(a => 
        a.market === market ? { ...a, quantity: remainingQuantity } : a
      );
      setAssets(updatedAssets);
    } else {
      setAssets(assets.filter(a => a.market !== market));
    }
    return true;
  };

  // --- DCA Strategy ---
  const executeDcaBuy = async (market: string, krwAmount: number) => {
    try {
      const response = await fetch(`/api/tickers?markets=${market}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const currentPrice = data[0].trade_price;
        const amountToBuy = krwAmount / currentPrice;
        buyAsset(market, currentPrice, amountToBuy);
      }
    } catch (error) { console.error('DCA 실행 실패:', error); }
  };

  const startDCA = (market: string, amount: number, interval: string) => {
    stopMA(); // 다른 전략 중지
    if (tradeIntervalRef.current) clearInterval(tradeIntervalRef.current);

    const intervalMilliseconds = { daily: 24000, weekly: 60000, monthly: 300000 }[interval] || 24000;
    executeDcaBuy(market, amount);
    const intervalId = setInterval(() => executeDcaBuy(market, amount), intervalMilliseconds);
    tradeIntervalRef.current = intervalId;
    setDcaConfig({ isActive: true, market, amount, interval });
  };

  const stopDCA = () => {
    if (tradeIntervalRef.current && dcaConfig.isActive) {
      clearInterval(tradeIntervalRef.current);
      tradeIntervalRef.current = null;
    }
    setDcaConfig({ isActive: false });
  };

  // --- MA Crossover Strategy ---
  const executeMaCross = async (market: string, shortPeriod: number, longPeriod: number) => {
    try {
      const response = await fetch(`/api/candles?market=${market}&count=${longPeriod + 2}`);
      const candles = await response.json();
      if (candles.length < longPeriod + 2) return; // 데이터 부족

      const reversedCandles = [...candles].reverse(); // 시간순으로 정렬
      const shortSMA = calculateSMA(reversedCandles, shortPeriod);
      const longSMA = calculateSMA(reversedCandles, longPeriod);

      const lastShort = shortSMA[shortSMA.length - 1];
      const prevShort = shortSMA[shortSMA.length - 2];
      const lastLong = longSMA[longSMA.length - (longPeriod - shortPeriod) - 1];
      const prevLong = longSMA[longSMA.length - (longPeriod - shortPeriod) - 2];

      // Golden Cross: 단기 > 장기, 이전에는 단기 < 장기
      if (lastShort > lastLong && prevShort <= prevLong) {
        console.log(`[${market}] 골든크로스 발생! 매수 실행`);
        const krwAmount = cash * 0.5; // 보유 현금의 50% 매수
        if (krwAmount > 5000) { // 최소 주문 금액
          const amountToBuy = krwAmount / candles[0].trade_price;
          buyAsset(market, candles[0].trade_price, amountToBuy);
        }
      } 
      // Dead Cross: 단기 < 장기, 이전에는 단기 > 장기
      else if (lastShort < lastLong && prevShort >= prevLong) {
        console.log(`[${market}] 데드크로스 발생! 매도 실행`);
        const assetToSell = assets.find(a => a.market === market);
        if (assetToSell && assetToSell.quantity > 0) {
          sellAsset(market, candles[0].trade_price, assetToSell.quantity); // 전량 매도
        }
      }
    } catch (error) { console.error('MA 전략 실행 실패:', error); }
  };

  const startMA = (market: string, shortPeriod: number, longPeriod: number) => {
    stopDCA(); // 다른 전략 중지
    if (tradeIntervalRef.current) clearInterval(tradeIntervalRef.current);

    const intervalMilliseconds = 30000; // 30초마다 확인
    executeMaCross(market, shortPeriod, longPeriod);
    const intervalId = setInterval(() => executeMaCross(market, shortPeriod, longPeriod), intervalMilliseconds);
    tradeIntervalRef.current = intervalId;
    setMaConfig({ isActive: true, market, shortPeriod, longPeriod });
  };

  const stopMA = () => {
    if (tradeIntervalRef.current && maConfig.isActive) {
      clearInterval(tradeIntervalRef.current);
      tradeIntervalRef.current = null;
    }
    setMaConfig({ isActive: false });
  };

  return (
    <PortfolioContext.Provider value={{ cash, assets, transactions, dcaConfig, maConfig, buyAsset, sellAsset, startDCA, stopDCA, startMA, stopMA }}>
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
