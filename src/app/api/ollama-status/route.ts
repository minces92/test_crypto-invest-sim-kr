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

    const isAvailable = await aiClient.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { status: 'disconnected', error: 'Ollama service not available' },
        { status: 503 }
      );
    }

    // Ollama is available, now get the tags
    const response = await fetch(`${process.env.AI_BASE_URL}/api/tags`);
    if (!response.ok) {
      return NextResponse.json(
        { status: 'disconnected', error: `Failed to fetch tags: HTTP ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];

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
