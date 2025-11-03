'use client';

import { usePortfolio } from '@/context/PortfolioContext';
import { useState } from 'react';

export default function AutoTrader() {
  const { startDCA, stopDCA, dcaConfig } = usePortfolio();
  const [market, setMarket] = useState('KRW-BTC');
  const [amount, setAmount] = useState('10000');
  const [interval, setInterval] = useState('daily');

  const handleStart = () => {
    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('올바른 금액을 입력하세요.');
      return;
    }
    startDCA(market, numericAmount, interval);
  };

  const availableMarkets = [
    'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA', 
    'KRW-AVAX', 'KRW-DOT', 'KRW-MATIC', 'KRW-TRX', 'KRW-SHIB', 'KRW-ETC', 
    'KRW-BCH', 'KRW-LINK'
  ];

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h2>자동 매매 (적립식)</h2>
      </div>
      <div className="card-body">
        {dcaConfig.isActive ? (
          <div className="text-center">
            <p>
              <strong>{dcaConfig.market?.replace('KRW-','')}</strong>에 대해 <br />
              <strong>{dcaConfig.interval === 'daily' ? '매일' : dcaConfig.interval === 'weekly' ? '매주' : '매월'}</strong> 
              <strong>{dcaConfig.amount?.toLocaleString('ko-KR')}원</strong>씩 <br />
              자동 매수 진행 중...
            </p>
            <button className="btn btn-danger" onClick={stopDCA}>중지</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleStart(); }}>
            <div className="mb-3">
              <label className="form-label">전략</label>
              <input type="text" readOnly className="form-control-plaintext" value="적립식 투자 (DCA)" />
            </div>
            <div className="mb-3">
              <label htmlFor="market-select" className="form-label">코인 선택</label>
              <select id="market-select" className="form-select" value={market} onChange={e => setMarket(e.target.value)}>
                {availableMarkets.map(m => <option key={m} value={m}>{m.replace('KRW-','')}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="interval-select" className="form-label">매수 주기</label>
              <select id="interval-select" className="form-select" value={interval} onChange={e => setInterval(e.target.value)}>
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="amount-input" className="form-label">1회 매수 금액(원)</label>
              <input id="amount-input" type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} step="1000" />
            </div>
            <div className="d-grid">
              <button type="submit" className="btn btn-success">시작</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
