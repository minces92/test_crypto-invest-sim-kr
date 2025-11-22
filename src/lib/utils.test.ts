import { describe, it, expect } from 'vitest';
import { calculatePortfolioState } from './utils';
import { Transaction } from './types';

describe('calculatePortfolioState', () => {
  const initialCash = 1000000; // 1,000,000 KRW

  it('should return initial cash and empty assets for no transactions', () => {
    const transactions: Transaction[] = [];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    expect(cash).toBe(initialCash);
    expect(assets).toEqual([]);
  });

  it('should correctly calculate portfolio after a single buy transaction', () => {
    const transactions: Transaction[] = [
      { id: '1', type: 'buy', market: 'KRW-BTC', price: 50000000, amount: 0.01, timestamp: '2023-01-01T00:00:00Z' },
    ];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    expect(cash).toBe(initialCash - (50000000 * 0.01)); // 1,000,000 - 500,000 = 500,000
    expect(assets.length).toBe(1);
    expect(assets[0]).toEqual({ market: 'KRW-BTC', quantity: 0.01, avg_buy_price: 50000000 });
  });

  it('should correctly calculate portfolio after multiple buy transactions for the same asset', () => {
    const transactions: Transaction[] = [
      { id: '1', type: 'buy', market: 'KRW-BTC', price: 50000000, amount: 0.01, timestamp: '2023-01-01T00:00:00Z' },
      { id: '2', type: 'buy', market: 'KRW-BTC', price: 60000000, amount: 0.01, timestamp: '2023-01-02T00:00:00Z' },
    ];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    const expectedCash = initialCash - (50000000 * 0.01) - (60000000 * 0.01); // 1,000,000 - 500,000 - 600,000 = -100,000
    expect(cash).toBe(expectedCash);
    expect(assets.length).toBe(1);
    // (50M * 0.01 + 60M * 0.01) / (0.01 + 0.01) = (500k + 600k) / 0.02 = 1.1M / 0.02 = 55M
    expect(assets[0]).toEqual({ market: 'KRW-BTC', quantity: 0.02, avg_buy_price: 55000000 });
  });

  it('should correctly calculate portfolio after a buy and then a sell transaction for the same asset', () => {
    const transactions: Transaction[] = [
      { id: '1', type: 'buy', market: 'KRW-BTC', price: 50000000, amount: 0.01, timestamp: '2023-01-01T00:00:00Z' },
      { id: '2', type: 'sell', market: 'KRW-BTC', price: 55000000, amount: 0.005, timestamp: '2023-01-02T00:00:00Z' },
    ];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    const expectedCash = initialCash - (50000000 * 0.01) + (55000000 * 0.005); // 1,000,000 - 500,000 + 275,000 = 775,000
    expect(cash).toBe(expectedCash);
    expect(assets.length).toBe(1);
    expect(assets[0]).toEqual({ market: 'KRW-BTC', quantity: 0.005, avg_buy_price: 50000000 }); // Avg buy price remains from original buy
  });

  it('should correctly handle selling all of an asset', () => {
    const transactions: Transaction[] = [
      { id: '1', type: 'buy', market: 'KRW-BTC', price: 50000000, amount: 0.01, timestamp: '2023-01-01T00:00:00Z' },
      { id: '2', type: 'sell', market: 'KRW-BTC', price: 60000000, amount: 0.01, timestamp: '2023-01-02T00:00:00Z' },
    ];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    const expectedCash = initialCash - (50000000 * 0.01) + (60000000 * 0.01); // 1,000,000 - 500,000 + 600,000 = 1,100,000
    expect(cash).toBe(expectedCash);
    expect(assets).toEqual([]); // Asset should be gone
  });

  it('should correctly handle multiple assets', () => {
    const transactions: Transaction[] = [
      { id: '1', type: 'buy', market: 'KRW-BTC', price: 50000000, amount: 0.01, timestamp: '2023-01-01T00:00:00Z' },
      { id: '2', type: 'buy', market: 'KRW-ETH', price: 3000000, amount: 0.1, timestamp: '2023-01-01T00:01:00Z' },
      { id: '3', type: 'sell', market: 'KRW-BTC', price: 60000000, amount: 0.005, timestamp: '2023-01-02T00:00:00Z' },
    ];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    const expectedCash = initialCash - (50000000 * 0.01) - (3000000 * 0.1) + (60000000 * 0.005);
    // 1,000,000 - 500,000 - 300,000 + 300,000 = 500,000
    expect(cash).toBe(expectedCash);
    expect(assets.length).toBe(2);
    expect(assets).toEqual(expect.arrayContaining([
      { market: 'KRW-BTC', quantity: 0.005, avg_buy_price: 50000000 },
      { market: 'KRW-ETH', quantity: 0.1, avg_buy_price: 3000000 },
    ]));
  });

  it('should handle transactions out of order by sorting them', () => {
    const transactions: Transaction[] = [
      { id: '2', type: 'sell', market: 'KRW-BTC', price: 60000000, amount: 0.01, timestamp: '2023-01-02T00:00:00Z' },
      { id: '1', type: 'buy', market: 'KRW-BTC', price: 50000000, amount: 0.01, timestamp: '2023-01-01T00:00:00Z' },
    ];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    const expectedCash = initialCash - (50000000 * 0.01) + (60000000 * 0.01);
    expect(cash).toBe(expectedCash);
    expect(assets).toEqual([]);
  });

  it('should handle selling more than owned (quantity becomes zero or negative, filtered out)', () => {
    const transactions: Transaction[] = [
      { id: '1', type: 'buy', market: 'KRW-BTC', price: 50000000, amount: 0.01, timestamp: '2023-01-01T00:00:00Z' },
      { id: '2', type: 'sell', market: 'KRW-BTC', price: 60000000, amount: 0.02, timestamp: '2023-01-02T00:00:00Z' }, // Selling more than bought
    ];
    const { cash, assets } = calculatePortfolioState(transactions, initialCash);
    const expectedCash = initialCash - (50000000 * 0.01) + (60000000 * 0.02); // 1,000,000 - 500,000 + 1,200,000 = 1,700,000
    expect(cash).toBe(expectedCash);
    expect(assets).toEqual([]); // Asset quantity would be negative, so it's filtered out
  });
});