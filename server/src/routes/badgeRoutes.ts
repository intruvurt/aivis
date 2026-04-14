// server/src/routes/badgeRoutes.ts
// Dofollow backlink badge — impression tracking + click redirect
import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { getPool } from '../services/postgresql.js';

const router = Router();

const BADGE_IMAGE_PATH = '/aivis-footer-badge-dofollow.png';
const SITE_URL = process.env.FRONTEND_URL || 'https://aivis.biz';

/** Hash IP for privacy-safe storage */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.JWT_SECRET || 'badge-salt')).digest('hex').slice(0, 32);
}

/** Extract domain from referer header */
function extractDomain(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname;
  } catch {
    return null;
  }
}

/**
 * GET /api/badge/img
 * Serves a 1×1 transparent pixel for impression tracking, then logs the event.
 * The actual badge image is loaded directly from the CDN / public dir via the
 * embed snippet's <img> tag. This endpoint fires as a secondary hidden pixel.
 */
router.get('/img', async (req: Request, res: Response) => {
  // Fire-and-forget tracking — don't block the response
  const referer = req.headers.referer || req.headers.referrer as string | undefined;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  const ua = req.headers['user-agent'] || '';
  const ownerId = typeof req.query.uid === 'string' ? req.query.uid : null;

  // Serve a 1×1 transparent GIF immediately
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(pixel.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  });
  res.status(200).end(pixel);

  // Log impression asynchronously
  try {
    const pool = getPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO badge_events (event_type, badge_owner_id, referrer_url, referrer_domain, ip_hash, user_agent)
       VALUES ('impression', $1, $2, $3, $4, $5)`,
      [ownerId, referer || null, extractDomain(referer), hashIp(ip), ua.slice(0, 512)],
    );
  } catch {
    // Non-critical — don't crash on tracking failure
  }
});

/**
 * GET /api/badge/click
 * Click redirect: logs the click event, then 302s to the AiVIS homepage (or custom dest).
 */
router.get('/click', async (req: Request, res: Response) => {
  const referer = req.headers.referer || req.headers.referrer as string | undefined;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  const ua = req.headers['user-agent'] || '';
  const ownerId = typeof req.query.uid === 'string' ? req.query.uid : null;

  // Log click asynchronously
  try {
    const pool = getPool();
    if (pool) {
      await pool.query(
        `INSERT INTO badge_events (event_type, badge_owner_id, referrer_url, referrer_domain, ip_hash, user_agent)
         VALUES ('click', $1, $2, $3, $4, $5)`,
        [ownerId, referer || null, extractDomain(referer), hashIp(ip), ua.slice(0, 512)],
      );
    }
  } catch {
    // Non-critical
  }

  res.redirect(302, `${SITE_URL}/?ref=badge`);
});

/**
 * GET /api/badge/stats
 * Returns impression + click counts for a badge owner. Requires uid query param.
 */
router.get('/stats', async (req: Request, res: Response) => {
  const ownerId = typeof req.query.uid === 'string' ? req.query.uid : null;
  if (!ownerId) {
    res.status(400).json({ error: 'Missing uid parameter' });
    return;
  }

  try {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: 'Database unavailable' }); return; }

    const result = await pool.query(
      `SELECT
         event_type,
         COUNT(*)::int AS count,
         COUNT(DISTINCT referrer_domain) FILTER (WHERE referrer_domain IS NOT NULL)::int AS unique_domains
       FROM badge_events
       WHERE badge_owner_id = $1
       GROUP BY event_type`,
      [ownerId],
    );

    const stats: Record<string, { count: number; unique_domains: number }> = {};
    for (const row of result.rows) {
      stats[row.event_type] = { count: row.count, unique_domains: row.unique_domains };
    }

    // Top referrer domains
    const topDomains = await pool.query(
      `SELECT referrer_domain, COUNT(*)::int AS hits
       FROM badge_events
       WHERE badge_owner_id = $1 AND referrer_domain IS NOT NULL
       GROUP BY referrer_domain ORDER BY hits DESC LIMIT 10`,
      [ownerId],
    );

    res.json({
      impressions: stats.impression || { count: 0, unique_domains: 0 },
      clicks: stats.click || { count: 0, unique_domains: 0 },
      top_domains: topDomains.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch badge stats' });
  }
});

/**
 * GET /api/badge/embed
 * Returns the embeddable HTML snippet for a given uid.
 */
router.get('/embed', (req: Request, res: Response) => {
  const uid = typeof req.query.uid === 'string' ? req.query.uid : '';
  const badgeSrc = `${SITE_URL}${BADGE_IMAGE_PATH}`;
  const trackSrc = `${SITE_URL}/api/badge/img${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`;
  const clickHref = `${SITE_URL}/api/badge/click${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`;

  const snippet = `<!-- AiVIS Visibility Badge -->
<a href="${clickHref}" target="_blank" rel="dofollow" title="AI Visibility Audit by AiVIS">
  <img src="${badgeSrc}" alt="Audited by AiVIS – Evidence-backed site analysis for AI answers" width="150" height="42" style="border:0;" loading="lazy" />
</a>
<img src="${trackSrc}" alt="" width="1" height="1" style="position:absolute;opacity:0;pointer-events:none;" aria-hidden="true" />`;

  res.json({ snippet, badge_image: badgeSrc, click_url: clickHref, tracking_pixel: trackSrc });
});

export default router;
