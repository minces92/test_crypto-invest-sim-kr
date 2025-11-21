import { NextResponse } from 'next/server';
import { createAIClient } from '@/lib/ai-client';
import { getCandlesWithCache } from '@/lib/cache';
import { calculateSMA, calculateRSI, calculateBollingerBands } from '@/lib/utils';

function _parseJsonResponse(text: string): any {
  // First, try to find a JSON block enclosed in ```json ... ```
  const jsonBlockMatch = text.match(/```json\n([\s\S]*?)\n```/);
  let jsonString = '';

  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonString = jsonBlockMatch[1].trim();
  } else {
    // If no block is found, fall back to the first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonString = text.substring(firstBrace, lastBrace + 1);
    }
  }

  if (!jsonString) {
    console.error("Could not find JSON in response:", text);
    throw new Error('No JSON object found in the response.');
  }

  try {
    return JSON.parse(jsonString);
  } catch (e: any) {
    console.error("Failed to parse JSON string:", jsonString);
    // Re-throw the original error with more context
    throw new Error(`JSON parsing failed: ${e.message}`);
  }
}

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
    1. MA (Moving Average): Best for trending markets.
    2. RSI: Best for oscillating markets (overbought/oversold).
    3. Bollinger Bands: Best for volatility trading.
    
    Based on the technical indicators, which strategy would be most effective right now?
    Provide the response in JSON format with the following structure. Ensure parameter names match exactly as specified below for each strategy type:
    {
      "recommendedStrategy": "ma" | "rsi" | "bband" | "news" | "volatility" | "momentum",
      "reasoning": "Short explanation in Korean",
      "parameters": {
        // Suggested parameters for the chosen strategy.
        // For "ma": { "shortPeriod": number, "longPeriod": number }
        // For "rsi": { "period": number, "buyThreshold": number, "sellThreshold": number }
        // For "bband": { "period": number, "multiplier": number }
        // For "news": { "sentimentThreshold": "positive" | "negative" }
        // For "volatility": { "multiplier": number }
        // For "momentum": { "period": number, "threshold": number }
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
        const recommendation = _parseJsonResponse(response);

        return NextResponse.json(recommendation);

    } catch (error) {
        console.error('Error generating recommendation:', error);
        return NextResponse.json(
            { error: 'Failed to generate recommendation' },
            { status: 500 }
        );
    }
}
