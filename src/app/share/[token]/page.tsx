'use client';

import React, { useState, useEffect } from 'react';

interface SharedData {
    name: string;
    description: string;
    holdings?: any[];
    totalValue?: number;
    totalReturnPct?: number;
    trades?: any[];
}

export default function SharedPortfolioPage({ params }: { params: { token: string } }) {
    const [data, setData] = useState<SharedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/share/${params.token}`)
            .then(res => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then(setData)
            .catch(err => setError('포트폴리오를 찾을 수 없거나 비공개 상태입니다.'))
            .finally(() => setLoading(false));
    }, [params.token]);

    if (loading) return <div className="p-5 text-center">Loading...</div>;
    if (error) return <div className="p-5 text-center color-fg-danger">{error}</div>;
    if (!data) return null;

    return (
        <div className="container-xl px-3 px-md-4 px-lg-5 py-4">
            <div className="Box p-4 mb-4">
                <h1 className="h2 mb-2">{data.name}</h1>
                {data.description && <p className="color-fg-muted">{data.description}</p>}
            </div>

            {data.totalValue !== undefined && (
                <div className="d-flex flex-wrap gutter-md mb-4">
                    <div className="col-12 col-md-6 mb-3">
                        <div className="Box p-3">
                            <div className="text-small color-fg-muted">총 자산 가치</div>
                            <div className="f2 text-bold">{data.totalValue.toLocaleString()} 원</div>
                        </div>
                    </div>
                    {data.totalReturnPct !== undefined && (
                        <div className="col-12 col-md-6 mb-3">
                            <div className="Box p-3">
                                <div className="text-small color-fg-muted">수익률</div>
                                <div className={`f2 text-bold ${data.totalReturnPct >= 0 ? 'color-fg-success' : 'color-fg-danger'}`}>
                                    {data.totalReturnPct.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {data.holdings && (
                <div className="Box mb-4">
                    <div className="Box-header">
                        <h3 className="Box-title">보유 자산</h3>
                    </div>
                    <div className="Box-body">
                        <table className="Table">
                            <thead>
                                <tr>
                                    <th>종목</th>
                                    <th>수량</th>
                                    <th>평단가</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.holdings.map((h: any) => (
                                    <tr key={h.market}>
                                        <td>{h.market}</td>
                                        <td>{h.quantity.toFixed(4)}</td>
                                        <td>{h.avg_buy_price.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {data.trades && (
                <div className="Box">
                    <div className="Box-header">
                        <h3 className="Box-title">최근 거래 내역</h3>
                    </div>
                    <div className="Box-body">
                        <table className="Table">
                            <thead>
                                <tr>
                                    <th>시간</th>
                                    <th>종류</th>
                                    <th>종목</th>
                                    <th>가격</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.trades.map((t: any) => (
                                    <tr key={t.id}>
                                        <td>{new Date(t.timestamp).toLocaleDateString()}</td>
                                        <td className={t.type === 'buy' ? 'color-fg-danger' : 'color-fg-accent'}>
                                            {t.type === 'buy' ? '매수' : '매도'}
                                        </td>
                                        <td>{t.market}</td>
                                        <td>{t.price.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
