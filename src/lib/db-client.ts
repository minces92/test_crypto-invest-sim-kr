import { Worker } from 'worker_threads';
import path from 'path';

const workerPath = path.join(process.cwd(), 'src', 'lib', 'db-worker.js');
let worker: Worker | null = null;
let messageId = 0;
const pending = new Map<number, { resolve: Function; reject: Function; timer?: NodeJS.Timeout }>();

function ensureWorker() {
  if (worker && !worker.threadId) {
    worker = null;
  }
  if (!worker) {
    worker = new Worker(workerPath);
    worker.on('message', (msg) => {
      const { id, ok, result, error } = msg;
      const pendingEntry = pending.get(id);
      if (!pendingEntry) return;
      if (pendingEntry.timer) clearTimeout(pendingEntry.timer);
      pending.delete(id);
      if (ok) pendingEntry.resolve(result);
      else pendingEntry.reject(new Error(error));
    });
    worker.on('error', (err) => {
      console.error('DB worker error', err);
    });
    worker.on('exit', (code) => {
      console.warn('DB worker exited with code', code);
      worker = null;
      for (const [id, p] of Array.from(pending.entries())) {
        if (p.timer) clearTimeout(p.timer);
        p.reject(new Error('DB worker exited'));
      }
      pending.clear();
    });
    // Initialize DB inside worker
    sendWorkerMessage('init', {}).catch(err => console.error('DB worker init failed', err));
  }
}

function sendWorkerMessage(action: string, payload: any, timeoutMs = 30000) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    const entry = pending.get(id)!;
    entry.timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('DB worker request timeout'));
    }, timeoutMs);
    if (!worker) return reject(new Error('DB worker not available'));
    worker.postMessage({ id, action, ...payload });
  });
}

export async function queryAll(sql: string, params?: any[]) {
  return await sendWorkerMessage('queryAll', { sql, params });
}

export async function queryGet(sql: string, params?: any[]) {
  return await sendWorkerMessage('queryGet', { sql, params });
}

export async function run(sql: string, params?: any[]) {
  return await sendWorkerMessage('run', { sql, params });
}

export async function transaction(statements: Array<{ sql: string; params?: any[] }>) {
  return await sendWorkerMessage('transaction', { statements });
}

export async function closeWorker() {
  if (!worker) return;
  await sendWorkerMessage('close', {});
  worker.terminate();
  worker = null;
}
