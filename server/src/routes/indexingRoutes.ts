import { Router } from 'express';
import type { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { pingIndexNow } from '../utils/indexNow.js';
import { getPool } from '../services/postgresql.js';
import { isPrivateOrLocalHost } from '../lib/urlSafety.js';

const router = Router();

// All indexing routes require authentication
router.use(authRequired);

/* ── Check URL indexing status via Bing / Google site: results ─────────── */
router.post('/check', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    return res.status(400).json({ error: 'Private/local URLs are not allowed' });
  }

  const canonicalUrl = parsed.href;

  try {
    // Check our own analysis_cache / audits for evidence of this URL
    const pool = getPool();
    const auditResult = await pool.query(
      `SELECT id, created_at, visibility_score FROM audits 
       WHERE user_id = $1 AND LOWER(url) = LOWER($2) 
       ORDER BY created_at DESC LIMIT 1`,
      [(req as any).user?.id, canonicalUrl]
    );

    // Construct search engine check URLs (these open in user's browser)
    const siteQueryEncoded = encodeURIComponent(`site:${parsed.hostname}${parsed.pathname !== '/' ? parsed.pathname : ''}`);
    const urlEncoded = encodeURIComponent(canonicalUrl);

    const checkLinks = {
      google: `https://www.google.com/search?q=${siteQueryEncoded}`,
      bing: `https://www.bing.com/search?q=${siteQueryEncoded}`,
      googleCache: `https://webcache.googleusercontent.com/search?q=cache:${urlEncoded}`,
      bingUrl: `https://www.bing.com/webmaster/indexexplorer?url=${urlEncoded}`,
    };

    // Check IndexNow configuration status
    const indexNowKeySet = !!(process.env.INDEXNOW_KEY || process.env.INDEXNOW_API_KEY);

    const lastAudit = auditResult.rows[0] || null;

    return res.json({
      url: canonicalUrl,
      hostname: parsed.hostname,
      checkLinks,
      indexNowAvailable: indexNowKeySet,
      lastAudit: lastAudit
        ? {
            id: lastAudit.id,
            date: lastAudit.created_at,
            score: lastAudit.visibility_score,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[Indexing] Check failed:', err?.message);
    return res.status(500).json({ error: 'Failed to check indexing status' });
  }
});

/* ── Submit URL to IndexNow ───────────────────────────────────────────── */
router.post('/submit', async (req: Request, res: Response) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  if (urls.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 URLs per submission' });
  }

  // Validate all URLs
  const validUrls: string[] = [];
  for (const rawUrl of urls) {
    if (typeof rawUrl !== 'string') continue;
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      if (!isPrivateOrLocalHost(parsed.hostname)) {
        validUrls.push(parsed.href);
      }
    } catch {
      // skip invalid URLs
    }
  }

  if (validUrls.length === 0) {
    return res.status(400).json({ error: 'No valid public URLs provided' });
  }

  const result = await pingIndexNow(validUrls);

  // Log the submission
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO indexnow_submissions (user_id, urls, submitted_count, skipped_count, error, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [(req as any).user?.id, JSON.stringify(validUrls), result.submitted, result.skipped, result.error || null]
    );
  } catch (logErr: any) {
    // Non-fatal: logging failure shouldn't block the response
    console.warn('[Indexing] Failed to log submission:', logErr?.message);
  }

  return res.json({
    success: !result.error,
    ...result,
    urls: validUrls,
  });
});

/* ── Get user's IndexNow submission history ───────────────────────────── */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, urls, submitted_count, skipped_count, error, created_at 
       FROM indexnow_submissions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [(req as any).user?.id]
    );

    return res.json({
      submissions: result.rows.map((r: any) => ({
        id: r.id,
        urls: typeof r.urls === 'string' ? JSON.parse(r.urls) : r.urls,
        submittedCount: r.submitted_count,
        skippedCount: r.skipped_count,
        error: r.error,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    // Table may not exist yet - return empty
    if (err?.code === '42P01') {
      return res.json({ submissions: [] });
    }
    console.error('[Indexing] History fetch failed:', err?.message);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/* ── IndexNow setup status ────────────────────────────────────────────── */
router.get('/setup-status', async (_req: Request, res: Response) => {
  const key = process.env.INDEXNOW_KEY || process.env.INDEXNOW_API_KEY;
  return res.json({
    configured: !!key,
    keyHint: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null,
  });
});

export default router;
