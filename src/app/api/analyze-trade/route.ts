
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { transaction, marketPrice } = body;

  // TODO: Implement actual LLM analysis here
  // This is a placeholder response.
  
  const analysis = `이 ${transaction.type === 'buy' ? '매수' : '매도'} 결정은 ${transaction.price > marketPrice ? '고가' : '저가'}에 이루어졌습니다. 시장 상황을 고려할 때, 추가적인 분할 ${transaction.type === 'buy' ? '매수' : '매도'} 또는 관망이 필요해 보입니다.`;

  return NextResponse.json({ analysis });
}
