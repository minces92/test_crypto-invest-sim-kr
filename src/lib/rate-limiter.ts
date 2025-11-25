
/**
 * A simple rate limiter that enforces a minimum interval between executions
 * and limits concurrency.
 */
export class RateLimiter {
    private queue: Array<() => Promise<void>> = [];
    private activeCount = 0;
    private lastRunTime = 0;

    constructor(
        private readonly minIntervalMs: number,
        private readonly maxConcurrency: number = 1
    ) { }

    /**
     * Add a task to the rate limiter.
     * @param task A function that returns a promise.
     * @returns The result of the task.
     */
    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };

            this.queue.push(wrappedTask);
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }

        const now = Date.now();
        const timeSinceLastRun = now - this.lastRunTime;
        const waitTime = Math.max(0, this.minIntervalMs - timeSinceLastRun);

        if (waitTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        // Double check after wait
        if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
            // Schedule another check if we still have items but hit concurrency limit during wait
            if (this.queue.length > 0) {
                setTimeout(() => this.processQueue(), this.minIntervalMs);
            }
            return;
        }

        const nextTask = this.queue.shift();
        if (nextTask) {
            this.activeCount++;
            this.lastRunTime = Date.now();

            // Don't await the task here, let it run in background so we can process others if concurrency > 1
            // But for strict serial (concurrency=1), it effectively waits.
            nextTask().finally(() => {
                this.activeCount--;
                this.processQueue();
            });

            // If we have concurrency > 1, try to launch more immediately
            if (this.activeCount < this.maxConcurrency) {
                this.processQueue();
            }
        }
    }
}
