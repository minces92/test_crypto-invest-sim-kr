'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, SeriesMarker, Time } from 'lightweight-charts';
import { calculateSMA, calculateEMA, calculateRSI, calculateBollingerBands, calculateMACD } from '@/lib/utils';
import { usePortfolio } from '@/context/PortfolioContext';

interface CandleData {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume?: number; // 거래량
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

interface IndicatorConfig {
  sma: boolean;
  ema: boolean;
  rsi: boolean;
  macd: boolean;
  bollinger: boolean;
}

export default function ChartComponent({ market }: ChartComponentProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollingerUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollingerMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollingerLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const { transactions } = usePortfolio();
  const [loading, setLoading] = useState(true);
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
      console.warn('ChartComponent: market prop is missing');
      setLoading(false);
      return;
    }

    // 차트 컨테이너가 마운트될 때까지 대기
    if (!chartContainerRef.current) {
      console.warn('ChartComponent: container not mounted yet');
      setLoading(false);
      return;
    }

    const fetchChartData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/candles?market=${market}&count=90`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API response error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`API error: ${response.status} - ${response.statusText}`);
        }
        const rawData: CandleData[] = await response.json();
        
        console.log('Chart data received:', {
          market,
          count: rawData.length,
          firstItem: rawData[0],
          lastItem: rawData[rawData.length - 1]
        });
        
        if (!rawData || rawData.length === 0) {
          console.error('No chart data received');
          setLoading(false);
          return;
        }

        // 데이터 유효성 검사
        const validData = rawData.filter(d => 
          d.candle_date_time_utc && 
          d.opening_price != null && 
          d.high_price != null && 
          d.low_price != null && 
          d.trade_price != null
        );

        if (validData.length === 0) {
          console.error('No valid chart data after filtering');
          setLoading(false);
          return;
        }

        const chartData: ChartDataPoint[] = validData
          .map(d => {
            const timestamp = new Date(d.candle_date_time_utc).getTime();
            if (isNaN(timestamp)) {
              console.warn('Invalid timestamp:', d.candle_date_time_utc);
              return null;
            }
            return {
              time: (timestamp / 1000) as UTCTimestamp,
              open: d.opening_price,
              high: d.high_price,
              low: d.low_price,
              close: d.trade_price,
            };
          })
          .filter((d): d is ChartDataPoint => d !== null)
          .reverse(); // 시간순으로 정렬

        if (!chartContainerRef.current) {
          console.error('Chart container not found');
          setLoading(false);
          return;
        }

        if (chartData.length === 0) {
          console.error('No chart data after processing');
          setLoading(false);
          return;
        }

        // 차트가 없으면 생성
        if (!chartRef.current) {
          chartRef.current = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 400,
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
            title: 'SMA(20)',
          });
          emaSeriesRef.current = chartRef.current.addLineSeries({
            color: '#00FF00', // 녹색
            lineWidth: 2,
            title: 'EMA(12)',
            visible: false,
          });
          bollingerUpperRef.current = chartRef.current.addLineSeries({
            color: '#888888',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: 'BB Upper',
            visible: false,
          });
          bollingerMiddleRef.current = chartRef.current.addLineSeries({
            color: '#666666',
            lineWidth: 1,
            title: 'BB Middle',
            visible: false,
          });
          bollingerLowerRef.current = chartRef.current.addLineSeries({
            color: '#888888',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: 'BB Lower',
            visible: false,
          });
          // 거래량 차트 (하단 별도 스케일)
          volumeSeriesRef.current = chartRef.current.addHistogramSeries({
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: 'volume',
            scaleMargins: {
              top: 0.8,
              bottom: 0,
            },
            title: 'Volume',
          });
        }

        // 데이터 준비 (먼저 정의)
        const rawCandleData: CandleData[] = [...rawData].reverse(); // 원본 데이터 보존
        const candleDataForCalc = chartData.map(d => ({ trade_price: d.close }));

        // 캔들 데이터 설정
        if (candlestickSeriesRef.current) {
          candlestickSeriesRef.current.setData(chartData);
        } else {
          console.error('Candlestick series not initialized');
        }

        // 거래량 데이터 추가
        if (volumeSeriesRef.current && rawCandleData.length > 0) {
          // chartData와 rawCandleData를 시간으로 매칭
          const volumeData = chartData.map((d) => {
            // 시간으로 매칭하여 거래량 찾기
            const raw = rawCandleData.find(r => {
              const rawTime = (new Date(r.candle_date_time_utc).getTime() / 1000) as UTCTimestamp;
              return rawTime === d.time;
            });
            const volume = raw?.candle_acc_trade_volume || 0;
            const isUp = d.close >= d.open;
            return {
              time: d.time,
              value: volume,
              color: isUp ? 'rgba(210, 79, 69, 0.5)' : 'rgba(18, 97, 196, 0.5)', // 양봉/음봉 색상
            };
          });
          
          if (volumeData.length > 0) {
            volumeSeriesRef.current.setData(volumeData);
            volumeSeriesRef.current.applyOptions({ visible: showVolume });
          }
        }

        // SMA 계산 및 설정
        if (indicators.sma) {
          const smaPeriod = 20;
          const smaResult = calculateSMA(candleDataForCalc, smaPeriod);
          const smaChartData = smaResult.map((value, index) => ({
            time: chartData[index + smaPeriod - 1].time,
            value,
          }));
          smaSeriesRef.current?.setData(smaChartData);
          smaSeriesRef.current?.applyOptions({ visible: true });
        } else {
          smaSeriesRef.current?.applyOptions({ visible: false });
        }

        // EMA 계산 및 설정
        if (indicators.ema) {
          const emaPeriod = 12;
          const emaResult = calculateEMA(candleDataForCalc, emaPeriod);
          const emaChartData = emaResult.map((value, index) => ({
            time: chartData[index + emaPeriod - 1].time,
            value,
          }));
          emaSeriesRef.current?.setData(emaChartData);
          emaSeriesRef.current?.applyOptions({ visible: true });
        } else {
          emaSeriesRef.current?.applyOptions({ visible: false });
        }

        // 볼린저 밴드 계산 및 설정
        if (indicators.bollinger) {
          const bbPeriod = 20;
          const bbMultiplier = 2;
          const bb = calculateBollingerBands(candleDataForCalc, bbPeriod, bbMultiplier);
          
          const bbUpperData = bb.upper.map((value, index) => ({
            time: chartData[index + bbPeriod - 1].time,
            value,
          }));
          const bbMiddleData = bb.middle.map((value, index) => ({
            time: chartData[index + bbPeriod - 1].time,
            value,
          }));
          const bbLowerData = bb.lower.map((value, index) => ({
            time: chartData[index + bbPeriod - 1].time,
            value,
          }));
          
          bollingerUpperRef.current?.setData(bbUpperData);
          bollingerMiddleRef.current?.setData(bbMiddleData);
          bollingerLowerRef.current?.setData(bbLowerData);
          bollingerUpperRef.current?.applyOptions({ visible: true });
          bollingerMiddleRef.current?.applyOptions({ visible: true });
          bollingerLowerRef.current?.applyOptions({ visible: true });
        } else {
          bollingerUpperRef.current?.applyOptions({ visible: false });
          bollingerMiddleRef.current?.applyOptions({ visible: false });
          bollingerLowerRef.current?.applyOptions({ visible: false });
        }

        // 거래 내역 마커 추가
        const marketTransactions = transactions.filter(tx => tx.market === market);
        const markers: SeriesMarker<Time>[] = marketTransactions.map(tx => ({
          time: (new Date(tx.timestamp).getTime() / 1000) as UTCTimestamp,
          position: tx.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: tx.type === 'buy' ? '#00ff00' : '#ff0000',
          shape: tx.type === 'buy' ? 'arrowUp' : 'arrowDown',
          text: `${tx.type === 'buy' ? '매수' : '매도'} ${tx.amount.toFixed(4)}`,
        }));
        candlestickSeriesRef.current?.setMarkers(markers);

        // RSI 차트 렌더링
        if (indicators.rsi) {
          const rsiContainer = document.getElementById(`rsi-chart-${market}`);
          if (rsiContainer) {
            if (!rsiChartRef.current) {
              rsiChartRef.current = createChart(rsiContainer, {
                width: rsiContainer.clientWidth,
                height: 150,
                layout: {
                  background: { color: '#ffffff' },
                  textColor: '#333',
                },
                timeScale: {
                  timeVisible: true,
                  secondsVisible: false,
                },
              });
              rsiSeriesRef.current = rsiChartRef.current.addLineSeries({
                color: '#9b59b6',
                lineWidth: 2,
                title: 'RSI',
              });
            }
            
            const rsi = calculateRSI(candleDataForCalc, 14);
            if (rsi.length > 0) {
              const rsiData = rsi.map((value, index) => ({
                time: chartData[index + 15].time,
                value: Math.min(100, Math.max(0, value)), // RSI는 0-100 범위
              }));
              rsiSeriesRef.current?.setData(rsiData);
              rsiChartRef.current.timeScale().fitContent();
            }
          }
        } else {
          if (rsiChartRef.current) {
            rsiChartRef.current.remove();
            rsiChartRef.current = null;
            rsiSeriesRef.current = null;
          }
        }

        // MACD 차트 렌더링
        if (indicators.macd) {
          const macdContainer = document.getElementById(`macd-chart-${market}`);
          if (macdContainer) {
            if (!macdChartRef.current) {
              macdChartRef.current = createChart(macdContainer, {
                width: macdContainer.clientWidth,
                height: 150,
                layout: {
                  background: { color: '#ffffff' },
                  textColor: '#333',
                },
                timeScale: {
                  timeVisible: true,
                  secondsVisible: false,
                },
              });
              macdLineRef.current = macdChartRef.current.addLineSeries({
                color: '#3498db',
                lineWidth: 2,
                title: 'MACD',
              });
              macdSignalRef.current = macdChartRef.current.addLineSeries({
                color: '#e74c3c',
                lineWidth: 1,
                title: 'Signal',
              });
              macdHistogramRef.current = macdChartRef.current.addHistogramSeries({
                color: '#95a5a6',
                priceFormat: {
                  type: 'volume',
                },
                title: 'Histogram',
              });
            }
            
            const macd = calculateMACD(candleDataForCalc, 12, 26, 9);
            if (macd.macdLine.length > 0) {
              const macdOffset = chartData.length - macd.macdLine.length;
              const macdData = macd.macdLine.map((value, index) => ({
                time: chartData[macdOffset + index].time,
                value,
              }));
              const signalOffset = macd.macdLine.length - macd.signalLine.length;
              const signalData = macd.signalLine.map((value, index) => ({
                time: chartData[macdOffset + signalOffset + index].time,
                value,
              }));
              const histogramData = macd.histogram.map((value, index) => ({
                time: chartData[macdOffset + signalOffset + index].time,
                value,
                color: value >= 0 ? '#2ecc71' : '#e74c3c',
              }));
              
              macdLineRef.current?.setData(macdData);
              macdSignalRef.current?.setData(signalData);
              macdHistogramRef.current?.setData(histogramData);
              
              macdChartRef.current.timeScale().fitContent();
            }
          }
        } else {
          if (macdChartRef.current) {
            macdChartRef.current.remove();
            macdChartRef.current = null;
            macdLineRef.current = null;
            macdSignalRef.current = null;
            macdHistogramRef.current = null;
          }
        }

        // 차트 크기 조정 및 시간축 맞추기
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
          
          // 차트 크기 업데이트
          if (chartContainerRef.current) {
            const width = chartContainerRef.current.clientWidth;
            chartRef.current.applyOptions({ width });
          }
        }

      } catch (error) {
        console.error('Failed to fetch or render chart data:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('Error details:', {
          error,
          market,
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // 기존 차트 정리
        if (chartRef.current) {
          try {
            chartRef.current.remove();
            chartRef.current = null;
            candlestickSeriesRef.current = null;
          } catch (cleanupError) {
            console.error('Error cleaning up chart:', cleanupError);
          }
        }
        
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #f85149; padding: 20px;">
              <div style="text-align: center;">
                <p style="font-size: 16px; margin-bottom: 10px;">차트 데이터를 불러오지 못했습니다.</p>
                <p style="font-size: 12px; color: #8b949e; margin-bottom: 5px;">${errorMessage}</p>
                <button 
                  onclick="window.location.reload()" 
                  style="margin-top: 10px; padding: 8px 16px; background: #238636; color: white; border: none; border-radius: 4px; cursor: pointer;"
                >
                  새로고침
                </button>
              </div>
            </div>
          `;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current) {
        const width = chartContainerRef.current.clientWidth;
        chartRef.current?.applyOptions({ width });
        if (rsiChartRef.current) {
          rsiChartRef.current.applyOptions({ width });
        }
        if (macdChartRef.current) {
          macdChartRef.current.applyOptions({ width });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [market, indicators, transactions]);

  // Cleanup charts on component unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
      if (macdChartRef.current) {
        macdChartRef.current.remove();
        macdChartRef.current = null;
      }
    }
  }, []);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
            onChange={(e) => {
              setShowVolume(e.target.checked);
              volumeSeriesRef.current?.applyOptions({ visible: e.target.checked });
            }}
          />
          거래량
        </label>
      </div>
      {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>차트 로딩 중...</div>}
      <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
      {indicators.rsi && (
        <div id={`rsi-chart-${market}`} style={{ width: '100%', height: '150px', marginTop: '10px' }} />
      )}
      {indicators.macd && (
        <div id={`macd-chart-${market}`} style={{ width: '100%', height: '150px', marginTop: '10px' }} />
      )}
    </div>
  );
}