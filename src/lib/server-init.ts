// server-init.ts
// This module starts background workers when imported in a server-side entry.
import { processPendingJobs } from './notification-queue';

if (process.env.NODE_ENV !== 'test') {
  let INTERVAL_SEC = Number(process.env.NOTIFICATION_JOB_WORKER_INTERVAL_SEC) || 15;
  
  // 초기 실행
  processPendingJobs(50).catch(err => console.error('server-init initial processPendingJobs error:', err));
  
  // 주기적 실행 (동적 갱신 주기 지원 - Issue #2)
  let intervalHandle: NodeJS.Timeout | null = null;
  
  const startWorker = (intervalSec: number) => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
    }
    
    intervalHandle = setInterval(() => {
      processPendingJobs(50).catch(err => console.error('server-init processPendingJobs error:', err));
    }, intervalSec * 1000);
    
    console.log(`[server-init] Notification worker started with ${intervalSec}s interval`);
  };
  
  startWorker(INTERVAL_SEC);
  
  // 설정이 변경되면 워커 주기 업데이트 (향후: 웹소켓 또는 폴링으로 감시)
  // 현재는 환경 변수 기반, 향후 DB 감시로 확장 가능
}

export {};
