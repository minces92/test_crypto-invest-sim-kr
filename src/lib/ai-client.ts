/**
 * AI 클라이언트 인터페이스 및 구현
 * Ollama, llama.cpp, KoboldCpp 등 다양한 백엔드를 지원
 */

export interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface AIClient {
  generate(prompt: string, options?: AIGenerationOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}

/**
 * Ollama 클라이언트
 */
export class OllamaClient implements AIClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3초 타임아웃
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async generate(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<string> {
    const {
      model = 'mistral',
      temperature = 0.7,
      maxTokens = 512,
      topP = 0.9,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
            top_p: topP,
          },
        }),
        signal: AbortSignal.timeout(30000), // 30초 타임아웃
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw error;
    }
  }
}

/**
 * AI 클라이언트 팩토리
 */
export function createAIClient(): AIClient | null {
  const backend = process.env.AI_BACKEND || 'ollama';
  const baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434';

  switch (backend.toLowerCase()) {
    case 'ollama':
      return new OllamaClient(baseUrl);
    // 향후 다른 백엔드 추가 가능
    // case 'llamacpp':
    //   return new LlamaCppClient();
    // case 'koboldcpp':
    //   return new KoboldCppClient();
    default:
      console.warn(`Unknown AI backend: ${backend}, falling back to Ollama`);
      return new OllamaClient(baseUrl);
  }
}

/**
 * AI 분석 결과 파싱 (JSON 형식)
 */
export function parseAIResponse(response: string): any {
  try {
    // JSON 코드 블록이 있는 경우 추출
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                      response.match(/```\n([\s\S]*?)\n```/) ||
                      response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
    
    // JSON 객체가 직접 있는 경우
    return JSON.parse(response);
  } catch (error) {
    console.warn('Failed to parse AI response as JSON:', error);
    return { raw: response };
  }
}

/**
 * 시세 분석 프롬프트 생성
 */
export function createPriceAnalysisPrompt(
  market: string,
  currentPrice: number,
  change24h: number,
  rsi?: number,
  macd?: { signal: string },
  bollinger?: { position: string },
  ma?: { short: number; long: number; cross?: string }
): string {
  return `
코인 시세 분석 요청:

코인: ${market}
현재가: ${currentPrice.toLocaleString()}원
24h 변동률: ${change24h.toFixed(2)}%
${rsi !== undefined ? `RSI: ${rsi.toFixed(2)}` : ''}
${macd ? `MACD: ${macd.signal}` : ''}
${bollinger ? `볼린저 밴드: ${bollinger.position}` : ''}
${ma ? `이동평균선: 단기 ${ma.short}, 장기 ${ma.long}${ma.cross ? ` (${ma.cross})` : ''}` : ''}

위 정보를 기반으로 다음을 분석해주세요:
1. 현재 추세 (상승/하락/횡보)
2. 추세 강도 (1-10)
3. 매매 추천 (매수/매도/보유)
4. 신뢰도 (0-1)
5. 주요 지지선/저항선

답변은 반드시 다음 JSON 형식으로 해주세요:
{
  "trend": "상승|하락|횡보",
  "strength": 1-10,
  "recommendation": "매수|매도|보유",
  "confidence": 0-1,
  "key_levels": {
    "support": 가격,
    "resistance": 가격
  },
  "reasoning": "분석 이유"
}
`;
}

/**
 * 전략 추천 프롬프트 생성
 */
export function createStrategyRecommendationPrompt(
  cash: number,
  assets: Array<{ market: string; quantity: number }>,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate',
  marketPhase: 'bull' | 'bear' | 'sideways' = 'sideways'
): string {
  return `
전략 추천 요청:

사용자 프로필:
- 보유 현금: ${cash.toLocaleString()}원
- 보유 코인: ${assets.map(a => `${a.market}: ${a.quantity}`).join(', ')}
- 리스크 선호도: ${riskTolerance === 'conservative' ? '보수적' : riskTolerance === 'aggressive' ? '공격적' : '중립'}
- 현재 시장 국면: ${marketPhase === 'bull' ? '상승장' : marketPhase === 'bear' ? '하락장' : '횡보장'}

사용 가능한 전략:
1. DCA (적립식)
2. 이동평균선 교차
3. RSI
4. 볼린저 밴드
5. 뉴스 기반
6. 변동성 돌파
7. 모멘텀

위 조건에 맞는 최적의 전략을 1-3개 추천하고, 각 전략의 파라미터를 제안해주세요.

답변은 반드시 다음 JSON 형식으로 해주세요:
{
  "recommended_strategies": [
    {
      "strategy_type": "DCA|MA|RSI|BBand|News|Volatility|Momentum",
      "parameters": {},
      "reasoning": "추천 이유",
      "expected_return": "보수적|중립|공격적",
      "risk_level": "low|medium|high"
    }
  ],
  "overall_advice": "종합 조언"
}
`;
}

