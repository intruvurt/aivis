import { TIER_LIMITS } from '../../../shared/types.js';
import { getPool } from './postgresql.js';
import { sendPlatformNewsletterEmail } from './emailService.js';

export type NewsletterTier = 'observer' | 'alignment' | 'signal' | 'scorefix';

const NEWSLETTER_ENABLED = String(process.env.NEWSLETTER_AUTOMATION_ENABLED || '').toLowerCase();
const NEWSLETTER_INTERVAL_MS = Number(process.env.NEWSLETTER_INTERVAL_MS || 1000 * 60 * 60 * 6);
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

export function getCurrentNewsletterEditionKey(): string {
  return isoWeekKey(new Date());
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
  return {
    to: input.to,
    userName: input.userName,
    tierLabel: toTierLabel(tier),
    editionLabel: input.editionLabel,
    snapshot: input.snapshot,
    pricingSummary: pricingSummaryForTier(tier),
    referralSummary: referralSummary(),
    toolsSummary: toolsSummaryForTier(tier),
  };
}

function pricingSummaryForTier(tier: 'observer' | 'alignment' | 'signal' | 'scorefix'): string[] {
  const limits = TIER_LIMITS[tier];
  const common = [
    `${toTierLabel(tier)} includes ${limits.scansPerMonth}/month live scan allowance.`,
    `Pages per scan: ${limits.pagesPerScan}; cache retention: ${limits.cacheDays} days.`,
  ];

  if (tier === 'observer') {
    return [
      ...common,
      'Upgrade path: Alignment unlocks exports, report history, and competitor tracking.',
    ];
  }

  if (tier === 'alignment') {
    return [
      ...common,
      `Competitor slots: ${limits.competitors}. Signal adds API access, scheduled rescans, and white-label workflows.`,
    ];
  }

  if (tier === 'signal') {
    return [
      ...common,
      'Signal includes API keys, scheduled rescans, citation workflows, and white-label exports.',
    ];
  }

  return [
    ...common,
    'Score Fix includes high-volume scans plus thorough evidence-driven remediation workflows.',
  ];
}

function referralSummary(): string[] {
  return [
    'Referral credits are granted only after the referred user completes 5+ audits.',
    'If the referred user becomes paid (Alignment/Signal/Score Fix), both sides receive a 3x credit reward.',
    'Use Billing → Referrals to share your invite link and monitor pending vs granted referrals.',
  ];
}

function toolsSummaryForTier(tier: 'observer' | 'alignment' | 'signal' | 'scorefix'): string[] {
  const shared = [
    'Core Audit: six-category visibility scoring with evidence-linked recommendations.',
    'Keyword Intelligence: query opportunities mapped to AI interpretation and citation patterns.',
  ];

  if (tier === 'observer') {
    return [
      ...shared,
      'Upgrade to Alignment for competitor tracking, report exports, and reverse engineering tools.',
    ];
  }

  if (tier === 'alignment') {
    return [
      ...shared,
      'Competitors: side-by-side score movement and gap tracking.',
      'Reverse Engineer: decompile AI answers and model-diff prompt outputs.',
      'Reports: persistent history plus shareable outputs for teams.',
    ];
  }

  if (tier === 'signal') {
    return [
      ...shared,
      'Citations: monitor brand mention-rate across ChatGPT, Perplexity, Claude, and Google AI.',
      'Advanced Features: API keys, scheduled rescans, webhooks, and white-label branding.',
      'Triple-check workflow: multi-model validation for higher confidence outputs.',
    ];
  }

  return [
    ...shared,
    'Score Fix mode: issue-level remediation plans with validation checklists and evidence IDs.',
    'Full advanced stack: API, rescans, webhooks, citations, and white-label automation.',
  ];
}

export async function runNewsletterDispatchCycle(options: NewsletterDispatchOptions = {}): Promise<NewsletterDispatchResult> {
  const settings = await getNewsletterDispatchSettings();
  const editionKey = String(options.editionKey || isoWeekKey(new Date())).trim() || isoWeekKey(new Date());
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

  console.log(`[Newsletter] Runtime loop started (interval ${Math.round(NEWSLETTER_INTERVAL_MS / 60000)}m). Automation defaults to manual.`);

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
