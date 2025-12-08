'use client';

import React, { useState } from 'react';
import { CustomCondition } from '@/context/PortfolioContext';

interface StrategyBuilderProps {
    onSave: (strategy: any) => void;
    initialMarket?: string;
}

export default function StrategyBuilder({ onSave, initialMarket = 'KRW-BTC' }: StrategyBuilderProps) {
    const [name, setName] = useState('');
    const [market, setMarket] = useState(initialMarket);
    const [buyConditions, setBuyConditions] = useState<CustomCondition[]>([
        { indicator: 'RSI', operator: '<', value: 30, period: 14 }
    ]);
    const [sellConditions, setSellConditions] = useState<CustomCondition[]>([
        { indicator: 'RSI', operator: '>', value: 70, period: 14 }
    ]);
    const [buyAmountPct, setBuyAmountPct] = useState(10);
    const [sellAmountPct, setSellAmountPct] = useState(50);

    // Collapsible state
    const [isBuyOpen, setIsBuyOpen] = useState(true);
    const [isSellOpen, setIsSellOpen] = useState(true);

    // Trailing Stop state
    const [useTrailingStop, setUseTrailingStop] = useState(false);
    const [tsActivation, setTsActivation] = useState(5);
    const [tsDistance, setTsDistance] = useState(2);

    const handleAddCondition = (type: 'buy' | 'sell') => {
        const newCondition: CustomCondition = { indicator: 'RSI', operator: '<', value: 50, period: 14 };
        if (type === 'buy') {
            setBuyConditions([...buyConditions, newCondition]);
        } else {
            setSellConditions([...sellConditions, newCondition]);
        }
    };

    const handleRemoveCondition = (type: 'buy' | 'sell', index: number) => {
        if (type === 'buy') {
            setBuyConditions(buyConditions.filter((_, i) => i !== index));
        } else {
            setSellConditions(sellConditions.filter((_, i) => i !== index));
        }
    };

    const updateCondition = (type: 'buy' | 'sell', index: number, field: keyof CustomCondition, value: any) => {
        const updater = (prev: CustomCondition[]) => {
            const newConditions = [...prev];
            newConditions[index] = { ...newConditions[index], [field]: value };
            return newConditions;
        };
        if (type === 'buy') setBuyConditions(updater);
        else setSellConditions(updater);
    };

    const handleSave = () => {
        if (!name) {
            alert('전략 이름을 입력해주세요.');
            return;
        }
        onSave({
            strategyType: 'custom',
            market,
            name,
            buyConditions,
            sellConditions,
            buyAmountPct,
            sellAmountPct,
            trailingStop: useTrailingStop ? {
                isActive: true,
                activationPct: tsActivation,
                distancePct: tsDistance
            } : undefined
        });
    };

    const renderConditionRow = (condition: CustomCondition, index: number, type: 'buy' | 'sell') => (
        <div key={index} className="d-flex flex-wrap flex-items-center mb-2 p-2 border rounded color-bg-default">
            <div className="col-12 col-md-3 mb-2 mb-md-0 px-1">
                <select
                    className="form-select input-sm width-full"
                    value={condition.indicator}
                    onChange={(e) => updateCondition(type, index, 'indicator', e.target.value)}
                >
                    <option value="RSI">RSI</option>
                    <option value="SMA">SMA (단순이평)</option>
                    <option value="EMA">EMA (지수이평)</option>
                    <option value="Price">현재가</option>
                </select>
            </div>
            {condition.indicator !== 'Price' && (
                <div className="col-6 col-md-2 mb-2 mb-md-0 px-1">
                    <input
                        type="number"
                        className="form-control input-sm width-full"
                        placeholder="기간"
                        value={condition.period}
                        onChange={(e) => updateCondition(type, index, 'period', parseInt(e.target.value))}
                    />
                </div>
            )}
            <div className="col-6 col-md-2 mb-2 mb-md-0 px-1">
                <select
                    className="form-select input-sm width-full"
                    value={condition.operator}
                    onChange={(e) => updateCondition(type, index, 'operator', e.target.value)}
                >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&ge;</option>
                    <option value="<=">&le;</option>
                    <option value="==">=</option>
                </select>
            </div>
            <div className="col-10 col-md-3 mb-2 mb-md-0 px-1">
                <input
                    type="number"
                    className="form-control input-sm width-full"
                    placeholder="값"
                    value={condition.value}
                    onChange={(e) => updateCondition(type, index, 'value', parseFloat(e.target.value))}
                />
            </div>
            <div className="col-2 col-md-1 mb-2 mb-md-0 px-1 text-center">
                <button
                    className="btn btn-sm btn-danger width-full"
                    onClick={() => handleRemoveCondition(type, index)}
                    title="삭제"
                >
                    ×
                </button>
            </div>
        </div>
    );

    return (
        <div className="Box p-3 color-bg-subtle">
            <div className="form-group">
                <label className="f5 text-bold">전략 이름</label>
                <input
                    className="form-control width-full"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="나만의 전략 이름 (예: RSI 역추세)"
                />
            </div>

            <div className="form-group">
                <label className="f5 text-bold">대상 코인</label>
                <select
                    className="form-select width-full"
                    value={market}
                    onChange={e => setMarket(e.target.value)}
                >
                    {['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL'].map(m => (
                        <option key={m} value={m}>{m.replace('KRW-', '')}</option>
                    ))}
                </select>
            </div>

            <div className="d-flex flex-column flex-md-row gutter-md">
                <div className="col-12 col-md-6 mb-3">
                    <div className="Box color-bg-default">
                        <div
                            className="Box-header d-flex flex-justify-between flex-items-center cursor-pointer"
                            onClick={() => setIsBuyOpen(!isBuyOpen)}
                        >
                            <h4 className="Box-title color-fg-success">매수 조건 (AND)</h4>
                            <span className="text-small color-fg-muted">{isBuyOpen ? '접기' : '펼치기'}</span>
                        </div>
                        {isBuyOpen && (
                            <div className="Box-body">
                                {buyConditions.map((c, i) => renderConditionRow(c, i, 'buy'))}
                                <button className="btn btn-sm width-full mt-2" onClick={() => handleAddCondition('buy')}>
                                    + 조건 추가
                                </button>

                                <div className="mt-3 pt-3 border-top">
                                    <label className="text-small">매수 비중 (현금의 %)</label>
                                    <div className="d-flex flex-items-center">
                                        <input
                                            type="range"
                                            className="col-9 mr-2"
                                            min="5" max="100" step="5"
                                            value={buyAmountPct}
                                            onChange={e => setBuyAmountPct(parseInt(e.target.value))}
                                        />
                                        <span className="text-small text-bold">{buyAmountPct}%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-12 col-md-6 mb-3">
                    <div className="Box color-bg-default">
                        <div
                            className="Box-header d-flex flex-justify-between flex-items-center cursor-pointer"
                            onClick={() => setIsSellOpen(!isSellOpen)}
                        >
                            <h4 className="Box-title color-fg-danger">매도 조건 (AND)</h4>
                            <span className="text-small color-fg-muted">{isSellOpen ? '접기' : '펼치기'}</span>
                        </div>
                        {isSellOpen && (
                            <div className="Box-body">
                                {sellConditions.map((c, i) => renderConditionRow(c, i, 'sell'))}
                                <button className="btn btn-sm width-full mt-2" onClick={() => handleAddCondition('sell')}>
                                    + 조건 추가
                                </button>

                                <div className="mt-3 pt-3 border-top">
                                    <label className="text-small">매도 비중 (보유량의 %)</label>
                                    <div className="d-flex flex-items-center">
                                        <input
                                            type="range"
                                            className="col-9 mr-2"
                                            min="10" max="100" step="10"
                                            value={sellAmountPct}
                                            onChange={e => setSellAmountPct(parseInt(e.target.value))}
                                        />
                                        <span className="text-small text-bold">{sellAmountPct}%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Trailing Stop Section */}
            <div className="Box p-3 mb-3 color-bg-default border">
                <div className="d-flex flex-items-center mb-2">
                    <input
                        type="checkbox"
                        id="trailingStop"
                        className="mr-2"
                        checked={useTrailingStop}
                        onChange={(e) => setUseTrailingStop(e.target.checked)}
                    />
                    <label htmlFor="trailingStop" className="text-bold cursor-pointer">트레일링 스탑 (Trailing Stop) 활성화</label>
                </div>

                {useTrailingStop && (
                    <div className="d-flex flex-wrap gutter-md mt-2 pl-4">
                        <div className="col-12 col-md-6 mb-2">
                            <label className="text-small d-block mb-1">감시 시작 수익률 (%)</label>
                            <input
                                type="number"
                                className="form-control input-sm width-full"
                                placeholder="예: 5"
                                value={tsActivation}
                                onChange={(e) => setTsActivation(parseFloat(e.target.value))}
                            />
                            <p className="note text-small">수익률이 이 값에 도달하면 추적을 시작합니다.</p>
                        </div>
                        <div className="col-12 col-md-6 mb-2">
                            <label className="text-small d-block mb-1">하락 감지 비율 (%)</label>
                            <input
                                type="number"
                                className="form-control input-sm width-full"
                                placeholder="예: 2"
                                value={tsDistance}
                                onChange={(e) => setTsDistance(parseFloat(e.target.value))}
                            />
                            <p className="note text-small">고점 대비 이만큼 하락하면 매도합니다.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center mt-3">
                <button className="btn btn-primary btn-large" onClick={handleSave}>
                    전략 생성 및 시작
                </button>
            </div>
        </div>
    );
}
