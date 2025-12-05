'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import BacktestRunner from '@/components/BacktestRunner';
import { Strategy } from '@/context/PortfolioContext';

export default function BacktestPage() {
    const [market, setMarket] = useState('KRW-BTC');
    const [strategyType, setStrategyType] = useState('rsi');

    // Strategy Parameters State
    const [rsiPeriod, setRsiPeriod] = useState(14);
    const [rsiBuy, setRsiBuy] = useState(30);
    const [rsiSell, setRsiSell] = useState(70);

    const [maShort, setMaShort] = useState(5);
    const [maLong, setMaLong] = useState(20);

    const [volMultiplier, setVolMultiplier] = useState(0.5);

    // Construct strategy object based on current state
    const getStrategyConfig = (): Partial<Strategy> => {
        switch (strategyType) {
            case 'rsi':
                return {
                    strategyType: 'rsi',
                    market,
                    period: rsiPeriod,
                    buyThreshold: rsiBuy,
                    sellThreshold: rsiSell
                } as any;
            case 'ma':
                return {
                    strategyType: 'ma',
                    market,
                    shortPeriod: maShort,
                    longPeriod: maLong
                } as any;
            case 'volatility':
                return {
                    strategyType: 'volatility',
                    market,
                    multiplier: volMultiplier
                } as any;
            default:
                return { strategyType: 'dca', market } as any;
        }
    };

    return (
        <>
            <Header />
            <div className="container-xl px-3 px-md-4 px-lg-5 py-4">
                <div className="d-flex flex-items-center flex-justify-between mb-4">
                    <h1 className="h2">전략 백테스팅</h1>
                </div>

                <div className="d-flex flex-wrap gutter-md">
                    {/* Configuration Sidebar */}
                    <div className="col-12 col-md-4 mb-4">
                        <div className="Box p-3 color-bg-subtle">
                            <h3 className="f4 mb-3">설정</h3>

                            <div className="form-group">
                                <label>대상 코인</label>
                                <select
                                    className="form-select width-full"
                                    value={market}
                                    onChange={(e) => setMarket(e.target.value)}
                                >
                                    {['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-DOGE'].map(m => (
                                        <option key={m} value={m}>{m.replace('KRW-', '')}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>전략 유형</label>
                                <select
                                    className="form-select width-full"
                                    value={strategyType}
                                    onChange={(e) => setStrategyType(e.target.value)}
                                >
                                    <option value="rsi">RSI (상대강도지수)</option>
                                    <option value="ma">이동평균선 교차</option>
                                    <option value="volatility">변동성 돌파</option>
                                </select>
                            </div>

                            <hr className="my-3" />

                            {strategyType === 'rsi' && (
                                <>
                                    <div className="form-group">
                                        <label>기간 (Period)</label>
                                        <input type="number" className="form-control width-full" value={rsiPeriod} onChange={e => setRsiPeriod(Number(e.target.value))} />
                                    </div>
                                    <div className="form-group">
                                        <label>매수 기준 (Under)</label>
                                        <input type="number" className="form-control width-full" value={rsiBuy} onChange={e => setRsiBuy(Number(e.target.value))} />
                                    </div>
                                    <div className="form-group">
                                        <label>매도 기준 (Over)</label>
                                        <input type="number" className="form-control width-full" value={rsiSell} onChange={e => setRsiSell(Number(e.target.value))} />
                                    </div>
                                </>
                            )}

                            {strategyType === 'ma' && (
                                <>
                                    <div className="form-group">
                                        <label>단기 이평 (Short)</label>
                                        <input type="number" className="form-control width-full" value={maShort} onChange={e => setMaShort(Number(e.target.value))} />
                                    </div>
                                    <div className="form-group">
                                        <label>장기 이평 (Long)</label>
                                        <input type="number" className="form-control width-full" value={maLong} onChange={e => setMaLong(Number(e.target.value))} />
                                    </div>
                                </>
                            )}

                            {strategyType === 'volatility' && (
                                <div className="form-group">
                                    <label>K값 (Multiplier)</label>
                                    <input type="number" step="0.1" className="form-control width-full" value={volMultiplier} onChange={e => setVolMultiplier(Number(e.target.value))} />
                                    <p className="note">변동성 돌파 계수 (보통 0.5)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Runner Area */}
                    <div className="col-12 col-md-8">
                        <div className="Box p-3">
                            <p className="color-fg-muted mb-3">
                                과거 데이터를 기반으로 전략의 성과를 시뮬레이션합니다.
                                (기본 설정: 최근 200시간, 1시간 봉)
                            </p>
                            <BacktestRunner
                                market={market}
                                strategy={getStrategyConfig()}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
