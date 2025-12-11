type MetricType = 'counter' | 'gauge' | 'histogram';

interface Metric {
    name: string;
    type: MetricType;
    value: number;
    tags?: Record<string, string>;
    timestamp: number;
}

class PerformanceMonitor {
    private metrics: Metric[] = [];
    private static instance: PerformanceMonitor;

    private constructor() { }

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    record(name: string, value: number, type: MetricType = 'gauge', tags: Record<string, string> = {}) {
        const metric: Metric = {
            name,
            type,
            value,
            tags,
            timestamp: Date.now(),
        };
        this.metrics.push(metric);

        // Log significant events or high latencies
        this.checkThresholds(metric);

        // Keep metrics array from growing indefinitely
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-500);
        }
    }

    private checkThresholds(metric: Metric) {
        // Example threshold: API response time > 2000ms
        if (metric.name === 'api_response_time' && metric.value > 2000) {
            console.warn(`[High Latency] ${metric.name}: ${metric.value.toFixed(2)}ms`, metric.tags);
        }

        // Example: DB Query time > 1000ms
        if (metric.name === 'db_query_time' && metric.value > 1000) {
            console.warn(`[Slow Query] ${metric.name}: ${metric.value.toFixed(2)}ms`, metric.tags);
        }

        // Memory usage warning (if value is in MB)
        if (metric.name === 'memory_usage_heap' && metric.value > 500) {
            console.warn(`[High Memory] Heap usage: ${metric.value.toFixed(2)}MB`);
        }
    }

    getMetrics() {
        return this.metrics;
    }

    clearMetrics() {
        this.metrics = [];
    }
}

export const monitor = PerformanceMonitor.getInstance();

export async function measureExecutionTime<T>(
    name: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
): Promise<T> {
    const start = performance.now();
    try {
        const result = await fn();
        const duration = performance.now() - start;
        monitor.record(name, duration, 'histogram', tags);
        return result;
    } catch (error) {
        const duration = performance.now() - start;
        monitor.record(name, duration, 'histogram', { ...tags, error: 'true' });
        throw error;
    }
}

export function logMemoryUsage() {
    const used = process.memoryUsage();
    monitor.record('memory_usage_rss', used.rss / 1024 / 1024, 'gauge');
    monitor.record('memory_usage_heap', used.heapUsed / 1024 / 1024, 'gauge');
}

/**
 * Issue #3: 알림 API 타임아웃 모니터링 메트릭
 * 응답 시간 및 타임아웃 빈도 추적
 */
interface ApiResponseMetric {
  endpoint: string;
  responseTimeMs: number;
  timestamp: number;
  timedOut: boolean;
  error?: string;
}

const apiMetrics: ApiResponseMetric[] = [];

export function recordApiMetric(
  endpoint: string,
  responseTimeMs: number,
  timedOut: boolean = false,
  error?: string
) {
  const metric: ApiResponseMetric = {
    endpoint,
    responseTimeMs,
    timestamp: Date.now(),
    timedOut,
    error,
  };

  apiMetrics.push(metric);

  // 최근 1000개만 유지
  if (apiMetrics.length > 1000) {
    apiMetrics.shift();
  }

  // 타임아웃 또는 응답 시간 1500ms 초과 시 경고 로그
  const RESPONSE_TIME_THRESHOLD = 1500;
  if (timedOut) {
    console.warn(`[API Timeout] ${endpoint}: ${responseTimeMs}ms (TIMEOUT)`, {
      endpoint,
      responseTimeMs,
      timestamp: new Date(metric.timestamp).toISOString(),
      error: error || 'Request timed out'
    });
  } else if (responseTimeMs > RESPONSE_TIME_THRESHOLD) {
    console.warn(`[API Slow Response] ${endpoint}: ${responseTimeMs}ms (threshold: ${RESPONSE_TIME_THRESHOLD}ms)`, {
      endpoint,
      responseTimeMs,
      timestamp: new Date(metric.timestamp).toISOString(),
    });
  }
}

export function getApiMetrics(endpoint?: string, lastNSeconds: number = 300): {
  metrics: ApiResponseMetric[];
  stats: {
    totalRequests: number;
    timeoutCount: number;
    slowResponseCount: number;
    avgResponseTimeMs: number;
    maxResponseTimeMs: number;
  };
} {
  const cutoffTime = Date.now() - (lastNSeconds * 1000);

  // 필터링
  let filtered = apiMetrics.filter(m => m.timestamp > cutoffTime);
  if (endpoint) {
    filtered = filtered.filter(m => m.endpoint === endpoint);
  }

  // 통계 계산
  const RESPONSE_TIME_THRESHOLD = 1500;
  const stats = {
    totalRequests: filtered.length,
    timeoutCount: filtered.filter(m => m.timedOut).length,
    slowResponseCount: filtered.filter(m => m.responseTimeMs > RESPONSE_TIME_THRESHOLD).length,
    avgResponseTimeMs: filtered.length > 0
      ? Math.round(filtered.reduce((sum, m) => sum + m.responseTimeMs, 0) / filtered.length)
      : 0,
    maxResponseTimeMs: filtered.length > 0
      ? Math.max(...filtered.map(m => m.responseTimeMs))
      : 0,
  };

  return {
    metrics: filtered,
    stats,
  };
}