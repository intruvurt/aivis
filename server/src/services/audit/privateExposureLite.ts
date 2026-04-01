import * as cheerio from 'cheerio';
import type { AuditEvidence, AuditFinding, AuditFix, AuditModuleResult } from '../../../../shared/types/audit.js';

export interface PrivateExposureLiteInput {
  html: string;
  finalUrl?: string;
}

export type PrivateExposureLiteResult = AuditModuleResult;

const SENSITIVE_ROUTE_PATTERNS = [
  /\/admin\b/i,
  /\/dashboard\b/i,
  /\/api\b/i,
  /\/debug\b/i,
  /\/swagger\b/i,
  /\/graphql\b/i,
  /\/__nextjs/i,
  /\/actuator\b/i,
  /\/wp-admin\b/i,
  /\/login\b/i,
];

const SECRET_LIKE_PATTERNS = [
  /sk_(live|test)_[a-z0-9]+/i,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
  /postgres(?:ql)?:\/\//i,
  /mongodb(?:\+srv)?:\/\//i,
];

export async function analyzePrivateExposureLite(input: PrivateExposureLiteInput): Promise<PrivateExposureLiteResult> {
  const html = String(input.html || '');
  const finalUrl = input.finalUrl || '';
  const $ = cheerio.load(html);

  const findings: AuditFinding[] = [];
  const evidence: AuditEvidence[] = [];
  const fixes: AuditFix[] = [];
  const constraints: string[] = [];

  const addEvidence = (type: AuditEvidence['type'], label: string, observedValue: string, options: Partial<AuditEvidence> = {}): string => {
    const id = `ev_priv_${evidence.length + 1}`;
    evidence.push({
      id,
      type,
      label,
      pageUrl: finalUrl,
      observedValue: truncate(observedValue, 500),
      captureTimeUtc: new Date().toISOString(),
      source: 'raw_html',
      confidence: 0.82,
      ...options,
    });
    return id;
  };

  const hrefs = $('a[href], script[src], link[href]')
    .map((_, el) => $(el).attr('href') || $(el).attr('src') || '')
    .get()
    .filter(Boolean);

  const suspiciousRoutes = hrefs.filter((href) => SENSITIVE_ROUTE_PATTERNS.some((pattern) => pattern.test(href)));
  const sourceMapRefs = hrefs.filter((href) => href.endsWith('.map'));
  const secretHits = SECRET_LIKE_PATTERNS.flatMap((pattern) => html.match(pattern) || []);
  const envHints = Array.from(new Set((html.match(/\b(?:VITE_|NEXT_PUBLIC_|REACT_APP_|SUPABASE_|FIREBASE_|STRIPE_)\w+/g) || []))).slice(0, 20);

  const routeEv = addEvidence('security', 'Suspicious public route hints', JSON.stringify(suspiciousRoutes.slice(0, 20)));
  const mapEv = addEvidence('security', 'Source map references', JSON.stringify(sourceMapRefs.slice(0, 20)));
  const secretEv = addEvidence('security', 'Secret-like token matches', JSON.stringify(secretHits.slice(0, 10)));
  const envEv = addEvidence('security', 'Public environment variable hints', JSON.stringify(envHints));

  if (suspiciousRoutes.length > 0) {
    findings.push({
      id: 'finding_sensitive_route_hints',
      category: 'Security Exposure',
      title: 'HTML references sensitive or private-looking routes',
      description: 'The page source references routes commonly associated with admin, API, dashboard, or debug surfaces.',
      severity: suspiciousRoutes.length > 4 ? 'high' : 'medium',
      pageUrl: finalUrl,
      impact: 'Can leak private surface structure and expose internal application topology.',
      evidenceIds: [routeEv],
    });
  }

  if (sourceMapRefs.length > 0) {
    findings.push({
      id: 'finding_source_map_references',
      category: 'Security Exposure',
      title: 'Source map references detected in public HTML',
      description: 'The page links to one or more source map files.',
      severity: 'medium',
      pageUrl: finalUrl,
      impact: 'Can make reverse engineering and internal path discovery easier.',
      evidenceIds: [mapEv],
    });
  }

  if (secretHits.length > 0) {
    findings.push({
      id: 'finding_secret_like_pattern',
      category: 'Security Exposure',
      title: 'Secret-like token pattern detected in public source',
      description: 'The HTML contains text that matches secret or credential-like patterns.',
      severity: 'critical',
      pageUrl: finalUrl,
      impact: 'Potential credential leakage or accidental secret exposure.',
      evidenceIds: [secretEv],
    });
    fixes.push({
      id: 'fix_priv_1',
      title: 'Remove or rotate exposed secrets immediately',
      priority: 'p1',
      implementationSurface: 'security',
      findingIds: ['finding_secret_like_pattern'],
      evidenceIds: [secretEv],
      instructions: [
        'Remove secrets from client-rendered HTML, JS bundles, templates, and static files.',
        'Rotate any key or credential that may have been exposed publicly.',
      ],
      expectedOutcome: 'Lower risk of credential compromise and public-source leakage.',
    });
  }

  if (envHints.length > 0) {
    findings.push({
      id: 'finding_public_env_hints',
      category: 'Security Exposure',
      title: 'Public build contains environment variable identifiers',
      description: 'Environment-style variable names are visible in the client source.',
      severity: 'low',
      pageUrl: finalUrl,
      impact: 'Can reveal stack choices and internal naming patterns even when values are not exposed.',
      evidenceIds: [envEv],
    });
  }

  const securityExposure = clampScore(
    100 -
      penalty(suspiciousRoutes.length > 0, Math.min(25, suspiciousRoutes.length * 4)) -
      penalty(sourceMapRefs.length > 0, 16) -
      penalty(secretHits.length > 0, 65) -
      penalty(envHints.length > 0, 6),
  );

  return {
    findings,
    evidence,
    fixes,
    scores: { securityExposure },
    completeness: clampScore(100 - penalty(!html.trim(), 80)),
    confidence: clampScore(82 - penalty(secretHits.length === 0 && suspiciousRoutes.length === 0, 4)),
    constraints,
  };
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
