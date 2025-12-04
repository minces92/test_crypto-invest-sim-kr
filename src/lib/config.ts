import { z } from 'zod';

// Environment Variable Schema
const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    AI_BACKEND: z.enum(['ollama', 'openai']).default('ollama'),
    AI_BASE_URL: z.string().default('http://localhost:11434'),
    AI_MODEL_ANALYSIS: z.string().default('mistral'),
    UPBIT_ACCESS_KEY: z.string().optional(),
    UPBIT_SECRET_KEY: z.string().optional(),
});

// Dynamic Settings Schema (stored in DB)
export const DynamicSettingsSchema = z.object({
    newsRefreshInterval: z.coerce.number().min(1).default(15),
    tradingEnabled: z.coerce.boolean().default(false),
    maxRiskPerTrade: z.coerce.number().min(0).max(100).default(5), // % of portfolio
    autoTradeInterval: z.coerce.number().min(10).default(60), // seconds
});

export type EnvConfig = z.infer<typeof EnvSchema>;
export type DynamicSettings = z.infer<typeof DynamicSettingsSchema>;

class ConfigurationManager {
    private static instance: ConfigurationManager;
    private envConfig: EnvConfig;

    private constructor() {
        this.envConfig = EnvSchema.parse(process.env);
    }

    static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    getEnv(): EnvConfig {
        return this.envConfig;
    }

    // Note: Dynamic settings are fetched from DB via API or direct DB calls
    // This class mainly centralizes the schema and static env vars
}

export const config = ConfigurationManager.getInstance();
export const env = config.getEnv();
