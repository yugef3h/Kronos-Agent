import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  DOUBAO_API_KEY: z.string().min(1),
  DOUBAO_BASE_URL: z.string().url(),
  DOUBAO_MODEL: z.string().min(1),
  DOUBAO_EMBEDDING_MODEL: z.string().optional(),
  DOUBAO_PLAN_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  DOUBAO_FIRST_TOKEN_WARN_MS: z.coerce.number().int().positive().default(3000),
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
  LANGGRAPH_ENABLED: z.coerce.boolean().default(false),
  ATTENTION_PY_ENABLED: z.coerce.boolean().default(false),
  ATTENTION_PY_BASE_URL: z.string().url().default('http://127.0.0.1:8008'),
  ATTENTION_PY_TIMEOUT_MS: z.coerce.number().int().positive().default(1200),
});

export const env = envSchema.parse(process.env);
