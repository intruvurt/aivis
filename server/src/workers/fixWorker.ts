/**
 * Fix Worker - BullMQ worker that generates patches for audit issues.
 * Reads the issue from DB, generates a fix plan using fixpackGenerator
 * templates, then enqueues a PR job.
 */
import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import { getPool } from '../services/postgresql.js';
import { enqueuePRJob } from '../infra/queues/prQueue.js';
import { getTemplateByRuleId, matchRuleIdFromTitle } from '../services/fixpackGenerator.js';
import type { PRJobData } from '../infra/queues/prQueue.js';
import type { SSFREvidenceItem, SSFRFixpackAsset } from '../../../shared/types.js';
import type { FixJobData } from '../infra/queues/fixQueue.js';

let workerInstance: Worker<FixJobData> | null = null;

async function processFixJob(data: FixJobData): Promise<void> {
  const pool = getPool();

  // 1. Load issue + evidence
  const { rows: issueRows } = await pool.query(
    `SELECT i.*, e.url AS evidence_url, e.message AS evidence_message, e.raw AS evidence_raw
     FROM v1_issues i
     LEFT JOIN v1_evidence e ON e.issue_id = i.id
     WHERE i.id = $1`,
    [data.issueId]
  );
  if (!issueRows.length) throw new Error(`Issue ${data.issueId} not found`);

  const issue = issueRows[0];
  const evidenceContext = await buildEvidenceContext(pool, issue, data);

  // 2. Load project repo info
  const { rows: projectRows } = await pool.query(
    `SELECT repo_owner, repo_name, repo_installation_id FROM v1_projects WHERE id = $1 AND org_id = $2`,
    [data.projectId, data.orgId]
  );
  if (!projectRows.length) throw new Error(`Project ${data.projectId} not found`);

  const project = projectRows[0];

  if (!project.repo_owner || !project.repo_name || !project.repo_installation_id) {
    // Mark fix as failed - no repo connected
    await pool.query(
      `UPDATE v1_fixes SET status = 'failed', updated_at = NOW() WHERE id = (
         SELECT id FROM v1_fixes WHERE issue_id = $1 ORDER BY created_at DESC LIMIT 1
       )`,
      [data.issueId]
    );
    throw new Error('Project has no GitHub repo connected');
  }

  // 3. Generate fix content based on issue type
  const fixFiles = generateFixContent(issue);

  if (fixFiles.length === 0) {
    await pool.query(
      `UPDATE v1_fixes SET status = 'skipped', updated_at = NOW() WHERE issue_id = $1 AND status = 'pending'`,
      [data.issueId]
    );
    return;
  }

  // 4. Update fix status to in_progress
  await pool.query(
    `UPDATE v1_fixes SET status = 'in_progress', updated_at = NOW() WHERE issue_id = $1 AND status = 'pending'`,
    [data.issueId]
  );

  // 5. Enqueue PR creation
  await enqueuePRJob({
    fixId: data.issueId, // fix is 1:1 with issue for now
    projectId: data.projectId,
    orgId: data.orgId,
    userId: data.userId,
    repoOwner: project.repo_owner,
    repoName: project.repo_name,
    installationId: Number(project.repo_installation_id),
    baseBranch: 'main',
    files: fixFiles,
    title: `fix(aivis): ${issue.title.slice(0, 60)}`,
    body: buildPRBody(issue, data.expectedDelta, evidenceContext),
    evidenceContext,
  });

  // 6. Update fix status
  await pool.query(
    `UPDATE v1_fixes SET status = 'pr_queued', updated_at = NOW() WHERE issue_id = $1 AND status = 'in_progress'`,
    [data.issueId]
  );
}

function generateFixContent(issue: any): Array<{ path: string; content: string; justification: string }> {
  const title = String(issue.title || '');
  const severity = String(issue.severity || '').toLowerCase();
  const targetUrl = String(issue.evidence_url || '');

  // 1. Match issue title to a fixpackGenerator template rule_id
  const ruleId = matchRuleIdFromTitle(title);
  if (ruleId) {
    const template = getTemplateByRuleId(ruleId);
    if (template) {
      // Build minimal evidence from v1_evidence raw data
      const evidence = buildEvidenceFromRaw(issue);
      const assets = template.generate(evidence, targetUrl || undefined);
      if (assets.length > 0) {
        return assets.map(asset => assetToFile(asset, ruleId, severity));
      }
    }
  }

  // 2. Fallback: broad pattern matching for uncategorised issues
  if (/schema|json-ld|structured data/i.test(title)) {
    const tmpl = getTemplateByRuleId('signal_json_ld');
    if (tmpl) {
      const assets = tmpl.generate([], targetUrl || undefined);
      return assets.map(a => assetToFile(a, 'signal_json_ld', severity));
    }
  }

  if (/meta description/i.test(title)) {
    const tmpl = getTemplateByRuleId('signal_meta_description');
    if (tmpl) {
      const assets = tmpl.generate([], targetUrl || undefined);
      return assets.map(a => assetToFile(a, 'signal_meta_description', severity));
    }
  }

  return [];
}

/** Convert fixpack asset to a PR file entry with appropriate path */
function assetToFile(
  asset: SSFRFixpackAsset,
  ruleId: string,
  severity: string,
): { path: string; content: string; justification: string } {
  const path = resolveFilePath(asset, ruleId);
  return {
    path,
    content: asset.content,
    justification: `${asset.label} — auto-generated by AiVIS.biz AutoFix (severity: ${severity})`,
  };
}

/** Determine the target file path based on asset type and rule context */
function resolveFilePath(asset: SSFRFixpackAsset, ruleId: string): string {
  // Direct file outputs for specific rule_ids
  const directPaths: Record<string, string> = {
    source_robots_txt: 'public/robots.txt',
    source_ai_crawler_access: 'docs/aivis-fix-crawler-access.md',
    source_llms_txt: 'public/llms.txt',
    signal_sitemap: 'public/sitemap.xml',
  };
  if (directPaths[ruleId]) return directPaths[ruleId];

  // By asset type
  switch (asset.type) {
    case 'json_ld': {
      const schemaLabel = (asset.label || ruleId).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `public/schema-${schemaLabel}.jsonld`;
    }
    case 'meta_tag':
      return `src/components/aivis-fix-${ruleId.replace(/_/g, '-')}.html`;
    case 'html_block':
      return `src/components/aivis-fix-${ruleId.replace(/_/g, '-')}.html`;
    case 'text':
      return `public/aivis-fix-${ruleId.replace(/_/g, '-')}.txt`;
    case 'markdown':
      return `docs/aivis-fix-${ruleId.replace(/_/g, '-')}.md`;
    default:
      return `docs/aivis-fix-${ruleId.replace(/_/g, '-')}.md`;
  }
}

/** Convert v1_evidence raw JSONB into SSFREvidenceItem[] for template consumption */
function buildEvidenceFromRaw(issue: any): SSFREvidenceItem[] {
  const items: SSFREvidenceItem[] = [];
  const raw = issue.evidence_raw;
  if (!raw || typeof raw !== 'object') return items;

  // The v1_evidence.raw column may contain key-value pairs that map to evidence_keys
  for (const [key, value] of Object.entries(raw)) {
    items.push({
      family: 'source',
      evidence_key: key,
      value,
      source: 'v1_evidence',
      status: value != null ? 'present' : 'missing',
      confidence: 0.8,
    });
  }

  return items;
}

async function buildEvidenceContext(
  pool: ReturnType<typeof getPool>,
  issue: any,
  data: FixJobData,
): Promise<NonNullable<PRJobData['evidenceContext']>> {
  const handoffTraceId = `handoff_${data.projectId}_${data.issueId}_${Date.now()}`;
  const sourceUrl = typeof issue.evidence_url === 'string' ? issue.evidence_url : null;
  const explicitAuditId =
    typeof issue.audit_id === 'string'
      ? issue.audit_id
      : typeof issue.audit_id === 'number'
        ? String(issue.audit_id)
        : null;

  let auditRow: any | null = null;

  if (explicitAuditId) {
    const byId = await pool.query(
      `SELECT id, url, visibility_score, result, updated_at
         FROM audits
        WHERE id = $1
        LIMIT 1`,
      [explicitAuditId],
    );
    auditRow = byId.rows[0] || null;
  }

  if (!auditRow && sourceUrl) {
    const byUrl = await pool.query(
      `SELECT id, url, visibility_score, result, updated_at
         FROM audits
        WHERE url = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [sourceUrl],
    );
    auditRow = byUrl.rows[0] || null;
  }

  const result =
    auditRow?.result && typeof auditRow.result === 'object'
      ? (auditRow.result as Record<string, any>)
      : {};
  const bragValidation =
    result?.brag_validation && typeof result.brag_validation === 'object'
      ? (result.brag_validation as Record<string, any>)
      : {};
  const findings = Array.isArray(bragValidation?.findings)
    ? (bragValidation.findings as Array<Record<string, any>>)
    : [];
  const recommendationList = Array.isArray(result?.recommendations)
    ? (result.recommendations as Array<Record<string, any>>)
    : [];
  const bragFindingsCount =
    typeof result?.brag_findings_count === 'number'
      ? result.brag_findings_count
      : typeof bragValidation?.finding_count === 'number'
        ? bragValidation.finding_count
        : findings.length;
  const bragRejectedCount =
    typeof bragValidation?.rejected_count === 'number'
      ? bragValidation.rejected_count
      : undefined;
  const bragCoverageRatio =
    typeof bragValidation?.coverage_ratio === 'number'
      ? bragValidation.coverage_ratio
      : typeof bragFindingsCount === 'number' && typeof bragRejectedCount === 'number'
        ? Number((bragFindingsCount / Math.max(1, bragFindingsCount + bragRejectedCount)).toFixed(4))
        : undefined;

  return {
    auditId: auditRow?.id ? String(auditRow.id) : explicitAuditId,
    sourceUrl: auditRow?.url || sourceUrl,
    visibilityScore:
      typeof auditRow?.visibility_score === 'number'
        ? auditRow.visibility_score
        : typeof result?.visibility_score === 'number'
          ? result.visibility_score
          : null,
    evidenceCount:
      typeof result?.evidence_count === 'number' ? result.evidence_count : undefined,
    bragFindingsCount: typeof bragFindingsCount === 'number' ? bragFindingsCount : undefined,
    bragRejectedCount,
    bragCoverageRatio,
    citeLedgerCount:
      typeof bragValidation?.cite_ledger_count === 'number'
        ? bragValidation.cite_ledger_count
        : undefined,
    rootHash:
      typeof bragValidation?.root_hash === 'string' ? bragValidation.root_hash : null,
    gateVersion:
      typeof bragValidation?.gate_version === 'string'
        ? bragValidation.gate_version
        : null,
    topFindingIds: findings
      .map((finding) => (typeof finding?.brag_id === 'string' ? finding.brag_id : ''))
      .filter(Boolean)
      .slice(0, 5),
    topFindingTitles: findings
      .map((finding) => (typeof finding?.title === 'string' ? finding.title : ''))
      .filter(Boolean)
      .slice(0, 3),
    recommendationCount: recommendationList.length,
    topRecommendationTitles: recommendationList
      .map((rec) => (typeof rec?.title === 'string' ? rec.title : ''))
      .filter(Boolean)
      .slice(0, 3),
    handoffTraceId,
    createdAt: new Date().toISOString(),
  };
}

function buildPRBody(
  issue: any,
  expectedDelta: number,
  evidenceContext?: PRJobData['evidenceContext'],
): string {
  const evidenceBlock = evidenceContext
    ? `\n### Evidence Truth Snapshot\n- audit_id: ${evidenceContext.auditId || 'unknown'}\n- source_url: ${evidenceContext.sourceUrl || 'unknown'}\n- visibility_score: ${evidenceContext.visibilityScore ?? 'unknown'}\n- evidence_count: ${evidenceContext.evidenceCount ?? 'unknown'}\n- BRAG findings/rejected: ${evidenceContext.bragFindingsCount ?? 'unknown'} / ${evidenceContext.bragRejectedCount ?? 'unknown'}\n- BRAG coverage_ratio: ${evidenceContext.bragCoverageRatio ?? 'unknown'}\n- cite_ledger_entries: ${evidenceContext.citeLedgerCount ?? 'unknown'}\n- root_hash: ${evidenceContext.rootHash || 'unknown'}\n- gate_version: ${evidenceContext.gateVersion || 'unknown'}\n- recommendation_count: ${evidenceContext.recommendationCount ?? 'unknown'}\n${evidenceContext.topFindingIds?.length ? `- top_finding_ids: ${evidenceContext.topFindingIds.slice(0, 5).join(', ')}\n` : ''}${evidenceContext.topRecommendationTitles?.length ? `- top_recommendations: ${evidenceContext.topRecommendationTitles.slice(0, 3).join(' | ')}\n` : ''}- handoff_trace: ${evidenceContext.handoffTraceId || 'unknown'}\n`
    : '';

  return `## AiVIS.biz AutoFix

**Issue:** ${issue.title}
**Severity:** ${issue.severity}
**Expected Score Impact:** +${expectedDelta} points

### What this PR does
Addresses the identified AI visibility issue automatically.

### Evidence
${issue.evidence_message || 'See audit report for details.'}
${evidenceBlock}

---
*Generated by AiVIS Auto Score Fix*
`;
}

export function startFixWorker(): void {
  const connection = getBullMQConnection();
  if (!connection) {
    console.log('[FixWorker] Redis not configured - fix worker disabled');
    return;
  }
  if (workerInstance) return;

  workerInstance = new Worker<FixJobData>('fix', async (job) => {
    console.log(`[FixWorker] Processing fix job ${job.id} for issue ${job.data.issueId}`);
    await processFixJob(job.data);
    console.log(`[FixWorker] Completed fix job ${job.id}`);
  }, {
    connection,
    concurrency: 3,
    limiter: { max: 10, duration: 60_000 },
  });

  workerInstance.on('failed', (job, err) => {
    console.error(`[FixWorker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[FixWorker] Fix worker started');
}
