'use client';

import React from 'react';
import Header from '@/components/Header';
import AutoTrader from '@/components/AutoTrader';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function AutoTraderPage() {
    return (
        <>
            <Header />
            <div className="container-xl px-3 px-md-4 px-lg-5 py-4">
                <div className="d-flex flex-items-center flex-justify-between mb-4">
                    <h1 className="h2">자동 매매 시스템</h1>
                </div>

                <div className="d-flex flex-wrap gutter-md">
                    <div className="col-12">
                        <div className="mb-3">
                            <p className="color-fg-muted">
                                AI 기반 추천 전략, 커스텀 알고리즘, 그리드 매매 등 다양한 자동 매매 도구를 활용하세요.
                            </p>
                        </div>
                        <ErrorBoundary>
                            <AutoTrader />
                        </ErrorBoundary>
                    </div>
                </div>
            </div>
        </>
    );
}
