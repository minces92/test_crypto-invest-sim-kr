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
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {loading && <div className="p-3">로딩 중...</div>}
        {!loading && logs.length === 0 && <div className="p-3">최근 알림 이력이 없습니다.</div>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {logs.map(l => (
            <li key={l.id} style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
              <div style={{ fontSize: 12, color: '#555' }}>
                <strong>{l.success ? '성공' : '실패'}</strong>
                {' '}| {l.sourceType} | {l.channel} | {l.createdAtKst ? l.createdAtKst : new Date(l.createdAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 14 }}>{l.transactionId ? `TX: ${l.transactionId}` : ''}</div>
              <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', marginTop: 6 }}>{l.payload?.slice(0, 200)}</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 6 }}>resp: {l.responseCode} {l.responseBody ? `| ${l.responseBody.slice(0, 100)}` : ''} {l.attemptNumber ? `| 시도: ${l.attemptNumber}` : ''}</div>
              <div style={{ marginTop: 6 }}>
                <button className="btn" onClick={async () => {
                  try {
                    const res = await fetch('/api/notification-logs/retry', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: l.id }),
                    });
                    const data = await res.json();
                    if (data.ok) {
                      // refresh logs
                      fetchLogs();
                    } else {
                      console.error('Retry failed', data);
                    }
                  } catch (err) {
                    console.error('Retry request error', err);
                  }
                }}>재전송</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
