import { NextResponse } from 'next/server';
import { getApiMetrics } from '@/lib/cache';

/**
 * Issue #3: API 메트릭 조회 엔드포인트
 * 타임아웃 빈도, 평균 응답 시간, 최대 응답 시간 등을 조회
 * 
 * Query Parameters:
 * - endpoint: 특정 엔드포인트 필터 (선택)
 * - seconds: 최근 N초 데이터 (기본값: 300초 = 5분)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint') || undefined;
    const secondsParam = url.searchParams.get('seconds');
    const seconds = secondsParam ? Math.max(1, Math.min(3600, Number(secondsParam))) : 300;
    
    const { metrics, stats } = getApiMetrics(endpoint, seconds);
    
    return NextResponse.json({
      timeWindow: {
        seconds,
        startTime: new Date(Date.now() - (seconds * 1000)).toISOString(),
        endTime: new Date().toISOString(),
      },
      stats: {
        ...stats,
        slowResponseThresholdMs: 1500,
        timeoutThresholdMs: 2000,
      },
      metrics: metrics.slice(-50), // 최근 50개만 반환
      warning: stats.totalRequests === 0 ? '수집된 메트릭이 없습니다' : undefined,
    });
  } catch (error) {
    console.error('Error retrieving API metrics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}
