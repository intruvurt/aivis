import { randomUUID } from 'crypto';
import { callAIProvider } from './aiProviders.js';
import { redisConnection } from '../infra/redis.js';
import { getPool } from './postgresql.js';

type MentionStrength = 'strong' | 'medium' | 'weak' | 'none';

type ModelResult = {
  model: string;
  prompt: string;
  cluster: 'discovery' | 'comparison' | 'decision';
  mentionsDomain: boolean;
  mentionsBrand: boolean;
  position: number | null;
  strength: MentionStrength;
  context: 'recommended' | 'example' | 'ignored';
  responseText: string;
};

type RunState = {
  runId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  domain: string;
  brand: string;
  progress: number;
  completedRuns: number;
  totalRuns: number;
  partial: ModelResult[];
  aggregate?: Record<string, unknown>;
  error?: string;
  updatedAt: string;
};

const RUN_TTL_SECONDS = 60 * 60;
const CACHE_TTL_SECONDS = 60 * 60 * 8;
const MODELS = [
  'openai/gpt-4.1-mini',
  'anthropic/claude-3.5-haiku',
  'meta-llama/llama-3.3-70b-instruct',
];

const PROMPT_CLUSTERS: Array<{ cluster: 'discovery' | 'comparison' | 'decision'; prompts: string[] }> = [
  {
    cluster: 'discovery',
    prompts: [
      'best AI visibility tools',
      'how to improve AI citation readiness',
      'tools for AI search visibility optimization',
    ],
  },
  {
    cluster: 'comparison',
    prompts: [
      'alternatives to semrush for AI visibility',
      'best tools to compare AI citation performance',
    ],
  },
  {
    cluster: 'decision',
    prompts: [
      'which AI visibility platform should I buy this month',
      'what tool should I use to improve AI answer inclusion',
    ],
  },
];

const VARIANTS = ['short answer', 'detailed explanation', 'list format', 'comparison style'];

function runKey(runId: string): string {
  return `visibility:run:${runId}`;
}

function dayKey(domain: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `visibility:cache:${domain}:${day}`;
}

function normalizeDomain(input: string): string {
  const trimmed = String(input || '').trim().toLowerCase();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function classifyMentionStrength(text: string, domain: string, brand: string): MentionStrength {
  const lower = text.toLowerCase();
  if (lower.includes(`recommended`) || lower.includes(`best`) || lower.includes(`top`)) {
    if (lower.includes(domain) || lower.includes(brand.toLowerCase())) return 'strong';
  }
  if (lower.includes(domain) || lower.includes(brand.toLowerCase())) return 'medium';
  if (lower.includes('example')) return 'weak';
  return 'none';
}

function extractPosition(text: string, domain: string, brand: string): number | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const target = [domain, brand.toLowerCase()].filter(Boolean);
  for (const line of lines) {
    const rankMatch = line.match(/^(\d{1,2})[.)\-:]/);
    if (!rankMatch) continue;
    const lower = line.toLowerCase();
    if (target.some((item) => lower.includes(item))) {
      return Number(rankMatch[1]);
    }
  }
  return null;
}

function detectContext(text: string, domain: string, brand: string): 'recommended' | 'example' | 'ignored' {
  const lower = text.toLowerCase();
  const mentioned = lower.includes(domain) || lower.includes(brand.toLowerCase());
  if (!mentioned) return 'ignored';
  if (lower.includes('recommend') || lower.includes('best') || lower.includes('top')) return 'recommended';
  return 'example';
}

async function saveRunState(state: RunState): Promise<void> {
  await redisConnection.set(runKey(state.runId), JSON.stringify(state), 'EX', RUN_TTL_SECONDS);
}

export async function getRealtimeVisibilityRun(runId: string): Promise<RunState | null> {
  const raw = await redisConnection.get(runKey(runId));
  if (!raw) return null;
  return JSON.parse(raw) as RunState;
}

async function initRunState(runId: string, domain: string, brand: string, totalRuns: number): Promise<RunState> {
  const state: RunState = {
    runId,
    status: 'queued',
    domain,
    brand,
    progress: 0,
    completedRuns: 0,
    totalRuns,
    partial: [],
    updatedAt: new Date().toISOString(),
  };
  await saveRunState(state);
  return state;
}

function aggregateResults(results: ModelResult[]) {
  const mentions = results.filter((r) => r.mentionsBrand || r.mentionsDomain);
  const mentionRate = results.length ? mentions.length / results.length : 0;
  const positions = mentions.map((r) => r.position).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgPosition = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;

  const strengthWeight = mentions.reduce((total, r) => {
    if (r.strength === 'strong') return total + 1;
    if (r.strength === 'medium') return total + 0.6;
    if (r.strength === 'weak') return total + 0.3;
    return total;
  }, 0);

  const avgRankWeight = avgPosition ? Math.max(0, 1 - (avgPosition - 1) / 10) : 0;
  const score = Math.round((mentionRate * 50 + avgRankWeight * 30 + (strengthWeight / Math.max(1, results.length)) * 20) * 100) / 100;

  const byCluster = ['discovery', 'comparison', 'decision'].reduce<Record<string, { mentionRate: number; runs: number }>>((acc, cluster) => {
    const scoped = results.filter((r) => r.cluster === cluster);
    const scopedMentions = scoped.filter((r) => r.mentionsBrand || r.mentionsDomain).length;
    acc[cluster] = { mentionRate: scoped.length ? scopedMentions / scoped.length : 0, runs: scoped.length };
    return acc;
  }, {});

  return {
    visibilityScore: Math.max(0, Math.min(100, score)),
    mentionRate,
    avgPosition,
    strength: mentionRate >= 0.66 ? 'strong' : mentionRate >= 0.35 ? 'medium' : 'weak',
    byCluster,
    samples: results.length,
  };
}

async function persistSnapshots(domain: string, results: ModelResult[]): Promise<void> {
  if (!results.length) return;
  const pool = getPool();
  await Promise.all(results.map((entry) =>
    pool.query(
      `INSERT INTO visibility_snapshots (prompt, engine, brand_found, position, cited_urls, competitors, sentiment, raw_text, captured_at)
       VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7, $8, NOW())`,
      [
        entry.prompt,
        entry.model,
        entry.mentionsDomain || entry.mentionsBrand,
        entry.position,
        [domain],
        [],
        entry.strength,
        entry.responseText.slice(0, 4000),
      ]
    )
  ));
}

async function runPromptWithModel(prompt: string, model: string, domain: string, brand: string): Promise<ModelResult> {
  const finalPrompt = `User query: ${prompt}\n\nReturn a practical answer with recommendations. Include domain names when relevant.`;
  const response = await callAIProvider({
    provider: 'openrouter',
    model,
    prompt: finalPrompt,
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '',
    opts: { temperature: 0.2, max_tokens: 500, timeoutMs: 16_000 },
  });

  const text = String(response || '');
  return {
    model,
    prompt,
    cluster: prompt.includes('alternative') || prompt.includes('compare') ? 'comparison' : prompt.includes('buy') || prompt.includes('should') ? 'decision' : 'discovery',
    mentionsDomain: text.toLowerCase().includes(domain),
    mentionsBrand: brand ? text.toLowerCase().includes(brand.toLowerCase()) : false,
    position: extractPosition(text, domain, brand),
    strength: classifyMentionStrength(text, domain, brand),
    context: detectContext(text, domain, brand),
    responseText: text,
  };
}

export async function startRealtimeVisibilityRun(args: {
  domain: string;
  brand?: string;
  runId?: string;
}): Promise<{ runId: string; cached: boolean }> {
  const domain = normalizeDomain(args.domain);
  if (!domain) throw new Error('Invalid domain');
  const brand = String(args.brand || domain).trim();
  const runId = args.runId || randomUUID();

  const promptSet = PROMPT_CLUSTERS.flatMap((cluster) =>
    cluster.prompts.flatMap((prompt) => VARIANTS.slice(0, 2).map((variant) => `${prompt} (${variant})`))
  ).slice(0, 12);

  const totalRuns = promptSet.length * MODELS.length;
  const dayCacheKey = dayKey(domain);
  const cacheRaw = await redisConnection.get(dayCacheKey);

  if (cacheRaw) {
    const aggregate = JSON.parse(cacheRaw);
    await saveRunState({
      runId,
      status: 'completed',
      domain,
      brand,
      progress: 100,
      completedRuns: totalRuns,
      totalRuns,
      partial: [],
      aggregate,
      updatedAt: new Date().toISOString(),
    });
    return { runId, cached: true };
  }

  await initRunState(runId, domain, brand, totalRuns);

  void (async () => {
    const state = await getRealtimeVisibilityRun(runId);
    if (!state) return;

    state.status = 'running';
    state.updatedAt = new Date().toISOString();
    await saveRunState(state);

    const allResults: ModelResult[] = [];
    let completed = 0;

    try {
      for (const prompt of promptSet) {
        const batch = await Promise.allSettled(MODELS.map((model) => runPromptWithModel(prompt, model, domain, brand)));
        for (const item of batch) {
          completed += 1;
          if (item.status === 'fulfilled') {
            allResults.push(item.value);
          }
        }

        const latestState = await getRealtimeVisibilityRun(runId);
        if (!latestState) break;
        latestState.partial = allResults.slice(-8);
        latestState.completedRuns = completed;
        latestState.progress = Math.min(96, Math.round((completed / totalRuns) * 100));
        latestState.updatedAt = new Date().toISOString();
        await saveRunState(latestState);
      }

      const aggregate = aggregateResults(allResults);
      await persistSnapshots(domain, allResults);
      await redisConnection.set(dayCacheKey, JSON.stringify(aggregate), 'EX', CACHE_TTL_SECONDS);

      await saveRunState({
        runId,
        status: 'completed',
        domain,
        brand,
        progress: 100,
        completedRuns: completed,
        totalRuns,
        partial: allResults.slice(-8),
        aggregate,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      await saveRunState({
        runId,
        status: 'failed',
        domain,
        brand,
        progress: Math.max(5, Math.round((completed / totalRuns) * 100)),
        completedRuns: completed,
        totalRuns,
        partial: allResults.slice(-8),
        error: err?.message || 'Realtime visibility run failed',
        updatedAt: new Date().toISOString(),
      });
    }
  })();

  return { runId, cached: false };
}

export async function getVisibilityHistory(domainInput: string, limit = 20): Promise<any[]> {
  const domain = normalizeDomain(domainInput);
  if (!domain) return [];
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const { rows } = await getPool().query(
    `SELECT captured_at::date AS day,
            ROUND(AVG(CASE WHEN brand_found THEN 1 ELSE 0 END)::numeric, 4) AS mention_rate,
            ROUND(AVG(COALESCE(position, 10))::numeric, 2) AS avg_position,
            COUNT(*)::int AS samples
       FROM visibility_snapshots
      WHERE $1 = ANY(cited_urls)
      GROUP BY captured_at::date
      ORDER BY day DESC
      LIMIT $2`,
    [domain, safeLimit]
  );
  return rows;
}
