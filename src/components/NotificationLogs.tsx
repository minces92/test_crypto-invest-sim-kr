 'use client';
import React, { useEffect, useState } from 'react';

  interface LogEntry {
  id: number;
  transactionId?: string | null;
  sourceType: string;
  channel: string;
  payload: string;
  success: boolean;
  responseCode?: number | null;
  responseBody?: string | null;
  attemptNumber?: number;
  createdAt: string;
    createdAtKst?: string;
}

export default function NotificationLogs({ onClose }: { onClose?: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notification-logs?limit=50');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch notification logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="Box Box--condensed">
      <div className="Box-header d-flex flex-justify-between">
        <strong>알림 이력</strong>
        <div>
          <button className="btn" onClick={fetchLogs} disabled={loading}>새로고침</button>
          <button className="btn" onClick={() => onClose && onClose()}>닫기</button>
        </div>
      </div>
      {feedback && (
        <div
          className={`p-2 mb-2 rounded-2 ${
            feedback.type === 'success' ? 'color-bg-subtle color-fg-success' : 'color-bg-subtle color-fg-danger'
          }`}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      )}
      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        {loading && <div className="p-3">로딩 중...</div>}
        {!loading && logs.length === 0 && <div className="p-3">최근 알림 이력이 없습니다.</div>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {logs.map(l => (
            <li key={l.id} style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
              <div style={{ fontSize: 12, color: '#555' }}>
                <span
                  className={`px-2 py-1 rounded-2 text-small ${l.success ? 'color-bg-subtle color-fg-success' : 'color-bg-subtle color-fg-danger'}`}
                  style={{ fontWeight: 600 }}
                >
                  {l.success ? '성공' : '실패'}
                </span>
                {' '}| {l.sourceType} | {l.channel} | {l.createdAtKst ? l.createdAtKst : new Date(l.createdAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 14 }}>{l.transactionId ? `TX: ${l.transactionId}` : ''}</div>
              <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', marginTop: 6 }}>{l.payload?.slice(0, 200)}</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 6 }}>resp: {l.responseCode} {l.responseBody ? `| ${l.responseBody.slice(0, 100)}` : ''} {l.attemptNumber ? `| 시도: ${l.attemptNumber}` : ''}</div>
              <div style={{ marginTop: 6 }}>
                <button
                  className="btn"
                  disabled={retryingId === l.id}
                  onClick={async () => {
                    setRetryingId(l.id);
                    try {
                      const res = await fetch('/api/notification-logs/retry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: l.id }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        setFeedback({ type: 'success', message: '재전송이 요청되었습니다. 잠시 후 로그를 확인하세요.' });
                        fetchLogs();
                      } else {
                        setFeedback({ type: 'error', message: data.error || '재전송에 실패했습니다.' });
                      }
                    } catch (err) {
                      console.error('Retry request error', err);
                      setFeedback({ type: 'error', message: '재전송 요청 중 오류가 발생했습니다.' });
                    } finally {
                      setRetryingId(null);
                    }
                  }}
                >
                  {retryingId === l.id ? '전송 중...' : '재전송'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
