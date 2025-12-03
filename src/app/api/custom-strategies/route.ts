import { NextResponse } from 'next/server';
import { run, queryAll } from '@/lib/db-client';
import { randomUUID } from 'crypto';

export async function GET() {
    try {
        const userId = 1;
        const strategies = await queryAll('SELECT * FROM custom_strategies WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return NextResponse.json(strategies);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch strategies' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, buyCondition, sellCondition } = body;
        const userId = 1;
        const id = randomUUID();

        await run(`
      INSERT INTO custom_strategies (
        id, user_id, name, buy_condition, sell_condition, enabled
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
            id, userId, name,
            JSON.stringify(buyCondition),
            JSON.stringify(sellCondition),
            0 // Disabled by default
        ]);

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Failed to save strategy:', error);
        return NextResponse.json({ error: 'Failed to save strategy' }, { status: 500 });
    }
}
