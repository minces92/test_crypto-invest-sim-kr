import { NextResponse } from 'next/server';
import { createAIClient, createPriceAnalysisPrompt, parseAIResponse } from '@/lib/ai-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      market,
      currentPrice,
      change24h,
      rsi,
      macd,
      bollinger,
      ma,
      volatility,
      momentum,
      sentiment,
      volume,
    } = body;

    if (!market || typeof currentPrice !== 'number' || typeof change24h !== 'number') {
      return NextResponse.json(
        { error: 'market, currentPrice, change24h are required' },
        { status: 400 }
      );
    }

    // AI 클라이언트 생성
    const aiClient = createAIClient();
    if (!aiClient) {
      return NextResponse.json(
        { error: 'AI client is not available. Please ensure Ollama is running.' },
        { status: 503 }
      );
    }

    // AI 가용성 확인
    const isAvailable = await aiClient.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'AI service is not available. Please check Ollama connection.' },
        { status: 503 }
      );
    }

    // 프롬프트 생성
    const prompt = createPriceAnalysisPrompt({
      market,
      currentPrice,
      change24h,
      rsi,
      macd,
      bollinger,
      ma,
      volatility,
      momentum,
      sentiment,
      volume,
    });

    // AI 분석 수행
    const response = await aiClient.generate(prompt, {
      model: process.env.AI_MODEL_ANALYSIS || 'mistral',
      temperature: 0.7,
      maxTokens: 512,
    });

    // 응답 파싱
    const analysis = parseAIResponse(response);

    return NextResponse.json({
      analysis,
      rawResponse: response,
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to perform AI analysis.', details: errorMessage },
      { status: 500 }
    );
  }
}

