// server-init.ts
// This module starts background workers when imported in a server-side entry.
import { processPendingJobs } from './notification-queue';
import { getSetting } from './settings';

if (process.env.NODE_ENV !== 'test') {
  // 초기 실행
  processPendingJobs(50).catch(err => console.error('server-init initial processPendingJobs error:', err));

  // 주기적 실행 (동적 갱신 주기 지원 - Issue #2)
  let intervalHandle: NodeJS.Timeout | null = null;
  let currentIntervalSec = 15; // Default

  const startWorker = (intervalSec: number) => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
    }

    currentIntervalSec = intervalSec;

    intervalHandle = setInterval(() => {
      processPendingJobs(50).catch(err => console.error('server-init processPendingJobs error:', err));
    }, intervalSec * 1000);

    console.log(`[server-init] Notification worker started with ${intervalSec}s interval`);
  };

  // 초기 설정 로드 및 워커 시작
  getSetting('newsRefreshInterval', 15).then(interval => {
    startWorker(Number(interval) * 60); // 분 단위를 초 단위로 변환
  });

  // 설정 변경 감시 (Polling)
  setInterval(async () => {
    try {
      const newIntervalMin = await getSetting('newsRefreshInterval', 15);
      const newIntervalSec = Number(newIntervalMin) * 60;

      if (newIntervalSec !== currentIntervalSec) {
        console.log(`[server-init] Detected interval change: ${currentIntervalSec}s -> ${newIntervalSec}s`);
        startWorker(newIntervalSec);
      }
    } catch (err) {
      console.error('[server-init] Error polling settings:', err);
    }
  }, 60 * 1000); // 1분마다 확인
}

export { };
