// server-init.ts
// This module starts background workers when imported in a server-side entry.
import { processPendingJobs } from './notification-queue';

if (process.env.NODE_ENV !== 'test') {
  const INTERVAL_SEC = Number(process.env.NOTIFICATION_JOB_WORKER_INTERVAL_SEC) || 15;
  // run immediately once, then interval
  processPendingJobs(50).catch(err => console.error('server-init initial processPendingJobs error:', err));
  setInterval(() => {
    processPendingJobs(50).catch(err => console.error('server-init processPendingJobs error:', err));
  }, INTERVAL_SEC * 1000);
}

export {};
