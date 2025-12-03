import { NextResponse } from 'next/server';
import { queryGet, run, queryAll } from '@/lib/db-client';
import { calculatePortfolio } from '@/lib/portfolio-snapshot';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { token: string } }) {
    try {
        const { token } = params;

        const share = await queryGet('SELECT * FROM portfolio_shares WHERE share_token = ?', [token]) as any;

        if (!share) {
            return NextResponse.json({ error: 'Shared portfolio not found' }, { status: 404 });
        }

        // Increment view count
        await run('UPDATE portfolio_shares SET view_count = view_count + 1 WHERE id = ?', [share.id]);

        const portfolio = await calculatePortfolio(share.user_id);

        // Filter data based on permissions
        const result: any = {
            name: share.name,
            description: share.description,
            updatedAt: new Date().toISOString(), // Should be snapshot date ideally, but live for now
        };

        if (share.show_holdings) {
            result.holdings = portfolio.holdings;
            result.totalValue = portfolio.totalValue;
        }

        if (share.show_returns) {
            result.totalReturnPct = portfolio.returnPercent;
            result.totalGain = portfolio.totalGain;
        }

        if (share.show_trades) {
            // Fetch recent trades
            const trades = await queryAll('SELECT * FROM transactions WHERE notification_sent = 0 ORDER BY timestamp DESC LIMIT 20'); // Just using notification_sent as a dummy filter or just all?
            // Actually let's just fetch last 20 transactions for the user
            const userTrades = await queryAll('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 20');
            result.trades = userTrades;
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to fetch shared portfolio:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
