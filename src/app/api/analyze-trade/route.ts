import { NextResponse } from 'next/server';
import { createAIClient } from '@/lib/ai-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transaction, marketPrice } = body;

    if (!transaction || !transaction.market || !transaction.price) {
      return NextResponse.json(
        { error: 'Invalid transaction data' },
        { status: 400 }
      );
    }

    // AI 클라이언트 생성
    const aiClient = createAIClient();
    
    if (!aiClient) {
      return NextResponse.json(
        { error: 'AI service is not available' },
        { status: 503 }
      );
    }

    // Ollama 사용 가능 여부 확인
    const isAvailable = await aiClient.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Ollama is not running. Please start Ollama service.' },
        { status: 503 }
      );
    }

    // 거래 분석 프롬프트 생성
    const transactionType = transaction.type === 'buy' ? '매수' : '매도';
    const priceDiff = transaction.price - (marketPrice || transaction.price);
    const priceDiffPercent = marketPrice 
      ? ((priceDiff / marketPrice) * 100).toFixed(2)
      : '0';

    const prompt = `
암호화폐 거래 분석 요청:

거래 정보:
- 종목: ${transaction.market}
- 거래 유형: ${transactionType}
- 거래 가격: ${transaction.price.toLocaleString('ko-KR')}원
- 거래 수량: ${transaction.amount || 'N/A'}
- 거래 시간: ${new Date(transaction.timestamp).toLocaleString('ko-KR')}
${marketPrice ? `- 시장 가격 (비교 기준): ${marketPrice.toLocaleString('ko-KR')}원` : ''}
${marketPrice ? `- 가격 차이: ${priceDiff > 0 ? '+' : ''}${priceDiffPercent}%` : ''}

위 거래 정보를 바탕으로 다음을 분석해주세요:
1. 거래 타이밍 평가 (좋은 타이밍인지, 나쁜 타이밍인지)
2. 가격 대비 평가 (고가/저가/적정가)
3. 향후 전략 제안 (추가 매수/매도 권장 여부, 보유 전략 등)
4. 리스크 평가 (해당 거래의 리스크 수준)

답변은 한국어로 간결하고 실용적으로 작성해주세요. (200자 이내)
`;

    try {
      // AI 분석 수행
      const aiResponse = await aiClient.generate(prompt, {
        model: 'mistral', // 또는 환경변수에서 가져오기
        temperature: 0.7,
        maxTokens: 300,
      });

      // 응답 정리 (불필요한 공백 제거)
      const analysis = aiResponse.trim().replace(/\n+/g, ' ').substring(0, 300);

      return NextResponse.json({ analysis });
    } catch (aiError) {
      console.error('AI analysis error:', aiError);
      
      // AI 오류 시 폴백 분석 제공
      const fallbackAnalysis = `이 ${transactionType} 거래는 ${transaction.price.toLocaleString('ko-KR')}원에 체결되었습니다. ${
        marketPrice 
          ? `현재 시장 가격 대비 ${priceDiffPercent}% ${priceDiff > 0 ? '높은' : '낮은'} 가격입니다.`
          : '시장 가격 정보가 없어 정확한 평가가 어렵습니다.'
      } 추가적인 분석을 위해서는 시장 동향과 기술적 지표를 함께 고려하는 것이 좋습니다.`;
      
      return NextResponse.json({ analysis: fallbackAnalysis });
    }
  } catch (error) {
    console.error('Error in analyze-trade API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to analyze trade', details: errorMessage },
      { status: 500 }
    );
  }
}
