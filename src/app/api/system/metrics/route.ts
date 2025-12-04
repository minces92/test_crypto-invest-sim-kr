import { NextResponse } from 'next/server';
import { monitor, logMemoryUsage } from '@/lib/monitoring';

export async function GET() {
    logMemoryUsage();
    const metrics = monitor.getMetrics();
    return NextResponse.json({
        timestamp: Date.now(),
        metrics,
    });
}
