import { useState } from 'react';

interface SharePortfolioModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SharePortfolioModal({ isOpen, onClose }: SharePortfolioModalProps) {
    const [name, setName] = useState('나의 포트폴리오');
    const [description, setDescription] = useState('');
    const [showHoldings, setShowHoldings] = useState(true);
    const [showReturns, setShowReturns] = useState(true);
    const [showTrades, setShowTrades] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/portfolio/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    show_holdings: showHoldings,
                    show_returns: showReturns,
                    show_trades: showTrades,
                    expires_in_days: 30
                })
            });

            if (response.ok) {
                const data = await response.json();
                setGeneratedLink(`${window.location.origin}/share/${data.token}`);
            } else {
                alert('공유 링크 생성에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to create share link', error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="Box-overlay d-flex flex-justify-center flex-items-center" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999
        }} onClick={onClose}>
            <div className="Box" style={{ width: '450px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
                <div className="Box-header">
                    <h3 className="Box-title">포트폴리오 공유하기</h3>
                    <button className="Box-btn-octicon btn-octicon float-right" onClick={onClose}>
                        <svg className="octicon octicon-x" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>
                    </button>
                </div>

                <div className="Box-body">
                    {!generatedLink ? (
                        <>
                            <div className="form-group">
                                <div className="form-group-header">
                                    <label>공유 이름</label>
                                </div>
                                <div className="form-group-body">
                                    <input
                                        className="form-control input-block"
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <div className="form-group-header">
                                    <label>설명 (선택)</label>
                                </div>
                                <div className="form-group-body">
                                    <textarea
                                        className="form-control input-block"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="form-checkbox">
                                <label>
                                    <input type="checkbox" checked={showHoldings} onChange={e => setShowHoldings(e.target.checked)} />
                                    보유 자산 공개
                                </label>
                                <p className="note">현재 보유중인 코인과 비중을 공개합니다.</p>
                            </div>

                            <div className="form-checkbox">
                                <label>
                                    <input type="checkbox" checked={showReturns} onChange={e => setShowReturns(e.target.checked)} />
                                    수익률 공개
                                </label>
                                <p className="note">총 자산 가치와 수익률을 공개합니다.</p>
                            </div>

                            <div className="form-checkbox">
                                <label>
                                    <input type="checkbox" checked={showTrades} onChange={e => setShowTrades(e.target.checked)} />
                                    최근 거래 내역 공개
                                </label>
                                <p className="note">최근 20건의 거래 내역을 공개합니다.</p>
                            </div>

                            <button
                                className="btn btn-primary btn-block mt-3"
                                onClick={handleCreate}
                                disabled={isLoading}
                            >
                                {isLoading ? '링크 생성 중...' : '공유 링크 생성'}
                            </button>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="flash flash-success mb-3">
                                공유 링크가 생성되었습니다!
                            </div>
                            <div className="input-group">
                                <input
                                    className="form-control"
                                    type="text"
                                    value={generatedLink}
                                    readOnly
                                />
                                <span className="input-group-button">
                                    <button className="btn" type="button" onClick={handleCopy}>
                                        {copySuccess ? '복사됨!' : '복사'}
                                    </button>
                                </span>
                            </div>
                            <p className="note mt-2">이 링크를 복사하여 친구들에게 공유하세요. 링크는 30일간 유효합니다.</p>

                            <button className="btn btn-block mt-3" onClick={() => {
                                setGeneratedLink('');
                                onClose();
                            }}>
                                닫기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
