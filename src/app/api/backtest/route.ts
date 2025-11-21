import { NextRequest, NextResponse } from 'next/server';
import { getCandlesWithCache } from '@/lib/cache';
import { BacktestEngine } from '@/lib/backtest-engine';
import { Strategy } from '@/context/PortfolioContext';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { strategy, market, interval, count } = body;

        if (!strategy || !market) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Fetch candles
        // Default to 200 candles if not specified, or more for better backtest
        const candleCount = count || 200;
        const candleInterval = interval || 'day';

        const candles = await getCandlesWithCache(market, candleCount, candleInterval);

        if (candles.length < 20) {
            return NextResponse.json({ error: 'Not enough data for backtesting' }, { status: 400 });
        }

        // Run Backtest
        const engine = new BacktestEngine(1000000); // 1M KRW initial capital
        const result = engine.run(strategy as Strategy, candles);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Backtest error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
