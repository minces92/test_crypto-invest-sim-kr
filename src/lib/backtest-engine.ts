import { Strategy } from '@/context/PortfolioContext';
import { calculateSMA, calculateRSI, calculateBollingerBands } from './utils';

interface Candle {
    candle_date_time_utc: string;
    opening_price: number;
    high_price: number;
    low_price: number;
    trade_price: number;
    candle_acc_trade_volume?: number;
}

interface BacktestResult {
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    tradeCount: number;
    winRate: number;
    trades: any[];
    history: { time: string; value: number }[];
}

export class BacktestEngine {
    private cash: number;
    private assets: number;
    private trades: any[] = [];
    private history: { time: string; value: number }[] = [];
    private initialCapital: number;

    constructor(initialCapital: number = 1000000) {
        this.initialCapital = initialCapital;
        this.cash = initialCapital;
        this.assets = 0;
    }

    public run(strategy: Strategy, candles: Candle[]): BacktestResult {
        // Sort candles by time ascending
        const sortedCandles = [...candles].sort((a, b) =>
            new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime()
        );

        // Pre-calculate indicators if needed
        let indicators: any = {};

        if (strategy.strategyType === 'ma') {
            indicators.shortMA = calculateSMA(sortedCandles, strategy.shortPeriod);
            indicators.longMA = calculateSMA(sortedCandles, strategy.longPeriod);
        } else if (strategy.strategyType === 'rsi') {
            indicators.rsi = calculateRSI(sortedCandles, strategy.period);
        } else if (strategy.strategyType === 'bband') {
            indicators.bb = calculateBollingerBands(sortedCandles, strategy.period, strategy.multiplier);
        }

        // Simulate
        for (let i = 0; i < sortedCandles.length; i++) {
            const candle = sortedCandles[i];
            const currentPrice = candle.trade_price;
            const timestamp = candle.candle_date_time_utc;

            this.evaluateStrategy(strategy, i, currentPrice, timestamp, indicators, sortedCandles);

            // Record history
            const totalValue = this.cash + (this.assets * currentPrice);
            this.history.push({ time: timestamp, value: totalValue });
        }

        const finalValue = this.cash + (this.assets * sortedCandles[sortedCandles.length - 1].trade_price);
        const totalReturn = ((finalValue - this.initialCapital) / this.initialCapital) * 100;
        const winningTrades = this.trades.filter(t => t.type === 'sell' && t.profit > 0).length;
        const sellTrades = this.trades.filter(t => t.type === 'sell').length;

        return {
            initialCapital: this.initialCapital,
            finalCapital: finalValue,
            totalReturn,
            tradeCount: this.trades.length,
            winRate: sellTrades > 0 ? (winningTrades / sellTrades) * 100 : 0,
            trades: this.trades,
            history: this.history,
        };
    }

    private evaluateStrategy(strategy: Strategy, index: number, price: number, timestamp: string, indicators: any, candles: Candle[]) {
        // Skip if not enough data
        if (index < 20) return; // Minimum buffer

        if (strategy.strategyType === 'ma') {
            const shortMA = indicators.shortMA;
            const longMA = indicators.longMA;

            if (!shortMA[index] || !longMA[index] || !shortMA[index - 1] || !longMA[index - 1]) return;

            const lastShort = shortMA[index];
            const lastLong = longMA[index];
            const prevShort = shortMA[index - 1];
            const prevLong = longMA[index - 1];

            // Golden Cross
            if (lastShort > lastLong && prevShort <= prevLong) {
                this.buy(price, timestamp, 'Golden Cross');
            }
            // Dead Cross
            else if (lastShort < lastLong && prevShort >= prevLong) {
                this.sell(price, timestamp, 'Dead Cross');
            }
        }
        else if (strategy.strategyType === 'rsi') {
            const rsi = indicators.rsi;
            if (!rsi[index]) return;

            const currentRsi = rsi[index];

            if (currentRsi < strategy.buyThreshold) {
                this.buy(price, timestamp, `RSI Oversold (${currentRsi.toFixed(2)})`);
            } else if (currentRsi > strategy.sellThreshold) {
                this.sell(price, timestamp, `RSI Overbought (${currentRsi.toFixed(2)})`);
            }
        }
        else if (strategy.strategyType === 'bband') {
            const bb = indicators.bb;
            if (!bb.upper[index] || !bb.lower[index]) return;

            const upper = bb.upper[index];
            const lower = bb.lower[index];

            if (price < lower) {
                this.buy(price, timestamp, 'BB Lower Breakout');
            } else if (price > upper) {
                this.sell(price, timestamp, 'BB Upper Breakout');
            }
        }
        else if (strategy.strategyType === 'volatility') {
            // Need previous day candle
            // Assuming daily candles for simplicity or checking index-1 if same timeframe
            // For volatility breakout, we usually need daily data. 
            // If candles are minutes, this logic needs adjustment. 
            // Here we assume candles match the strategy interval.
            if (index < 1) return;
            const prevCandle = candles[index - 1];
            const range = prevCandle.high_price - prevCandle.low_price;
            const targetPrice = prevCandle.high_price + (range * strategy.multiplier);

            if (price > targetPrice) {
                this.buy(price, timestamp, 'Volatility Breakout');
            }
        }
    }

    private buy(price: number, timestamp: string, reason: string) {
        // Simple logic: Buy with 99% of cash if we have cash
        if (this.cash > 5000) {
            const amount = (this.cash * 0.99) / price; // Leave 1% for fees/slippage simulation
            const cost = amount * price;
            this.cash -= cost;
            this.assets += amount;
            this.trades.push({ type: 'buy', price, amount, timestamp, reason });
        }
    }

    private sell(price: number, timestamp: string, reason: string) {
        if (this.assets > 0) {
            const amount = this.assets;
            const revenue = amount * price;

            // Calculate profit for the last buy
            const lastBuy = this.trades.slice().reverse().find(t => t.type === 'buy');
            const profit = lastBuy ? (price - lastBuy.price) * amount : 0;

            this.cash += revenue;
            this.assets = 0;
            this.trades.push({ type: 'sell', price, amount, timestamp, reason, profit });
        }
    }
}
