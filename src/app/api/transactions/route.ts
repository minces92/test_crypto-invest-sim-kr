import { NextResponse } from 'next/server';
import { getTransactions, saveTransaction } from '@/lib/cache';

export async function GET() {
  try {
    const transactions = getTransactions();
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

export async function POST(request: Request) {
  try {
    // 요청 본문 읽기
    const body = await request.text();
    
    // 빈 본문 체크
    if (!body || body.trim() === '') {
      console.error('Empty request body');
      return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
    }

    // JSON 파싱 시도
    let newTransaction;
    try {
      newTransaction = JSON.parse(body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Request body:', body);
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // 필수 필드 검증
    if (!newTransaction || typeof newTransaction !== 'object') {
      return NextResponse.json({ error: 'Invalid transaction data' }, { status: 400 });
    }

    if (!newTransaction.id || !newTransaction.type || !newTransaction.market || 
        newTransaction.price == null || newTransaction.amount == null || !newTransaction.timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // DB에 저장
    saveTransaction({
      id: newTransaction.id,
      type: newTransaction.type,
      market: newTransaction.market,
      price: newTransaction.price,
      amount: newTransaction.amount,
      timestamp: newTransaction.timestamp,
      source: newTransaction.source,
      isAuto: newTransaction.isAuto,
      strategyType: newTransaction.strategyType,
    });

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
          const analysisResp = await fetch(`${siteUrl}/api/analyze-trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction: newTransaction }),
          });
          if (analysisResp.ok) {
            const analysisJson = await analysisResp.json();
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
            const allTx = cache.getTransactions();
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

        cache.logNotificationAttempt({
          transactionId: newTransaction.id,
          sourceType: 'transaction',
          channel: 'telegram',
          payload: message,
          success: !!sent,
          responseCode: sent ? 200 : 0,
          responseBody: sent ? 'ok' : 'failed',
        });

        if (sent) {
          cache.markTransactionNotified(newTransaction.id);
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
