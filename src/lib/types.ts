export interface Asset {
  market: string;
  quantity: number;
  avg_buy_price: number;
}

export interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  market: string;
  price: number;
  amount: number;
  timestamp: string;
  source?: string; // 'manual' or strategy ID
  isAuto?: boolean;
  strategyType?: string;
}
