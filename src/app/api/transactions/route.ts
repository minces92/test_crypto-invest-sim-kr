import { NextResponse } from 'next/server';
import { getTransactions, saveTransaction, createJob } from '@/lib/cache';

export async function GET() {
  try {
    const transactions = await getTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error reading transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to read transactions', details: errorMessage },
      { status: 500 }
    );
  }
}

import { z } from 'zod';

const transactionSchema = z.object({
  id: z.string(),
  type: z.enum(['buy', 'sell']),
  market: z.string().regex(/^KRW-[A-Z]+$/),
  price: z.number().positive(),
  amount: z.number().positive(),
  timestamp: z.string().or(z.number()), // Allow string or number timestamp
  source: z.string().optional(),
  isAuto: z.boolean().optional(),
  strategyType: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // 요청 본문 읽기
    const body = await request.json();

    // Zod 검증
    const result = transactionSchema.safeParse(body);

    if (!result.success) {
      console.error('Validation error:', result.error.format());
      return NextResponse.json({
        error: 'Invalid transaction data',
        details: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }, { status: 400 });
    }

    const newTransaction = result.data;

    // DB에 저장
    await saveTransaction({
      id: newTransaction.id,
      type: newTransaction.type,
      market: newTransaction.market,
      price: newTransaction.price,
      amount: newTransaction.amount,
      timestamp: new Date(newTransaction.timestamp).toISOString(), // Ensure ISO string
      source: newTransaction.source,
      isAuto: newTransaction.isAuto ? 1 : 0, // Convert boolean to number for SQLite
      strategyType: newTransaction.strategyType,
    });

    // Create a background job for analysis (non-blocking)
    (async () => {
      try {
        await createJob('analyze_transaction', { transactionId: newTransaction.id });
      } catch (err) {
        console.warn('Failed to enqueue analyze_transaction job for', newTransaction.id, err);
      }
    })();

    // 서버에서 텔레그램 전송 및 로그 기록 (서버가 담당)
    (async () => {
      try {
        const cache = await import('@/lib/cache');
        const telegram = await import('@/lib/telegram');

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const typeText = newTransaction.type === 'buy' ? '📈 매수' : '📉 매도';
        const marketName = newTransaction.market.replace('KRW-', '');
        const totalCostNum = Number(newTransaction.price) * Number(newTransaction.amount);
        const totalCost = totalCostNum.toLocaleString('ko-KR', { maximumFractionDigits: 0 });

        // Execution time in KST
        const executedAt = new Date(newTransaction.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        // 자동/수동 및 전략 정보
        const autoText = newTransaction.isAuto ? '자동' : (newTransaction.source === 'manual' ? '수동' : '자동');
        const strategyText = newTransaction.strategyType || '직접/수동';

        // 거래에 대한 간단한 AI 평가를 요청 (있으면 사용)
        let analysisText = '';
        try {
          // small helper: timeout + simple retry for internal analyze endpoint
          const tryAnalyze = async (attempts = 2, timeoutMs = 5000) => {
            for (let attempt = 1; attempt <= attempts; attempt++) {
              const controller = new AbortController();
              const id = setTimeout(() => controller.abort(), timeoutMs);
              try {
                const resp = await fetch(`${siteUrl}/api/analyze-trade`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transaction: newTransaction }),
                  signal: controller.signal,
                });
                if (!resp.ok) throw new Error(`status ${resp.status}`);
                const json = await resp.json();
                return json;
              } catch (err) {
                if (attempt < attempts) {
                  await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
                  continue;
                }
                throw err;
              } finally {
                clearTimeout(id);
              }
            }
            return null;
          };

          const analysisJson = await tryAnalyze(2, 5000);
          if (analysisJson) {
            analysisText = (analysisJson.analysis || '') + (analysisJson.cached ? ' (cached)' : '');
            if (typeof analysisText === 'string') {
              analysisText = analysisText.trim().replace(/\n+/g, ' ');
              if (analysisText.length > 300) analysisText = analysisText.slice(0, 300) + '...';
            } else {
              analysisText = '';
            }
          }
        } catch (analysisErr) {
          console.warn('Failed to fetch analyze-trade for transaction', newTransaction.id, analysisErr);
        }

        // If sell, compute profit% vs average buy price for the market
        let profitText = '';
        if (newTransaction.type === 'sell') {
          try {
            const allTx = await cache.getTransactions();
            // compute average buy price from previous buy transactions for this market (excluding this sell)
            const buys = allTx.filter((t: any) => t.market === newTransaction.market && t.type === 'buy');
            let avgBuyPrice = 0;
            let totalQty = 0;
            for (const b of buys) {
              const q = Number(b.amount || 0);
              const p = Number(b.price || 0);
              avgBuyPrice = (avgBuyPrice * totalQty + p * q) / (totalQty + q || 1);
              totalQty += q;
            }
            if (totalQty > 0 && avgBuyPrice > 0) {
              const sellPrice = Number(newTransaction.price);
              const profitPercent = ((sellPrice - avgBuyPrice) / avgBuyPrice) * 100;
              profitText = `\n<b>평가(수익률):</b> ${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}% (평균매수가: ${avgBuyPrice.toLocaleString('ko-KR')} 원)`;
            }
          } catch (e) {
            console.warn('Failed to compute profit percent for transaction', newTransaction.id, e);
          }
        }

        const message = `\n<b>🔔 신규 거래 알림</b>\n-------------------------\n<b>종류:</b> ${typeText}\n<b>자동/수동:</b> ${autoText}\n<b>전략:</b> ${strategyText}\n<b>종목:</b> ${marketName}\n<b>체결시간(KST):</b> ${executedAt}\n<b>수량:</b> ${Number(newTransaction.amount).toFixed(6)}\n<b>단가:</b> ${Number(newTransaction.price).toLocaleString('ko-KR')} 원\n<b>총액:</b> ${totalCost} 원${profitText}\n-------------------------\n${analysisText ? `<b>평가:</b> ${analysisText}\n-------------------------\n` : ''}<a href="${siteUrl}">사이트에서 확인하기</a>`;

        const sent = await telegram.sendMessage(message, 'HTML');

        await cache.logNotificationAttempt({
          transactionId: newTransaction.id,
          sourceType: 'transaction',
          channel: 'telegram',
          payload: message,
          attemptNumber: 1,
          success: !!sent,
          responseCode: sent ? 200 : 0,
          responseBody: sent ? 'ok' : 'failed',
        });

        if (sent) {
          await cache.markTransactionNotified(newTransaction.id);
        }
      } catch (err) {
        console.error('Server-side notification failed for transaction:', newTransaction.id, err);
      }
    })();

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error('Error writing transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to write transaction', details: errorMessage },
      { status: 500 }
    );
  }
}
