---
name: Transaction Analysis
description: Analyzes a cryptocurrency transaction.
model: mistral # Default model, can be overridden
temperature: 0.7
maxTokens: 300
---
암호화폐 거래 분석 요청:

거래 정보:
- 종목: {{market}}
- 거래 유형: {{transactionType}}
- 거래 가격: {{price}}원
- 거래 수량: {{amount}}
- 거래 시간: {{timestamp}}
- 현재 시간: {{currentTime}}

위 거래 정보를 바탕으로 다음을 분석해주세요:
1. 거래 타이밍 평가 (좋은 타이밍인지, 나쁜 타이밍인지)
2. 가격 대비 평가 (고가/저가/적정가)
3. 향후 전략 제안 (추가 매수/매도 권장 여부, 보유 전략 등)
4. 리스크 평가 (해당 거래의 리스크 수준)

답변은 한국어로 간결하고 실용적으로 작성해주세요. (200자 이내)
