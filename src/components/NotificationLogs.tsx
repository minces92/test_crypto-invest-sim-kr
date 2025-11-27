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
  nextRetryAt?: string | null;
}

export default function NotificationLogs({ onClose }: { onClose?: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [newsRefreshInterval, setNewsRefreshInterval] = useState<number>(15);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notification-logs?limit=50');

      if (res.status === 408) {
        const data = await res.json();
        setError(data.warning || '요청 시간이 초과되었습니다.');
        setLogs([]);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch notification logs:', err);
      setError(err instanceof Error ? err.message : String(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Fetch settings from server
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings && data.settings.newsRefreshInterval) {
          setNewsRefreshInterval(Number(data.settings.newsRefreshInterval));
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem('newsRefreshInterval');
          if (saved) setNewsRefreshInterval(Number(saved));
        }
      })
      .catch(err => {
        console.error('Failed to fetch settings:', err);
        // Fallback to localStorage
        const saved = localStorage.getItem('newsRefreshInterval');
        if (saved) setNewsRefreshInterval(Number(saved));
      });
  }, []);

  const saveNewsRefreshInterval = async () => {
    try {
      // Save to server
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsRefreshInterval }),
      });

      if (!res.ok) throw new Error('Failed to save settings to server');

      // Save to localStorage (for client-side consistency)
      localStorage.setItem('newsRefreshInterval', String(newsRefreshInterval));

      setSaveMessage('✓ 설정이 저장되었습니다.');
      setTimeout(() => setSaveMessage(null), 2500);

      // Notify other components
      window.dispatchEvent(new CustomEvent('newsRefreshIntervalChanged', { detail: { interval: newsRefreshInterval * 60 * 1000 } }));
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveMessage('✗ 저장 실패');
      setTimeout(() => setSaveMessage(null), 2500);
    }
  };

  return (
    <div className="Box Box--condensed">
      <div className="Box-header d-flex flex-justify-between">
        <strong>설정 및 알림</strong>
        <div>
          <button className="btn" onClick={fetchLogs} disabled={loading}>새로고침</button>
          <button className="btn" onClick={() => onClose && onClose()}>닫기</button>
        </div>
      </div>

      {/* Settings Section */}
      <div style={{ padding: '12px', borderBottom: '1px solid #eee', backgroundColor: '#f6f8fa' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', margin: 0 }}>뉴스 갱신 주기:</label>
          <input
            type="number"
            min="1"
            max="120"
            value={newsRefreshInterval}
            onChange={(e) => setNewsRefreshInterval(Math.max(1, Math.min(120, Number(e.target.value))))}
            style={{ padding: '4px 6px', border: '1px solid #d0d7de', borderRadius: '4px', width: '60px', fontSize: '12px' }}
          />
          <span style={{ fontSize: '12px' }}>분</span>
          <button className="btn btn-sm" onClick={saveNewsRefreshInterval} style={{ marginLeft: '4px' }}>저장</button>
          {saveMessage && <span style={{ fontSize: '11px', color: '#1a7f0f' }}>{saveMessage}</span>}
        </div>
      </div>

      {/* Logs Section */}
      <div style={{ fontSize: '12px', padding: '4px 12px', color: '#57606a', borderBottom: '1px solid #eee' }}>
        알림 이력 (최근 50건)
      </div>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {loading && <div className="p-3">로딩 중...</div>}
        {error && (
          <div className="p-3 text-center color-fg-danger">
            <p>알림 이력을 가져오는 데 실패했습니다: {error}</p>
            <button className="btn btn-sm" onClick={() => fetchLogs()}>다시 시도</button>
          </div>
        )}
        {!loading && logs.length === 0 && <div className="p-3">최근 알림 이력이 없습니다.</div>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {logs.map(l => (
            <li key={l.id} style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
              <div style={{ fontSize: 12, color: '#555' }}>
                <strong>{l.success ? '성공' : '실패'}</strong>
                {' '}| {l.sourceType} | {l.channel} | {l.createdAtKst ? l.createdAtKst : new Date(l.createdAt).toLocaleString()}
                {l.nextRetryAt ? ` | 다음 재시도: ${new Date(l.nextRetryAt).toLocaleString()}` : ''}
              </div>
              <div style={{ fontSize: 14 }}>{l.transactionId ? `TX: ${l.transactionId}` : ''}</div>
              <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', marginTop: 6 }}>{l.payload?.slice(0, 200)}</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 6 }}>
                resp: {l.responseCode} {l.attemptNumber ? `| 시도: ${l.attemptNumber}` : ''}
                {l.responseBody ? (
                  <>
                    {' '}| {expanded[l.id] ? l.responseBody : `${l.responseBody.slice(0, 120)}${l.responseBody.length > 120 ? '...' : ''}`}
                    {' '}
                    <button className="btn" style={{ marginLeft: 6 }} onClick={() => setExpanded(prev => ({ ...prev, [l.id]: !prev[l.id] }))}>{expanded[l.id] ? '접기' : '전체'}</button>
                  </>
                ) : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                <button
                  className="btn"
                  disabled={!!(l.nextRetryAt && new Date(l.nextRetryAt) > new Date())}
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/notification-logs/retry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: l.id }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        fetchLogs();
                      } else {
                        console.error('Retry failed', data);
                        setError(data.error || 'Retry failed');
                      }
                    } catch (err) {
                      console.error('Retry request error', err);
                      setError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >{l.nextRetryAt && new Date(l.nextRetryAt) > new Date() ? '예약됨' : '재전송'}</button>

                <button
                  className="btn"
                  style={{ marginLeft: 8 }}
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/notification-logs/retry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: l.id, force: true }),
                      });
                      const data = await res.json();
                      if (data.ok) fetchLogs(); else {
                        console.error('Force retry failed', data);
                        setError(data.error || 'Force retry failed');
                      }
                    } catch (err) {
                      console.error('Force retry request error', err);
                      setError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >강제 재전송</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
