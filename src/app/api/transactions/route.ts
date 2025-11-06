
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const transactionsFilePath = path.join(process.cwd(), 'transactions.json');

async function getTransactions() {
  try {
    const data = await fs.readFile(transactionsFilePath, 'utf-8');
    // JSON 파싱 전에 빈 문자열이나 잘못된 형식 체크
    const trimmedData = data.trim();
    if (!trimmedData || trimmedData === '') {
      return [];
    }
    // JSON 파싱 시도
    try {
      return JSON.parse(trimmedData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // 파일이 손상된 경우 백업 시도: 마지막 줄의 잘못된 대괄호 제거
      const fixedData = trimmedData.replace(/\]\s*\]\s*$/, ']');
      try {
        return JSON.parse(fixedData);
      } catch (secondError) {
        console.error('Failed to fix JSON:', secondError);
        // 완전히 손상된 경우 빈 배열 반환
        return [];
      }
    }
  } catch (error) {
    // If the file doesn't exist, return an empty array
    if ((error as any).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function GET() {
  try {
    const transactions = await getTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error reading transactions:', error);
    return NextResponse.json({ error: 'Failed to read transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newTransaction = await request.json();
    const transactions = await getTransactions();
    transactions.unshift(newTransaction); // Add to the beginning of the array
    await fs.writeFile(transactionsFilePath, JSON.stringify(transactions, null, 2));
    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error('Error writing transaction:', error);
    return NextResponse.json({ error: 'Failed to write transaction' }, { status: 500 });
  }
}
