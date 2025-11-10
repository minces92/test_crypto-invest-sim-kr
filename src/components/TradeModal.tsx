import { usePortfolio, Strategy } from '@/context/PortfolioContext';
import { useState, useEffect } from 'react';
import ChartComponent from './ChartComponent';

interface Ticker {
  market: string;
  trade_price: number;
}

interface TradeModalProps {
  show: boolean;
  handleClose: () => void;
  ticker: Ticker | null;
  initialOrderType: 'buy' | 'sell';
}

type InputMode = 'amount' | 'percent' | 'price';

export default function TradeModal({ show, handleClose, ticker, initialOrderType }: TradeModalProps) {
  const { cash, assets, buyAsset, sellAsset, strategies } = usePortfolio();
  const [orderType, setOrderType] = useState(initialOrderType);
  const [inputMode, setInputMode] = useState<InputMode>('amount');
  const [inputValue, setInputValue] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState('manual');

  const asset = assets.find(a => a.market === ticker?.market);

  useEffect(() => {
    if (show) {
      setOrderType(initialOrderType);
      setInputValue('');
      setInputMode('amount');
      setSelectedStrategy('manual');
    }
  }, [show, initialOrderType]);

  useEffect(() => {
    if (!ticker || !inputValue) {
      setCalculatedAmount(0);
      setTotal(0);
      return;
    }

    const numericValue = parseFloat(inputValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      setCalculatedAmount(0);
      setTotal(0);
      return;
    }

    let amount = 0;
    let totalPrice = 0;

    if (orderType === 'buy') {
      const availableCash = cash;
      
      if (inputMode === 'amount') {
        amount = numericValue;
        totalPrice = amount * ticker.trade_price;
      } else if (inputMode === 'percent') {
        const targetCash = availableCash * (numericValue / 100);
        amount = targetCash / ticker.trade_price;
        totalPrice = targetCash;
      } else if (inputMode === 'price') {
        totalPrice = numericValue;
        amount = totalPrice / ticker.trade_price;
      }
    } else {
      const availableQuantity = asset?.quantity || 0;
      
      if (inputMode === 'amount') {
        amount = numericValue;
        totalPrice = amount * ticker.trade_price;
      } else if (inputMode === 'percent') {
        amount = availableQuantity * (numericValue / 100);
        totalPrice = amount * ticker.trade_price;
      } else if (inputMode === 'price') {
        totalPrice = numericValue;
        amount = totalPrice / ticker.trade_price;
      }
    }

    setCalculatedAmount(amount);
    setTotal(totalPrice);
  }, [inputValue, inputMode, orderType, ticker, cash, asset]);

  const handleTrade = () => {
    if (calculatedAmount <= 0) {
      alert('정확한 값을 입력해주세요.');
      return;
    }

    const strategy = strategies.find(s => s.id === selectedStrategy);
    const source = strategy ? strategy.id : 'manual';
    const strategyType = strategy ? strategy.strategyType : 'manual';

    let success = false;
    if (orderType === 'buy') {
      if (total > cash) {
        alert(`현금이 부족합니다. (보유: ${cash.toLocaleString('ko-KR')}원, 필요: ${total.toLocaleString('ko-KR')}원)`);
        return;
      }
      success = buyAsset(ticker!.market, ticker!.trade_price, calculatedAmount, source, strategyType, false);
    } else {
      const availableAmount = asset?.quantity || 0;
      if (calculatedAmount > availableAmount) {
        alert(`매도 가능 수량이 부족합니다. (보유: ${availableAmount}, 요청: ${calculatedAmount.toFixed(8)})`);
        return;
      }
      success = sellAsset(ticker!.market, ticker!.trade_price, calculatedAmount, source, strategyType, false);
    }

    if (success) {
      setInputValue('');
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

  const getQuickPercentButtons = () => {
    if (orderType === 'buy') {
      return [25, 50, 75, 100];
    } else {
      return [25, 50, 75, 100];
    }
  };

  if (!show || !ticker) return null;

  return (
    <div 
      className="Box-overlay d-flex flex-justify-center flex-items-center" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
        overflow: 'auto',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className="Box" 
        style={{ 
          width: '95%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
          backgroundColor: 'var(--color-canvas-subtle)',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--color-border-default)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="Box-header Box-header--divided" style={{ 
          backgroundColor: 'var(--color-canvas-subtle)',
          borderBottom: '1px solid var(--color-border-default)'
        }}>
          <h5 className="Box-title" style={{ color: 'var(--color-fg-default)' }}>
            {getMarketName(ticker.market)} ({ticker.market.replace('KRW-', '')}) 거래
          </h5>
          <button type="button" className="close-button" onClick={handleClose}>
            <svg className="octicon octicon-x" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>
          </button>
        </div>
        <div className="Box-body" style={{ backgroundColor: 'var(--color-canvas-subtle)' }}>
          
          <ChartComponent market={ticker.market} />

          <div className="UnderlineNav my-3">
            <div className="UnderlineNav-body">
              <a 
                href="#" 
                className={`UnderlineNav-item ${orderType === 'buy' ? 'selected' : ''}`} 
                onClick={(e) => {
                  e.preventDefault();
                  setOrderType('buy');
                  setInputValue('');
                }}
                style={{ 
                  color: orderType === 'buy' ? 'var(--color-danger-fg)' : 'var(--color-fg-muted)',
                  borderBottomColor: orderType === 'buy' ? 'var(--color-danger-fg)' : 'transparent'
                }}
              >
                매수
              </a>
              <a 
                href="#" 
                className={`UnderlineNav-item ${orderType === 'sell' ? 'selected' : ''}`} 
                onClick={(e) => {
                  e.preventDefault();
                  setOrderType('sell');
                  setInputValue('');
                }}
                style={{ 
                  color: orderType === 'sell' ? 'var(--color-success-fg)' : 'var(--color-fg-muted)',
                  borderBottomColor: orderType === 'sell' ? 'var(--color-success-fg)' : 'transparent'
                }}
              >
                매도
              </a>
            </div>
          </div>

          <div className="mb-3" style={{ 
            padding: '12px',
            backgroundColor: 'var(--color-canvas-default)',
            borderRadius: '6px',
            border: '1px solid var(--color-border-default)'
          }}>
            <p style={{ margin: '0 0 8px 0', color: 'var(--color-fg-muted)', fontSize: '14px' }}>
              주문 가능: 
              <span style={{ color: 'var(--color-fg-default)', fontWeight: 600, marginLeft: '8px' }}>
                {orderType === 'buy' 
                  ? `${cash.toLocaleString('ko-KR')} 원` 
                  : `${(asset?.quantity || 0).toFixed(8)} ${ticker.market.replace('KRW-', '')}`}
              </span>
            </p>
            <p style={{ margin: 0, color: 'var(--color-fg-muted)', fontSize: '14px' }}>
              현재가: 
              <span style={{ color: 'var(--color-fg-default)', fontWeight: 600, marginLeft: '8px' }}>
                {ticker.trade_price.toLocaleString('ko-KR')} 원
              </span>
            </p>
          </div>

          <div className="form-group mb-3">
            <div className="form-group-header">
              <label style={{ color: 'var(--color-fg-default)', marginBottom: '8px', display: 'block' }}>
                입력 방식
              </label>
            </div>
            <div className="d-flex" style={{ gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setInputMode('amount');
                  setInputValue('');
                }}
                style={{
                  flex: 1,
                  backgroundColor: inputMode === 'amount' ? 'var(--color-accent-fg)' : 'var(--color-canvas-default)',
                  color: inputMode === 'amount' ? '#fff' : 'var(--color-fg-default)',
                  borderColor: inputMode === 'amount' ? 'var(--color-accent-fg)' : 'var(--color-border-default)'
                }}
              >
                수량
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setInputMode('percent');
                  setInputValue('');
                }}
                style={{
                  flex: 1,
                  backgroundColor: inputMode === 'percent' ? 'var(--color-accent-fg)' : 'var(--color-canvas-default)',
                  color: inputMode === 'percent' ? '#fff' : 'var(--color-fg-default)',
                  borderColor: inputMode === 'percent' ? 'var(--color-accent-fg)' : 'var(--color-border-default)'
                }}
              >
                퍼센트
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setInputMode('price');
                  setInputValue('');
                }}
                style={{
                  flex: 1,
                  backgroundColor: inputMode === 'price' ? 'var(--color-accent-fg)' : 'var(--color-canvas-default)',
                  color: inputMode === 'price' ? '#fff' : 'var(--color-fg-default)',
                  borderColor: inputMode === 'price' ? 'var(--color-accent-fg)' : 'var(--color-border-default)'
                }}
              >
                금액
              </button>
            </div>
          </div>

          {inputMode === 'percent' && (
            <div className="mb-3">
              <div className="d-flex" style={{ gap: '8px' }}>
                {getQuickPercentButtons().map(percent => (
                  <button
                    key={percent}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setInputValue(percent.toString())}
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--color-canvas-default)',
                      color: 'var(--color-fg-default)',
                      borderColor: 'var(--color-border-default)'
                    }}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group mb-3">
            <div className="form-group-header">
              <label style={{ color: 'var(--color-fg-default)' }}>
                {inputMode === 'amount' ? '수량' : inputMode === 'percent' ? '퍼센트 (%)' : '금액 (원)'}
              </label>
            </div>
            <div className="form-group-body">
              <input 
                type="number" 
                className="form-control" 
                placeholder={inputMode === 'amount' ? '0' : inputMode === 'percent' ? '0' : '0'}
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)}
                style={{
                  backgroundColor: 'var(--color-canvas-default)',
                  color: 'var(--color-fg-default)',
                  borderColor: 'var(--color-border-default)'
                }}
              />
            </div>
          </div>

          <div className="form-group mb-3">
            <div className="form-group-header">
              <label htmlFor="strategy-select" style={{ color: 'var(--color-fg-default)' }}>
                전략 연결
              </label>
            </div>
            <div className="form-group-body">
              <select 
                id="strategy-select" 
                className="form-select" 
                value={selectedStrategy} 
                onChange={(e) => setSelectedStrategy(e.target.value)}
                style={{
                  backgroundColor: 'var(--color-canvas-default)',
                  color: 'var(--color-fg-default)',
                  borderColor: 'var(--color-border-default)'
                }}
              >
                <option value="manual">수동 거래</option>
                {strategies.filter(s => s.market === ticker.market).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || `${s.strategyType} - ${s.market}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ 
            padding: '12px',
            backgroundColor: 'var(--color-canvas-default)',
            borderRadius: '6px',
            border: '1px solid var(--color-border-default)',
            marginBottom: '16px'
          }}>
            <div className="d-flex flex-justify-between mb-2">
              <span style={{ color: 'var(--color-fg-muted)', fontSize: '14px' }}>거래 수량:</span>
              <span style={{ color: 'var(--color-fg-default)', fontWeight: 600 }}>
                {calculatedAmount.toFixed(8)} {ticker.market.replace('KRW-', '')}
              </span>
            </div>
            <div className="d-flex flex-justify-between">
              <span style={{ color: 'var(--color-fg-muted)', fontSize: '14px' }}>주문 총액:</span>
              <span style={{ color: 'var(--color-fg-default)', fontWeight: 600, fontSize: '16px' }}>
                {total.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원
              </span>
            </div>
          </div>

        </div>
        <div className="Box-footer d-flex flex-justify-end" style={{ 
          padding: '16px', 
          borderTop: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-canvas-subtle)',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}>
          <button 
            type="button" 
            className="btn mr-2" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClose();
            }}
            style={{ 
              cursor: 'pointer', 
              minWidth: '80px',
              backgroundColor: 'var(--color-canvas-default)',
              color: 'var(--color-fg-default)',
              borderColor: 'var(--color-border-default)'
            }}
          >
            취소
          </button>
          <button 
            type="button" 
            className={`btn ${orderType === 'buy' ? 'btn-danger' : 'btn-primary'}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleTrade();
            }}
            style={{ cursor: 'pointer', minWidth: '80px' }}
          >
            {orderType === 'buy' ? '매수' : '매도'}
          </button>
        </div>
      </div>
    </div>
  );
}
