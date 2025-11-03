'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

// 보유 자산의 타입 정의
interface Asset {
  market: string;
  quantity: number;
  avg_buy_price: number;
}

// Context가 제공할 값들의 타입 정의
interface PortfolioContextType {
  cash: number;
  assets: Asset[];
  buyAsset: (market: string, price: number, amount: number) => boolean;
  sellAsset: (market: string, price: number, amount: number) => boolean;
}

// Context 생성
const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Context를 제공하는 Provider 컴포넌트
export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const [cash, setCash] = useState(10000000); // 초기 자본 1,000만원
  const [assets, setAssets] = useState<Asset[]>([]);

  const buyAsset = (market: string, price: number, amount: number): boolean => {
    const cost = price * amount;
    if (cash < cost) {
      alert('현금이 부족합니다.');
      return false;
    }

    setCash(cash - cost);
    const existingAssetIndex = assets.findIndex(a => a.market === market);

    if (existingAssetIndex > -1) {
      // 이미 보유한 자산인 경우
      const existingAsset = assets[existingAssetIndex];
      const totalQuantity = existingAsset.quantity + amount;
      const totalCost = (existingAsset.avg_buy_price * existingAsset.quantity) + cost;
      const newAvgBuyPrice = totalCost / totalQuantity;

      const updatedAssets = [...assets];
      updatedAssets[existingAssetIndex] = { ...existingAsset, quantity: totalQuantity, avg_buy_price: newAvgBuyPrice };
      setAssets(updatedAssets);
    } else {
      // 신규 자산인 경우
      setAssets([...assets, { market, quantity: amount, avg_buy_price: price }]);
    }
    return true;
  };

  const sellAsset = (market: string, price: number, amount: number): boolean => {
    const existingAsset = assets.find(a => a.market === market);
    if (!existingAsset || existingAsset.quantity < amount) {
      alert('보유 수량이 부족합니다.');
      return false;
    }

    const income = price * amount;
    setCash(cash + income);

    const remainingQuantity = existingAsset.quantity - amount;
    if (remainingQuantity > 0) {
      const updatedAssets = assets.map(a => 
        a.market === market ? { ...a, quantity: remainingQuantity } : a
      );
      setAssets(updatedAssets);
    } else {
      // 전량 매도한 경우
      setAssets(assets.filter(a => a.market !== market));
    }
    return true;
  };

  return (
    <PortfolioContext.Provider value={{ cash, assets, buyAsset, sellAsset }}>
      {children}
    </PortfolioContext.Provider>
  );
};

// Context를 쉽게 사용하기 위한 커스텀 훅
export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
