'use client';

import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

interface Snapshot {
    snapshot_date: string;
    total_value: number;
    daily_return_pct: number;
    total_return_pct: number;
}

export default function PortfolioAnalytics() {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('30');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/portfolio/snapshots?days=${period}`);
                if (res.ok) {
                    const data = await res.json();
                    setSnapshots(data);
                }
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [period]);

    if (loading) {
        return <div className="p-4 text-center">Loading analytics...</div>;
    }

    if (snapshots.length === 0) {
        return (
            <div className="Box p-4 text-center">
                <p className="color-fg-muted">데이터가 충분하지 않습니다. (내일 다시 확인해주세요)</p>
            </div>
        );
    }

    const lastSnapshot = snapshots[snapshots.length - 1];

    return (
        <div className="analytics-container">
            <div className="d-flex flex-justify-between flex-items-center mb-3">
                <h2 className="f3">포트폴리오 분석</h2>
                <div className="BtnGroup">
                    <button className={`BtnGroup-item btn btn-sm ${period === '7' ? 'selected' : ''}`} onClick={() => setPeriod('7')}>7일</button>
                    <button className={`BtnGroup-item btn btn-sm ${period === '30' ? 'selected' : ''}`} onClick={() => setPeriod('30')}>30일</button>
                    <button className={`BtnGroup-item btn btn-sm ${period === '90' ? 'selected' : ''}`} onClick={() => setPeriod('90')}>90일</button>
                </div>
            </div>

            <div className="d-flex flex-wrap gutter-md mb-4">
                <div className="col-12 col-md-4 mb-3">
                    <div className="Box p-3">
                        <div className="text-small color-fg-muted">총 자산</div>
                        <div className="f3 text-bold">{lastSnapshot.total_value.toLocaleString()} 원</div>
                    </div>
                </div>
                <div className="col-12 col-md-4 mb-3">
                    <div className="Box p-3">
                        <div className="text-small color-fg-muted">누적 수익률</div>
                        <div className={`f3 text-bold ${lastSnapshot.total_return_pct >= 0 ? 'color-fg-success' : 'color-fg-danger'}`}>
                            {lastSnapshot.total_return_pct.toFixed(2)}%
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-4 mb-3">
                    <div className="Box p-3">
                        <div className="text-small color-fg-muted">일일 수익률</div>
                        <div className={`f3 text-bold ${lastSnapshot.daily_return_pct >= 0 ? 'color-fg-success' : 'color-fg-danger'}`}>
                            {lastSnapshot.daily_return_pct.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="Box p-3 mb-4">
                <h4 className="mb-3">자산 가치 추이</h4>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <LineChart data={snapshots}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="snapshot_date" tickFormatter={(val) => val.substring(5)} />
                            <YAxis domain={['auto', 'auto']} tickFormatter={(val) => (val / 10000).toFixed(0) + '만'} />
                            <Tooltip formatter={(val: number) => val.toLocaleString() + ' 원'} />
                            <Legend />
                            <Line type="monotone" dataKey="total_value" name="총 자산" stroke="#0969da" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="Box p-3">
                <h4 className="mb-3">일일 수익률</h4>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <BarChart data={snapshots}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="snapshot_date" tickFormatter={(val) => val.substring(5)} />
                            <YAxis tickFormatter={(val) => val.toFixed(1) + '%'} />
                            <Tooltip formatter={(val: number) => val.toFixed(2) + '%'} />
                            <Legend />
                            <Bar dataKey="daily_return_pct" name="일일 수익률" fill="#2da44e" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
