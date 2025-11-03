'use client';

import { usePortfolio } from '@/context/PortfolioContext';
import { useState, useEffect } from 'react';

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

  if (!show || !ticker) return null;

  const handleTrade = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('정확한 수량을 입력해주세요.');
      return;
    }

    let success = false;
    if (orderType === 'buy') {
      success = buyAsset(ticker.market, ticker.trade_price, numericAmount);
    } else {
      success = sellAsset(ticker.market, ticker.trade_price, numericAmount);
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
    };
    return names[market] || market;
  };

  return (
    <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{getMarketName(ticker.market)} ({ticker.market.replace('KRW-', '')}) 거래</h5>
            <button type="button" className="btn-close" onClick={handleClose}></button>
          </div>
          <div className="modal-body">
            <ul className="nav nav-pills nav-fill mb-3">
              <li className="nav-item">
                <a className={`nav-link ${orderType === 'buy' ? 'active' : ''}`} href="#" onClick={() => setOrderType('buy')}>매수</a>
              </li>
              <li className="nav-item">
                <a className={`nav-link ${orderType === 'sell' ? 'active' : ''}`} href="#" onClick={() => setOrderType('sell')}>매도</a>
              </li>
            </ul>

            <div className="mb-3">
              <p>주문 가능: 
                {orderType === 'buy' 
                  ? `${cash.toLocaleString('ko-KR')} 원` 
                  : `${asset?.quantity || 0} ${ticker.market.replace('KRW-', '')}`}
              </p>
              <p>현재가: <span className="fw-bold">{ticker.trade_price.toLocaleString('ko-KR')} 원</span></p>
            </div>

            <div className="input-group mb-3">
              <span className="input-group-text">수량</span>
              <input 
                type="number" 
                className="form-control" 
                placeholder="0" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
              />
              <span className="input-group-text">{ticker.market.replace('KRW-', '')}</span>
            </div>

            <div className="text-end">
              <p className="mb-1">주문 총액</p>
              <h5 className="fw-bold">{total.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원</h5>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>취소</button>
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
    </div>
  );
}
