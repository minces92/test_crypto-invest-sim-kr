'use client';

import { usePortfolio, Strategy } from '@/context/PortfolioContext';
import { useData } from '@/context/DataProviderContext';
import toast from 'react-hot-toast';
import { ReactNode, useMemo, useState, useEffect } from 'react';
import { recommendedStrategies } from '@/lib/recommended-strategies';
import BacktestRunner from './BacktestRunner';
import StrategyBuilder from './StrategyBuilder';

type ViewMode = 'recommended' | 'simple' | 'custom';

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3 col-12">
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setOpen(!open)}
        style={{ width: '100%', justifyContent: 'space-between', display: 'flex' }}
      >
        <span>{title}</span>
        <span>{open ? '숨기기' : '펼치기'}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export default function AutoTrader() {
  const { strategies, startStrategy, stopStrategy, assets, sellAsset, circuitBreaker, setCircuitBreakerConfig, refreshTransactions } = usePortfolio();
  const { tickers } = useData();
  const [strategyType, setStrategyType] = useState('dca');
  const [viewMode, setViewMode] = useState<ViewMode>('recommended');
  const [showBacktest, setShowBacktest] = useState(false);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        } else {
          toast.error('설정을 불러오는 데 실패했습니다.');
        }
      } catch (error) {
        console.error(error);
        toast.error('설정을 불러오는 데 실패했습니다.');
      }
    };
    fetchSettings();
  }, []);

  const handleSettingChange = async (key: string, value: any) => {
    const oldSettings = { ...settings };
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      toast.success('설정이 업데이트되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('설정 업데이트에 실패했습니다.');
      // Revert UI on failure
      setSettings(oldSettings);
    }
  };

  // Trailing Stop State
  const [highPrices, setHighPrices] = useState<{ [market: string]: number }>({});

  // ... (existing form state)
  const [market, setMarket] = useState('KRW-BTC');
  const [dcaAmount, setDcaAmount] = useState('10000');
  const [dcaInterval, setDcaInterval] = useState('daily');
  const [maShortPeriod, setMaShortPeriod] = useState('5');
  const [maLongPeriod, setMaLongPeriod] = useState('20');
  const [rsiPeriod, setRsiPeriod] = useState('14');
  const [rsiBuyThreshold, setRsiBuyThreshold] = useState('30');
  const [rsiSellThreshold, setRsiSellThreshold] = useState('70');
  const [bbandPeriod, setBbandPeriod] = useState('20');
  const [bbandMultiplier, setBbandMultiplier] = useState('2');
  const [sentimentThreshold, setSentimentThreshold] = useState<'positive' | 'negative'>('positive');
  const [volatilityMultiplier, setVolatilityMultiplier] = useState('0.5');
  const [momentumPeriod, setMomentumPeriod] = useState('10');
  const [momentumThreshold, setMomentumThreshold] = useState('5');
  const [gridMinPrice, setGridMinPrice] = useState('50000');
  const [gridMaxPrice, setGridMaxPrice] = useState('60000');
  const [gridLines, setGridLines] = useState('5');
  const [gridAmount, setGridAmount] = useState('10000');

  // AI Autonomous State
  const [aiInterval, setAiInterval] = useState('minute60');
  const [aiConfidence, setAiConfidence] = useState('0.7');

  // AI Strategy State
  const [selectedStrategy, setSelectedStrategy] = useState<string>('dca');
  const [config, setConfig] = useState<any>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);

  // Multi-Coin AI State
  const [isMultiCoinMode, setIsMultiCoinMode] = useState(false);
  const [multiCoinResults, setMultiCoinResults] = useState<any[]>([]);
  const [selectedMultiMarkets, setSelectedMultiMarkets] = useState<string[]>([]);
  const [processingMarket, setProcessingMarket] = useState<string | null>(null);

  // Batch Backtest State
  const [batchBacktestLoading, setBatchBacktestLoading] = useState(false);
  const [batchBacktestResults, setBatchBacktestResults] = useState<any[]>([]);

  useEffect(() => {
    const strategy = recommendedStrategies.find(s => s.id === selectedStrategy);
    if (strategy) {
      setConfig(strategy.defaultConfig);
    }
  }, [selectedStrategy]);

  // Trailing Stop Logic
  useEffect(() => {
    if (!tickers || tickers.length === 0) return;

    strategies.forEach(strategy => {
      if (strategy.isActive && strategy.trailingStop && strategy.trailingStop.isActive) {
        const ticker = tickers.find(t => t.market === strategy.market);
        const asset = assets.find(a => a.market === strategy.market);

        if (ticker && asset && asset.quantity > 0) {
          const currentPrice = ticker.trade_price;
          const avgBuyPrice = asset.avg_buy_price;
          const currentProfitPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

          // 1. Check activation
          if (currentProfitPct >= strategy.trailingStop.activationPct) {
            const currentHigh = highPrices[strategy.market] || 0;

            // Update High Water Mark
            if (currentPrice > currentHigh) {
              setHighPrices(prev => ({ ...prev, [strategy.market]: currentPrice }));
            }

            // 2. Check Trailing Stop Condition
            // Only check if we have a valid high price established after activation
            if (currentHigh > 0) {
              const dropFromHighPct = ((currentHigh - currentPrice) / currentHigh) * 100;

              if (dropFromHighPct >= strategy.trailingStop.distancePct) {
                console.log(`[${strategy.market}] 트레일링 스탑 발동! 고점(${currentHigh}) 대비 ${dropFromHighPct.toFixed(2)}% 하락. 매도 실행.`);

                sellAsset(
                  strategy.market,
                  currentPrice,
                  asset.quantity,
                  strategy.id,
                  'trailing_stop',
                  true
                );

                // Reset high price after sell
                setHighPrices(prev => {
                  const newState = { ...prev };
                  delete newState[strategy.market];
                  return newState;
                });

                toast.success(`${strategy.market} 트레일링 스탑 매도 완료!`);
              }
            }
          }
        }
      }
    });
  }, [tickers, strategies, assets, highPrices, sellAsset]);

  const availableMarkets = [
    'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA',
    'KRW-AVAX', 'KRW-DOT', 'KRW-MATIC', 'KRW-TRX', 'KRW-SHIB', 'KRW-ETC',
    'KRW-BCH', 'KRW-LINK'
  ];

  // ... (rest of the component)

  const strategySummary = useMemo(() => {
    switch (strategyType) {
      case 'dca':
        return `${market.replace('KRW-', '')} | ${dcaInterval} | ${Number(dcaAmount).toLocaleString()}원`;
      case 'ma':
        return `${market.replace('KRW-', '')} | ${maShortPeriod}/${maLongPeriod}`;
      case 'rsi':
        return `${market.replace('KRW-', '')} | 기간 ${rsiPeriod} | ${rsiBuyThreshold}/${rsiSellThreshold}`;
      case 'bband':
        return `${market.replace('KRW-', '')} | 기간 ${bbandPeriod} 승수 ${bbandMultiplier}`;
      case 'news':
        return `${market.replace('KRW-', '')} | ${sentimentThreshold === 'positive' ? '긍정 뉴스 매수' : '부정 뉴스 매도'}`;
      case 'volatility':
        return `${market.replace('KRW-', '')} | 승수 ${volatilityMultiplier}`;
      case 'momentum':
        return `${market.replace('KRW-', '')} | 기간 ${momentumPeriod} | 임계값 ${momentumThreshold}%`;
      case 'grid':
        return `${market.replace('KRW-', '')} | ${Number(gridMinPrice).toLocaleString()}~${Number(gridMaxPrice).toLocaleString()} | ${gridLines}개`;
      case 'ai_autonomous':
        return `${market.replace('KRW-', '')} | AI 자율 매매 | 신뢰도 ${aiConfidence}+`;
      default:
        return '';
    }
  }, [strategyType, market, dcaInterval, dcaAmount, maShortPeriod, maLongPeriod, rsiPeriod, rsiBuyThreshold, rsiSellThreshold, bbandPeriod, bbandMultiplier, sentimentThreshold, volatilityMultiplier, momentumPeriod, momentumThreshold, gridMinPrice, gridMaxPrice, gridLines, aiInterval, aiConfidence]);

  const getStrategyConfig = () => {
    let strategyConfig: Omit<Strategy, 'id' | 'isActive'>;
    switch (strategyType) {
      case 'dca':
        strategyConfig = {
          strategyType: 'dca',
          market,
          amount: parseInt(dcaAmount, 10),
          interval: dcaInterval,
        } as any;
        break;
      case 'ma':
        strategyConfig = {
          strategyType: 'ma',
          market,
          shortPeriod: parseInt(maShortPeriod, 10),
          longPeriod: parseInt(maLongPeriod, 10),
        } as any;
        break;
      case 'rsi':
        strategyConfig = {
          strategyType: 'rsi',
          market,
          buyThreshold: parseInt(rsiBuyThreshold, 10),
          sellThreshold: parseInt(rsiSellThreshold, 10),
          period: parseInt(rsiPeriod, 10),
        } as any;
        break;
      case 'bband':
        strategyConfig = {
          strategyType: 'bband',
          market,
          period: parseInt(bbandPeriod, 10),
          multiplier: parseInt(bbandMultiplier, 10),
        } as any;
        break;
      case 'news':
        strategyConfig = {
          strategyType: 'news',
          market,
          sentimentThreshold,
        } as any;
        break;
      case 'volatility':
        strategyConfig = {
          strategyType: 'volatility',
          market,
          multiplier: parseFloat(volatilityMultiplier),
        } as any;
        break;
      case 'momentum':
        strategyConfig = {
          strategyType: 'momentum',
          market,
          period: parseInt(momentumPeriod, 10),
          threshold: parseFloat(momentumThreshold),
        } as any;
        break;
      case 'grid':
        strategyConfig = {
          strategyType: 'grid',
          market,
          minPrice: parseInt(gridMinPrice, 10),
          maxPrice: parseInt(gridMaxPrice, 10),
          gridLines: parseInt(gridLines, 10),
          amountPerGrid: parseInt(gridAmount, 10),
        } as any;
        break;
      case 'ai_autonomous':
        strategyConfig = {
          strategyType: 'ai_autonomous',
          market,
          interval: aiInterval,
          confidenceThreshold: parseFloat(aiConfidence),
        } as any;
        break;
      default:
        return null;
    }
    return strategyConfig;
  };

  const [isSyncingUpbit, setIsSyncingUpbit] = useState(false);

  // ... other state declarations

  const handleSyncUpbitWallet = async () => {
    setIsSyncingUpbit(true);
    try {
      const response = await fetch('/api/portfolio/sync-upbit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync Upbit wallet');
      }

      const data = await response.json();
      toast.success(data.message || '업비트 지갑 동기화 완료!');
      refreshTransactions(); // Refresh portfolio data
    } catch (error) {
      console.error('Error syncing Upbit wallet:', error);
      toast.error(`업비트 지갑 동기화 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSyncingUpbit(false);
    }
  };

  const handleAddStrategy = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const strategyConfig = getStrategyConfig();
    if (strategyConfig) {
      startStrategy(strategyConfig);
      toast.success('전략이 시작되었습니다.');
    }
  };

  // New handleStart for AI recommended strategies
  const handleStartAIStrategy = () => {
    if (!market || !selectedStrategy || !aiRecommendation) {
      toast.error('AI 추천 정보가 부족하여 전략을 시작할 수 없습니다.');
      return;
    }

    // Construct the strategy object based on the AI recommendation
    const aiStrategyConfig: any = {
      strategyType: selectedStrategy,
      market: market,
      ...config, // Spread the config parameters from AI
      name: `AI 추천: ${market.replace('KRW-', '')} ${selectedStrategy.toUpperCase()}`, // Create a dynamic name
      description: aiRecommendation.reasoning || `AI가 추천한 ${selectedStrategy} 전략입니다.`, // Use AI reasoning
    };

    startStrategy(aiStrategyConfig as any);
    toast.success(`AI 추천 전략(${aiStrategyConfig.name})이 시작되었습니다.`);
    // Reset selection
    setAiRecommendation(null);
  };

  const handleGetRecommendation = async () => {
    if (!market) {
      toast.error('마켓을 먼저 선택해주세요.');
      return;
    }

    setAiLoading(true);
    setAiRecommendation(null);

    try {
      const response = await fetch('/api/ai/recommend-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: market }),
      });

      if (!response.ok) throw new Error('Failed to get recommendation');

      const data = await response.json();
      setAiRecommendation(data);

      // Auto-select the recommended strategy
      if (data.recommendedStrategy) {
        setSelectedStrategy(data.recommendedStrategy);
        if (data.parameters) {
          setConfig((prev: any) => ({ ...prev, ...data.parameters }));
        }
      }
      toast.success('AI 추천 전략을 가져왔습니다.');

    } catch (error) {
      console.error(error);
      toast.error('AI 추천을 가져오는 데 실패했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGetBatchRecommendations = async () => {
    // If no markets selected, default to top 5 by volume
    const targets = selectedMultiMarkets.length > 0 ? selectedMultiMarkets : availableMarkets.slice(0, 5);

    setAiLoading(true);
    setMultiCoinResults([]); // Clear previous results

    try {
      for (const market of targets) {
        setProcessingMarket(market);

        try {
          // Use the single strategy recommendation endpoint sequentially
          const response = await fetch('/api/ai/recommend-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ market: market }),
          });

          if (!response.ok) {
            console.warn(`Failed to get recommendation for ${market}`);
            continue;
          }

          const data = await response.json();

          // Add to results immediately to show progress
          setMultiCoinResults(prev => [...prev, {
            market,
            ...data
          }]);

        } catch (err) {
          console.error(`Error processing ${market}:`, err);
        }

        // Small delay to allow UI to update and prevent total freezing if operations are heavy
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.success('일괄 분석이 완료되었습니다.');

    } catch (error) {
      console.error(error);
      toast.error('일괄 추천 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
      setProcessingMarket(null);
    }
  };

  const applyBatchStrategy = (result: any) => {
    if (!result || !result.recommendedStrategy) return;

    const aiStrategyConfig: any = {
      strategyType: result.recommendedStrategy,
      market: result.market,
      ...result.parameters,
      name: `AI 추천: ${result.market.replace('KRW-', '')} ${result.recommendedStrategy.toUpperCase()}`,
      description: result.reasoning || `AI가 추천한 ${result.recommendedStrategy} 전략`,
    };

    startStrategy(aiStrategyConfig);
    toast.success(`${result.market} 전략이 시작되었습니다.`);
  };

  const handleSaveCustomStrategy = (strategy: any) => {
    startStrategy(strategy);
    toast.success(`커스텀 전략 '${strategy.name}'이 시작되었습니다.`);
    setViewMode('recommended'); // Go back to main view or stay? Maybe stay to allow creating more.
  };

  const runBatchBacktest = async () => {
    const activeStrategies = strategies.filter(s => s.isActive);
    if (activeStrategies.length === 0) {
      toast.error('활성화된 전략이 없습니다.');
      return;
    }

    setBatchBacktestLoading(true);
    setBatchBacktestResults([]);

    const results = [];

    for (const strategy of activeStrategies) {
      try {
        const response = await fetch('/api/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy,
            market: strategy.market,
            interval: 'minute60',
            count: 168, // 1 week
          }),
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            id: strategy.id,
            strategyName: strategy.name || strategy.strategyType.toUpperCase(),
            market: strategy.market,
            totalReturn: data.totalReturn,
            winRate: data.winRate,
            tradeCount: data.tradeCount
          });
        }
      } catch (e) {
        console.error(e);
      }
    }

    setBatchBacktestResults(results);
    setBatchBacktestLoading(false);
    toast.success('전체 전략 백테스팅 완료');
  };

  const renderCustomInputs = () => (
    <>
      {strategyType === 'news' && (
        <div className="form-group mb-3 col-12">
          <div className="form-group-header"><label htmlFor="sentiment-threshold-select">감성 임계값</label></div>
          <div className="form-group-body">
            <select id="sentiment-threshold-select" className="form-select" value={sentimentThreshold} onChange={e => setSentimentThreshold(e.target.value as 'positive' | 'negative')}>
              <option value="positive">긍정 뉴스 (매수)</option>
              <option value="negative">부정 뉴스 (매도)</option>
            </select>
          </div>
        </div>
      )}

      {strategyType === 'dca' && (
        <>
          <div className="form-group mb-3 col-12">
            <div className="form-group-header"><label htmlFor="dca-interval-select">매수 주기</label></div>
            <div className="form-group-body">
              <select id="dca-interval-select" className="form-select" value={dcaInterval} onChange={e => setDcaInterval(e.target.value)}>
                <option value="daily">매일 (24초)</option>
                <option value="weekly">매주 (1분)</option>
                <option value="monthly">매월 (5분)</option>
              </select>
            </div>
          </div>
          <div className="form-group mb-3 col-12">
            <div className="form-group-header"><label htmlFor="dca-amount-input">1회 매수 금액(원)</label></div>
            <div className="form-group-body">
              <input id="dca-amount-input" type="number" className="form-control" value={dcaAmount} onChange={e => setDcaAmount(e.target.value)} step="1000" />
            </div>
          </div>
        </>
      )}

      {strategyType === 'ma' && (
        <div className="row gutter-spacious">
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="ma-short-period-input">단기 이평선</label></div>
            <div className="form-group-body"><input id="ma-short-period-input" type="number" className="form-control" value={maShortPeriod} onChange={e => setMaShortPeriod(e.target.value)} /></div>
          </div>
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="ma-long-period-input">장기 이평선</label></div>
            <div className="form-group-body"><input id="ma-long-period-input" type="number" className="form-control" value={maLongPeriod} onChange={e => setMaLongPeriod(e.target.value)} /></div>
          </div>
        </div>
      )}

      {strategyType === 'rsi' && (
        <div className="row gutter-spacious">
          <div className="form-group mb-3 col-4">
            <div className="form-group-header"><label htmlFor="rsi-period-input">RSI 기간</label></div>
            <div className="form-group-body"><input id="rsi-period-input" type="number" className="form-control" value={rsiPeriod} onChange={e => setRsiPeriod(e.target.value)} /></div>
          </div>
          <div className="form-group mb-3 col-4">
            <div className="form-group-header"><label htmlFor="rsi-buy-threshold-input">과매도 기준</label></div>
            <div className="form-group-body"><input id="rsi-buy-threshold-input" type="number" className="form-control" value={rsiBuyThreshold} onChange={e => setRsiBuyThreshold(e.target.value)} /></div>
          </div>
          <div className="form-group mb-3 col-4">
            <div className="form-group-header"><label htmlFor="rsi-sell-threshold-input">과매수 기준</label></div>
            <div className="form-group-body"><input id="rsi-sell-threshold-input" type="number" className="form-control" value={rsiSellThreshold} onChange={e => setRsiSellThreshold(e.target.value)} /></div>
          </div>
        </div>
      )}

      {strategyType === 'bband' && (
        <div className="row gutter-spacious">
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="bband-period-input">기간</label></div>
            <div className="form-group-body"><input id="bband-period-input" type="number" className="form-control" value={bbandPeriod} onChange={e => setBbandPeriod(e.target.value)} /></div>
          </div>
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="bband-multiplier-input">승수</label></div>
            <div className="form-group-body"><input id="bband-multiplier-input" type="number" className="form-control" value={bbandMultiplier} onChange={e => setBbandMultiplier(e.target.value)} step="0.1" /></div>
          </div>
        </div>
      )}

      {strategyType === 'volatility' && (
        <div className="form-group mb-3 col-12">
          <div className="form-group-header"><label htmlFor="volatility-multiplier-input">변동성 승수</label></div>
          <div className="form-group-body"><input id="volatility-multiplier-input" type="number" className="form-control" value={volatilityMultiplier} onChange={e => setVolatilityMultiplier(e.target.value)} step="0.1" min="0.1" max="2" /></div>
          <small className="color-fg-muted text-small">전일 고가 + (전일 범위 × 승수)를 돌파하면 매수 (기본값: 0.5)</small>
        </div>
      )}

      {strategyType === 'momentum' && (
        <div className="row gutter-spacious">
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="momentum-period-input">모멘텀 기간</label></div>
            <div className="form-group-body"><input id="momentum-period-input" type="number" className="form-control" value={momentumPeriod} onChange={e => setMomentumPeriod(e.target.value)} min="5" max="30" /></div>
          </div>
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="momentum-threshold-input">모멘텀 임계값 (%)</label></div>
            <div className="form-group-body"><input id="momentum-threshold-input" type="number" className="form-control" value={momentumThreshold} onChange={e => setMomentumThreshold(e.target.value)} step="0.5" min="1" max="20" /></div>
            <small className="color-fg-muted text-small">가격/거래량 모멘텀이 모두 기준을 넘으면 진입</small>
          </div>
        </div>
      )}

      {strategyType === 'grid' && (
        <div className="row gutter-spacious">
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="grid-min-price-input">최저 가격</label></div>
            <div className="form-group-body"><input id="grid-min-price-input" type="number" className="form-control" value={gridMinPrice} onChange={e => setGridMinPrice(e.target.value)} /></div>
          </div>
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="grid-max-price-input">최고 가격</label></div>
            <div className="form-group-body"><input id="grid-max-price-input" type="number" className="form-control" value={gridMaxPrice} onChange={e => setGridMaxPrice(e.target.value)} /></div>
          </div>
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="grid-lines-input">그리드 개수</label></div>
            <div className="form-group-body"><input id="grid-lines-input" type="number" className="form-control" value={gridLines} onChange={e => setGridLines(e.target.value)} /></div>
          </div>
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="grid-amount-input">그리드 당 투자금</label></div>
            <div className="form-group-body"><input id="grid-amount-input" type="number" className="form-control" value={gridAmount} onChange={e => setGridAmount(e.target.value)} /></div>
          </div>
        </div>
      )}

      {strategyType === 'ai_autonomous' && (
        <div className="row gutter-spacious">
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="ai-interval-select">분석 주기</label></div>
            <div className="form-group-body">
              <select id="ai-interval-select" className="form-select" value={aiInterval} onChange={e => setAiInterval(e.target.value)}>
                <option value="minute15">15분</option>
                <option value="minute30">30분</option>
                <option value="minute60">1시간</option>
                <option value="minute240">4시간</option>
                <option value="day">1일</option>
              </select>
            </div>
          </div>
          <div className="form-group mb-3 col-6">
            <div className="form-group-header"><label htmlFor="ai-confidence-input">최소 신뢰도 (0.1 ~ 1.0)</label></div>
            <div className="form-group-body">
              <input
                id="ai-confidence-input"
                type="number"
                className="form-control"
                value={aiConfidence}
                onChange={e => setAiConfidence(e.target.value)}
                step="0.1"
                min="0.1"
                max="1.0"
              />
            </div>
            <small className="color-fg-muted text-small">AI의 확신이 이 값 이상일 때만 거래합니다.</small>
          </div>
          <div className="col-12">
            <div className="flash flash-warn">
              <strong>주의:</strong> AI 자율 매매는 시장 상황에 따라 예측하지 못한 손실을 입을 수 있습니다. 소액으로 테스트 후 사용하세요.
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="Box mt-4 p-3 border">
      <div className="Box-header text-center">
        <h2 className="Box-title">자동 매매</h2>
      </div>

      <CollapsibleSection title="🤖 업비트 연동 AI 자동 투자" defaultOpen>
        <div className="Box-body">
          <p className="color-fg-muted text-small mb-3">
            업비트 계좌의 자산을 기반으로 모의 투자를 시작합니다. AI가 자동으로 전체 포트폴리오를 분석하고 주기적으로 매수/매도 결정을 내립니다.
            <br />
            <strong>주의:</strong> 이 기능은 실제 업비트 계좌로 거래하지 않으며, 앱 내에서 가상으로만 진행됩니다.
          </p>
          <div className="form-group d-flex flex-justify-between flex-items-center">
            <div className="form-group-header">
              <label htmlFor="ai-autotrade-toggle">AI 자동 투자 활성화</label>
            </div>
            <div className="form-group-body">
              <label className="form-switch">
                <input
                  type="checkbox"
                  id="ai-autotrade-toggle"
                  checked={settings.isAIAutoTradingEnabled || false}
                  onChange={(e) => handleSettingChange('isAIAutoTradingEnabled', e.target.checked)}
                />
                <i className="form-switch-icon"></i>
              </label>
            </div>
          </div>
           <div className="d-flex flex-justify-between flex-items-center mt-2">
              <span className="text-small">
                현재 상태: {settings.isAIAutoTradingEnabled ? <span className="Label Label--success">활성화</span> : <span className="Label Label--secondary">비활성화</span>}
              </span>
              <button 
                className="btn btn-sm" 
                onClick={handleSyncUpbitWallet}
                disabled={!settings.isAIAutoTradingEnabled || isSyncingUpbit}
              >
                {isSyncingUpbit ? '동기화 중...' : '업비트 지갑 동기화'}
              </button>
            </div>
        </div>
      </CollapsibleSection>

      <div className="Box-body">
        <div className="d-flex flex-justify-center mb-3" style={{ gap: '8px' }}>
          <button
            className={`btn btn-sm ${viewMode === 'recommended' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('recommended')}
            type="button"
          >
            추천 전략
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'simple' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('simple')}
            type="button"
          >
            간편 설정
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'custom' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('custom')}
            type="button"
          >
            커스텀 빌더
          </button>
        </div>

        {viewMode === 'recommended' && (
          <>
            <p className="color-fg-muted text-small text-center mb-3">검증된 프리셋을 한 번의 클릭으로 실행하세요.</p>
            <div className="d-flex flex-wrap flex-justify-center" style={{ gap: '16px' }}>
              {recommendedStrategies.map((rec, index) => (
                <div key={index} className="Box p-3" style={{ flex: '1 1 250px', maxWidth: '400px' }}>
                  <h4 className="f5 mb-1">{rec.name}</h4>
                  <p className="color-fg-muted text-small mb-3">{rec.description}</p>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => startStrategy(rec)}
                  >
                    전략 추가
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {viewMode === 'custom' && (
          <>
            {/* Replaced with StrategyBuilder */}
          </>
        )}

        {viewMode === 'simple' && (
          <>
            <p className="color-fg-muted text-small text-center mb-3">필요한 입력만 펼쳐서 채우면 모바일에서도 손쉽게 설정할 수 있습니다.</p>
            <form onSubmit={handleAddStrategy} className="d-flex flex-column flex-items-center">
              <div className="Box color-bg-subtle p-3 mb-3" style={{ width: '100%', maxWidth: 720 }}>
                <strong className="d-block mb-1">현재 설정 요약</strong>
                <span className="color-fg-muted text-small">{strategySummary}</span>
              </div>

              <div className="Box color-bg-subtle p-3 mb-3" style={{ width: '100%', maxWidth: 720, border: '1px dashed #0969da' }}>
                <div className="d-flex flex-justify-between flex-items-center mb-2">
                  <strong className="d-flex flex-items-center">
                    <span className="mr-2">🤖 AI 전략 추천</span>
                    {aiLoading && <span className="AnimatedEllipsis">분석 중</span>}
                  </strong>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${!isMultiCoinMode ? 'btn-primary' : ''}`}
                      onClick={() => setIsMultiCoinMode(false)}
                    >
                      단일 코인
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${isMultiCoinMode ? 'btn-primary' : ''}`}
                      onClick={() => setIsMultiCoinMode(true)}
                    >
                      다중 코인 (Beta)
                    </button>
                  </div>
                </div>

                {!isMultiCoinMode ? (
                  <>
                    <div className="d-flex flex-justify-between flex-items-center mb-2">
                      <p className="text-small color-fg-muted mb-0">
                        현재 선택된 마켓({market})의 데이터를 분석하여 최적의 전략을 제안합니다.
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleGetRecommendation}
                        disabled={aiLoading || !market}
                      >
                        {aiLoading ? '분석 중...' : 'AI 추천 받기'}
                      </button>
                    </div>

                    {aiRecommendation && (
                      <div className="flash flash-success mt-2">
                        <div className="d-flex flex-justify-between flex-items-start">
                          <div>
                            <strong>추천 전략: {aiRecommendation.recommendedStrategy}</strong>
                            <p className="text-small mt-1 mb-1">{aiRecommendation.reasoning}</p>
                            <div className="text-small color-fg-muted">
                              설정값: {JSON.stringify(aiRecommendation.parameters)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={handleStartAIStrategy}
                          >
                            이 전략 적용하기
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="d-flex flex-justify-between flex-items-center mb-2">
                      <p className="text-small color-fg-muted mb-0">
                        상위 5개 코인에 대해 AI가 최적의 전략을 일괄 추천합니다.
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleGetBatchRecommendations}
                        disabled={aiLoading}
                      >
                        {aiLoading ? '일괄 분석 중...' : '전체 추천 받기'}
                      </button>
                    </div>

                    {aiLoading && processingMarket && (
                      <div className="flash flash-warn mb-2 mt-3">
                        <span className="AnimatedEllipsis">
                          <strong>{processingMarket}</strong> 분석 중
                        </span>
                      </div>
                    )}

                    {multiCoinResults.length > 0 && (
                      <div className="mt-3">
                        {multiCoinResults.map((res, idx) => (
                          <div key={idx} className="Box p-2 mb-2 color-bg-default">
                            <div className="d-flex flex-justify-between flex-items-start">
                              <div>
                                <div className="f5 font-bold">{res.market} <span className="Label Label--info">{res.recommendedStrategy}</span></div>
                                <p className="text-small color-fg-muted mt-1 mb-1">{res.reasoning}</p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => applyBatchStrategy(res)}
                              >
                                적용
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <CollapsibleSection title="기본 정보" defaultOpen>
                <div className="row gutter-spacious">
                  <div className="form-group mb-3 col-6">
                    <div className="form-group-header"><label htmlFor="strategy-select">전략 선택</label></div>
                    <div className="form-group-body">
                      <select id="strategy-select" className="form-select" value={strategyType} onChange={e => setStrategyType(e.target.value)}>
                        <option value="dca">적립식 (DCA)</option>
                        <option value="ma">이동평균선 교차</option>
                        <option value="rsi">RSI</option>
                        <option value="bband">볼린저 밴드</option>
                        <option value="news">뉴스 기반</option>
                        <option value="volatility">변동성 돌파</option>
                        <option value="momentum">모멘텀</option>
                        <option value="grid">그리드 매매 (Grid)</option>
                        <option value="ai_autonomous">AI 자율 매매 (Beta)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group mb-3 col-6">
                    <div className="form-group-header"><label htmlFor="market-select">코인 선택</label></div>
                    <div className="form-group-body">
                      <select id="market-select" className="form-select" value={market} onChange={e => setMarket(e.target.value)}>
                        {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-', '')}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="전략 파라미터" defaultOpen>
                <div className="row gutter-spacious">
                  {renderCustomInputs()}
                </div>
              </CollapsibleSection>

              <div className="d-flex flex-justify-center mt-3" style={{ width: '100%' }}>
                <button type="submit" className="btn btn-primary" style={{ minWidth: 180 }}>전략 추가</button>
              </div>
            </form>
          </>
        )}

        {viewMode === 'custom' && (
          <>
            <p className="color-fg-muted text-small text-center mb-3">
              지표와 조건을 조합하여 나만의 알고리즘을 만들어보세요.
            </p>
            <StrategyBuilder onSave={handleSaveCustomStrategy} initialMarket={market} />
          </>
        )}

        {/* Backtest Section */}
        {market && (
          <div className="mt-4">
            <button
              className="btn"
              type="button"
              onClick={() => setShowBacktest(!showBacktest)}
            >
              {showBacktest ? '백테스팅 숨기기' : '현재 설정으로 백테스팅'}
            </button>

            {showBacktest && (
              <BacktestRunner
                market={market}
                strategy={getStrategyConfig() as any}
              />
            )}
          </div>
        )}

        {/* Batch Backtest Section */}
        <div className="Box mt-4">
          <div className="Box-header d-flex flex-justify-between flex-items-center">
            <h3 className="Box-title">전체 전략 백테스팅</h3>
            <button
              className="btn btn-sm"
              onClick={runBatchBacktest}
              disabled={batchBacktestLoading}
            >
              {batchBacktestLoading ? '분석 중...' : '모든 활성 전략 테스트 (1주)'}
            </button>
          </div>
          {batchBacktestResults.length > 0 && (
            <div className="Box-body">
              <table className="width-full text-small">
                <thead>
                  <tr className="text-left">
                    <th>전략/마켓</th>
                    <th>수익률</th>
                    <th>승률</th>
                    <th>거래횟수</th>
                  </tr>
                </thead>
                <tbody>
                  {batchBacktestResults.map((res, i) => (
                    <tr key={i} className="border-bottom">
                      <td>
                        <div className="text-bold">{res.market}</div>
                        <div className="color-fg-muted">{res.strategyName}</div>
                      </td>
                      <td className={res.totalReturn >= 0 ? 'color-fg-success' : 'color-fg-danger'}>
                        {res.totalReturn.toFixed(2)}%
                      </td>
                      <td>{res.winRate.toFixed(1)}%</td>
                      <td>{res.tradeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="Box mt-4">
          <div className="Box-header d-flex flex-justify-between flex-items-center">
            <h3 className="Box-title">🛡️ 리스크 관리 (서킷 브레이커)</h3>
            {circuitBreaker.triggered && <span className="Label Label--danger">발동됨</span>}
          </div>
          <div className="Box-body">
            <div className="d-flex flex-items-center mb-3">
              <input
                type="checkbox"
                id="cb-active"
                className="mr-2"
                checked={circuitBreaker.isActive}
                onChange={(e) => setCircuitBreakerConfig({ isActive: e.target.checked })}
              />
              <label htmlFor="cb-active" className="text-bold cursor-pointer">서킷 브레이커 활성화</label>
            </div>

            {circuitBreaker.isActive && (
              <div className="form-group">
                <div className="form-group-header">
                  <label htmlFor="cb-threshold">손실 제한 (%)</label>
                </div>
                <div className="form-group-body d-flex flex-items-center">
                  <input
                    id="cb-threshold"
                    type="number"
                    className="form-control mr-2"
                    style={{ maxWidth: '100px' }}
                    value={circuitBreaker.threshold}
                    onChange={(e) => setCircuitBreakerConfig({ threshold: parseFloat(e.target.value) })}
                    disabled={circuitBreaker.triggered}
                  />
                  <span className="text-small color-fg-muted">
                    총 자산이 초기 자본 대비 이 비율만큼 감소하면 모든 매수를 중단합니다.
                  </span>
                </div>
              </div>
            )}

            {circuitBreaker.triggered && (
              <div className="flash flash-error mt-3">
                <strong>서킷 브레이커가 발동되었습니다!</strong>
                <p>
                  설정된 손실 한도({circuitBreaker.threshold}%)를 초과하여 추가 매수가 차단되었습니다.
                  <br />
                  발동 시간: {new Date(circuitBreaker.triggeredAt!).toLocaleString()}
                </p>
                <button
                  className="btn btn-sm btn-danger mt-2"
                  onClick={() => setCircuitBreakerConfig({ triggered: false, triggeredAt: undefined })}
                >
                  해제 및 재시작
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="Box mt-4">
          <div className="Box-header">
            <h3 className="Box-title">활성 전략 목록</h3>
          </div>
          {strategies.length === 0 ? (
            <div className="Box-body text-center color-fg-muted">
              실행 중인 전략이 없습니다.
            </div>
          ) : (
            <ul>
              {strategies.map(s => (
                <li key={s.id} className="Box-row d-flex flex-justify-between flex-items-center">
                  <div>
                    <div className="f4 font-bold">{s.market} <span className={`Label Label--${s.isActive ? 'success' : 'secondary'}`}>{s.strategyType.toUpperCase()}</span></div>
                    <div className="text-small color-fg-muted">
                      {s.strategyType === 'dca' && `적립식 (${s.amount?.toLocaleString() ?? 'N/A'}원 / ${s.interval ?? 'N/A'})`}
                      {s.strategyType === 'ma' && `이평선 교차 (${s.shortPeriod ?? 'N/A'} / ${s.longPeriod ?? 'N/A'})`}
                      {s.strategyType === 'rsi' && `RSI (${s.period ?? 'N/A'}, ${s.buyThreshold ?? 'N/A'}/${s.sellThreshold ?? 'N/A'})`}
                      {s.strategyType === 'bband' && `볼린저 밴드 (${s.period ?? 'N/A'}, ${s.multiplier ?? 'N/A'})`}
                      {s.strategyType === 'news' && `뉴스 기반 (${s.sentimentThreshold === 'positive' ? '긍정' : '부정'})`}
                      {s.strategyType === 'volatility' && `변동성 돌파 (승수: ${s.multiplier ?? 'N/A'})`}
                      {s.strategyType === 'momentum' && `모멘텀 (기간: ${s.period ?? 'N/A'}, 임계값: ${s.threshold ?? 'N/A'}%)`}
                      {s.trailingStop?.isActive && ` | 🛡️ 트레일링 스탑 (발동: ${s.trailingStop.activationPct}%, 감지: ${s.trailingStop.distancePct}%)`}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => stopStrategy(s.id)}>중지</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
