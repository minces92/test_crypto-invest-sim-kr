import { queryGet, run } from './db-client';
import { DynamicSettingsSchema, DynamicSettings } from './config';

export interface Setting {
    key: string;
    value: string;
    updated_at: string;
}

/**
 * Get a setting value from the database.
 * Falls back to default value from schema if not found.
 */
export async function getSetting<K extends keyof DynamicSettings>(key: K): Promise<DynamicSettings[K]> {
    const defaultValue = DynamicSettingsSchema.shape[key].parse(undefined); // Get default from Zod schema

    try {
        const result = await queryGet('SELECT value FROM settings WHERE key = ?', [key]) as { value: string } | undefined;

        if (result && result.value !== undefined) {
            try {
                return JSON.parse(result.value);
            } catch {
                // Handle legacy simple strings if any
                if (typeof defaultValue === 'number') {
                    return Number(result.value) as any;
                }
                if (typeof defaultValue === 'boolean') {
                    return (result.value === 'true' || result.value === '1') as any;
                }
                return result.value as any;
            }
        }

        return defaultValue as DynamicSettings[K];
    } catch (error) {
        console.error(`[settings] Error fetching setting ${key}:`, error);
        return defaultValue as DynamicSettings[K];
    }
}

/**
 * Update a setting value in the database.
 */
export async function updateSetting<K extends keyof DynamicSettings>(key: K, value: DynamicSettings[K]): Promise<boolean> {
    try {
        // Validate with schema
        const partial = { [key]: value };
        DynamicSettingsSchema.partial().parse(partial);

        const stringValue = JSON.stringify(value);

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
