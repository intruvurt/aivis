/**
 * Free Tools API Routes
 *
 * Public endpoints (no auth required) for AI visibility tools.
 * Zero AI-model cost - all analysis is deterministic HTML/header parsing.
 *
 * POST /api/tools/schema-validator       - Structured data check for AI citation-readiness
 * POST /api/tools/robots-checker         - AI crawler access audit (GPTBot, ClaudeBot, etc.)
 * POST /api/tools/content-extractability  - Content structure grading for AI answer extraction
 */
import { Router, Request, Response } from 'express';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';

const router = Router();

// ── Shared helpers ──────────────────────────────────────────────

function validateToolUrl(raw: unknown): { valid: true; url: string; error?: undefined } | { valid: false; error: string; url?: undefined } {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { valid: false, error: 'URL is required' };
  }
  const normalized = normalizePublicHttpUrl(raw, { allowPrivate: false });
  if (!normalized.ok) return { valid: false, error: normalized.error };
  return { valid: true, url: normalized.url };
}

const FETCH_TIMEOUT = 10_000;

async function fetchPage(url: string): Promise<{ headers: Record<string, string>; html: string; status: number; responseTimeMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  const started = Date.now();
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'ai-visible-engine-bot/1.0 (Free Tool Check)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => { respHeaders[k.toLowerCase()] = v; });
    const html = (await resp.text()).slice(0, 500_000);
    return { headers: respHeaders, html, status: resp.status, responseTimeMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

// ─────────────────────────────────────────────────────────────────
// 1. Schema Markup Validator
// ─────────────────────────────────────────────────────────────────
router.post('/schema-validator', async (req: Request, res: Response) => {
  try {
    const check = validateToolUrl(req.body?.url);
    if (!check.valid) return res.status(400).json({ success: false, error: check.error });

    const { headers, html, status, responseTimeMs } = await fetchPage(check.url);

    // Parse JSON-LD blocks
    const jsonLdBlocks: any[] = [];
    const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = jsonLdRegex.exec(html)) !== null) {
      try { jsonLdBlocks.push(JSON.parse(m[1].trim())); } catch { /* malformed JSON-LD */ }
    }

    // Flatten @graph arrays
    const schemas: any[] = [];
    for (const block of jsonLdBlocks) {
      if (Array.isArray(block?.['@graph'])) {
        schemas.push(...block['@graph']);
      } else {
        schemas.push(block);
      }
    }

    const schemaTypes = schemas.map((s) => s?.['@type']).filter(Boolean).flat();

    // OpenGraph
    const ogTags: Record<string, string> = {};
    const ogRegex = /<meta\s+(?:property|name)\s*=\s*["'](og:[^"']+)["']\s+content\s*=\s*["']([^"']*)["']/gi;
    while ((m = ogRegex.exec(html)) !== null) ogTags[m[1]] = m[2];

    // Also catch reverse attribute order
    const ogRegex2 = /<meta\s+content\s*=\s*["']([^"']*)["']\s+(?:property|name)\s*=\s*["'](og:[^"']+)["']/gi;
    while ((m = ogRegex2.exec(html)) !== null) ogTags[m[2]] = m[1];

    // Twitter/X cards
    const twitterTags: Record<string, string> = {};
    const twRegex = /<meta\s+(?:property|name)\s*=\s*["'](twitter:[^"']+)["']\s+content\s*=\s*["']([^"']*)["']/gi;
    while ((m = twRegex.exec(html)) !== null) twitterTags[m[1]] = m[2];
    const twRegex2 = /<meta\s+content\s*=\s*["']([^"']*)["']\s+(?:property|name)\s*=\s*["'](twitter:[^"']+)["']/gi;
    while ((m = twRegex2.exec(html)) !== null) twitterTags[m[2]] = m[1];

    // Meta description
    const descMatch = html.match(/<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["']([^"']*)["']/i)
      || html.match(/<meta\s+content\s*=\s*["']([^"']*)["']\s+name\s*=\s*["']description["']/i);
    const metaDescription = descMatch?.[1] || '';

    // Canonical
    const canonicalMatch = html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']*)["']/i);
    const canonical = canonicalMatch?.[1] || '';

    // Detect key schema types for AI citation
    const hasFAQ = schemaTypes.some((t: string) => /faq/i.test(t));
    const hasArticle = schemaTypes.some((t: string) => /article|newsarticle|blogposting/i.test(t));
    const hasHowTo = schemaTypes.some((t: string) => /howto/i.test(t));
    const hasOrg = schemaTypes.some((t: string) => /organization/i.test(t));
    const hasPerson = schemaTypes.some((t: string) => /person/i.test(t));
    const hasProduct = schemaTypes.some((t: string) => /product/i.test(t));
    const hasBreadcrumb = schemaTypes.some((t: string) => /breadcrumb/i.test(t));
    const hasWebSite = schemaTypes.some((t: string) => /website/i.test(t));
    const hasWebPage = schemaTypes.some((t: string) => /webpage/i.test(t));

    // Scoring (0-100)
    let score = 0;
    if (jsonLdBlocks.length > 0) score += 20;
    if (Object.keys(ogTags).length >= 3) score += 15;
    else if (Object.keys(ogTags).length >= 1) score += 8;
    if (ogTags['og:title'] && ogTags['og:description']) score += 5;
    if (Object.keys(twitterTags).length >= 1) score += 5;
    if (metaDescription) score += 10;
    if (canonical) score += 5;
    if (hasArticle || hasWebPage) score += 10;
    if (hasFAQ || hasHowTo) score += 10;
    if (hasOrg || hasPerson) score += 5;
    if (hasProduct) score += 5;
    if (hasBreadcrumb) score += 5;
    if (hasWebSite) score += 5;
    score = Math.min(score, 100);

    const issues: string[] = [];
    const validationErrors: string[] = [];
    if (jsonLdBlocks.length === 0) issues.push('No JSON-LD structured data found - AI models cannot extract rich entities');
    if (!ogTags['og:title']) issues.push('Missing og:title - social and AI previews will lack a headline');
    if (!ogTags['og:description']) issues.push('Missing og:description - AI may generate inaccurate summaries');
    if (!ogTags['og:image']) issues.push('Missing og:image - no visual preview for shared content');
    if (!metaDescription) issues.push('No meta description - AI models use this as primary summary source');
    if (!canonical) issues.push('Missing canonical URL - can fragment cache identity across AI models');
    if (!hasFAQ && !hasHowTo) issues.push('No FAQ or HowTo schema - missing direct answer extraction signals');
    if (!hasArticle && !hasWebPage) issues.push('No Article/WebPage schema - authorship and date signals absent');
    if (!hasOrg && !hasPerson) issues.push('No Organization/Person schema - entity resolution signals missing');
    if (!hasBreadcrumb) issues.push('No BreadcrumbList schema - navigation context missing for AI');

    // Schema validation errors (things Google Search Console flags)
    for (const s of schemas) {
      const sType = Array.isArray(s?.['@type']) ? s['@type'].join(',') : String(s?.['@type'] || '');
      // Review: itemReviewed must have explicit @type
      if (/review/i.test(sType) && s.itemReviewed) {
        if (typeof s.itemReviewed === 'object' && !s.itemReviewed['@type']) {
          validationErrors.push('Review.itemReviewed missing @type - Google requires explicit type, not just @id reference');
        }
      }
      // Article: author should have @type or @id
      if (/article|blogposting/i.test(sType) && s.author) {
        if (typeof s.author === 'object' && !s.author['@type'] && !s.author['@id']) {
          validationErrors.push(`${sType}.author missing @type or @id`);
        }
      }
      // FAQPage: questions need acceptedAnswer
      if (/faqpage/i.test(sType) && s.mainEntity) {
        const questions = Array.isArray(s.mainEntity) ? s.mainEntity : [s.mainEntity];
        for (const q of questions) {
          if (!q.acceptedAnswer) {
            validationErrors.push('FAQPage Question missing acceptedAnswer');
            break;
          }
        }
      }
    }
    // Deduct for validation errors
    if (validationErrors.length > 0) {
      score = Math.max(0, score - validationErrors.length * 5);
    }

    return res.json({
      success: true,
      result: {
        url: check.url,
        status,
        responseTimeMs,
        score,
        grade: letterGrade(score),
        jsonLd: {
          count: jsonLdBlocks.length,
          types: schemaTypes,
          raw: jsonLdBlocks.slice(0, 5),
        },
        openGraph: ogTags,
        twitterCard: twitterTags,
        metaDescription,
        canonical,
        signals: { hasFAQ, hasArticle, hasHowTo, hasOrg, hasPerson, hasProduct, hasBreadcrumb, hasWebSite, hasWebPage },
        issues,
        validationErrors,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || 'Schema check failed');
    return res.status(502).json({ success: false, error: msg, code: msg.includes('abort') ? 'TIMEOUT' : 'SCHEMA_CHECK_FAILED' });
  }
});

// ─────────────────────────────────────────────────────────────────
// 2. Robots & AI Crawler Access Checker
// ─────────────────────────────────────────────────────────────────

/** Known AI/search crawlers with their purpose */
const AI_BOTS = [
  { name: 'GPTBot', key: 'gptbot', owner: 'OpenAI (ChatGPT training + browse)', critical: true },
  { name: 'ChatGPT-User', key: 'chatgpt-user', owner: 'OpenAI (ChatGPT live browse)', critical: true },
  { name: 'OAI-SearchBot', key: 'oai-searchbot', owner: 'OpenAI (SearchGPT)', critical: true },
  { name: 'ClaudeBot', key: 'claudebot', owner: 'Anthropic (Claude training)', critical: true },
  { name: 'Anthropic-AI', key: 'anthropic-ai', owner: 'Anthropic (general)', critical: true },
  { name: 'Google-Extended', key: 'google-extended', owner: 'Google (Gemini training)', critical: true },
  { name: 'Googlebot', key: 'googlebot', owner: 'Google (Search index)', critical: true },
  { name: 'Bingbot', key: 'bingbot', owner: 'Microsoft (Bing + Copilot)', critical: true },
  { name: 'PerplexityBot', key: 'perplexitybot', owner: 'Perplexity AI', critical: false },
  { name: 'CCBot', key: 'ccbot', owner: 'Common Crawl (open dataset)', critical: false },
  { name: 'Applebot', key: 'applebot', owner: 'Apple (Siri + Spotlight)', critical: false },
  { name: 'Bytespider', key: 'bytespider', owner: 'ByteDance (TikTok AI)', critical: false },
  { name: 'Cohere-AI', key: 'cohere-ai', owner: 'Cohere (enterprise AI)', critical: false },
  { name: 'Meta-ExternalAgent', key: 'meta-externalagent', owner: 'Meta (LLaMA training)', critical: false },
  { name: 'AmazonBot', key: 'amazonbot', owner: 'Amazon (Alexa + AI)', critical: false },
];

type BotDirective = { name: string; owner: string; status: 'allowed' | 'blocked' | 'not-specified'; critical: boolean };

function parseRobotsTxt(robotsTxt: string): { blocks: Map<string, string[]> } {
  const blocks = new Map<string, string[]>();
  let currentAgent = '';
  for (const raw of robotsTxt.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [directive, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (directive.toLowerCase() === 'user-agent') {
      currentAgent = value.toLowerCase();
      if (!blocks.has(currentAgent)) blocks.set(currentAgent, []);
    } else if (currentAgent) {
      blocks.get(currentAgent)!.push(line);
    }
  }
  return { blocks };
}

function getBotStatus(botKey: string, blocks: Map<string, string[]>): 'allowed' | 'blocked' | 'not-specified' {
  // Check bot-specific block
  const specific = blocks.get(botKey);
  if (specific) {
    const hasDisallowAll = specific.some((l) => /^disallow:\s*\/$/i.test(l));
    const hasAllowAll = specific.some((l) => /^allow:\s*\/$/i.test(l));
    if (hasDisallowAll && !hasAllowAll) return 'blocked';
    if (hasAllowAll) return 'allowed';
    if (hasDisallowAll) return 'blocked';
    return 'allowed'; // Has a section but nothing blocks root
  }

  // Fall back to wildcard
  const wildcard = blocks.get('*');
  if (wildcard) {
    const hasDisallowAll = wildcard.some((l) => /^disallow:\s*\/$/i.test(l));
    if (hasDisallowAll) return 'blocked';
    return 'allowed';
  }

  return 'not-specified';
}

router.post('/robots-checker', async (req: Request, res: Response) => {
  try {
    const check = validateToolUrl(req.body?.url);
    if (!check.valid) return res.status(400).json({ success: false, error: check.error });

    const parsedUrl = new URL(check.url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

    // Fetch robots.txt
    let robotsTxt = '';
    let robotsFound = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      try {
        const resp = await fetch(robotsUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'ai-visible-engine-bot/1.0 (Robots Check)' },
          signal: controller.signal,
        });
        if (resp.ok) {
          robotsTxt = await resp.text();
          robotsFound = true;
        }
      } finally {
        clearTimeout(timer);
      }
    } catch { /* robots.txt not accessible */ }

    // Parse robots.txt
    const { blocks } = parseRobotsTxt(robotsTxt);

    // Evaluate each bot
    const botResults: BotDirective[] = AI_BOTS.map((bot) => ({
      name: bot.name,
      owner: bot.owner,
      status: getBotStatus(bot.key, blocks),
      critical: bot.critical,
    }));

    // Also fetch the page for meta robots + X-Robots-Tag
    let metaRobots = '';
    let xRobotsTag = '';
    try {
      const { headers, html } = await fetchPage(check.url);
      xRobotsTag = headers['x-robots-tag'] || '';
      const metaMatch = html.match(/<meta\s+name\s*=\s*["']robots["']\s+content\s*=\s*["']([^"']*)["']/i)
        || html.match(/<meta\s+content\s*=\s*["']([^"']*)["']\s+name\s*=\s*["']robots["']/i);
      metaRobots = metaMatch?.[1] || '';
    } catch { /* page fetch failed, continue with robots.txt only */ }

    const metaNoindex = /noindex/i.test(metaRobots);
    const metaNofollow = /nofollow/i.test(metaRobots);
    const headerNoindex = /noindex/i.test(xRobotsTag);
    const headerNofollow = /nofollow/i.test(xRobotsTag);

    // Scoring
    const criticalBots = botResults.filter((b) => b.critical);
    const criticalAllowed = criticalBots.filter((b) => b.status === 'allowed').length;
    const criticalBlocked = criticalBots.filter((b) => b.status === 'blocked').length;
    const allBlocked = botResults.filter((b) => b.status === 'blocked').length;

    let score = 100;
    score -= criticalBlocked * 12;
    score -= (allBlocked - criticalBlocked) * 3;
    if (metaNoindex || headerNoindex) score -= 25;
    if (metaNofollow || headerNofollow) score -= 10;
    if (!robotsFound) score -= 5;
    score = Math.max(0, Math.min(100, score));

    const issues: string[] = [];
    if (!robotsFound) issues.push('No robots.txt found - crawlers may make aggressive assumptions');
    for (const bot of botResults) {
      if (bot.status === 'blocked' && bot.critical) {
        issues.push(`${bot.name} (${bot.owner}) is BLOCKED - this AI platform cannot access your content`);
      }
    }
    if (metaNoindex) issues.push('Meta robots contains "noindex" - search engines and AI will skip this page');
    if (headerNoindex) issues.push('X-Robots-Tag contains "noindex" - HTTP header blocks indexing');
    if (metaNofollow) issues.push('Meta robots contains "nofollow" - link signals are being suppressed');
    if (headerNofollow) issues.push('X-Robots-Tag contains "nofollow" - link following blocked via header');

    return res.json({
      success: true,
      result: {
        url: check.url,
        robotsUrl,
        robotsFound,
        robots: botResults,
        meta: { metaRobots, xRobotsTag, metaNoindex, metaNofollow, headerNoindex, headerNofollow },
        summary: {
          totalBots: botResults.length,
          allowed: botResults.filter((b) => b.status === 'allowed').length,
          blocked: allBlocked,
          notSpecified: botResults.filter((b) => b.status === 'not-specified').length,
          criticalAllowed,
          criticalBlocked,
        },
        score,
        grade: letterGrade(score),
        issues,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || 'Robots check failed');
    return res.status(502).json({ success: false, error: msg, code: msg.includes('abort') ? 'TIMEOUT' : 'ROBOTS_CHECK_FAILED' });
  }
});

// ─────────────────────────────────────────────────────────────────
// 3. Content Extractability Grader
// ─────────────────────────────────────────────────────────────────
router.post('/content-extractability', async (req: Request, res: Response) => {
  try {
    const check = validateToolUrl(req.body?.url);
    if (!check.valid) return res.status(400).json({ success: false, error: check.error });

    const { html, status, responseTimeMs } = await fetchPage(check.url);

    // Strip script/style for text analysis
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '');

    // Heading analysis
    const h1s = [...cleaned.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]*>/g, '').trim());
    const h2s = [...cleaned.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1].replace(/<[^>]*>/g, '').trim());
    const h3s = [...cleaned.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => m[1].replace(/<[^>]*>/g, '').trim());
    const h4s = [...cleaned.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)].map((m) => m[1].replace(/<[^>]*>/g, '').trim());

    // Content extraction
    const textContent = cleaned.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = textContent.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Paragraph analysis
    const paragraphs = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => m[1].replace(/<[^>]*>/g, '').trim())
      .filter((p) => p.length > 20);

    // List analysis
    const orderedLists = (cleaned.match(/<ol[^>]*>/gi) || []).length;
    const unorderedLists = (cleaned.match(/<ul[^>]*>/gi) || []).length;
    const totalLists = orderedLists + unorderedLists;

    // Table analysis
    const tables = (cleaned.match(/<table[^>]*>/gi) || []).length;

    // Definition list / FAQ pattern detection
    const dlBlocks = (cleaned.match(/<dl[^>]*>/gi) || []).length;
    const detailsBlocks = (cleaned.match(/<details[^>]*>/gi) || []).length;

    // FAQ-like patterns (Q&A in headings or strong tags)
    const faqPatterns = [...cleaned.matchAll(/(?:<h[2-4][^>]*>|<strong>|<b>)\s*(?:Q[:.]?|FAQ|(?:How|What|Why|When|Where|Which|Can|Is|Do|Does|Should|Will)\b)[^<]*(?:<\/h[2-4]>|<\/strong>|<\/b>)/gi)].length;

    // Readability: average sentence length
    const sentences = textContent.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const avgSentenceWords = sentences.length > 0
      ? Math.round(sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length)
      : 0;

    // Answer block density: paragraphs between 40-150 words (ideal "answer" size)
    const answerBlocks = paragraphs.filter((p) => {
      const w = p.split(/\s+/).length;
      return w >= 25 && w <= 200;
    }).length;

    // Heading hierarchy quality
    let hierarchyScore = 0;
    if (h1s.length === 1) hierarchyScore += 25; // Exactly one H1
    else if (h1s.length > 0) hierarchyScore += 10; // At least one H1
    if (h2s.length >= 2) hierarchyScore += 25; // Multiple H2 sections
    else if (h2s.length === 1) hierarchyScore += 15;
    if (h3s.length >= 1) hierarchyScore += 15; // Has depth
    if (h2s.length > 0 && h1s.length > 0) hierarchyScore += 10; // Proper nesting exists

    // Content depth scoring
    let contentScore = 0;
    if (wordCount >= 800) contentScore += 20;
    else if (wordCount >= 400) contentScore += 12;
    else if (wordCount >= 200) contentScore += 6;
    if (paragraphs.length >= 5) contentScore += 10;
    else if (paragraphs.length >= 3) contentScore += 5;
    if (totalLists >= 2) contentScore += 10;
    else if (totalLists >= 1) contentScore += 5;
    if (tables >= 1) contentScore += 5;
    if (answerBlocks >= 3) contentScore += 10;
    else if (answerBlocks >= 1) contentScore += 5;
    if (faqPatterns >= 2) contentScore += 10;
    else if (faqPatterns >= 1) contentScore += 5;
    if (avgSentenceWords > 0 && avgSentenceWords <= 25) contentScore += 10; // Concise sentences
    if (dlBlocks + detailsBlocks >= 1) contentScore += 5;

    const totalScore = Math.min(100, hierarchyScore + contentScore);

    const issues: string[] = [];
    if (h1s.length === 0) issues.push('No H1 heading - AI models rely on this as the primary topic signal');
    if (h1s.length > 1) issues.push(`Multiple H1 headings (${h1s.length}) - dilutes primary topic signal for AI models`);
    if (h2s.length === 0) issues.push('No H2 headings - page lacks section structure for AI extraction');
    if (wordCount < 300) issues.push(`Low word count (${wordCount}) - insufficient content depth for AI answer extraction`);
    if (paragraphs.length < 3) issues.push('Few substantive paragraphs - AI needs clear text blocks to extract answers');
    if (totalLists === 0) issues.push('No lists found - structured lists improve AI extraction accuracy');
    if (answerBlocks === 0) issues.push('No answer-sized content blocks - AI prefers 25-200 word self-contained passages');
    if (faqPatterns === 0) issues.push('No FAQ/question patterns detected - missing direct answer extraction opportunities');
    if (avgSentenceWords > 30) issues.push(`Long average sentence length (${avgSentenceWords} words) - shorter sentences improve AI comprehension`);

    return res.json({
      success: true,
      result: {
        url: check.url,
        status,
        responseTimeMs,
        score: totalScore,
        grade: letterGrade(totalScore),
        headings: {
          h1: h1s,
          h2: h2s,
          h3: h3s,
          h4: h4s,
          hierarchyScore,
        },
        content: {
          wordCount,
          paragraphCount: paragraphs.length,
          answerBlocks,
          avgSentenceWords,
          orderedLists,
          unorderedLists,
          tables,
          faqPatterns,
          definitionLists: dlBlocks,
          detailsElements: detailsBlocks,
          contentScore,
        },
        issues,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || 'Content check failed');
    return res.status(502).json({ success: false, error: msg, code: msg.includes('abort') ? 'TIMEOUT' : 'CONTENT_CHECK_FAILED' });
  }
});

// ─────────────────────────────────────────────────────────────────
// 4. DNS Lookup (DNS-over-HTTPS via Cloudflare 1.1.1.1)
// ─────────────────────────────────────────────────────────────────

const VALID_DOMAIN = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
const VALID_DNS_TYPES = new Set(['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'CAA', 'PTR', 'SRV']);

/**
 * GET /api/tools/dns?name=domain.com&type=A
 *
 * Proxies DNS-over-HTTPS queries to Cloudflare 1.1.1.1.
 * Validates the domain name and type to prevent SSRF or enumeration abuses.
 */
router.get('/dns', async (req: Request, res: Response) => {
  const name = String(req.query.name || '').trim().toLowerCase();
  const type = String(req.query.type || 'A').toUpperCase();

  if (!name) return res.status(400).json({ success: false, error: 'name is required' });
  if (!VALID_DOMAIN.test(name)) return res.status(400).json({ success: false, error: 'Invalid domain name' });
  if (!VALID_DNS_TYPES.has(type)) {
    return res.status(400).json({ success: false, error: `Unsupported record type. Use: ${[...VALID_DNS_TYPES].join(', ')}` });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const upstream = await fetch(
        `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
        { headers: { Accept: 'application/dns-json' }, signal: controller.signal },
      );
      if (!upstream.ok) {
        return res.status(upstream.status).json({ success: false, error: `Upstream DNS error: ${upstream.status}` });
      }
      const data = await upstream.json();
      return res.json({ success: true, data });
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    const msg = String(err?.message || 'DNS lookup failed');
    return res.status(502).json({ success: false, error: msg, code: msg.includes('abort') ? 'TIMEOUT' : 'DNS_LOOKUP_FAILED' });
  }
});

export default router;
