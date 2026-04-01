import * as cheerio from 'cheerio';
import type { AuditEvidence, AuditFinding, AuditFix, AuditModuleResult } from '../../../../shared/types/audit.js';

export interface TechnicalAnalysisInput {
  html: string;
  finalUrl?: string;
}

export type TechnicalAnalysisResult = AuditModuleResult;

export async function analyzeTechnical(input: TechnicalAnalysisInput): Promise<TechnicalAnalysisResult> {
  const html = String(input.html || '');
  const finalUrl = input.finalUrl || '';
  const $ = cheerio.load(html);

  const findings: AuditFinding[] = [];
  const evidence: AuditEvidence[] = [];
  const fixes: AuditFix[] = [];
  const constraints: string[] = [];

  const addEvidence = (type: AuditEvidence['type'], label: string, observedValue: string, options: Partial<AuditEvidence> = {}): string => {
    const id = `ev_tech_${evidence.length + 1}`;
    evidence.push({
      id,
      type,
      label,
      pageUrl: finalUrl,
      observedValue: truncate(observedValue, 500),
      captureTimeUtc: new Date().toISOString(),
      source: 'raw_html',
      confidence: 0.86,
      ...options,
    });
    return id;
  };

  const addFix = (fix: Omit<AuditFix, 'id'>) => fixes.push({ id: `fix_tech_${fixes.length + 1}`, ...fix });

  const viewport = $('meta[name="viewport"]').attr('content')?.trim() || '';
  const lang = $('html').attr('lang')?.trim() || '';
  const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href')?.trim() || '';
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || '';
  const twitterCard = $('meta[name="twitter:card"]').attr('content')?.trim() || '';
  const hreflangCount = $('link[rel="alternate"][hreflang]').length;
  const canonicalCount = $('link[rel="canonical"]').length;
  const scriptCount = $('script').length;
  const stylesheetCount = $('link[rel="stylesheet"]').length;
  const anchorStats = getAnchorStats($);
  const imageDimensionStats = getImageDimensionStats($);

  const viewportEv = addEvidence('technical', 'Viewport meta', viewport || '(missing)', { locator: 'meta[name="viewport"]' });
  const langEv = addEvidence('technical', 'HTML lang attribute', lang || '(missing)', { locator: 'html[lang]' });
  const socialEv = addEvidence('technical', 'Preview metadata', JSON.stringify({ ogImage: !!ogImage, twitterCard: !!twitterCard }));
  const linkEv = addEvidence('link', 'Anchor health', JSON.stringify(anchorStats));
  const imgDimEv = addEvidence('media', 'Image dimension coverage', JSON.stringify(imageDimensionStats));
  const assetEv = addEvidence('technical', 'Asset footprint', JSON.stringify({ scriptCount, stylesheetCount, canonicalCount, hreflangCount, favicon: !!favicon }));

  if (!viewport) {
    findings.push({
      id: 'finding_missing_viewport',
      category: 'Technical Integrity',
      title: 'Missing viewport meta tag',
      description: 'The page does not declare a viewport meta tag.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Mobile rendering assumptions become weaker and layout can degrade on handheld devices.',
      evidenceIds: [viewportEv],
    });
  }

  if (!lang) {
    findings.push({
      id: 'finding_missing_lang',
      category: 'Technical Integrity',
      title: 'Missing html lang attribute',
      description: 'The root html element does not expose a language tag.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Lower language clarity for crawlers, accessibility tooling, and translation systems.',
      evidenceIds: [langEv],
    });
  }

  if (canonicalCount > 1) {
    findings.push({
      id: 'finding_multiple_canonicals',
      category: 'Technical Integrity',
      title: 'Multiple canonical tags detected',
      description: 'More than one canonical tag appears in the page head.',
      severity: 'high',
      pageUrl: finalUrl,
      impact: 'Canonical ambiguity can confuse search and answer engines.',
      evidenceIds: [assetEv],
    });
  }

  if (!ogImage) {
    findings.push({
      id: 'finding_missing_og_image',
      category: 'Technical Integrity',
      title: 'Missing og:image',
      description: 'The page does not expose an Open Graph image.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Weaker social preview quality and less metadata reinforcement.',
      evidenceIds: [socialEv],
    });
  }

  if (!favicon) {
    findings.push({
      id: 'finding_missing_favicon',
      category: 'Technical Integrity',
      title: 'Missing favicon link signal',
      description: 'No favicon link was detected in the HTML head.',
      severity: 'info',
      pageUrl: finalUrl,
      impact: 'Reduced polish and weaker lightweight branding signal.',
      evidenceIds: [assetEv],
    });
  }

  if (anchorStats.emptyHrefCount > 0 || anchorStats.javascriptHrefCount > 0) {
    findings.push({
      id: 'finding_weak_anchor_hygiene',
      category: 'Technical Integrity',
      title: 'Some anchors are non-navigable or JS-only',
      description: 'The page contains empty href anchors or javascript: links.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Weaker crawlability and less reliable navigation semantics.',
      evidenceIds: [linkEv],
    });
    addFix({
      title: 'Replace non-navigable anchors with real links or buttons',
      priority: 'p2',
      implementationSurface: 'links',
      findingIds: ['finding_weak_anchor_hygiene'],
      evidenceIds: [linkEv],
      instructions: [
        'Replace href="javascript:..." and empty href anchors with valid URLs or semantic buttons for UI actions.',
        'Keep navigational links crawlable and deterministic.',
      ],
      expectedOutcome: 'Cleaner crawl paths and less ambiguous navigation markup.',
    });
  }

  if (imageDimensionStats.total > 0 && imageDimensionStats.missingDimensionCount > 0) {
    findings.push({
      id: 'finding_missing_image_dimensions',
      category: 'Technical Integrity',
      title: 'Some images omit width and height attributes',
      description: 'Visible image tags are missing width and height declarations.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Higher layout-shift risk and weaker static render stability.',
      evidenceIds: [imgDimEv],
    });
  }

  const technicalIntegrity = clampScore(
    100 -
      penalty(!viewport, 12) -
      penalty(!lang, 8) -
      penalty(canonicalCount > 1, 22) -
      penalty(!ogImage, 6) -
      penalty(anchorStats.emptyHrefCount > 0 || anchorStats.javascriptHrefCount > 0, 12) -
      penalty(imageDimensionStats.total > 0 && imageDimensionStats.missingDimensionCount > 0, Math.min(12, imageDimensionStats.missingDimensionCount * 2)),
  );

  const accessibilitySurface = clampScore(100 - penalty(!lang, 8) - penalty(!viewport, 8) - penalty(anchorStats.hashOnlyCount > 5, 6));

  return {
    findings,
    evidence,
    fixes,
    scores: { technicalIntegrity, accessibilitySurface },
    completeness: clampScore(100 - penalty(!html.trim(), 80)),
    confidence: 86,
    constraints,
  };
}

function getAnchorStats($: cheerio.CheerioAPI) {
  let total = 0;
  let emptyHrefCount = 0;
  let javascriptHrefCount = 0;
  let hashOnlyCount = 0;
  $('a').each((_, el) => {
    total += 1;
    const href = ($(el).attr('href') || '').trim();
    if (!href) emptyHrefCount += 1;
    else if (/^javascript:/i.test(href)) javascriptHrefCount += 1;
    else if (href === '#') hashOnlyCount += 1;
  });
  return { total, emptyHrefCount, javascriptHrefCount, hashOnlyCount };
}

function getImageDimensionStats($: cheerio.CheerioAPI) {
  let total = 0;
  let missingDimensionCount = 0;
  $('img').each((_, el) => {
    total += 1;
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    if (!width || !height) missingDimensionCount += 1;
  });
  return { total, missingDimensionCount };
}

function penalty(condition: boolean, points: number): number {
  return condition ? points : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
