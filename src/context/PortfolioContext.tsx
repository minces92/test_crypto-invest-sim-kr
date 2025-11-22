'use client';

import React, { createContext, useState, useContext, ReactNode, useRef, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { sendMessage } from '@/lib/telegram';
import { useData } from './DataProviderContext';
import { calculateSMA, calculateRSI, calculateBollingerBands, calculatePortfolioState } from '@/lib/utils';
import toast from 'react-hot-toast';


import { Asset, Transaction } from '@/lib/types';

// --- Interface 정의들 ---
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

export type Strategy = (DcaConfig | MaConfig | RsiConfig | BBandConfig | NewsStrategyConfig | VolatilityBreakoutConfig | MomentumConfig) & {
  id: string;
  isActive: boolean;
  name?: string;
  description?: string;
};

interface PortfolioContextType {
  cash: number;
  assets: Asset[];
  transactions: Transaction[];
  strategies: Strategy[];
  buyAsset: (market: string, price: number, amount: number, source: string, strategyType: string, isAuto: boolean) => boolean;
  sellAsset: (market: string, price: number, amount: number, source: string, strategyType: string, isAuto: boolean) => boolean;
  startStrategy: (strategy: Omit<Strategy, 'id' | 'isActive'>) => void;
  stopStrategy: (strategyId: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// INITIAL_CASH is now imported from '@/lib/constants'

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { data: settingsData, error: settingsError } = useSWR('/api/settings', fetcher);
  const initialCashValue = settingsData?.initial_cash ? Number(settingsData.initial_cash) : 1000000;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const { tickers } = useData();

  const strategyIntervalsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const tickersRef = useRef(tickers);
  const transactionsRef = useRef(transactions);

  useEffect(() => {
    tickersRef.current = tickers;
  }, [tickers]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

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

    // executeStrategy는 내부에서 최신 거래/시세 상태를 캡처해야 하므로 의도적으로 의존성에서 제외합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { assets, cash } = useMemo(() => calculatePortfolioState(transactions, initialCashValue), [transactions, initialCashValue]);

  const addTransaction = async (
    type: 'buy' | 'sell',
    market: string,
    price: number,
    amount: number,
    source: string,
    strategyType: string,
    isAuto: boolean
  ) => {
    const newTransaction: Transaction = {
      id: new Date().toISOString() + Math.random(),
      type,
      market,
      price,
      amount,
      timestamp: new Date().toISOString(),
      source,
      isAuto,
      strategyType,
    };

    // Optimistic update
    setTransactions(prevTransactions => [newTransaction, ...prevTransactions]);

    // Send Telegram notification (await result and log for diagnostics)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const typeText = type === 'buy' ? '📈 매수' : '📉 매도';
    const marketName = market.replace('KRW-', '');
    const totalCost = (price * amount).toLocaleString('ko-KR', { maximumFractionDigits: 0 });

    const message = `
<b>🔔 신규 거래 알림</b>
-------------------------
<b>종류:</b> ${typeText}
<b>종목:</b> ${marketName}
<b>수량:</b> ${amount.toFixed(6)}
<b>가격:</b> ${price.toLocaleString('ko-KR')} 원
<b>총액:</b> ${totalCost} 원
-------------------------
<a href="${siteUrl}">사이트에서 확인하기</a>
    `;

    // 서버가 저장 이후에 알림 전송 및 로깅을 담당합니다.

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction),
      });
      if (!response.ok) {
        console.error('Failed to save transaction, reverting optimistic update.');
        // Revert on failure
        setTransactions(prevTransactions => prevTransactions.filter(tx => tx.id !== newTransaction.id));
      }
    } catch (error) {
      console.error('Error saving transaction, reverting optimistic update:', error);
      // Revert on error
      setTransactions(prevTransactions => prevTransactions.filter(tx => tx.id !== newTransaction.id));
    }
  };

  const buyAsset = (market: string, price: number, amount: number, source: string, strategyType: string, isAuto: boolean): boolean => {
    const cost = price * amount;
    const { cash: currentCash } = calculatePortfolioState(transactions, initialCashValue);

    // 최소 거래 금액 (5000원) 체크
    if (cost < 5000) {
      console.log(`[${market}] 매수 금액이 최소 거래 금액(5,000원)보다 작아 취소되었습니다.`);
      toast.error('최소 거래 금액은 5,000원입니다.');
      return false;
    }

    if (currentCash < cost) {
      console.error(`[${market}] 현금이 부족하여 매수할 수 없습니다. (필요: ${cost.toLocaleString()}원, 보유: ${currentCash.toLocaleString()}원)`);
      toast.error(`현금이 부족합니다. (필요: ${cost.toLocaleString()}원)`);
      return false;
    }

    addTransaction('buy', market, price, amount, source, strategyType, isAuto);
    return true;
  };

  const sellAsset = (market: string, price: number, amount: number, source: string, strategyType: string, isAuto: boolean): boolean => {
    const { assets: currentAssets } = calculatePortfolioState(transactions, initialCashValue);
    const existingAsset = currentAssets.find(a => a.market === market);

    // 매도 가능 수량 체크 (0.00001와 같은 작은 오차 허용)
    if (!existingAsset || existingAsset.quantity < amount - 0.00001) {
      console.error(`[${market}] 매도 가능 수량이 부족하여 매도할 수 없습니다. (요청: ${amount}, 보유: ${existingAsset?.quantity || 0})`);
      toast.error('매도 가능 수량이 부족합니다.');
      return false;
    }

    // 실제 매도 수량은 보유 수량으로 제한
    const sellAmount = Math.min(amount, existingAsset.quantity);

    addTransaction('sell', market, price, sellAmount, source, strategyType, isAuto);
    return true;
  };

  // --- Strategy Execution ---
  const executeStrategy = async (strategy: Strategy) => {
    if (!strategy.isActive) return;

    const currentTickers = tickersRef.current;
    if (currentTickers.length === 0) return;

    const ticker = currentTickers.find(t => t.market === strategy.market);
    if (!ticker) return;

    if (strategy.strategyType === 'dca') {
      try {
        const currentPrice = ticker.trade_price;
        const change24h = ticker.signed_change_rate * 100 || 0;

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

              if (analysis.recommendation === '매도' && analysis.confidence > 0.7) {
                console.log(`[${strategy.market}] AI가 DCA 매수를 차단했습니다. 이유: ${analysis.reasoning}`);
                return;
              }

              let amountToBuy = strategy.amount / currentPrice;
              if (analysis.recommendation === '매수' && analysis.recommended_amount_percent) {
                const adjustedAmount = strategy.amount * (analysis.recommended_amount_percent / 100);
                amountToBuy = adjustedAmount / currentPrice;
                console.log(`[${strategy.market}] AI 추천에 따라 매수 금액 조정: ${analysis.recommended_amount_percent}%`);
              }

              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
            } else {
              const amountToBuy = strategy.amount / currentPrice;
              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
            }
          } catch (aiError) {
            console.warn('AI 검증 실패, 기본 DCA 실행:', aiError);
            const amountToBuy = strategy.amount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
          }
        } else {
          const amountToBuy = strategy.amount / currentPrice;
          buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
        }
      } catch (error) { console.error('DCA 실행 실패:', error); }
    } else if (strategy.strategyType === 'ma') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.longPeriod + 2}`);
        const candles = await response.json();
        if (candles.length < strategy.longPeriod + 2) return;

        const reversedCandles = [...candles].reverse();
        const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactionsRef.current);

        const shortMA = calculateSMA(reversedCandles, strategy.shortPeriod);
        const longMA = calculateSMA(reversedCandles, strategy.longPeriod);

        if (shortMA.length < 2 || longMA.length < 2) return;

        const lastShort = shortMA[shortMA.length - 1];
        const lastLong = longMA[longMA.length - 1];
        const prevShort = shortMA[shortMA.length - 2];
        const prevLong = longMA[longMA.length - 2];
        const currentPrice = ticker.trade_price;

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
                change24h: ticker.signed_change_rate * 100,
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

        if (lastShort > lastLong && prevShort <= prevLong) {
          if (aiAnalysis && aiAnalysis.recommendation === '매도' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 골든크로스 매수를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }

          const krwAmount = currentCash * 0.5;
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
          }
        }
        else if (lastShort < lastLong && prevShort >= prevLong) {
          if (aiAnalysis && aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 데드크로스 매도를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }

          const assetToSell = currentAssets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, currentPrice, assetToSell.quantity, strategy.id, strategy.strategyType, true);
          }
        }
      } catch (error) { console.error('MA 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'rsi') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.period + 1}`);
        const candles = await response.json();
        if (candles.length < strategy.period + 1) return;

        const reversedCandles = [...candles].reverse();
        const rsi = calculateRSI(reversedCandles, strategy.period);
        const lastRsi = rsi[rsi.length - 1];
        const currentPrice = ticker.trade_price;
        const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactionsRef.current);

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
                change24h: ticker.signed_change_rate * 100,
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
          if (aiAnalysis && aiAnalysis.recommendation === '매도' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 RSI 과매도 매수를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }

          const krwAmount = currentCash * 0.5;
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
          }
        } else if (lastRsi > strategy.sellThreshold) {
          if (aiAnalysis && aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 RSI 과매수 매도를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }

          const assetToSell = currentAssets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, currentPrice, assetToSell.quantity, strategy.id, strategy.strategyType, true);
          }
        }
      } catch (error) { console.error('RSI 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'bband') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=${strategy.period + 1}`);
        const candles = await response.json();
        if (candles.length < strategy.period + 1) return;

        const reversedCandles = [...candles].reverse();
        const bb = calculateBollingerBands(reversedCandles, strategy.period, strategy.multiplier);

        const currentPrice = ticker.trade_price;
        const lastUpper = bb.upper[bb.upper.length - 1];
        const lastLower = bb.lower[bb.lower.length - 1];
        const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactionsRef.current);

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
                change24h: ticker.signed_change_rate * 100,
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
          if (aiAnalysis && aiAnalysis.recommendation === '매도' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 볼린저밴드 하단 매수를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }

          const krwAmount = currentCash * 0.5;
          if (krwAmount > 5000) {
            const amountToBuy = krwAmount / currentPrice;
            buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
          }
        } else if (currentPrice > lastUpper) {
          if (aiAnalysis && aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.7) {
            console.log(`[${strategy.market}] AI가 볼린저밴드 상단 매도를 차단했습니다. 이유: ${aiAnalysis.reasoning}`);
            return;
          }

          const assetToSell = currentAssets.find(a => a.market === strategy.market);
          if (assetToSell && assetToSell.quantity > 0) {
            sellAsset(strategy.market, currentPrice, assetToSell.quantity * 0.5, strategy.id, strategy.strategyType, true);
          }
        }
      } catch (error) { console.error('BBand 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'news') {
      try {
        // Support global news scanner: market === 'ALL' or '*'
        const isGlobal = strategy.market === 'ALL' || strategy.market === '*';

        // Helper to process a single market's news
        const processMarket = async (marketCode: string) => {
          try {
            const query = marketCode.replace('KRW-', '');
            const response = await fetch(`/api/news?query=${encodeURIComponent(query)}&language=ko`);
            const newsArticles = await response.json();

            const relevantNews = Array.isArray(newsArticles)
              ? newsArticles.filter((article: any) => article.title && article.title.toLowerCase().includes(query.toLowerCase()))
              : [];

            if (relevantNews.length === 0) return;

            const { cash: currentCash, assets: currentAssets } = getPortfolioState(transactionsRef.current);
            const tickerForMarket = currentTickers.find(t => t.market === marketCode);
            const currentPriceForMarket = tickerForMarket?.trade_price;

            if (!currentPriceForMarket) {
              console.error(`[${marketCode}] 현재 가격을 가져올 수 없습니다.`);
              return;
            }

            const hasPositiveNews = relevantNews.some((article: any) => article.sentiment === 'positive');
            const hasNegativeNews = relevantNews.some((article: any) => article.sentiment === 'negative');

            // sentimentThreshold: 'positive' | 'negative' | 'both'
            const threshold = (strategy as any).sentimentThreshold || 'positive';

            if ((threshold === 'positive' || threshold === 'both') && hasPositiveNews) {
              console.log(`[${marketCode}] 호재 뉴스 감지! 매수 실행`);
              const krwAmount = currentCash * 0.5;
              if (krwAmount > 5000) {
                const amountToBuy = krwAmount / currentPriceForMarket;
                buyAsset(marketCode, currentPriceForMarket, amountToBuy, strategy.id, strategy.strategyType, true);
              }
            }

            if ((threshold === 'negative' || threshold === 'both') && hasNegativeNews) {
              console.log(`[${marketCode}] 악재 뉴스 감지! 매도 실행`);
              const assetToSell = currentAssets.find(a => a.market === marketCode);
              if (assetToSell && assetToSell.quantity > 0) {
                sellAsset(marketCode, currentPriceForMarket, assetToSell.quantity * 0.5, strategy.id, strategy.strategyType, true);
              }
            }
          } catch (err) {
            console.error('News 전략 시장 처리 실패:', err);
          }
        };

        if (isGlobal) {
          // iterate all tickers (throttle to avoid bursting the news API)
          for (let i = 0; i < currentTickers.length; i++) {
            const t = currentTickers[i];
            // small delay to avoid calling the news API for all markets at once
            // note: setTimeout inside loop would be non-blocking; use sequential await to keep it simple
            // we keep it simple here and call sequentially
            // skip markets that are not KRW pairs
            if (!t.market.startsWith('KRW-')) continue;
            // process each market sequentially
            // eslint-disable-next-line no-await-in-loop
            await processMarket(t.market);
          }
        } else {
          // specific market
          // eslint-disable-next-line no-await-in-loop
          await processMarket(strategy.market);
        }
      } catch (error) { console.error('News 전략 실행 실패:', error); }
    } else if (strategy.strategyType === 'volatility') {
      try {
        const response = await fetch(`/api/candles?market=${strategy.market}&count=2`);
        const candles = await response.json();
        if (candles.length < 2) return;

        const yesterday = candles[1];
        const currentPrice = ticker.trade_price;
        const range = yesterday.high_price - yesterday.low_price;
        const targetPrice = yesterday.high_price + (range * strategy.multiplier);

        if (currentPrice > targetPrice) {
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
                  change24h: ticker.signed_change_rate * 100,
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

          if (!aiAnalysis || (aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.6)) {
            const { cash: currentCash } = getPortfolioState(transactionsRef.current);
            const krwAmount = currentCash * 0.3;
            if (krwAmount > 5000) {
              const amountToBuy = krwAmount / currentPrice;
              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
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
        const currentPrice = ticker.trade_price;
        const pastPrice = reversedCandles[reversedCandles.length - strategy.period - 1].trade_price;

        const priceMomentum = ((currentPrice - pastPrice) / pastPrice) * 100;

        const recentVolumes = reversedCandles.slice(-strategy.period).map(c => c.candle_acc_trade_volume || 0);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        const currentVolume = recentVolumes[recentVolumes.length - 1] || 0;
        const volumeMomentum = currentVolume > 0 ? ((currentVolume - avgVolume) / avgVolume) * 100 : 0;

        if (priceMomentum > strategy.threshold && volumeMomentum > 20) {
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

          if (!aiAnalysis || (aiAnalysis.recommendation === '매수' && aiAnalysis.confidence > 0.65)) {
            const { cash: currentCash } = getPortfolioState(transactionsRef.current);
            const krwAmount = currentCash * 0.4;
            if (krwAmount > 5000) {
              const amountToBuy = krwAmount / currentPrice;
              buyAsset(strategy.market, currentPrice, amountToBuy, strategy.id, strategy.strategyType, true);
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
      } else if (savedStrategy.strategyType === 'volatility' || savedStrategy.strategyType === 'momentum') {
        intervalMilliseconds = 60000; // Check every 1 minute for volatility and momentum
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
