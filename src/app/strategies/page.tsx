'use client';

import React from 'react';
import Header from '@/components/Header';
import StrategyBuilder from '@/components/StrategyBuilder';
import { usePortfolio } from '@/context/PortfolioContext';
import toast from 'react-hot-toast';

export default function StrategiesPage() {
    const { startStrategy, strategies, stopStrategy } = usePortfolio();

    const handleSave = (strategyConfig: any) => {
        startStrategy(strategyConfig);
        toast.success(`전략 '${strategyConfig.name}'이(가) 시작되었습니다.`);
    };

    return (
        <>
            <Header />
            <div className="container-xl px-3 px-md-4 px-lg-5 py-4">
                <div className="d-flex flex-items-center flex-justify-between mb-4">
                    <h1 className="h2">투자 전략 빌더</h1>
                </div>

                <div className="d-flex flex-wrap gutter-md">
                    <div className="col-12 col-lg-8 mb-4">
                        <div className="mb-3">
                            <p className="color-fg-muted">
                                다양한 보조지표(RSI, 이평선 등)를 조합하여 나만의 자동매매 전략을 만들어보세요.
                                생성된 전략은 우측 '실행 중인 전략' 목록에 추가되며 즉시 가동됩니다.
                            </p>
                        </div>
                        <StrategyBuilder onSave={handleSave} />
                    </div>

                    <div className="col-12 col-lg-4">
                        <div className="Box position-sticky" style={{ top: '20px' }}>
                            <div className="Box-header">
                                <h3 className="Box-title">실행 중인 전략 ({strategies.length})</h3>
                            </div>
                            {strategies.length === 0 ? (
                                <div className="Box-body text-center color-fg-muted">
                                    실행 중인 전략이 없습니다.
                                </div>
                            ) : (
                                <ul>
                                    {strategies.map(s => (
                                        <li key={s.id} className="Box-row d-flex flex-justify-between flex-items-center">
                                            <div className="overflow-hidden mr-2">
                                                <div className="f5 font-bold text-truncate" title={s.name}>{s.name || s.strategyType.toUpperCase()}</div>
                                                <div className="text-small color-fg-muted">{s.market}</div>
                                            </div>
                                            <button
                                                className="btn btn-danger btn-sm flex-shrink-0"
                                                onClick={() => stopStrategy(s.id)}
                                            >
                                                중지
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
