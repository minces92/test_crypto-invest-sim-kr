'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

interface CandleData {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
}

interface ChartDataPoint {
  time: UTCTimestamp;
  value: number;
}

interface MultiChartComponentProps {
  markets: string[];
  comparisonMode?: 'absolute' | 'percentage'; // 절대값 vs 상대변화율
}

const MARKET_COLORS = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#16a085'
];

export default function MultiChartComponent({ 
  markets, 
  comparisonMode = 'percentage' 
}: MultiChartComponentProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  const [loading, setLoading] = useState(true);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(markets.slice(0, 5)); // 최대 5개

  useEffect(() => {
    if (!chartContainerRef.current || selectedMarkets.length === 0) return;

    const fetchAndRenderChart = async () => {
      setLoading(true);
      try {
        // 차트 초기화
        if (!chartRef.current) {
          chartRef.current = createChart(chartContainerRef.current!, {
            width: chartContainerRef.current!.clientWidth,
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
        }

        // 기존 시리즈 제거
        seriesRefs.current.forEach(series => {
          chartRef.current?.removeSeries(series);
        });
        seriesRefs.current.clear();

        // 각 마켓 데이터 가져오기
        const marketDataPromises = selectedMarkets.map(async (market, index) => {
          try {
            const response = await fetch(`/api/candles?market=${market}&count=90`);
            const rawData: CandleData[] = await response.json();
            
            if (rawData.length === 0) return null;

            const chartData: ChartDataPoint[] = rawData
              .reverse()
              .map((d, i) => {
                let value: number;
                
                if (comparisonMode === 'percentage') {
                  // 첫 번째 가격을 기준으로 상대변화율 계산
                  const firstPrice = rawData[rawData.length - 1].trade_price;
                  value = ((d.trade_price - firstPrice) / firstPrice) * 100;
                } else {
                  // 절대값
                  value = d.trade_price;
                }
                
                return {
                  time: (new Date(d.candle_date_time_utc).getTime() / 1000) as UTCTimestamp,
                  value,
                };
              });

            return { market, data: chartData, color: MARKET_COLORS[index % MARKET_COLORS.length] };
          } catch (error) {
            console.error(`Failed to fetch data for ${market}:`, error);
            return null;
          }
        });

        const marketDataResults = await Promise.all(marketDataPromises);
        const validMarketData = marketDataResults.filter((d): d is NonNullable<typeof d> => d !== null);

        // 각 마켓에 대해 시리즈 추가
        validMarketData.forEach(({ market, data, color }) => {
          const series = chartRef.current!.addLineSeries({
            title: market.replace('KRW-', ''),
            color,
            lineWidth: 2,
          });
          series.setData(data);
          seriesRefs.current.set(market, series);
        });

        chartRef.current.timeScale().fitContent();

      } catch (error) {
        console.error('Failed to fetch or render multi-chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndRenderChart();

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedMarkets, comparisonMode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRefs.current.clear();
    };
  }, []);

  const availableMarkets = [
    'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA', 
    'KRW-AVAX', 'KRW-DOT', 'KRW-MATIC', 'KRW-TRX', 'KRW-SHIB', 'KRW-ETC', 
    'KRW-BCH', 'KRW-LINK'
  ];

  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev => {
      if (prev.includes(market)) {
        return prev.filter(m => m !== market);
      } else if (prev.length < 5) {
        return [...prev, market];
      } else {
        alert('최대 5개의 코인만 비교할 수 있습니다.');
        return prev;
      }
    });
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>비교 모드:</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="radio"
              name="comparisonMode"
              checked={comparisonMode === 'percentage'}
              onChange={() => {}}
              disabled
            />
            상대변화율 (%)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="radio"
              name="comparisonMode"
              checked={comparisonMode === 'absolute'}
              onChange={() => {}}
              disabled
            />
            절대값
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', marginRight: '5px' }}>코인 선택:</span>
          {availableMarkets.map(market => (
            <label
              key={market}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                padding: '2px 8px',
                border: selectedMarkets.includes(market) ? '2px solid #3498db' : '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: selectedMarkets.includes(market) ? '#ebf5fb' : '#fff',
              }}
            >
              <input
                type="checkbox"
                checked={selectedMarkets.includes(market)}
                onChange={() => toggleMarket(market)}
                style={{ cursor: 'pointer' }}
              />
              {market.replace('KRW-', '')}
            </label>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          차트 로딩 중...
        </div>
      )}
      
      <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
}

