'use client';

import { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';

interface CandleData {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
}

interface ChartDataPoint {
  time: string;
  [key: string]: string | number;
}

interface MultiChartComponentProps {
  markets: string[];
  comparisonMode?: 'absolute' | 'percentage';
}

const MARKET_COLORS = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#16a085'
];

export default function MultiChartComponent({ 
  markets, 
  comparisonMode = 'percentage' 
}: MultiChartComponentProps) {
  const [loading, setLoading] = useState(true);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(markets.slice(0, 5));
  const [currentComparisonMode, setCurrentComparisonMode] = useState<'absolute' | 'percentage'>(comparisonMode || 'percentage');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMarkets.length === 0) {
      setLoading(false);
      return;
    }
    const fetchAndRenderChart = async () => {
      setLoading(true);
      setError(null);
      try {
        // 각 마켓 데이터 가져오기
        const marketDataPromises = selectedMarkets.map(async (market, index) => {
          try {
            console.log(`Fetching data for ${market}...`);
            const response = await fetch(`/api/candles?market=${market}&count=90`);
            if (!response.ok) {
              console.error(`Failed to fetch ${market}: ${response.status}`);
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

            const chartData: Array<{ time: string; value: number }> = sortedData.map((d) => {
              const timestamp = new Date(d.candle_date_time_utc);
              const timeStr = timestamp.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

              let value: number;
              
              if (currentComparisonMode === 'percentage') {
                value = ((d.trade_price - firstPrice) / firstPrice) * 100;
              } else {
                value = d.trade_price;
              }
              
              return { time: timeStr, value };
            });

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
          setError('선택한 코인의 데이터를 가져올 수 없습니다.');
          setChartData([]);
          return;
        }

        // 모든 마켓의 시간을 기준으로 데이터 병합
        const allTimes = new Set<string>();
        validMarketData.forEach(({ data }) => {
          data.forEach(d => allTimes.add(d.time));
        });

        const sortedTimes = Array.from(allTimes).sort((a, b) => {
          const dateA = new Date(a);
          const dateB = new Date(b);
          return dateA.getTime() - dateB.getTime();
        });

        // 각 시간에 대해 모든 마켓의 값을 포함하는 데이터 포인트 생성
        const mergedData: ChartDataPoint[] = sortedTimes.map(time => {
          const point: ChartDataPoint = { time };
          validMarketData.forEach(({ market, data }) => {
            const marketDataPoint = data.find(d => d.time === time);
            const marketKey = market.replace('KRW-', '');
            point[marketKey] = marketDataPoint ? marketDataPoint.value : null as any;
          });
          return point;
        });

        setChartData(mergedData);
      } catch (error) {
        console.error('Failed to fetch or render multi-chart data:', error);
        setError(error instanceof Error ? error.message : '차트 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    // initial fetch
    fetchAndRenderChart();

    // 폴링 주기: 전역 REFRESH_INTERVAL을 따르되 기본값은 5000ms
    const refreshInterval = process.env.NEXT_PUBLIC_REFRESH_INTERVAL
      ? parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL, 10)
      : 5000;

    const intervalId = setInterval(() => {
      fetchAndRenderChart();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [selectedMarkets, currentComparisonMode]);

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

  const selectedMarketKeys = selectedMarkets.map(m => m.replace('KRW-', ''));

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
      
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ 
              value: currentComparisonMode === 'percentage' ? '변화율 (%)' : '가격 (KRW)', 
              angle: -90, 
              position: 'insideLeft' 
            }}
          />
          <Tooltip 
            formatter={(value: any, name: string) => {
              if (typeof value === 'number') {
                const formatted = currentComparisonMode === 'percentage' 
                  ? `${value.toFixed(2)}%` 
                  : value.toLocaleString('ko-KR');
                return [formatted, name];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `날짜: ${label}`}
          />
          <Legend />
          {selectedMarkets.map((market, index) => {
            const marketKey = market.replace('KRW-', '');
            return (
              <Line
                key={market}
                type="monotone"
                dataKey={marketKey}
                stroke={MARKET_COLORS[index % MARKET_COLORS.length]}
                strokeWidth={2}
                dot={false}
                name={marketKey}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
