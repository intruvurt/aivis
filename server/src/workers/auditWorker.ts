import { createHash } from 'crypto';
import { scrapeWebsite } from '../services/scraper.js';
import { getPool } from '../services/postgresql.js';
import { publishAuditCompleted } from '../services/agencyAutomationService.js';
import { trackEvent } from '../lib/analytics.js';
import {
  claimNextAuditJob,
  completeAuditJob,
  failAuditJob,
  requeueAuditJob,
  updateAuditJobProgress,
} from '../infra/queues/auditQueue.js';
import { extractEvidenceFromScrapedData } from '../services/audit/evidenceLedger.js';
import { evaluateRules, computeScore, persistRuleResults, persistScoreSnapshot } from '../services/audit/ruleEngine.js';
import { runBragValidationGate, persistBragTrail, persistCiteLedger } from '../services/bragGate.js';
import { runCiteLedgerPipeline } from '../services/citeLedgerService.js';
import { normalizeTrackedUrl } from '../utils/normalizeUrl.js';
import {
  startIngestionJob,
  markFetched as markIngestionFetched,
  markParsed as markIngestionParsed,
  markAnalyzed as markIngestionAnalyzed,
  markCompleted as markIngestionCompleted,
  markFailed as markIngestionFailed,
} from '../services/ingestionPipelineService.js';
import {
  broadcastStageUpdate,
  broadcastPartialResults,
  broadcastAnalysisComplete,
  broadcastAnalysisError,
} from '../services/pipelineStatebroadcaster.js';
import { runProductionHardChecks } from '../services/deterministicContractService.js';

const JOB_TIMEOUT_MS = 55_000;
const FAST_FETCH_TIMEOUT_MS = 6_500;
const CORE_PATHS = ['/', '/about', '/pricing', '/product', '/services'];
let workerInterval: ReturnType<typeof setInterval> | null = null;
let active = 0;

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function hashUrlShard(url: string): number {
  const digest = createHash('md5').update(url).digest('hex');
  return parseInt(digest.slice(0, 6), 16);
}

function toAbsoluteTarget(baseUrl: URL, path: string): string {
  return new URL(path, `${baseUrl.protocol}//${baseUrl.host}`).toString();
}

async function fetchFastHtml(target: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAST_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        'user-agent': 'AiVIS.biz-FastAudit/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;
    const html = await response.text();
    if (!html || html.length < 120) return null;
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readStoredHashes(domain: string): Promise<Map<string, string>> {
  const { rows } = await getPool().query(
    `SELECT path, content_hash
       FROM audit_page_hashes
      WHERE domain = $1`,
    [domain]
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(String(row.path), String(row.content_hash));
  }
  return map;
}

async function upsertPageHash(domain: string, path: string, contentHash: string, changed: boolean): Promise<void> {
  await getPool().query(
    `INSERT INTO audit_page_hashes (domain, path, content_hash, last_checked_at, last_changed_at, change_count)
     VALUES ($1, $2, $3, NOW(), CASE WHEN $4 THEN NOW() ELSE NULL END, CASE WHEN $4 THEN 1 ELSE 0 END)
     ON CONFLICT (domain, path)
     DO UPDATE SET
       content_hash = EXCLUDED.content_hash,
       last_checked_at = NOW(),
       last_changed_at = CASE
         WHEN audit_page_hashes.content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN NOW()
         ELSE audit_page_hashes.last_changed_at
       END,
       change_count = CASE
         WHEN audit_page_hashes.content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN audit_page_hashes.change_count + 1
         ELSE audit_page_hashes.change_count
       END`,
    [domain, path, contentHash, changed]
  );
}

async function getLatestAuditForDomain(userId: string, url: string, workspaceId?: string): Promise<any | null> {
  const { rows } = await getPool().query(
    `SELECT visibility_score, result
       FROM audits
      WHERE user_id = $1
        AND workspace_id IS NOT DISTINCT FROM $3
        AND url = $2
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, url, workspaceId || null]
  );
  return rows[0] || null;
}

async function resolveAuditLineage(userId: string, url: string, workspaceId?: string, excludeAuditId?: string) {
  const normalizedUrl = normalizeTrackedUrl(url);
  const params: Array<string | null> = [userId, workspaceId || null, normalizedUrl];
  let exclusionSql = '';
  if (excludeAuditId) {
    params.push(excludeAuditId);
    exclusionSql = ` AND id <> $4`;
  }

  const { rows } = await getPool().query(
    `SELECT id, run_group_id
       FROM audits
      WHERE user_id = $1
        AND workspace_id IS NOT DISTINCT FROM $2
        AND COALESCE(normalized_url, url) = $3${exclusionSql}
      ORDER BY created_at DESC
      LIMIT 1`,
    params,
  );

  return {
    normalizedUrl,
    priorRunId: rows[0]?.id ? String(rows[0].id) : null,
    runGroupId: rows[0]?.run_group_id ? String(rows[0].run_group_id) : null,
    snapshotKind: rows[0]?.id ? 'delta' : 'snapshot',
  };
}

async function runIncrementalDiff(targetUrl: string) {
  const parsed = new URL(targetUrl);
  const domain = parsed.hostname.toLowerCase();
  const storedHashes = await readStoredHashes(domain);

  const tasks = CORE_PATHS.map(async (path) => {
    const fullUrl = toAbsoluteTarget(parsed, path);
    const html = await fetchFastHtml(fullUrl);
    if (!html) return { path, changed: true, hash: '', reachable: false };
    const contentHash = hashContent(html);
    const oldHash = storedHashes.get(path);
    const changed = !oldHash || oldHash !== contentHash;
    await upsertPageHash(domain, path, contentHash, changed);
    return { path, changed, hash: contentHash, reachable: true };
  });

  const rows = await Promise.all(tasks);
  const reachable = rows.filter((r) => r.reachable);
  const changedPages = reachable.filter((r) => r.changed).map((r) => r.path);

  return {
    domain,
    checked: reachable.length,
    changedPages,
    unchanged: Math.max(0, reachable.length - changedPages.length),
    totalTargets: CORE_PATHS.length,
  };
}

async function runSingleJob() {
  const job = await claimNextAuditJob();
  if (!job) return;
  let ingestionJobId = '';
  let ingestionUrlHash = '';
  const shardCount = Math.max(1, Number(process.env.AUDIT_WORKER_SHARD_TOTAL || '1'));
  const shardIndex = Math.max(0, Number(process.env.AUDIT_WORKER_SHARD_INDEX || '0'));
  if (shardCount > 1) {
    const ownerShard = hashUrlShard(job.payload.url) % shardCount;
    if (ownerShard !== shardIndex) {
      await requeueAuditJob(job.id);
      return;
    }
  }

  const startedAt = Date.now();

  try {
    const gateReport = await runProductionHardChecks();
    if (!gateReport.ok) {
      await failAuditJob(job.id, 'Determinism gate failed before job execution');
      return;
    }

    try {
      const ingestion = await startIngestionJob(job.payload.url);
      ingestionJobId = ingestion.id;
      ingestionUrlHash = ingestion.url_hash;
    } catch (ingestionStartErr: any) {
      console.warn(`[audit-worker] ingestion start skipped: ${ingestionStartErr?.message || ingestionStartErr}`);
    }

    await updateAuditJobProgress(job.id, 'incremental_diff', 12, ['Checking core pages', 'Comparing content hashes']);
    const diff = await runIncrementalDiff(job.payload.url);

    if (diff.checked > 0 && diff.changedPages.length === 0) {
      await updateAuditJobProgress(job.id, 'instant_mode', 70, ['No major changes detected', 'Reusing previous audit result']);
      const cached = await getLatestAuditForDomain(job.payload.userId, job.payload.url, job.payload.workspaceId);
      if (cached?.result) {
        const lineage = await resolveAuditLineage(job.payload.userId, job.payload.url, job.payload.workspaceId);
        await getPool().query(
          `INSERT INTO audits (
             user_id, workspace_id, url, normalized_url, run_group_id, prior_run_id,
             snapshot_kind, visibility_score, result, status, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, COALESCE($5, gen_random_uuid()), $6, $7, $8, $9::jsonb, 'completed', NOW(), NOW())`,
          [
            job.payload.userId,
            job.payload.workspaceId || null,
            job.payload.url,
            lineage.normalizedUrl,
            lineage.runGroupId,
            lineage.priorRunId,
            lineage.snapshotKind,
            Number(cached.visibility_score || 0),
            JSON.stringify(cached.result),
          ]
        );
        if (ingestionJobId && ingestionUrlHash) {
          await markIngestionAnalyzed(ingestionJobId, ingestionUrlHash, cached.result, Number(cached.visibility_score || 0));
          await markIngestionCompleted(ingestionJobId, ingestionUrlHash, cached.result, Number(cached.visibility_score || 0));
        }
        await completeAuditJob(job.id, {
          success: true,
          reused: true,
          changedPages: [],
          checkedPages: diff.checked,
          runtimeMs: Date.now() - startedAt,
        });
        await publishAuditCompleted({
          userId: job.payload.userId,
          domain: job.payload.url,
          score: Number(cached.visibility_score || 0),
        });
        return;
      }
    }

    await updateAuditJobProgress(job.id, 'crawl', 20, ['Running deep crawl', `Changed pages: ${diff.changedPages.length}/${diff.totalTargets}`]);
    const scraped = await Promise.race([
      scrapeWebsite(job.payload.url),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Audit worker timeout')), JOB_TIMEOUT_MS)),
    ]);

    let ingestionSnapshotId: string | null = null;
    if (ingestionJobId && ingestionUrlHash) {
      ingestionSnapshotId = await markIngestionFetched(ingestionJobId, ingestionUrlHash, scraped);
      await markIngestionParsed(ingestionJobId, ingestionUrlHash, scraped, ingestionSnapshotId);
    }

    await updateAuditJobProgress(job.id, 'extract', 48, ['Extracting page signals', 'Compiling structure + trust data']);
    // Broadcast fetch + parse stages to realtime subscribers
    if (ingestionJobId) {
      try {
        const fetchDuration = Date.now() - startedAt;
        await broadcastStageUpdate(ingestionJobId, 'fetched', fetchDuration);
        await broadcastStageUpdate(ingestionJobId, 'parsed', fetchDuration);
      } catch (err: any) {
        console.warn(`[audit-worker] Broadcast fetch/parse error (non-fatal): ${err?.message || err}`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Execute full audit pipeline
    // ─────────────────────────────────────────────────────────────────────────────
    const auditRunId = job.id;
    let finalScore = 0;
    let finalResult: Record<string, unknown> = {};

    try {
      // 1. Extract evidence from scraped data
      const evidence = extractEvidenceFromScrapedData(auditRunId, scraped);

      // 2. Evaluate rules against evidence
      const ruleResults = evaluateRules(evidence.items, evidence.contradictions.length);

      // 3. Compute visibility score from rule results
      const scoreSnapshot = computeScore(ruleResults, evidence.items, evidence.contradictions.length);
      finalScore = Math.round(scoreSnapshot.finalScore);

      // 4. Run BRAG validation gate to issue evidence-backed finding IDs
      const bragValidation = await runBragValidationGate({
        auditId: auditRunId,
        url: scraped.url,
        evidenceItems: evidence.items,
        ruleResults: ruleResults,
        aiRecommendations: [],
        scrapeSummary: scraped.data,
      });

      // Broadcast entity extraction + score to realtime subscribers.
      if (ingestionJobId) {
        try {
          const stageDuration = Date.now() - startedAt;
          await broadcastStageUpdate(ingestionJobId, 'analyzed', stageDuration);
          await broadcastPartialResults(ingestionJobId, {
            score: finalScore,
            visibility: finalScore,
          });
        } catch (err: any) {
          console.warn(`[audit-worker] Broadcast analyze error (non-fatal): ${err?.message || err}`);
        }
      }

      // 5. Persist rule results to audit_rule_results table
      await persistRuleResults(auditRunId, ruleResults);

      // 6. Persist score snapshot to audit_score_snapshots table
      await persistScoreSnapshot(auditRunId, job.payload.userId, scraped.url, scoreSnapshot);

      // 7. If BRAG findings exist, persist BRAG trail and cite ledger entries
      if (bragValidation.findings && bragValidation.findings.length > 0) {
        const pool = getPool();
        await persistBragTrail(pool, auditRunId, bragValidation);

        if (bragValidation.cite_ledger && bragValidation.cite_ledger.length > 0) {
          await persistCiteLedger(pool, auditRunId, bragValidation.cite_ledger);
        }
      }

      // 8. Fire-and-forget cite ledger pipeline (no await needed)
      const urlObj = new URL(scraped.url);
      runCiteLedgerPipeline({
        auditRunId,
        userId: job.payload.userId,
        url: scraped.url,
        domain: urlObj.hostname || "",
        score: finalScore,
        evidenceCount: evidence.items.length,
        scoreSource: "audit",
      }).catch((err: any) => {
        console.warn(`[audit-worker] Cite ledger pipeline error (non-fatal): ${err?.message || err}`);
      });

      const bragFindingsCount = bragValidation.findings?.length ?? 0;
      const bragRejectedCount = bragValidation.rejected_count ?? 0;
      const bragEvidenceTotal = bragFindingsCount + bragRejectedCount;
      const bragCoverageRatio =
        bragEvidenceTotal > 0
          ? Number((bragFindingsCount / bragEvidenceTotal).toFixed(4))
          : 1;
      const bragTruthState =
        evidence.items.length > 0 && (bragFindingsCount > 0 || bragRejectedCount > 0)
          ? 'evidence_backed'
          : 'insufficient_evidence';
      const topFindings = Array.isArray(bragValidation.findings)
        ? bragValidation.findings
            .slice(0, 5)
            .map((finding) => ({
              id: finding.brag_id,
              title: finding.title,
              severity: finding.severity,
              confidence: finding.confidence,
            }))
        : [];

      // Build result payload
      finalResult = {
        success: true,
        visibility_score: finalScore,
        scrape: scraped.data,
        evidence_count: evidence.items.length,
        rule_count: ruleResults.length,
        brag_findings_count: bragFindingsCount,
        brag_validation: {
          truth_state: bragTruthState,
          finding_count: bragFindingsCount,
          rejected_count: bragRejectedCount,
          cite_ledger_count: bragValidation.cite_ledger?.length ?? 0,
          coverage_ratio: bragCoverageRatio,
          root_hash: bragValidation.root_hash,
          gate_version: bragValidation.gate_version,
          derived_score: bragValidation.derived_score,
          findings: topFindings,
        },
        truth_packet: {
          state: bragTruthState,
          verified_at: new Date().toISOString(),
          score_source: 'evidence',
          verifiable: evidence.items.length > 0,
          evidence_count: evidence.items.length,
          brag: {
            finding_count: bragFindingsCount,
            rejected_count: bragRejectedCount,
            coverage_ratio: bragCoverageRatio,
            root_hash: bragValidation.root_hash,
            gate_version: bragValidation.gate_version,
            top_findings: topFindings,
          },
        },
      };
    } catch (pipelineErr: any) {
      console.error(`[audit-worker] Pipeline execution error: ${pipelineErr?.message || pipelineErr}`);
      // Graceful degradation: continue with scrape-only result
      finalScore = 0;
      finalResult = {
        success: false,
        error: pipelineErr?.message || 'Pipeline execution failed',
        scrape: scraped.data,
      };
    }

    if (ingestionJobId && ingestionUrlHash) {
      await markIngestionAnalyzed(ingestionJobId, ingestionUrlHash, finalResult, finalScore);
      await markIngestionCompleted(ingestionJobId, ingestionUrlHash, finalResult, finalScore);
    }

    await updateAuditJobProgress(job.id, 'persist', 92, ['Saving audit record', 'Finalizing status']);
    // Broadcast completion to realtime subscribers
    if (ingestionJobId) {
      try {
        const totalDuration = Date.now() - startedAt;
        if (finalResult.success) {
          await broadcastStageUpdate(ingestionJobId, 'completed', totalDuration);
          await broadcastAnalysisComplete(ingestionJobId, finalResult);
        } else {
          await broadcastAnalysisError(ingestionJobId, finalResult?.error as string || 'Unknown error');
        }
      } catch (err: any) {
        console.warn(`[audit-worker] Broadcast completion error (non-fatal): ${err?.message || err}`);
      }
    }

    // Update audit record with real score and result
    const pool = getPool();
    const auditResult = await pool.query(
      `SELECT id FROM audits WHERE id = $1 LIMIT 1`,
      [auditRunId]
    );

    if (auditResult.rows.length > 0) {
      // Update existing audit record
      const lineage = await resolveAuditLineage(job.payload.userId, scraped.url, job.payload.workspaceId, auditRunId);
      await pool.query(
        `UPDATE audits SET normalized_url = $2,
                           run_group_id = COALESCE($3, run_group_id, gen_random_uuid()),
                           prior_run_id = $4,
                           snapshot_kind = $5,
                           visibility_score = $6,
                           result = $7::jsonb,
                           status = 'completed',
                           updated_at = NOW()
         WHERE id = $1`,
        [
          auditRunId,
          lineage.normalizedUrl,
          lineage.runGroupId,
          lineage.priorRunId,
          lineage.snapshotKind,
          finalScore,
          JSON.stringify(finalResult),
        ]
      );
    } else {
      // Create new audit record (fallback)
      const lineage = await resolveAuditLineage(job.payload.userId, scraped.url, job.payload.workspaceId);
      await pool.query(
        `INSERT INTO audits (
           id, user_id, workspace_id, url, normalized_url, run_group_id, prior_run_id,
           snapshot_kind, visibility_score, result, status, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, gen_random_uuid()), $7, $8, $9, $10::jsonb, 'completed', NOW(), NOW())`,
        [
          auditRunId,
          job.payload.userId,
          job.payload.workspaceId || null,
          scraped.url,
          lineage.normalizedUrl,
          lineage.runGroupId,
          lineage.priorRunId,
          lineage.snapshotKind,
          finalScore,
          JSON.stringify(finalResult),
        ]
      );
    }

    await completeAuditJob(job.id, {
      success: true,
      score: finalScore,
      reused: false,
      changedPages: diff.changedPages,
      checkedPages: diff.checked,
      runtimeMs: Date.now() - startedAt,
    });

    // Track successful audit completion
    trackEvent('audit_completed', {
      userId: job.payload.userId,
      score: finalScore,
      url: scraped.url,
      evidenceCount: finalResult.evidence_count || 0,
      ruleCount: finalResult.rule_count || 0,
      bragFindingsCount: finalResult.brag_findings_count || 0,
    });

    await publishAuditCompleted({
      userId: job.payload.userId,
      domain: scraped.url,
      score: finalScore,
    });
  } catch (err: any) {
    if (ingestionJobId && ingestionUrlHash) {
      await markIngestionFailed(ingestionJobId, ingestionUrlHash, err?.message || 'Audit failed');
    }
    await failAuditJob(job.id, err?.message || 'Audit failed');
  }
}

export function startAuditWorkerLoop() {
  if (workerInterval) return;
  const concurrency = Math.max(1, Number(process.env.AUDIT_WORKER_CONCURRENCY || 3));
  workerInterval = setInterval(async () => {
    while (active < concurrency) {
      active += 1;
      runSingleJob()
        .catch(() => { })
        .finally(() => {
          active = Math.max(0, active - 1);
        });
    }
  }, 800);
}
