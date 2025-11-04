
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const transactionsFilePath = path.join(process.cwd(), 'transactions.json');

async function getTransactions() {
  try {
    const data = await fs.readFile(transactionsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If the file doesn't exist, return an empty array
    if (error.code === 'ENOENT') {
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
