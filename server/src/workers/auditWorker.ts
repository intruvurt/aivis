import { createHash } from 'crypto';
import { scrapeWebsite } from '../services/scraper.js';
import { getPool } from '../services/postgresql.js';
import { publishAuditCompleted } from '../services/agencyAutomationService.js';
import {
  claimNextAuditJob,
  completeAuditJob,
  failAuditJob,
  requeueAuditJob,
  updateAuditJobProgress,
} from '../infra/queues/auditQueue.js';
import { getRedis } from '../infra/redis.js';

const JOB_TIMEOUT_MS = 55_000;
const FAST_FETCH_TIMEOUT_MS = 6_500;
const CORE_PATHS = ['/', '/about', '/pricing', '/product', '/services'];
let workerInterval: ReturnType<typeof setInterval> | null = null;
let active = 0;

function deriveScore(payload: Awaited<ReturnType<typeof scrapeWebsite>>): number {
  const wordCount = Number(payload.data.wordCount || 0);
  const hasH1 = Array.isArray(payload.data.headings?.h1) && payload.data.headings!.h1.length > 0;
  const schemaCount = Number(payload.data.structuredData?.jsonLdCount || 0);
  const hasMeta = Boolean(payload.data.meta?.description);
  const hasCanonical = Boolean(payload.data.canonical);

  let score = 25;
  score += Math.min(25, Math.round(wordCount / 40));
  if (hasH1) score += 15;
  if (schemaCount > 0) score += 20;
  if (hasMeta) score += 10;
  if (hasCanonical) score += 10;
  return Math.max(0, Math.min(100, score));
}

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
        'user-agent': 'AiVIS-FastAudit/1.0',
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

async function getLatestAuditForDomain(userId: string, url: string): Promise<any | null> {
  const { rows } = await getPool().query(
    `SELECT visibility_score, result
       FROM audits
      WHERE user_id = $1
        AND url = $2
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, url]
  );
  return rows[0] || null;
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
    await updateAuditJobProgress(job.id, 'incremental_diff', 12, ['Checking core pages', 'Comparing content hashes']);
    const diff = await runIncrementalDiff(job.payload.url);

    if (diff.checked > 0 && diff.changedPages.length === 0) {
      await updateAuditJobProgress(job.id, 'instant_mode', 70, ['No major changes detected', 'Reusing previous audit result']);
      const cached = await getLatestAuditForDomain(job.payload.userId, job.payload.url);
      if (cached?.result) {
        await getPool().query(
          `INSERT INTO audits (user_id, url, visibility_score, result, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, 'completed', NOW(), NOW())`,
          [job.payload.userId, job.payload.url, Number(cached.visibility_score || 0), JSON.stringify(cached.result)]
        );
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

    await updateAuditJobProgress(job.id, 'extract', 48, ['Extracting page signals', 'Compiling structure + trust data']);
    const score = deriveScore(scraped);
    await updateAuditJobProgress(job.id, 'score', 82, ['Scoring visibility', 'Preparing report payload']);

    await getPool().query(
      `INSERT INTO audits (user_id, url, visibility_score, result, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, 'completed', NOW(), NOW())`,
      [job.payload.userId, scraped.url, score, JSON.stringify({ queued: true, score, scrape: scraped.data })]
    );

    await completeAuditJob(job.id, {
      success: true,
      score,
      reused: false,
      changedPages: diff.changedPages,
      checkedPages: diff.checked,
      runtimeMs: Date.now() - startedAt,
    });
    await publishAuditCompleted({
      userId: job.payload.userId,
      domain: scraped.url,
      score,
    });
  } catch (err: any) {
    await failAuditJob(job.id, err?.message || 'Audit failed');
  }
}

export function startAuditWorkerLoop() {
  if (workerInterval) return;
  if (!getRedis()) {
    console.warn('[AuditQueue] Redis unavailable — worker loop not started');
    return;
  }
  const concurrency = Math.max(1, Number(process.env.AUDIT_WORKER_CONCURRENCY || 3));
  workerInterval = setInterval(async () => {
    while (active < concurrency) {
      active += 1;
      runSingleJob()
        .catch(() => {})
        .finally(() => {
          active = Math.max(0, active - 1);
        });
    }
  }, 800);
}
