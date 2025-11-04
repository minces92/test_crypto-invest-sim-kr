'use client';

import { usePortfolio, Strategy } from '@/context/PortfolioContext';
import { useState } from 'react';

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
      default:
        return;
    }
    startStrategy(strategyConfig);
  };

  return (
    <div className="Box mt-4">
      <div className="Box-header">
        <h2 className="Box-title">자동 매매</h2>
      </div>
      <div className="Box-body">
        <form onSubmit={handleAddStrategy}>
          <div className="form-group mb-3">
            <div className="form-group-header"><label htmlFor="strategy-select">전략 선택</label></div>
            <div className="form-group-body"><select id="strategy-select" className="form-select" value={strategyType} onChange={e => setStrategyType(e.target.value)}>
              <option value="dca">적립식 (DCA)</option>
              <option value="ma">이동평균선 교차</option>
              <option value="rsi">RSI</option>
            </select></div>
          </div>

          <div className="form-group mb-3">
            <div className="form-group-header"><label htmlFor="market-select">코인 선택</label></div>
            <div className="form-group-body"><select id="market-select" className="form-select" value={market} onChange={e => setMarket(e.target.value)}>
              {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-','')}</option>)}
            </select></div>
          </div>

          {strategyType === 'dca' && (
            <>
              <div className="form-group mb-3">
                <div className="form-group-header"><label htmlFor="dca-interval-select">매수 주기</label></div>
                <div className="form-group-body"><select id="dca-interval-select" className="form-select" value={dcaInterval} onChange={e => setDcaInterval(e.target.value)}>
                  <option value="daily">매일 (24초)</option>
                  <option value="weekly">매주 (1분)</option>
                  <option value="monthly">매월 (5분)</option>
                </select></div>
              </div>
              <div className="form-group mb-3">
                <div className="form-group-header"><label htmlFor="dca-amount-input">1회 매수 금액(원)</label></div>
                <div className="form-group-body"><input id="dca-amount-input" type="number" className="form-control" value={dcaAmount} onChange={e => setDcaAmount(e.target.value)} step="1000" /></div>
              </div>
            </>
          )}

          {strategyType === 'ma' && (
            <>
              <div className="form-group mb-3">
                <div className="form-group-header"><label htmlFor="ma-short-period-input">단기 이평선</label></div>
                <div className="form-group-body"><input id="ma-short-period-input" type="number" className="form-control" value={maShortPeriod} onChange={e => setMaShortPeriod(e.target.value)} /></div>
              </div>
              <div className="form-group mb-3">
                <div className="form-group-header"><label htmlFor="ma-long-period-input">장기 이평선</label></div>
                <div className="form-group-body"><input id="ma-long-period-input" type="number" className="form-control" value={maLongPeriod} onChange={e => setMaLongPeriod(e.target.value)} /></div>
              </div>
            </>
          )}

          {strategyType === 'rsi' && (
            <>
              <div className="form-group mb-3">
                <div className="form-group-header"><label htmlFor="rsi-period-input">RSI 기간</label></div>
                <div className="form-group-body"><input id="rsi-period-input" type="number" className="form-control" value={rsiPeriod} onChange={e => setRsiPeriod(e.target.value)} /></div>
              </div>
              <div className="form-group mb-3">
                <div className="form-group-header"><label htmlFor="rsi-buy-threshold-input">과매도 기준 (매수)</label></div>
                <div className="form-group-body"><input id="rsi-buy-threshold-input" type="number" className="form-control" value={rsiBuyThreshold} onChange={e => setRsiBuyThreshold(e.target.value)} /></div>
              </div>
              <div className="form-group mb-3">
                <div className="form-group-header"><label htmlFor="rsi-sell-threshold-input">과매수 기준 (매도)</label></div>
                <div className="form-group-body"><input id="rsi-sell-threshold-input" type="number" className="form-control" value={rsiSellThreshold} onChange={e => setRsiSellThreshold(e.target.value)} /></div>
              </div>
            </>
          )}

          <div className="d-flex flex-justify-end">
            <button type="submit" className="btn btn-primary">전략 추가</button>
          </div>
        </form>

        <hr className="my-3" />

        <h3 className="f4 mb-2">실행 중인 전략</h3>
        {strategies.length === 0 ? (
          <p className="color-fg-muted">실행 중인 전략이 없습니다.</p>
        ) : (
          <ul className="list-style-none p-0 m-0">
            {strategies.map(s => (
              <li key={s.id} className="d-flex flex-justify-between flex-items-center py-2 border-bottom">
                <div>
                  <strong>{s.market.replace('KRW-','')}</strong> - 
                  {s.strategyType === 'dca' && `적립식 (${s.amount.toLocaleString()}원 / ${s.interval})`}
                  {s.strategyType === 'ma' && `이평선 교차 (${s.shortPeriod} / ${s.longPeriod})`}
                  {s.strategyType === 'rsi' && `RSI (${s.period}, ${s.buyThreshold}/${s.sellThreshold})`}
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
