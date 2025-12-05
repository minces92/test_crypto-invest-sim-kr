'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SharedData {
    name: string;
    description?: string;
    updatedAt: string;
    totalValue?: number;
    totalReturnPct?: number;
    totalGain?: number;
    holdings?: Array<{
        market: string;
        quantity: number;
        avg_buy_price: number;
    }>;
    trades?: Array<any>;
}

export default function SharedPortfolioPage() {
    const params = useParams();
    const [data, setData] = useState<SharedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!params.token) return;

        fetch(`/api/share/${params.token}`)
            .then(res => {
                if (!res.ok) throw new Error('포트폴리오를 찾을 수 없거나 만료되었습니다.');
                return res.json();
            })
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [params.token]);

    if (loading) return (
        <div className="d-flex flex-justify-center flex-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
                <span className="AnimatedEllipsis">로딩 중</span>
            </div>
        </div>
    );

    if (error) return (
        <div className="container-lg p-responsive py-4">
            <div className="flash flash-error">
                {error}
            </div>
        </div>
    );

    if (!data) return null;

    return (
        <div className="container-lg p-responsive py-4">
            <div className="Box mb-4">
                <div className="Box-header color-bg-subtle">
                    <div className="d-flex flex-justify-between flex-items-center">
                        <div>
                            <h1 className="Box-title f3">{data.name}</h1>
                            {data.description && <p className="text-small color-fg-muted mt-1 mb-0">{data.description}</p>}
                        </div>
                        <div className="text-small color-fg-muted">
                            업데이트: {new Date(data.updatedAt).toLocaleString('ko-KR')}
                        </div>
                    </div>
                </div>

                <div className="Box-body">
                    {data.totalValue !== undefined && (
                        <div className="Box color-bg-subtle p-3 rounded-2 mb-4 text-center">
                            <h5 className="f5 text-normal color-fg-muted mb-1">총 자산 가치</h5>
                            <h3 className="f1 text-bold mb-0">
                                {data.totalValue.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원
                            </h3>

                            {data.totalReturnPct !== undefined && (
                                <div className={`mt-2 f4 ${data.totalReturnPct >= 0 ? 'color-fg-success' : 'color-fg-danger'}`}>
                                    {data.totalReturnPct >= 0 ? '+' : ''}{data.totalReturnPct.toFixed(2)}%
                                    <span className="text-small ml-1">
                                        ({data.totalGain?.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원)
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {data.holdings && (
                        <>
                            <h3 className="f4 mb-2">보유 자산</h3>
                            {data.holdings.length === 0 ? (
                                <p className="color-fg-muted">보유 자산이 없습니다.</p>
                            ) : (
                                <div className="Box mb-4">
                                    <ul>
                                        {data.holdings.map((asset, i) => (
                                            <li key={i} className="Box-row d-flex flex-justify-between flex-items-center">
                                                <div>
                                                    <div className="text-bold">{asset.market.replace('KRW-', '')}</div>
                                                    <div className="text-small color-fg-muted">
                                                        {asset.quantity.toFixed(4)} 개
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div>평단가: {asset.avg_buy_price.toLocaleString('ko-KR')} 원</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}

                    {data.trades && (
                        <>
                            <h3 className="f4 mb-2">최근 거래 내역</h3>
                            <div className="Box overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="Table">
                                        <thead>
                                            <tr>
                                                <th>시간</th>
                                                <th>종류</th>
                                                <th>종목</th>
                                                <th>가격</th>
                                                <th>수량</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.trades.map((tx: any) => (
                                                <tr key={tx.id}>
                                                    <td>{new Date(tx.timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                                    <td className={tx.type === 'buy' ? 'color-fg-danger' : 'color-fg-success'}>
                                                        {tx.type === 'buy' ? '매수' : '매도'}
                                                    </td>
                                                    <td>{tx.market.replace('KRW-', '')}</td>
                                                    <td>{tx.price.toLocaleString('ko-KR')}</td>
                                                    <td>{tx.amount.toFixed(4)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="text-center">
                <a href="/" className="btn btn-primary">
                    나도 투자 시뮬레이션 시작하기
                </a>
            </div>
        </div>
    );
}
