import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TZ: z.string().default('Asia/Kolkata'),
  FIXTURE_MODE: z
    .string()
    .default('0')
    .transform((val) => val === '1' || val.toLowerCase() === 'true'),

  OLLAMA_HOST: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:e4b'),
  OLLAMA_NUM_CTX: z.coerce.number().default(8192),
  OLLAMA_SEED: z.coerce.number().default(7),

  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_TASK_QUEUE: z.string().default('sentinel'),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_CHAT_ID: z.string().optional().default(''),

  SENTRY_DSN: z.string().optional().default(''),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(1.0),
  TRACE_CAPTURE_IO: z
    .string()
    .default('0')
    .transform((val) => val === '1' || val.toLowerCase() === 'true'),

  SERPAPI_API_KEY: z.string().optional().default(''),
  BACKBOARD_API_KEY: z.string().optional().default(''),
  SECOND_MODEL: z.string().optional().default(''),

  API_PORT: z.coerce.number().default(8787),
  DB_PATH: z.string().default('./data/sentinel.db'),
  USER_AGENT: z
    .string()
    .default('SchemeSentinel/0.1 (student project; contact: student@example.com)'),
});

export type Config = z.infer<typeof ConfigSchema>;

let parsedConfig: Config;
try {
  parsedConfig = ConfigSchema.parse(process.env);
} catch (err) {
  console.error('Configuration validation failed:', err);
  throw err;
}

export const config = parsedConfig;

