import { NextResponse } from 'next/server';
import { createAIClient, createPriceAnalysisPrompt, parseAIResponse } from '@/lib/ai-client';
import { handleApiError, AppError } from '@/lib/error-handler';
import { measureExecutionTime } from '@/lib/monitoring';

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
      throw new AppError('INVALID_INPUT', 'market, currentPrice, change24h are required', 400);
    }

    // AI 클라이언트 생성
    const aiClient = createAIClient();
    if (!aiClient) {
      throw new AppError('AI_CLIENT_UNAVAILABLE', 'AI client is not available. Please ensure Ollama is running.', 503);
    }

    // AI 가용성 확인
    const isAvailable = await aiClient.isAvailable();
    if (!isAvailable) {
      throw new AppError('AI_SERVICE_UNAVAILABLE', 'AI service is not available. Please check Ollama connection.', 503);
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
    const response = await measureExecutionTime('ai_analysis_generation', () => aiClient.generate(prompt, {
      model: process.env.AI_MODEL_ANALYSIS || 'mistral',
      temperature: 0.7,
      maxTokens: 512,
    }));

    // 응답 파싱
    const analysis = parseAIResponse(response);

    return NextResponse.json({
      analysis,
      rawResponse: response,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

