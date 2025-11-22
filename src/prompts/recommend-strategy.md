---
name: Strategy Recommendation
description: Analyzes market data and recommends a trading strategy.
model: mistral # Default model, can be overridden
temperature: 0.7
---
Analyze the following market data for {{market}} and recommend a trading strategy.

Current Price: {{currentPrice}}
RSI (14): {{currentRSI}}
SMA (20): {{currentSMA}}
Bollinger Bands: Upper {{currentUpper}}, Lower {{currentLower}}

Available Strategies:
1. MA (Moving Average): Best for trending markets.
2. RSI: Best for oscillating markets (overbought/oversold).
3. Bollinger Bands: Best for volatility trading.

Based on the technical indicators, which strategy would be most effective right now?
Provide the response in JSON format with the following structure. Ensure parameter names match exactly as specified below for each strategy type:
```json
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
```
