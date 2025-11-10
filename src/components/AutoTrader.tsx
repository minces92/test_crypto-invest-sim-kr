'use client';

import { usePortfolio, Strategy } from '@/context/PortfolioContext';
import { useState } from 'react';
import { recommendedStrategies } from '@/lib/recommended-strategies';

export default function AutoTrader() {
  const { strategies, startStrategy, stopStrategy } = usePortfolio();
  const [strategyType, setStrategyType] = useState('dca');

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

  const availableMarkets = [
    'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA', 
    'KRW-AVAX', 'KRW-DOT', 'KRW-MATIC', 'KRW-TRX', 'KRW-SHIB', 'KRW-ETC', 
    'KRW-BCH', 'KRW-LINK'
  ];

  const handleAddStrategy = (e: React.FormEvent) => {
    e.preventDefault();
    let strategyConfig: Omit<Strategy, 'id' | 'isActive'>;

    switch (strategyType) {
      case 'dca':
        strategyConfig = {
          strategyType: 'dca',
          market,
          amount: parseInt(dcaAmount, 10),
          interval: dcaInterval,
        };
        break;
      case 'ma':
        strategyConfig = {
          strategyType: 'ma',
          market,
          shortPeriod: parseInt(maShortPeriod, 10),
          longPeriod: parseInt(maLongPeriod, 10),
        };
        break;
      case 'rsi':
        strategyConfig = {
          strategyType: 'rsi',
          market,
          period: parseInt(rsiPeriod, 10),
          buyThreshold: parseInt(rsiBuyThreshold, 10),
          sellThreshold: parseInt(rsiSellThreshold, 10),
        };
        break;
      case 'bband':
        strategyConfig = {
          strategyType: 'bband',
          market,
          period: parseInt(bbandPeriod, 10),
          multiplier: parseInt(bbandMultiplier, 10),
        };
        break;
      case 'news':
        strategyConfig = {
          strategyType: 'news',
          market,
          sentimentThreshold,
        };
        break;
      case 'volatility':
        strategyConfig = {
          strategyType: 'volatility',
          market,
          multiplier: parseFloat(volatilityMultiplier),
        };
        break;
      case 'momentum':
        strategyConfig = {
          strategyType: 'momentum',
          market,
          period: parseInt(momentumPeriod, 10),
          threshold: parseFloat(momentumThreshold),
        };
        break;
      default:
        return;
    }
    startStrategy(strategyConfig);
  };

  return (
    <div className="Box mt-4 p-3 border">
      <div className="Box-header text-center">
        <h2 className="Box-title">자동 매매</h2>
      </div>
      <div className="Box-body">
        <div className="text-center">
          <h3 className="f4 mb-3">추천 전략</h3>
        </div>
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

        <hr className="my-4" />

        <div className="text-center">
          <h3 className="f4 mb-3">나만의 전략 만들기</h3>
        </div>
        <form onSubmit={handleAddStrategy} className="d-flex flex-column flex-items-center">
          <div className="form-group mb-3 col-8">
            <div className="form-group-header"><label htmlFor="strategy-select">전략 선택</label></div>
            <div className="form-group-body">            <select id="strategy-select" className="form-select" value={strategyType} onChange={e => setStrategyType(e.target.value)}>
              <option value="dca">적립식 (DCA)</option>
              <option value="ma">이동평균선 교차</option>
              <option value="rsi">RSI</option>
              <option value="bband">볼린저 밴드</option>
              <option value="news">뉴스 기반</option>
              <option value="volatility">변동성 돌파</option>
              <option value="momentum">모멘텀</option>
            </select></div>
          </div>

          <div className="form-group mb-3 col-8">
            <div className="form-group-header"><label htmlFor="market-select">코인 선택</label></div>
            <div className="form-group-body"><select id="market-select" className="form-select" value={market} onChange={e => setMarket(e.target.value)}>
              {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-','')}</option>)}
            </select></div>
          </div>

          {strategyType === 'news' && (
            <div className="form-group mb-3 col-8">
              <div className="form-group-header"><label htmlFor="sentiment-threshold-select">감성 임계값</label></div>
              <div className="form-group-body"><select id="sentiment-threshold-select" className="form-select" value={sentimentThreshold} onChange={e => setSentimentThreshold(e.target.value as 'positive' | 'negative')}> 
                <option value="positive">긍정 뉴스 (매수)</option>
                <option value="negative">부정 뉴스 (매도)</option>
              </select></div>
            </div>
          )}

          {strategyType === 'dca' && (
            <>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="dca-interval-select">매수 주기</label></div>
                <div className="form-group-body"><select id="dca-interval-select" className="form-select" value={dcaInterval} onChange={e => setDcaInterval(e.target.value)}>
                  <option value="daily">매일 (24초)</option>
                  <option value="weekly">매주 (1분)</option>
                  <option value="monthly">매월 (5분)</option>
                </select></div>
              </div>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="dca-amount-input">1회 매수 금액(원)</label></div>
                <div className="form-group-body"><input id="dca-amount-input" type="number" className="form-control" value={dcaAmount} onChange={e => setDcaAmount(e.target.value)} step="1000" /></div>
              </div>
            </>
          )}

          {strategyType === 'ma' && (
            <>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="ma-short-period-input">단기 이평선</label></div>
                <div className="form-group-body"><input id="ma-short-period-input" type="number" className="form-control" value={maShortPeriod} onChange={e => setMaShortPeriod(e.target.value)} /></div>
              </div>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="ma-long-period-input">장기 이평선</label></div>
                <div className="form-group-body"><input id="ma-long-period-input" type="number" className="form-control" value={maLongPeriod} onChange={e => setMaLongPeriod(e.target.value)} /></div>
              </div>
            </>
          )}

          {strategyType === 'rsi' && (
            <>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="rsi-period-input">RSI 기간</label></div>
                <div className="form-group-body"><input id="rsi-period-input" type="number" className="form-control" value={rsiPeriod} onChange={e => setRsiPeriod(e.target.value)} /></div>
              </div>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="rsi-buy-threshold-input">과매도 기준 (매수)</label></div>
                <div className="form-group-body"><input id="rsi-buy-threshold-input" type="number" className="form-control" value={rsiBuyThreshold} onChange={e => setRsiBuyThreshold(e.target.value)} /></div>
              </div>
                            <div className="form-group mb-3 col-8">
                              <div className="form-group-header"><label htmlFor="rsi-sell-threshold-input">과매수 기준 (매도)</label></div>
                              <div className="form-group-body"><input id="rsi-sell-threshold-input" type="number" className="form-control" value={rsiSellThreshold} onChange={e => setRsiSellThreshold(e.target.value)} /></div>
                            </div>
                          </> 
                        )}
              
                        {strategyType === 'bband' && (
                          <>
                            <div className="form-group mb-3 col-8">
                              <div className="form-group-header"><label htmlFor="bband-period-input">기간</label></div>
                              <div className="form-group-body"><input id="bband-period-input" type="number" className="form-control" value={bbandPeriod} onChange={e => setBbandPeriod(e.target.value)} /></div>
                            </div>
                            <div className="form-group mb-3 col-8">
                              <div className="form-group-header"><label htmlFor="bband-multiplier-input">승수</label></div>
                              <div className="form-group-body"><input id="bband-multiplier-input" type="number" className="form-control" value={bbandMultiplier} onChange={e => setBbandMultiplier(e.target.value)} step="0.1"/></div>
                            </div>
                          </>
                        )}

          {strategyType === 'volatility' && (
            <>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="volatility-multiplier-input">변동성 승수</label></div>
                <div className="form-group-body"><input id="volatility-multiplier-input" type="number" className="form-control" value={volatilityMultiplier} onChange={e => setVolatilityMultiplier(e.target.value)} step="0.1" min="0.1" max="2" /></div>
                <small className="color-fg-muted text-small">전일 고가 + (전일 범위 × 승수)를 돌파하면 매수 (기본값: 0.5)</small>
              </div>
            </>
          )}

          {strategyType === 'momentum' && (
            <>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="momentum-period-input">모멘텀 기간</label></div>
                <div className="form-group-body"><input id="momentum-period-input" type="number" className="form-control" value={momentumPeriod} onChange={e => setMomentumPeriod(e.target.value)} min="5" max="30" /></div>
              </div>
              <div className="form-group mb-3 col-8">
                <div className="form-group-header"><label htmlFor="momentum-threshold-input">모멘텀 임계값 (%)</label></div>
                <div className="form-group-body"><input id="momentum-threshold-input" type="number" className="form-control" value={momentumThreshold} onChange={e => setMomentumThreshold(e.target.value)} step="0.5" min="1" max="20" /></div>
                <small className="color-fg-muted text-small">가격 모멘텀이 이 값을 초과하고 거래량도 증가하면 매수 (기본값: 5%)</small>
              </div>
            </>
          )}

          <div className="d-flex flex-justify-center mt-3">
            <button type="submit" className="btn btn-primary">전략 추가</button>
          </div>
        </form>

        <hr className="my-4" />

        <div className="text-center">
          <h3 className="f4 mb-3">실행 중인 전략</h3>
        </div>
        {strategies.length === 0 ? (
          <p className="color-fg-muted text-center">실행 중인 전략이 없습니다.</p>
        ) : (
          <ul className="list-style-none p-0 m-0">
            {strategies.map(s => (
              <li key={s.id} className="d-flex flex-justify-between flex-items-center py-2 border-bottom">
                <div className="col-9">
                  <strong>{s.name || s.market.replace('KRW-','')}</strong>
                  <span className="d-block color-fg-muted text-small">
                    {s.strategyType === 'dca' && `적립식 (${s.amount.toLocaleString()}원 / ${s.interval})`}
                    {s.strategyType === 'ma' && `이평선 교차 (${s.shortPeriod} / ${s.longPeriod})`}
                    {s.strategyType === 'rsi' && `RSI (${s.period}, ${s.buyThreshold}/${s.sellThreshold})`}
                    {s.strategyType === 'bband' && `볼린저 밴드 (${s.period}, ${s.multiplier})`}
                    {s.strategyType === 'news' && `뉴스 기반 (${s.sentimentThreshold === 'positive' ? '긍정' : '부정'})`}
                    {s.strategyType === 'volatility' && `변동성 돌파 (승수: ${s.multiplier})`}
                    {s.strategyType === 'momentum' && `모멘텀 (기간: ${s.period}, 임계값: ${s.threshold}%)`}
                  </span>
                  {s.description && <p className="color-fg-subtle text-small mt-1 mb-0">{s.description}</p>}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => stopStrategy(s.id)}>중지</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
