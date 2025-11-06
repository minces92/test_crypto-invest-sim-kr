'use client';

import { useState } from 'react';
import Header from "@/components/Header";
import Portfolio from "@/components/Portfolio";
import CryptoTable from "@/components/CryptoTable";
import TransactionHistory from "@/components/TransactionHistory";
import NewsFeed from "@/components/NewsFeed";
import AutoTrader from "@/components/AutoTrader";
import TradeModal from '@/components/TradeModal';
import MultiChartComponent from '@/components/MultiChartComponent';

interface Ticker {
  market: string;
  trade_price: number;
}

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const [orderType, setOrderType] = useState('buy');

  const handleOpenModal = (ticker: Ticker, type: 'buy' | 'sell') => {
    setSelectedTicker(ticker);
    setOrderType(type);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setSelectedTicker(null);
    setShowModal(false);
  };

  return (
    <>
      <Header />
      <div className="container-lg p-responsive py-4">
        <div className="d-flex flex-wrap gutter-spacious">
          <div className="col-12 col-lg-12 mb-4">
            <div className="Box mt-4 border">
              <div className="Box-header">
                <h2 className="Box-title">코인 비교 차트</h2>
              </div>
              <div className="Box-body">
                <MultiChartComponent markets={['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-ADA']} />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-12 mb-4">
            <CryptoTable handleOpenModal={handleOpenModal} />
            <TransactionHistory />
            <NewsFeed />
          </div>
          <div className="col-12 col-lg-12 mb-4">
            <Portfolio handleOpenModal={handleOpenModal} />
            <AutoTrader />
          </div>
        </div>
      </div>
      <TradeModal 
        show={showModal} 
        handleClose={handleCloseModal} 
        ticker={selectedTicker} 
        initialOrderType={orderType}
      />
    </>
  );
}
