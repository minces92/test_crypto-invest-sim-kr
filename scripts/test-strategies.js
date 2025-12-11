#!/usr/bin/env node

/**
 * 간단한 전략 통합 점검 스크립트
 * - /api/ai/analyze 엔드포인트를 실제 호출하여
 *   변동성 돌파/모멘텀 시나리오가 정상 응답을 반환하는지 확인합니다.
 *
 * 실행: node scripts/test-strategies.js
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runScenario(name, payload) {
  const response = await fetch(`${BASE_URL}/api/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${name} 요청 실패 (status: ${response.status})`);
  }

  const data = await response.json();

  if (!data.analysis) {
    throw new Error(`${name} 응답에 analysis 필드가 없습니다.`);
  }

  return {
    recommendation: data.analysis.recommendation,
    confidence: data.analysis.confidence,
  };
}

async function main() {
  const scenarios = [
    {
      name: '변동성 돌파 샘플',
      payload: {
        market: 'KRW-BTC',
        currentPrice: 52500000,
        change24h: 3.1,
        volatility: {
          range: 1100000,
          targetPrice: 52000000,
          isBreakout: true,
        },
        volume: {
          current: 95000000000,
          ratio: 140,
        },
      },
    },
    {
      name: '모멘텀 샘플',
      payload: {
        market: 'KRW-ETH',
        currentPrice: 3800000,
        change24h: 1.8,
        momentum: {
          priceMomentum: 6.5,
          volumeMomentum: 28,
          isStrong: true,
        },
        rsi: 62,
      },
    },
  ];

  for (const scenario of scenarios) {
    process.stdout.write(`- ${scenario.name} ... `);
    try {
      const result = await runScenario(scenario.name, scenario.payload);
      console.log(`OK (추천: ${result.recommendation}, 신뢰도: ${result.confidence ?? 'N/A'})`);
    } catch (error) {
      console.error('실패');
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

main();



