import { NextResponse } from 'next/server';
import { run, queryAll } from '@/lib/db-client';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ShareSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    show_holdings: z.boolean(),
    show_returns: z.boolean(),
    show_trades: z.boolean(),
    expires_in_days: z.number().min(1).max(365).optional(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const data = ShareSchema.parse(body);
        const userId = 1; // Fixed user for now

        const token = crypto.randomBytes(16).toString('hex');
        const expiresAt = data.expires_in_days
            ? new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
            : null;

        await run(`
      INSERT INTO portfolio_shares (
        user_id, share_token, name, description, 
        show_holdings, show_returns, show_trades, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            userId, token, data.name, data.description || '',
            data.show_holdings ? 1 : 0,
            data.show_returns ? 1 : 0,
            data.show_trades ? 1 : 0,
            expiresAt
        ]);

        return NextResponse.json({ token, url: `/share/${token}` });
    } catch (error) {
        console.error('Failed to create share link:', error);
        return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const userId = 1; // Fixed user
        const shares = await queryAll(`
      SELECT * FROM portfolio_shares 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [userId]);

        return NextResponse.json(shares);
    } catch (error) {
        console.error('Failed to list shares:', error);
        return NextResponse.json({ error: 'Failed to list shares' }, { status: 500 });
    }
}
