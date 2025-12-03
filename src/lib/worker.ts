import {
  getPendingJobs,
  startJob,
  updateJobStatus,
  getTransactions,
  getSetting,
  getOrSaveTransactionAnalysis,
  logNotificationAttempt,
  markTransactionNotified,
} from './cache';
import { createAIClient } from './ai-client';
import { loadPrompt, fillPromptTemplate } from './prompt-loader';
import { calculatePortfolioState } from './utils';
import { sendMessage } from './telegram';

async function processTransactionAnalysisJob(job: any) {
  const { transactionId } = JSON.parse(job.payload);
  if (!transactionId) {
    throw new Error('transactionId is missing from the job payload');
  }

  const allTransactions = await getTransactions();
  const newTransaction = allTransactions.find(t => t.id === transactionId);

  if (!newTransaction) {
    throw new Error(`Transaction with ID ${transactionId} not found`);
  }

  // --- This is the logic moved from transactions/route.ts ---

  // 1. AI Analysis
  let analysisText = '';
  try {
    const aiClient = createAIClient();
    if (aiClient && (await aiClient.isAvailable())) {
      const transactionType = newTransaction.type === 'buy' ? '매수' : '매도';
      const { metadata, template } = await loadPrompt('transaction-analysis');
      const prompt = fillPromptTemplate(template, {
        market: newTransaction.market,
        transactionType,
        price: Number(newTransaction.price).toLocaleString('ko-KR'),
        amount: newTransaction.amount || 'N/A',
        timestamp: new Date(newTransaction.timestamp).toLocaleString('ko-KR'),
        currentTime: new Date().toLocaleString('ko-KR'),
      });

      const aiResponse = await aiClient.generate(prompt, {
        model: process.env.AI_MODEL_ANALYSIS || metadata.model,
        temperature: metadata.temperature,
        maxTokens: metadata.maxTokens,
      });
      analysisText = aiResponse.trim().replace(/\n+/g, ' ').substring(0, 300);
      await getOrSaveTransactionAnalysis(newTransaction.id, analysisText, {
        market: newTransaction.market,
        type: newTransaction.type,
        price: newTransaction.price,
        amount: newTransaction.amount,
      });
    }
  } catch (aiErr) {
    console.warn('AI analysis failed for transaction job', newTransaction.id, aiErr);
    // Do not re-throw, just proceed without analysis
  }

  // 2. Telegram Notification
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const typeText = newTransaction.type === 'buy' ? '📈 매수' : '📉 매도';
    const marketName = newTransaction.market.replace('KRW-', '');
    const totalCostNum = Number(newTransaction.price) * Number(newTransaction.amount);
    const totalCost = totalCostNum.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
    const executedAt = new Date(newTransaction.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const autoText = newTransaction.isAuto ? '자동' : (newTransaction.source === 'manual' ? '수동' : '자동');
    const strategyText = newTransaction.strategyType || '직접/수동';

    let profitText = '';
    if (newTransaction.type === 'sell') {
      const buys = allTransactions.filter((t: any) => t.market === newTransaction.market && t.type === 'buy');
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
    }

    const initialCashSetting = getSetting('initial_cash');
    const initialCash = initialCashSetting ? Number(initialCashSetting) : Number(process.env.NEXT_PUBLIC_DEFAULT_INITIAL_CASH || '1000000');
    const { cash: calculatedCash } = calculatePortfolioState(allTransactions, initialCash);
    const cashBalanceText = `\n<b>현금 잔액:</b> ${Math.round(calculatedCash).toLocaleString('ko-KR')} 원`;

    const message = `\n<b>🔔 신규 거래 알림</b>\n-------------------------\n<b>종류:</b> ${typeText}\n<b>자동/수동:</b> ${autoText}\n<b>전략:</b> ${strategyText}\n<b>종목:</b> ${marketName}\n<b>체결시간(KST):</b> ${executedAt}\n<b>수량:</b> ${Number(newTransaction.amount).toFixed(6)}\n<b>단가:</b> ${Number(newTransaction.price).toLocaleString('ko-KR')} 원\n<b>총액:</b> ${totalCost} 원${profitText}${cashBalanceText}\n-------------------------\n${analysisText ? `<b>평가:</b> ${analysisText}\n-------------------------\n` : ''}<a href="${siteUrl}">사이트에서 확인하기</a>`;

    if (!newTransaction.notificationSent) {
      const sent = await sendMessage(message, 'HTML');
      await logNotificationAttempt({
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
        await markTransactionNotified(newTransaction.id);
      }
    } else {
      console.log(`[worker] skipped notification for transaction ${newTransaction.id} as notification_sent is already true`);
    }
  } catch (notifyErr) {
    console.error('Notification failed for transaction job', newTransaction.id, notifyErr);
    // Do not re-throw, the error is logged in logNotificationAttempt
  }
}

export async function processPendingJobs() {
  const jobs = await getPendingJobs('analyze_transaction', 5); // Process 5 jobs at a time
  if (jobs.length === 0) {
    return 0;
  }

  for (const job of jobs) {
    try {
      await startJob(job.id);
      await processTransactionAnalysisJob(job);
      await updateJobStatus(job.id, 'completed', { message: 'Analysis and notification sent.' });
    } catch (error) {
      console.error(`[worker] Job ${job.id} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await updateJobStatus(job.id, 'failed', { error: errorMessage });
    }
  }
  return jobs.length;
}
