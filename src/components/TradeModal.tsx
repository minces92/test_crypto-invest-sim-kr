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
  const { cash, assets, buyAsset, sellAsset, depositAsset, strategies } = usePortfolio();
  const [orderType, setOrderType] = useState(initialOrderType);
  const [isDeposit, setIsDeposit] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('amount');
  const [inputValue, setInputValue] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState('manual');

  const [tradeState, setTradeState] = useState<{
    status: 'idle' | 'submitting' | 'success' | 'error';
    message?: string;
    progress?: number;
  }>({ status: 'idle' });

  const asset = assets.find(a => a.market === ticker?.market);

  useEffect(() => {
    if (show) {
      setOrderType(initialOrderType);
      setInputValue('');
      setInputMode('amount');
      setSelectedStrategy('manual');
      setTradeState({ status: 'idle' });
      setIsDeposit(false);
    }
  }, [show, initialOrderType]);

  useEffect(() => {
    // When switching to deposit mode, ensure order type is 'buy' and reset input mode
    if (isDeposit) {
      setOrderType('buy');
      setInputMode('amount'); // Default to amount for deposits
    }
  }, [isDeposit]);

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
      } else if (inputMode === 'price') {
        totalPrice = numericValue;
        amount = totalPrice / ticker.trade_price;
      } else if (inputMode === 'percent') {
        const targetCash = availableCash * (numericValue / 100);
        amount = targetCash / ticker.trade_price;
        totalPrice = targetCash;
      }
    } else { // Sell
      const availableQuantity = asset?.quantity || 0;
      if (inputMode === 'amount') {
        amount = numericValue;
        totalPrice = amount * ticker.trade_price;
      } else if (inputMode === 'price') {
        totalPrice = numericValue;
        amount = totalPrice / ticker.trade_price;
      } else if (inputMode === 'percent') {
        amount = availableQuantity * (numericValue / 100);
        totalPrice = amount * ticker.trade_price;
      }
    }

    setCalculatedAmount(amount);
    setTotal(totalPrice);
  }, [inputValue, inputMode, orderType, ticker, cash, asset]);

  const handleTrade = async () => {
    if (calculatedAmount <= 0) {
      setTradeState({ status: 'error', message: '수량은 0보다 커야 합니다.' });
      return;
    }
    
    // Total can be 0 for deposits if the user only enters an amount, which is fine.
    if (total <= 0 && !isDeposit) {
        setTradeState({ status: 'error', message: '총 주문 금액은 0보다 커야 합니다.' });
        return;
    }

    const strategy = strategies.find(s => s.id === selectedStrategy);
    const source = strategy ? strategy.id : 'manual';
    const strategyType = strategy ? strategy.strategyType : 'manual';
    
    const finalPrice = ticker!.trade_price;
    const finalAmount = calculatedAmount;

    setTradeState({ status: 'submitting', progress: 10, message: '주문 처리 중...' });

    try {
      let success = false;
      setTimeout(() => setTradeState(s => ({ ...s, progress: 40 })), 200);

      if (isDeposit) {
        success = await depositAsset(ticker!.market, finalPrice, finalAmount, 'manual_deposit');
      } else if (orderType === 'buy') {
        if (total > cash) {
          setTradeState({ status: 'error', message: `현금이 부족합니다. (보유: ${cash.toLocaleString('ko-KR')}원)` });
          return;
        }
        success = await buyAsset(ticker!.market, finalPrice, finalAmount, source, strategyType, false);
      } else { // sell
        const availableAmount = asset?.quantity || 0;
        if (finalAmount > availableAmount) {
          setTradeState({ status: 'error', message: `매도 가능 수량이 부족합니다.` });
          return;
        }
        success = await sellAsset(ticker!.market, finalPrice, finalAmount, source, strategyType, false);
      }

      setTradeState(s => ({ ...s, progress: 90 }));

      if (success) {
        setTradeState({ status: 'success', message: `${isDeposit ? '보유 자산 등록' : '거래'}이(가) 완료되었습니다!`, progress: 100 });
        setTimeout(() => {
          setInputValue('');
          handleClose();
        }, 1500);
      } else {
        setTradeState({ status: 'error', message: `${isDeposit ? '등록' : '거래'} 처리에 실패했습니다.` });
      }
    } catch (error) {
      console.error('Trade error:', error);
      setTradeState({ status: 'error', message: '처리 중 오류가 발생했습니다.' });
    }
  };

  const getMarketName = (market: string) => {
    const names: { [key: string]: string } = {
      'KRW-BTC': '비트코인', 'KRW-ETH': '이더리움', 'KRW-XRP': '리플', 'KRW-DOGE': '도지코인',
      'KRW-SOL': '솔라나', 'KRW-ADA': '에이다', 'KRW-AVAX': '아발란체', 'KRW-DOT': '폴카닷',
      'KRW-MATIC': '폴리곤', 'KRW-TRX': '트론', 'KRW-SHIB': '시바이누', 'KRW-ETC': '이더리움 클래식',
      'KRW-BCH': '비트코인 캐시', 'KRW-LINK': '체인링크',
    };
    return names[market] || market;
  };
  
  const getQuickPercentButtons = () => {
    return [25, 50, 75, 100];
  };

  if (!show || !ticker) return null;

  const isBuy = orderType === 'buy';

  return (
    <div
      className="Box-overlay d-flex flex-justify-center flex-items-center"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 9999, overflow: 'auto', padding: '20px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="Box"
        style={{
          width: '95%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', position: 'relative',
          backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)', border: '1px solid var(--color-border-default)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="Box-header Box-header--divided" style={{ backgroundColor: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
          <h5 className="Box-title" style={{ color: 'var(--color-fg-default)' }}>
            {getMarketName(ticker.market)} ({ticker.market.replace('KRW-', '')}) {isDeposit ? '보유 등록' : '거래'}
          </h5>
          <button type="button" className="close-button" onClick={handleClose}>
            <svg className="octicon octicon-x" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>
          </button>
        </div>
        <div className="Box-body" style={{ backgroundColor: 'var(--color-canvas-subtle)' }}>

          {tradeState.status === 'submitting' || tradeState.status === 'success' || tradeState.status === 'error' ? (
             <div className="p-4 text-center">
                {tradeState.status === 'submitting' && (
                    <>
                        <div className="mb-2">
                            <svg style={{ boxSizing: "content-box", color: "var(--color-icon-primary)" }} width="32" height="32" viewBox="0 0 16 16" fill="none" className="anim-rotate">
                                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" fill="none"></circle>
                                <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"></path>
                            </svg>
                        </div>
                        <div className="text-bold mb-2">{tradeState.message}</div>
                        <div style={{ width: '100%', height: '4px', backgroundColor: '#e1e4e8', borderRadius: '2px' }}>
                            <div style={{ width: `${tradeState.progress}%`, height: '100%', backgroundColor: '#0969da', borderRadius: '2px', transition: 'width 0.3s ease' }}></div>
                        </div>
                    </>
                )}
                {tradeState.status === 'success' && (
                    <div className="flash flash-success my-3">
                        <svg className="octicon octicon-check mr-2" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>
                        {tradeState.message}
                    </div>
                )}
                {tradeState.status === 'error' && (
                    <div className="flash flash-error my-3">
                        <svg className="octicon octicon-stop mr-2" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M4.47.22A.75.75 0 0 1 5 0h6a.75.75 0 0 1 .53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 0 1-.22.53l-4.25 4.25A.75.75 0 0 1 11 16H5a.75.75 0 0 1-.53-.22L.22 11.53A.75.75 0 0 1 0 11V5a.75.75 0 0 1 .22-.53L4.47.22Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5H5.31ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>
                        {tradeState.message}
                    </div>
                )}
            </div>
          ) : (
            <>
              <ChartComponent market={ticker.market} />

              <div className="form-group mb-3 mt-3">
                <div className="form-checkbox">
                  <input type="checkbox" id="is-deposit-checkbox" checked={isDeposit} onChange={(e) => setIsDeposit(e.target.checked)} />
                  <label htmlFor="is-deposit-checkbox" style={{ color: 'var(--color-fg-default)' }}>
                    기존 보유 자산 등록 (현금 변동 없음)
                  </label>
                </div>
              </div>

              <div className="UnderlineNav my-3">
                <div className="UnderlineNav-body">
                  <a href="#" className={`UnderlineNav-item ${isBuy ? 'selected' : ''}`} onClick={(e) => { e.preventDefault(); if (!isDeposit) setOrderType('buy'); setInputValue(''); }} style={{ color: isBuy ? 'var(--color-danger-fg)' : 'var(--color-fg-muted)', borderBottomColor: isBuy ? 'var(--color-danger-fg)' : 'transparent' }} >
                    {isDeposit ? '보유 등록' : '매수'}
                  </a>
                  {!isDeposit && (
                    <a href="#" className={`UnderlineNav-item ${!isBuy ? 'selected' : ''}`} onClick={(e) => { e.preventDefault(); setOrderType('sell'); setInputValue(''); }} style={{ color: !isBuy ? 'var(--color-success-fg)' : 'var(--color-fg-muted)', borderBottomColor: !isBuy ? 'var(--color-success-fg)' : 'transparent' }} >
                      매도
                    </a>
                  )}
                </div>
              </div>

              {!isDeposit && (
                <div className="mb-3" style={{ padding: '12px', backgroundColor: 'var(--color-canvas-default)', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}>
                  <p style={{ margin: '0 0 8px 0', color: 'var(--color-fg-muted)', fontSize: '14px' }}>
                    주문 가능:
                    <span style={{ color: 'var(--color-fg-default)', fontWeight: 600, marginLeft: '8px' }}>
                      {isBuy ? `${cash.toLocaleString('ko-KR')} 원` : `${(asset?.quantity || 0).toFixed(8)} ${ticker.market.replace('KRW-', '')}`}
                    </span>
                  </p>
                </div>
              )}
              
              <p style={{ margin: '0 0 8px 0', color: 'var(--color-fg-muted)', fontSize: '14px' }}>
                  현재가 (참고):
                  <span style={{ color: 'var(--color-fg-default)', fontWeight: 600, marginLeft: '8px' }}>
                    {ticker.trade_price.toLocaleString('ko-KR')} 원
                  </span>
              </p>
              
              {!isDeposit && (
                <div className="form-group mb-3">
                  <div className="form-group-header"><label style={{ color: 'var(--color-fg-default)', marginBottom: '8px', display: 'block' }}>입력 방식</label></div>
                  <div className="d-flex" style={{ gap: '8px', marginBottom: '12px' }}>
                    <button type="button" className="btn" onClick={() => { setInputMode('amount'); setInputValue(''); }} style={{ flex: 1, backgroundColor: inputMode === 'amount' ? 'var(--color-accent-fg)' : 'var(--color-canvas-default)', color: inputMode === 'amount' ? '#fff' : 'var(--color-fg-default)', borderColor: inputMode === 'amount' ? 'var(--color-accent-fg)' : 'var(--color-border-default)' }}>수량</button>
                    <button type="button" className="btn" onClick={() => { setInputMode('percent'); setInputValue(''); }} style={{ flex: 1, backgroundColor: inputMode === 'percent' ? 'var(--color-accent-fg)' : 'var(--color-canvas-default)', color: inputMode === 'percent' ? '#fff' : 'var(--color-fg-default)', borderColor: inputMode === 'percent' ? 'var(--color-accent-fg)' : 'var(--color-border-default)' }}>퍼센트</button>
                    <button type="button" className="btn" onClick={() => { setInputMode('price'); setInputValue(''); }} style={{ flex: 1, backgroundColor: inputMode === 'price' ? 'var(--color-accent-fg)' : 'var(--color-canvas-default)', color: inputMode === 'price' ? '#fff' : 'var(--color-fg-default)', borderColor: inputMode === 'price' ? 'var(--color-accent-fg)' : 'var(--color-border-default)' }}>금액</button>
                  </div>
                </div>
              )}

              {inputMode === 'percent' && !isDeposit && (
                <div className="mb-3"><div className="d-flex" style={{ gap: '8px' }}>{getQuickPercentButtons().map(percent => (<button key={percent} type="button" className="btn btn-sm" onClick={() => setInputValue(percent.toString())} style={{ flex: 1, backgroundColor: 'var(--color-canvas-default)', color: 'var(--color-fg-default)', borderColor: 'var(--color-border-default)' }}>{percent}%</button>))}</div></div>
              )}

              <div className="form-group mb-3">
                <div className="form-group-header"><label style={{ color: 'var(--color-fg-default)' }}>{isDeposit ? '보유 수량' : (inputMode === 'amount' ? '수량' : inputMode === 'percent' ? '퍼센트 (%)' : '금액 (원)')}</label></div>
                <div className="form-group-body"><input type="number" className="form-control" placeholder="0" value={inputValue} onChange={(e) => setInputValue(e.target.value)} style={{ backgroundColor: 'var(--color-canvas-default)', color: 'var(--color-fg-default)', borderColor: 'var(--color-border-default)' }} /></div>
              </div>

              {!isDeposit && (
                <div className="form-group mb-3">
                  <div className="form-group-header"><label htmlFor="strategy-select" style={{ color: 'var(--color-fg-default)' }}>전략 연결</label></div>
                  <div className="form-group-body">
                    <select id="strategy-select" className="form-select" value={selectedStrategy} onChange={(e) => setSelectedStrategy(e.target.value)} style={{ backgroundColor: 'var(--color-canvas-default)', color: 'var(--color-fg-default)', borderColor: 'var(--color-border-default)' }} >
                      <option value="manual">수동 거래</option>
                      {strategies.filter(s => s.market === ticker.market).map(s => (<option key={s.id} value={s.id}>{s.name || `${s.strategyType} - ${s.market}`}</option>))}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ padding: '12px', backgroundColor: 'var(--color-canvas-default)', borderRadius: '6px', border: '1px solid var(--color-border-default)', marginBottom: '16px' }}>
                <div className="d-flex flex-justify-between mb-2">
                  <span style={{ color: 'var(--color-fg-muted)', fontSize: '14px' }}>{isDeposit ? '등록될 수량' : '거래 수량'}:</span>
                  <span style={{ color: 'var(--color-fg-default)', fontWeight: 600 }}>{calculatedAmount.toFixed(8)} {ticker.market.replace('KRW-', '')}</span>
                </div>
                <div className="d-flex flex-justify-between">
                  <span style={{ color: 'var(--color-fg-muted)', fontSize: '14px' }}>{isDeposit ? '평가액 (현재가 기준)' : '주문 총액'}:</span>
                  <span style={{ color: 'var(--color-fg-default)', fontWeight: 600, fontSize: '16px' }}>{total.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원</span>
                </div>
              </div>
            </>
          )}

        </div>
        <div className="Box-footer d-flex flex-justify-end" style={{ padding: '16px', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)', position: 'sticky', bottom: 0, zIndex: 10 }}>
          <button type="button" className="btn mr-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }} style={{ cursor: 'pointer', minWidth: '80px', backgroundColor: 'var(--color-canvas-default)', color: 'var(--color-fg-default)', borderColor: 'var(--color-border-default)' }}>취소</button>
          <button type="button" className={`btn ${isBuy ? 'btn-danger' : 'btn-primary'}`} disabled={tradeState.status === 'submitting'} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTrade(); }} style={{ cursor: 'pointer', minWidth: '80px' }}>
            {isDeposit ? '보유 등록' : (isBuy ? '매수' : '매도')}
          </button>
        </div>
      </div>
    </div>
  );
}
