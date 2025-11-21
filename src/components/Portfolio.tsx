'use client';

import { usePortfolio } from '@/context/PortfolioContext';
import { useData } from '@/context/DataProviderContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Ticker {
  market: string;
  trade_price: number;
}

interface PortfolioProps {
  handleOpenModal: (ticker: Ticker, type: 'buy' | 'sell') => void;
}

export default function Portfolio({ handleOpenModal }: PortfolioProps) {
  const { cash, assets } = usePortfolio();
  const { tickers } = useData();
  const [initialCashInput, setInitialCashInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setInitialCashInput(data.initial_cash || '1000000');
        } else {
          console.error('Failed to fetch settings');
          setInitialCashInput('1000000'); // Fallback
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        setInitialCashInput('1000000'); // Fallback
      }
    };
    fetchSettings();
  }, []);

  const handleSaveInitialCash = async () => {
    const numericValue = Number(initialCashInput);
    if (isNaN(numericValue) || numericValue < 0) {
      toast.error('초기 자본금은 0 이상의 숫자여야 합니다.');
      return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'initial_cash', value: initialCashInput }),
      });

      if (response.ok) {
        toast.success('초기 자본금이 저장되었습니다. 페이지를 새로고침합니다.');
        setIsEditing(false);
        // Reload the page to apply the new initial cash value everywhere
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const errorData = await response.json();
        toast.error(`저장 실패: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('Error saving initial cash:', error);
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  const tickersMap = tickers.reduce((acc, ticker) => {
    acc[ticker.market] = ticker;
    return acc;
  }, {} as { [key: string]: Ticker });

  const totalAssetValue = assets.reduce((total, asset) => {
    const currentPrice = tickersMap[asset.market]?.trade_price || asset.avg_buy_price;
    return total + (currentPrice * asset.quantity);
  }, 0);

  const totalValue = cash + totalAssetValue;

  return (
    <div className="Box mb-4">
      <div className="Box-header">
        <h2 className="Box-title">내 포트폴리오</h2>
      </div>
      <div className="Box-body">
        <div className="Box color-bg-subtle p-3 rounded-2 mb-3">
          <h5 className="f5 text-center"><strong>총 자산</strong></h5>
          <h3 className="f1 text-center text-bold mb-0">{totalValue.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원</h3>
        </div>
        
        <div className="d-flex flex-justify-between flex-items-center mb-3">
          <h6 className="f6 mb-0"><strong>보유 현금</strong></h6>
          <p className="text-normal mb-0">{cash.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원</p>
        </div>

        <div className="d-flex flex-justify-between flex-items-center mb-3">
          <h6 className="f6 mb-0"><strong>초기 자본금</strong></h6>
          {!isEditing ? (
            <div className="d-flex flex-items-center">
              <p className="text-normal mb-0 mr-2">{Number(initialCashInput).toLocaleString('ko-KR')} 원</p>
              <button className="btn btn-sm" onClick={() => setIsEditing(true)}>수정</button>
            </div>
          ) : (
            <div className="d-flex flex-items-center">
              <input
                type="number"
                className="form-control input-sm"
                value={initialCashInput}
                onChange={(e) => setInitialCashInput(e.target.value)}
                style={{ width: '120px' }}
              />
              <button className="btn btn-sm btn-primary ml-2" onClick={handleSaveInitialCash}>저장</button>
              <button className="btn btn-sm btn-danger ml-1" onClick={() => setIsEditing(false)}>취소</button>
            </div>
          )}
        </div>
        
        <hr className="my-3" />

        <h6 className="f6 mb-2"><strong>보유 자산 목록</strong></h6>
        {assets.length === 0 ? (
          <p className="text-small color-fg-muted text-center">보유한 암호화폐가 없습니다.</p>
        ) : (
          <ul className="list-style-none p-0 m-0">
            {assets.map(asset => {
              const currentPrice = tickersMap[asset.market]?.trade_price;
              const currentValue = currentPrice ? currentPrice * asset.quantity : asset.avg_buy_price * asset.quantity;
              const profitLoss = currentValue - (asset.avg_buy_price * asset.quantity);
              const profitLossRate = (asset.avg_buy_price * asset.quantity) === 0 ? 0 : (currentValue / (asset.avg_buy_price * asset.quantity) - 1) * 100;
              const assetTicker = { market: asset.market, trade_price: currentPrice || asset.avg_buy_price };

              return (
                <li key={asset.market} className="BorderGrid-row py-2">
                  <div className="d-flex flex-justify-between flex-items-center">
                    <div>
                      <strong className="f5">{asset.market.replace('KRW-', '')}</strong> <br />
                      <small className="text-small color-fg-muted">수량: {asset.quantity.toFixed(4)}</small> <br />
                      <small className="text-small color-fg-muted">평단: {asset.avg_buy_price.toLocaleString('ko-KR')} 원</small>
                    </div>
                    <div className="text-right">
                      <strong className="f5">{currentValue.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원</strong> <br />
                      <small className={`text-small ${profitLoss >= 0 ? 'color-fg-profit' : 'color-fg-loss'}`}>
                        {profitLoss.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 원 ({profitLossRate.toFixed(2)}%)
                      </small>
                    </div>
                  </div>
                  <div className="text-right mt-2">
                    <button className="btn btn-danger btn-sm" onClick={() => handleOpenModal(assetTicker, 'sell')}>매도</button>
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
