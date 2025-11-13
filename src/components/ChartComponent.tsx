'use client';

import { useEffect, useState } from 'react';
import { 
  ComposedChart, 
  Line, 
  Area, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { calculateSMA, calculateEMA, calculateRSI, calculateBollingerBands, calculateMACD } from '@/lib/utils';
import { usePortfolio } from '@/context/PortfolioContext';

interface CandleData {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume?: number;
}

interface ChartComponentProps {
  market: string;
}

interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  sma?: number;
  ema?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
}

interface IndicatorConfig {
  sma: boolean;
  ema: boolean;
  rsi: boolean;
  macd: boolean;
  bollinger: boolean;
}

export default function ChartComponent({ market }: ChartComponentProps) {
  const { transactions } = usePortfolio();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [rsiData, setRsiData] = useState<Array<{ time: string; rsi: number }>>([]);
  const [macdData, setMacdData] = useState<Array<{ time: string; macd: number; signal: number; histogram: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState('day'); // 'day', 'minute240', 'minute60', 'minute30'
  const [indicators, setIndicators] = useState<IndicatorConfig>({
    sma: true,
    ema: false,
    rsi: false,
    macd: false,
    bollinger: false,
  });
  const [showVolume, setShowVolume] = useState(true);

  useEffect(() => {
    if (!market) {
      setLoading(false);
      return;
    }

    const fetchChartData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/candles?market=${market}&count=90&interval=${interval}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const rawData: CandleData[] = await response.json();
        
        if (!rawData || rawData.length === 0) {
          setError('차트 데이터가 없습니다.');
          setLoading(false);
          return;
        }

        // 데이터 유효성 검사 및 정렬
        const validData = rawData
          .filter(d => 
            d.candle_date_time_utc && 
            d.opening_price != null && 
            d.high_price != null && 
            d.low_price != null && 
            d.trade_price != null
          )
          .sort((a, b) => 
            new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime()
          );

        if (validData.length === 0) {
          setError('유효한 차트 데이터가 없습니다.');
          setLoading(false);
          return;
        }

        // 시간 포맷팅 함수
        const formatTime = (utc: string) => {
          const date = new Date(utc);
          if (interval === 'day') {
            return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
          }
          return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        // 기본 차트 데이터 준비
        const baseChartData: ChartDataPoint[] = validData.map(d => ({
          time: formatTime(d.candle_date_time_utc),
          open: d.opening_price,
          high: d.high_price,
          low: d.low_price,
          close: d.trade_price,
          volume: d.candle_acc_trade_volume || 0,
        }));

        // 지표 계산을 위한 데이터 준비
        const priceData = baseChartData.map(d => ({ trade_price: d.close }));

        // SMA 계산
        if (indicators.sma) {
          const smaPeriod = 20;
          const smaValues = calculateSMA(priceData, smaPeriod);
          baseChartData.forEach((d, i) => {
            if (i >= smaPeriod - 1) {
              d.sma = smaValues[i - smaPeriod + 1];
            }
          });
        }

        // EMA 계산
        if (indicators.ema) {
          const emaPeriod = 12;
          const emaValues = calculateEMA(priceData, emaPeriod);
          baseChartData.forEach((d, i) => {
            if (i >= emaPeriod - 1) {
              d.ema = emaValues[i - emaPeriod + 1];
            }
          });
        }

        // 볼린저 밴드 계산
        if (indicators.bollinger) {
          const bbPeriod = 20;
          const bbMultiplier = 2;
          const bb = calculateBollingerBands(priceData, bbPeriod, bbMultiplier);
          baseChartData.forEach((d, i) => {
            if (i >= bbPeriod - 1) {
              const bbIndex = i - bbPeriod + 1;
              d.bbUpper = bb.upper[bbIndex];
              d.bbMiddle = bb.middle[bbIndex];
              d.bbLower = bb.lower[bbIndex];
            }
          });
        }

        // RSI 계산
        if (indicators.rsi) {
          const rsiPeriod = 14;
          const rsiValues = calculateRSI(priceData, rsiPeriod);
          const rsiChartData = baseChartData
            .slice(rsiPeriod)
            .map((d, i) => ({
              time: d.time,
              rsi: Math.min(100, Math.max(0, rsiValues[i])),
            }));
          setRsiData(rsiChartData);
        } else {
          setRsiData([]);
        }

        // MACD 계산
        if (indicators.macd) {
          const macdResult = calculateMACD(priceData, 12, 26, 9);
          const macdChartData = baseChartData
            .slice(26 + 9 - 1)
            .map((d, i) => {
              const macdIndex = Math.min(i, macdResult.macdLine.length - 1);
              const signalIndex = Math.min(i, macdResult.signalLine.length - 1);
              const histIndex = Math.min(i, macdResult.histogram.length - 1);
              return {
                time: d.time,
                macd: macdResult.macdLine[macdIndex] || 0,
                signal: macdResult.signalLine[signalIndex] || 0,
                histogram: macdResult.histogram[histIndex] || 0,
              };
            });
          setMacdData(macdChartData);
        } else {
          setMacdData([]);
        }

        setChartData(baseChartData);
      } catch (error) {
        console.error('Failed to fetch or render chart data:', error);
        setError(error instanceof Error ? error.message : '차트 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [market, indicators, interval]);

  // 거래 마커 데이터 준비
  const marketTransactions = transactions.filter(tx => tx.market === market);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        차트 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#f85149' }}>
        <div style={{ textAlign: 'center' }}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const intervalButtons = [
    { label: '일', value: 'day' },
    { label: '4H', value: 'minute240' },
    { label: '1H', value: 'minute60' },
    { label: '30m', value: 'minute30' },
  ];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {intervalButtons.map(btn => (
            <button
              key={btn.value}
              onClick={() => setInterval(btn.value)}
              className={`btn btn-sm ${interval === btn.value ? 'btn-primary' : ''}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={indicators.sma}
              onChange={(e) => setIndicators({ ...indicators, sma: e.target.checked })}
            />
            SMA(20)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={indicators.ema}
              onChange={(e) => setIndicators({ ...indicators, ema: e.target.checked })}
            />
            EMA(12)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={indicators.bollinger}
              onChange={(e) => setIndicators({ ...indicators, bollinger: e.target.checked })}
            />
            볼린저밴드
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={indicators.rsi}
              onChange={(e) => setIndicators({ ...indicators, rsi: e.target.checked })}
            />
            RSI
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={indicators.macd}
              onChange={(e) => setIndicators({ ...indicators, macd: e.target.checked })}
            />
            MACD
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showVolume}
              onChange={(e) => setShowVolume(e.target.checked)}
            />
            거래량
          </label>
        </div>
      </div>

      {/* 메인 캔들스틱 차트 */}
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            yAxisId="price"
            orientation="left"
            tick={{ fontSize: 12 }}
            domain={['auto', 'auto']}
            tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : value}
          />
          {showVolume && (
            <YAxis 
              yAxisId="volume"
              orientation="right"
              tick={{ fontSize: 12 }}
              domain={[0, 'auto']}
              tickFormatter={(value) => typeof value === 'number' ? (value / 1000000).toFixed(1) + 'M' : value}
            />
          )}
          <Tooltip 
            formatter={(value: any, name: string) => {
              if (typeof value === 'number') {
                return [value.toLocaleString('ko-KR'), name];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `시간: ${label}`}
          />
          <Legend />
          
          {/* 캔들스틱 (Area로 표현) */}
          <Area
            type="monotone"
            dataKey="high"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.1}
            yAxisId="price"
          />
          <Area
            type="monotone"
            dataKey="low"
            stroke="#82ca9d"
            fill="#82ca9d"
            fillOpacity={0.1}
            yAxisId="price"
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#333"
            strokeWidth={2}
            dot={false}
            yAxisId="price"
            name="종가"
          />
          <Line
            type="monotone"
            dataKey="open"
            stroke="#888"
            strokeWidth={1}
            dot={false}
            strokeDasharray="5 5"
            yAxisId="price"
            name="시가"
          />

          {/* 지표들 */}
          {indicators.sma && (
            <Line
              type="monotone"
              dataKey="sma"
              stroke="#FFA500"
              strokeWidth={2}
              dot={false}
              yAxisId="price"
              name="SMA(20)"
            />
          )}
          {indicators.ema && (
            <Line
              type="monotone"
              dataKey="ema"
              stroke="#00FF00"
              strokeWidth={2}
              dot={false}
              yAxisId="price"
              name="EMA(12)"
            />
          )}
          {indicators.bollinger && (
            <>
              <Line
                type="monotone"
                dataKey="bbUpper"
                stroke="#888888"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                yAxisId="price"
                name="BB Upper"
              />
              <Line
                type="monotone"
                dataKey="bbMiddle"
                stroke="#666666"
                strokeWidth={1}
                dot={false}
                yAxisId="price"
                name="BB Middle"
              />
              <Line
                type="monotone"
                dataKey="bbLower"
                stroke="#888888"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                yAxisId="price"
                name="BB Lower"
              />
            </>
          )}

          {/* 거래 마커 */}
          {marketTransactions.map(tx => {
            const txDate = new Date(tx.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
            const dataPoint = chartData.find(d => d.time === txDate);
            if (dataPoint) {
              return (
                <ReferenceLine
                  key={tx.id}
                  x={txDate}
                  stroke={tx.type === 'buy' ? '#00ff00' : '#ff0000'}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{ value: tx.type === 'buy' ? '매수' : '매도', position: 'top' }}
                />
              );
            }
            return null;
          })}

          {/* 거래량 */}
          {showVolume && (
            <Bar
              dataKey="volume"
              fill="#8884d8"
              fillOpacity={0.3}
              yAxisId="volume"
              name="거래량"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* RSI 차트 */}
      {indicators.rsi && rsiData.length > 0 && (
        <ResponsiveContainer width="100%" height={150} style={{ marginTop: '20px' }}>
          <ComposedChart data={rsiData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#9b59b6"
              strokeWidth={2}
              dot={false}
              name="RSI"
            />
            <ReferenceLine y={70} stroke="#ff0000" strokeDasharray="3 3" label="과매수" />
            <ReferenceLine y={30} stroke="#00ff00" strokeDasharray="3 3" label="과매도" />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* MACD 차트 */}
      {indicators.macd && macdData.length > 0 && (
        <ResponsiveContainer width="100%" height={150} style={{ marginTop: '20px' }}>
          <ComposedChart data={macdData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="macd"
              stroke="#3498db"
              strokeWidth={2}
              dot={false}
              name="MACD"
            />
            <Line
              type="monotone"
              dataKey="signal"
              stroke="#e74c3c"
              strokeWidth={1}
              dot={false}
              name="Signal"
            />
            <Bar
              dataKey="histogram"
              fill="#95a5a6"
              name="Histogram"
            />
            <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
