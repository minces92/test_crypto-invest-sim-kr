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
