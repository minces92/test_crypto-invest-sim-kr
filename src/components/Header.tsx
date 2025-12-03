'use client';
import React, { useState } from 'react';
import NotificationLogs from './NotificationLogs';
import ErrorBoundary from './ErrorBoundary';

export default function Header() {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <header className="color-bg-subtle p-3 mb-4">
      <div className="container-lg d-flex flex-items-center flex-justify-between">
        <div className="d-flex flex-items-center">
          <div className="mr-4">
            <h1 className="f2 text-bold">Crypto Invest Sim</h1>
            <p className="f5 color-fg-muted">가상 암호화폐 투자 시뮬레이션</p>
          </div>
          <nav className="d-none d-md-flex">
            <a href="/" className="Header-link mr-3">홈</a>
            <a href="/analytics" className="Header-link mr-3">분석</a>
            <a href="/strategies" className="Header-link mr-3">전략</a>
          </nav>
        </div>

        <div>
          <button
            aria-label="Toggle notifications"
            className="btn"
            onClick={() => setShowLogs(v => !v)}
          >
            ☰
          </button>
        </div>
      </div>

      {showLogs && (
        <div className="container-lg mt-3">
          <ErrorBoundary>
            <NotificationLogs onClose={() => setShowLogs(false)} />
          </ErrorBoundary>
        </div>
      )}
    </header>
  );
}
