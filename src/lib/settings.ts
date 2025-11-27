import { queryGet, run } from './db-client';

export interface Setting {
    key: string;
    value: string;
    updated_at: string;
}

/**
 * Get a setting value from the database.
 * Falls back to default value if not found or on error.
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
        const result = await queryGet('SELECT value FROM settings WHERE key = ?', [key]) as { value: string } | undefined;

        if (result && result.value !== undefined) {
            // Try to parse as JSON if it looks like one, otherwise return string
            try {
                return JSON.parse(result.value);
            } catch {
                // If it's a simple string that's not JSON (e.g. "15"), check if we expect a number
                if (typeof defaultValue === 'number') {
                    return Number(result.value) as unknown as T;
                }
                return result.value as unknown as T;
            }
        }

        return defaultValue;
    } catch (error) {
        console.error(`[settings] Error fetching setting ${key}:`, error);
        return defaultValue;
    }
}

/**
 * Update a setting value in the database.
 */
export async function updateSetting(key: string, value: any): Promise<boolean> {
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        await run(
            `INSERT INTO settings (key, value, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP) 
       ON CONFLICT(key) DO UPDATE SET 
       value = excluded.value, 
       updated_at = CURRENT_TIMESTAMP`,
            [key, stringValue]
        );

        console.log(`[settings] Updated ${key} = ${stringValue}`);
        return true;
    } catch (error) {
        console.error(`[settings] Error updating setting ${key}:`, error);
        return false;
    }
}
