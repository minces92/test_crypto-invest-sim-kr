import { NextResponse } from 'next/server';
import { getUpbitAccounts } from '@/lib/upbit-client';
import { handleApiError } from '@/lib/error-handler';
import { run, transaction } from '@/lib/db-client';
import { v4 as uuidv4 } from 'uuid';

export async function POST() {
  try {
    const accounts = await getUpbitAccounts();
    
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ success: true, message: 'No accounts found on Upbit.' });
    }

    const krwMarkets = accounts.filter(account => account.unit_currency === 'KRW' && parseFloat(account.balance) > 0);

    const statements = [
      // 1. Clear previous AI-simulated transactions to start fresh
      { sql: "DELETE FROM transactions WHERE source = 'ai_simulation' OR source = 'upbit_sync'", params: [] }
    ];

    for (const account of krwMarkets) {
      // We only care about markets like 'KRW-BTC', not the base 'KRW' currency itself.
      if (account.currency === 'KRW') continue;

      const market = `KRW-${account.currency}`;
      const balance = parseFloat(account.balance);
      const avgBuyPrice = parseFloat(account.avg_buy_price);

      if (balance > 0) {
        statements.push({
          sql: `
            INSERT INTO transactions (id, type, market, price, amount, timestamp, isAuto, strategyType, source) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            uuidv4(),
            'buy',
            market,
            avgBuyPrice,
            balance,
            new Date().toISOString(),
            1, // Mark as 'auto' since it's an automated sync
            'sync',
            'upbit_sync'
          ]
        });
      }
    }

    if (statements.length > 1) { // More than just the DELETE statement
      await transaction(statements);
    }

    return NextResponse.json({ success: true, message: `Synced ${krwMarkets.length - 1} assets from Upbit.`, syncedAssets: krwMarkets.length-1 });
  } catch (error) {
    return handleApiError(error);
  }
}
