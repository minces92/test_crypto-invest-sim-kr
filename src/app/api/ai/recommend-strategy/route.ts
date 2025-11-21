import { NextResponse } from 'next/server';
import { createAIClient } from '@/lib/ai-client';
import { getCandlesWithCache } from '@/lib/cache';
import { calculateSMA, calculateRSI, calculateBollingerBands } from '@/lib/utils';

export async function POST(request: Request) {
    try {
        const { market } = await request.json();

        if (!market) {
            return NextResponse.json({ error: 'Market is required' }, { status: 400 });
        }

        // 1. Fetch recent market data (candles)
        const candles = await getCandlesWithCache(market, 60, 'minute60'); // Last 60 hours
        if (candles.length < 30) {
            return NextResponse.json({ error: 'Not enough data for analysis' }, { status: 400 });
        }

        // 2. Calculate technical indicators
        const prices = candles.map(c => ({ trade_price: c.trade_price }));
        const reversedCandles = [...candles].reverse(); // Utils expect newest last? No, check utils.
        // Let's assume utils expect array where index 0 is oldest, last index is newest.
        // getCandles returns newest first usually? Let's check cache.ts or just reverse to be safe if needed.
        // Actually cache.ts returns rows from DB. If we look at ChartComponent, we sorted by time.
        // Let's sort by time ascending for calculation.
        const sortedCandles = [...candles].sort((a, b) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime());
        const sortedPrices = sortedCandles.map(c => ({ trade_price: c.trade_price }));

        const rsi = calculateRSI(sortedPrices, 14);
        const sma20 = calculateSMA(sortedPrices, 20);
        const bb = calculateBollingerBands(sortedPrices, 20, 2);

        const currentPrice = sortedPrices[sortedPrices.length - 1].trade_price;
        const currentRSI = rsi[rsi.length - 1];
        const currentSMA = sma20[sma20.length - 1];
        const currentUpper = bb.upper[bb.upper.length - 1];
        const currentLower = bb.lower[bb.lower.length - 1];

        // 3. Construct prompt for AI
        const prompt = `
    Analyze the following market data for ${market} and recommend a trading strategy.
    
    Current Price: ${currentPrice}
    RSI (14): ${currentRSI?.toFixed(2)}
    SMA (20): ${currentSMA?.toFixed(2)}
    Bollinger Bands: Upper ${currentUpper?.toFixed(2)}, Lower ${currentLower?.toFixed(2)}
    
    Available Strategies:
    1. DCA (Dollar Cost Averaging): Best for long-term accumulation.
    2. MA (Moving Average): Best for trending markets.
    3. RSI: Best for oscillating markets (overbought/oversold).
    4. Bollinger Bands: Best for volatility trading.
    
    Based on the technical indicators, which strategy would be most effective right now?
    Provide the response in JSON format with the following structure:
    {
      "recommendedStrategy": "dca" | "ma" | "rsi" | "bband",
      "reasoning": "Short explanation in Korean",
      "parameters": {
        // Suggested parameters for the chosen strategy
      }
    }
    `;

        // 4. Call AI
        const aiClient = createAIClient();
        if (!aiClient) {
            throw new Error('AI client not available');
        }
        const response = await aiClient.generate(prompt);

        // 5. Parse AI response
        // Try to find JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse AI response');
        }

        const recommendation = JSON.parse(jsonMatch[0]);

        return NextResponse.json(recommendation);

    } catch (error) {
        console.error('Error generating recommendation:', error);
        return NextResponse.json(
            { error: 'Failed to generate recommendation' },
            { status: 500 }
        );
    }
}
