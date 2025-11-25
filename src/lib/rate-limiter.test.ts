
import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
    it('should limit concurrency', async () => {
        const limiter = new RateLimiter(10, 1);
        let active = 0;
        let maxActive = 0;

        const task = async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 50));
            active--;
        };

        await Promise.all([
            limiter.add(task),
            limiter.add(task),
            limiter.add(task)
        ]);

        expect(maxActive).toBe(1);
    });

    it('should respect minimum interval', async () => {
        const interval = 100;
        const limiter = new RateLimiter(interval, 1);
        const start = Date.now();
        const timestamps: number[] = [];

        const task = async () => {
            timestamps.push(Date.now());
        };

        await Promise.all([
            limiter.add(task),
            limiter.add(task),
            limiter.add(task)
        ]);

        const diff1 = timestamps[1] - timestamps[0];
        const diff2 = timestamps[2] - timestamps[1];

        // Allow some small margin for execution time variance
        expect(diff1).toBeGreaterThanOrEqual(interval - 20);
        expect(diff2).toBeGreaterThanOrEqual(interval - 20);
    });
});
