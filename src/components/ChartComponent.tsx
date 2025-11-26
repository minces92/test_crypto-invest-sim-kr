'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { calculateSMA, calculateEMA, calculateBollingerBands } from '@/lib/utils';
import { usePortfolio } from '@/context/PortfolioContext';
import { useMarketData } from '@/hooks/useMarketData';

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

interface IndicatorConfig {
  sma: boolean;
  ema: boolean;
  bollinger: boolean;
}

export default function ChartComponent({ market }: ChartComponentProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const { transactions } = usePortfolio();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartInterval, setChartInterval] = useState('day'); // 'day', 'minute240', 'minute60', 'minute30'
  const [indicators, setIndicators] = useState<IndicatorConfig>({
    sma: true,
    ema: false,
    bollinger: false,
  });
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('dark');

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: chartTheme === 'dark' ? '#0d1117' : '#ffffff' },
        textColor: chartTheme === 'dark' ? '#c9d1d9' : '#24292f',
      },
      grid: {
        vertLines: { color: chartTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' },
        horzLines: { color: chartTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    console.log('[ChartComponent] Series created:', candleSeries);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartTheme]);

  // Fetch Data using SWR
  const { candles, isLoading, isError, mutate } = useMarketData(market, chartInterval, 200);

  useEffect(() => {
    if (isLoading) {
      setLoading(true);
      setError(null);
    } else if (isError) {
      setLoading(false);
      setError('데이터 로드 실패');
    } else if (candles && candles.length > 0) {
      setLoading(false);
      setError(null);

      try {
        if (!chartRef.current || !candleSeriesRef.current) return;

        const validData = candles
        .filter((d: any) => d && d.candle_date_time_utc && d.trade_price != null)
        .sort((a: any, b: any) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime())
        .map((d: any) => ({
          time: (new Date(d.candle_date_time_utc).getTime() / 1000) as Time,
          open: d.opening_price,
          high: d.high_price,
          low: d.low_price,
          close: d.trade_price,
        }));

      candleSeriesRef.current.setData(validData);

      // Indicators
  const priceData = validData.map((d: any) => ({ trade_price: d.close }));

      // SMA
      if (indicators.sma) {
        if (!smaSeriesRef.current) {
          smaSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#ffc658', lineWidth: 2, title: 'SMA(20)' });
        }
        const smaValues = calculateSMA(priceData, 20);
        const smaData = validData.map((d: any, i: number) => ({
          time: d.time,
          value: smaValues[i] || NaN,
        })).filter((d: any) => !isNaN(d.value));
        smaSeriesRef.current.setData(smaData);
      } else if (smaSeriesRef.current) {
        chartRef.current.removeSeries(smaSeriesRef.current);
        smaSeriesRef.current = null;
      }

      // EMA
      if (indicators.ema) {
        if (!emaSeriesRef.current) {
          emaSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#82ca9d', lineWidth: 2, title: 'EMA(12)' });
        }
        const emaValues = calculateEMA(priceData, 12);
        const emaData = validData.map((d: any, i: number) => ({
          time: d.time,
          value: emaValues[i] || NaN,
        })).filter((d: any) => !isNaN(d.value));
        emaSeriesRef.current.setData(emaData);
      } else if (emaSeriesRef.current) {
        chartRef.current.removeSeries(emaSeriesRef.current);
        emaSeriesRef.current = null;
      }

      // Bollinger Bands
      if (indicators.bollinger) {
        if (!bbUpperSeriesRef.current || !bbLowerSeriesRef.current) {
          // Ensure both are created if missing
          if (bbUpperSeriesRef.current) chartRef.current.removeSeries(bbUpperSeriesRef.current);
          if (bbLowerSeriesRef.current) chartRef.current.removeSeries(bbLowerSeriesRef.current);

          bbUpperSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#ccc', lineWidth: 1, lineStyle: 2, title: 'BB Upper' });
          bbLowerSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#ccc', lineWidth: 1, lineStyle: 2, title: 'BB Lower' });
        }
        const bb = calculateBollingerBands(priceData, 20, 2);
  const bbUpperData = validData.map((d: any, i: number) => ({ time: d.time, value: bb.upper[i] || NaN })).filter((d: any) => !isNaN(d.value));
  const bbLowerData = validData.map((d: any, i: number) => ({ time: d.time, value: bb.lower[i] || NaN })).filter((d: any) => !isNaN(d.value));

        bbUpperSeriesRef.current.setData(bbUpperData);
        bbLowerSeriesRef.current.setData(bbLowerData);
      } else {
        if (bbUpperSeriesRef.current) {
          chartRef.current.removeSeries(bbUpperSeriesRef.current);
          bbUpperSeriesRef.current = null;
        }
        if (bbLowerSeriesRef.current) {
          chartRef.current.removeSeries(bbLowerSeriesRef.current);
          bbLowerSeriesRef.current = null;
        }
      }

        // Markers (Transactions)
      const markers = transactions
        .filter(tx => tx.market === market)
        .map(tx => ({
          time: (new Date(tx.timestamp).getTime() / 1000) as Time,
          position: tx.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: tx.type === 'buy' ? '#2ecc71' : '#e74c3c',
          shape: tx.type === 'buy' ? 'arrowUp' : 'arrowDown',
          text: tx.type === 'buy' ? '매수' : '매도',
        }));
        // @ts-ignore
        if (typeof candleSeriesRef.current.setMarkers === 'function') {
        // @ts-ignore
        candleSeriesRef.current.setMarkers(markers);
        } else {
          console.error('setMarkers is not a function on candleSeriesRef.current', candleSeriesRef.current);
        }
      } catch (err) {
        console.error('Chart update failed:', err);
        setError('차트를 업데이트하는 동안 오류가 발생했습니다.');
      }
    }
  }, [candles, isLoading, isError, indicators, transactions, market]);

  const fetchChartData = (refresh: boolean) => {
    if (refresh) mutate();
  };

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
            <button key={btn.value} onClick={() => setChartInterval(btn.value)} className={`btn btn-sm ${chartInterval === btn.value ? 'btn-primary' : ''}`}>
              {btn.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.sma} onChange={(e) => setIndicators({ ...indicators, sma: e.target.checked })} /> SMA(20)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.ema} onChange={(e) => setIndicators({ ...indicators, ema: e.target.checked })} /> EMA(12)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input type="checkbox" checked={indicators.bollinger} onChange={(e) => setIndicators({ ...indicators, bollinger: e.target.checked })} /> 볼린저밴드
          </label>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const nextTheme = chartTheme === 'dark' ? 'light' : 'dark';
              setChartTheme(nextTheme);
            }}
          >
            {chartTheme === 'dark' ? '라이트 모드' : '다크 모드'}
          </button>
        </div>
      </div>

      <div ref={chartContainerRef} style={{ width: '100%', height: '400px', position: 'relative' }}>
        {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>로딩 중...</div>}
        {error && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: chartTheme === 'dark' ? 'rgba(13, 17, 23, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            zIndex: 20,
            color: '#cf222e'
          }}>
            <div style={{ textAlign: 'center' }}>
              <p className="mb-2">⚠️ {error}</p>
              <button className="btn btn-sm" onClick={() => fetchChartData(true)}>다시 시도</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
