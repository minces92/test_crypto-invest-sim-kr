'use client';

import { useState, useEffect, useRef } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';

export default function TransactionHistory() {
  const { transactions, assets } = usePortfolio();
  const [analysis, setAnalysis] = useState<{ [txId: string]: string }>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const loadedFromDbRef = useRef<Set<string>>(new Set());

  // 컴포넌트 마운트 시 DB에서 분석 결과 로드
  useEffect(() => {
    const loadCachedAnalyses = async () => {
      try {
        const response = await fetch('/api/analysis/cache');
        if (response.ok) {
          const data = await response.json();
          if (data.analyses) {
            setAnalysis(data.analyses);
            // DB에서 로드한 항목들 표시
            Object.keys(data.analyses).forEach(txId => {
              loadedFromDbRef.current.add(txId);
            });
          }
        }
      } catch (error) {
        console.error('Failed to load cached analyses:', error);
      }
    };

    loadCachedAnalyses();
  }, []);

  // 거래가 추가될 때마다 자동으로 AI 분석 시작 (DB에 없는 경우만)
  useEffect(() => {
    transactions.forEach(tx => {
      // 이미 분석 중이거나 DB에서 로드한 거래는 건너뛰기
      if (!tx || !tx.id || analyzingIds.has(tx.id) || loadedFromDbRef.current.has(tx.id)) {
        return;
      }

      // 분석 결과가 이미 있으면 건너뛰기
      if (analysis[tx.id] && analysis[tx.id] !== '분석중...') {
        return;
      }

      // 분석 시작
      setAnalyzingIds(prev => new Set(prev).add(tx.id));

      // 먼저 "분석중..." 표시
      setAnalysis(prev => ({ ...prev, [tx.id]: '분석중...' }));

      // 비동기로 AI 분석 수행
      (async () => {
        try {
          const asset = assets.find(a => a.market === tx.market);
          const response = await fetch('/api/analyze-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transaction: tx, 
              marketPrice: asset ? asset.avg_buy_price : tx.price
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

          // 분석 완료 - 결과 업데이트
          setAnalysis(prev => ({ 
            ...prev, 
            [tx.id]: data.analysis || '분석 결과를 가져올 수 없습니다.' 
          }));
          
          // DB에서 로드한 것으로 표시
          loadedFromDbRef.current.add(tx.id);
        } catch (error) {
          console.error("Analysis failed:", error);
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          
          // Ollama 관련 에러인 경우 더 친화적인 메시지 표시
          if (errorMessage.includes('Ollama') || errorMessage.includes('503')) {
            setAnalysis(prev => ({ 
              ...prev, 
              [tx.id]: "⚠️ Ollama 서비스가 실행 중이지 않습니다." 
            }));
          } else {
            setAnalysis(prev => ({ 
              ...prev, 
              [tx.id]: `분석 실패: ${errorMessage}` 
            }));
          }
        } finally {
          setAnalyzingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(tx.id);
            return newSet;
          });
        }
      })();
    });
  }, [transactions, assets, analyzingIds, analysis]);

  // 수동으로 다시 분석하는 함수
  const handleReanalyze = async (tx: any) => {
    if (!tx || !tx.id) return;
    
    // 분석 상태 초기화 (DB 캐시도 무시)
    loadedFromDbRef.current.delete(tx.id);
    setAnalyzingIds(prev => new Set(prev).add(tx.id));
    setAnalysis(prev => ({ ...prev, [tx.id]: '분석중...' }));

    try {
      const asset = assets.find(a => a.market === tx.market);
      const response = await fetch('/api/analyze-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transaction: tx, 
          marketPrice: asset ? asset.avg_buy_price : tx.price
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

      setAnalysis(prev => ({ 
        ...prev, 
        [tx.id]: data.analysis || '분석 결과를 가져올 수 없습니다.' 
      }));
    } catch (error) {
      console.error("Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      if (errorMessage.includes('Ollama') || errorMessage.includes('503')) {
        setAnalysis(prev => ({ 
          ...prev, 
          [tx.id]: "⚠️ Ollama 서비스가 실행 중이지 않습니다." 
        }));
      } else {
        setAnalysis(prev => ({ 
          ...prev, 
          [tx.id]: `분석 실패: ${errorMessage}` 
        }));
      }
    } finally {
      setAnalyzingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tx.id);
        return newSet;
      });
    }
  };


  return (
    <div className="Box mt-4 border">
      <div className="Box-header">
        <h2 className="Box-title">거래 내역</h2>
      </div>
      <div className="Box-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {transactions.length === 0 ? (
          <div className="text-center p-3">
            <p className="color-fg-muted">거래 내역이 없습니다.</p>
            <p className="color-fg-subtle text-small mt-2">
              '자동 매매' 탭에서 투자 전략을 추가하거나, <br />
              코인 목록에서 직접 '매수'/'매도'를 실행하여 거래를 시작할 수 있습니다.
            </p>
          </div>
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
                <th>구분</th>
                <th>전략</th>
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
                      <span 
                        className={`text-small text-bold ${tx.isAuto ? 'color-fg-success' : 'color-fg-muted'}`}
                        style={{ 
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: tx.isAuto ? 'rgba(63, 185, 80, 0.1)' : 'rgba(139, 148, 158, 0.1)'
                        }}
                      >
                        {tx.isAuto ? '자동' : '수동'}
                      </span>
                    </td>
                    <td>
                      {tx.strategyType && (
                        <span 
                          className="text-small"
                          style={{ 
                            color: 'var(--color-accent-fg)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(88, 166, 255, 0.1)'
                          }}
                        >
                          {tx.strategyType === 'dca' ? 'DCA' :
                           tx.strategyType === 'ma' ? '이동평균' :
                           tx.strategyType === 'rsi' ? 'RSI' :
                           tx.strategyType === 'bband' ? '볼린저밴드' :
                           tx.strategyType === 'news' ? '뉴스기반' :
                           tx.strategyType === 'volatility' ? '변동성돌파' :
                           tx.strategyType === 'momentum' ? '모멘텀' :
                           tx.strategyType === 'manual' ? '수동 구매' :
                           tx.strategyType}
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: '300px', wordWrap: 'break-word' }}>
                      <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                        <span>{analysis[tx.id] || '분석중...'}</span>
                        {analysis[tx.id] && analysis[tx.id] !== '분석중...' && (
                          <button 
                            className="btn btn-sm ml-2" 
                            onClick={() => handleReanalyze(tx)}
                            disabled={analyzingIds.has(tx.id)}
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                          >
                            {analyzingIds.has(tx.id) ? '분석중...' : '다시 분석'}
                          </button>
                        )}
                      </div>
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
