import { z } from 'zod';

// ─── Environment config (lazy — only reads env vars on first access) ───

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined || val === null) throw new Error(`Missing env var: ${key}`);
  return val;
}

function envOptional(key: string): string | undefined {
  return process.env[key] || undefined;
}

interface AppConfig {
  database: { url: string };
  redis: { url: string };
  ai: { apiKey: string; baseUrl: string; model: string };
  gemini: { apiKey: string; flashModel: string; proModel: string };
  app: { url: string; apiSecret: string; nodeEnv: string };
  playwright: { headless: boolean; maxDurationMs: number };
  rateLimit: { windowMs: number; maxRequests: number };
  domainAllowlist: string[];
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;
  _config = {
    database: {
      url: env('DATABASE_URL', 'mongodb://localhost:27017/browser_agent'),
    },
    redis: {
      url: env('REDIS_URL', 'redis://localhost:6379'),
    },
    ai: {
      apiKey: envOptional('AI_API_KEY') ?? '',
      baseUrl: env('AI_BASE_URL', 'https://api.openai.com/v1'),
      model: env('AI_MODEL', 'gpt-4o'),
    },
    gemini: {
      apiKey: env('GEMINI_API_KEY', ''),
      flashModel: env('GEMINI_FLASH_MODEL', 'gemini-3-flash-preview'),
      proModel: env('GEMINI_PRO_MODEL', 'gemini-3-flash-preview'),
    },
    app: {
      url: env('APP_URL', 'http://localhost:3000'),
      apiSecret: env('API_SECRET', 'change-me-to-a-random-secret'),
      nodeEnv: env('NODE_ENV', 'development'),
    },
    playwright: {
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      maxDurationMs: parseInt(env('MAX_RUN_DURATION_MS', '600000'), 10),
    },
    rateLimit: {
      windowMs: parseInt(env('RATE_LIMIT_WINDOW_MS', '60000'), 10),
      maxRequests: parseInt(env('RATE_LIMIT_MAX_REQUESTS', '10'), 10),
    },
    domainAllowlist:
      envOptional('DOMAIN_ALLOWLIST')
        ?.split(',')
        .map((d) => d.trim())
        .filter(Boolean) ?? [],
  };
  return _config;
}

/** Proxy that lazily initializes config on first property access */
export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_target, prop: string) {
    return getConfig()[prop as keyof AppConfig];
  },
});

// ─── Mission Types ─────────────────────────────────────────────────────

export type MissionStatus =
  | 'idle'
  | 'listening'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'error';

export interface ConversationMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  hidden?: boolean;
  inputRequest?: {
    type: 'url' | 'email' | 'password' | 'text' | 'file';
    label: string;
    placeholder?: string;
  };
}

export interface TestRequirement {
  website_url: string;
  workflows: string[];
  credentials_required: boolean;
  credentials?: { email?: string; password?: string };
  conversation_transcript?: string;
  test_depth: 'shallow' | 'standard' | 'deep';
  expected_outputs?: string[];
}

export interface MissionPlan {
  steps: {
    name: string;
    description: string;
    type: 'navigate' | 'interact' | 'verify' | 'extract';
  }[];
}

export interface MissionDoc {
  _id: string;
  status: MissionStatus;
  conversation: ConversationMessage[];
  requirements: TestRequirement | null;
  plan: MissionPlan | null;
  runId: string | null;
  results: {
    totalTests: number;
    passed: number;
    failed: number;
    coverage: number;
    aiSummary: string | null;
    videoUrl: string | null;
  } | null;
  reasoning: string[];
  created_at: Date;
  updated_at: Date;
}

// ─── Shared Zod Schemas ────────────────────────────────────────────────

export const StepActionSchema = z.enum([
  'navigate',
  'fillByLabel',
  'fillByPlaceholder',
  'clickByText',
  'assertVisible',
  'assertNotVisible',
  'assertUrlChange',
  'assertTextPresent',
  'waitForSelector',
]);

export type StepAction = z.infer<typeof StepActionSchema>;

export const TestStepSchema = z.object({
  action: StepActionSchema,
  label: z.string().optional(),
  text: z.string().optional(),
  selector: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
});

export type TestStep = z.infer<typeof TestStepSchema>;

export const TestCaseSchema = z.object({
  name: z.string(),
  steps: z.array(TestStepSchema).max(20),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

export const TestPlanSchema = z.object({
  testCases: z.array(TestCaseSchema).max(10),
});

export type TestPlan = z.infer<typeof TestPlanSchema>;

export const RunTestInputSchema = z.object({
  url: z.string().url(),
  instructions: z.string().min(10).max(5000),
  headless: z.boolean().default(true),
});

export type RunTestInput = z.infer<typeof RunTestInputSchema>;

export const StepResultSchema = z.object({
  status: z.enum(['passed', 'failed']),
  error: z.string().optional(),
  screenshotUrl: z.string(),
  durationMs: z.number(),
  healed: z.boolean().default(false),
});

export type StepResult = z.infer<typeof StepResultSchema>;

// ─── DB document types ─────────────────────────────────────────────────

export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'timeout';

export interface TestRunDoc {
  _id: string;
  url: string;
  instructions: string;
  status: TestRunStatus;
  headless: boolean;
  video_path: string | null;
  har_path: string | null;
  network_logs: object | null;
  console_logs: object | null;
  ai_summary: string | null;
  current_screenshot_url?: string | null;
  current_step_name?: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface TestCaseDoc {
  _id: string;
  run_id: string;
  name: string;
  status: string;
}

export interface TestStepDoc {
  _id: string;
  test_case_id: string;
  action: string;
  target: string | null;
  value: string | null;
  status: 'passed' | 'failed' | 'pending';
  screenshot_url: string | null;
  error_message: string | null;
  duration_ms: number | null;
  healed: boolean;
  created_at: Date;
}
