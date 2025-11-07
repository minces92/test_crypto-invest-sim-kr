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
  const [currentComparisonMode, setCurrentComparisonMode] = useState<'absolute' | 'percentage'>(comparisonMode || 'percentage');

  useEffect(() => {
    if (!chartContainerRef.current) {
      console.warn('MultiChartComponent: container not mounted yet');
      return;
    }
    
    if (selectedMarkets.length === 0) {
      console.warn('MultiChartComponent: no markets selected');
      setLoading(false);
      return;
    }

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
            console.log(`Fetching data for ${market}...`);
            const response = await fetch(`/api/candles?market=${market}&count=90`);
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to fetch ${market}:`, {
                status: response.status,
                statusText: response.statusText,
                body: errorText
              });
              return null;
            }
            const rawData: CandleData[] = await response.json();
            
            console.log(`Data received for ${market}:`, {
              count: rawData?.length,
              firstItem: rawData?.[0],
              lastItem: rawData?.[rawData.length - 1]
            });
            
            if (!rawData || rawData.length === 0) {
              console.error(`No data for ${market}`);
              return null;
            }

            // 데이터 유효성 검사
            const validData = rawData.filter(d => 
              d.candle_date_time_utc && 
              d.trade_price != null &&
              !isNaN(d.trade_price)
            );

            if (validData.length === 0) {
              console.error(`No valid data for ${market}`);
              return null;
            }

            // 시간순으로 정렬 (오래된 것부터)
            const sortedData = [...validData].sort((a, b) => 
              new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime()
            );

            // 첫 번째 가격 (가장 오래된 가격)을 기준으로 계산
            const firstPrice = sortedData[0].trade_price;

            const chartData: ChartDataPoint[] = sortedData
              .map((d) => {
                const timestamp = new Date(d.candle_date_time_utc).getTime();
                if (isNaN(timestamp)) {
                  console.warn(`Invalid timestamp for ${market}:`, d.candle_date_time_utc);
                  return null;
                }

                let value: number;
                
                if (currentComparisonMode === 'percentage') {
                  // 첫 번째 가격을 기준으로 상대변화율 계산
                  value = ((d.trade_price - firstPrice) / firstPrice) * 100;
                } else {
                  // 절대값
                  value = d.trade_price;
                }
                
                return {
                  time: (timestamp / 1000) as UTCTimestamp,
                  value,
                };
              })
              .filter((d): d is ChartDataPoint => d !== null);

            if (chartData.length === 0) {
              console.error(`No valid chart data for ${market}`);
              return null;
            }

            console.log(`Chart data prepared for ${market}:`, {
              count: chartData.length,
              firstPoint: chartData[0],
              lastPoint: chartData[chartData.length - 1]
            });

            return { market, data: chartData, color: MARKET_COLORS[index % MARKET_COLORS.length] };
          } catch (error) {
            console.error(`Failed to fetch data for ${market}:`, error);
            return null;
          }
        });

        const marketDataResults = await Promise.all(marketDataPromises);
        const validMarketData = marketDataResults.filter((d): d is NonNullable<typeof d> => d !== null);

        console.log('Valid market data:', {
          count: validMarketData.length,
          markets: validMarketData.map(m => m.market)
        });

        if (validMarketData.length === 0) {
          console.error('No valid market data to display');
          if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #f85149; padding: 20px;">
                <div style="text-align: center;">
                  <p style="font-size: 16px; margin-bottom: 10px;">차트 데이터를 불러오지 못했습니다.</p>
                  <p style="font-size: 12px; color: #8b949e;">선택한 코인의 데이터를 가져올 수 없습니다.</p>
                </div>
              </div>
            `;
          }
          return;
        }

        // 각 마켓에 대해 시리즈 추가
        validMarketData.forEach(({ market, data, color }) => {
          try {
            if (!chartRef.current) {
              console.error('Chart not initialized');
              return;
            }
            
            const series = chartRef.current.addLineSeries({
              title: market.replace('KRW-', ''),
              color,
              lineWidth: 2,
            });
            
            console.log(`Setting data for ${market}:`, {
              dataCount: data.length,
              firstValue: data[0]?.value,
              lastValue: data[data.length - 1]?.value
            });
            
            series.setData(data);
            seriesRefs.current.set(market, series);
          } catch (error) {
            console.error(`Error adding series for ${market}:`, error);
          }
        });

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
          
          // 차트 크기 업데이트
          if (chartContainerRef.current) {
            const width = chartContainerRef.current.clientWidth;
            chartRef.current.applyOptions({ width });
          }
        }

      } catch (error) {
        console.error('Failed to fetch or render multi-chart data:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('Error details:', {
          error,
          selectedMarkets,
          comparisonMode,
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // 기존 차트 정리
        if (chartRef.current) {
          try {
            chartRef.current.remove();
            chartRef.current = null;
          } catch (cleanupError) {
            console.error('Error cleaning up chart:', cleanupError);
          }
        }
        seriesRefs.current.clear();
        
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
  }, [selectedMarkets, currentComparisonMode]);

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
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="comparisonMode"
              checked={currentComparisonMode === 'percentage'}
              onChange={() => setCurrentComparisonMode('percentage')}
            />
            상대변화율 (%)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="comparisonMode"
              checked={currentComparisonMode === 'absolute'}
              onChange={() => setCurrentComparisonMode('absolute')}
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
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          차트 로딩 중...
        </div>
      )}
      
      <div ref={chartContainerRef} style={{ width: '100%', height: '400px', minHeight: '400px' }} />
    </div>
  );
}

