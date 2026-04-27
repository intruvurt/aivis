/**
 * Auto Score Fix Service
 *
 * Generates evidence-backed code fixes from audit data using LLM analysis,
 * then creates real pull requests on GitHub, GitLab, or Bitbucket via REST API.
 * No git binary required - all PR operations use provider REST APIs.
 *
 * Credit model:
 *   - Cost: AUTO_SCORE_FIX_CREDIT_COST credits per job
 *   - Minimum balance required: AUTO_SCORE_FIX_CREDIT_COST
 *   - PR expires after 48 hours
 *   - No refund after confirmed PR or code push
 *   - Full refund only for technical failures before code reaches VCS
 */

import crypto from 'crypto';
import { getPool, executeTransaction } from './postgresql.js';
import { consumePackCredits } from './scanPackCredits.js';
import { appendCreditLedgerEvent, getCreditLedgerBalance } from './creditLedger.js';
import {
  computeLatentPriority,
  computeQueueDelayMs,
  normalizeFairnessBoost,
  type AgentExecutionProfile,
  type ExecutionRequest,
} from './executionExchange.js';
import { callAIProvider, SIGNAL_AI1 } from './aiProviders.js';
import { renderPrompt } from './promptRegistry.js';
import { isGitHubAppConfigured, getInstallationForUser, getInstallationForWorkspace, createPRViaApp } from './githubAppService.js';
import { mapRuleResultsToIntents, getDeterministicIntents } from './fixIntentMapper.js';
import { buildDeterministicPatches } from './deterministicPatchBuilder.js';
import { generateLineDiff, type FileDiff } from './fixDiffService.js';
import type { SSFRRuleResult, SSFREvidenceItem } from '../../../shared/types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const AUTO_SCORE_FIX_CREDIT_COST = 10;
export const AUTO_SCORE_FIX_EXPIRY_HOURS = 48;
export const AUTO_SCORE_FIX_REFUND_PERCENT = 0;
export const AUTO_SCORE_FIX_FEE_PERCENT = 0;

/**
 * Ledger Watch Mode — ScoreFix tier always-on configuration.
 *
 * The background worker uses these values when operating in continuous
 * evidence repair mode for Score Fix subscribers.
 *
 * continuousMonitoring — enables the always-on repair loop
 * intervalHours        — how often to evaluate ledger drift (default: 6h)
 * autoFixThreshold     — minimum visibility score below which a repair PR
 *                        is auto-queued without manual trigger (0–100)
 * maxPRsPerWeek        — hard cap on auto-generated PRs per user per week;
 *                        prevents runaway spend and merge noise
 */
export const LEDGER_WATCH_CONFIG = {
  continuousMonitoring: true,
  intervalHours: 6,
  autoFixThreshold: 70,
  maxPRsPerWeek: 5,
} as const;

/**
 * AutoFix execution mode — must be explicitly escalated to production_pr.
 *
 * dry_run      — generate fix plan + diff preview, no VCS write. Default.
 * staging_pr   — create PR on a staging/preview branch; no main-branch write.
 * production_pr — create PR targeting the actual base branch.
 *                 Requires alignment+ tier AND a manual override token.
 */
export type AutoFixMode = 'dry_run' | 'staging_pr' | 'production_pr';

/** Minimum tier required to escalate to production_pr */
export const PRODUCTION_PR_MIN_TIER = 'alignment' as const;

export type VcsProvider = 'github' | 'gitlab' | 'bitbucket';
export type JobStatus =
  | 'pending'
  | 'generating'
  | 'creating_pr'
  | 'pending_approval'
  | 'cancelled'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'failed';

export interface AutoScoreFixJobInput {
  userId: string;
  workspaceId: string;
  auditId?: string;
  targetUrl: string;
  vcsProvider: VcsProvider;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  encryptedToken: string;
  repoTree?: string[];
  /**
   * Execution mode. Defaults to 'dry_run' when omitted.
   * 'production_pr' requires alignment+ tier + productionOverrideToken.
   */
  mode?: AutoFixMode;
  /**
   * Required when mode = 'production_pr'.
   * Must be a server-side token stored in the users table (production_override_token).
   * Prevents accidental production PR creation from the UI default path.
   */
  productionOverrideToken?: string;
  auditEvidence: {
    visibility_score: number;
    recommendations: Array<{
      title: string;
      description: string;
      priority: string;
      category: string;
      implementation?: string;
      evidence_ids?: string[];
    }>;
    technical_signals?: Record<string, unknown>;
    schema_markup?: Record<string, unknown>;
    content_analysis?: Record<string, unknown>;
    private_exposure_scan?: {
      summary?: {
        exposure_surface_score?: number;
        score_band?: string;
        verdict?: string;
        top_priorities?: string[];
      };
      findings?: Array<{
        title?: string;
        domain?: string;
        severity?: string;
        what_was_observed?: string;
        fix_path?: string[];
      }>;
    };
  };
}

export interface FileChange {
  path: string;
  content: string;
  operation: 'create' | 'update';
  justification: string;
  /** Line-level diff (populated during PR creation when before-content is available) */
  diff?: FileDiff;
  /** True when this patch was generated deterministically without LLM */
  is_deterministic?: boolean;
  /** Non-fatal validation warnings from the patch validator */
  validation_warnings?: string[];
}

export interface AutoScoreFixPlan {
  summary: string;
  score_before: number;
  projected_score_lift: string;
  evidence_count: number;
  file_changes: FileChange[];
  pr_title: string;
  pr_body: string;
  /** Number of file changes generated without LLM (deterministic engine) */
  deterministic_patches_count?: number;
}

type JobExecutionRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  audit_id: string | null;
  target_url: string;
  vcs_provider: VcsProvider;
  repo_owner: string;
  repo_name: string;
  repo_branch: string;
  pr_number: number | null;
  status: JobStatus;
  fix_plan: AutoScoreFixPlan | null;
  evidence_snapshot: AutoScoreFixJobInput['auditEvidence'];
  encrypted_token: string | null;
  created_at: string;
};

async function refundFailureCredits(userId: string, jobId: string, amount: number): Promise<void> {
  const pool = getPool();
  const refundAmount = Math.round(Math.max(0, Number(amount || 0)) * 100) / 100;
  if (refundAmount <= 0) return;

  await executeTransaction(async (client: any) => {
    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
             updated_at = NOW()`,
      [userId, refundAmount]
    );

    const { rows } = await client.query(
      'SELECT credits_remaining FROM scan_pack_credits WHERE user_id = $1',
      [userId]
    );
    await appendCreditLedgerEvent({
      userId,
      type: 'refund',
      delta: refundAmount,
      source: 'system',
      requestId: `asf-refund-failure:${jobId}`,
      metadata: { jobId, reason: 'auto_score_fix_refund_failure' },
      client,
    });

    const balanceAfter = await getCreditLedgerBalance(userId, client);

    await client.query(
      `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        refundAmount,
        balanceAfter,
        'auto_score_fix_refund_failure',
        JSON.stringify({ jobId, reason: 'Job failed - full refund' }),
      ]
    );
  });
}

// ─── Token Encryption ─────────────────────────────────────────────────────────

const ENCRYPTION_KEY_MATERIAL = (() => {
  const key = (process.env.JWT_SECRET || '').trim();
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('VCS token encryption requires JWT_SECRET in production');
  }
  return key || 'aivis-default-key-dev-only';
})();

function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY_MATERIAL).digest();
}

export function encryptVcsToken(plainToken: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptVcsToken(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = deriveKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function tokenHint(plain: string): string {
  if (plain.length <= 8) return '****';
  return plain.slice(0, 4) + '****' + plain.slice(-4);
}

// ─── VCS Token Store ─────────────────────────────────────────────────────────

export async function saveVcsToken(
  userId: string,
  provider: VcsProvider,
  plainToken: string
): Promise<void> {
  const pool = getPool();
  const enc = encryptVcsToken(plainToken);
  const hint = tokenHint(plainToken);
  const scopeHint = provider === 'github' ? ['repo', 'pull_request'] : ['api', 'merge_request'];
  await pool.query(
    `INSERT INTO vcs_tokens (user_id, provider, encrypted_token, token_hint, scopes, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, provider) DO UPDATE
       SET encrypted_token = $3, token_hint = $4, scopes = $5, updated_at = NOW()`,
    [userId, provider, enc, hint, scopeHint]
  );
}

export async function getVcsToken(
  userId: string,
  provider: VcsProvider
): Promise<{ encrypted: string; hint: string } | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT encrypted_token, token_hint FROM vcs_tokens WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );
  if (!rows.length) return null;
  return { encrypted: rows[0].encrypted_token, hint: rows[0].token_hint };
}

export async function listVcsTokens(
  userId: string
): Promise<Array<{ provider: string; hint: string; updated_at: string }>> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT provider, token_hint, updated_at FROM vcs_tokens WHERE user_id = $1 ORDER BY provider',
    [userId]
  );
  return rows.map((r) => ({ provider: r.provider, hint: r.token_hint, updated_at: r.updated_at }));
}

export async function deleteVcsToken(userId: string, provider: VcsProvider): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM vcs_tokens WHERE user_id = $1 AND provider = $2', [userId, provider]);
}

// ─── Repo Tree Fetch ──────────────────────────────────────────────────────────

export async function fetchRepoTreePaths(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string[]> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AiVIS.biz-AutoScoreFix/1.0',
    },
  });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return Array.isArray(data?.tree)
    ? data.tree
      .filter((item: any) => item.type === 'blob')
      .slice(0, 300)
      .map((item: any) => String(item.path))
    : [];
}

// ─── LLM Fix Plan Generation ──────────────────────────────────────────────────

export async function generateFixPlan(input: AutoScoreFixJobInput): Promise<AutoScoreFixPlan> {
  const topRecs = (input.auditEvidence.recommendations || [])
    .filter((r) => r.priority === 'high' || r.priority === 'medium')
    .slice(0, 8);

  const evidenceJson = JSON.stringify(
    {
      target_url: input.targetUrl,
      current_score: input.auditEvidence.visibility_score,
      top_recommendations: topRecs,
      technical_signals: input.auditEvidence.technical_signals || {},
      schema_markup: input.auditEvidence.schema_markup || {},
      private_exposure_scan: input.auditEvidence.private_exposure_scan
        ? {
          summary: input.auditEvidence.private_exposure_scan.summary || {},
          findings: Array.isArray(input.auditEvidence.private_exposure_scan.findings)
            ? input.auditEvidence.private_exposure_scan.findings.slice(0, 15)
            : [],
        }
        : null,
    },
    null,
    2
  );

  const repoTreeSection = input.repoTree?.length
    ? `\nREPOSITORY FILE STRUCTURE (actual file paths in ${input.repoOwner}/${input.repoName}@${input.repoBranch}):\n${input.repoTree.join('\n')}\n\nIMPORTANT: Only create or update files at paths that follow the conventions visible in the repository structure above. Match the existing directory layout, naming conventions, and framework patterns. Do NOT invent paths that conflict with or ignore the repo structure.`
    : '';

  const promptConfig = renderPrompt('scorefix.fix_plan', {
    evidenceJson,
    repoTreeSection,
    repoTreeShown: Boolean(input.repoTree?.length),
    scoreBefore: input.auditEvidence.visibility_score,
    targetUrl: input.targetUrl,
  });

  const raw = await callAIProvider({
    provider: SIGNAL_AI1.provider,
    model: SIGNAL_AI1.model,
    prompt: promptConfig.prompt,
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '',
    opts: {
      systemPrompt: promptConfig.systemPrompt,
      max_tokens: 4000,
      temperature: 0.15,
      responseFormat: 'json_object',
      timeoutMs: 45_000,
    },
  });

  let parsed: AutoScoreFixPlan;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Attempt to extract JSON from prose output
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('LLM did not return parseable JSON for fix plan');
    parsed = JSON.parse(match[0]);
  }

  if (!parsed.file_changes || !Array.isArray(parsed.file_changes)) {
    throw new Error('Fix plan missing file_changes array');
  }

  return parsed;
}

// ─── Hybrid Fix Plan (deterministic first, LLM second) ───────────────────────

/**
 * Load SSFR rule results and evidence for an audit from the database.
 * Returns empty arrays when the audit has no SSFR data.
 */
async function loadSsfrDataForAudit(auditId: string): Promise<{
  ruleResults: SSFRRuleResult[];
  evidence: SSFREvidenceItem[];
}> {
  const pool = getPool();

  const [rrRes, evRes] = await Promise.all([
    pool.query<{
      rule_id: string; family: string; title: string; passed: boolean;
      severity: string; is_hard_blocker: boolean; score_cap: number | null;
      evidence_ids: unknown; details: unknown;
    }>(
      `SELECT rule_id, COALESCE(family,'source') AS family, COALESCE(title,'') AS title,
              passed, COALESCE(severity,'medium') AS severity,
              COALESCE(is_hard_blocker, false) AS is_hard_blocker,
              score_cap,
              COALESCE(evidence_ids, '[]'::jsonb)::jsonb AS evidence_ids,
              details
       FROM audit_rule_results
       WHERE audit_id = $1`,
      [auditId],
    ),
    pool.query<{
      family: string; evidence_key: string; value: unknown;
      source: string; confidence: string; notes: unknown;
    }>(
      `SELECT COALESCE(family,'source') AS family, COALESCE(evidence_key,'') AS evidence_key,
              value, COALESCE(source,'scraper') AS source,
              COALESCE(confidence, 1.0) AS confidence,
              notes
       FROM audit_evidence
       WHERE audit_id = $1`,
      [auditId],
    ),
  ]);

  const ruleResults: SSFRRuleResult[] = rrRes.rows.map(r => ({
    family: r.family as SSFRRuleResult['family'],
    rule_id: r.rule_id,
    title: r.title,
    passed: r.passed,
    severity: (r.severity ?? 'medium') as SSFRRuleResult['severity'],
    is_hard_blocker: r.is_hard_blocker,
    score_cap: r.score_cap ?? undefined,
    evidence_ids: Array.isArray(r.evidence_ids) ? (r.evidence_ids as string[]) : [],
    details: r.details ? (r.details as Record<string, unknown>) : undefined,
  }));

  const evidence: SSFREvidenceItem[] = evRes.rows.map(e => ({
    family: e.family as SSFREvidenceItem['family'],
    evidence_key: e.evidence_key,
    value: e.value,
    source: e.source,
    status: 'present' as const,
    confidence: parseFloat(String(e.confidence)),
    notes: e.notes,
  }));

  return { ruleResults, evidence };
}

/**
 * Hybrid plan generation:
 *  1. Load SSFR rule results from DB (if auditId present)
 *  2. Build deterministic patches for auto-generatable rules
 *  3. Fall back to LLM only for non-deterministic issues
 *
 * The returned plan has `is_deterministic` flagged per file change.
 * Diffs are generated from empty "before" at this stage — they are
 * enriched with real repo content later in processAutoScoreFixJob().
 */
export async function generateHybridFixPlan(
  input: AutoScoreFixJobInput,
): Promise<AutoScoreFixPlan> {
  // Step 1 — Load SSFR data from DB if we have an audit_id
  let ruleResults: SSFRRuleResult[] = [];
  let evidence: SSFREvidenceItem[] = [];

  if (input.auditId) {
    try {
      ({ ruleResults, evidence } = await loadSsfrDataForAudit(input.auditId));
    } catch (err: unknown) {
      console.warn('[AutoScoreFix] Failed to load SSFR data for hybrid plan:', (err as Error).message);
    }
  }

  // Step 2 — Build deterministic patches
  const intents = mapRuleResultsToIntents(ruleResults, evidence, input.targetUrl);
  const deterministicIntents = getDeterministicIntents(intents);
  const deterministicPatches = buildDeterministicPatches(
    deterministicIntents,
    evidence,
    input.targetUrl,
    {}, // before-content populated later from GitHub
  );

  const deterministicChanges: FileChange[] = deterministicPatches.map(p => ({
    path: p.targetFile,
    content: p.content,
    operation: p.operation,
    justification: p.justification,
    diff: p.diff,
    is_deterministic: true,
    validation_warnings: p.validation.warnings,
  }));

  // Step 3 — If no/few deterministic patches, supplement with LLM plan
  // Always call LLM for content rewrites and non-deterministic issues
  const llmPlan = await generateFixPlan(input);

  // Merge: deterministic patches take priority; LLM fills the gaps
  // Deduplicate by target path — deterministic wins
  const deterministicPaths = new Set(deterministicChanges.map(c => c.path));
  const llmChanges = llmPlan.file_changes.filter(c => !deterministicPaths.has(c.path));

  const allChanges = [
    ...deterministicChanges,
    ...llmChanges.map(c => ({ ...c, is_deterministic: false })),
  ].slice(0, 8); // cap at 8 file changes

  return {
    summary: deterministicChanges.length > 0
      ? `${deterministicChanges.length} deterministic fix(es) + ${llmChanges.length} AI-assisted fix(es). ${llmPlan.summary}`
      : llmPlan.summary,
    score_before: llmPlan.score_before,
    projected_score_lift: llmPlan.projected_score_lift,
    evidence_count: llmPlan.evidence_count + deterministicChanges.length,
    file_changes: allChanges,
    pr_title: llmPlan.pr_title,
    pr_body: llmPlan.pr_body,
    deterministic_patches_count: deterministicChanges.length,
  };
}

// ─── GitHub PR Creation (REST only) ──────────────────────────────────────────

async function createGitHubPR(
  token: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  plan: AutoScoreFixPlan
): Promise<{ pr_number: number; pr_url: string }> {
  const baseUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'AiVIS.biz-AutoScoreFix/1.0',
  };

  // 1. Get base branch SHA
  const refRes = await fetch(`${baseUrl}/git/refs/heads/${baseBranch}`, { headers });
  if (!refRes.ok) {
    const err = await refRes.text();
    throw new Error(`GitHub: failed to get base branch ref: ${err.slice(0, 200)}`);
  }
  const refData = await refRes.json() as any;
  const baseSha = refData.object?.sha;
  if (!baseSha) throw new Error('GitHub: could not read base branch SHA');

  // 2. Create fix branch
  const fixBranch = `aivis-scorefix-${Date.now()}`;
  const createBranchRes = await fetch(`${baseUrl}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${fixBranch}`, sha: baseSha }),
  });
  if (!createBranchRes.ok) {
    const err = await createBranchRes.text();
    throw new Error(`GitHub: failed to create fix branch: ${err.slice(0, 200)}`);
  }

  // 3. Commit each file
  for (const change of plan.file_changes) {
    const contentB64 = Buffer.from(change.content, 'utf8').toString('base64');
    // Check if file exists for SHA (needed for update)
    let existingSha: string | undefined;
    try {
      const existRes = await fetch(`${baseUrl}/contents/${change.path}?ref=${fixBranch}`, { headers });
      if (existRes.ok) {
        const existData = await existRes.json() as any;
        existingSha = existData.sha;
      }
    } catch {
      // file doesn't exist - create
    }

    const body: Record<string, unknown> = {
      message: `fix(aivis): ${change.justification.slice(0, 72)}`,
      content: contentB64,
      branch: fixBranch,
    };
    if (existingSha) body.sha = existingSha;

    const putRes = await fetch(`${baseUrl}/contents/${change.path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`GitHub: failed to commit ${change.path}: ${err.slice(0, 200)}`);
    }
  }

  // 4. Create PR
  const prRes = await fetch(`${baseUrl}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: plan.pr_title,
      body: plan.pr_body,
      head: fixBranch,
      base: baseBranch,
      draft: false,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.text();
    throw new Error(`GitHub: failed to create PR: ${err.slice(0, 300)}`);
  }
  const prData = await prRes.json() as any;
  return { pr_number: prData.number, pr_url: prData.html_url };
}

// ─── GitLab MR Creation (REST only) ──────────────────────────────────────────

async function createGitLabMR(
  token: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  plan: AutoScoreFixPlan
): Promise<{ pr_number: number; pr_url: string }> {
  const projectPath = encodeURIComponent(`${repoOwner}/${repoName}`);
  const baseUrl = `https://gitlab.com/api/v4/projects/${projectPath}`;
  const headers = {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
    'User-Agent': 'AiVIS.biz-AutoScoreFix/1.0',
  };

  const fixBranch = `aivis-scorefix-${Date.now()}`;

  // Create branch first
  const branchRes = await fetch(`${baseUrl}/repository/branches`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ branch: fixBranch, ref: baseBranch }),
  });
  if (!branchRes.ok) {
    const err = await branchRes.text();
    throw new Error(`GitLab: failed to create branch: ${err.slice(0, 200)}`);
  }

  // Commit all files in a single API call (GitLab supports multi-file commits)
  const actions = plan.file_changes.map((change) => ({
    action: change.operation === 'create' ? 'create' : 'update',
    file_path: change.path,
    content: change.content,
    encoding: 'text',
  }));

  const commitRes = await fetch(`${baseUrl}/repository/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      branch: fixBranch,
      commit_message: `fix(aivis): Auto Score Fix - evidence-backed visibility improvements\n\n${plan.summary}`,
      actions,
    }),
  });
  if (!commitRes.ok) {
    const err = await commitRes.text();
    throw new Error(`GitLab: failed to commit files: ${err.slice(0, 200)}`);
  }

  // Create MR
  const mrRes = await fetch(`${baseUrl}/merge_requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_branch: fixBranch,
      target_branch: baseBranch,
      title: plan.pr_title,
      description: plan.pr_body,
      remove_source_branch: true,
    }),
  });
  if (!mrRes.ok) {
    const err = await mrRes.text();
    throw new Error(`GitLab: failed to create MR: ${err.slice(0, 300)}`);
  }
  const mrData = await mrRes.json() as any;
  return { pr_number: mrData.iid, pr_url: mrData.web_url };
}

// ─── Bitbucket PR Creation (REST only) ───────────────────────────────────────

async function createBitbucketPR(
  token: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  plan: AutoScoreFixPlan
): Promise<{ pr_number: number; pr_url: string }> {
  const baseUrl = `https://api.bitbucket.org/2.0/repositories/${repoOwner}/${repoName}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'AiVIS.biz-AutoScoreFix/1.0',
  };

  const fixBranch = `aivis-scorefix-${Date.now()}`;

  // Bitbucket: create branch + files via /src with form-data
  const formData = new FormData();
  formData.append('branch', fixBranch);
  formData.append('message', `fix(aivis): Auto Score Fix - ${plan.summary}`);
  formData.append('parents', baseBranch);

  for (const change of plan.file_changes) {
    formData.append(change.path, new Blob([change.content], { type: 'text/plain' }), change.path);
  }

  const srcRes = await fetch(`${baseUrl}/src`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!srcRes.ok) {
    const err = await srcRes.text();
    throw new Error(`Bitbucket: failed to create branch/files: ${err.slice(0, 200)}`);
  }

  // Create PR
  const prRes = await fetch(`${baseUrl}/pullrequests`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: plan.pr_title,
      description: plan.pr_body,
      source: { branch: { name: fixBranch } },
      destination: { branch: { name: baseBranch } },
      close_source_branch: true,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.text();
    throw new Error(`Bitbucket: failed to create PR: ${err.slice(0, 300)}`);
  }
  const prData = await prRes.json() as any;
  return { pr_number: prData.id, pr_url: prData.links?.html?.href || '' };
}

// ─── Main Job Submission ──────────────────────────────────────────────────────

export async function submitAutoScoreFixJob(input: AutoScoreFixJobInput): Promise<string> {
  const pool = getPool();

  // ── Mode enforcement ─────────────────────────────────────────────────────
  // Default to dry_run when mode is omitted.
  const mode: AutoFixMode = input.mode ?? 'dry_run';

  if (mode === 'production_pr') {
    // Require alignment+ tier
    const { meetsMinimumTier, uiTierFromCanonical } = await import('../../../shared/types.js');
    const { rows: userRows } = await pool.query(
      `SELECT tier, production_override_token FROM users WHERE id = $1`,
      [input.userId],
    );
    const userTier = uiTierFromCanonical(userRows[0]?.tier ?? 'observer');
    if (!meetsMinimumTier(userTier, PRODUCTION_PR_MIN_TIER)) {
      throw new Error(
        `production_pr mode requires ${PRODUCTION_PR_MIN_TIER}+ tier. ` +
        `Current tier: ${userTier}. Use mode='dry_run' or upgrade your plan.`,
      );
    }
    // Require override token
    const storedToken = userRows[0]?.production_override_token;
    if (!storedToken || storedToken !== input.productionOverrideToken) {
      throw new Error(
        'production_pr mode requires a valid productionOverrideToken. ' +
        'Obtain your token from Settings → Operator Mode → AutoFix.',
      );
    }
  }

  // dry_run: generate plan + diff, skip VCS write entirely, return synthetic job id
  if (mode === 'dry_run') {
    const plan = await generateHybridFixPlan(input);
    return JSON.stringify({ dry_run: true, plan });
  }

  // staging_pr: target a dedicated staging branch instead of the user's base branch
  const effectiveBranch =
    mode === 'staging_pr' ? `staging/aivis-preview-${Date.now()}` : input.repoBranch;

  const adjustedInput: AutoScoreFixJobInput = { ...input, repoBranch: effectiveBranch, mode };

  // 1. Deduct credits upfront (atomic)
  const { consumed } = await consumePackCredits(
    input.userId,
    AUTO_SCORE_FIX_CREDIT_COST,
    'auto_score_fix',
    { targetUrl: input.targetUrl, vcsProvider: input.vcsProvider }
  );
  if (!consumed) {
    throw new Error(
      `Insufficient credits. Auto Score Fix requires ${AUTO_SCORE_FIX_CREDIT_COST} credits.`
    );
  }

  // 2. Create job record (using adjusted branch for staging_pr)
  const expiresAt = new Date(Date.now() + AUTO_SCORE_FIX_EXPIRY_HOURS * 60 * 60 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO auto_score_fix_jobs
       (user_id, workspace_id, audit_id, target_url, vcs_provider, repo_owner, repo_name, repo_branch,
        status, credits_spent, expires_at, evidence_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'generating',$9,$10,$11)
     RETURNING id`,
    [
      adjustedInput.userId,
      adjustedInput.workspaceId,
      adjustedInput.auditId || null,
      adjustedInput.targetUrl,
      adjustedInput.vcsProvider,
      adjustedInput.repoOwner,
      adjustedInput.repoName,
      adjustedInput.repoBranch,
      AUTO_SCORE_FIX_CREDIT_COST,
      expiresAt.toISOString(),
      JSON.stringify(adjustedInput.auditEvidence),
    ]
  );
  const jobId: string = rows[0].id;

  // 3. Attempt immediate execution; durable worker loop will retry/resume if interrupted.
  void processAutoScoreFixJob(jobId).catch((err: any) => {
    console.error(`[AutoScoreFix] Immediate execution failed for ${jobId}:`, err?.message || err);
  });

  return jobId;
}

async function loadJobExecutionRow(jobId: string): Promise<JobExecutionRow | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT j.id, j.user_id, j.workspace_id, j.audit_id, j.target_url, j.vcs_provider, j.repo_owner, j.repo_name, j.repo_branch,
            j.pr_number, j.status, j.fix_plan, j.evidence_snapshot, j.created_at, t.encrypted_token
     FROM auto_score_fix_jobs j
     LEFT JOIN vcs_tokens t ON t.user_id = j.user_id AND t.provider = j.vcs_provider
     WHERE j.id = $1
     LIMIT 1`,
    [jobId]
  );
  if (!rows.length) return null;

  const raw = rows[0] as any;
  return {
    id: raw.id,
    user_id: raw.user_id,
    workspace_id: raw.workspace_id,
    audit_id: raw.audit_id || null,
    target_url: raw.target_url,
    vcs_provider: raw.vcs_provider,
    repo_owner: raw.repo_owner,
    repo_name: raw.repo_name,
    repo_branch: raw.repo_branch,
    pr_number: raw.pr_number != null ? Number(raw.pr_number) : null,
    status: raw.status,
    fix_plan: raw.fix_plan || null,
    evidence_snapshot: raw.evidence_snapshot || { visibility_score: 0, recommendations: [] },
    encrypted_token: raw.encrypted_token || null,
    created_at: raw.created_at,
  };
}

/**
 * Fetch before-content for each file change from GitHub and populate diffs.
 * This gives reviewers a real before/after view of what the PR will change.
 * Failures are non-fatal — the plan is returned as-is if fetching fails.
 */
async function populateDiffsFromGitHub(
  plan: AutoScoreFixPlan,
  token: string,
  repoOwner: string,
  repoName: string,
  branch: string,
): Promise<AutoScoreFixPlan> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'AiVIS.biz-AutoScoreFix/1.0',
  };
  const baseUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;

  const enriched = await Promise.all(
    plan.file_changes.map(async (change): Promise<FileChange> => {
      // Skip creates that already have a diff (e.g. from deterministic builder)
      if (change.operation === 'create' && change.diff?.has_changes) return change;
      // Skip if diff already fully populated from a deterministic patch
      if (change.is_deterministic && change.diff) return change;

      try {
        const res = await fetch(`${baseUrl}/contents/${change.path}?ref=${branch}`, { headers });
        if (!res.ok) {
          // File doesn't exist yet — diff is already an all-additions diff from content
          if (!change.diff) {
            return { ...change, diff: generateLineDiff('', change.content) };
          }
          return change;
        }
        const data = await res.json() as { content?: string };
        const beforeContent = data.content
          ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8')
          : '';
        return { ...change, diff: generateLineDiff(beforeContent, change.content) };
      } catch {
        return change;
      }
    })
  );

  return { ...plan, file_changes: enriched };
}

async function markJobFailedWithRefund(jobId: string, userId: string, reason: string): Promise<void> {
  const pool = getPool();
  const safeReason = String(reason || 'Unknown error').slice(0, 500);

  const { rows } = await pool.query(
    `UPDATE auto_score_fix_jobs
     SET status='failed',
         error_message=$1,
         updated_at=NOW()
     WHERE id=$2
       AND status IN ('pending', 'generating', 'creating_pr')
     RETURNING id, refund_processed_at` ,
    [safeReason, jobId]
  );

  if (!rows.length) return;
  const alreadyRefunded = Boolean(rows[0]?.refund_processed_at);
  if (alreadyRefunded) return;

  await refundFailureCredits(userId, jobId, AUTO_SCORE_FIX_CREDIT_COST);
  await pool.query(
    `UPDATE auto_score_fix_jobs
     SET refund_processed_at = NOW(),
         refund_credits = $1,
         updated_at = NOW()
     WHERE id = $2 AND refund_processed_at IS NULL`,
    [AUTO_SCORE_FIX_CREDIT_COST, jobId]
  );
}

async function processAutoScoreFixJob(jobId: string): Promise<void> {
  const pool = getPool();
  const row = await loadJobExecutionRow(jobId);
  if (!row) return;
  if (!['pending', 'generating', 'creating_pr'].includes(row.status)) return;

  try {
    let plan = row.fix_plan;

    if (!plan || row.status === 'pending' || row.status === 'generating') {
      await pool.query(
        `UPDATE auto_score_fix_jobs SET status='generating', updated_at=NOW() WHERE id=$1`,
        [jobId]
      );

      // Fetch actual repo file tree so the AI knows the real structure
      let repoTree: string[] = [];
      if (row.encrypted_token && row.vcs_provider === 'github') {
        try {
          const plainToken = decryptVcsToken(row.encrypted_token);
          repoTree = await fetchRepoTreePaths(plainToken, row.repo_owner, row.repo_name, row.repo_branch);
        } catch (err: any) {
          console.warn(`[AutoScoreFix] Failed to fetch repo tree for ${jobId}:`, err?.message);
        }
      }

      const planInput: AutoScoreFixJobInput = {
        userId: row.user_id,
        workspaceId: '',
        auditId: row.audit_id ?? undefined,
        targetUrl: row.target_url,
        vcsProvider: row.vcs_provider,
        repoOwner: row.repo_owner,
        repoName: row.repo_name,
        repoBranch: row.repo_branch,
        encryptedToken: row.encrypted_token || '',
        repoTree,
        auditEvidence: row.evidence_snapshot,
      };

      // Use hybrid plan when audit_id is present (deterministic first, LLM second),
      // otherwise fall back to pure LLM plan.
      plan = row.audit_id
        ? await generateHybridFixPlan(planInput)
        : await generateFixPlan(planInput);

      // Populate real before/after diffs from the GitHub repo (best-effort)
      if (row.vcs_provider === 'github' && row.encrypted_token) {
        try {
          const plainToken = decryptVcsToken(row.encrypted_token);
          plan = await populateDiffsFromGitHub(
            plan, plainToken, row.repo_owner, row.repo_name, row.repo_branch,
          );
        } catch (err: unknown) {
          console.warn(`[AutoScoreFix] Diff population failed for ${jobId}:`, (err as Error).message);
        }
      }

      await pool.query(
        `UPDATE auto_score_fix_jobs
         SET status='creating_pr', fix_plan=$1, pr_title=$2, pr_body=$3,
             deterministic_patches_count=$4, updated_at=NOW()
         WHERE id=$5`,
        [
          JSON.stringify(plan),
          plan.pr_title,
          plan.pr_body,
          plan.deterministic_patches_count ?? 0,
          jobId,
        ]
      );
    }

    let prResult: { pr_number: number; pr_url: string };
    if (!row.encrypted_token) {
      // For GitHub: try GitHub App installation before failing
      if (row.vcs_provider === 'github' && isGitHubAppConfigured()) {
        const installation = await getInstallationForWorkspace(String(row.workspace_id || '')) || await getInstallationForUser(row.user_id);
        if (installation) {
          // Use GitHub App to create PR
          const appResult = await createPRViaApp({
            installationId: installation.installation_id,
            owner: row.repo_owner,
            repo: row.repo_name,
            baseBranch: row.repo_branch,
            title: plan!.pr_title,
            body: plan!.pr_body,
            files: plan!.file_changes.map(f => ({
              path: f.path,
              content: f.content,
              operation: f.operation as 'create' | 'update',
              justification: f.justification,
            })),
          });
          prResult = { pr_number: appResult.pr_number, pr_url: appResult.pr_url };
        } else {
          throw new Error(`No ${row.vcs_provider} token or GitHub App installation found for this job owner.`);
        }
      } else {
        throw new Error(`No ${row.vcs_provider} token found for this job owner.`);
      }
    } else {
      const plainToken = decryptVcsToken(row.encrypted_token);
      if (row.vcs_provider === 'github') {
        // Prefer GitHub App installation if available
        if (isGitHubAppConfigured()) {
          const installation = await getInstallationForWorkspace(String(row.workspace_id || '')) || await getInstallationForUser(row.user_id);
          if (installation) {
            const appResult = await createPRViaApp({
              installationId: installation.installation_id,
              owner: row.repo_owner,
              repo: row.repo_name,
              baseBranch: row.repo_branch,
              title: plan!.pr_title,
              body: plan!.pr_body,
              files: plan!.file_changes.map(f => ({
                path: f.path,
                content: f.content,
                operation: f.operation as 'create' | 'update',
                justification: f.justification,
              })),
            });
            prResult = { pr_number: appResult.pr_number, pr_url: appResult.pr_url };
          } else {
            prResult = await createGitHubPR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
          }
        } else {
          prResult = await createGitHubPR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
        }
      } else if (row.vcs_provider === 'gitlab') {
        prResult = await createGitLabMR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
      } else {
        prResult = await createBitbucketPR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
      }
    }

    await pool.query(
      `UPDATE auto_score_fix_jobs
       SET status='pending_approval', pr_number=$1, pr_url=$2,
           implementation_duration_minutes = COALESCE(
             implementation_duration_minutes,
             GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)::INT)
           ),
           score_before = COALESCE(
             score_before,
             CASE
               WHEN COALESCE(evidence_snapshot->>'visibility_score', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                 THEN (evidence_snapshot->>'visibility_score')::numeric
               ELSE NULL
             END
           ),
           updated_at=NOW()
       WHERE id=$3`,
      [prResult.pr_number, prResult.pr_url, jobId]
    );

    console.log(`[AutoScoreFix] Job ${jobId}: PR created - ${prResult.pr_url}`);
  } catch (err: any) {
    const msg = String(err?.message || 'Unknown error');
    console.error(`[AutoScoreFix] Job ${jobId} failed:`, msg);
    await markJobFailedWithRefund(jobId, row.user_id, msg);
  }
}

let workerRunning = false;

type AutoScoreFixClaimCandidate = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  target_url: string;
  audit_id: string | null;
  status: JobStatus;
  created_at: string;
  evidence_snapshot: AutoScoreFixJobInput['auditEvidence'] | null;
};

function toUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function hashPayload(value: unknown): string {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
  } catch {
    return crypto.randomUUID().replace(/-/g, '');
  }
}

async function loadAgentExecutionProfile(client: any, userId: string, workspaceId?: string | null): Promise<AgentExecutionProfile> {
  const scopeWorkspace = String(workspaceId || '').trim();
  const whereWorkspace = scopeWorkspace ? 'AND workspace_id = $2' : '';
  const params = scopeWorkspace ? [userId, scopeWorkspace] : [userId];

  const { rows } = await client.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status IN ('approved','pending_approval'))::int AS success_count,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
       COUNT(*) FILTER (WHERE status IN ('cancelled','rejected','expired'))::int AS unstable_count,
       AVG(COALESCE(score_delta, 0))::float AS avg_score_delta,
       AVG(NULLIF(implementation_duration_minutes, 0))::float AS avg_minutes,
       MAX(EXTRACT(EPOCH FROM updated_at) * 1000)::bigint AS updated_at_ms
     FROM auto_score_fix_jobs
     WHERE user_id = $1
       ${whereWorkspace}
       AND status IN ('approved','pending_approval','failed','cancelled','rejected','expired')`,
    params,
  );

  const row = rows[0] || {};
  const total = Math.max(0, Number(row.total || 0));
  const successCount = Math.max(0, Number(row.success_count || 0));
  const failedCount = Math.max(0, Number(row.failed_count || 0));
  const unstableCount = Math.max(0, Number(row.unstable_count || 0));
  const avgScoreDelta = Number(row.avg_score_delta || 0);
  const avgMinutes = Number(row.avg_minutes || 0);
  const updatedAtMs = Number(row.updated_at_ms || Date.now());

  const successRate = total > 0 ? toUnitInterval(successCount / total) : 0.5;
  const avgPipelineQuality = total > 0 ? toUnitInterval((Math.max(-30, Math.min(30, avgScoreDelta)) + 30) / 60) : 0.5;
  const retryFrequency = total > 0 ? toUnitInterval(failedCount / total) : 0.5;
  const requestStability = total > 0 ? toUnitInterval(1 - (unstableCount / total)) : 0.5;
  const resourceEfficiency = Number.isFinite(avgMinutes) && avgMinutes > 0
    ? toUnitInterval(1 - (Math.min(avgMinutes, 120) / 120))
    : 0.5;

  return {
    agentId: userId,
    tenantId: scopeWorkspace || userId,
    successRate,
    avgPipelineQuality,
    retryFrequency,
    requestStability,
    resourceEfficiency,
    updatedAtMs,
  };
}

async function computeTenantFairnessBoost(client: any, workspaceId?: string | null): Promise<number> {
  const tenantId = String(workspaceId || '').trim();
  if (!tenantId) return 1;

  const { rows } = await client.query(
    `SELECT
       COUNT(*)::int AS total_count,
       COUNT(*) FILTER (WHERE workspace_id = $1)::int AS tenant_count
     FROM auto_score_fix_jobs
     WHERE updated_at >= NOW() - INTERVAL '60 minutes'
       AND status IN ('generating', 'creating_pr', 'pending_approval', 'approved', 'failed')`,
    [tenantId],
  );

  const totalCount = Math.max(0, Number(rows?.[0]?.total_count || 0));
  const tenantCount = Math.max(0, Number(rows?.[0]?.tenant_count || 0));
  if (totalCount <= 0) return 1;

  const tenantShare = tenantCount / totalCount;
  const targetShare = 0.25;
  const rawBoost = 1 - ((tenantShare - targetShare) * 0.6);
  return normalizeFairnessBoost(rawBoost);
}

async function claimNextAutoScoreFixJobId(): Promise<string | null> {
  const exchangeDisabled = process.env.DISABLE_EXECUTION_EXCHANGE === 'true';
  const candidateWindow = Math.max(3, Math.min(20, Number(process.env.EXECUTION_EXCHANGE_CANDIDATE_WINDOW || 12)));

  return executeTransaction(async (client: any) => {
    const { rows } = await client.query(
      `SELECT id, user_id, workspace_id, target_url, audit_id, status, created_at, evidence_snapshot
       FROM auto_score_fix_jobs
       WHERE status IN ('pending', 'generating', 'creating_pr')
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [candidateWindow],
    );
    if (!rows.length) return null;

    let chosen = rows[0] as AutoScoreFixClaimCandidate;

    if (!exchangeDisabled && rows.length > 1) {
      const nowMs = Date.now();
      const profileCache = new Map<string, AgentExecutionProfile>();
      const fairnessCache = new Map<string, number>();

      let bestPriority = Number.NEGATIVE_INFINITY;

      for (const candidate of rows as AutoScoreFixClaimCandidate[]) {
        const tenantKey = String(candidate.workspace_id || '').trim() || String(candidate.user_id);
        const profileKey = `${candidate.user_id}:${tenantKey}`;

        let profile = profileCache.get(profileKey);
        if (!profile) {
          profile = await loadAgentExecutionProfile(client, String(candidate.user_id), candidate.workspace_id);
          profileCache.set(profileKey, profile);
        }

        let fairnessBoost = fairnessCache.get(tenantKey);
        if (fairnessBoost === undefined) {
          fairnessBoost = await computeTenantFairnessBoost(client, candidate.workspace_id);
          fairnessCache.set(tenantKey, fairnessBoost);
        }

        const ageMs = Math.max(0, nowMs - new Date(String(candidate.created_at)).getTime());
        const ageUrgency = toUnitInterval(ageMs / (30 * 60 * 1000));
        const jitterMs = computeQueueDelayMs(String(candidate.id));
        const urgencyWeight = toUnitInterval(ageUrgency + 0.15 - (jitterMs / 7000));

        const request: ExecutionRequest = {
          requestId: String(candidate.id),
          agentId: String(candidate.user_id),
          tenantId: tenantKey,
          pool: 'scorefix.run_pipeline',
          urgencyWeight,
          createdAtMs: new Date(String(candidate.created_at)).getTime(),
          estimatedCost: AUTO_SCORE_FIX_CREDIT_COST,
          payloadHash: hashPayload({
            targetUrl: candidate.target_url,
            auditId: candidate.audit_id,
            evidence: candidate.evidence_snapshot,
          }),
        };

        const priority = computeLatentPriority({
          request,
          profile,
          nowMs,
          fairnessBoost,
          jitterSeed: `${candidate.id}:${tenantKey}:${candidate.created_at}`,
        });

        if (priority > bestPriority) {
          bestPriority = priority;
          chosen = candidate;
        }
      }
    }

    const jobId = String(chosen.id);
    await client.query(
      `UPDATE auto_score_fix_jobs
       SET status = CASE WHEN status = 'pending' THEN 'generating' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId],
    );
    return jobId;
  });
}

export function startAutoScoreFixWorkerLoop(): void {
  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_AUTOSCOREFIX === 'true';
  if (globalDisable || loopDisable) {
    console.log('[AutoScoreFix] Worker loop disabled via env (DISABLE_AUTOSCOREFIX or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  const CHECK_INTERVAL_MS = 15 * 1000;

  const tick = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      while (true) {
        const jobId = await claimNextAutoScoreFixJobId();
        if (!jobId) break;
        await processAutoScoreFixJob(jobId);
      }
    } catch (err: any) {
      console.error('[AutoScoreFix] Worker loop error:', err?.message || err);
    } finally {
      workerRunning = false;
    }
  };

  void tick();
  _asfWorkerIntervalId = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
  console.log('[AutoScoreFix] Worker loop started (interval: 15s)');
}

let _asfWorkerIntervalId: ReturnType<typeof setInterval> | null = null;

// ─── Job Management ───────────────────────────────────────────────────────────

export async function getJobsForUser(
  userId: string,
  workspaceId: string,
  limit = 20
): Promise<unknown[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, target_url, vcs_provider, repo_owner, repo_name, repo_branch,
            status, credits_spent, pr_number, pr_url, pr_title,
            fix_plan, error_message, expires_at, approved_at, rejected_at,
            refund_processed_at, refund_credits,
            implementation_duration_minutes, checks_status, github_pr_merged_at,
            rescan_status, rescan_scheduled_for, rescan_started_at, rescan_completed_at,
            rescan_audit_id, score_before, score_after, score_delta,
            created_at, updated_at
     FROM auto_score_fix_jobs
     WHERE user_id = $1 AND workspace_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, workspaceId, limit]
  );
  return rows;
}

type PostMergeRescanRunner = (userId: string, workspaceId: string, url: string) => Promise<string | null>;

type PostMergeHooks = {
  onScheduled?: (payload: { userId: string; workspaceId: string; jobId: string; url: string; runAt: string }) => Promise<void> | void;
  onCompleted?: (payload: {
    userId: string;
    workspaceId: string;
    jobId: string;
    url: string;
    auditId: string;
    scoreBefore: number;
    scoreAfter: number;
    scoreDelta: number;
  }) => Promise<void> | void;
  onFailed?: (payload: { userId: string; workspaceId: string; jobId: string; url: string; reason: string }) => Promise<void> | void;
};

async function fetchGitHubPrState(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<{ mergedAt: string | null; checksStatus: string }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aivis-auto-score-fix',
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GitHub PR check failed (${res.status}): ${String(err).slice(0, 180)}`);
  }

  const data = (await res.json()) as any;
  const mergedAt = data?.merged_at ? String(data.merged_at) : null;
  const mergeableState = String(data?.mergeable_state || '').toLowerCase();
  const state = String(data?.state || '').toLowerCase();

  let checksStatus = 'pending';
  if (mergedAt) checksStatus = 'passed';
  else if (state === 'closed') checksStatus = 'closed_unmerged';
  else if (mergeableState === 'clean' || mergeableState === 'has_hooks') checksStatus = 'checks_ready';
  else if (mergeableState) checksStatus = mergeableState;

  return { mergedAt, checksStatus };
}

function inferScoreBefore(row: any): number {
  const direct = Number(row?.score_before);
  if (Number.isFinite(direct) && direct >= 0) return direct;

  const snapshot = row?.evidence_snapshot as any;
  const fromSnapshot = Number(snapshot?.visibility_score);
  if (Number.isFinite(fromSnapshot) && fromSnapshot >= 0) return fromSnapshot;

  return 0;
}

let postMergeLoopRunning = false;

export function startAutoScoreFixPostMergeLoop(
  runRescan: PostMergeRescanRunner,
  hooks?: PostMergeHooks
): void {
  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_AUTOSCOREFIX === 'true';
  if (globalDisable || loopDisable) {
    console.log('[AutoScoreFix] Post-merge loop disabled via env (DISABLE_AUTOSCOREFIX or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  const CHECK_INTERVAL_MS = 60 * 1000;

  const tick = async () => {
    if (postMergeLoopRunning) return;
    postMergeLoopRunning = true;
    const pool = getPool();

    try {
      const { rows } = await pool.query(
        `SELECT j.id, j.user_id, j.workspace_id, j.target_url, j.repo_owner, j.repo_name,
                j.pr_number, j.status, j.checks_status, j.github_pr_merged_at,
                j.rescan_status, j.rescan_scheduled_for, j.rescan_started_at,
                j.score_before, j.evidence_snapshot, t.encrypted_token
         FROM auto_score_fix_jobs j
         LEFT JOIN vcs_tokens t ON t.user_id = j.user_id AND t.provider = j.vcs_provider
         WHERE j.vcs_provider = 'github'
           AND j.status = 'approved'
           AND j.pr_number IS NOT NULL
           AND COALESCE(j.rescan_status, 'not_scheduled') IN ('not_scheduled', 'scheduled', 'running', 'failed')
         ORDER BY j.updated_at ASC
         LIMIT 25`
      );

      for (const row of rows as any[]) {
        const jobId = String(row.id);
        const userId = String(row.user_id);
        const workspaceId = String(row.workspace_id || '');
        const targetUrl = String(row.target_url || '');
        const prNumber = Number(row.pr_number || 0);
        const encrypted = row.encrypted_token ? String(row.encrypted_token) : '';

        if (!workspaceId || !targetUrl || !prNumber || !encrypted) continue;

        if (!row.github_pr_merged_at) {
          try {
            const plain = decryptVcsToken(encrypted);
            const prState = await fetchGitHubPrState(String(row.repo_owner), String(row.repo_name), prNumber, plain);

            if (!prState.mergedAt) {
              await pool.query(
                `UPDATE auto_score_fix_jobs
                 SET checks_status = $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [prState.checksStatus, jobId]
              );
              continue;
            }

            const mergedAt = new Date(prState.mergedAt);
            const runAt = new Date(mergedAt.getTime() + 5 * 60 * 1000);
            await pool.query(
              `UPDATE auto_score_fix_jobs
               SET checks_status = $1,
                   github_pr_merged_at = $2,
                   rescan_status = 'scheduled',
                   rescan_scheduled_for = $3,
                   updated_at = NOW()
               WHERE id = $4`,
              ['passed', mergedAt.toISOString(), runAt.toISOString(), jobId]
            );

            await hooks?.onScheduled?.({
              userId,
              workspaceId,
              jobId,
              url: targetUrl,
              runAt: runAt.toISOString(),
            });
          } catch (err: any) {
            const reason = String(err?.message || 'Failed to check GitHub PR state').slice(0, 300);
            await pool.query(
              `UPDATE auto_score_fix_jobs
               SET checks_status = 'check_error',
                   error_message = COALESCE(error_message, $1),
                   updated_at = NOW()
               WHERE id = $2`,
              [reason, jobId]
            );
          }
          continue;
        }

        const scheduledFor = row.rescan_scheduled_for ? new Date(String(row.rescan_scheduled_for)).getTime() : 0;
        if (!scheduledFor || Date.now() < scheduledFor) continue;

        const claimed = await pool.query(
          `UPDATE auto_score_fix_jobs
           SET rescan_status = 'running',
               rescan_started_at = COALESCE(rescan_started_at, NOW()),
               updated_at = NOW()
           WHERE id = $1
             AND COALESCE(rescan_status, 'not_scheduled') IN ('scheduled', 'failed', 'running')
           RETURNING id`,
          [jobId]
        );
        if (!claimed.rowCount) continue;

        const auditId = await runRescan(userId, workspaceId, targetUrl);
        if (!auditId) {
          const reason = 'Post-fix verification rescan did not return an audit ID';
          await pool.query(
            `UPDATE auto_score_fix_jobs
             SET rescan_status = 'failed',
                 error_message = COALESCE(error_message, $2),
                 updated_at = NOW()
             WHERE id = $1`,
            [jobId, reason]
          );
          await hooks?.onFailed?.({ userId, workspaceId, jobId, url: targetUrl, reason });
          continue;
        }

        const scoreRow = await pool.query(
          `SELECT visibility_score FROM audits WHERE id = $1 LIMIT 1`,
          [auditId]
        );
        const scoreAfter = Number(scoreRow.rows[0]?.visibility_score || 0);
        const scoreBefore = inferScoreBefore(row);
        const scoreDelta = Math.round((scoreAfter - scoreBefore) * 100) / 100;

        // ── Trust moat: rollback PRs that caused a score regression ──────────
        // If the post-merge rescan shows the visibility score is worse than
        // before the PR was merged, flag the job as auto-rolled-back in the
        // ledger. The caller (ScoreFix routes) surfaces this to the user
        // and the webhook can trigger a revert PR if desired.
        const didRegress = scoreAfter < scoreBefore;
        if (didRegress) {
          console.warn(
            `[AutoScoreFix] Score regression detected on job ${jobId}: ` +
            `${scoreBefore} → ${scoreAfter} (Δ${scoreDelta}). Flagging for rollback.`
          );
        }

        await pool.query(
          `UPDATE auto_score_fix_jobs
           SET rescan_status = 'completed',
               rescan_completed_at = NOW(),
               rescan_audit_id = $2,
               score_before = COALESCE(score_before, $3),
               score_after = $4,
               score_delta = $5,
               auto_rolled_back = $6,
               updated_at = NOW()
           WHERE id = $1`,
          [jobId, auditId, scoreBefore, scoreAfter, scoreDelta, didRegress]
        );

        await hooks?.onCompleted?.({
          userId,
          workspaceId,
          jobId,
          url: targetUrl,
          auditId,
          scoreBefore,
          scoreAfter,
          scoreDelta,
        });
      }
    } catch (err: any) {
      console.error('[AutoScoreFix] Post-merge loop error:', err?.message || err);
    } finally {
      postMergeLoopRunning = false;
    }
  };

  void tick();
  _asfPostMergeIntervalId = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
  console.log('[AutoScoreFix] Post-merge rescan loop started (interval: 60s)');
}

let _asfPostMergeIntervalId: ReturnType<typeof setInterval> | null = null;

export async function getJobById(jobId: string, userId: string, workspaceId?: string): Promise<unknown | null> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;
  const query = useWorkspaceScope
    ? `SELECT * FROM auto_score_fix_jobs WHERE id = $1 AND user_id = $2 AND workspace_id = $3`
    : `SELECT * FROM auto_score_fix_jobs WHERE id = $1 AND user_id = $2`;
  const params = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}

export async function approveJob(jobId: string, userId: string, workspaceId?: string): Promise<{ ok: boolean }> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;
  const query = useWorkspaceScope
    ? `UPDATE auto_score_fix_jobs
       SET status='approved', approved_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND workspace_id=$3 AND status='pending_approval'`
    : `UPDATE auto_score_fix_jobs
       SET status='approved', approved_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='pending_approval'`;
  const params = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rowCount } = await pool.query(query, params);
  return { ok: (rowCount ?? 0) > 0 };
}

export async function rejectJob(jobId: string, userId: string, workspaceId?: string): Promise<{ ok: boolean; refund: number }> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;
  const selectQuery = useWorkspaceScope
    ? `SELECT credits_spent FROM auto_score_fix_jobs
       WHERE id=$1 AND user_id=$2 AND workspace_id=$3 AND status='pending_approval'`
    : `SELECT credits_spent FROM auto_score_fix_jobs
       WHERE id=$1 AND user_id=$2 AND status='pending_approval'`;
  const selectParams = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rows } = await pool.query(selectQuery, selectParams);
  if (!rows.length) return { ok: false, refund: 0 };

  const creditsSpent = Number(rows[0].credits_spent || 0);
  const refundAmount = Math.round(creditsSpent * AUTO_SCORE_FIX_REFUND_PERCENT * 100) / 100;

  await executeTransaction(async (client: any) => {
    await client.query(
      `UPDATE auto_score_fix_jobs
       SET status='rejected', rejected_at=NOW(), refund_processed_at=NOW(),
           refund_credits=$1, updated_at=NOW()
       WHERE id=$2`,
      [refundAmount, jobId]
    );
    // Refund credits
    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
             updated_at = NOW()`,
      [userId, refundAmount]
    );
    await appendCreditLedgerEvent({
      userId,
      type: 'refund',
      delta: refundAmount,
      source: 'system',
      requestId: `asf-reject-refund:${jobId}`,
      metadata: { jobId, refundPercent: 0, reason: 'auto_score_fix_rejection_refund' },
      client,
    });
    const balanceAfter = await getCreditLedgerBalance(userId, client);
    await client.query(
      `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
       VALUES ($1, $2, $3, 'auto_score_fix_rejection_refund', $4)`,
      [userId, refundAmount, balanceAfter, JSON.stringify({ jobId, refund_percent: 0 })]
    );
  });

  return { ok: true, refund: refundAmount };
}

export async function cancelJob(
  jobId: string,
  userId: string,
  workspaceId?: string
): Promise<{ ok: boolean; refund: number; status: 'cancelled' | 'rejected' }> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;

  const selectQuery = useWorkspaceScope
    ? `SELECT status, credits_spent, refund_processed_at
       FROM auto_score_fix_jobs
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`
    : `SELECT status, credits_spent, refund_processed_at
       FROM auto_score_fix_jobs
       WHERE id = $1 AND user_id = $2`;
  const selectParams = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rows } = await pool.query(selectQuery, selectParams);
  if (!rows.length) return { ok: false, refund: 0, status: 'cancelled' };

  const row = rows[0] as { status: JobStatus; credits_spent: string | number; refund_processed_at?: string | null };
  if (row.status === 'approved' || row.status === 'rejected' || row.status === 'expired' || row.status === 'failed' || row.status === 'cancelled') {
    return { ok: false, refund: 0, status: 'cancelled' };
  }

  if (row.status === 'pending_approval') {
    const rejected = await rejectJob(jobId, userId, workspaceId);
    return { ok: rejected.ok, refund: rejected.refund, status: 'rejected' };
  }

  const creditsSpent = Number(row.credits_spent || 0);
  const refundAmount = Math.round(creditsSpent * 100) / 100;

  await executeTransaction(async (client: any) => {
    const updateQuery = useWorkspaceScope
      ? `UPDATE auto_score_fix_jobs
         SET status='cancelled',
             error_message = 'Cancelled by user before PR approval',
             rejected_at=NOW(),
             refund_processed_at=NOW(),
             refund_credits=$1,
             updated_at=NOW()
         WHERE id=$2 AND user_id=$3 AND workspace_id=$4 AND status IN ('pending','generating','creating_pr')`
      : `UPDATE auto_score_fix_jobs
         SET status='cancelled',
             error_message = 'Cancelled by user before PR approval',
             rejected_at=NOW(),
             refund_processed_at=NOW(),
             refund_credits=$1,
             updated_at=NOW()
         WHERE id=$2 AND user_id=$3 AND status IN ('pending','generating','creating_pr')`;
    const updateParams = useWorkspaceScope
      ? [refundAmount, jobId, userId, workspaceId]
      : [refundAmount, jobId, userId];
    const updateResult = await client.query(updateQuery, updateParams);
    if ((updateResult.rowCount ?? 0) === 0) {
      throw new Error('Job is no longer cancelable');
    }

    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
             updated_at = NOW()`,
      [userId, refundAmount]
    );
    await appendCreditLedgerEvent({
      userId,
      type: 'refund',
      delta: refundAmount,
      source: 'system',
      requestId: `asf-cancel-refund:${jobId}`,
      metadata: { jobId, refundPercent: 1, reason: 'auto_score_fix_cancel_refund' },
      client,
    });
    const balanceAfter = await getCreditLedgerBalance(userId, client);
    await client.query(
      `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
       VALUES ($1, $2, $3, 'auto_score_fix_cancel_refund', $4)`,
      [userId, refundAmount, balanceAfter, JSON.stringify({ jobId, refund_percent: 100, reason: 'User cancelled before PR approval' })]
    );
  });

  return { ok: true, refund: refundAmount, status: 'cancelled' };
}

// ─── Expiry Loop (call once from server startup) ──────────────────────────────

export function startAutoScoreFixExpiryLoop(): void {
  const CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

  const runExpiry = async () => {
    const pool = getPool();
    try {
      // Find jobs that have passed the 49-hour threshold (1 hour grace after 48hr expiry)
      const { rows: expired } = await pool.query(
        `SELECT id, user_id, credits_spent
         FROM auto_score_fix_jobs
         WHERE status = 'pending_approval'
           AND expires_at < (NOW() - INTERVAL '1 hour')
           AND refund_processed_at IS NULL`
      );

      for (const job of expired) {
        const creditsSpent = Number(job.credits_spent || 0);
        const refundAmount = Math.round(creditsSpent * AUTO_SCORE_FIX_REFUND_PERCENT * 100) / 100;
        try {
          await executeTransaction(async (client: any) => {
            await client.query(
              `UPDATE auto_score_fix_jobs
               SET status='expired', refund_processed_at=NOW(), refund_credits=$1, updated_at=NOW()
               WHERE id=$2`,
              [refundAmount, job.id]
            );
            await client.query(
              `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT (user_id) DO UPDATE
                 SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
                     updated_at = NOW()`,
              [job.user_id, refundAmount]
            );
            await appendCreditLedgerEvent({
              userId: String(job.user_id),
              type: 'refund',
              delta: refundAmount,
              source: 'system',
              requestId: `asf-expiry-refund:${job.id}`,
              metadata: {
                jobId: job.id,
                refundPercent: AUTO_SCORE_FIX_REFUND_PERCENT,
                feePercent: AUTO_SCORE_FIX_FEE_PERCENT,
                reason: 'auto_score_fix_expiry_refund',
              },
              client,
            });
            const balanceAfter = await getCreditLedgerBalance(String(job.user_id), client);
            await client.query(
              `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
               VALUES ($1, $2, $3, 'auto_score_fix_expiry_refund', $4)`,
              [
                job.user_id,
                refundAmount,
                balanceAfter,
                JSON.stringify({
                  jobId: job.id,
                  refund_percent: 0,
                  fee_percent: 0,
                  reason: 'No refund after confirmed PR or code push',
                }),
              ]
            );
          });
          console.log(`[AutoScoreFix] Job ${job.id} expired - ${refundAmount} credits refunded (80%)`);
        } catch (err: any) {
          console.error(`[AutoScoreFix] Expiry refund failed for job ${job.id}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.error('[AutoScoreFix] Expiry loop error:', err?.message);
    }
  };

  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_AUTOSCOREFIX === 'true';
  if (globalDisable || loopDisable) {
    console.log('[AutoScoreFix] Expiry loop disabled via env (DISABLE_AUTOSCOREFIX or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  // Run immediately and then on interval
  runExpiry();
  _asfExpiryIntervalId = setInterval(runExpiry, CHECK_INTERVAL_MS);
  console.log('[AutoScoreFix] Expiry loop started (interval: 10 min)');
}

let _asfExpiryIntervalId: ReturnType<typeof setInterval> | null = null;

export function stopAllAutoScoreFixLoops(): void {
  if (_asfWorkerIntervalId) { clearInterval(_asfWorkerIntervalId); _asfWorkerIntervalId = null; }
  if (_asfPostMergeIntervalId) { clearInterval(_asfPostMergeIntervalId); _asfPostMergeIntervalId = null; }
  if (_asfExpiryIntervalId) { clearInterval(_asfExpiryIntervalId); _asfExpiryIntervalId = null; }
  console.log('[AutoScoreFix] All loops stopped');
}
