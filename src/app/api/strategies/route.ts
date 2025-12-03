import { NextResponse } from 'next/server';
import { run, queryAll } from '@/lib/db-client';

export async function GET() {
  try {
    const userId = 1;
    // Ensure table exists (handled by db-worker but good to be safe if query fails)
    const strategies = await queryAll('SELECT * FROM active_strategies WHERE user_id = ? AND is_active = 1', [userId]) as any[];

    // Transform back to Strategy object
    const parsedStrategies = strategies.map((s: any) => {
      try {
        return {
          id: s.id,
          isActive: Boolean(s.is_active),
          strategyType: s.strategy_type,
          market: s.market,
          ...JSON.parse(s.config)
        };
      } catch (e) {
        console.error('Failed to parse strategy config:', e);
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json(parsedStrategies);
  } catch (error) {
    console.error('Failed to fetch active strategies:', error);
    return NextResponse.json({ error: 'Failed to fetch strategies' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, strategyType, market, isActive, ...config } = body;
    const userId = 1;

    await run(`
      INSERT INTO active_strategies (
        id, user_id, strategy_type, market, is_active, config
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        is_active = excluded.is_active,
        config = excluded.config
    `, [
      id, userId, strategyType, market, isActive ? 1 : 0, JSON.stringify(config)
    ]);

    return NextResponse.json({ ...body });
  } catch (error) {
    console.error('Failed to save active strategy:', error);
    return NextResponse.json({ error: 'Failed to save strategy' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await run('DELETE FROM active_strategies WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete strategy' }, { status: 500 });
  }
}
