import { NextResponse } from 'next/server';
import { getTransactions, saveTransaction } from '@/lib/cache';

export async function GET() {
  try {
    const transactions = getTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error reading transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to read transactions', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 요청 본문 읽기
    const body = await request.text();
    
    // 빈 본문 체크
    if (!body || body.trim() === '') {
      console.error('Empty request body');
      return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
    }

    // JSON 파싱 시도
    let newTransaction;
    try {
      newTransaction = JSON.parse(body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Request body:', body);
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // 필수 필드 검증
    if (!newTransaction || typeof newTransaction !== 'object') {
      return NextResponse.json({ error: 'Invalid transaction data' }, { status: 400 });
    }

    if (!newTransaction.id || !newTransaction.type || !newTransaction.market || 
        newTransaction.price == null || newTransaction.amount == null || !newTransaction.timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // DB에 저장
    saveTransaction({
      id: newTransaction.id,
      type: newTransaction.type,
      market: newTransaction.market,
      price: newTransaction.price,
      amount: newTransaction.amount,
      timestamp: newTransaction.timestamp,
      source: newTransaction.source,
      isAuto: newTransaction.isAuto,
      strategyType: newTransaction.strategyType,
    });

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error('Error writing transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to write transaction', details: errorMessage },
      { status: 500 }
    );
  }
}
