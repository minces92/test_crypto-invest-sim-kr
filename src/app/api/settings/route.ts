import { NextResponse } from 'next/server';
import { getAllSettings, updateSetting, recordApiMetric } from '@/lib/cache';

export async function GET() {
  const startTime = performance.now();
  
  try {
    const settings = getAllSettings();
    // Ensure initial_cash exists and has a default value if not set
    if (!settings.initial_cash) {
        const defaultValue = process.env.NEXT_PUBLIC_DEFAULT_INITIAL_CASH || '1000000';
        updateSetting('initial_cash', defaultValue);
        settings.initial_cash = defaultValue;
        console.log('Initialized default initial_cash setting.');
    }
    
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('GET /api/settings', responseTimeMs);
    
    return NextResponse.json(settings);
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('GET /api/settings', responseTimeMs, false, String(error));
    
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined || value === null) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      recordApiMetric('POST /api/settings', responseTimeMs, false, 'Missing key or value');
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
    }
    
    // Basic validation for initial_cash
    if (key === 'initial_cash') {
        const numericValue = Number(value);
        if (isNaN(numericValue) || numericValue < 0) {
          const responseTimeMs = Math.round(performance.now() - startTime);
          recordApiMetric('POST /api/settings', responseTimeMs, false, 'Invalid initial_cash value');
          return NextResponse.json({ error: 'Initial cash must be a non-negative number' }, { status: 400 });
        }
    }

    updateSetting(key, value.toString());
    
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('POST /api/settings', responseTimeMs);

    return NextResponse.json({ success: true, key, value: value.toString() });
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('POST /api/settings', responseTimeMs, false, String(error));
    
    console.error('Error updating setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}

// PATCH: 뉴스 갱신 주기 등 개별 설정 업데이트 (Issue #2)
export async function PATCH(request: Request) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { newsRefreshInterval } = body;

    // 뉴스 갱신 주기 검증 (1-120분)
    if (newsRefreshInterval !== undefined) {
      const interval = Number(newsRefreshInterval);
      if (isNaN(interval) || interval < 1 || interval > 120) {
        const responseTimeMs = Math.round(performance.now() - startTime);
        recordApiMetric('PATCH /api/settings', responseTimeMs, false, 'Invalid newsRefreshInterval');
        return NextResponse.json(
          { error: 'newsRefreshInterval must be between 1 and 120 minutes' },
          { status: 400 }
        );
      }
      
      updateSetting('newsRefreshInterval', interval.toString());
      console.log(`[settings] newsRefreshInterval updated to ${interval} minutes`);
      
      const responseTimeMs = Math.round(performance.now() - startTime);
      recordApiMetric('PATCH /api/settings', responseTimeMs);
      
      return NextResponse.json({
        success: true,
        newsRefreshInterval: interval,
        message: '뉴스 갱신 주기가 업데이트되었습니다.'
      });
    }

    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('PATCH /api/settings', responseTimeMs, false, 'No settings provided');
    
    return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    recordApiMetric('PATCH /api/settings', responseTimeMs, false, String(error));
    
    console.error('Error updating settings via PATCH:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
