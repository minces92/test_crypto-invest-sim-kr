'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';

interface Condition {
    indicator: 'RSI' | 'MA';
    operator: '>' | '<';
    value: number;
    period: number;
}

interface Strategy {
    name: string;
    buyCondition: Condition;
    sellCondition: Condition;
}

export default function StrategyBuilder() {
    const [strategy, setStrategy] = useState<Strategy>({
        name: '',
        buyCondition: { indicator: 'RSI', operator: '<', value: 30, period: 14 },
        sellCondition: { indicator: 'RSI', operator: '>', value: 70, period: 14 }
    });

    const handleSave = async () => {
        try {
            const res = await fetch('/api/custom-strategies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(strategy)
            });

            if (res.ok) {
                toast.success('전략이 성공적으로 저장되었습니다!');
                setStrategy({
                    name: '',
                    buyCondition: { indicator: 'RSI', operator: '<', value: 30, period: 14 },
                    sellCondition: { indicator: 'RSI', operator: '>', value: 70, period: 14 }
                });
            } else {
                throw new Error('Failed to save');
            }
        } catch (e) {
            toast.error('전략 저장 중 오류가 발생했습니다.');
            console.error(e);
        }
    };

    return (
        <div className="Box p-4">
            <h2 className="mb-3">나만의 전략 만들기</h2>

            <div className="form-group">
                <label>전략 이름</label>
                <input
                    className="form-control"
                    type="text"
                    value={strategy.name}
                    onChange={e => setStrategy({ ...strategy, name: e.target.value })}
                    placeholder="예: RSI 역추세 매매"
                />
            </div>

            <div className="d-flex gutter-md">
                <div className="col-6">
                    <div className="Box p-3 color-bg-subtle">
                        <h4 className="mb-2 color-fg-success">매수 조건</h4>
                        <div className="form-group">
                            <label>지표</label>
                            <select
                                className="form-select"
                                value={strategy.buyCondition.indicator}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    buyCondition: { ...strategy.buyCondition, indicator: e.target.value as any }
                                })}
                            >
                                <option value="RSI">RSI (상대강도지수)</option>
                                <option value="MA">이동평균선 (MA)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>기간</label>
                            <input
                                className="form-control input-sm"
                                type="number"
                                value={strategy.buyCondition.period}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    buyCondition: { ...strategy.buyCondition, period: parseInt(e.target.value) }
                                })}
                            />
                        </div>
                        <div className="d-flex flex-items-center">
                            <select
                                className="form-select mr-2"
                                value={strategy.buyCondition.operator}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    buyCondition: { ...strategy.buyCondition, operator: e.target.value as any }
                                })}
                            >
                                <option value="<">미만 (&lt;)</option>
                                <option value=">">초과 (&gt;)</option>
                            </select>
                            <input
                                className="form-control"
                                type="number"
                                value={strategy.buyCondition.value}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    buyCondition: { ...strategy.buyCondition, value: parseInt(e.target.value) }
                                })}
                            />
                        </div>
                    </div>
                </div>

                <div className="col-6">
                    <div className="Box p-3 color-bg-subtle">
                        <h4 className="mb-2 color-fg-danger">매도 조건</h4>
                        <div className="form-group">
                            <label>지표</label>
                            <select
                                className="form-select"
                                value={strategy.sellCondition.indicator}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    sellCondition: { ...strategy.sellCondition, indicator: e.target.value as any }
                                })}
                            >
                                <option value="RSI">RSI (상대강도지수)</option>
                                <option value="MA">이동평균선 (MA)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>기간</label>
                            <input
                                className="form-control input-sm"
                                type="number"
                                value={strategy.sellCondition.period}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    sellCondition: { ...strategy.sellCondition, period: parseInt(e.target.value) }
                                })}
                            />
                        </div>
                        <div className="d-flex flex-items-center">
                            <select
                                className="form-select mr-2"
                                value={strategy.sellCondition.operator}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    sellCondition: { ...strategy.sellCondition, operator: e.target.value as any }
                                })}
                            >
                                <option value="<">미만 (&lt;)</option>
                                <option value=">">초과 (&gt;)</option>
                            </select>
                            <input
                                className="form-control"
                                type="number"
                                value={strategy.sellCondition.value}
                                onChange={e => setStrategy({
                                    ...strategy,
                                    sellCondition: { ...strategy.sellCondition, value: parseInt(e.target.value) }
                                })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-center">
                <button className="btn btn-primary" onClick={handleSave}>
                    전략 저장하기
                </button>
            </div>
        </div>
    );
}
