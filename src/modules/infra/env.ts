import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),

  SENTRY_DSN: z.string().optional(),
  METRICS_TOKEN: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

function normalizeMultilineKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

export const env: Env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  LOG_LEVEL: process.env.LOG_LEVEL,

  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,

  JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY ? normalizeMultilineKey(process.env.JWT_PRIVATE_KEY) : undefined,
  JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY ? normalizeMultilineKey(process.env.JWT_PUBLIC_KEY) : undefined,

  SENTRY_DSN: process.env.SENTRY_DSN,
  METRICS_TOKEN: process.env.METRICS_TOKEN
});
