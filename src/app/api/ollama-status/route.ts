import { NextResponse } from 'next/server';
import { createAIClient } from '@/lib/ai-client';

export async function GET() {
  try {
    const aiClient = createAIClient();
    if (!aiClient) {
      return NextResponse.json(
        { status: 'disconnected', error: 'AI client not configured' },
        { status: 503 }
      );
    }

    const models = await aiClient.getTags();

    if (models === null) {
      return NextResponse.json(
        { status: 'disconnected', error: 'Ollama service not available' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'connected',
      models: models,
    });

  } catch (error) {
    console.error('Ollama status check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { status: 'disconnected', error: 'Failed to check Ollama status.', details: errorMessage },
      { status: 500 }
    );
  }
}
