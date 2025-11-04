interface Candle {
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
