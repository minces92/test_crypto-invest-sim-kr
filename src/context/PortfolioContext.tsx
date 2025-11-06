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

interface NewsStrategyConfig {
  strategyType: 'news';
  market: string;
  sentimentThreshold: 'positive' | 'negative'; // e.g., 'positive' to buy on good news, 'negative' to sell on bad news
}

interface VolatilityBreakoutConfig {
  strategyType: 'volatility';
  market: string;
  multiplier: number; // 변동성 돌파 승수 (기본값: 0.5)
}

interface MomentumConfig {
  strategyType: 'momentum';
  market: string;
  period: number; // 모멘텀 계산 기간 (기본값: 10)
  threshold: number; // 모멘텀 임계값 (기본값: 5%)
}

export type Strategy = (DcaConfig | MaConfig | RsiConfig | BBandConfig | NewsStrategyConfig | VolatilityBreakoutConfig | MomentumConfig) & { id: string; isActive: boolean };

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

  const getPortfolioState = (currentTransactions: Transaction[]) => {
    let calculatedCash = INITIAL_CASH;
    const calculatedAssets: { [market: string]: Asset } = {};

    // Process transactions in reverse order (oldest first)
    for (let i = currentTransactions.length - 1; i >= 0; i--) {
      const tx = currentTransactions[i];
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

    return {
      assets: Object.values(calculatedAssets).filter(a => a.quantity > 0.00001),
      cash: calculatedCash,
    };
  };

  const { assets, cash } = useMemo(() => getPortfolioState(transactions), [transactions]);

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

    // Optimistic update
    const newTransactions = [newTransaction, ...transactions];
    setTransactions(newTransactions);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction),
      });
      if (!response.ok) {
        // Revert on failure
        setTransactions(transactions);
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      // Revert on failure
      setTransactions(transactions);
    }
  };

  const buyAsset = (market: string, price: number, amount: number, source: string): boolean => {
    const cost = price * amount;
    const { cash: currentCash } = getPortfolioState(transactions);
    if (currentCash < cost) {
      alert('현금이 부족하여 매수할 수 없습니다.');
      console.error('현금이 부족하여 매수할 수 없습니다.');
      return false;
    }
    addTransaction('buy', market, price, amount, source);
    return true;
  };

  const sellAsset = (market: string, price: number, amount: number, source: string): boolean => {
    const { assets: currentAssets } = getPortfolioState(transactions);
    const existingAsset = currentAssets.find(a => a.market === market);
    if (!existingAsset || existingAsset.quantity < amount) {
      alert('매도 가능 수량이 부족합니다.');
      console.error('매도 가능 수량이 부족합니다.');
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
          const change24h = data[0].signed_change_rate * 100 || 0;
          
          // AI 검증 (옵션, 환경변수로 활성화)
          const useAI = process.env.NEXT_PUBLIC_USE_AI_VERIFICATION === 'true';
          if (useAI) {
            try {
              const aiResponse = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  market: strategy.market,
                  currentPrice,
                  change24h,
                }),
              });
              
              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const analysis = aiData.analysis;
                
                // AI가 매수 신호를 차단하면 건너뛰기
                if (analysis.recommendation === '매도' && analysis.confidence > 0.7) {
                  console.log(`[${strategy.market}] AI가 DCA 매수를 차단했습니다. 이유: ${analysis.reasoning}`);
                  return;
                }
                
                // AI 추천 금액 조정
                let amountToBuy = strategy.amount / currentPrice;
                if (analysis.recommendation === '매수' && analysis.recommended_amount_percent) {
                  const adjustedAmount = strategy.amount * (analysis.recommended_amount_percent / 100);
                  amountToBuy = adjustedAmount / currentPrice;
                  console.log(`[${strategy.market}] AI 추천에 따라 매수 금액 조정: ${analysis.recommended_amount_percent}%`);
                }
                
                buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
              } else {
                // AI 실패 시 기본 DCA 실행
                const amountToBuy = strategy.amount / currentPrice;
                buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
              }
            } catch (aiError) {
              console.warn('AI 검증 실패, 기본 DCA 실행:', aiError);
              const amountToBuy = strategy.amount / currentPrice;
              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
            }
          } else {
            // AI 미사용 시 기본 DCA 실행
            const amountToBuy = strategy.amount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
          }
        }
      } catch (error) { console.error('DCA 실행 실패:', error); }
    } else if (strategy.strategyType === 'ma') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.longPeriod + 2}`);
        const candles = await response.json();
        if (candles.length < strategy.longPeriod + 2) return; // 데이터 부족

        const reversedCandles = [...candles].reverse(); // 시간순으로 정렬
        const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactions);

        // 이동평균 계산
        const shortMA = calculateSMA(reversedCandles, strategy.shortPeriod);
        const longMA = calculateSMA(reversedCandles, strategy.longPeriod);
        
        if (shortMA.length < 2 || longMA.length < 2) return;

        const lastShort = shortMA[shortMA.length - 1];
        const lastLong = longMA[longMA.length - 1];
        const prevShort = shortMA[shortMA.length - 2];
        const prevLong = longMA[longMA.length - 2];
        const currentPrice = reversedCandles[reversedCandles.length - 1].trade_price;

        // AI 검증 (옵션)
        const useAI = process.env.NEXT_PUBLIC_USE_AI_VERIFICATION === 'true';
        let aiAnalysis: any = null;
        
        if (useAI) {
          try {
            const aiResponse = await fetch('/api/ai/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                market: strategy.market,
                currentPrice,
                change24h: 0, // 계산 필요시 추가
                ma: {
                  short: lastShort,
                  long: lastLong,
                  cross: lastShort > lastLong && prevShort <= prevLong ? 'golden' : 
                         lastShort < lastLong && prevShort >= prevLong ? 'dead' : 'none',
                },
              }),
            });
            
            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiAnalysis = aiData.analysis;
            }
          } catch (aiError) {
            console.warn('MA 전략 AI 검증 실패:', aiError);
          }
        }

        // Golden Cross
        if (lastShort > lastLong && prevShort <= prevLong) {
          // AI가 차단하면 건너뛰기
          if (aiAnalysis && aiAnalysis.recommendation === '매도' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 골든크로스 매수를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }
          
          const krwAmount = currentCash * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
          }
        } 
        // Dead Cross
        else if (lastShort < lastLong && prevShort >= prevLong) {
          // AI가 차단하면 건너뛰기
          if (aiAnalysis && aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 데드크로스 매도를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }
          
          console.log(`[${strategy.market}] 데드크로스 발생! 매도 실행`);
          const assetToSell = currentAssets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, currentPrice, assetToSell.quantity, strategy.id);
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
        const currentPrice = reversedCandles[reversedCandles.length - 1].trade_price;
        const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactions);

        // AI 검증 (옵션)
        const useAI = process.env.NEXT_PUBLIC_USE_AI_VERIFICATION === 'true';
        let aiAnalysis: any = null;
        
        if (useAI) {
          try {
            const aiResponse = await fetch('/api/ai/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                market: strategy.market,
                currentPrice,
                change24h: 0,
                rsi: lastRsi,
              }),
            });
            
            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiAnalysis = aiData.analysis;
            }
          } catch (aiError) {
            console.warn('RSI 전략 AI 검증 실패:', aiError);
          }
        }

        if (lastRsi < strategy.buyThreshold) {
          // AI가 차단하면 건너뛰기
          if (aiAnalysis && aiAnalysis.recommendation === '매도' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 RSI 과매도 매수를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }
          
          console.log(`[${strategy.market}] RSI 과매도! 매수 실행`);
          const krwAmount = currentCash * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
          }
        } else if (lastRsi > strategy.sellThreshold) {
          // AI가 차단하면 건너뛰기
          if (aiAnalysis && aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 RSI 과매수 매도를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }
          
          console.log(`[${strategy.market}] RSI 과매수! 매도 실행`);
          const assetToSell = currentAssets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, currentPrice, assetToSell.quantity, strategy.id);
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
        const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactions);

        // AI 검증 (옵션)
        const useAI = process.env.NEXT_PUBLIC_USE_AI_VERIFICATION === 'true';
        let aiAnalysis: any = null;
        
        if (useAI) {
          try {
            const bollingerPosition = currentPrice < lastLower ? 'below' : 
                                     currentPrice > lastUpper ? 'above' : 'middle';
            const aiResponse = await fetch('/api/ai/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                market: strategy.market,
                currentPrice,
                change24h: 0,
                bollinger: {
                  position: bollingerPosition,
                  upper: lastUpper,
                  lower: lastLower,
                  middle: bb.middle[bb.middle.length - 1],
                },
              }),
            });
            
            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiAnalysis = aiData.analysis;
            }
          } catch (aiError) {
            console.warn('볼린저밴드 전략 AI 검증 실패:', aiError);
          }
        }

        if (currentPrice < lastLower) {
          // AI가 차단하면 건너뛰기
          if (aiAnalysis && aiAnalysis.recommendation === '매도' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 볼린저밴드 하단 매수를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }
          
          console.log(`[${strategy.market}] 볼린저 밴드 하단 터치! 매수 실행`);
          const krwAmount = currentCash * 0.5; // 보유 현금의 50% 매수
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
          }
        } else if (currentPrice > lastUpper) {
          // AI가 차단하면 건너뛰기
          if (aiAnalysis && aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 볼린저밴드 상단 매도를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }
          
          console.log(`[${strategy.market}] 볼린저 밴드 상단 터치! 매도 실행`);
          const assetToSell = currentAssets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, currentPrice, assetToSell.quantity * 0.5, strategy.id); // 보유 수량의 50% 매도
          }
        }
      } catch (error) { console.error('BBand 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'news') {
      try {
        const response = await fetch(`/api/news?query=${strategy.market.replace('KRW-', '')}&language=ko`);
        const newsArticles = await response.json();

        const relevantNews = newsArticles.filter((article: any) => 
          article.title.toLowerCase().includes(strategy.market.replace('KRW-', '').toLowerCase())
        );

        if (relevantNews.length > 0) {
          const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactions);
          const currentPriceResponse = await fetch(`/api/tickers?markets=${strategy.market}`);
          const currentPriceData = await currentPriceResponse.json();
          const currentPrice = currentPriceData[0]?.trade_price;

          if (!currentPrice) {
            console.error(`[${strategy.market}] 현재 가격을 가져올 수 없습니다.`);
            return;
          }

          const hasPositiveNews = relevantNews.some((article: any) => article.sentiment === 'positive');
          const hasNegativeNews = relevantNews.some((article: any) => article.sentiment === 'negative');

          if (strategy.sentimentThreshold === 'positive' && hasPositiveNews) {
            console.log(`[${strategy.market}] 호재 뉴스 감지! 매수 실행`);
            const krwAmount = currentCash * 0.5; // 보유 현금의 50% 매수
            if (krwAmount > 5000) {
              const amountToBuy = krwAmount / currentPrice;
              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
            }
          } else if (strategy.sentimentThreshold === 'negative' && hasNegativeNews) {
            console.log(`[${strategy.market}] 악재 뉴스 감지! 매도 실행`);
            const assetToSell = currentAssets.find(a => a.market === strategy.market);
            if (assetToSell && assetToSell.quantity > 0) {
              sellAsset(strategy.market, currentPrice, assetToSell.quantity * 0.5, strategy.id); // 보유 수량의 50% 매도
            }
          }
        }
      } catch (error) { console.error('News 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'volatility') {
      try {
        // 전일 고가/저가 범위 계산
        const response = await fetch(`/api/candles?market=${strategy.market}&count=2`);
        const candles = await response.json();
        if (candles.length < 2) return;

        const yesterday = candles[1];
        const today = candles[0];
        const range = yesterday.high_price - yesterday.low_price;
        const targetPrice = yesterday.high_price + (range * strategy.multiplier);
        const currentPrice = today.trade_price;

        // 변동성 돌파 확인
        if (currentPrice > targetPrice) {
          // AI 검증
          const useAI = process.env.NEXT_PUBLIC_USE_AI_VERIFICATION === 'true';
          let aiAnalysis: any = null;
          
          if (useAI) {
            try {
              const aiResponse = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  market: strategy.market,
                  currentPrice,
                  change24h: ((currentPrice - yesterday.trade_price) / yesterday.trade_price) * 100,
                  volatility: {
                    range,
                    targetPrice,
                    isBreakout: true,
                  },
                }),
              });
              
              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                aiAnalysis = aiData.analysis;
              }
            } catch (aiError) {
              console.warn('변동성 돌파 전략 AI 검증 실패:', aiError);
            }
          }

          // AI가 유효한 돌파로 판단하면 매수
          if (!aiAnalysis || (aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.6)) {
            const { cash: currentCash } = getPortfolioState(transactions);
            const krwAmount = currentCash * 0.3; // 보유 현금의 30% 매수
            if (krwAmount > 5000) {
              const amountToBuy = krwAmount / currentPrice;
              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
              console.log(`[${strategy.market}] 변동성 돌파 발생! 매수 실행 (목표가: ${targetPrice.toLocaleString()})`);
            }
          } else {
            console.log(`[${strategy.market}] AI가 변동성 돌파를 가짜 돌파로 판단했습니다.`);
          }
        }
      } catch (error) { console.error('변동성 돌파 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'momentum') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.period + 1}`);
        const candles = await response.json();
        if (candles.length < strategy.period + 1) return;

        const reversedCandles = [...candles].reverse();
        const currentPrice = reversedCandles[reversedCandles.length - 1].trade_price;
        const pastPrice = reversedCandles[reversedCandles.length - strategy.period - 1].trade_price;
        
        // 가격 모멘텀 계산
        const priceMomentum = ((currentPrice - pastPrice) / pastPrice) * 100;
        
        // 거래량 모멘텀 (간단 계산)
        const recentVolumes = reversedCandles.slice(-strategy.period).map(c => c.candle_acc_trade_volume || 0);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        const currentVolume = recentVolumes[recentVolumes.length - 1] || 0;
        const volumeMomentum = currentVolume > 0 ? ((currentVolume - avgVolume) / avgVolume) * 100 : 0;

        // 모멘텀 조건 확인
        if (priceMomentum > strategy.threshold && volumeMomentum > 20) {
          // AI 검증
          const useAI = process.env.NEXT_PUBLIC_USE_AI_VERIFICATION === 'true';
          let aiAnalysis: any = null;
          
          if (useAI) {
            try {
              const rsi = calculateRSI(reversedCandles, 14);
              const lastRsi = rsi.length > 0 ? rsi[rsi.length - 1] : 50;
              
              const aiResponse = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  market: strategy.market,
                  currentPrice,
                  change24h: priceMomentum,
                  rsi: lastRsi,
                  momentum: {
                    priceMomentum,
                    volumeMomentum,
                    isStrong: priceMomentum > strategy.threshold * 2,
                  },
                }),
              });
              
              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                aiAnalysis = aiData.analysis;
              }
            } catch (aiError) {
              console.warn('모멘텀 전략 AI 검증 실패:', aiError);
            }
          }

          // AI가 모멘텀 지속 가능성을 긍정적으로 평가하면 매수
          if (!aiAnalysis || (aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.65)) {
            const { cash: currentCash } = getPortfolioState(transactions);
            const krwAmount = currentCash * 0.4; // 보유 현금의 40% 매수
            if (krwAmount > 5000) {
              const amountToBuy = krwAmount / currentPrice;
              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id);
              console.log(`[${strategy.market}] 모멘텀 발생! 매수 실행 (가격 모멘텀: ${priceMomentum.toFixed(2)}%, 거래량 모멘텀: ${volumeMomentum.toFixed(2)}%)`);
            }
          } else {
            console.log(`[${strategy.market}] AI가 모멘텀 지속 가능성을 낮게 평가했습니다.`);
          }
        }
      } catch (error) { console.error('모멘텀 전략 실행 실패:', error); }
    }
  };

  const startStrategy = async (strategyConfig: Omit<Strategy, 'id' | 'isActive'>) => {
    const newStrategy = {
      ...strategyConfig,
      id: new Date().toISOString() + Math.random(),
      isActive: true,
    } as Strategy;

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
        const intervalMap: { [key: string]: number } = { daily: 24000, weekly: 60000, monthly: 300000 };
        intervalMilliseconds = intervalMap[savedStrategy.interval] || 24000;
      } else if (savedStrategy.strategyType === 'news') {
        intervalMilliseconds = 300000; // Check news every 5 minutes
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
