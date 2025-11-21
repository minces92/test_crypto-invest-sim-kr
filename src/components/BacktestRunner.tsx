'use client';

import React, { useState } from 'react';
import { Strategy } from '@/context/PortfolioContext';
import toast from 'react-hot-toast';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';

interface BacktestRunnerProps {
    strategy: Partial<Strategy>;
    market: string;
}

export default function BacktestRunner({ strategy, market }: BacktestRunnerProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const chartContainerRef = React.useRef<HTMLDivElement>(null);

    const runBacktest = async () => {
        if (!market || !strategy.strategyType) {
            toast.error('전략과 마켓을 설정해주세요.');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy,
                    market,
                    interval: 'minutes/60', // Default to hourly for backtest
                    count: 200, // Test on last 200 hours
                }),
            });

            if (!response.ok) {
                throw new Error('Backtest failed');
            }

            const data = await response.json();
            setResult(data);
            toast.success('백테스팅 완료!');
        } catch (error) {
            console.error(error);
            toast.error('백테스팅 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // Render chart when result is available
    React.useEffect(() => {
        if (result && chartContainerRef.current) {
            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: 'transparent' },
                    textColor: '#333',
                },
                width: chartContainerRef.current.clientWidth,
                height: 300,
                grid: {
                    vertLines: { visible: false },
                    horzLines: { color: '#f0f3fa' },
                },
            });

            const lineSeries = chart.addSeries(LineSeries, { color: '#2962FF' });

            const data = result.history.map((h: any) => ({
                time: new Date(h.time).getTime() / 1000,
                value: h.value,
            }));

            lineSeries.setData(data);
            chart.timeScale().fitContent();

            return () => chart.remove();
        }
    }, [result]);

    return (
        <div className="Box mt-4">
            <div className="Box-header">
                <h3 className="Box-title">백테스팅 시뮬레이션</h3>
            </div>
            <div className="Box-body">
                <div className="d-flex flex-items-center mb-3">
                    <span className="mr-2">대상: <strong>{market}</strong></span>
                    <span className="mr-2">전략: <strong>{strategy.strategyType?.toUpperCase()}</strong></span>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={runBacktest}
                        disabled={loading || !market}
                    >
                        {loading ? '실행 중...' : '백테스팅 실행 (최근 200시간)'}
                    </button>
                </div>

                {result && (
                    <div>
                        <div className="d-flex flex-justify-between mb-3 p-3 color-bg-subtle rounded">
                            <div className="text-center">
                                <div className="text-small color-fg-muted">총 수익률</div>
                                <div className={`f3 ${result.totalReturn >= 0 ? 'color-fg-success' : 'color-fg-danger'}`}>
                                    {result.totalReturn.toFixed(2)}%
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-small color-fg-muted">최종 자산</div>
                                <div className="f3">{Math.round(result.finalCapital).toLocaleString()} KRW</div>
                            </div>
                            <div className="text-center">
                                <div className="text-small color-fg-muted">매매 횟수</div>
                                <div className="f3">{result.tradeCount}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-small color-fg-muted">승률</div>
                                <div className="f3">{result.winRate.toFixed(1)}%</div>
                            </div>
                        </div>

                        <div ref={chartContainerRef} style={{ width: '100%', height: '300px' }} />

                        <div className="mt-3">
                            <h4 className="f5 mb-2">거래 기록</h4>
                            <div className="overflow-auto" style={{ maxHeight: '200px' }}>
                                <table className="width-full text-small">
                                    <thead>
                                        <tr className="text-left">
                                            <th>시간</th>
                                            <th>유형</th>
                                            <th>가격</th>
                                            <th>수량</th>
                                            <th>수익</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.trades.map((trade: any, i: number) => (
                                            <tr key={i} className="border-bottom">
                                                <td>{new Date(trade.timestamp).toLocaleString()}</td>
                                                <td className={trade.type === 'buy' ? 'color-fg-success' : 'color-fg-danger'}>
                                                    {trade.type === 'buy' ? '매수' : '매도'}
                                                </td>
                                                <td>{trade.price.toLocaleString()}</td>
                                                <td>{trade.amount.toFixed(6)}</td>
                                                <td>
                                                    {trade.profit ? (
                                                        <span className={trade.profit > 0 ? 'color-fg-success' : 'color-fg-danger'}>
                                                            {Math.round(trade.profit).toLocaleString()}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
