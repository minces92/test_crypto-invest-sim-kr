'use client';

import React, { createContext, useState, useContext, ReactNode, useRef } from 'react';
import { calculateSMA, calculateRSI } from '@/lib/utils';

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
  strategyType: 'dca';
  market: string;
  amount: number;
  interval: string;
}

interface MaConfig {
  strategyType: 'ma';
  market: string;
  shortPeriod: number;
  longPeriod: number;
}

interface RsiConfig {
  strategyType: 'rsi';
  market: string;
  period: number;
  buyThreshold: number;
  sellThreshold: number;
}

export type Strategy = (DcaConfig | MaConfig | RsiConfig) & { id: string; isActive: boolean };

interface PortfolioContextType {
  cash: number;
  assets: Asset[];
  transactions: Transaction[];
  strategies: Strategy[];
  buyAsset: (market: string, price: number, amount: number) => boolean;
  sellAsset: (market: string, price: number, amount: number) => boolean;
  startStrategy: (strategy: Omit<Strategy, 'id' | 'isActive'>) => void;
  stopStrategy: (strategyId: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const [cash, setCash] = useState(10000000);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  const strategyIntervalsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

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

  // --- Strategy Execution ---
  const executeStrategy = async (strategy: Strategy) => {
    if (!strategy.isActive) return;

    if (strategy.strategyType === 'dca') {
      try {
        const response = await fetch(`/api/tickers?markets=${strategy.market}`);
        const data = await response.json();
        if (data && data.length > 0) {
          const currentPrice = data[0].trade_price;
          const amountToBuy = strategy.amount / currentPrice;
          buyAsset(strategy.market, currentPrice, amountToBuy);
        }
      } catch (error) { console.error('DCA 실행 실패:', error); }
    } else if (strategy.strategyType === 'ma') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.longPeriod + 2}`);
        const candles = await response.json();
        if (candles.length < strategy.longPeriod + 2) return; // 데이터 부족

        const reversedCandles = [...candles].reverse(); // 시간순으로 정렬
        const shortSMA = calculateSMA(reversedCandles, strategy.shortPeriod);
        const longSMA = calculateSMA(reversedCandles, strategy.longPeriod);

        const lastShort = shortSMA[shortSMA.length - 1];
        const prevShort = shortSMA[shortSMA.length - 2];
        const lastLong = longSMA[longSMA.length - (strategy.longPeriod - strategy.shortPeriod) - 1];
        const prevLong = longSMA[longSMA.length - (strategy.longPeriod - strategy.shortPeriod) - 2];

        // Golden Cross
        if (lastShort > lastLong && prevShort <= prevLong) {
          console.log(`[${strategy.market}] 골든크로스 발생! 매수 실행`);
          const krwAmount = cash * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / candles[0].trade_price;
            buyAsset(strategy.market, candles[0].trade_price, amountToBuy);
          }
        } 
        // Dead Cross
        else if (lastShort < lastLong && prevShort >= prevLong) {
          console.log(`[${strategy.market}] 데드크로스 발생! 매도 실행`);
          const assetToSell = assets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, candles[0].trade_price, assetToSell.quantity);
          }
        }
      } catch (error) { console.error('MA 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'rsi') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.period + 1}`);
        const candles = await response.json();
        if (candles.length < strategy.period + 1) return; // 데이터 부족

        const reversedCandles = [...candles].reverse(); // 시간순으로 정렬
        const rsi = calculateRSI(reversedCandles, strategy.period);
        const lastRsi = rsi[rsi.length - 1];

        if (lastRsi < strategy.buyThreshold) {
          console.log(`[${strategy.market}] RSI 과매도! 매수 실행`);
          const krwAmount = cash * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / candles[0].trade_price;
            buyAsset(strategy.market, candles[0].trade_price, amountToBuy);
          }
        } else if (lastRsi > strategy.sellThreshold) {
          console.log(`[${strategy.market}] RSI 과매수! 매도 실행`);
          const assetToSell = assets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, candles[0].trade_price, assetToSell.quantity);
          }
        }
      } catch (error) { console.error('RSI 전략 실행 실패:', error); }
    }
  };

  const startStrategy = (strategyConfig: Omit<Strategy, 'id' | 'isActive'>) => {
    const newStrategy: Strategy = {
      ...strategyConfig,
      id: new Date().toISOString() + Math.random(),
      isActive: true,
    };

    let intervalMilliseconds = 30000; // default for MA
    if (newStrategy.strategyType === 'dca') {
      intervalMilliseconds = { daily: 24000, weekly: 60000, monthly: 300000 }[newStrategy.interval] || 24000;
    }

    executeStrategy(newStrategy);
    const intervalId = setInterval(() => executeStrategy(newStrategy), intervalMilliseconds);
    strategyIntervalsRef.current[newStrategy.id] = intervalId;
    setStrategies(prev => [...prev, newStrategy]);
  };

  const stopStrategy = (strategyId: string) => {
    const intervalId = strategyIntervalsRef.current[strategyId];
    if (intervalId) {
      clearInterval(intervalId);
      delete strategyIntervalsRef.current[strategyId];
    }
    setStrategies(prev => prev.filter(s => s.id !== strategyId));
  };

  return (
    <PortfolioContext.Provider value={{ cash, assets, transactions, strategies, buyAsset, sellAsset, startStrategy, stopStrategy }}>
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
