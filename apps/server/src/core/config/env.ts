import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** Jest(CJS) 不支持 `import.meta`；用 cwd 推断 server 包根目录 */
const serverPackageRoot = existsSync(join(process.cwd(), 'apps/server', 'src'))
  ? join(process.cwd(), 'apps/server')
  : process.cwd();
const appsRoot = join(serverPackageRoot, '..');
const repoRoot = join(appsRoot, '..');

/** Node / Python 共用：优先 repo_root/.env，兼容旧版 apps/.env / apps/server/.env */
const resolveEnvFilePath = (): string | undefined => {
  const candidates = [join(repoRoot, '.env'), join(appsRoot, '.env'), join(serverPackageRoot, '.env')];
  return candidates.find((path) => existsSync(path));
};

const envFilePath = resolveEnvFilePath();
if (envFilePath) {
  config({ path: envFilePath });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  /** 设为非 doubao 时走通用 OpenAI 兼容配置（AI_API_KEY / AI_BASE_URL / AI_MODEL） */
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().optional(),
  DOUBAO_API_KEY: z.string().optional(),
  DOUBAO_BASE_URL: z.string().url().optional(),
  DOUBAO_MODEL: z.string().optional(),
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
  /** Playground 会话：`file`（默认，json + 内存）| `redis` */
  SESSION_STORE: z.enum(['file', 'redis']).default('file'),
  /** `SESSION_STORE=redis` 时会话 key TTL（秒），默认 7 天 */
  SESSION_TTL_SEC: z.coerce.number().int().positive().default(604800),
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
  /** Sentry DSN，不设置则不启用 Sentry */
  SENTRY_DSN: z.string().url().optional(),
  /** LangFuse 配置，三项都填才会启用 */
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().url().optional(),
}).superRefine((value, ctx) => {
  const provider = value.AI_PROVIDER?.trim().toLowerCase();
  const useDoubao = !provider || provider === 'doubao';

  if (useDoubao) {
    if (!value.DOUBAO_API_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DOUBAO_API_KEY'],
        message: 'DOUBAO_API_KEY is required when AI_PROVIDER is unset or doubao',
      });
    }
    if (!value.DOUBAO_BASE_URL?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DOUBAO_BASE_URL'],
        message: 'DOUBAO_BASE_URL is required when AI_PROVIDER is unset or doubao',
      });
    }
    if (!value.DOUBAO_MODEL?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DOUBAO_MODEL'],
        message: 'DOUBAO_MODEL is required when AI_PROVIDER is unset or doubao',
      });
    }
  } else {
    if (!value.AI_API_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_API_KEY'],
        message: 'AI_API_KEY is required when AI_PROVIDER is set to a non-doubao provider',
      });
    }
    if (!value.AI_BASE_URL?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_BASE_URL'],
        message: 'AI_BASE_URL is required when AI_PROVIDER is set to a non-doubao provider',
      });
    }
    if (!value.AI_MODEL?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_MODEL'],
        message: 'AI_MODEL is required when AI_PROVIDER is set to a non-doubao provider',
      });
    }
  }

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

  if (value.SESSION_STORE === 'redis' && !value.REDIS_URL?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required when SESSION_STORE=redis',
    });
  }
});

export const env = envSchema.parse(process.env);

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** 非 production 时放行 localhost / 127.0.0.1 任意端口（Vite 端口被占用时会自动换端口）。 */
export const isLocalDevOrigin = (origin: string): boolean => {
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  return LOCAL_DEV_ORIGIN_PATTERN.test(origin)
}

export const allowedOrigins = [...new Set([
  ...env.ALLOWED_ORIGIN
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  ...LOCAL_DEV_ORIGINS,
])]
