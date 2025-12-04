const { parentPort } = require('worker_threads');
const path = require('path');
const Database = require('better-sqlite3');
const { performance } = require('perf_hooks');

const dbPath = path.join(process.cwd(), 'crypto_cache.db');
let db = null;

function logSlowQuery(duration, sql) {
  if (duration > 500) { // Warn if query takes > 500ms
    console.warn(`[DB Worker] Slow query (${duration.toFixed(2)}ms): ${sql.substring(0, 200)}...`);
  }
}

// ... (initDatabase function remains same, not shown here for brevity if not changing)

// ... (sendResponse, sendError remain same)

parentPort.on('message', async (msg) => {
  const { id, action } = msg;
  try {
    if (action === 'init') {
      initDatabase();
      sendResponse(id, 'ok');
    } else if (action === 'queryAll') {
      initDatabase();
      const { sql, params } = msg;
      const start = performance.now();
      const stmt = db.prepare(sql);
      const rows = stmt.all(...(params || []));
      const duration = performance.now() - start;
      logSlowQuery(duration, sql);
      sendResponse(id, rows);
    } else if (action === 'queryGet') {
      initDatabase();
      const { sql, params } = msg;
      const start = performance.now();
      const stmt = db.prepare(sql);
      const row = stmt.get(...(params || []));
      const duration = performance.now() - start;
      logSlowQuery(duration, sql);
      sendResponse(id, row);
    } else if (action === 'run') {
      initDatabase();
      const { sql, params } = msg;
      const start = performance.now();
      const stmt = db.prepare(sql);
      const res = stmt.run(...(params || []));
      const duration = performance.now() - start;
      logSlowQuery(duration, sql);
      sendResponse(id, res);
    } else if (action === 'transaction') {
      initDatabase();
      const { statements } = msg; // [{sql, params}]
      const start = performance.now();
      const transaction = db.transaction(() => {
        const results = [];
        for (const s of statements) {
          const stmt = db.prepare(s.sql);
          results.push(stmt.run(...(s.params || [])));
        }
        return results;
      });
      const res = transaction();
      const duration = performance.now() - start;
      if (duration > 1000) {
        console.warn(`[DB Worker] Slow transaction (${duration.toFixed(2)}ms) with ${statements.length} statements`);
      }
      sendResponse(id, res);
    } else if (action === 'close') {
      if (db) db.close();
      db = null;
      sendResponse(id, 'closed');
    } else {
      throw new Error('Unknown action: ' + action);
    }
  } catch (err) {
    sendError(id, err);
  }
});
