'use client';

import { useState } from 'react';
import Header from "@/components/Header";
import Portfolio from "@/components/Portfolio";
import CryptoTable from "@/components/CryptoTable";
import TransactionHistory from "@/components/TransactionHistory";
import AutoTrader from "@/components/AutoTrader";
import TradeModal from '@/components/TradeModal';

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
            <CryptoTable handleOpenModal={handleOpenModal} />
            <TransactionHistory />
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
