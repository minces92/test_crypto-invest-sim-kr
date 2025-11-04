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
    <div className="Box mt-4">
      <div className="Box-header">
        <h2 className="Box-title">자동 매매</h2>
      </div>
      <div className="Box-body">
        {isRunning ? (
          <div className="d-flex flex-column flex-items-center">
            {dcaConfig.isActive && (
              <p className="text-center">
                <strong>[적립식] {dcaConfig.market?.replace('KRW-','')}</strong><br />
                <strong>{dcaConfig.interval === 'daily' ? '매일' : dcaConfig.interval === 'weekly' ? '매주' : '매월'}</strong>
                <strong>{dcaConfig.amount?.toLocaleString('ko-KR')}원</strong>씩 매수 진행 중...
              </p>
            )}
            {maConfig.isActive && (
              <p className="text-center">
                <strong>[MA 교차] {maConfig.market?.replace('KRW-','')}</strong><br />
                단기({maConfig.shortPeriod}) / 장기({maConfig.longPeriod}) 전략 실행 중...
              </p>
            )}
            <button className="btn btn-danger" onClick={handleStop}>중지</button>
          </div>
        ) : (
          <form onSubmit={handleStart}>
            <div className="form-group mb-3">
              <div className="form-group-header"><label htmlFor="strategy-select" className="f5">전략 선택</label></div>
              <div className="form-group-body"><select id="strategy-select" className="form-select" value={strategy} onChange={e => setStrategy(e.target.value)}>
                <option value="dca">적립식 투자 (DCA)</option>
                <option value="ma">이동평균선 교차</option>
              </select></div>
            </div>

            {strategy === 'dca' && (
              <>
                <div className="form-group mb-3">
                  <div className="form-group-header"><label htmlFor="dca-market-select" className="f5">코인 선택</label></div>
                  <div className="form-group-body"><select id="dca-market-select" className="form-select" value={dcaMarket} onChange={e => setDcaMarket(e.target.value)}>
                    {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-','')}</option>)}
                  </select></div>
                </div>
                <div className="form-group mb-3">
                  <div className="form-group-header"><label htmlFor="dca-interval-select" className="f5">매수 주기</label></div>
                  <div className="form-group-body"><select id="dca-interval-select" className="form-select" value={dcaInterval} onChange={e => setDcaInterval(e.target.value)}>
                    <option value="daily">매일 (24초)</option>
                    <option value="weekly">매주 (1분)</option>
                    <option value="monthly">매월 (5분)</option>
                  </select></div>
                </div>
                <div className="form-group mb-3">
                  <div className="form-group-header"><label htmlFor="dca-amount-input" className="f5">1회 매수 금액(원)</label></div>
                  <div className="form-group-body"><input id="dca-amount-input" type="number" className="form-control" value={dcaAmount} onChange={e => setDcaAmount(e.target.value)} step="1000" /></div>
                </div>
              </>
            )}

            {strategy === 'ma' && (
              <>
                <div className="form-group mb-3">
                  <div className="form-group-header"><label htmlFor="ma-market-select" className="f5">코인 선택</label></div>
                  <div className="form-group-body"><select id="ma-market-select" className="form-select" value={maMarket} onChange={e => setMaMarket(e.target.value)}>
                    {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-','')}</option>)}
                  </select></div>
                </div>
                <p className="f6 color-fg-muted">단기 5일, 장기 20일 이동평균선을 사용합니다. 골든크로스 시 보유 현금의 50%를 매수하고, 데드크로스 시 해당 코인을 전량 매도합니다.</p>
              </>
            )}

            <div className="d-flex flex-justify-center">
              <button type="submit" className="btn btn-primary">시작</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
