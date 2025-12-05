import { useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useData } from '@/context/DataProviderContext';
import SharePortfolioModal from './SharePortfolioModal';

interface Ticker {
  market: string;
  trade_price: number;
}

interface PortfolioProps {
  handleOpenModal: (ticker: Ticker, type: 'buy' | 'sell') => void;
}

export default function Portfolio({ handleOpenModal }: PortfolioProps) {
  const { cash, assets } = usePortfolio();
  const { tickers, loading: tickersLoading, error: tickersError } = useData();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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
      <div className="Box-header d-flex flex-justify-between flex-items-center">
        <h2 className="Box-title">내 포트폴리오</h2>
        <button
          className="btn btn-sm"
          onClick={() => setIsShareModalOpen(true)}
        >
          <svg className="octicon octicon-share mr-1" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M7.28 2.22a.75.75 0 0 1 0 1.06L4.81 5.75h6.44a4.75 4.75 0 0 1 0 9.5H11a.75.75 0 0 1 0-1.5h.25a3.25 3.25 0 0 0 0-6.5H4.81l2.47 2.47a.75.75 0 1 1-1.06 1.06l-3.75-3.75a.75.75 0 0 1 0-1.06l3.75-3.75a.75.75 0 0 1 1.06 0Z"></path></svg>
          공유하기
        </button>
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
        {tickersLoading && <div className="text-center p-2">시세 로딩 중...</div>}
        {tickersError && (
          <div className="text-center p-2 color-fg-danger">
            <p>시세 데이터를 불러오는 데 실패했습니다.</p>
            <button className="btn btn-sm" onClick={() => window.location.reload()}>다시 시도</button>
          </div>
        )}

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

      <SharePortfolioModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
