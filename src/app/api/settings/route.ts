import { NextResponse } from 'next/server';
import { queryAll, run } from '@/lib/db-client';
import { handleApiError } from '@/lib/error-handler';
import { DynamicSettingsSchema } from '@/lib/config';
import { z } from 'zod';

export async function GET() {
  try {
    // Fetch all settings from DB
    const rows = await queryAll('SELECT key, value FROM settings');

    // Convert rows to object
    const dbSettings: Record<string, any> = {};
    if (Array.isArray(rows)) {
      rows.forEach((row: any) => {
        try {
          // Attempt to parse JSON values, fallback to string
          dbSettings[row.key] = JSON.parse(row.value);
        } catch {
          dbSettings[row.key] = row.value;
        }
      });
    }

    // Merge with defaults
    const settings = DynamicSettingsSchema.parse(dbSettings);

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const validatedSettings = DynamicSettingsSchema.partial().parse(body);

    // Update DB
    const updates = Object.entries(validatedSettings);
    if (updates.length > 0) {
      for (const [key, value] of updates) {
        await run(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
          [key, JSON.stringify(value)]
        );
      }
    }

    return NextResponse.json({ success: true, settings: validatedSettings });
  } catch (error) {
    return handleApiError(error);
  }
}
