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
