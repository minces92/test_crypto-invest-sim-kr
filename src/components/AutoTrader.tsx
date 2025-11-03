'use client';

import { usePortfolio } from '@/context/PortfolioContext';
import { useState } from 'react';

export default function AutoTrader() {
  const { startDCA, stopDCA, dcaConfig, startMA, stopMA, maConfig } = usePortfolio();
  const [strategy, setStrategy] = useState('dca'); // 'dca' or 'ma'

  // DCA state
  const [dcaMarket, setDcaMarket] = useState('KRW-BTC');
  const [dcaAmount, setDcaAmount] = useState('10000');
  const [dcaInterval, setDcaInterval] = useState('daily');

  // MA state
  const [maMarket, setMaMarket] = useState('KRW-BTC');

  const availableMarkets = [
    'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA', 
    'KRW-AVAX', 'KRW-DOT', 'KRW-MATIC', 'KRW-TRX', 'KRW-SHIB', 'KRW-ETC', 
    'KRW-BCH', 'KRW-LINK'
  ];

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (strategy === 'dca') {
      const numericAmount = parseInt(dcaAmount, 10);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        alert('올바른 금액을 입력하세요.');
        return;
      }
      startDCA(dcaMarket, numericAmount, dcaInterval);
    } else if (strategy === 'ma') {
      startMA(maMarket, 5, 20); // 단기 5, 장기 20으로 고정
    }
  };

  const handleStop = () => {
    if (strategy === 'dca') {
      stopDCA();
    } else if (strategy === 'ma') {
      stopMA();
    }
  };

  const isRunning = dcaConfig.isActive || maConfig.isActive;

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h2>자동 매매</h2>
      </div>
      <div className="card-body">
        {isRunning ? (
          <div className="text-center">
            {dcaConfig.isActive && (
              <p>
                <strong>[적립식] {dcaConfig.market?.replace('KRW-','')}</strong><br />
                <strong>{dcaConfig.interval === 'daily' ? '매일' : dcaConfig.interval === 'weekly' ? '매주' : '매월'}</strong> 
                <strong>{dcaConfig.amount?.toLocaleString('ko-KR')}원</strong>씩 매수 진행 중...
              </p>
            )}
            {maConfig.isActive && (
              <p>
                <strong>[MA 교차] {maConfig.market?.replace('KRW-','')}</strong><br />
                단기({maConfig.shortPeriod}) / 장기({maConfig.longPeriod}) 전략 실행 중...
              </p>
            )}
            <button className="btn btn-danger" onClick={handleStop}>중지</button>
          </div>
        ) : (
          <form onSubmit={handleStart}>
            <div className="mb-3">
              <label htmlFor="strategy-select" className="form-label">전략 선택</label>
              <select id="strategy-select" className="form-select" value={strategy} onChange={e => setStrategy(e.target.value)}>
                <option value="dca">적립식 투자 (DCA)</option>
                <option value="ma">이동평균선 교차</option>
              </select>
            </div>

            {strategy === 'dca' && (
              <>
                <div className="mb-3">
                  <label htmlFor="dca-market-select" className="form-label">코인 선택</label>
                  <select id="dca-market-select" className="form-select" value={dcaMarket} onChange={e => setDcaMarket(e.target.value)}>
                    {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-','')}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="dca-interval-select" className="form-label">매수 주기</label>
                  <select id="dca-interval-select" className="form-select" value={dcaInterval} onChange={e => setDcaInterval(e.target.value)}>
                    <option value="daily">매일 (24초)</option>
                    <option value="weekly">매주 (1분)</option>
                    <option value="monthly">매월 (5분)</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="dca-amount-input" className="form-label">1회 매수 금액(원)</label>
                  <input id="dca-amount-input" type="number" className="form-control" value={dcaAmount} onChange={e => setDcaAmount(e.target.value)} step="1000" />
                </div>
              </>
            )}

            {strategy === 'ma' && (
              <>
                <div className="mb-3">
                  <label htmlFor="ma-market-select" className="form-label">코인 선택</label>
                  <select id="ma-market-select" className="form-select" value={maMarket} onChange={e => setMaMarket(e.target.value)}>
                    {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-','')}</option>)}
                  </select>
                </div>
                <p className="form-text">단기 5일, 장기 20일 이동평균선을 사용합니다. 골든크로스 시 보유 현금의 50%를 매수하고, 데드크로스 시 해당 코인을 전량 매도합니다.</p>
              </>
            )}

            <div className="d-grid">
              <button type="submit" className="btn btn-success">시작</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
