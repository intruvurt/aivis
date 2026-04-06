// server/src/services/aiProviders.ts
import { openrouterPrompt, deepseekPrompt, ollamaPrompt } from '../config/aiProviders.js';

export type AiProvider = {
  provider: string;
  model: string;
  endpoint: string;
  displayName: string;
  label?: string;
};

// ── Paid model providers - ordered by cost-effectiveness ──
// Used as fallback chain for all paid tiers.
// Updated 2026-03-29: GPT-4.1 mini primary, Claude 3.5 Haiku/Sonnet, Grok 3 mini, Gemini 2.5 Flash
export const PROVIDERS: AiProvider[] = [
  {
    provider: 'openrouter',
    model: 'openai/gpt-4.1-mini',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'GPT-4.1 Mini',
    label: 'GPT-4.1 Mini',
  },
  {
    provider: 'openrouter',
    model: 'anthropic/claude-3.5-haiku',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Claude 3.5 Haiku',
    label: 'Claude 3.5 Haiku',
  },
  {
    provider: 'openrouter',
    model: 'x-ai/grok-3-mini',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Grok 3 Mini',
    label: 'Grok 3 Mini',
  },
  {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Gemini 2.5 Flash',
    label: 'Gemini 2.5 Flash',
  },
  {
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat-v3-0324',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'DeepSeek V3',
    label: 'DeepSeek V3',
  },
  // DeepSeek native (preferred when DEEPSEEK_API_KEY is set - bypasses OpenRouter markup)
  {
    provider: 'deepseek',
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/chat/completions',
    displayName: 'DeepSeek V3 (Native)',
    label: 'DeepSeek V3 Native',
  },
  {
    provider: 'openrouter',
    model: 'mistralai/mistral-small-3.2-24b-instruct',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Mistral Small 3.2',
    label: 'Mistral Small 3.2',
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Llama 3.3 70B',
    label: 'Llama 3.3 70B',
  },
  {
    provider: 'ollama',
    model: 'llama2',
    endpoint: process.env.OLLAMA_BASE_URL || '',
    displayName: 'Ollama (Local)',
    label: 'Ollama Local',
  },
];

// ── Signal tier: dedicated triple-check pipeline models ──
// Updated 2026-03-29: GPT-4.1 mini primary, Claude 3.5 Sonnet peer critique, Grok 3 mini validation
// AI1: GPT-4.1 Mini (primary analysis - fast, cheap, strong JSON)
// AI2: Claude 3.5 Sonnet (peer critique - different model family for diversity)
// AI3: Grok 3 Mini (validation gate - third model family for true independence)
export const SIGNAL_AI1: AiProvider = {
  provider: 'openrouter',
  model: 'openai/gpt-4.1-mini',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  displayName: 'GPT-4.1 Mini',
  label: 'GPT-4.1 Mini',
};
export const SIGNAL_AI2: AiProvider = {
  provider: 'openrouter',
  model: 'anthropic/claude-3.5-sonnet',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  displayName: 'Claude 3.5 Sonnet',
  label: 'Claude 3.5 Sonnet',
};
export const SIGNAL_AI3: AiProvider = {
  provider: 'openrouter',
  model: 'x-ai/grok-3-mini',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  displayName: 'Grok 3 Mini',
  label: 'Grok 3 Mini',
};

// ── scorefix tier: premium triple-check models ──
// Updated 2026-03-29: GPT-4.1 primary, Claude 3.5 Sonnet critique, Grok 3 validation
// Three independent model families for maximum scoring diversity.
// AI1: GPT-4.1 (deep primary - strongest reasoning)
// AI2: Claude 3.5 Sonnet (peer critique - independent model family)
// AI3: Grok 3 (validation gate - third independent family)
export const SCOREFIX_AI1: AiProvider = {
  provider: 'openrouter',
  model: 'openai/gpt-4.1',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  displayName: 'GPT-4.1',
  label: 'GPT-4.1',
};
export const SCOREFIX_AI2: AiProvider = {
  provider: 'openrouter',
  model: 'anthropic/claude-3.5-sonnet',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  displayName: 'Claude 3.5 Sonnet',
  label: 'Claude 3.5 Sonnet',
};
export const SCOREFIX_AI3: AiProvider = {
  provider: 'openrouter',
  model: 'x-ai/grok-3',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  displayName: 'Grok 3',
  label: 'Grok 3',
};

// ── Alignment tier: best affordable primary model ──
// Updated 2026-03-24: GPT-4.1 mini - stronger JSON output, same price class
export const ALIGNMENT_PRIMARY: AiProvider = {
  provider: 'openrouter',
  model: 'openai/gpt-4.1-mini',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  displayName: 'GPT-4.1 Mini',
  label: 'GPT-4.1 Mini',
};

// ── Free model providers (Observer tier - $0.00 per scan) ──
// Ordered by JSON-output reliability. Large instruct models first.
// These must be widely-available OpenRouter :free models - avoid niche/unstable ones.
export const FREE_PROVIDERS: AiProvider[] = [
  {
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-exp:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Gemini 2.0 Flash (Free)',
    label: 'Gemini 2.0 Flash',
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Llama 3.3 70B (Free)',
    label: 'Llama 3.3 70B',
  },
  {
    provider: 'openrouter',
    model: 'qwen/qwen3-32b:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Qwen3 32B (Free)',
    label: 'Qwen3 32B',
  },
  {
    provider: 'openrouter',
    model: 'mistralai/mistral-small-3.1-24b-instruct:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Mistral Small 3.1 (Free)',
    label: 'Mistral Small 3.1 24B',
  },
  {
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'DeepSeek V3 (Free)',
    label: 'DeepSeek V3',
  },
  {
    provider: 'openrouter',
    model: 'google/gemma-3-27b-it:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    displayName: 'Gemma 3 27B (Free)',
    label: 'Gemma 3 27B',
  },
];

interface CallAIProviderArgs {
  provider: string;
  model: string;
  prompt: string;
  apiKey: string;
  endpoint?: string;
  opts?: {
    temperature?: number;
    max_tokens?: number;
    systemPrompt?: string;
    responseFormat?: 'json_object' | 'text';
    /**
     * Hard wall-clock timeout for this AI call (ms).
     * Defaults are chosen to keep the overall /api/analyze request under proxy limits.
     */
    timeoutMs?: number;
  };
}

// In-memory map of provider:model -> backoff-until (ms since epoch)
const providerFailureBackoff: Map<string, number> = new Map();

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return p;
  let t: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

function computeBackoffTtlMs(errorMsg: string): number {
  const lc = (errorMsg || '').toLowerCase();
  if (lc.includes('no allowed providers are available')) return 45 * 1000; // temporary OpenRouter routing state
  if (lc.includes('429') || lc.includes('rate limit')) return 2 * 60 * 1000; // 2 min
  if (lc.includes('401') || lc.includes('authentication')) return 24 * 60 * 60 * 1000; // 24h
  if (lc.includes('404') || lc.includes('not found')) return 24 * 60 * 60 * 1000; // 24h
  if (lc.includes('503') || lc.includes('overloaded')) return 90 * 1000; // 90s
  if (lc.includes('timeout')) return 60 * 1000; // 60s
  if (lc.includes('500') || lc.includes('server')) return 60 * 1000; // 60s
  return 30 * 1000; // default 30s
}

export function isProviderInBackoff(providerName: string, model: string): boolean {
  const key = `${providerName}:${model}`;
  const until = providerFailureBackoff.get(key);
  return !!(until && until > Date.now());
}

export function clearProviderBackoff(providerName?: string, model?: string) {
  if (!providerName) {
    // Only clear expired entries - don't nuke active backoffs
    const now = Date.now();
    for (const [k, until] of providerFailureBackoff.entries()) {
      if (until <= now) providerFailureBackoff.delete(k);
    }
    return;
  }
  if (!model) {
    // clear all models for that provider
    for (const k of providerFailureBackoff.keys()) {
      if (k.startsWith(`${providerName}:`)) providerFailureBackoff.delete(k);
    }
    return;
  }
  providerFailureBackoff.delete(`${providerName}:${model}`);
}

/**
 * Production AI provider call function
 * Routes to OpenRouter or Ollama based on provider type
 *
 * Key fixes for scan timeouts:
 * - Hard timeout per call (default 18s) so the pipeline always has budget for fallbacks.
 * - Provider/model backoff on repeated failures (429/401/404/etc).
 */
export async function callAIProvider(args: CallAIProviderArgs): Promise<string> {
  const { provider, prompt } = args;
  const enforcedSystemPrompt = args.opts?.systemPrompt
    ? `${String(args.opts.systemPrompt).trim()}\n\ndo this for real`
    : undefined;

  // Reduce default token usage to lower latency/cost; callers can override
  const maxTokens = args.opts?.max_tokens ?? 1200;

  // Keep each AI call bounded so /api/analyze can complete before proxy kills the socket.
  // Default raised from 18s→30s to accommodate 3000-token JSON responses (~20-30s at typical speed).
  // Pipeline callers should pass opts.timeoutMs to use the remaining pipeline budget instead.
  const timeoutMs =
    typeof args.opts?.timeoutMs === 'number'
      ? Math.max(1_000, args.opts.timeoutMs)
      : Number(process.env.AI_CALL_TIMEOUT_MS || 30_000);

  const backoffKey = `${args.provider}:${args.model}`;
  if (isProviderInBackoff(args.provider, args.model)) {
    const until = providerFailureBackoff.get(backoffKey) || 0;
    const waitSeconds = Math.ceil((until - Date.now()) / 1000);
    throw new Error(`Provider ${args.provider} model ${args.model} is in backoff for ${waitSeconds}s`);
  }

  try {
    if (provider === 'openrouter') {
      console.log(
        `[AI Provider] OpenRouter model=${args.model}, max_tokens=${maxTokens}, timeoutMs=${timeoutMs}`
      );

      // openrouterPrompt does the HTTP call internally; we hard-cap wall-clock time here
      const result = await withTimeout(
        openrouterPrompt(
          prompt,
          {},
          0,
          args.model,
          maxTokens,
          enforcedSystemPrompt,
          args.opts?.temperature,
          args.opts?.responseFormat
        ),
        timeoutMs,
        `OpenRouter(${args.model})`
      );

      return result;
    }

    if (provider === 'deepseek') {
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek provider not configured (DEEPSEEK_API_KEY not set)');
      }
      console.log(
        `[AI Provider] DeepSeek native model=${args.model}, max_tokens=${maxTokens}, timeoutMs=${timeoutMs}`
      );

      const result = await withTimeout(
        deepseekPrompt(
          prompt,
          {},
          0,
          args.model,
          maxTokens,
          enforcedSystemPrompt,
          args.opts?.temperature,
          args.opts?.responseFormat
        ),
        timeoutMs,
        `DeepSeek(${args.model})`
      );

      return result;
    }

    if (provider === 'ollama') {
      if (!process.env.OLLAMA_BASE_URL) {
        throw new Error('Ollama provider not configured (OLLAMA_BASE_URL not set)');
      }
      console.log(`[AI Provider] Ollama model=${args.model}, timeoutMs=${timeoutMs}`);

      const result = await withTimeout(ollamaPrompt(prompt, {}), timeoutMs, `Ollama(${args.model})`);
      return typeof result === 'string' ? result : JSON.stringify(result);
    }

    throw new Error(`Unknown provider: ${provider}`);
  } catch (error: any) {
    const errorMsg =
      typeof error?.message === 'string' ? error.message : JSON.stringify(error?.message || error);

    console.error(`[AI Provider] Error provider=${provider} model=${args.model}:`, errorMsg);

    // Mark provider/model as failed with an adaptive backoff
    try {
      const ttl = computeBackoffTtlMs(errorMsg);
      providerFailureBackoff.set(backoffKey, Date.now() + ttl);
      console.warn(
        `[AI Provider] Marking ${backoffKey} unhealthy for ${Math.round(ttl / 1000)}s due to error: ${errorMsg.substring(
          0,
          200
        )}`
      );
    } catch {
      // ignore backoff set failures
    }

    throw new Error(`AI provider failed for model ${args.model}`);
  }
}

/**
 * Get available providers based on environment configuration
 */
export function getAvailableProviders(): AiProvider[] {
  const available: AiProvider[] = [];

  if (process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_API_KEY) {
    available.push(...PROVIDERS.filter((p) => p.provider === 'openrouter'));
  }

  if (process.env.DEEPSEEK_API_KEY) {
    available.push(...PROVIDERS.filter((p) => p.provider === 'deepseek'));
  }

  if (process.env.OLLAMA_BASE_URL) {
    available.push(...PROVIDERS.filter((p) => p.provider === 'ollama'));
  }

  if (available.length === 0) {
    console.warn('[AI Provider] No providers configured, defaulting to OpenRouter');
    available.push(...PROVIDERS.filter((p) => p.provider === 'openrouter'));
  }

  return available;
}