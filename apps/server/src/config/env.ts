import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const serverPackageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appsRoot = join(serverPackageRoot, '..');

/** Node / Python 共用：优先 apps/.env，兼容旧版 apps/server/.env */
const resolveEnvFilePath = (): string | undefined => {
  const candidates = [join(appsRoot, '.env'), join(serverPackageRoot, '.env')];
  return candidates.find((path) => existsSync(path));
};

const envFilePath = resolveEnvFilePath();
if (envFilePath) {
  config({ path: envFilePath });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  DOUBAO_API_KEY: z.string().min(1),
  DOUBAO_BASE_URL: z.string().url(),
  DOUBAO_MODEL: z.string().min(1),
  DOUBAO_EMBEDDING_MODEL: z.string().optional(),
  DOUBAO_PLAN_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  DOUBAO_FIRST_TOKEN_WARN_MS: z.coerce.number().int().positive().default(3000),
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  LANGGRAPH_ENABLED: z.coerce.boolean().default(true),
  LANGGRAPH_MAX_TOOL_STEPS: z.coerce.number().int().positive().default(8),
  TAVILY_API_KEY: z.string().optional(),
  /** ImgBB 图床；Playground 选图上传 */
  IMGBB_API_KEY: z.string().optional(),
  ATTENTION_PY_ENABLED: z.coerce.boolean().default(false),
  ATTENTION_PY_BASE_URL: z.string().url().default('http://127.0.0.1:8008'),
  ATTENTION_PY_TIMEOUT_MS: z.coerce.number().int().positive().default(1200),
  /** `self`（默认）| `langchain` — 大小写不敏感 */
  RAG_ENGINE_MODE: z.string().optional(),
  /** `memory`（默认，本地）| `redis` — 多实例 Workflow Run */
  WORKFLOW_RUN_STORE: z.enum(['memory', 'redis']).default('memory'),
  /** `WORKFLOW_RUN_STORE=redis` 时必填 */
  REDIS_URL: z.string().url().optional(),
  /** `memory`（默认）| `redis` — 多实例 Workflow SSE 事件 */
  WORKFLOW_RUN_EVENTS_STORE: z.enum(['memory', 'redis']).default('memory'),
  WORKFLOW_QUEUE_ENABLED: z.coerce.boolean().default(false),
  /** 本地 OpenAI 兼容推理端点 */
  AI_LOCAL_MODEL_BASE_URL: z.string().url().optional(),
  /** BullMQ 消费 `/api/ai/tasks` chat 任务 */
  AI_TASK_QUEUE_ENABLED: z.coerce.boolean().default(false),
  /** 0–100，用于 `resolveDegradePolicy` */
  AI_LOAD_PERCENT: z.coerce.number().min(0).max(100).default(0),
  /** 任务状态存 Redis（需 REDIS_URL） */
  AI_TASK_STORE_REDIS: z.coerce.boolean().default(false),
  /** 单用户日 Token 预算，0=不限制 */
  AI_USER_TOKEN_BUDGET_PER_DAY: z.coerce.number().int().nonnegative().default(0),
}).superRefine((value, ctx) => {
  if (value.WORKFLOW_RUN_STORE === 'redis' && !value.REDIS_URL?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required when WORKFLOW_RUN_STORE=redis',
    });
  }

  if (value.WORKFLOW_RUN_EVENTS_STORE === 'redis' && !value.REDIS_URL?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required when WORKFLOW_RUN_EVENTS_STORE=redis',
    });
  }

  if (value.WORKFLOW_QUEUE_ENABLED && !value.REDIS_URL?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required when WORKFLOW_QUEUE_ENABLED=true',
    });
  }

  if (value.AI_TASK_QUEUE_ENABLED && !value.REDIS_URL?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required when AI_TASK_QUEUE_ENABLED=true',
    });
  }

  if (value.AI_TASK_STORE_REDIS && !value.REDIS_URL?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required when AI_TASK_STORE_REDIS=true',
    });
  }
});

export const env = envSchema.parse(process.env);

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

export const allowedOrigins = [...new Set([
  ...env.ALLOWED_ORIGIN
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  ...LOCAL_DEV_ORIGINS,
])]
