
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const strategiesFilePath = path.join(process.cwd(), 'strategies.json');

async function getStrategies() {
  try {
    const data = await fs.readFile(strategiesFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function GET() {
  try {
    const strategies = await getStrategies();
    return NextResponse.json(strategies);
  } catch (error) {
    console.error('Error reading strategies:', error);
    return NextResponse.json({ error: 'Failed to read strategies' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newStrategy = await request.json();
    const strategies = await getStrategies();
    strategies.push(newStrategy);
    await fs.writeFile(strategiesFilePath, JSON.stringify(strategies, null, 2));
    return NextResponse.json(newStrategy, { status: 201 });
  } catch (error) {
    console.error('Error writing strategy:', error);
    return NextResponse.json({ error: 'Failed to write strategy' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    const strategies = await getStrategies();
    const updatedStrategies = strategies.filter((s: any) => s.id !== id);
    await fs.writeFile(strategiesFilePath, JSON.stringify(updatedStrategies, null, 2));
    return NextResponse.json({ message: 'Strategy deleted' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting strategy:', error);
    return NextResponse.json({ error: 'Failed to delete strategy' }, { status: 500 });
  }
}
