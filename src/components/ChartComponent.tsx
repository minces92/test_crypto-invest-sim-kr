'use client';

import { useEffect, useState, useCallback } from 'react';
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

  const fetchChartData = useCallback(async (isInitialLoad = false) => {
    if (!market) {
      setLoading(false);
      return;
    }
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(`/api/candles?market=${market}&count=90&interval=${interval}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const rawData: CandleData[] = await response.json();
      
      if (!rawData || rawData.length === 0) {
        setError('차트 데이터가 없습니다.');
        setChartData([]);
        return;
      }

      const validData = rawData
        .filter(d => d && d.candle_date_time_utc && d.trade_price != null)
        .sort((a, b) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime());

      if (validData.length === 0) {
        setError('유효한 차트 데이터가 없습니다.');
        setChartData([]);
        return;
      }

      const formatTime = (utc: string) => {
        const date = new Date(utc);
        if (interval === 'day') {
          return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
        return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      };

      const baseChartData: ChartDataPoint[] = validData.map(d => ({
        time: formatTime(d.candle_date_time_utc),
        open: d.opening_price,
        high: d.high_price,
        low: d.low_price,
        close: d.trade_price,
        volume: d.candle_acc_trade_volume || 0,
      }));

      const priceData = baseChartData.map(d => ({ trade_price: d.close }));

      if (indicators.sma) {
        const smaPeriod = 20;
        const smaValues = calculateSMA(priceData, smaPeriod);
        baseChartData.forEach((d, i) => {
          if (i >= smaPeriod - 1) d.sma = smaValues[i - smaPeriod + 1];
        });
      }
      if (indicators.ema) {
        const emaPeriod = 12;
        const emaValues = calculateEMA(priceData, emaPeriod);
        baseChartData.forEach((d, i) => {
          if (i >= emaPeriod - 1) d.ema = emaValues[i - emaPeriod + 1];
        });
      }
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
      if (indicators.rsi) {
        const rsiPeriod = 14;
        const rsiValues = calculateRSI(priceData, rsiPeriod);
        setRsiData(baseChartData.slice(rsiPeriod).map((d, i) => ({
          time: d.time,
          rsi: Math.min(100, Math.max(0, rsiValues[i])),
        })));
      } else {
        setRsiData([]);
      }
      if (indicators.macd) {
        const macdResult = calculateMACD(priceData, 12, 26, 9);
        setMacdData(baseChartData.slice(26 + 9 - 1).map((d, i) => ({
          time: d.time,
          macd: macdResult.macdLine[i] || 0,
          signal: macdResult.signalLine[i] || 0,
          histogram: macdResult.histogram[i] || 0,
        })));
      } else {
        setMacdData([]);
      }

      setChartData(baseChartData);
    } catch (error) {
      console.error('Failed to fetch or render chart data:', error);
      setError(error instanceof Error ? error.message : '차트 데이터를 불러오지 못했습니다.');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, [market, interval, indicators]);

  // Initial data fetch and manual changes
  useEffect(() => {
    fetchChartData(true);
  }, [fetchChartData]);

  // Periodic refresh
  useEffect(() => {
    const refreshInterval = process.env.NEXT_PUBLIC_REFRESH_INTERVAL
      ? parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL, 10)
      : 5000;
    
    const intervalId = setInterval(() => {
      fetchChartData(false); // Subsequent fetches are not initial loads
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchChartData]);

  const marketTransactions = transactions.filter(tx => tx.market === market);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>차트 로딩 중...</div>;
  }

  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#f85149' }}><p>{error}</p></div>;
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
            <button key={btn.value} onClick={() => setInterval(btn.value)} className={`btn btn-sm ${interval === btn.value ? 'btn-primary' : ''}`}>
              {btn.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Indicator checkboxes */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.sma} onChange={(e) => setIndicators({ ...indicators, sma: e.target.checked })} /> SMA(20)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.ema} onChange={(e) => setIndicators({ ...indicators, ema: e.target.checked })} /> EMA(12)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.bollinger} onChange={(e) => setIndicators({ ...indicators, bollinger: e.target.checked })} /> 볼린저밴드
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.rsi} onChange={(e) => setIndicators({ ...indicators, rsi: e.target.checked })} /> RSI
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.macd} onChange={(e) => setIndicators({ ...indicators, macd: e.target.checked })} /> MACD
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} /> 거래량
          </label>
        </div>
      </div>

      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={indicators.rsi || indicators.macd ? 300 : 400}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="price" orientation="left" domain={['auto', 'auto']} tick={{ fontSize: 11 }} tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} />
          {showVolume && <YAxis yAxisId="volume" orientation="right" domain={[0, 'auto']} tick={{ fontSize: 11 }} tickFormatter={(value) => typeof value === 'number' ? (value / 1000000).toFixed(1) + 'M' : value} />}
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', border: '1px solid #555', fontSize: '12px' }}
            formatter={(value: any) => typeof value === 'number' ? value.toLocaleString('ko-KR') : value}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          
          <Line type="monotone" dataKey="close" stroke="#8884d8" strokeWidth={2} dot={false} yAxisId="price" name="종가" />
          {indicators.sma && <Line type="monotone" dataKey="sma" stroke="#ffc658" strokeWidth={1.5} dot={false} yAxisId="price" name="SMA" />}
          {indicators.ema && <Line type="monotone" dataKey="ema" stroke="#82ca9d" strokeWidth={1.5} dot={false} yAxisId="price" name="EMA" />}
          {indicators.bollinger && <Line type="monotone" dataKey="bbUpper" stroke="#ccc" strokeWidth={1} strokeDasharray="3 3" dot={false} yAxisId="price" name="BB상단" />}
          {indicators.bollinger && <Line type="monotone" dataKey="bbLower" stroke="#ccc" strokeWidth={1} strokeDasharray="3 3" dot={false} yAxisId="price" name="BB하단" />}
          
          {marketTransactions.map(tx => {
            const txDate = interval === 'day' 
              ? new Date(tx.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
              : new Date(tx.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const dataPoint = chartData.find(d => d.time === txDate);
            if (dataPoint) {
              return <ReferenceLine key={tx.id} x={txDate} stroke={tx.type === 'buy' ? 'limegreen' : 'red'} label={{ value: tx.type === 'buy' ? 'B' : 'S', fill: tx.type === 'buy' ? 'limegreen' : 'red', fontSize: 12, position: 'top' }} />;
            }
            return null;
          })}

          {showVolume && <Bar dataKey="volume" fill="rgba(136, 132, 216, 0.4)" yAxisId="volume" name="거래량" />}
        </ComposedChart>
      </ResponsiveContainer>

      {/* RSI Chart */}
      {indicators.rsi && rsiData.length > 0 && (
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={rsiData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', border: '1px solid #555', fontSize: '12px' }} />
            <Line type="monotone" dataKey="rsi" stroke="#9b59b6" strokeWidth={1.5} dot={false} name="RSI" />
            <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="limegreen" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* MACD Chart */}
      {indicators.macd && macdData.length > 0 && (
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={macdData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.8)', border: '1px solid #555', fontSize: '12px' }} />
            <Line type="monotone" dataKey="macd" stroke="#3498db" strokeWidth={1.5} dot={false} name="MACD" />
            <Line type="monotone" dataKey="signal" stroke="#e74c3c" strokeWidth={1} dot={false} name="Signal" />
            <Bar dataKey="histogram" fill={(data) => data.histogram > 0 ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)'} name="Histogram" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
