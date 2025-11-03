'use client';

import { usePortfolio } from '@/context/PortfolioContext';

export default function TransactionHistory() {
  const { transactions } = usePortfolio();

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h2>거래 내역</h2>
      </div>
      <div className="card-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {transactions.length === 0 ? (
          <p className="text-center text-muted">거래 내역이 없습니다.</p>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th>시간</th>
                <th>종류</th>
                <th>종목</th>
                <th>수량</th>
                <th>가격</th>
                <th>총액</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td>{new Date(tx.timestamp).toLocaleString('ko-KR', { hour12: false })}</td>
                  <td className={tx.type === 'buy' ? 'text-danger' : 'text-primary'}>
                    {tx.type === 'buy' ? '매수' : '매도'}
                  </td>
                  <td>{tx.market.replace('KRW-', '')}</td>
                  <td>{tx.amount.toFixed(4)}</td>
                  <td>{tx.price.toLocaleString('ko-KR')}</td>
                  <td>{(tx.price * tx.amount).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
