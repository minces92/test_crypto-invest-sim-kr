interface Candle {
  trade_price: number;
}

interface CandleData {
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
}

/**
 * 단순이동평균(SMA)을 계산합니다.
 * @param data - 캔들 데이터 배열
 * @param period - 이동평균 기간
 * @returns 이동평균 값의 배열
 */
export function calculateSMA(data: Candle[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i <= data.length - period; i++) {
    const sum = data.slice(i, i + period).reduce((acc, val) => acc + val.trade_price, 0);
    sma.push(sum / period);
  }
  return sma;
}

/**
 * RSI(상대강도지수)를 계산합니다.
 * @param data - 캔들 데이터 배열
 * @param period - RSI 기간 (기본값: 14)
 * @returns RSI 값의 배열
 */
export function calculateRSI(data: Candle[], period: number = 14): number[] {
  const rsi: number[] = [];
  if (data.length <= period) return rsi;

  const changes = data.slice(1).map((candle, i) => candle.trade_price - data[i].trade_price);
  
  let initialGain = 0;
  let initialLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      initialGain += changes[i];
    } else {
      initialLoss -= changes[i];
    }
  }

  let avgGain = initialGain / period;
  let avgLoss = initialLoss / period;

  if (avgLoss === 0) {
    rsi.push(100);
  } else {
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    let currentGain = 0;
    let currentLoss = 0;

    if (change > 0) {
      currentGain = change;
    } else {
      currentLoss = -change;
    }

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }

  return rsi;
}


interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
}

/**
 * 볼린저 밴드를 계산합니다.
 * @param data - 캔들 데이터 배열
 * @param period - 이동평균 및 표준편차 기간
 * @param multiplier - 표준편차 승수
 * @returns 상단, 중간, 하단 밴드 값의 배열을 포함하는 객체
 */
export function calculateBollingerBands(data: Candle[], period: number, multiplier: number): BollingerBands {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i <= data.length - period; i++) {
    const slice = data.slice(i, i + period).map(d => d.trade_price);
    const mean = middle[i];
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(mean + stdDev * multiplier);
    lower.push(mean - stdDev * multiplier);
  }

  return { upper, middle, lower };
}

/**
 * 지수이동평균(EMA)을 계산합니다.
 * @param data - 캔들 데이터 배열
 * @param period - 이동평균 기간
 * @returns EMA 값의 배열
 */
export function calculateEMA(data: Candle[], period: number): number[] {
  const ema: number[] = [];
  if (data.length < period) return ema;

  const multiplier = 2 / (period + 1);
  
  // 첫 번째 EMA는 SMA로 시작
  const firstSMA = data.slice(0, period).reduce((sum, d) => sum + d.trade_price, 0) / period;
  ema.push(firstSMA);
  
  for (let i = period; i < data.length; i++) {
    const currentEMA = (data[i].trade_price - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }
  
  return ema;
}

/**
 * MACD (Moving Average Convergence Divergence)를 계산합니다.
 * @param data - 캔들 데이터 배열
 * @param fastPeriod - 빠른 기간 (기본값: 12)
 * @param slowPeriod - 느린 기간 (기본값: 26)
 * @param signalPeriod - 시그널 기간 (기본값: 9)
 * @returns MACD 라인, 시그널 라인, 히스토그램을 포함하는 객체
 */
export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export function calculateMACD(
  data: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  // MACD 라인 = 빠른 EMA - 느린 EMA
  const macdLine: number[] = [];
  const minLength = Math.min(fastEMA.length, slowEMA.length);
  const fastOffset = data.length - fastEMA.length;
  const slowOffset = data.length - slowEMA.length;
  
  for (let i = 0; i < minLength; i++) {
    const fastIdx = fastOffset + i;
    const slowIdx = slowOffset + i;
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }
  
  // 시그널 라인 = MACD 라인의 EMA
  const macdAsCandles: Candle[] = macdLine.map(val => ({ trade_price: val }));
  const signalLine = calculateEMA(macdAsCandles, signalPeriod);
  
  // 히스토그램 = MACD 라인 - 시그널 라인
  const histogram: number[] = [];
  const signalOffset = macdLine.length - signalLine.length;
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[signalOffset + i] - signalLine[i]);
  }
  
  return { macdLine, signalLine, histogram };
}

/**
 * ATR (Average True Range)를 계산합니다.
 * @param data - 캔들 데이터 배열 (high_price, low_price, trade_price 포함)
 * @param period - ATR 기간 (기본값: 14)
 * @returns ATR 값의 배열
 */
export function calculateATR(data: CandleData[], period: number = 14): number[] {
  const trueRanges: number[] = [];
  
  if (data.length < 2) return [];
  
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high_price;
    const low = data[i].low_price;
    const prevClose = data[i - 1].trade_price;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  if (trueRanges.length < period) return [];
  
  // 첫 ATR은 SMA로 계산
  const atr: number[] = [];
  let sum = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  atr.push(sum / period);
  
  // 이후는 지수 이동평균 방식으로 계산
  for (let i = period; i < trueRanges.length; i++) {
    const currentATR = (atr[atr.length - 1] * (period - 1) + trueRanges[i]) / period;
    atr.push(currentATR);
  }
  
  return atr;
}
