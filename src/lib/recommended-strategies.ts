import { Strategy } from '@/context/PortfolioContext';

export type RecommendedStrategy = Omit<Strategy, 'id' | 'isActive'>;

export const recommendedStrategies: RecommendedStrategy[] = [
  {
    strategyType: 'dca',
    market: 'KRW-BTC',
    amount: 50000,
    interval: 'daily',
    name: '안정적인 비트코인 적립식',
    description: '매일 5만원씩 비트코인을 꾸준히 매수하여 장기적인 자산 증식을 목표로 합니다.',
  },
  {
    strategyType: 'ma',
    market: 'KRW-ETH',
    shortPeriod: 10,
    longPeriod: 30,
    name: '이더리움 골든크로스',
    description: '단기 이동평균선이 장기 이동평균선을 상향 돌파할 때 매수하여 추세 상승장에서 수익을 얻는 전략입니다.',
  },
  {
    strategyType: 'rsi',
    market: 'KRW-SOL',
    period: 14,
    buyThreshold: 30,
    sellThreshold: 70,
    name: '솔라나 과매도/과매수',
    description: 'RSI 지표를 활용하여 과매도 구간(30 이하)에서 매수하고 과매수 구간(70 이상)에서 매도하는 단기 트레이딩 전략입니다.',
  },
  {
    strategyType: 'momentum',
    market: 'KRW-DOGE',
    period: 12,
    threshold: 5,
    name: '도지코인 변동성 돌파',
    description: '최근 가격 변동성이 커질 때 매수하여 단기적인 가격 급등을 포착하는 전략입니다. 위험성이 높습니다.',
  },
];
