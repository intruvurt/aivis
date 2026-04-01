import * as cheerio from 'cheerio';
import type {
  AuditEvidence,
  AuditFinding,
  AuditFix,
  AuditModuleResult,
  AuditScoreBreakdown,
} from '../../../../shared/types/audit.js';

export interface EntityClarityInput {
  html: string;
  finalUrl?: string;
}

export type EntityClarityResult = AuditModuleResult;

export async function analyzeEntityClarity(input: EntityClarityInput): Promise<EntityClarityResult> {
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
    const id = `ev_entity_${evidence.length + 1}`;
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

  const addFix = (fix: Omit<AuditFix, 'id'>) => {
    fixes.push({ id: `fix_entity_${fixes.length + 1}`, ...fix });
  };

  const orgSchema = extractOrganizationSignals($);
  const socialSignals = extractSocialSignals($, finalUrl);
  const contactSignals = extractContactSignals($, html);
  const aboutSignals = extractAboutSignals($);
  const trustDocs = extractTrustDocs($);
  const title = $('title').first().text().trim();
  const h1 = $('h1').first().text().trim();
  const siteName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
  const brandMentions = [title, h1, siteName, ...orgSchema.names].filter(Boolean);
  const normalizedBrandMentions = uniqueNormalized(brandMentions);
  const brandVariance = calculateVariance(normalizedBrandMentions);

  if (!html.trim()) constraints.push('empty_html');
  if (normalizedBrandMentions.length === 0) constraints.push('no_clear_entity_strings');

  const orgEv = addEvidence('entity', 'Organization schema types', orgSchema.types.join(', ') || '(none)', {
    source: orgSchema.types.length ? 'json_ld' : 'raw_html',
  });
  const sameAsEv = addEvidence('entity', 'Profile / sameAs signals', JSON.stringify(socialSignals), {
    source: orgSchema.sameAs.length ? 'json_ld' : 'raw_html',
  });
  const contactEv = addEvidence('entity', 'Contact signals', JSON.stringify(contactSignals));
  const aboutEv = addEvidence('entity', 'About / leadership signals', JSON.stringify(aboutSignals));
  const trustEv = addEvidence('policy', 'Trust document signals', JSON.stringify(trustDocs));
  const brandEv = addEvidence('entity', 'Visible brand mentions', JSON.stringify(normalizedBrandMentions));

  if (!orgSchema.types.length) {
    findings.push({
      id: 'finding_missing_org_schema',
      category: 'Trust & Entity Clarity',
      title: 'No organization or person schema detected',
      description: 'The page does not expose organization-like structured data that helps machines anchor entity identity.',
      severity: 'high',
      pageUrl: finalUrl,
      impact: 'Weaker entity disambiguation and reduced trust scaffolding.',
      evidenceIds: [orgEv],
    });
    addFix({
      title: 'Add organization-level structured data',
      priority: 'p1',
      implementationSurface: 'schema',
      findingIds: ['finding_missing_org_schema'],
      evidenceIds: [orgEv],
      instructions: [
        'Add JSON-LD for Organization or the most accurate business subtype.',
        'Include name, url, logo, contactPoint, and sameAs only when they are real and publicly supported.',
      ],
      expectedOutcome: 'Search and answer engines get a cleaner entity anchor for the business behind the page.',
    });
  }

  if (socialSignals.profileCount === 0) {
    findings.push({
      id: 'finding_missing_sameas_profiles',
      category: 'Trust & Entity Clarity',
      title: 'Weak profile identity graph',
      description: 'No trustworthy public profile links or sameAs-style identity references were detected.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Weaker external identity coherence and public entity validation.',
      evidenceIds: [sameAsEv],
    });
  }

  if (
    contactSignals.phoneCount === 0 &&
    contactSignals.emailCount === 0 &&
    contactSignals.contactLinks.length === 0
  ) {
    findings.push({
      id: 'finding_missing_contact_signals',
      category: 'Trust & Entity Clarity',
      title: 'Weak contact visibility',
      description: 'The page does not expose strong contact signals such as phone, email, or a clear contact path.',
      severity: 'high',
      pageUrl: finalUrl,
      impact: 'Reduces perceived legitimacy and trustworthiness.',
      evidenceIds: [contactEv],
    });
    addFix({
      title: 'Expose contact details or a real contact path',
      priority: 'p1',
      implementationSurface: 'content',
      findingIds: ['finding_missing_contact_signals'],
      evidenceIds: [contactEv],
      instructions: [
        'Add a visible contact method such as a real support email, phone number, or a clear contact page link.',
        'Keep contact details consistent across the page, schema, and policy pages.',
      ],
      expectedOutcome: 'Stronger trust signals for both users and machine-based quality assessments.',
    });
  }

  if (!aboutSignals.hasAboutHeading && !aboutSignals.hasFounderSignal && !aboutSignals.hasTeamSignal) {
    findings.push({
      id: 'finding_missing_about_context',
      category: 'Trust & Entity Clarity',
      title: 'Weak about/founder context',
      description: 'The page lacks visible signals about who operates the business or what the organization is.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'AI systems receive less identity context for trust evaluation.',
      evidenceIds: [aboutEv],
    });
  }

  if (!trustDocs.hasPrivacy) {
    findings.push({
      id: 'finding_missing_privacy',
      category: 'Trust & Entity Clarity',
      title: 'Missing privacy policy signal',
      description: 'No obvious privacy policy link or page signal was found.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Lower machine and human trust for operational legitimacy.',
      evidenceIds: [trustEv],
    });
  }

  if (!trustDocs.hasTerms) {
    findings.push({
      id: 'finding_missing_terms',
      category: 'Trust & Entity Clarity',
      title: 'Missing terms signal',
      description: 'No obvious terms of service, terms and conditions, or equivalent legal page signal was found.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Lower operational trust and weaker business maturity signals.',
      evidenceIds: [trustEv],
    });
  }

  if (normalizedBrandMentions.length >= 2 && brandVariance > 0.35) {
    findings.push({
      id: 'finding_entity_name_variance',
      category: 'Trust & Entity Clarity',
      title: 'Brand/entity naming is inconsistent across visible signals',
      description: 'Brand names or entity labels vary meaningfully across title, headings, or schema.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Weaker entity resolution and lower trust consistency.',
      evidenceIds: [brandEv],
    });
  }

  const trustEntityClarity = clampScore(
    100 -
      penalty(!orgSchema.types.length, 24) -
      penalty(socialSignals.profileCount === 0, 12) -
      penalty(
        contactSignals.phoneCount === 0 &&
          contactSignals.emailCount === 0 &&
          contactSignals.contactLinks.length === 0,
        20,
      ) -
      penalty(
        !aboutSignals.hasAboutHeading &&
          !aboutSignals.hasFounderSignal &&
          !aboutSignals.hasTeamSignal,
        14,
      ) -
      penalty(!trustDocs.hasPrivacy, 12) -
      penalty(!trustDocs.hasTerms, 6) -
      penalty(brandVariance > 0.35, 10),
  );

  const completeness = clampScore(100 - penalty(!html.trim(), 70) - penalty(normalizedBrandMentions.length === 0, 15));
  const confidence = clampScore(86 - penalty(normalizedBrandMentions.length === 0, 20) - penalty(orgSchema.types.length === 0, 8));

  return {
    findings,
    evidence,
    fixes,
    scores: {
      trustEntityClarity,
    },
    completeness,
    confidence,
    constraints,
  };
}

function extractOrganizationSignals($: cheerio.CheerioAPI): { types: string[]; names: string[]; sameAs: string[] } {
  const types = new Set<string>();
  const names = new Set<string>();
  const sameAs = new Set<string>();
  const allowed = new Set([
    'Organization',
    'LocalBusiness',
    'Corporation',
    'Person',
    'ProfessionalService',
    'MedicalBusiness',
    'LegalService',
    'Store',
    'Dentist',
    'Attorney',
    'FinancialService',
    'SoftwareApplication',
  ]);

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      walkSchema(parsed, allowed, types, names, sameAs);
    } catch {
      return;
    }
  });

  return { types: [...types], names: [...names], sameAs: [...sameAs] };
}

function walkSchema(
  input: unknown,
  allowed: Set<string>,
  types: Set<string>,
  names: Set<string>,
  sameAs: Set<string>,
) {
  if (Array.isArray(input)) {
    input.forEach((item) => walkSchema(item, allowed, types, names, sameAs));
    return;
  }
  if (!input || typeof input !== 'object') return;

  const record = input as Record<string, unknown>;
  const rawType = record['@type'];
  const name = record['name'];
  const sameAsValue = record['sameAs'];

  if (typeof rawType === 'string' && allowed.has(rawType)) types.add(rawType);
  if (Array.isArray(rawType)) {
    rawType.forEach((item) => {
      if (typeof item === 'string' && allowed.has(item)) types.add(item);
    });
  }
  if (typeof name === 'string' && name.trim()) names.add(name.trim());
  if (typeof sameAsValue === 'string' && sameAsValue.trim()) sameAs.add(sameAsValue.trim());
  if (Array.isArray(sameAsValue)) {
    sameAsValue.forEach((item) => {
      if (typeof item === 'string' && item.trim()) sameAs.add(item.trim());
    });
  }

  Object.values(record).forEach((value) => walkSchema(value, allowed, types, names, sameAs));
}

function extractSocialSignals($: cheerio.CheerioAPI, finalUrl?: string) {
  const profiles = new Set<string>();
  const suspiciousPostLinks = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href) return;
    const resolved = resolveUrl(href, finalUrl);
    if (/twitter\.com|x\.com|linkedin\.com|github\.com|facebook\.com|instagram\.com|youtube\.com|bsky\.app|substack\.com|reddit\.com/i.test(resolved)) {
      profiles.add(resolved);
      if (/\/p\//.test(resolved) || /medium\.com\/.+-.+/i.test(resolved)) suspiciousPostLinks.add(resolved);
    }
  });
  return {
    profileCount: profiles.size,
    profileLinks: [...profiles].slice(0, 12),
    postLikeProfileLinks: [...suspiciousPostLinks].slice(0, 8),
  };
}

function extractContactSignals($: cheerio.CheerioAPI, html: string) {
  const emails = new Set((html.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) || []).map((v) => v.toLowerCase()));
  const phones = new Set(html.match(/\b(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}\b/g) || []);
  const contactLinks = $('a[href]')
    .map((_, el) => $(el).attr('href')?.trim() || '')
    .get()
    .filter((href) => /mailto:|tel:|\/contact/i.test(href));

  return {
    emailCount: emails.size,
    phoneCount: phones.size,
    contactLinks: contactLinks.slice(0, 10),
  };
}

function extractAboutSignals($: cheerio.CheerioAPI) {
  const headingText = $('h1, h2, h3, h4, nav a, footer a')
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get();
  const body = $.text().toLowerCase();
  return {
    hasAboutHeading: headingText.some((v) => v.includes('about')),
    hasFounderSignal: /founder|co-founder|creator|owner|built by/i.test(body),
    hasTeamSignal: /team|leadership|staff|our company/i.test(body),
  };
}

function extractTrustDocs($: cheerio.CheerioAPI) {
  const hrefs = $('a[href]')
    .map((_, el) => `${$(el).text().trim()} ${$(el).attr('href') || ''}`.toLowerCase())
    .get();
  return {
    hasPrivacy: hrefs.some((v) => v.includes('privacy')),
    hasTerms: hrefs.some((v) => v.includes('terms')),
    hasAbout: hrefs.some((v) => v.includes('about')),
    hasContact: hrefs.some((v) => v.includes('contact')),
  };
}

function uniqueNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    const norm = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (!trimmed || seen.has(norm)) return;
    seen.add(norm);
    result.push(trimmed);
  });
  return result;
}

function calculateVariance(values: string[]): number {
  if (values.length <= 1) return 0;
  const base = normalizeEntity(values[0]);
  let varianceHits = 0;
  for (const value of values.slice(1)) {
    if (normalizeEntity(value) !== base) varianceHits += 1;
  }
  return varianceHits / (values.length - 1);
}

function normalizeEntity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveUrl(raw: string, base?: string): string {
  try {
    return new URL(raw, base || undefined).toString();
  } catch {
    return raw;
  }
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
