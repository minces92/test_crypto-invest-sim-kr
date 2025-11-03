'use client';

import { useState, useEffect } from 'react';

interface Ticker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
}

export default function CryptoTable() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTickers() {
      try {
        setLoading(true);
        const response = await fetch('/api/tickers');
        if (!response.ok) {
          throw new Error('Failed to fetch data from server');
        }
        const data: Ticker[] = await response.json();
        setTickers(data);
        setError(null);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchTickers();
    // 30초마다 데이터 갱신
    const interval = setInterval(fetchTickers, 30000);

    return () => clearInterval(interval);
  }, []);

  const getMarketName = (market: string) => {
    const names: { [key: string]: string } = {
      'KRW-BTC': '비트코인',
      'KRW-ETH': '이더리움',
      'KRW-XRP': '리플',
      'KRW-DOGE': '도지코인',
    };
    return names[market] || market;
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>실시간 시세</h2>
      </div>
      <div className="card-body">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>자산</th>
              <th>가격 (KRW)</th>
              <th>24시간 변동</th>
              <th>거래</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center">로딩 중...</td></tr>}
            {error && <tr><td colSpan={4} className="text-center text-danger">데이터를 불러오는 데 실패했습니다: {error}</td></tr>}
            {!loading && !error && tickers.map((ticker) => (
              <tr key={ticker.market}>
                <td>{getMarketName(ticker.market)} ({ticker.market.replace('KRW-', '')})</td>
                <td>{ticker.trade_price.toLocaleString('ko-KR')}</td>
                <td className={ticker.signed_change_rate >= 0 ? 'text-success' : 'text-danger'}>
                  {(ticker.signed_change_rate * 100).toFixed(2)}%
                </td>
                <td><button className="btn btn-primary btn-sm">거래</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
