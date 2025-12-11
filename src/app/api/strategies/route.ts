import { NextResponse } from 'next/server';
import { run, queryAll } from '@/lib/db-client';
import { handleApiError, AppError } from '@/lib/error-handler';
import { z } from 'zod';

const StrategySchema = z.object({
  id: z.string(),
  strategyType: z.string(),
  market: z.string(),
  isActive: z.boolean(),
}).passthrough(); // Allow other config properties

export async function GET() {
  try {
    const userId = 1;
    // Ensure table exists (handled by db-worker but good to be safe if query fails)
    const strategies = await queryAll('SELECT * FROM strategies WHERE user_id = ? AND is_active = 1', [userId]) as any[];

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
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = StrategySchema.safeParse(body);
    if (!result.success) {
      throw new AppError('INVALID_INPUT', 'Invalid strategy data', 400);
    }

    const { id, strategyType, market, isActive, ...config } = body;
    const userId = 1;

    await run(`
      INSERT INTO strategies (
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
    return handleApiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      throw new AppError('MISSING_ID', 'ID required', 400);
    }

    await run('DELETE FROM strategies WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
