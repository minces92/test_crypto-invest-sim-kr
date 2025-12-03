/**
 * AI 클라이언트 인터페이스 및 구현
 * Ollama, llama.cpp, KoboldCpp 등 다양한 백엔드를 지원
 */
import { logAIInteraction } from './ai-logger';
export interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface AIClient {
  generate(prompt: string, options?: AIGenerationOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
  getTags(): Promise<string[] | null>;
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
    const tags = await this.getTags();
    return tags !== null;
  }

  async getTags(): Promise<string[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000), // Increased to 15s
      });
      if (!response.ok) {
        console.warn(`Ollama check failed with status: ${response.status}`);
        return null;
      }
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Ollama connection error:', error);
      return null;
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
          keep_alive: "5m", // 모델을 5분간 메모리에 유지
          options: {
            temperature,
            num_predict: maxTokens,
            top_p: topP,
          },
        }),
        signal: AbortSignal.timeout(120000), // 120초 타임아웃
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.response || '';

      await logAIInteraction({
        type: 'analysis',
        prompt,
        response: text,
        meta: {
          model,
          temperature,
          maxTokens,
          topP,
          backend: 'ollama',
        },
      });

      return text;
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
  let jsonString = response.trim();

  // 1. Try to extract content from markdown code blocks
  const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1];
  } else {
    // 2. If no code block, find the largest JSON object-like structure
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
  }

  // 3. Clean up common JSON errors, like trailing commas
  // This regex removes commas before a closing brace '}' or bracket ']'
  jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

  try {
    // 4. Attempt to parse the cleaned string
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse AI response as JSON. The cleaned string was:', jsonString);
    console.error('Original parsing error:', error);

    // 5. If parsing still fails, return an object indicating failure
    return {
      raw: response,
      error: 'Parsing failed after cleanup',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 시세 분석 프롬프트 생성
 */
export interface PriceAnalysisContext {
  market: string;
  currentPrice: number;
  change24h: number;
  rsi?: number;
  macd?: { signal: string };
  bollinger?: { position: string; upper?: number; lower?: number; middle?: number };
  ma?: { short: number; long: number; cross?: string };
  volatility?: { range: number; targetPrice: number; isBreakout?: boolean };
  momentum?: { priceMomentum: number; volumeMomentum: number; isStrong?: boolean };
  sentiment?: { label: 'positive' | 'negative' | 'neutral'; score?: number };
  volume?: { current?: number; average?: number; ratio?: number };
}

export function createPriceAnalysisPrompt(context: PriceAnalysisContext): string {
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
  } = context;

  const metricLines = [
    `코인: ${market}`,
    `현재가: ${currentPrice.toLocaleString()}원`,
    `24h 변동률: ${change24h.toFixed(2)}%`,
    rsi !== undefined ? `RSI: ${rsi.toFixed(2)}` : null,
    macd ? `MACD 신호: ${macd.signal}` : null,
    bollinger
      ? `볼린저 밴드: ${bollinger.position}${typeof bollinger.upper === 'number' && typeof bollinger.lower === 'number'
        ? ` (상단 ${bollinger.upper.toLocaleString()}원 / 하단 ${bollinger.lower.toLocaleString()}원)`
        : ''}`
      : null,
    ma
      ? `이동평균선: 단기 ${ma.short}, 장기 ${ma.long}${ma.cross ? ` (${ma.cross})` : ''}`
      : null,
    volume && (volume.current || volume.ratio)
      ? `거래량: 현재 ${volume.current?.toLocaleString() ?? 'N/A'} (${volume.ratio ? `${volume.ratio.toFixed(1)}%` : '평균 대비 데이터 없음'})`
      : null,
    sentiment
      ? `뉴스/시장 심리: ${sentiment.label}${typeof sentiment.score === 'number' ? ` (점수: ${sentiment.score.toFixed(2)})` : ''}`
      : null,
  ].filter(Boolean).join('\n');

  const strategyNotes: string[] = [];
  if (volatility) {
    strategyNotes.push(
      `변동성 돌파: 범위 ${volatility.range.toLocaleString()}원, 목표 돌파가 ${volatility.targetPrice.toLocaleString()}원, 현재 돌파 여부: ${volatility.isBreakout ? '예' : '아니오'}`
    );
  }
  if (momentum) {
    strategyNotes.push(
      `모멘텀: 가격 모멘텀 ${momentum.priceMomentum.toFixed(2)}%, 거래량 모멘텀 ${momentum.volumeMomentum.toFixed(2)}%, 강도 분류: ${momentum.isStrong ? '강함' : '보통'}`
    );
  }

  const optionalStrategyContext = strategyNotes.length
    ? `\n전략 맥락:\n${strategyNotes.map((note) => `- ${note}`).join('\n')}\n`
    : '';

  const extraInstruction = strategyNotes.length
    ? `6. 전략별 판단: 위 전략 맥락(돌파 유효성, 모멘텀 지속 가능성 등)에 대한 의견과 AI가 권장하는 행동\n`
    : '';

  return `
코인 시세 분석 요청:

${metricLines}
${optionalStrategyContext}위 정보를 기반으로 다음을 분석해주세요:
1. 현재 추세 (상승/하락/횡보)
2. 추세 강도 (1-10)
3. 매매 추천 (매수/매도/보유)
4. 신뢰도 (0-1)
5. 주요 지지선/저항선
${extraInstruction}답변은 반드시 다음 JSON 형식으로 해주세요:
{
  "trend": "상승|하락|횡보",
  "strength": 1-10,
  "recommendation": "매수|매도|보유",
  "confidence": 0-1,
  "key_levels": {
    "support": 가격,
    "resistance": 가격
  },
  "reasoning": "분석 이유",
  "full_report": {
    "short_term_forecast": "단기(1-3일) 전망 및 주요 이벤트",
    "mid_term_forecast": "중기(1-2주) 전망 및 시장 동향",
    "long_term_forecast": "장기(1개월 이상) 전망 및 거시 경제 영향",
    "recommended_strategy": "추천 매매 전략 (예: 단기 변동성 매매, 중기 추세 추종, 장기 가치 투자 등)"
  }
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

