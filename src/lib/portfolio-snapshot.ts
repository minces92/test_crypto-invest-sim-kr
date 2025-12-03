import { queryAll, run, queryGet } from './db-client';

interface Transaction {
    id: string;
    type: 'buy' | 'sell';
    market: string;
    price: number;
    amount: number;
    timestamp: string;
}

interface Asset {
    market: string;
    quantity: number;
    avg_buy_price: number;
}

const INITIAL_CASH = 1000000;

export async function calculatePortfolio(userId: number = 1) {
    // 1. Get all transactions
    const transactions = (await queryAll('SELECT * FROM transactions')) as Transaction[];

    // 2. Calculate current state (similar to PortfolioContext)
    let cash = INITIAL_CASH;
    const assets: { [market: string]: Asset } = {};

    // Sort by timestamp asc to process in order
    const sortedTx = transactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const tx of sortedTx) {
        if (tx.type === 'buy') {
            cash -= tx.price * tx.amount;
            if (assets[tx.market]) {
                const existing = assets[tx.market];
                const totalQty = existing.quantity + tx.amount;
                const totalCost = (existing.avg_buy_price * existing.quantity) + (tx.price * tx.amount);
                assets[tx.market] = {
                    ...existing,
                    quantity: totalQty,
                    avg_buy_price: totalCost / totalQty
                };
            } else {
                assets[tx.market] = {
                    market: tx.market,
                    quantity: tx.amount,
                    avg_buy_price: tx.price
                };
            }
        } else {
            cash += tx.price * tx.amount;
            if (assets[tx.market]) {
                assets[tx.market].quantity -= tx.amount;
            }
        }
    }

    // 3. Get current prices for assets (Fetching from Upbit API would be ideal, but for snapshot we might need latest)
    // For simplicity, we'll try to fetch latest candle or use last transaction price if API fails?
    // Actually, we should fetch current prices.

    let holdingsValue = 0;
    const holdingsList = Object.values(assets).filter(a => a.quantity > 0.00001);

    for (const asset of holdingsList) {
        try {
            // Fetch current price from Upbit
            const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${asset.market}`);
            const data = await response.json();
            if (data && data[0]) {
                holdingsValue += data[0].trade_price * asset.quantity;
            } else {
                // Fallback to avg_buy_price if fetch fails
                holdingsValue += asset.avg_buy_price * asset.quantity;
            }
        } catch (e) {
            console.error(`Failed to fetch price for ${asset.market}`, e);
            holdingsValue += asset.avg_buy_price * asset.quantity;
        }
    }

    const totalValue = cash + holdingsValue;
    const totalGain = totalValue - INITIAL_CASH;
    const returnPercent = (totalGain / INITIAL_CASH) * 100;

    return {
        totalValue,
        cashBalance: cash,
        holdings: holdingsList,
        holdingsValue,
        totalGain,
        returnPercent
    };
}

export async function createDailySnapshot(userId: number = 1) {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Check if snapshot already exists for today
        const existing = await queryGet('SELECT id FROM portfolio_snapshots WHERE user_id = ? AND snapshot_date = ?', [userId, today]);
        if (existing) {
            console.log(`[Snapshot] Snapshot for ${today} already exists.`);
            return;
        }

        console.log(`[Snapshot] Creating snapshot for ${today}...`);
        const portfolio = await calculatePortfolio(userId);

        // Get previous snapshot for daily return calculation
        const prevSnapshot = await queryGet('SELECT total_value FROM portfolio_snapshots WHERE user_id = ? ORDER BY snapshot_date DESC LIMIT 1', [userId]) as { total_value: number } | undefined;

        let dailyReturnPct = 0;
        if (prevSnapshot) {
            dailyReturnPct = ((portfolio.totalValue - prevSnapshot.total_value) / prevSnapshot.total_value) * 100;
        }

        await run(`
      INSERT INTO portfolio_snapshots (
        user_id, snapshot_date, total_value, cash_balance, 
        holdings, holdings_value, total_gain, total_return_pct, daily_return_pct
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            userId,
            today,
            portfolio.totalValue,
            portfolio.cashBalance,
            JSON.stringify(portfolio.holdings),
            portfolio.holdingsValue,
            portfolio.totalGain,
            portfolio.returnPercent,
            dailyReturnPct
        ]);

        console.log(`[Snapshot] Successfully created snapshot for ${today}. Total Value: ${portfolio.totalValue}`);

    } catch (error) {
        console.error('[Snapshot] Failed to create snapshot:', error);
    }
}
