import { NextResponse } from 'next/server';
import { createAIClient } from '@/lib/ai-client';
import { getCandlesWithCache } from '@/lib/cache';
import { calculateSMA, calculateRSI, calculateBollingerBands } from '@/lib/utils';
import { loadPrompt, fillPromptTemplate } from '@/lib/prompt-loader';

// Helper to parse JSON from AI response
function _parseJsonResponse(text: string): any {
    const jsonBlockMatch = text.match(/```json\n([\s\S]*?)\n```/);
    let jsonString = '';

    if (jsonBlockMatch && jsonBlockMatch[1]) {
        jsonString = jsonBlockMatch[1].trim();
    } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonString = text.substring(firstBrace, lastBrace + 1);
        }
    }

    if (!jsonString) {
        throw new Error('No JSON object found in the response.');
    }

    try {
        return JSON.parse(jsonString);
    } catch (e: any) {
        throw new Error(`JSON parsing failed: ${e.message}`);
    }
}

export async function POST(request: Request) {
    try {
        const { markets } = await request.json();

        if (!markets || !Array.isArray(markets) || markets.length === 0) {
            return NextResponse.json({ error: 'Markets array is required' }, { status: 400 });
        }

        // Limit to 5 markets to prevent timeout/rate limits
        const targetMarkets = markets.slice(0, 5);
        const results = [];

        // Process each market
        // Note: In a production env, we might want to use Promise.all with concurrency limit.
        // Here we do sequential or parallel depending on rate limits. 
        // Let's do parallel but with error handling for each.

        const analyzeMarket = async (market: string) => {
            try {
                // 1. Fetch data
                const candles = await getCandlesWithCache(market, 60, 'minute60');
                if (candles.length < 30) return null;

                // 2. Indicators
                const sortedCandles = [...candles].sort((a, b) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime());
                const prices = sortedCandles.map(c => ({ trade_price: c.trade_price }));

                const rsi = calculateRSI(prices, 14);
                const sma20 = calculateSMA(prices, 20);
                const bb = calculateBollingerBands(prices, 20, 2);

                const currentPrice = prices[prices.length - 1].trade_price;
                const currentRSI = rsi[rsi.length - 1];
                const currentSMA = sma20[sma20.length - 1];
                const currentUpper = bb.upper[bb.upper.length - 1];
                const currentLower = bb.lower[bb.lower.length - 1];

                // 3. Prompt
                const { metadata, template } = await loadPrompt('recommend-strategy');
                const prompt = fillPromptTemplate(template, {
                    market,
                    currentPrice,
                    currentRSI: currentRSI?.toFixed(2),
                    currentSMA: currentSMA?.toFixed(2),
                    currentUpper: currentUpper?.toFixed(2),
                    currentLower: currentLower?.toFixed(2),
                });

                // 4. AI Call
                const aiClient = createAIClient();
                if (!aiClient) return null;

                const response = await aiClient.generate(prompt, {
                    model: process.env.AI_MODEL_RECOMMENDATION || metadata.model,
                    temperature: metadata.temperature,
                    maxTokens: metadata.maxTokens,
                });

                const recommendation = _parseJsonResponse(response);
                return {
                    market,
                    ...recommendation
                };

            } catch (error) {
                console.error(`Error analyzing ${market}:`, error);
                return { market, error: 'Analysis failed' };
            }
        };

        const promises = targetMarkets.map(m => analyzeMarket(m));
        const analysisResults = await Promise.all(promises);

        // Filter out nulls
        const validResults = analysisResults.filter(r => r !== null);

        return NextResponse.json({ results: validResults });

    } catch (error) {
        console.error('Batch recommendation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate recommendations' },
            { status: 500 }
        );
    }
}
