import type { Request, Response } from 'express';
import { getPool } from '../services/postgresql.js';
import type { CompetitorTracking, CompetitorComparison, AnalysisResponse } from '../../../shared/types.js';
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import { gateToolAction } from '../services/toolCreditGate.js';
import { checkCompetitorMilestones } from '../services/milestoneService.js';
import { scrapeDDGRaw, scrapeBingRaw } from '../services/webSearch.js';
import { textMentionsBrand } from '../services/searchDisambiguation.js';
import { getFingerprint } from '../services/entityFingerprint.js';
import { isUrlscanAvailable, scanAndEnrich } from '../services/urlscanService.js';
import { ensureDefaultWorkspaceForUser } from '../services/tenantService.js';

type CompetitorSuggestion = {
  nickname: string;
  url: string;
};

/**
 * Fire-and-forget: submit competitor URL to urlscan.io, wait for screenshot,
 * then persist the screenshot URL on the competitor_tracking row.
 */
async function screenshotCompetitorBackground(competitorId: string, url: string): Promise<void> {
  try {
    console.log(`[competitors] Screenshot job started for competitor_id=${competitorId} url=${url}`);
    const enrichment = await scanAndEnrich(url, 90_000);
    if (enrichment.screenshotUrl) {
      const pool = getPool();
      await pool.query(
        `UPDATE competitor_tracking SET screenshot_url = $1, updated_at = NOW() WHERE id = $2`,
        [enrichment.screenshotUrl, competitorId],
      );
      console.log(`[competitors] Screenshot stored for competitor_id=${competitorId} url=${url}`);
    } else {
      console.warn(`[competitors] Screenshot job completed without image for competitor_id=${competitorId} url=${url}`);
    }
  } catch (err: any) {
    console.warn(`[competitors] Screenshot capture failed for competitor_id=${competitorId} url=${url}: ${err?.message}`);
  }
}

const NICHE_COMPETITOR_SUGGESTIONS: Record<string, { label: string; suggestions: CompetitorSuggestion[] }> = {
  'home-services': {
    label: 'Home Services',
    suggestions: [
      { nickname: 'Angi', url: 'https://www.angi.com' },
      { nickname: 'Thumbtack', url: 'https://www.thumbtack.com' },
      { nickname: 'HomeAdvisor', url: 'https://www.homeadvisor.com' },
      { nickname: 'Taskrabbit', url: 'https://www.taskrabbit.com' },
      { nickname: 'Porch', url: 'https://porch.com' },
    ],
  },
  'legal-services': {
    label: 'Legal Services',
    suggestions: [
      { nickname: 'Rocket Lawyer', url: 'https://www.rocketlawyer.com' },
      { nickname: 'LegalZoom', url: 'https://www.legalzoom.com' },
      { nickname: 'Nolo', url: 'https://www.nolo.com' },
      { nickname: 'FindLaw', url: 'https://www.findlaw.com' },
      { nickname: 'Justia', url: 'https://www.justia.com' },
    ],
  },
  'health-wellness': {
    label: 'Health & Wellness',
    suggestions: [
      { nickname: 'Healthline', url: 'https://www.healthline.com' },
      { nickname: 'WebMD', url: 'https://www.webmd.com' },
      { nickname: 'Verywell Health', url: 'https://www.verywellhealth.com' },
      { nickname: 'Medical News Today', url: 'https://www.medicalnewstoday.com' },
      { nickname: 'Cleveland Clinic', url: 'https://my.clevelandclinic.org' },
    ],
  },
  'saas-productivity': {
    label: 'SaaS & Productivity',
    suggestions: [
      { nickname: 'Notion', url: 'https://www.notion.so' },
      { nickname: 'ClickUp', url: 'https://clickup.com' },
      { nickname: 'Asana', url: 'https://asana.com' },
      { nickname: 'Airtable', url: 'https://www.airtable.com' },
      { nickname: 'Monday.com', url: 'https://monday.com' },
    ],
  },
  'ecommerce-dtc': {
    label: 'Ecommerce & DTC',
    suggestions: [
      { nickname: 'Shopify', url: 'https://www.shopify.com' },
      { nickname: 'BigCommerce', url: 'https://www.bigcommerce.com' },
      { nickname: 'Etsy', url: 'https://www.etsy.com' },
      { nickname: 'Amazon', url: 'https://www.amazon.com' },
      { nickname: 'Walmart', url: 'https://www.walmart.com' },
    ],
  },
  'agencies-marketing': {
    label: 'Agencies & Marketing',
    suggestions: [
      { nickname: 'HubSpot', url: 'https://www.hubspot.com' },
      { nickname: 'Neil Patel', url: 'https://neilpatel.com' },
      { nickname: 'SEMrush', url: 'https://www.semrush.com' },
      { nickname: 'Ahrefs', url: 'https://ahrefs.com' },
      { nickname: 'Moz', url: 'https://moz.com' },
    ],
  },
  'restaurants-hospitality': {
    label: 'Restaurants & Hospitality',
    suggestions: [
      { nickname: 'OpenTable', url: 'https://www.opentable.com' },
      { nickname: 'Resy', url: 'https://resy.com' },
      { nickname: 'TripAdvisor', url: 'https://www.tripadvisor.com' },
      { nickname: 'Yelp', url: 'https://www.yelp.com' },
      { nickname: 'Booking.com', url: 'https://www.booking.com' },
    ],
  },
};

// GET /api/competitors/suggestions?niche=<key>&url=<target> - Get competitor suggestions
// Priority: (1) smart discovery from the user's audit history, (2) niche templates only when explicitly selected
export async function getCompetitorSuggestions(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const nicheParam = String(req.query.niche || '').trim().toLowerCase();
    const targetUrl = String(req.query.url || '').trim();
    const pool = getPool();

    // ── Phase 1: Smart discovery from user's audit history ────────────────
    let discovered: CompetitorSuggestion[] = [];
    let usedWebSearch = false;

    if (targetUrl) {
      let targetDomain = '';
      try {
        const candidate = /^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
        targetDomain = new URL(candidate).hostname.replace(/^www\./, '').toLowerCase();
      } catch { /* ignore malformed */ }

      if (targetDomain) {
        try {
          // Get keywords from the target URL's latest audit
          const { rows: auditRows } = await pool.query(
            `SELECT result->'topical_keywords' AS keywords
             FROM audits WHERE user_id = $1 AND url ILIKE $2
             ORDER BY created_at DESC LIMIT 1`,
            [userId, `%${targetDomain}%`],
          );

          const targetKeywords: string[] = Array.isArray(auditRows[0]?.keywords)
            ? auditRows[0].keywords.map((k: unknown) => String(k).toLowerCase())
            : [];

          // Build set of domains to exclude (already-tracked + target itself)
          const { rows: tracked } = await pool.query(
            'SELECT competitor_url FROM competitor_tracking WHERE user_id = $1',
            [userId],
          );
          const excludeDomains = new Set<string>();
          excludeDomains.add(targetDomain);
          for (const row of tracked) {
            try { excludeDomains.add(new URL(row.competitor_url).hostname.replace(/^www\./, '').toLowerCase()); }
            catch { /* skip */ }
          }

          // Find other audited URLs by this user that share keyword overlap
          const { rows: candidates } = await pool.query(
            `SELECT DISTINCT ON (lower(regexp_replace(regexp_replace(url, '^https?://(www\\.)?', ''), '/+$', '')))
               url, result->'topical_keywords' AS keywords
             FROM audits
             WHERE user_id = $1 AND url NOT ILIKE $2
             ORDER BY lower(regexp_replace(regexp_replace(url, '^https?://(www\\.)?', ''), '/+$', '')),
                      created_at DESC
             LIMIT 40`,
            [userId, `%${targetDomain}%`],
          );

          for (const c of candidates) {
            let domain = '';
            try { domain = new URL(c.url).hostname.replace(/^www\./, '').toLowerCase(); }
            catch { continue; }
            if (excludeDomains.has(domain)) continue;

            const cKeywords: string[] = Array.isArray(c.keywords)
              ? c.keywords.map((k: unknown) => String(k).toLowerCase())
              : [];

            // Require at least 1 keyword overlap when we have keywords, otherwise accept all non-excluded domains
            const overlap = targetKeywords.length > 0
              ? targetKeywords.filter(k => cKeywords.includes(k)).length
              : 0;

            if (overlap >= 1 || targetKeywords.length === 0) {
              discovered.push({ nickname: domain, url: c.url });
              excludeDomains.add(domain);
              if (discovered.length >= 8) break;
            }
          }

          // ── Phase 1b: Live web search when audit history yields nothing ──
          if (discovered.length < 3 && targetKeywords.length > 0) {
            try {
              const searchQuery = targetKeywords.slice(0, 4).join(' ');
              const [ddgResults, bingResults] = await Promise.all([
                scrapeDDGRaw(searchQuery, 15).catch(() => []),
                scrapeBingRaw(searchQuery, 10).catch(() => []),
              ]);

              const allResults = [...ddgResults, ...bingResults];
              const NOISE_DOMAINS = new Set([
                'wikipedia.org', 'youtube.com', 'reddit.com', 'facebook.com',
                'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
                'pinterest.com', 'tiktok.com', 'amazon.com', 'ebay.com',
                'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com',
                'quora.com', 'medium.com', 'github.com', 'stackoverflow.com',
              ]);

              const seenDomains = new Set<string>();
              for (const r of allResults) {
                if (discovered.length >= 8) break;
                let href: string;
                try { href = r.href; } catch { continue; }
                let domain: string;
                try { domain = new URL(href).hostname.replace(/^www\./, '').toLowerCase(); }
                catch { continue; }

                if (excludeDomains.has(domain)) continue;
                if (seenDomains.has(domain)) continue;
                if (NOISE_DOMAINS.has(domain)) continue;
                // Skip gov/edu/social aggregator domains
                if (/\.(gov|edu|mil)$/i.test(domain)) continue;

                seenDomains.add(domain);
                const label = domain.split('.')[0] || '';
                // Skip very short or generic labels
                if (label.length < 3) continue;

                discovered.push({ nickname: domain, url: `https://${domain}` });
                excludeDomains.add(domain);
                usedWebSearch = true;
              }
            } catch (err) {
              console.error('[Competitors] Web search discovery error (non-fatal):', err);
            }
          }
        } catch (err) {
          console.error('[Competitors] Smart discovery error (non-fatal):', err);
        }
      }
    }

    // ── Phase 2: Profile-based discovery fallback ─────────────────────────
    if (discovered.length === 0) {
      try {
        const user = (req as any).user;
        const website = String(user?.website || '').trim();
        if (website) {
          const profileResults = await discoverCompetitorsFromHistory(userId, website);
          discovered = profileResults
            .filter(s => !s.already_tracked)
            .slice(0, 8)
            .map(s => ({ nickname: s.domain, url: s.url }));
        }
      } catch { /* non-fatal */ }
    }

    // ── Phase 3: Niche templates (only when user explicitly picks one) ────
    const selectedNiche = nicheParam && NICHE_COMPETITOR_SUGGESTIONS[nicheParam] ? nicheParam : '';

    const nicheOptions = Object.entries(NICHE_COMPETITOR_SUGGESTIONS).map(([key, value]) => ({
      key,
      label: value.label,
      count: value.suggestions.length,
    }));

    // Only return niche suggestions when the user explicitly selected a niche
    const nicheSuggestions = selectedNiche
      ? NICHE_COMPETITOR_SUGGESTIONS[selectedNiche].suggestions
      : [];

    // Smart discovery takes priority over niche templates
    const suggestions = discovered.length > 0 ? discovered : nicheSuggestions;

    return res.json({
      success: true,
      selected_niche: selectedNiche || null,
      niches: nicheOptions,
      suggestions,
      discovery_source: discovered.length > 0
        ? (usedWebSearch ? 'web_search' : 'audit_history')
        : selectedNiche
          ? 'niche'
          : 'none',
    });
  } catch (err: any) {
    console.error('[Competitors] Suggestions error:', err);
    return res.status(500).json({ error: 'Failed to load competitor suggestions' });
  }
}

// GET /api/competitors - List all competitors for a user
export async function listCompetitors(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    // Only fetch the columns CompetitorManager actually uses — no result JSON, no lateral join.
    // The comparison endpoint has its own optimised query that fetches result JSON when needed.
    const { rows } = await pool.query(
      `SELECT
        ct.id, ct.user_id, ct.competitor_url, ct.nickname,
        ct.latest_audit_id, ct.latest_score,
        ct.monitoring_enabled, ct.monitor_frequency, ct.next_monitor_at,
        ct.last_checked_at, ct.last_change_detected_at,
        ct.last_change_evidence, ct.last_score_change_reason,
        ct.screenshot_url, ct.auto_discovered,
        ct.created_at, ct.updated_at
       FROM competitor_tracking ct
       WHERE ct.user_id = $1
       ORDER BY ct.created_at DESC`,
      [userId]
    );

    return res.json({ success: true, competitors: rows });
  } catch (err: any) {
    console.error('[Competitors] List error:', err);
    return res.status(500).json({ error: 'Failed to fetch competitors' });
  }
}

// POST /api/competitors - Add a new competitor
export async function createCompetitor(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { url, nickname, track_keywords } = req.body;
    if (!url || !nickname) {
      return res.status(400).json({ error: 'URL and nickname are required' });
    }

    const normalized = normalizePublicHttpUrl(String(url));
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error, code: 'INVALID_URL' });
    }

    // Extract canonical domain from the URL
    let canonicalDomain = '';
    try {
      canonicalDomain = new URL(normalized.url).hostname.replace(/^www\./, '');
    } catch { /* leave empty */ }

    // Prevent adding own site as a competitor
    const userObj = (req as any).user;
    const userWebsite = String(userObj?.website || '').trim();
    if (userWebsite && canonicalDomain) {
      let ownDomain = '';
      try {
        const candidate = /^https?:\/\//i.test(userWebsite) ? userWebsite : `https://${userWebsite}`;
        ownDomain = new URL(candidate).hostname.replace(/^www\./, '').toLowerCase();
      } catch { /* skip */ }
      if (ownDomain && ownDomain === canonicalDomain.toLowerCase()) {
        return res.status(400).json({ error: 'You cannot add your own website as a competitor', code: 'SELF_COMPETITOR' });
      }
    }

    // Sanitize track_keywords
    const safeKeywords = Array.isArray(track_keywords)
      ? track_keywords.filter((k: unknown) => typeof k === 'string' && String(k).length >= 2 && String(k).length <= 100).slice(0, 20).map((k: unknown) => String(k).trim())
      : [];

    const safeNickname = String(nickname || '').trim();
    if (!safeNickname || safeNickname.length > 80) {
      return res.status(400).json({ error: 'Nickname must be between 1 and 80 characters' });
    }

    // Check tier limits
    const user = (req as any).user;
    const pool = getPool();
    const { rows: existing } = await pool.query(
      'SELECT COUNT(*) as count FROM competitor_tracking WHERE user_id = $1',
      [userId]
    );

    const currentCount = parseInt(existing[0]?.count || '0', 10);
    const normalizedTier = uiTierFromCanonical(((user?.tier || 'observer') as CanonicalTier | LegacyTier));
    const maxCompetitors = Number(TIER_LIMITS[normalizedTier]?.competitors || 0);

    if (currentCount >= maxCompetitors) {
      return res.status(403).json({
        error: `Your ${user.tier} plan allows ${maxCompetitors} competitor${maxCompetitors !== 1 ? 's' : ''}. Upgrade to track more.`,
        code: 'COMPETITOR_LIMIT_REACHED'
      });
    }

    // Insert competitor - enable monitoring so the autopilot loop audits it immediately.
    // Resolve (or create) the user's default workspace so the autopilot loop can claim this row.
    const workspaceCtx = await ensureDefaultWorkspaceForUser(userId, userObj?.name || userObj?.email).catch(() => null);
    const workspaceId = workspaceCtx?.workspaceId || null;

    const { rows: created } = await pool.query(
      `INSERT INTO competitor_tracking
         (user_id, competitor_url, nickname, monitoring_enabled, next_monitor_at, canonical_domain, track_keywords, workspace_id)
       VALUES ($1, $2, $3, TRUE, NOW(), $4, $5, $6)
       ON CONFLICT (user_id, competitor_url)
       DO UPDATE SET
         nickname = $3,
         canonical_domain = $4,
         track_keywords = $5,
         workspace_id = COALESCE(competitor_tracking.workspace_id, $6),
         monitoring_enabled = TRUE,
         next_monitor_at = LEAST(competitor_tracking.next_monitor_at, NOW()),
         updated_at = NOW()
       RETURNING *`,
      [userId, normalized.url, safeNickname, canonicalDomain, JSON.stringify(safeKeywords), workspaceId]
    );

    // Auto-link existing audit if available
    const comp = created[0];
    console.log(
      `[competitors] Added competitor id=${comp.id} user_id=${userId} url=${normalized.url} monitoring_enabled=${String(comp.monitoring_enabled)} next_monitor_at=${String(comp.next_monitor_at || 'NOW()')}`,
    );
    if (!comp.latest_audit_id) {
      try {
        const { rows: auditMatch } = await pool.query(
          `SELECT id, (result->>'visibility_score')::int AS score FROM audits
           WHERE lower(regexp_replace(regexp_replace(url, '^https?://(www\\.)?', ''), '/+$', ''))
               = lower(regexp_replace(regexp_replace($1, '^https?://(www\\.)?', ''), '/+$', ''))
           ORDER BY created_at DESC LIMIT 1`,
          [normalized.url]
        );
        if (auditMatch.length > 0) {
          await pool.query(
            `UPDATE competitor_tracking SET latest_audit_id = $1, latest_score = $2, updated_at = NOW() WHERE id = $3`,
            [auditMatch[0].id, auditMatch[0].score ?? null, comp.id]
          );
          comp.latest_audit_id = auditMatch[0].id;
          comp.latest_score = auditMatch[0].score ?? null;
        }
      } catch { /* non-fatal */ }
    }

    // Check competitor milestones in background
    checkCompetitorMilestones(userId).catch((e: any) => console.warn('[Competitors] Milestone check failed:', e?.message));

    // Fire background screenshot (urlscan.io — non-blocking, ~30-90s)
    if (isUrlscanAvailable()) {
      screenshotCompetitorBackground(comp.id, normalized.url).catch(() => { });
    }

    return res.status(201).json({ success: true, competitor: comp });
  } catch (err: any) {
    console.error('[Competitors] Create error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This competitor URL is already being tracked' });
    }
    return res.status(500).json({ error: 'Failed to add competitor' });
  }
}

// DELETE /api/competitors/:id - Remove a competitor
export async function deleteCompetitor(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const competitorId = req.params.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    const { rowCount } = await pool.query(
      'DELETE FROM competitor_tracking WHERE id = $1 AND user_id = $2',
      [competitorId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Competitors] Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete competitor' });
  }
}

// GET /api/competitors/comparison?url=<your_url> - Get detailed comparison
export async function getCompetitorComparison(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const yourUrl = req.query.url as string;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!yourUrl) return res.status(400).json({ error: 'URL parameter required' });

    const normalized = normalizePublicHttpUrl(yourUrl);
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error, code: 'INVALID_URL' });
    }

    const pool = getPool();

    // Get your latest audit
    const { rows: yourAudits } = await pool.query(
      `SELECT * FROM audits
       WHERE user_id = $1
         AND (
           url = $2
           OR lower(regexp_replace(url, '/+$', '')) = lower(regexp_replace($2, '/+$', ''))
           OR lower(url) = lower($2)
         )
       ORDER BY
         CASE WHEN url = $2 THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 1`,
      [userId, normalized.url]
    );

    if (!yourAudits.length) {
      return res.status(404).json({
        error: 'No audit found for this URL. Run an audit first.',
        code: 'NO_AUDIT_FOUND'
      });
    }

    const yourAnalysis = yourAudits[0].result as AnalysisResponse;

    // Get all competitors with fallback audit lookup via URL normalization
    const { rows: competitors } = await pool.query(
      `SELECT
        ct.id, ct.competitor_url, ct.nickname, ct.latest_score,
        COALESCE(a.result, fb.result) as analysis
       FROM competitor_tracking ct
       LEFT JOIN audits a ON ct.latest_audit_id = a.id
       LEFT JOIN LATERAL (
         SELECT result FROM audits
         WHERE lower(regexp_replace(regexp_replace(url, '^https?://(www\\.)?', ''), '/+$', ''))
             = lower(regexp_replace(regexp_replace(ct.competitor_url, '^https?://(www\\.)?', ''), '/+$', ''))
         ORDER BY created_at DESC LIMIT 1
       ) fb ON ct.latest_audit_id IS NULL OR a.result IS NULL
       WHERE ct.user_id = $1`,
      [userId]
    );

    const competitorData: any[] = competitors.map((comp: any) => ({
      url: comp.competitor_url,
      nickname: comp.nickname,
      score: comp.latest_score || 0,
      analysis: comp.analysis as AnalysisResponse | null,
      gap: (comp.latest_score || 0) - (yourAnalysis.visibility_score || 0),
    }));

    // Build category comparison
    const yourCategories = yourAnalysis.category_grades || [];
    const categoryComparison = yourCategories.map((yourCat) => {
      const competitorScores: Record<string, number> = {};

      competitors.forEach((comp: any) => {
        if (comp.analysis?.category_grades) {
          const compCat = comp.analysis.category_grades.find(
            (c: any) => c.label === yourCat.label
          );
          competitorScores[comp.nickname] = compCat?.score || 0;
        }
      });

      return {
        category: yourCat.label,
        your_score: yourCat.score,
        competitor_scores: competitorScores,
      };
    });

    // Find opportunities (things competitors do that you don't)
    const opportunities: Array<{ title: string; description: string; impact: string; competitor_doing_it: string[] }> = [];
    const yourAdv: Array<{ title: string; description: string; lead_amount: string }> = [];

    // ── Helper: upsert an opportunity entry ────────────────────────────────
    function pushOpportunity(title: string, description: string, impact: string, nickname: string) {
      const existing = opportunities.find(o => o.title === title);
      if (existing) {
        if (!existing.competitor_doing_it.includes(nickname)) existing.competitor_doing_it.push(nickname);
      } else {
        opportunities.push({ title, description, impact, competitor_doing_it: [nickname] });
      }
    }

    const yourSchemaTypes = new Set(
      (yourAnalysis.schema_markup?.schema_types || []).map((s: string) => s.toLowerCase()),
    );
    const yourWordCount = yourAnalysis.content_analysis?.word_count || 0;
    const yourH2Count = yourAnalysis.content_analysis?.headings?.h2 || 0;
    const yourFaqCount = yourAnalysis.content_analysis?.faq_count || 0;
    const yourJsonLdCount = yourAnalysis.schema_markup?.json_ld_count || 0;
    const yourHasCanonical = yourAnalysis.technical_signals?.has_canonical ?? false;
    const yourHasViewport = yourAnalysis.technical_signals?.has_viewport_meta ?? false;
    const yourHasMetaDesc = yourAnalysis.content_analysis?.has_meta_description ?? false;

    competitors.forEach((comp: any) => {
      const ca = comp.analysis as AnalysisResponse | null;
      if (!ca) return;
      const nick = comp.nickname;

      // ── Schema-type opportunities (loop ALL types, not just 2) ──────────
      const compSchemaTypes = (ca.schema_markup?.schema_types || []).map((s: string) => s.toLowerCase());
      for (const st of compSchemaTypes) {
        if (!yourSchemaTypes.has(st)) {
          const label = st.replace(/([a-z])([A-Z])/g, '$1 $2'); // camelCase → spaced
          pushOpportunity(
            `Add ${label} Schema`,
            `Competitor uses ${label} structured data - helps AI platforms parse your content`,
            '+3-8 points estimated',
            nick,
          );
        }
      }

      // ── JSON-LD count gap ────────────────────────────────────────────────
      const compJsonLd = ca.schema_markup?.json_ld_count || 0;
      if (compJsonLd > yourJsonLdCount && compJsonLd - yourJsonLdCount >= 2) {
        pushOpportunity(
          'Increase JSON-LD Coverage',
          `Competitor has ${compJsonLd} JSON-LD blocks vs your ${yourJsonLdCount}`,
          '+4-10 points estimated',
          nick,
        );
      }

      // ── Content depth gap ────────────────────────────────────────────────
      const compWordCount = ca.content_analysis?.word_count || 0;
      if (compWordCount > yourWordCount * 1.5 && compWordCount - yourWordCount > 300) {
        pushOpportunity(
          'Increase Content Depth',
          `Competitor has ~${compWordCount.toLocaleString()} words vs your ~${yourWordCount.toLocaleString()}`,
          '+5-12 points estimated',
          nick,
        );
      }

      // ── Heading structure gap ────────────────────────────────────────────
      const compH2 = ca.content_analysis?.headings?.h2 || 0;
      if (compH2 > yourH2Count && compH2 - yourH2Count >= 3) {
        pushOpportunity(
          'Improve Heading Structure',
          `Competitor uses ${compH2} H2 sections vs your ${yourH2Count} - helps AI extract key topics`,
          '+3-6 points estimated',
          nick,
        );
      }

      // ── FAQ content gap ──────────────────────────────────────────────────
      const compFaq = ca.content_analysis?.faq_count || 0;
      if (compFaq > yourFaqCount && yourFaqCount < 3) {
        pushOpportunity(
          'Add FAQ Content Blocks',
          `Competitor has ${compFaq} FAQ entries - FAQ content improves direct-answer eligibility`,
          '+4-8 points estimated',
          nick,
        );
      }

      // ── Meta description gap ─────────────────────────────────────────────
      if (ca.content_analysis?.has_meta_description && !yourHasMetaDesc) {
        pushOpportunity(
          'Add Meta Description',
          'Competitor has a meta description - crucial for AI snippet selection',
          '+2-5 points estimated',
          nick,
        );
      }

      // ── Technical: canonical tag ─────────────────────────────────────────
      if (ca.technical_signals?.has_canonical && !yourHasCanonical) {
        pushOpportunity(
          'Add Canonical Tag',
          'Competitor uses canonical URLs - prevents duplicate content confusion for AI crawlers',
          '+2-4 points estimated',
          nick,
        );
      }

      // ── Technical: viewport / mobile-friendly ────────────────────────────
      if (ca.technical_signals?.has_viewport_meta && !yourHasViewport) {
        pushOpportunity(
          'Add Viewport Meta Tag',
          'Competitor is mobile-optimized - mobile-friendliness signals improve AI trust',
          '+1-3 points estimated',
          nick,
        );
      }

      // ── Response time advantage ──────────────────────────────────────────
      const compRT = ca.technical_signals?.response_time_ms || 0;
      const yourRT = yourAnalysis.technical_signals?.response_time_ms || 0;
      if (yourRT > 0 && compRT > 0 && yourRT > compRT * 2 && yourRT - compRT > 500) {
        pushOpportunity(
          'Improve Page Speed',
          `Competitor loads in ~${compRT}ms vs your ~${yourRT}ms - faster sites rank higher in AI responses`,
          '+2-5 points estimated',
          nick,
        );
      }
    });

    // Sort opportunities by number of competitors doing it (broadest signal first)
    opportunities.sort((a, b) => b.competitor_doing_it.length - a.competitor_doing_it.length);

    // ── Find your advantages ──────────────────────────────────────────────
    const auditedCompetitors = competitors.filter((c: any) => c.analysis);

    yourCategories.forEach((yourCat) => {
      if (auditedCompetitors.length === 0) return;
      let allCompetitorsBehind = true;
      let totalLead = 0;

      auditedCompetitors.forEach((comp: any) => {
        const compCat = comp.analysis?.category_grades?.find(
          (c: any) => c.label === yourCat.label
        );
        const compScore = compCat?.score || 0;
        if (compScore >= yourCat.score) {
          allCompetitorsBehind = false;
        } else {
          totalLead += yourCat.score - compScore;
        }
      });

      if (allCompetitorsBehind) {
        const avgLead = Math.round(totalLead / auditedCompetitors.length);
        if (avgLead > 0) {
          yourAdv.push({
            title: `Lead in ${yourCat.label}`,
            description: yourCat.summary,
            lead_amount: `+${avgLead} points ahead on average`,
          });
        }
      }
    });

    // Sort advantages by lead amount (biggest leads first)
    yourAdv.sort((a, b) => {
      const numA = parseInt(a.lead_amount.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.lead_amount.replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });

    const comparison: CompetitorComparison = {
      your_url: normalized.url,
      your_score: yourAnalysis.visibility_score,
      your_analysis: yourAnalysis,
      competitors: competitorData,
      category_comparison: categoryComparison,
      opportunities: opportunities.slice(0, 10),
      your_advantages: yourAdv.slice(0, 8),
    };

    return res.json({ success: true, comparison });
  } catch (err: any) {
    console.error('[Competitors] Comparison error:', err);
    return res.status(500).json({ error: 'Failed to generate comparison' });
  }
}

// PATCH /api/competitors/:id - Update monitoring settings (enable/disable + frequency)
export async function updateCompetitorMonitoring(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const competitorId = req.params.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { monitoring_enabled, monitor_frequency } = req.body;

    if (typeof monitoring_enabled !== 'boolean') {
      return res.status(400).json({ error: 'monitoring_enabled (boolean) is required' });
    }

    const allowedFreqs = ['daily', 'weekly', 'biweekly', 'monthly'];
    const freq = allowedFreqs.includes(String(monitor_frequency || '')) ? String(monitor_frequency) : null;

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE competitor_tracking
       SET monitoring_enabled = $1,
           monitor_frequency = COALESCE($2, monitor_frequency),
           next_monitor_at = CASE WHEN $1 = TRUE THEN NOW() ELSE next_monitor_at END,
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [monitoring_enabled, freq, competitorId, userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    return res.json({ success: true, competitor: rows[0] });
  } catch (err: any) {
    console.error('[Competitors] Update monitoring error:', err);
    return res.status(500).json({ error: 'Failed to update competitor monitoring' });
  }
}

// PATCH /api/competitors/:id/scan - Trigger a new scan for a competitor
// The actual heavy lifting is done client-side by calling POST /api/analyze
// which auto-links back via the UPDATE competitor_tracking query in server.ts.
// This endpoint just returns the competitor URL so the client knows what to scan.
export async function scanCompetitor(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const competitorId = req.params.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Tool credit gate
    const user = (req as any).user;
    const gate = await gateToolAction(userId, 'competitor_scan', user.tier || 'observer');
    if (!gate.allowed) {
      return res.status(402).json({
        error: gate.reason,
        code: 'CREDITS_REQUIRED',
        creditCost: gate.creditCost,
        creditsRemaining: gate.creditsRemaining,
      });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM competitor_tracking WHERE id = $1 AND user_id = $2',
      [competitorId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    const competitor = rows[0];

    return res.json({
      success: true,
      message: 'Ready to scan',
      competitor_url: competitor.competitor_url,
      nickname: competitor.nickname,
    });
  } catch (err: any) {
    console.error('[Competitors] Scan error:', err);
    return res.status(500).json({ error: 'Failed to initiate scan' });
  }
}

// ── Auto-discover competitors from audit history ──────────────────────────────

export interface CompetitorSuggestionResult {
  url: string;
  domain: string;
  score: number;
  shared_keywords: string[];
  overlap_ratio: number;
  already_tracked: boolean;
}

/**
 * Scans a user's audit history to find URLs that overlap with their own
 * website's topical keywords. Reusable from both the route handler and
 * the profile-save trigger.
 */
export async function discoverCompetitorsFromHistory(
  userId: string,
  userWebsite: string,
  workspaceId?: string | null,
): Promise<CompetitorSuggestionResult[]> {
  const pool = getPool();

  // Normalize user domain
  let userDomain = '';
  try {
    const candidate = /^https?:\/\//i.test(userWebsite) ? userWebsite : `https://${userWebsite}`;
    userDomain = new URL(candidate).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return []; }
  if (!userDomain) return [];

  // Get user's entity fingerprint to know their own brand name
  const entityFp = await getFingerprint(userId).catch(() => null);
  const userBrandName = entityFp?.brand_name?.toLowerCase() || '';

  // Get user's own latest audit keywords
  let userKeywords: string[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT result->'topical_keywords' AS keywords FROM audits
       WHERE user_id = $1 AND url ILIKE $2
         AND workspace_id IS NOT DISTINCT FROM $3
       ORDER BY created_at DESC LIMIT 1`,
      [userId, `%${userDomain}%`, workspaceId || null]
    );
    if (rows[0]?.keywords && Array.isArray(rows[0].keywords)) {
      userKeywords = rows[0].keywords.map((k: unknown) => String(k).toLowerCase());
    }
  } catch { /* non-fatal */ }

  if (userKeywords.length === 0) return [];

  // Get user's recent audits that are NOT their own domain (limit 50)
  const { rows: otherAudits } = await pool.query(
    `SELECT DISTINCT ON (lower(regexp_replace(url, '/+$', '')))
       url, visibility_score,
       result->'topical_keywords' AS keywords,
       result->'brand_entities' AS brands
     FROM audits
     WHERE user_id = $1
       AND url NOT ILIKE $2
       AND workspace_id IS NOT DISTINCT FROM $3
     ORDER BY lower(regexp_replace(url, '/+$', '')), created_at DESC
     LIMIT 50`,
    [userId, `%${userDomain}%`, workspaceId || null]
  );

  if (otherAudits.length === 0) return [];

  // Get already-tracked competitor URLs
  const { rows: tracked } = await pool.query(
    `SELECT competitor_url FROM competitor_tracking WHERE user_id = $1 AND workspace_id IS NOT DISTINCT FROM $2`,
    [userId, workspaceId || null]
  );
  const trackedDomains = new Set(
    tracked.map((r: any) => {
      try { return new URL(r.competitor_url).hostname.replace(/^www\./, '').toLowerCase(); }
      catch { return ''; }
    }).filter(Boolean)
  );

  const suggestions: CompetitorSuggestionResult[] = [];

  for (const audit of otherAudits) {
    let auditDomain = '';
    try { auditDomain = new URL(audit.url).hostname.replace(/^www\./, '').toLowerCase(); }
    catch { continue; }

    const keywords: string[] = Array.isArray(audit.keywords)
      ? audit.keywords.map((k: unknown) => String(k).toLowerCase())
      : [];
    const brands: string[] = Array.isArray(audit.brands)
      ? audit.brands.map((b: unknown) => String(b).toLowerCase())
      : [];

    const sharedKeywords = userKeywords.filter(k => keywords.includes(k));
    // Use word-boundary matching instead of substring includes(),
    // and exclude the user's own brand name from shared brand signals
    const validKeywords = keywords.filter(k => k && typeof k === 'string');
    const sharedBrands = brands.filter(b => {
      if (!b || typeof b !== 'string') return false;
      // Skip the user's own brand name — it's not a competitor signal
      if (userBrandName && (b === userBrandName || textMentionsBrand(b, userBrandName) || textMentionsBrand(userBrandName, b))) {
        return false;
      }
      // Use word-boundary matching to avoid false positives from substring collisions
      return validKeywords.some(kw => textMentionsBrand(kw, b));
    });
    const allShared = [...new Set([...sharedKeywords, ...sharedBrands])];

    const overlapRatio = userKeywords.length > 0 ? sharedKeywords.length / userKeywords.length : 0;
    const isPotentialCompetitor = allShared.length >= 2 || overlapRatio >= 0.2;

    if (isPotentialCompetitor) {
      suggestions.push({
        url: audit.url,
        domain: auditDomain,
        score: audit.visibility_score || 0,
        shared_keywords: allShared.slice(0, 8),
        overlap_ratio: Math.round(overlapRatio * 100) / 100,
        already_tracked: trackedDomains.has(auditDomain),
      });
    }
  }

  // Sort by overlap (best matches first), limit to 10
  return suggestions
    .sort((a, b) => b.overlap_ratio - a.overlap_ratio || b.shared_keywords.length - a.shared_keywords.length)
    .slice(0, 10);
}

// POST /api/competitors/auto-discover - Discover competitors from audit history
export async function autoDiscoverCompetitors(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = (req as any).user;
    const userWebsite = String(user?.website || '').trim();
    if (!userWebsite) {
      return res.status(400).json({
        error: 'Set your website URL in your profile first to enable auto-competitor discovery.',
        code: 'NO_WEBSITE',
      });
    }

    const suggestions = await discoverCompetitorsFromHistory(userId, userWebsite, req.workspace?.id ?? null);

    return res.json({
      success: true,
      suggestions,
      total: suggestions.length,
      new_suggestions: suggestions.filter(s => !s.already_tracked).length,
    });
  } catch (err: any) {
    console.error('[Competitors] Auto-discover error:', err);
    return res.status(500).json({ error: 'Failed to discover competitors' });
  }
}
