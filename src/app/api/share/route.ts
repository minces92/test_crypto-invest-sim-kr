import { NextResponse } from 'next/server';
import { run, queryGet } from '@/lib/db-client';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, description, showHoldings, showTrades, showReturns } = body;
        const userId = 1; // Fixed user

        const shareId = randomUUID();
        const shareToken = randomUUID().replace(/-/g, '').substring(0, 12); // Shorter token

        await run(`
      INSERT INTO portfolio_shares (
        id, user_id, name, description, share_token, 
        show_holdings, show_trades, show_returns, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            shareId, userId, name, description, shareToken,
            showHoldings ? 1 : 0, showTrades ? 1 : 0, showReturns ? 1 : 0, 1
        ]);

        return NextResponse.json({
            shareId,
            shareUrl: `/share/${shareToken}`,
            shareToken
        });
    } catch (error) {
        console.error('Failed to create share link:', error);
        return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }
}
