import { NextResponse } from 'next/server';
import { createAIClient } from '@/lib/ai-client';
import { getCandlesWithCache } from '@/lib/cache';
import { calculateSMA, calculateRSI, calculateBollingerBands } from '@/lib/utils';
import { loadPrompt, fillPromptTemplate } from '@/lib/prompt-loader';

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

        // 3. Load and fill prompt for AI
        const { metadata, template } = await loadPrompt('recommend-strategy');
        const prompt = fillPromptTemplate(template, {
            market,
            currentPrice,
            currentRSI: currentRSI?.toFixed(2),
            currentSMA: currentSMA?.toFixed(2),
            currentUpper: currentUpper?.toFixed(2),
            currentLower: currentLower?.toFixed(2),
        });

        // 4. Call AI
        const aiClient = createAIClient();
        if (!aiClient) {
            throw new Error('AI client not available');
        }
        const response = await aiClient.generate(prompt, {
            model: metadata.model,
            temperature: metadata.temperature,
            maxTokens: metadata.maxTokens,
        });

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
