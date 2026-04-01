import * as cheerio from 'cheerio';
import type {
  AuditEvidence,
  AuditFinding,
  AuditFix,
  AuditModuleResult,
  AuditScoreBreakdown,
} from '../../../../shared/types/audit.js';

export interface ContentAnalysisInput {
  html: string;
  finalUrl?: string;
}

export type ContentAnalysisResult = AuditModuleResult;

export async function analyzeContent(input: ContentAnalysisInput): Promise<ContentAnalysisResult> {
  const html = String(input.html || '');
  const finalUrl = input.finalUrl || '';
  const $ = cheerio.load(html);

  const findings: AuditFinding[] = [];
  const evidence: AuditEvidence[] = [];
  const fixes: AuditFix[] = [];
  const constraints: string[] = [];

  const addEvidence = (
    type: AuditEvidence['type'],
    label: string,
    observedValue: string,
    options: Partial<AuditEvidence> = {},
  ): string => {
    const id = `ev_content_${evidence.length + 1}`;
    evidence.push({
      id,
      type,
      label,
      pageUrl: finalUrl,
      observedValue: truncate(observedValue, 500),
      captureTimeUtc: new Date().toISOString(),
      source: 'raw_html',
      confidence: 0.88,
      ...options,
    });
    return id;
  };

  const addFix = (fix: Omit<AuditFix, 'id'>) => {
    fixes.push({ id: `fix_content_${fixes.length + 1}`, ...fix });
  };

  const title = $('title').first().text().trim();
  const metaDescription = getMetaContent($, ['description']);
  const robots = getMetaContent($, ['robots']);
  const ogTitle = getMetaContent($, ['og:title']);
  const ogDescription = getMetaContent($, ['og:description']);
  const twitterCard = getMetaContent($, ['twitter:card']);
  const canonicalRaw = $('link[rel="canonical"]').first().attr('href')?.trim() || '';
  const canonical = resolveUrl(canonicalRaw, finalUrl);
  const bodyScope = getContentScope($);
  const mainText = extractReadableText(bodyScope);
  const wordCount = countWords(mainText);
  const paragraphCount = bodyScope
    .find('p')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean).length;

  const headingCounts = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
    h4: $('h4').length,
    h5: $('h5').length,
    h6: $('h6').length,
  };
  const h1s = $('h1')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const internalLinkCount = countInternalLinks($, finalUrl);
  const imageStats = getImageStats($);
  const faqSignals = detectFaqSignals($);
  const answerBlocks = detectAnswerBlocks($);
  const schemaInfo = extractSchemaInfo($);
  const freshness = getFreshnessSignals($);
  const appShellRisk = detectAppShellRisk($, wordCount);

  if (!html.trim()) constraints.push('empty_html');
  if (appShellRisk) constraints.push('possible_app_shell_or_client_rendered_page');
  if (wordCount < 120) constraints.push('low_readable_text_density');

  const titleEv = addEvidence('meta', 'Page title', title || '(missing)', { locator: 'title' });
  const metaEv = addEvidence('meta', 'Meta description', metaDescription || '(missing)', {
    locator: 'meta[name="description"]',
  });
  const canonicalEv = addEvidence('meta', 'Canonical URL', canonical || '(missing)', {
    locator: 'link[rel="canonical"]',
    expectedValue: finalUrl || undefined,
  });
  const robotsEv = addEvidence('robots', 'Robots directive', robots || '(missing)', {
    locator: 'meta[name="robots"]',
  });
  const headingEv = addEvidence('heading', 'Heading structure', JSON.stringify(headingCounts));
  const wordCountEv = addEvidence('body_excerpt', 'Readable word count', String(wordCount), {
    snippet: truncate(mainText, 280),
  });
  const schemaEv = addEvidence(
    'schema',
    'Detected schema types',
    schemaInfo.types.length ? schemaInfo.types.join(', ') : '(none)',
    { source: 'json_ld' },
  );
  const faqEv = addEvidence('dom', 'FAQ signal count', String(faqSignals.count));
  const answerEv = addEvidence('dom', 'Answer block count', String(answerBlocks.count));
  const socialEv = addEvidence(
    'social',
    'Social metadata presence',
    JSON.stringify({ ogTitle: !!ogTitle, ogDescription: !!ogDescription, twitterCard: !!twitterCard }),
  );
  const internalLinksEv = addEvidence('link', 'Internal link count', String(internalLinkCount));
  const mediaEv = addEvidence('media', 'Image alt coverage', JSON.stringify(imageStats));
  const freshnessEv = addEvidence('meta', 'Freshness signals', JSON.stringify(freshness));

  if (!title) {
    findings.push({
      id: 'finding_missing_title',
      category: 'Structural Clarity',
      title: 'Missing page title',
      description: 'The page has no usable <title>, which weakens summarization and entity interpretation.',
      severity: 'critical',
      pageUrl: finalUrl,
      impact: 'AI systems lose a primary page-definition signal.',
      evidenceIds: [titleEv],
    });
    addFix({
      title: 'Add a unique title element',
      priority: 'p1',
      implementationSurface: 'head',
      findingIds: ['finding_missing_title'],
      evidenceIds: [titleEv],
      instructions: [
        'Add a single <title> tag in the document head.',
        'Use the real page entity + intent rather than a generic brand-only title.',
        'Keep the title concise enough to remain fully interpretable in search and answer-engine snippets.',
      ],
      expectedOutcome: 'The page gains a stable primary topic signal for indexing, summarization, and citation selection.',
    });
  } else if (title.length < 20 || title.length > 70) {
    findings.push({
      id: 'finding_title_length',
      category: 'Structural Clarity',
      title: 'Weak title length',
      description: 'The page title exists but is too short or too long for crisp interpretation.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Reduced clarity for page topic extraction.',
      evidenceIds: [titleEv],
    });
    addFix({
      title: 'Tighten the title to a cleaner interpretability range',
      priority: 'p2',
      implementationSurface: 'head',
      findingIds: ['finding_title_length'],
      evidenceIds: [titleEv],
      instructions: [
        'Rewrite the title to include the primary entity and page intent.',
        'Avoid stuffing multiple clauses, separators, or ambiguous slogans into the title.',
      ],
      expectedOutcome: 'Sharper topic extraction and a cleaner page definition signal.',
    });
  }

  if (!metaDescription) {
    findings.push({
      id: 'finding_missing_meta_description',
      category: 'Interpretability',
      title: 'Missing meta description',
      description: 'There is no meta description summarizing the page for machines and users.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Lower summary clarity and weaker topical framing.',
      evidenceIds: [metaEv],
    });
    addFix({
      title: 'Add a real meta description',
      priority: 'p2',
      implementationSurface: 'head',
      findingIds: ['finding_missing_meta_description'],
      evidenceIds: [metaEv],
      instructions: [
        'Write a description that states what the page is, who it serves, and what it helps the visitor do.',
        'Keep it aligned to the visible page copy rather than marketing filler.',
      ],
      expectedOutcome: 'Improved machine framing and stronger snippet quality.',
    });
  }

  if (headingCounts.h1 === 0) {
    findings.push({
      id: 'finding_missing_h1',
      category: 'Structural Clarity',
      title: 'Missing H1 heading',
      description: 'The page does not expose a top-level heading that clearly states the page intent.',
      severity: 'high',
      pageUrl: finalUrl,
      impact: 'AI systems may infer topic from weaker signals.',
      evidenceIds: [headingEv],
    });
    addFix({
      title: 'Add one primary H1',
      priority: 'p1',
      implementationSurface: 'body',
      findingIds: ['finding_missing_h1'],
      evidenceIds: [headingEv],
      instructions: [
        'Add a single visible H1 near the top of the primary content area.',
        'Make it explicit about the page topic, service, or answer intent.',
      ],
      expectedOutcome: 'The page gains a stable primary semantic anchor for chunking and answer extraction.',
    });
  } else if (headingCounts.h1 > 1) {
    findings.push({
      id: 'finding_multiple_h1',
      category: 'Structural Clarity',
      title: 'Multiple H1 headings',
      description: 'The page uses more than one H1, which muddies the primary page definition.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Conflicting topical anchors for extraction.',
      evidenceIds: [headingEv],
    });
    addFix({
      title: 'Reduce the page to one H1',
      priority: 'p2',
      implementationSurface: 'body',
      findingIds: ['finding_multiple_h1'],
      evidenceIds: [headingEv],
      instructions: [
        'Keep only one H1 for the primary page intent.',
        'Convert secondary H1s into H2 or H3 elements under the main heading.',
      ],
      expectedOutcome: 'Cleaner semantic hierarchy and lower ambiguity for retrieval systems.',
    });
  }

  if (!canonical) {
    findings.push({
      id: 'finding_missing_canonical',
      category: 'Extractability',
      title: 'Missing canonical URL',
      description: 'The page does not declare a canonical URL.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Higher duplication ambiguity and weaker URL certainty.',
      evidenceIds: [canonicalEv],
    });
    addFix({
      title: 'Add a self-referencing canonical URL',
      priority: 'p2',
      implementationSurface: 'head',
      findingIds: ['finding_missing_canonical'],
      evidenceIds: [canonicalEv],
      instructions: [
        'Add <link rel="canonical"> pointing to the resolved final page URL.',
        'Ensure the canonical URL matches the preferred public version of the page.',
      ],
      expectedOutcome: 'Lower URL ambiguity and stronger canonical source selection.',
    });
  } else if (finalUrl && normalizeComparableUrl(canonical) !== normalizeComparableUrl(finalUrl)) {
    findings.push({
      id: 'finding_canonical_mismatch',
      category: 'Extractability',
      title: 'Canonical does not match the resolved page URL',
      description: 'The declared canonical points somewhere other than the resolved page URL.',
      severity: 'high',
      pageUrl: finalUrl,
      impact: 'Search and answer engines may collapse this page into another URL unexpectedly.',
      evidenceIds: [canonicalEv],
    });
  }

  if (robots.toLowerCase().includes('noindex')) {
    findings.push({
      id: 'finding_noindex',
      category: 'Extractability',
      title: 'Page marked noindex',
      description: 'The page includes a noindex robots directive.',
      severity: 'critical',
      pageUrl: finalUrl,
      impact: 'The page may be withheld from indexing and downstream answer surfaces.',
      evidenceIds: [robotsEv],
    });
    addFix({
      title: 'Remove noindex from public pages meant to rank or be cited',
      priority: 'p1',
      implementationSurface: 'head',
      findingIds: ['finding_noindex'],
      evidenceIds: [robotsEv],
      instructions: [
        'Remove noindex from the page-level robots directive if the page is intended for public discovery.',
        'Keep noindex only on private or utility pages that should stay out of search results.',
      ],
      expectedOutcome: 'The page becomes eligible for indexing and downstream answer-engine retrieval.',
    });
  }

  if (wordCount < 250) {
    findings.push({
      id: 'finding_thin_content',
      category: 'Evidence Availability',
      title: 'Thin content footprint',
      description: 'The page contains too little readable text to strongly support extraction or citation.',
      severity: 'high',
      pageUrl: finalUrl,
      impact: 'Low evidence density and weak answer support.',
      evidenceIds: [wordCountEv],
    });
  } else if (wordCount < 600) {
    findings.push({
      id: 'finding_light_content',
      category: 'Evidence Availability',
      title: 'Light content depth',
      description: 'The page has some readable content but may lack enough detail for strong answer extraction.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Lower citation readiness for nuanced queries.',
      evidenceIds: [wordCountEv],
    });
  }

  if (headingCounts.h2 === 0 && wordCount > 400) {
    findings.push({
      id: 'finding_flat_structure',
      category: 'Structural Clarity',
      title: 'Flat heading structure',
      description: 'The page has substantial copy but lacks section-level headings.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Answer chunking and semantic segmentation become harder.',
      evidenceIds: [headingEv, wordCountEv],
    });
  }

  if (!schemaInfo.types.length) {
    findings.push({
      id: 'finding_missing_schema',
      category: 'Extractability',
      title: 'No structured data detected',
      description: 'No JSON-LD structured data types were detected on the page.',
      severity: 'high',
      pageUrl: finalUrl,
      impact: 'Lower machine-readable context and weaker entity extraction.',
      evidenceIds: [schemaEv],
    });
  }

  if (faqSignals.count === 0 && answerBlocks.count < 2 && wordCount > 500) {
    findings.push({
      id: 'finding_missing_answer_blocks',
      category: 'Answer Coverage',
      title: 'Weak answer-block formatting',
      description: 'The page lacks obvious FAQ or answer-first sections despite having enough content to support them.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Lower chance of clean answer extraction for conversational prompts.',
      evidenceIds: [faqEv, answerEv, wordCountEv],
    });
  }

  if (!ogTitle || !ogDescription || !twitterCard) {
    findings.push({
      id: 'finding_weak_social_metadata',
      category: 'Interpretability',
      title: 'Weak social metadata coverage',
      description: 'The page is missing one or more common social metadata signals used for summary previews and content framing.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Lower consistency across preview surfaces and weaker machine-visible metadata reinforcement.',
      evidenceIds: [socialEv],
    });
  }

  if (internalLinkCount < 2 && wordCount > 350) {
    findings.push({
      id: 'finding_sparse_internal_links',
      category: 'Extractability',
      title: 'Sparse internal linking',
      description: 'The page has little internal linking relative to its content footprint.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Weaker crawl path reinforcement and poorer contextual graphing.',
      evidenceIds: [internalLinksEv],
    });
  }

  if (imageStats.total > 0 && imageStats.missingAlt > 0) {
    findings.push({
      id: 'finding_missing_image_alt',
      category: 'Accessibility Surface',
      title: 'Some images are missing alt text',
      description: 'Visible images are present without alt attributes.',
      severity: imageStats.missingAlt > 3 ? 'medium' : 'low',
      pageUrl: finalUrl,
      impact: 'Lower accessibility quality and weaker descriptive support around media content.',
      evidenceIds: [mediaEv],
    });
  }

  if (!freshness.hasAny) {
    findings.push({
      id: 'finding_missing_freshness_signals',
      category: 'Freshness Integrity',
      title: 'No machine-readable freshness signal detected',
      description: 'The page lacks common publication or modification timestamps in metadata or <time> elements.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Lower date clarity for recency-sensitive queries.',
      evidenceIds: [freshnessEv],
    });
  }

  if (appShellRisk) {
    findings.push({
      id: 'finding_possible_client_only_content',
      category: 'Interpretability',
      title: 'Possible client-rendered app shell detected',
      description: 'The HTML shows a thin content footprint and app-shell indicators that may hide primary content from non-rendered fetches.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Static crawlers and some retrieval systems may see less content than users do in-browser.',
      evidenceIds: [wordCountEv],
    });
  }

  const interpretability = clampScore(
    100 -
      penalty(!title, 22) -
      penalty(!metaDescription, 10) -
      penalty(headingCounts.h1 === 0, 16) -
      penalty(wordCount < 250, 20) -
      penalty(paragraphCount < 3, 8) -
      penalty(appShellRisk, 12),
  );

  const extractability = clampScore(
    100 -
      penalty(!canonical, 12) -
      penalty(Boolean(finalUrl) && !!canonical && normalizeComparableUrl(canonical) !== normalizeComparableUrl(finalUrl), 18) -
      penalty(robots.toLowerCase().includes('noindex'), 45) -
      penalty(!schemaInfo.types.length, 20) -
      penalty(internalLinkCount < 2 && wordCount > 350, 6),
  );

  const structuralClarity = clampScore(
    100 -
      penalty(headingCounts.h1 === 0, 20) -
      penalty(headingCounts.h1 > 1, 10) -
      penalty(headingCounts.h2 === 0 && wordCount > 400, 18) -
      penalty(!title, 12),
  );

  const evidenceAvailability = clampScore(
    100 -
      penalty(wordCount < 250, 35) -
      penalty(wordCount >= 250 && wordCount < 600, 15) -
      penalty(faqSignals.count === 0 && answerBlocks.count < 2 && wordCount > 500, 10),
  );

  const freshnessIntegrity = clampScore(
    100 - penalty(!freshness.hasAny, 18) - penalty(robots.toLowerCase().includes('noarchive'), 5),
  );

  const accessibilitySurface = clampScore(100 - penalty(imageStats.total > 0 && imageStats.missingAlt > 0, Math.min(22, imageStats.missingAlt * 4)));

  const completeness = clampScore(
    100 - penalty(!html.trim(), 70) - penalty(appShellRisk, 18) - penalty(wordCount < 120, 14),
  );
  const confidence = clampScore(
    88 - penalty(appShellRisk, 20) - penalty(wordCount < 120, 16) - penalty(!finalUrl, 6),
  );

  return {
    findings,
    evidence,
    fixes,
    scores: {
      interpretability,
      extractability,
      structuralClarity,
      evidenceAvailability,
      freshnessIntegrity,
      accessibilitySurface,
    },
    completeness,
    confidence,
    constraints,
  };
}

function getMetaContent($: cheerio.CheerioAPI, names: string[]): string {
  for (const name of names) {
    const byName = $(`meta[name="${name}"]`).attr('content')?.trim();
    if (byName) return byName;
    const byProperty = $(`meta[property="${name}"]`).attr('content')?.trim();
    if (byProperty) return byProperty;
  }
  return '';
}

function getContentScope($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  const preferred = $('main, article, [role="main"]').first();
  if (preferred.length) return preferred;

  const body = $('body').first();
  if (body.length) return body;

  const html = $('html').first();
  if (html.length) return html;

  return $('*').first();
}

function extractReadableText(scope: cheerio.Cheerio<any>): string {
  const clone = scope.clone();
  clone.find('script, style, noscript, svg, iframe, nav, footer, aside, form, dialog, [aria-hidden="true"], .sr-only').remove();
  return clone.text().replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function penalty(condition: boolean, points: number): number {
  return condition ? points : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function detectFaqSignals($: cheerio.CheerioAPI): { count: number } {
  const faqHeadings = $('h2, h3, h4')
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get()
    .filter((text) => text.includes('faq') || text.includes('frequently asked'));

  const faqSchema = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).contents().text())
    .get()
    .filter((raw) => /FAQPage|Question|acceptedAnswer/i.test(raw || ''));

  const questionParagraphs = $('summary, dt, h2, h3, p, li')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => /^q[:\s]/i.test(text) || /\?$/.test(text));

  return {
    count: faqHeadings.length + faqSchema.length + questionParagraphs.length,
  };
}

function detectAnswerBlocks($: cheerio.CheerioAPI): { count: number } {
  let count = 0;
  $('h2, h3').each((_, el) => {
    const heading = $(el).text().trim();
    if (!heading) return;
    const nextText = $(el)
      .nextUntil('h1, h2, h3, h4')
      .map((__, sibling) => $(sibling).text().trim())
      .get()
      .join(' ')
      .trim();
    const words = countWords(nextText);
    if (words >= 40) count += 1;
  });
  return { count };
}

function extractSchemaInfo($: cheerio.CheerioAPI): { types: string[] } {
  const types = new Set<string>();

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      walkSchema(parsed, types);
    } catch {
      return;
    }
  });

  return { types: [...types] };
}

function walkSchema(input: unknown, types: Set<string>) {
  if (Array.isArray(input)) {
    for (const item of input) walkSchema(item, types);
    return;
  }

  if (!input || typeof input !== 'object') return;

  const record = input as Record<string, unknown>;
  const typeValue = record['@type'];

  if (typeof typeValue === 'string') types.add(typeValue);
  if (Array.isArray(typeValue)) {
    for (const item of typeValue) {
      if (typeof item === 'string') types.add(item);
    }
  }

  for (const value of Object.values(record)) {
    walkSchema(value, types);
  }
}

function getFreshnessSignals($: cheerio.CheerioAPI): { hasAny: boolean; values: string[] } {
  const values = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[property="article:modified_time"]').attr('content'),
    $('meta[name="last-modified"]').attr('content'),
    $('time[datetime]').first().attr('datetime'),
  ].filter(Boolean) as string[];

  return { hasAny: values.length > 0, values };
}

function resolveUrl(raw: string, base?: string): string {
  if (!raw) return '';
  try {
    return new URL(raw, base || undefined).toString();
  } catch {
    return raw;
  }
}

function normalizeComparableUrl(value: string): string {
  try {
    const u = new URL(value);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

function countInternalLinks($: cheerio.CheerioAPI, finalUrl?: string): number {
  const origin = finalUrl ? safeOrigin(finalUrl) : '';
  let count = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const resolved = new URL(href, finalUrl || undefined);
      if (!origin || resolved.origin === origin) count += 1;
    } catch {
      return;
    }
  });
  return count;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function getImageStats($: cheerio.CheerioAPI): { total: number; missingAlt: number } {
  let total = 0;
  let missingAlt = 0;
  $('img').each((_, el) => {
    total += 1;
    if (!$(el).attr('alt')) missingAlt += 1;
  });
  return { total, missingAlt };
}

function detectAppShellRisk($: cheerio.CheerioAPI, wordCount: number): boolean {
  const rootIds = ['root', 'app', '__next', 'svelte'];
  const hasAppMount = rootIds.some((id) => $(`#${id}`).length > 0);
  const hasLargeScriptFootprint = $('script[src], script').length >= 8;
  return wordCount < 180 && hasAppMount && hasLargeScriptFootprint;
}
