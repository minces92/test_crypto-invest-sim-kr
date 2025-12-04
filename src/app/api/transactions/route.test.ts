import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@/lib/cache', () => ({
    getTransactions: vi.fn(),
    saveTransaction: vi.fn(),
    createJob: vi.fn(),
    logNotificationAttempt: vi.fn(),
    markTransactionNotified: vi.fn(),
}));

vi.mock('@/lib/telegram', () => ({
    sendMessage: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
    measureExecutionTime: vi.fn((name, fn) => fn()),
}));

// Mock Next.js Request/Response
const createRequest = (method: string, body?: any) => {
    return {
        method,
        json: async () => body,
    } as unknown as Request;
};

describe('Transactions API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return transactions successfully', async () => {
            const mockTransactions = [{ id: '1', market: 'KRW-BTC', type: 'buy' }];
            const { getTransactions } = await import('@/lib/cache');
            (getTransactions as any).mockResolvedValue(mockTransactions);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockTransactions);
        });

        it('should handle errors gracefully', async () => {
            const { getTransactions } = await import('@/lib/cache');
            (getTransactions as any).mockRejectedValue(new Error('DB Error'));

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('INTERNAL_ERROR');
        });
    });

    describe('POST', () => {
        it('should create a transaction successfully', async () => {
            const newTransaction = {
                id: 'tx-123',
                type: 'buy',
                market: 'KRW-ETH',
                price: 3000000,
                amount: 1,
                timestamp: new Date().toISOString(),
                source: 'manual'
            };

            const { saveTransaction } = await import('@/lib/cache');
            (saveTransaction as any).mockResolvedValue(undefined);

            const request = createRequest('POST', newTransaction);
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data).toEqual(newTransaction);
            expect(saveTransaction).toHaveBeenCalled();
        });

        it('should validate input', async () => {
            const invalidTransaction = {
                type: 'invalid-type', // Invalid enum
                market: 'BTC', // Invalid regex
            };

            const request = createRequest('POST', invalidTransaction);
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid transaction data');
        });
    });
});
