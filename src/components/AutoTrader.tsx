'use client';

import { usePortfolio, Strategy } from '@/context/PortfolioContext';
import toast from 'react-hot-toast';
import { ReactNode, useMemo, useState, useEffect } from 'react';
import { recommendedStrategies } from '@/lib/recommended-strategies';
import BacktestRunner from './BacktestRunner';

type ViewMode = 'recommended' | 'custom';

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
  const { strategies, startStrategy, stopStrategy } = usePortfolio();
  const [strategyType, setStrategyType] = useState('dca');
  const [viewMode, setViewMode] = useState<ViewMode>('recommended');
  const [showBacktest, setShowBacktest] = useState(false);

  // Form state
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

  // AI Strategy State
  const [selectedStrategy, setSelectedStrategy] = useState<string>('dca');
  const [config, setConfig] = useState<any>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);

  // Multi-Coin AI State
  const [isMultiCoinMode, setIsMultiCoinMode] = useState(false);
  const [multiCoinResults, setMultiCoinResults] = useState<any[]>([]);
  const [selectedMultiMarkets, setSelectedMultiMarkets] = useState<string[]>([]);

  useEffect(() => {
    const strategy = recommendedStrategies.find(s => s.id === selectedStrategy);
    if (strategy) {
      setConfig(strategy.defaultConfig);
    }
  }, [selectedStrategy]);

  const availableMarkets = [
    'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA',
    'KRW-AVAX', 'KRW-DOT', 'KRW-MATIC', 'KRW-TRX', 'KRW-SHIB', 'KRW-ETC',
    'KRW-BCH', 'KRW-LINK'
  ];

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
      default:
        return '';
    }
  }, [strategyType, market, dcaInterval, dcaAmount, maShortPeriod, maLongPeriod, rsiPeriod, rsiBuyThreshold, rsiSellThreshold, bbandPeriod, bbandMultiplier, sentimentThreshold, volatilityMultiplier, momentumPeriod, momentumThreshold]);

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
      default:
        return null;
    }
    return strategyConfig;
  };

  const handleAddStrategy = () => {
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
    // If no markets selected, default to top 5 by volume (simplified: just first 5 available)
    const targets = selectedMultiMarkets.length > 0 ? selectedMultiMarkets : availableMarkets.slice(0, 5);

    setAiLoading(true);
    setMultiCoinResults([]);

    try {
      const response = await fetch('/api/ai/recommend-strategies-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markets: targets }),
      });

      if (!response.ok) throw new Error('Failed to get batch recommendations');

      const data = await response.json();
      setMultiCoinResults(data.results || []);
      toast.success(`${data.results?.length || 0}개의 코인에 대한 추천을 가져왔습니다.`);

    } catch (error) {
      console.error(error);
      toast.error('일괄 추천을 가져오는 데 실패했습니다.');
    } finally {
      setAiLoading(false);
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
    </>
  );

  return (
    <div className="Box mt-4 p-3 border">
      <div className="Box-header text-center">
        <h2 className="Box-title">자동 매매</h2>
      </div>
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
            className={`btn btn-sm ${viewMode === 'custom' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('custom')}
            type="button"
          >
            나만의 전략
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

                    {aiLoading && (
                      <div className="mt-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="Box p-2 mb-2 color-bg-subtle" style={{ opacity: 0.6 }}>
                            <div className="d-flex flex-justify-between flex-items-start">
                              <div style={{ width: '100%' }}>
                                <div className="skeleton-box" style={{ width: '120px', height: '20px', marginBottom: '8px', backgroundColor: '#e1e4e8' }}></div>
                                <div className="skeleton-box" style={{ width: '80%', height: '16px', backgroundColor: '#e1e4e8' }}></div>
                              </div>
                            </div>
                          </div>
                        ))}
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
