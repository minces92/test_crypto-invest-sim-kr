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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(prev => ({ ...prev, [tx.id]: data.analysis || '분석 결과를 가져올 수 없습니다.' }));
    } catch (error) {
      console.error("Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      // Ollama 관련 에러인 경우 더 친화적인 메시지 표시
      if (errorMessage.includes('Ollama') || errorMessage.includes('503')) {
        setAnalysis(prev => ({ 
          ...prev, 
          [tx.id]: "⚠️ Ollama 서비스가 실행 중이지 않습니다. Ollama를 시작한 후 다시 시도해주세요." 
        }));
      } else {
        setAnalysis(prev => ({ 
          ...prev, 
          [tx.id]: `분석에 실패했습니다: ${errorMessage}` 
        }));
      }
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
                    <td style={{ maxWidth: '300px', wordWrap: 'break-word' }}>
                      {analysis[tx.id] ? (
                        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                          <span>{analysis[tx.id]}</span>
                          <button 
                            className="btn btn-sm ml-2" 
                            onClick={() => {
                              const newAnalysis = { ...analysis };
                              delete newAnalysis[tx.id];
                              setAnalysis(newAnalysis);
                            }}
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                          >
                            다시 분석
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="btn btn-sm" 
                          onClick={() => handleAnalyze(tx)}
                          disabled={loadingAnalysis === tx.id}
                        >
                          {loadingAnalysis === tx.id ? '분석중...' : 'AI 분석'}
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
