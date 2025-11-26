'use client'
import React, { useEffect, useState } from 'react';

export default function NotificationJobs() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchJobs() {
    setLoading(true);
    const res = await fetch('/api/notification-jobs');
    const json = await res.json();
    setRows(json.rows || []);
    setLoading(false);
  }

  useEffect(() => { fetchJobs(); }, []);

  async function postAction(id: number, action: string) {
    setLoading(true);
    await fetch('/api/notification-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    await fetchJobs();
    setLoading(false);
  }

  return (
    <div>
      <h3>Notification Jobs</h3>
      <p>{loading ? 'Loading...' : `Showing ${rows.length} jobs`}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Next Run</th>
            <th>Payload</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid #ddd' }}>
              <td>{r.id}</td>
              <td>{r.status}</td>
              <td>{r.attempt_count}</td>
              <td>{r.next_run_at}</td>
              <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.payload}</td>
              <td>
                <button onClick={() => postAction(r.id, 'run')}>Run now</button>
                <button onClick={() => postAction(r.id, 'retry')}>Retry</button>
                <button onClick={() => postAction(r.id, 'delete')}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
