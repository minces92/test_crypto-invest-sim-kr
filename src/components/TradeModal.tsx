import { usePortfolio } from '@/context/PortfolioContext';
import { useState, useEffect } from 'react';
import ChartComponent from './ChartComponent'; // 차트 컴포넌트 임포트

interface Ticker {
  market: string;
  trade_price: number;
}

interface TradeModalProps {
  show: boolean;
  handleClose: () => void;
  ticker: Ticker | null;
}


export default function TradeModal({ show, handleClose, ticker }: TradeModalProps) {
  const { cash, assets, buyAsset, sellAsset } = usePortfolio();
  const [orderType, setOrderType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState(0);

  const asset = assets.find(a => a.market === ticker?.market);

  useEffect(() => {
    if (ticker && amount) {
      setTotal(parseFloat(amount) * ticker.trade_price);
    } else {
      setTotal(0);
    }
  }, [amount, ticker]);

  // 모달이 닫힐 때 amount 초기화
  useEffect(() => {
    if (!show) {
      setAmount('');
    }
  }, [show]);

  const handleTrade = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('정확한 수량을 입력해주세요.');
      return;
    }

    let success = false;
    if (orderType === 'buy') {
      success = buyAsset(ticker.market, ticker.trade_price, numericAmount, 'manual');
    } else {
      success = sellAsset(ticker.market, ticker.trade_price, numericAmount, 'manual');
    }

    if (success) {
      setAmount('');
      handleClose();
    }
  };

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

  if (!show || !ticker) return null;

  return (
    <div className="Box-overlay d-flex flex-justify-center flex-items-center" style={{ zIndex: 100 }}>
      <div className="Box" style={{ minWidth: '500px' }}>
        <div className="Box-header Box-header--divided">
          <h5 className="Box-title">{getMarketName(ticker.market)} ({ticker.market.replace('KRW-', '')}) 거래</h5>
          <button type="button" className="close-button" onClick={handleClose}>
            <svg className="octicon octicon-x" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>
          </button>
        </div>
        <div className="Box-body">
          
          <ChartComponent market={ticker.market} />

          <div className="UnderlineNav my-3">
            <div className="UnderlineNav-body">
              <a href="#" className={`UnderlineNav-item ${orderType === 'buy' ? 'selected' : ''}`} onClick={() => setOrderType('buy')}>매수</a>
              <a href="#" className={`UnderlineNav-item ${orderType === 'sell' ? 'selected' : ''}`} onClick={() => setOrderType('sell')}>매도</a>
            </div>
          </div>

          <div className="mb-3">
            <p>주문 가능: 
              {orderType === 'buy' 
                ? `${cash.toLocaleString('ko-KR')} 원` 
                : `${asset?.quantity || 0} ${ticker.market.replace('KRW-', '')}`}
            </p>
            <p>현재가: <span className="f5">{ticker.trade_price.toLocaleString('ko-KR')} 원</span></p>
          </div>

          <div className="form-group mb-3">
            <div className="form-group-header"><label>수량</label></div>
            <div className="form-group-body">
              <input 
                type="number" 
                className="form-control" 
                placeholder="0" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
              />
            </div>
          </div>

          <div className="text-right">
            <p className="mb-1">주문 총액</p>
            <h5 className="f5">{total.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원</h5>
          </div>

        </div>
        <div className="Box-footer d-flex flex-justify-end">
          <button type="button" className="btn mr-2" onClick={handleClose}>취소</button>
          <button 
            type="button" 
            className={`btn ${orderType === 'buy' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={handleTrade}
          >
            {orderType === 'buy' ? '매수' : '매도'}
          </button>
        </div>
      </div>
    </div>
  );
}
