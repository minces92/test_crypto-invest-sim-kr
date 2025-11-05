'use client';

import { useState, useEffect } from 'react';

interface Ticker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
}

interface CryptoTableProps {
  handleOpenModal: (ticker: Ticker, type: 'buy' | 'sell') => void;
}

export default function CryptoTable({ handleOpenModal }: CryptoTableProps) {
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
      'KRW-SOL': '솔라나',
      'KRW-ADA': '에이다',
      'KRW-AVAX': '아발란체',
      'KRW-DOT': '폴카닷',
      'KRW-MATIC': '폴리곤',
      'KRW-TRX': '트론',
      'KRW-SHIB': '시바이누',
      'KRW-ETC': '이더리움 클래식',
      'KRW-BCH': '비트코인 캐시',
      'KRW-LINK': '체인링크',
    };
    return names[market] || market;
  };

  return (
    <div className="Box border">
      <div className="Box-header">
        <h2 className="Box-title">실시간 시세</h2>
      </div>
      <div className="Box-body">
        <table className="Table Table--hover">
          <thead className="color-bg-subtle">
            <tr>
              <th>자산</th>
              <th>가격 (KRW)</th>
              <th>24시간 변동</th>
              <th>거래</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center">로딩 중...</td></tr>}
            {error && <tr><td colSpan={4} className="text-center color-fg-danger">데이터를 불러오는 데 실패했습니다: {error}</td></tr>}
            {!loading && !error && tickers.map((ticker) => (
              <tr key={ticker.market}>
                <td>{getMarketName(ticker.market)} ({ticker.market.replace('KRW-', '')})</td>
                <td>{ticker.trade_price.toLocaleString('ko-KR')}</td>
                <td className={ticker.signed_change_rate >= 0 ? 'color-fg-success' : 'color-fg-danger'}>
                  {(ticker.signed_change_rate * 100).toFixed(2)}%
                </td>
                <td><button className="btn btn-primary btn-sm" onClick={() => handleOpenModal(ticker, 'buy')}>거래</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
