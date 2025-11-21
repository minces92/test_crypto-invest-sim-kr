import fs from 'fs/promises';
import path from 'path';

interface LogEntry {
  type: string;
  prompt: string;
  response?: string;
  meta?: Record<string, unknown>;
}

const DEFAULT_LOG_PATH = path.join(process.cwd(), 'logs', 'ai-debug.log');

function resolveLogFilePath() {
  const configured = process.env.AI_LOG_FILE;
  if (!configured) return DEFAULT_LOG_PATH;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export async function logAIInteraction(entry: LogEntry) {
  if (process.env.AI_LOG_ENABLED !== 'true') {
    return;
  }

  try {
    const filePath = resolveLogFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const payload = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf-8');
  } catch (error) {
    console.warn('AI log write failed:', error);
  }
}

