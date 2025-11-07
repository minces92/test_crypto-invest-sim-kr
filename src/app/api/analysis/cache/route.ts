import { NextResponse } from 'next/server';
import { getAllTransactionAnalyses } from '@/lib/cache';

export async function GET() {
  try {
    const analyses = getAllTransactionAnalyses();
    return NextResponse.json({ analyses });
  } catch (error) {
    console.error('Error fetching analysis cache:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch analysis cache', details: errorMessage },
      { status: 500 }
    );
  }
}

