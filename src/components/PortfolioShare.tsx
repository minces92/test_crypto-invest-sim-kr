'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function PortfolioShare() {
    const [loading, setLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState('');

    const handleShare = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: '내 포트폴리오',
                    description: '자동 생성된 포트폴리오 공유입니다.',
                    showHoldings: true,
                    showTrades: true,
                    showReturns: true
                })
            });

            if (!res.ok) throw new Error('Failed to create share link');

            const data = await res.json();
            const url = `${window.location.origin}${data.shareUrl}`;
            setShareUrl(url);

            await navigator.clipboard.writeText(url);
            toast.success('공유 링크가 클립보드에 복사되었습니다!');
        } catch (error) {
            console.error(error);
            toast.error('공유 링크 생성에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="Box mb-4">
            <div className="Box-header">
                <h3 className="Box-title">포트폴리오 공유</h3>
            </div>
            <div className="Box-body">
                <p className="text-small color-fg-muted mb-3">
                    현재 포트폴리오 상태를 다른 사람과 공유할 수 있는 링크를 생성합니다.
                </p>

                {shareUrl ? (
                    <div className="form-group">
                        <div className="input-group">
                            <input
                                className="form-control"
                                type="text"
                                value={shareUrl}
                                readOnly
                            />
                            <span className="input-group-button">
                                <button
                                    className="btn"
                                    onClick={() => {
                                        navigator.clipboard.writeText(shareUrl);
                                        toast.success('복사되었습니다!');
                                    }}
                                >
                                    복사
                                </button>
                            </span>
                        </div>
                        <button
                            className="btn btn-sm mt-2"
                            onClick={() => setShareUrl('')}
                        >
                            새로 만들기
                        </button>
                    </div>
                ) : (
                    <button
                        className="btn btn-primary btn-block"
                        onClick={handleShare}
                        disabled={loading}
                    >
                        {loading ? '링크 생성 중...' : '공유 링크 생성하기'}
                    </button>
                )}
            </div>
        </div>
    );
}
