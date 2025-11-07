import { NextResponse } from 'next/server';
import { resetDatabase, deleteTransactionAnalysis } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type } = body;

    if (type === 'analysis') {
      // 거래 분석 캐시만 삭제
      deleteTransactionAnalysis();
      return NextResponse.json({ 
        message: 'Transaction analysis cache has been reset',
        type: 'analysis'
      });
    } else {
      // 전체 DB 초기화
      resetDatabase();
      return NextResponse.json({ 
        message: 'Database has been reset',
        type: 'full'
      });
    }
  } catch (error) {
    console.error('Error resetting database:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to reset database', details: errorMessage },
      { status: 500 }
    );
  }
}

