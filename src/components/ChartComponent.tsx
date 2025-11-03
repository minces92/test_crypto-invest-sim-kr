'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Candle {
  candle_date_time_kst: string;
  trade_price: number;
}

interface ChartComponentProps {
  market: string;
}

export default function ChartComponent({ market }: ChartComponentProps) {
  const [data, setData] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!market) return;

    const fetchChartData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/candles?market=${market}&count=30`);
        const rawData: Candle[] = await response.json();
        // Upbit API가 최신순으로 주므로, 시간순으로 뒤집어줌
        setData(rawData.reverse());
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      }
      setLoading(false);
    };

    fetchChartData();
  }, [market]);

  if (loading) {
    return <div className="text-center p-5">차트 로딩 중...</div>;
  }

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="candle_date_time_kst" 
            tickFormatter={(timeStr) => new Date(timeStr).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit'})} 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={['dataMin', 'dataMax']} 
            tickFormatter={(price) => price.toLocaleString('ko-KR')} 
            tick={{ fontSize: 10 }} 
            orientation="right"
          />
          <Tooltip 
            formatter={(value: number) => [value.toLocaleString('ko-KR') + ' 원', '가격']}
            labelFormatter={(label) => new Date(label).toLocaleDateString('ko-KR')}
          />
          <Line type="monotone" dataKey="trade_price" stroke="#8884d8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
