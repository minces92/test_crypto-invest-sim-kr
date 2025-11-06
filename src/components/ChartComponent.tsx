'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { calculateSMA } from '@/lib/utils';

interface CandleData {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
}

interface ChartComponentProps {
  market: string;
}

// lightweight-charts가 요구하는 데이터 형식
interface ChartDataPoint {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function ChartComponent({ market }: ChartComponentProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!market) return;

    const fetchChartData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/candles?market=${market}&count=90`);
        const rawData: CandleData[] = await response.json();
        const chartData: ChartDataPoint[] = rawData
          .map(d => ({
            time: (new Date(d.candle_date_time_utc).getTime() / 1000) as UTCTimestamp,
            open: d.opening_price,
            high: d.high_price,
            low: d.low_price,
            close: d.trade_price,
          }))
          .reverse(); // 시간순으로 정렬

        if (!chartContainerRef.current) return;

        // 차트가 없으면 생성
        if (!chartRef.current) {
          chartRef.current = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 300,
            layout: {
              background: { color: '#ffffff' },
              textColor: '#333',
            },
            grid: {
              vertLines: { color: '#f0f0f0' },
              horzLines: { color: '#f0f0f0' },
            },
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
            },
          });
          candlestickSeriesRef.current = chartRef.current.addCandlestickSeries({
            upColor: '#D24F45', // 양봉
            downColor: '#1261C4', // 음봉
            borderVisible: false,
            wickUpColor: '#D24F45',
            wickDownColor: '#1261C4',
          });
          smaSeriesRef.current = chartRef.current.addLineSeries({
            color: '#FFA500', // 주황색
            lineWidth: 2,
          });
        }

        candlestickSeriesRef.current?.setData(chartData);

        // SMA 계산 및 설정
        const smaPeriod = 20;
        const smaDataForCalc = chartData.map(d => ({ trade_price: d.close }));
        const smaResult = calculateSMA(smaDataForCalc, smaPeriod);
        const smaChartData = smaResult.map((value, index) => ({
          time: chartData[index + smaPeriod - 1].time,
          value,
        }));
        smaSeriesRef.current?.setData(smaChartData);

        chartRef.current.timeScale().fitContent();

      } catch (error) {
        console.error('Failed to fetch or render chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();

    // Resize observer
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current?.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      // Do not remove the chart here to persist it between modal opens
    };
  }, [market]);

  // Cleanup chart on component unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '300px', position: 'relative' }}>
      {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>차트 로딩 중...</div>}
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}