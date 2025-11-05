'use client';

import React, { createContext, useState, useContext, ReactNode, useRef, useEffect, useMemo } from 'react';
import { calculateSMA, calculateRSI, calculateBollingerBands } from '@/lib/utils';

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
  source: string; // 'manual' or strategy ID
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

interface BBandConfig {
  strategyType: 'bband';
  market: string;
  period: number;
  multiplier: number;
}

export type Strategy = (DcaConfig | MaConfig | RsiConfig | BBandConfig) & { id: string; isActive: boolean };

interface PortfolioContextType {
  cash: number;
  assets: Asset[];
  transactions: Transaction[];
  strategies: Strategy[];
  buyAsset: (market: string, price: number, amount: number, source: string) => boolean;
  sellAsset: (market: string, price: number, amount: number, source: string) => boolean;
  startStrategy: (strategy: Omit<Strategy, 'id' | 'isActive'>) => void;
  stopStrategy: (strategyId: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const INITIAL_CASH = 100000;

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const cashRef = useRef(INITIAL_CASH);

  const strategyIntervalsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          console.error('Fetched transactions is not an array:', data);
          setTransactions([]);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactions([]);
      }
    };
    const fetchStrategies = async () => {
      try {
        const response = await fetch('/api/strategies');
        const data = await response.json();
        setStrategies(data);
        data.forEach((s: Strategy) => {
          if (s.isActive) {
            let intervalMilliseconds = 30000;
            if (s.strategyType === 'dca') {
              intervalMilliseconds = { daily: 24000, weekly: 60000, monthly: 300000 }[s.interval] || 24000;
            }
            const intervalId = setInterval(() => executeStrategy(s), intervalMilliseconds);
            strategyIntervalsRef.current[s.id] = intervalId;
          }
        });
      } catch (error) {
        console.error('Error fetching strategies:', error);
      }
    };
    fetchTransactions();
    fetchStrategies();
  }, []);

  const { assets, cash } = useMemo(() => {
    let calculatedCash = INITIAL_CASH;
    const calculatedAssets: { [market: string]: Asset } = {};

    // Process transactions in reverse order (oldest first)
    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      if (tx.type === 'buy') {
        calculatedCash -= tx.price * tx.amount;
        if (calculatedAssets[tx.market]) {
          const existingAsset = calculatedAssets[tx.market];
          const totalQuantity = existingAsset.quantity + tx.amount;
          const totalCost = (existingAsset.avg_buy_price * existingAsset.quantity) + (tx.price * tx.amount);
          calculatedAssets[tx.market] = {
            ...existingAsset,
            quantity: totalQuantity,
            avg_buy_price: totalCost / totalQuantity,
          };
        } else {
          calculatedAssets[tx.market] = {
            market: tx.market,
            quantity: tx.amount,
            avg_buy_price: tx.price,
          };
        }
      } else { // sell
        calculatedCash += tx.price * tx.amount;
        if (calculatedAssets[tx.market]) {
          calculatedAssets[tx.market].quantity -= tx.amount;
        }
      }
    }
    
    cashRef.current = calculatedCash;

    return { 
      assets: Object.values(calculatedAssets).filter(a => a.quantity > 0.00001),
      cash: calculatedCash,
    };
  }, [transactions]);

  const addTransaction = async (type: 'buy' | 'sell', market: string, price: number, amount: number, source: string) => {
    const newTransaction: Transaction = {
      id: new Date().toISOString() + Math.random(),
      type,
      market,
      price,
      amount,
      timestamp: new Date().toISOString(),
      source,
    };
    
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTransaction),
      });
      const savedTransaction = await response.json();
      setTransactions(prev => [savedTransaction, ...prev]);
    } catch (error) {
      console.error('Error saving transaction:', error);
      // Optimistic update fallback
      setTransactions(prev => [newTransaction, ...prev]);
    }
  };

  const buyAsset = (market: string, price: number, amount: number, source: string): boolean => {
    const cost = price * amount;
    if (cashRef.current < cost) {
      console.error('현금이 부족하여 매수할 수 없습니다.');
      return false;
    }
    addTransaction('buy', market, price, amount, source);
    return true;
  };

  const sellAsset = (market: string, price: number, amount: number, source: string): boolean => {
    const existingAsset = assets.find(a => a.market === market);
    if (!existingAsset || existingAsset.quantity < amount) {
      console.error('매도할 수량이 부족합니다.');
      return false;
    }
    addTransaction('sell', market, price, amount, source);
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
          buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
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
          const krwAmount = cashRef.current * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / candles[0].trade_price;
            buyAsset(strategy.market, candles[0].trade_price, amountToBuy, strategy.id);
          }
        } 
        // Dead Cross
        else if (lastShort < lastLong && prevShort >= prevLong) {
          console.log(`[${strategy.market}] 데드크로스 발생! 매도 실행`);
          const assetToSell = assets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, candles[0].trade_price, assetToSell.quantity, strategy.id);
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
          const krwAmount = cashRef.current * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / candles[0].trade_price;
            buyAsset(strategy.market, candles[0].trade_price, amountToBuy, strategy.id);
          }
        } else if (lastRsi > strategy.sellThreshold) {
          console.log(`[${strategy.market}] RSI 과매수! 매도 실행`);
          const assetToSell = assets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, candles[0].trade_price, assetToSell.quantity, strategy.id);
          }
        }
      } catch (error) { console.error('RSI 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'bband') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.period + 1}`);
        const candles = await response.json();
        if (candles.length < strategy.period + 1) return; // 데이터 부족

        const reversedCandles = [...candles].reverse(); // 시간순으로 정렬
        const bb = calculateBollingerBands(reversedCandles, strategy.period, strategy.multiplier);
        
        const currentPrice = reversedCandles[reversedCandles.length - 1].trade_price;
        const lastUpper = bb.upper[bb.upper.length - 1];
        const lastLower = bb.lower[bb.lower.length - 1];

        if (currentPrice < lastLower) {
          console.log(`[${strategy.market}] 볼린저 밴드 하단 터치! 매수 실행`);
          const krwAmount = cashRef.current * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
          }
        } else if (currentPrice > lastUpper) {
          console.log(`[${strategy.market}] 볼린저 밴드 상단 터치! 매도 실행`);
          const assetToSell = assets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, currentPrice, assetToSell.quantity * 0.5, strategy.id); // 보유 수량의 50% 매도
          }
        }
      } catch (error) { console.error('BBand 전략 실행 실패:', error); }
    }
  };

  const startStrategy = async (strategyConfig: Omit<Strategy, 'id' | 'isActive'>) => {
    const newStrategy: Strategy = {
      ...strategyConfig,
      id: new Date().toISOString() + Math.random(),
      isActive: true,
    };

    try {
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStrategy),
      });
      const savedStrategy = await response.json();
      setStrategies(prev => [...prev, savedStrategy]);

      let intervalMilliseconds = 30000; // default for MA
      if (savedStrategy.strategyType === 'dca') {
        intervalMilliseconds = { daily: 24000, weekly: 60000, monthly: 300000 }[savedStrategy.interval] || 24000;
      }
  
      executeStrategy(savedStrategy);
      const intervalId = setInterval(() => executeStrategy(savedStrategy), intervalMilliseconds);
      strategyIntervalsRef.current[savedStrategy.id] = intervalId;

    } catch (error) {
      console.error('Error saving strategy:', error);
    }
  };

  const stopStrategy = async (strategyId: string) => {
    const intervalId = strategyIntervalsRef.current[strategyId];
    if (intervalId) {
      clearInterval(intervalId);
      delete strategyIntervalsRef.current[strategyId];
    }
    setStrategies(prev => prev.filter(s => s.id !== strategyId));

    try {
      await fetch('/api/strategies', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: strategyId }),
      });
    } catch (error) {
      console.error('Error deleting strategy:', error);
    }
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
