import { NextResponse } from 'next/server';
import { getSetting, updateSetting } from '@/lib/settings';

// Force rebuild to resolve potential stale imports

export async function GET() {
  try {
    const newsRefreshInterval = await getSetting('newsRefreshInterval', 15);
    return NextResponse.json({
      settings: {
        newsRefreshInterval
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { newsRefreshInterval } = body;

    if (newsRefreshInterval !== undefined) {
      await updateSetting('newsRefreshInterval', newsRefreshInterval);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
