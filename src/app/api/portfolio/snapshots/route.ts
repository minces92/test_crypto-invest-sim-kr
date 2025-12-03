import { NextResponse } from 'next/server';
import { queryAll } from '@/lib/db-client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const days = parseInt(searchParams.get('days') || '30');
        const userId = 1; // Fixed user for now

        const snapshots = await queryAll(`
      SELECT * FROM portfolio_snapshots
      WHERE user_id = ? AND snapshot_date >= date('now', '-' || ? || ' days')
      ORDER BY snapshot_date ASC
    `, [userId, days]);

        return NextResponse.json(snapshots);
    } catch (error) {
        console.error('Failed to fetch snapshots:', error);
        return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }
}
