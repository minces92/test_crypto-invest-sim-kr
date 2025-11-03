'use client';

import { usePortfolio } from '@/context/PortfolioContext';
import { useState, useEffect } from 'react';

interface Ticker {
  market: string;
  trade_price: number;
}

export default function Portfolio() {
  const { cash, assets } = usePortfolio();
  const [tickers, setTickers] = useState<{ [key: string]: Ticker }>({});

  useEffect(() => {
    if (assets.length === 0) return;

    const fetchTickerPrices = async () => {
      const markets = assets.map(a => a.market).join(',');
      try {
        const response = await fetch(`/api/tickers?markets=${markets}`);
        const data: Ticker[] = await response.json();
        const newTickers = data.reduce((acc, ticker) => {
          acc[ticker.market] = ticker;
          return acc;
        }, {} as { [key: string]: Ticker });
        setTickers(newTickers);
      } catch (error) {
        console.error("Error fetching ticker prices for portfolio:", error);
      }
    };

    fetchTickerPrices();
    const interval = setInterval(fetchTickerPrices, 30000); // 30초마다 갱신

    return () => clearInterval(interval);
  }, [assets]);

  const totalAssetValue = assets.reduce((total, asset) => {
    const currentPrice = tickers[asset.market]?.trade_price || asset.avg_buy_price;
    return total + (currentPrice * asset.quantity);
  }, 0);

  const totalValue = cash + totalAssetValue;

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h2>내 포트폴리오</h2>
      </div>
      <div className="card-body">
        <h5><strong>총 자산</strong></h5>
        <h4 className="mb-3">{totalValue.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원</h4>
        
        <h6><strong>보유 현금</strong></h6>
        <p>{cash.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원</p>
        
        <hr />

        <h6><strong>보유 자산 목록</strong></h6>
        {assets.length === 0 ? (
          <p className="text-muted">보유한 암호화폐가 없습니다.</p>
        ) : (
          <ul className="list-group list-group-flush">
            {assets.map(asset => {
              const currentPrice = tickers[asset.market]?.trade_price;
              const currentValue = currentPrice ? currentPrice * asset.quantity : asset.avg_buy_price * asset.quantity;
              const profitLoss = currentValue - (asset.avg_buy_price * asset.quantity);
              const profitLossRate = (currentValue / (asset.avg_buy_price * asset.quantity) - 1) * 100;

              return (
                <li key={asset.market} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{asset.market.replace('KRW-', '')}</strong> <br />
                    <small>수량: {asset.quantity.toFixed(4)}</small> <br />
                    <small>평단: {asset.avg_buy_price.toLocaleString('ko-KR')} 원</small>
                  </div>
                  <div className="text-end">
                    <strong>{currentValue.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원</strong> <br />
                    <small className={profitLoss >= 0 ? 'text-success' : 'text-danger'}>
                      {profitLoss.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원 ({profitLossRate.toFixed(2)}%)
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
