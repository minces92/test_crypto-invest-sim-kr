'use client';

import { useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';

export default function TransactionHistory() {
  const { transactions, assets } = usePortfolio();
  const [analysis, setAnalysis] = useState<{ [txId: string]: string }>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<string | null>(null);

  const handleAnalyze = async (tx: any) => {
    if (!tx || !tx.id) return;
    setLoadingAnalysis(tx.id);
    try {
      // Find the current asset to get the latest price, assuming it's close enough
      const asset = assets.find(a => a.market === tx.market);
      const response = await fetch('/api/analyze-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transaction: tx, 
          marketPrice: asset ? asset.avg_buy_price : tx.price // Use avg price as a fallback
        }),
      });
      const data = await response.json();
      setAnalysis(prev => ({ ...prev, [tx.id]: data.analysis }));
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysis(prev => ({ ...prev, [tx.id]: "분석에 실패했습니다." }));
    } finally {
      setLoadingAnalysis(null);
    }
  };


  return (
    <div className="Box mt-4 border">
      <div className="Box-header">
        <h2 className="Box-title">거래 내역</h2>
      </div>
      <div className="Box-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {transactions.length === 0 ? (
          <p className="text-center color-fg-muted p-3">거래 내역이 없습니다.</p>
        ) : (
          <table className="Table Table--small">
            <thead className="color-bg-subtle">
              <tr>
                <th>시간</th>
                <th>종류</th>
                <th>종목</th>
                <th>수량</th>
                <th>가격</th>
                <th>총액</th>
                <th>AI 분석</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                tx && tx.market && (
                  <tr key={tx.id}>
                    <td>{new Date(tx.timestamp).toLocaleString('ko-KR', { hour12: false })}</td>
                    <td className={tx.type === 'buy' ? 'color-fg-danger' : 'color-fg-accent'}>
                      {tx.type === 'buy' ? '매수' : '매도'}
                    </td>
                    <td>{tx.market.replace('KRW-', '')}</td>
                    <td>{tx.amount.toFixed(4)}</td>
                    <td>{tx.price.toLocaleString('ko-KR')}</td>
                    <td>{(tx.price * tx.amount).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원</td>
                    <td>
                      {analysis[tx.id] ? (
                        <span className="text-small">{analysis[tx.id]}</span>
                      ) : (
                        <button 
                          className="btn btn-sm" 
                          onClick={() => handleAnalyze(tx)}
                          disabled={loadingAnalysis === tx.id}
                        >
                          {loadingAnalysis === tx.id ? '분석중...' : '분석'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
