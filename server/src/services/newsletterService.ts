import { getPool } from './postgresql.js';
import { sendPlatformNewsletterEmail } from './emailService.js';

export type NewsletterTier = 'observer' | 'alignment' | 'signal' | 'scorefix';

const NEWSLETTER_ENABLED = String(process.env.NEWSLETTER_AUTOMATION_ENABLED || '').toLowerCase();
const NEWSLETTER_INTERVAL_MS = Number(process.env.NEWSLETTER_INTERVAL_MS || 1000 * 60 * 60 * 24 * 14); // 14 days (biweekly)
const NEWSLETTER_BATCH_SIZE = Math.max(1, Number(process.env.NEWSLETTER_BATCH_SIZE || 200));
const NEWSLETTER_SEND_DELAY_MS = Math.max(500, Number(process.env.NEWSLETTER_SEND_DELAY_MS || 550));
const NEWSLETTER_AUTOMATION_DEFAULT = String(process.env.NEWSLETTER_AUTOMATION_DEFAULT || '').toLowerCase();
const NEWSLETTER_SETTINGS_KEY = 'newsletter.runtime';

export interface NewsletterDispatchSettings {
  automationEnabled: boolean;
  batchSize: number;
  delayMs: number;
  tierFilter: NewsletterTier[];
}

export interface NewsletterDispatchOptions {
  editionKey?: string;
  batchSize?: number;
  delayMs?: number;
  tierFilter?: NewsletterTier[];
  dryRun?: boolean;
  forceResend?: boolean;
}

export interface NewsletterDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  editionKey: string;
  batchSize: number;
  delayMs: number;
  tierFilter: NewsletterTier[];
}

function clampBatchSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NEWSLETTER_BATCH_SIZE;
  return Math.min(2000, Math.max(1, Math.floor(parsed)));
}

function clampDelayMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NEWSLETTER_SEND_DELAY_MS;
  return Math.min(10_000, Math.max(500, Math.floor(parsed)));
}

function normalizeTierFilter(input: unknown): NewsletterTier[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<NewsletterTier>();
  for (const value of input) {
    const normalized = normalizeTier(String(value || 'observer'));
    unique.add(normalized);
  }
  return Array.from(unique);
}

function automationEnabled(): boolean {
  if (NEWSLETTER_AUTOMATION_DEFAULT === 'true' || NEWSLETTER_AUTOMATION_DEFAULT === '1') return true;
  if (NEWSLETTER_AUTOMATION_DEFAULT === 'false' || NEWSLETTER_AUTOMATION_DEFAULT === '0') return false;
  if (NEWSLETTER_ENABLED === 'true' || NEWSLETTER_ENABLED === '1') return true;
  if (NEWSLETTER_ENABLED === 'false' || NEWSLETTER_ENABLED === '0') return false;
  return false;
}

const DEFAULT_DISPATCH_SETTINGS: NewsletterDispatchSettings = {
  automationEnabled: automationEnabled(),
  batchSize: NEWSLETTER_BATCH_SIZE,
  delayMs: NEWSLETTER_SEND_DELAY_MS,
  tierFilter: [],
};

export async function getNewsletterDispatchSettings(): Promise<NewsletterDispatchSettings> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_runtime_settings WHERE key = $1 LIMIT 1`,
      [NEWSLETTER_SETTINGS_KEY]
    );

    if (!rows[0]?.value || typeof rows[0].value !== 'object') {
      return { ...DEFAULT_DISPATCH_SETTINGS };
    }

    const value = rows[0].value as Record<string, unknown>;
    return {
      automationEnabled: Boolean(value.automationEnabled),
      batchSize: clampBatchSize(value.batchSize),
      delayMs: clampDelayMs(value.delayMs),
      tierFilter: normalizeTierFilter(value.tierFilter),
    };
  } catch {
    return { ...DEFAULT_DISPATCH_SETTINGS };
  }
}

export async function upsertNewsletterDispatchSettings(
  patch: Partial<NewsletterDispatchSettings>
): Promise<NewsletterDispatchSettings> {
  const current = await getNewsletterDispatchSettings();
  const next: NewsletterDispatchSettings = {
    automationEnabled:
      typeof patch.automationEnabled === 'boolean' ? patch.automationEnabled : current.automationEnabled,
    batchSize:
      typeof patch.batchSize === 'number' ? clampBatchSize(patch.batchSize) : current.batchSize,
    delayMs:
      typeof patch.delayMs === 'number' ? clampDelayMs(patch.delayMs) : current.delayMs,
    tierFilter: Array.isArray(patch.tierFilter) ? normalizeTierFilter(patch.tierFilter) : current.tierFilter,
  };

  const pool = getPool();
  await pool.query(
    `INSERT INTO admin_runtime_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [NEWSLETTER_SETTINGS_KEY, JSON.stringify(next)]
  );

  return next;
}

function isoWeekKey(input: Date): string {
  const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Biweekly edition key — groups into 2-week windows */
function biweeklyKey(input: Date): string {
  const weekKey = isoWeekKey(input);
  const [year, weekPart] = weekKey.split('-W');
  const weekNum = parseInt(weekPart, 10);
  // Group into pairs: weeks 1-2 → BW01, 3-4 → BW02, etc.
  const bwNum = Math.ceil(weekNum / 2);
  return `${year}-BW${String(bwNum).padStart(2, '0')}`;
}

export function getCurrentNewsletterEditionKey(): string {
  return biweeklyKey(new Date());
}

function toTierLabel(tier: string): string {
  const normalized = String(tier || 'observer').toLowerCase();
  if (normalized === 'alignment') return 'Alignment [Core]';
  if (normalized === 'signal') return 'Signal [Pro]';
  if (normalized === 'scorefix') return 'Score Fix [AutoFix PR]';
  return 'Observer [Free]';
}

function normalizeTier(tier: string): NewsletterTier {
  const normalized = String(tier || 'observer').toLowerCase();
  if (normalized === 'alignment' || normalized === 'signal' || normalized === 'scorefix') {
    return normalized;
  }
  return 'observer';
}

export function buildNewsletterEmailPayload(input: {
  to: string;
  userName?: string;
  tier: string;
  editionLabel: string;
  snapshot: {
    auditCount: number;
    latestScore: number | null;
  };
}) {
  const tier = normalizeTier(input.tier);
  const edition = selectEditionContent(input.editionLabel, tier);
  return {
    to: input.to,
    userName: input.userName,
    tierLabel: toTierLabel(tier),
    editionLabel: input.editionLabel,
    snapshot: input.snapshot,
    pricingSummary: edition.insightDigest,
    referralSummary: edition.actionableTips,
    toolsSummary: edition.featuredReads,
  };
}

// ─── Curated niche content engine ─────────────────────────────────────────────
// Rotates through topic pools to deliver fresh, valuable content each edition.
// Content is organised around AI visibility, AEO, citation readiness, and
// practical implementation — no fluff, no generic marketing copy.

const FRONTEND_URL_NL = (process.env.FRONTEND_URL || 'https://aivis.biz').split(',')[0].trim().replace(/\/+$/, '');

interface NicheBlock {
  topic: string;
  insights: string[];
  tips: string[];
  reads: string[];
}

const NICHE_CONTENT_POOL: NicheBlock[] = [
  {
    topic: 'AEO fundamentals',
    insights: [
      'Answer Engine Optimization (AEO) is not a replacement for SEO — it is a stricter, higher standard that demands extractable, citation-ready content.',
      'AI models like ChatGPT, Claude, and Perplexity evaluate schema quality, entity clarity, and answer-block depth before citation eligibility.',
      'Sites with zero structured data are invisible to AI answer engines even when they rank #1 on Google SERPs.',
    ],
    tips: [
      'Add FAQPage and HowTo schema to your highest-intent pages — these are prioritised by LLMs for answer extraction.',
      'Audit your robots.txt: blocking AI crawlers (GPTBot, ClaudeBot, PerplexityBot) drops you from training and retrieval pipelines.',
      'Run an AiVIS audit on your top 5 landing pages to identify exactly which extraction signals are missing.',
    ],
    reads: [
      `Why citation readiness matters more than ranking → ${FRONTEND_URL_NL}/blogs/answer-engine-optimization-2026-why-citation-readiness-matters`,
      `How LLMs parse your content: technical breakdown → ${FRONTEND_URL_NL}/blogs/how-llms-parse-your-content-technical-breakdown`,
      `AEO Playbook 2026: full strategy guide → ${FRONTEND_URL_NL}/aeo-playbook-2026`,
    ],
  },
  {
    topic: 'Schema & structured data',
    insights: [
      'JSON-LD is the only schema format consumed by all 4 major AI answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews).',
      'Websites with Organisation + Person + Article schema see 2-3× higher citation rates in LLM-generated answers.',
      'Microdata and RDFa are parsed inconsistently by LLMs — migrate to JSON-LD for reliable extraction.',
    ],
    tips: [
      'Every page should have at minimum: Organisation, WebSite, and the primary content schema (Article, Product, FAQPage, etc.).',
      'Validate your JSON-LD with Google\'s Rich Results Test and check AiVIS schema category score for AI-specific gaps.',
      'Add author schema (Person with sameAs links) to every article — this directly impacts E-E-A-T scoring in AI systems.',
    ],
    reads: [
      `JSON-LD blueprint for AI citation → ${FRONTEND_URL_NL}/blogs/json-ld-blueprint-for-ai-citation-2026`,
      `Structuring content for AI extraction → ${FRONTEND_URL_NL}/blogs/how-to-structure-content-for-ai-extraction-technical-guide`,
      `Getting Started Guide → ${FRONTEND_URL_NL}/guide`,
    ],
  },
  {
    topic: 'Citation testing & brand mentions',
    insights: [
      'Citation rate is measurable: you can test whether ChatGPT, Claude, Perplexity, and Google AI mention your brand for specific queries.',
      'Brand mentions in AI answers are influenced by recency, entity strength, and the density of corroborating sources across the web.',
      'Companies that actively monitor AI mentions catch citation drops 2-3 weeks before they impact pipeline.',
    ],
    tips: [
      'Set up citation tests for your top 10 target queries — track which AI models mention you and which don\'t.',
      'Strengthen your entity graph: ensure your brand appears consistently across Wikipedia, Crunchbase, LinkedIn, and industry directories.',
      'Publish original research and data — LLMs strongly prefer citing primary sources over derivative content.',
    ],
    reads: [
      `Brand mentions across AI training sources → ${FRONTEND_URL_NL}/blogs/brand-mentions-ai-training-sources`,
      `Reverse engineer what AI models know about you → ${FRONTEND_URL_NL}/blogs/reverse-engineer-ai-models`,
      `Why AI Visibility Matters → ${FRONTEND_URL_NL}/why-ai-visibility`,
    ],
  },
  {
    topic: 'E-E-A-T & author authority',
    insights: [
      'AI systems crawl Author.about, social profiles, and byline metadata to assess whether your content meets the authority threshold for citation.',
      'Sites without clear author attribution see 40%+ lower citation rates in LLM outputs compared to bylined content.',
      'E-E-A-T is no longer just a Google ranking signal — it is a citation eligibility filter that LLMs use to decide whether to include your source.',
    ],
    tips: [
      'Add Person schema with sameAs links to LinkedIn, Twitter, and any industry profiles for every content author.',
      'Include specific credentials, years of experience, and domain expertise in your author bios — vague bios are ignored by LLMs.',
      'Publish consistently under the same author entities; scattered, anonymous content fragments your authority signal.',
    ],
    reads: [
      `Building author authority for AI citations → ${FRONTEND_URL_NL}/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era`,
      `E-E-A-T in the AI era → ${FRONTEND_URL_NL}/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era`,
      `GEO & AI Ranking Guide → ${FRONTEND_URL_NL}/geo-ai-ranking-2026`,
    ],
  },
  {
    topic: 'Geo signals & local visibility',
    insights: [
      'LLMs exclude location-vague sources from location-specific queries at higher rates than traditional search engines.',
      'Multi-region sites without hreflang + geo schema see AI visibility fragmentation — different models surface different regional variants.',
      'Localised landing pages with venue-specific FAQPage schema see 2-3× citation improvement over generic national pages.',
    ],
    tips: [
      'Add PostalAddress and LocalBusiness schema to every location page, including lat/long coordinates.',
      'Use hreflang tags correctly across all language and region variants — AI crawlers respect these for regional disambiguation.',
      'Test your local queries in AiVIS citation testing to see which AI models surface your regional pages vs. competitors.',
    ],
    reads: [
      `Geo-adaptive AI ranking guide → ${FRONTEND_URL_NL}/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers`,
      `GEO Content Guidelines → ${FRONTEND_URL_NL}/geo-ai-ranking-2026`,
      `Insights Hub → ${FRONTEND_URL_NL}/insights`,
    ],
  },
  {
    topic: 'Score decay & continuous monitoring',
    insights: [
      'AI visibility scores decay over time as competitors improve their structure and AI models update their training data and retrieval logic.',
      'A score measured once is a snapshot; competitive advantage requires trend tracking across multiple audit cycles.',
      'Model updates from OpenAI, Anthropic, and Google can shift citation eligibility without any changes to your site.',
    ],
    tips: [
      'Re-audit your key pages at least biweekly to catch score drift early — use AiVIS scheduled rescans if available on your plan.',
      'Track competitor scores alongside your own to identify when gap changes are driven by your improvements vs. their deterioration.',
      'When your score drops without site changes, check the AiVIS changelog and AI model update announcements for systemic shifts.',
    ],
    reads: [
      `Score decay and AI visibility trends → ${FRONTEND_URL_NL}/blogs/score-decay-ai-visibility`,
      `500 audits: what AI actually cites → ${FRONTEND_URL_NL}/blogs/500-audits-what-ai-cites`,
      `Analytics & tracking → ${FRONTEND_URL_NL}/analytics`,
    ],
  },
  {
    topic: 'SEO vs AEO: the real differences',
    insights: [
      'A page can rank #1 for all keywords on Google and still be completely invisible in AI-generated answers — ranking ≠ extraction.',
      'Backlink volume, keyword density, and domain authority do not guarantee AI extractability — structure and schema quality are what matter.',
      'AI search is replacing 30-40% of traditional informational queries: if your strategy is SEO-only, you are invisible for a growing share of discovery.',
    ],
    tips: [
      'Map your top 20 organic keywords and test whether AI models cite you for those queries — the overlap is often shockingly low.',
      'Treat AI visibility as a parallel channel: track it with the same rigor you apply to Google Search Console data.',
      'Prioritise pages where you rank well on Google but score poorly on AiVIS — those are your highest-leverage improvement targets.',
    ],
    reads: [
      `Why traditional SEO fails for AI visibility → ${FRONTEND_URL_NL}/blogs/why-traditional-seo-tactics-fail-for-ai-visibility`,
      `AEO is not the new SEO, it\'s the big brother → ${FRONTEND_URL_NL}/blogs/answer-engine-optimization-is-not-the-new-seoits-the-big-brother`,
      `FAQ (27 answers) → ${FRONTEND_URL_NL}/faq`,
    ],
  },
  {
    topic: 'Competitor intelligence',
    insights: [
      'Your AI visibility score has no value in isolation — it only matters relative to the competitors your audience is comparing you against.',
      'Competitor gap analysis reveals which structural improvements give you the largest citation advantage for shared query spaces.',
      'The first mover in AI visibility wins disproportionately: LLMs develop citation habits that persist across model updates.',
    ],
    tips: [
      'Add your top 3 competitors in AiVIS competitor tracking and monitor score movement weekly.',
      'Focus on categories where competitors score higher: schema, content depth, and meta tags are the most actionable gaps.',
      'Use the reverse engineering tool to decompile AI answers for your target queries — see exactly which sources get cited and why.',
    ],
    reads: [
      `Reverse engineering AI models → ${FRONTEND_URL_NL}/blogs/reverse-engineer-ai-models`,
      `Why I built AiVIS → ${FRONTEND_URL_NL}/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai`,
      `Pricing & Plans → ${FRONTEND_URL_NL}/pricing`,
    ],
  },
];

/**
 * Select content for an edition. Uses the edition key to deterministically
 * rotate through the content pool so each biweekly edition gets different topics.
 * The content block selected depends on the edition number — no randomness,
 * fully reproducible, no duplicate risk.
 */
function selectEditionContent(editionKey: string, _tier: NewsletterTier): {
  insightDigest: string[];
  actionableTips: string[];
  featuredReads: string[];
} {
  // Derive a stable index from the edition key
  let hash = 0;
  for (let i = 0; i < editionKey.length; i++) {
    hash = ((hash << 5) - hash + editionKey.charCodeAt(i)) | 0;
  }
  const baseIndex = Math.abs(hash) % NICHE_CONTENT_POOL.length;

  // Pick 2 topic blocks per edition for variety
  const block1 = NICHE_CONTENT_POOL[baseIndex];
  const block2 = NICHE_CONTENT_POOL[(baseIndex + 1) % NICHE_CONTENT_POOL.length];

  return {
    insightDigest: [
      `🔬 ${block1.topic.toUpperCase()}`,
      ...block1.insights,
    ],
    actionableTips: [
      `⚡ ACTIONS YOU CAN TAKE THIS WEEK`,
      ...block1.tips.slice(0, 2),
      ...block2.tips.slice(0, 1),
    ],
    featuredReads: [
      `📖 RECOMMENDED READS`,
      ...block1.reads.slice(0, 2),
      ...block2.reads.slice(0, 1),
    ],
  };
}

export async function runNewsletterDispatchCycle(options: NewsletterDispatchOptions = {}): Promise<NewsletterDispatchResult> {
  const settings = await getNewsletterDispatchSettings();
  const editionKey = String(options.editionKey || biweeklyKey(new Date())).trim() || biweeklyKey(new Date());
  const batchSize = clampBatchSize(options.batchSize ?? settings.batchSize);
  const delayMs = clampDelayMs(options.delayMs ?? settings.delayMs);
  const tierFilter = normalizeTierFilter(options.tierFilter ?? settings.tierFilter);
  const dryRun = options.dryRun === true;
  const forceResend = options.forceResend === true;
  const pool = getPool();

  const params: unknown[] = [editionKey];
  const whereClauses: string[] = [
    `u.is_verified = TRUE`,
    `u.email IS NOT NULL`,
    `u.email <> ''`,
    `COALESCE(np.email_notifications, TRUE) = TRUE`,
  ];

  if (!forceResend) {
    whereClauses.push(`nd.id IS NULL`);
  }

  if (tierFilter.length > 0) {
    params.push(tierFilter);
    whereClauses.push(`COALESCE(u.tier, 'observer') = ANY($${params.length}::text[])`);
  }

  params.push(batchSize);
  const limitParam = params.length;

  const candidates = await pool.query(
    `SELECT u.id, u.email, u.name, COALESCE(u.tier, 'observer') AS tier
     FROM users u
     LEFT JOIN user_notification_preferences np
       ON np.user_id = u.id
     LEFT JOIN newsletter_dispatches nd
       ON nd.user_id = u.id AND nd.edition_key = $1
     WHERE ${whereClauses.join('\n       AND ')}
     ORDER BY u.created_at ASC
     LIMIT $${limitParam}`,
    params
  );

  let sent = 0;
  let failed = 0;

  for (const row of candidates.rows) {
    const userId = String(row.id);
    const tier = normalizeTier(String(row.tier || 'observer'));
    const email = String(row.email || '').trim();
    const name = String(row.name || '').trim();

    try {
      const auditSnapshot = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           (
             SELECT a2.visibility_score
             FROM audits a2
             WHERE a2.user_id = $1
             ORDER BY a2.created_at DESC
             LIMIT 1
           )::int AS latest_score
         FROM audits a
         WHERE a.user_id = $1`,
        [userId]
      );

      const auditCount = Number(auditSnapshot.rows[0]?.total || 0);
      const latestScoreRaw = auditSnapshot.rows[0]?.latest_score;
      const latestScore = Number.isFinite(Number(latestScoreRaw)) ? Number(latestScoreRaw) : null;

      const payload = buildNewsletterEmailPayload({
        to: email,
        userName: name,
        tier,
        editionLabel: editionKey,
        snapshot: {
          auditCount,
          latestScore,
        },
      });

      if (!dryRun) {
        await sendPlatformNewsletterEmail(payload);

        await pool.query(
          `INSERT INTO newsletter_dispatches (user_id, edition_key, channel, metadata)
           VALUES ($1, $2, 'email', $3)
           ON CONFLICT (user_id, edition_key) DO NOTHING`,
          [userId, editionKey, JSON.stringify({ tier, auditCount, latestScore })]
        );

        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }

      sent += 1;
    } catch (err: any) {
      failed += 1;
      console.error(
        `[Newsletter] Failed for user ${userId}:`,
        err?.message || err,
        err?.code ? `(code=${err.code})` : ''
      );
    }
  }

  return {
    attempted: candidates.rows.length,
    sent,
    failed,
    dryRun,
    editionKey,
    batchSize,
    delayMs,
    tierFilter,
  };
}

export function startNewsletterLoop(): void {
  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_NEWSLETTER_LOOP === 'true';
  if (globalDisable || loopDisable) {
    console.log('[Newsletter] Loop disabled via env (DISABLE_NEWSLETTER_LOOP or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  console.log(`[Newsletter] Runtime loop started (interval ${Math.round(NEWSLETTER_INTERVAL_MS / 86400000)}d biweekly). Automation defaults to manual.`);

  const run = async () => {
    try {
      const settings = await getNewsletterDispatchSettings();
      if (!settings.automationEnabled) return;

      const result = await runNewsletterDispatchCycle({
        batchSize: settings.batchSize,
        delayMs: settings.delayMs,
        tierFilter: settings.tierFilter,
      });

      if (result.attempted > 0) {
        console.log(`[Newsletter] attempted=${result.attempted}, sent=${result.sent}, failed=${result.failed}`);
      }
    } catch (err: any) {
      console.error('[Newsletter] Dispatch cycle failed:', err?.message || err);
    }
  };

  _newsletterIntervalId = setInterval(run, NEWSLETTER_INTERVAL_MS);
}

let _newsletterIntervalId: ReturnType<typeof setInterval> | null = null;

export function stopNewsletterLoop(): void {
  if (_newsletterIntervalId) {
    clearInterval(_newsletterIntervalId);
    _newsletterIntervalId = null;
    console.log('[Newsletter] Loop stopped');
  }
}
