import type {
  PrivateExposureFinding,
  PrivateExposureFindingConfidence,
  PrivateExposureFindingDomain,
  PrivateExposureFindingSeverity,
  PrivateExposureFindingStatus,
  PrivateExposureScanReport,
  PrivateExposureScoreBand,
  PrivateExposureVerdict,
  PrivateExposureTargetType,
} from '../../../shared/types.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';

type ScanArgs = {
  targetUrl: string;
  targetType?: PrivateExposureTargetType;
  targetLabel?: string;
  ownershipAsserted: boolean;
  authenticatedContextProvided?: boolean;
};

type FindingInput = Omit<PrivateExposureFinding, 'evidence_id'> & {
  family: string;
};

const DOMAIN_CODES: Record<PrivateExposureFindingDomain, string> = {
  client_secret_leakage: 'csl',
  route_protection_integrity: 'rpi',
  session_hardening: 'shd',
  header_hardening: 'hhd',
  public_data_spill_risk: 'pds',
};

const DOMAIN_WEIGHTS: Record<PrivateExposureFindingDomain, number> = {
  client_secret_leakage: 30,
  route_protection_integrity: 25,
  session_hardening: 20,
  header_hardening: 10,
  public_data_spill_risk: 15,
};

const DOMAIN_CRITICAL_CAP: Partial<Record<PrivateExposureFindingDomain, number>> = {
  client_secret_leakage: 35,
  route_protection_integrity: 40,
  session_hardening: 45,
  header_hardening: 60,
  public_data_spill_risk: 35,
};

const SEVERITY_DEDUCTION: Record<PrivateExposureFindingSeverity, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 2,
  informational: 0,
};

const CONFIDENCE_MULTIPLIER: Record<PrivateExposureFindingConfidence, number> = {
  high: 1,
  medium: 0.7,
  low: 0.4,
};

const SENSITIVE_KEYWORDS = [
  'email',
  'userid',
  'workspaceid',
  'tenantid',
  'plan',
  'role',
  'token',
  'secret',
];

const CREDENTIAL_PATTERNS: Array<{ name: string; regex: RegExp; severity: PrivateExposureFindingSeverity }> = [
  { name: 'stripe_live', regex: /\bsk_live_[A-Za-z0-9]{8,}\b/g, severity: 'critical' },
  { name: 'stripe_test', regex: /\bsk_test_[A-Za-z0-9]{8,}\b/g, severity: 'high' },
  { name: 'publishable_live', regex: /\bpk_live_[A-Za-z0-9]{8,}\b/g, severity: 'high' },
  { name: 'google_api_key', regex: /\bAIza[0-9A-Za-z\-_]{16,}\b/g, severity: 'high' },
  { name: 'bearer_literal', regex: /Bearer\s+[A-Za-z0-9._~+/-]{24,}/gi, severity: 'high' },
  { name: 'aws_key', regex: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'critical' },
];

function scoreBand(score: number): PrivateExposureScoreBand {
  if (score >= 90) return 'hardened_surface';
  if (score >= 75) return 'mostly_sound_notable_trust_gaps';
  if (score >= 55) return 'meaningful_exposure_risk';
  if (score >= 35) return 'high_risk_public_surface';
  return 'critical_exposure_posture';
}

function verdictFromFindings(findings: PrivateExposureFinding[]): PrivateExposureVerdict {
  const confirmedCriticalOrHigh = findings.some(
    (f) => f.status === 'confirmed' && (f.severity === 'critical' || f.severity === 'high')
  );
  if (confirmedCriticalOrHigh) return 'confirmed_exposure';
  if (findings.length > 0) return 'possible_exposure';
  return 'no_clear_exposure';
}

function redactedToken(sample: string): string {
  const clean = String(sample || '').trim();
  if (!clean) return '[REDACTED]';
  if (clean.length < 8) return '[REDACTED]';
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

function tryParseJson(input: string): any | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function collectKeys(value: unknown, out: Set<string>, depth = 0): void {
  if (depth > 3 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) collectKeys(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const [key, next] of Object.entries(obj).slice(0, 25)) {
      out.add(key.toLowerCase());
      collectKeys(next, out, depth + 1);
    }
  }
}

function normalizeAssetUrl(base: URL, raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('data:')) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function scriptSrcsFromHtml(html: string): string[] {
  const out = new Set<string>();
  const regex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) out.add(match[1]);
  }
  return Array.from(out);
}

function routeCandidatesFromText(text: string): string[] {
  const out = new Set<string>();
  const regex = /\/(api|admin)\/[A-Za-z0-9_./:-]{2,}/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(text)) !== null) {
    const route = String(match[0] || '').replace(/["'`),.;]+$/, '');
    if (route.length <= 120) out.add(route);
  }
  return Array.from(out).slice(0, 12);
}

function ensureTopPriorities(findings: PrivateExposureFinding[]): string[] {
  const severityRank: Record<PrivateExposureFindingSeverity, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    informational: 1,
  };
  const confidenceRank: Record<PrivateExposureFindingConfidence, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const ranked = [...findings].sort((a, b) => {
    const scoreA = severityRank[a.severity] * 10 + confidenceRank[a.confidence];
    const scoreB = severityRank[b.severity] * 10 + confidenceRank[b.confidence];
    return scoreB - scoreA;
  });

  const actions = new Set<string>();
  for (const finding of ranked) {
    if (finding.fix_path[0]) actions.add(finding.fix_path[0]);
    if (actions.size >= 5) break;
  }
  return Array.from(actions);
}

function assignEvidenceIds(findings: FindingInput[]): PrivateExposureFinding[] {
  const grouped = new Map<PrivateExposureFindingDomain, FindingInput[]>();
  for (const finding of findings) {
    const arr = grouped.get(finding.domain) || [];
    arr.push(finding);
    grouped.set(finding.domain, arr);
  }

  const output: PrivateExposureFinding[] = [];
  (Object.keys(DOMAIN_CODES) as PrivateExposureFindingDomain[]).forEach((domain) => {
    const arr = (grouped.get(domain) || []).sort((a, b) => {
      const aKey = `${a.title}|${a.where_found.location}|${a.family}`;
      const bKey = `${b.title}|${b.where_found.location}|${b.family}`;
      return aKey.localeCompare(bKey);
    });
    const code = DOMAIN_CODES[domain];
    arr.forEach((item, index) => {
      output.push({
        ...item,
        evidence_id: `ev_sec_${code}_${String(index + 1).padStart(3, '0')}`,
      });
    });
  });
  return output;
}

function computeScores(findings: Array<PrivateExposureFinding & { family?: string }>) {
  const domainDeductions: Record<PrivateExposureFindingDomain, number> = {
    client_secret_leakage: 0,
    route_protection_integrity: 0,
    session_hardening: 0,
    header_hardening: 0,
    public_data_spill_risk: 0,
  };

  const familyCount = new Map<string, number>();

  for (const finding of findings) {
    const base = SEVERITY_DEDUCTION[finding.severity] * CONFIDENCE_MULTIPLIER[finding.confidence];
    const family = `${finding.domain}:${(finding as any).family || finding.title}`;
    const count = (familyCount.get(family) || 0) + 1;
    familyCount.set(family, count);

    let dampening = 1;
    if (count === 2 || count === 3) dampening = 0.5;
    if (count >= 4) dampening = 0.25;

    domainDeductions[finding.domain] += base * dampening;
  }

  const domain_scores: PrivateExposureScanReport['domain_scores'] = {
    client_secret_leakage: { score: 100, weight: DOMAIN_WEIGHTS.client_secret_leakage, status: 'not_observed' },
    route_protection_integrity: { score: 100, weight: DOMAIN_WEIGHTS.route_protection_integrity, status: 'not_observed' },
    session_hardening: { score: 100, weight: DOMAIN_WEIGHTS.session_hardening, status: 'not_observed' },
    header_hardening: { score: 100, weight: DOMAIN_WEIGHTS.header_hardening, status: 'not_observed' },
    public_data_spill_risk: { score: 100, weight: DOMAIN_WEIGHTS.public_data_spill_risk, status: 'not_observed' },
  };

  (Object.keys(domain_scores) as PrivateExposureFindingDomain[]).forEach((domain) => {
    let score = Math.max(0, Math.round(100 - domainDeductions[domain]));
    const hasCritical = findings.some((f) => f.domain === domain && f.severity === 'critical');
    const cap = DOMAIN_CRITICAL_CAP[domain];
    if (hasCritical && typeof cap === 'number') score = Math.min(score, cap);

    const hasAny = findings.some((f) => f.domain === domain);
    let status: PrivateExposureScanReport['domain_scores'][PrivateExposureFindingDomain]['status'] = 'hardened';
    if (!hasAny) status = 'not_observed';
    else if (score < 55) status = 'high_risk_exposure';
    else if (score < 75) status = 'at_risk';
    else if (score < 90) status = 'needs_attention';

    domain_scores[domain] = {
      score,
      weight: DOMAIN_WEIGHTS[domain],
      status,
    };
  });

  const weightedTotal = (Object.keys(domain_scores) as PrivateExposureFindingDomain[]).reduce((sum, domain) => {
    const entry = domain_scores[domain];
    return sum + (entry.score * entry.weight) / 100;
  }, 0);

  return {
    domain_scores,
    exposure_surface_score: Math.max(0, Math.min(100, Math.round(weightedTotal))),
  };
}

export async function runPrivateExposureScan(args: ScanArgs): Promise<PrivateExposureScanReport> {
  if (!args.ownershipAsserted) {
    throw new Error('ownership_asserted must be true for Private Exposure Scan');
  }

  const normalized = normalizePublicHttpUrl(args.targetUrl);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }

  const target = new URL(normalized.url);
  const findings: FindingInput[] = [];
  const discoveredRoutes = new Set<string>();

  const baseResponse = await fetch(target.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'User-Agent': 'AiVIS.biz-PrivateExposureScan/1.0 (+https://aivis.biz)',
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.7',
    },
  });

  const html = await baseResponse.text();
  const headers = baseResponse.headers;

  const headerChecks: Array<{ key: string; title: string; severity: PrivateExposureFindingSeverity; why: string }> = [
    {
      key: 'content-security-policy',
      title: 'Missing Content-Security-Policy header',
      severity: 'medium',
      why: 'CSP helps contain script injection and limits execution sources.',
    },
    {
      key: 'strict-transport-security',
      title: 'Missing Strict-Transport-Security header',
      severity: 'medium',
      why: 'HSTS helps prevent protocol downgrade and cookie exposure over insecure transport.',
    },
    {
      key: 'x-content-type-options',
      title: 'Missing X-Content-Type-Options header',
      severity: 'low',
      why: 'nosniff prevents MIME confusion attacks in browsers.',
    },
    {
      key: 'referrer-policy',
      title: 'Missing Referrer-Policy header',
      severity: 'low',
      why: 'Referrer-Policy helps limit accidental leakage of URLs and path data.',
    },
    {
      key: 'permissions-policy',
      title: 'Missing Permissions-Policy header',
      severity: 'low',
      why: 'Permissions-Policy limits powerful browser features on untrusted pages.',
    },
  ];

  for (const check of headerChecks) {
    const value = headers.get(check.key);
    if (!value && (check.key !== 'strict-transport-security' || target.protocol === 'https:')) {
      findings.push({
        family: `missing_${check.key}`,
        title: check.title,
        domain: 'header_hardening',
        severity: check.severity,
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'response_header',
          location: target.origin,
          line_hint: null,
        },
        what_was_observed: `${check.key} was not present in response headers for the scanned origin.`,
        why_it_matters: check.why,
        minimal_redacted_proof: `${check.key}=<missing>`,
        fix_path: [`Set ${check.key} on frontend responses at CDN/app edge.`],
        retest_steps: [`Send HEAD/GET to ${target.origin} and verify ${check.key} is present.`],
        affected_assets: [target.origin],
        tags: ['headers', 'hardening', 'passive_scan'],
      });
    }
  }

  const setCookie = headers.get('set-cookie') || '';
  if (setCookie) {
    const lc = setCookie.toLowerCase();
    if (!lc.includes('httponly')) {
      findings.push({
        family: 'cookie_missing_httponly',
        title: 'Session cookie missing HttpOnly',
        domain: 'session_hardening',
        severity: 'high',
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'cookie',
          location: target.origin,
          line_hint: null,
        },
        what_was_observed: 'Set-Cookie header observed without HttpOnly attribute.',
        why_it_matters: 'Cookies readable by JavaScript are easier to exfiltrate if any XSS is introduced.',
        minimal_redacted_proof: 'Set-Cookie: <redacted>; Secure; SameSite=<value>; HttpOnly=<missing>',
        fix_path: ['Set HttpOnly on all authentication and session cookies.'],
        retest_steps: ['Inspect Set-Cookie headers after login and verify HttpOnly is present.'],
        affected_assets: [target.origin],
        tags: ['cookie', 'session', 'auth_boundary'],
      });
    }
    if (!lc.includes('secure')) {
      findings.push({
        family: 'cookie_missing_secure',
        title: 'Session cookie missing Secure',
        domain: 'session_hardening',
        severity: 'high',
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'cookie',
          location: target.origin,
          line_hint: null,
        },
        what_was_observed: 'Set-Cookie header observed without Secure attribute.',
        why_it_matters: 'Cookies without Secure may be transmitted over insecure transport in unsafe deployments.',
        minimal_redacted_proof: 'Set-Cookie: <redacted>; Secure=<missing>',
        fix_path: ['Set Secure on authentication/session cookies in production.'],
        retest_steps: ['Inspect Set-Cookie headers and verify Secure is present.'],
        affected_assets: [target.origin],
        tags: ['cookie', 'session', 'transport_security'],
      });
    }
    if (!lc.includes('samesite=')) {
      findings.push({
        family: 'cookie_missing_samesite',
        title: 'Session cookie missing SameSite attribute',
        domain: 'session_hardening',
        severity: 'medium',
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'cookie',
          location: target.origin,
          line_hint: null,
        },
        what_was_observed: 'Set-Cookie header observed without SameSite attribute.',
        why_it_matters: 'SameSite reduces CSRF exposure on credential-bearing requests.',
        minimal_redacted_proof: 'Set-Cookie: <redacted>; SameSite=<missing>',
        fix_path: ['Set SameSite=Lax or Strict for session cookies as appropriate.'],
        retest_steps: ['Inspect Set-Cookie headers and verify SameSite is present.'],
        affected_assets: [target.origin],
        tags: ['cookie', 'session', 'csrf'],
      });
    }
  }

  const scriptSrcs = scriptSrcsFromHtml(html)
    .map((item) => normalizeAssetUrl(target, item))
    .filter((value): value is string => Boolean(value));

  for (const scriptUrl of scriptSrcs.slice(0, 4)) {
    let scriptBody = '';
    try {
      const scriptResp = await fetch(scriptUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'AiVIS.biz-PrivateExposureScan/1.0 (+https://aivis.biz)' },
      });
      if (!scriptResp.ok) continue;
      scriptBody = await scriptResp.text();
    } catch {
      continue;
    }

    if (/localStorage\.(setItem|getItem)\(['"](?:token|jwt|auth)/i.test(scriptBody)) {
      findings.push({
        family: 'token_in_local_storage',
        title: 'JWT or auth token pattern present in localStorage usage',
        domain: 'session_hardening',
        severity: 'high',
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'javascript_bundle',
          location: scriptUrl,
          line_hint: null,
        },
        what_was_observed: 'Client bundle includes token-oriented localStorage access pattern.',
        why_it_matters: 'Tokens in localStorage are reachable by JavaScript and become exposed under XSS conditions.',
        minimal_redacted_proof: 'localStorage.<read/write>("token"|"jwt"|"auth")',
        fix_path: ['Move session handling to HttpOnly cookies and remove token persistence from localStorage.'],
        retest_steps: ['Search emitted bundles for token localStorage patterns after auth refactor.'],
        affected_assets: [scriptUrl],
        tags: ['frontend', 'token_storage', 'session_hardening'],
      });
    }

    const routeMatches = routeCandidatesFromText(scriptBody);
    for (const route of routeMatches) discoveredRoutes.add(route);

    for (const pattern of CREDENTIAL_PATTERNS) {
      const match = scriptBody.match(pattern.regex)?.[0];
      if (!match) continue;
      findings.push({
        family: `credential_${pattern.name}`,
        title: 'Credential-shaped value observed in public bundle',
        domain: 'client_secret_leakage',
        severity: pattern.severity,
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'javascript_bundle',
          location: scriptUrl,
          line_hint: null,
        },
        what_was_observed: 'Credential-like string pattern matched in public JavaScript asset.',
        why_it_matters: 'Any credential shipped to the browser must be considered public and rotated.',
        minimal_redacted_proof: redactedToken(match),
        fix_path: [
          'Rotate exposed credential immediately.',
          'Move credential usage to server-only environment variables and backend proxy routes.',
        ],
        retest_steps: ['Rebuild/redeploy and search public bundles for credential patterns.'],
        affected_assets: [scriptUrl],
        tags: ['frontend', 'secret_leakage', 'bundle'],
      });
    }

    try {
      const mapResp = await fetch(`${scriptUrl}.map`, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      if (mapResp.ok) {
        findings.push({
          family: 'public_source_map',
          title: 'Public source map is accessible',
          domain: 'client_secret_leakage',
          severity: 'high',
          confidence: 'high',
          status: 'confirmed',
          where_found: {
            asset_type: 'source_map',
            location: `${scriptUrl}.map`,
            line_hint: null,
          },
          what_was_observed: 'Source map endpoint responded with HTTP 200 for a production bundle.',
          why_it_matters: 'Public source maps expose implementation details and increase reconnaissance surface.',
          minimal_redacted_proof: `HTTP 200 on ${scriptUrl}.map`,
          fix_path: ['Disable source maps in production builds and remove existing .map artifacts from public hosting.'],
          retest_steps: ['Request known .map URL after deploy and verify 403/404.'],
          affected_assets: [`${scriptUrl}.map`],
          tags: ['source_map', 'frontend', 'exposure_surface'],
        });
      }
    } catch {
      // unreachable maps are expected; no finding
    }
  }

  const apiBase = `${target.protocol}//api.${target.hostname.replace(/^www\./, '')}`;
  const routesToProbe = Array.from(discoveredRoutes)
    .filter((route) => route.startsWith('/api/') || route.startsWith('/admin/'))
    .slice(0, 8);

  for (const route of routesToProbe) {
    const absolute = route.startsWith('/api/') ? `${apiBase}${route}` : `${target.origin}${route}`;
    let response: Response | null = null;
    let bodyText = '';
    try {
      response = await fetch(absolute, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'AiVIS.biz-PrivateExposureScan/1.0 (+https://aivis.biz)' },
      });
      bodyText = await response.text();
    } catch {
      continue;
    }

    if (!response) continue;

    const statusCode = response.status;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const parsed = contentType.includes('json') ? tryParseJson(bodyText) : null;

    if (statusCode >= 200 && statusCode < 300 && parsed && typeof parsed === 'object') {
      const keys = new Set<string>();
      collectKeys(parsed, keys);
      const hits = SENSITIVE_KEYWORDS.filter((word) => keys.has(word));
      const looksSensitivePath = /\/api\/(account|profile|users|workspace|billing|admin|notifications)/i.test(route);
      if (looksSensitivePath || hits.length > 0) {
        findings.push({
          family: 'unauth_json_sensitive_shape',
          title: 'Unauthenticated endpoint returns structured JSON on sensitive route family',
          domain: 'route_protection_integrity',
          severity: hits.length >= 2 ? 'critical' : 'high',
          confidence: 'high',
          status: 'confirmed',
          where_found: {
            asset_type: 'api_endpoint',
            location: absolute,
            line_hint: null,
          },
          what_was_observed: `Public GET returned JSON with status ${statusCode} on route discovered from frontend assets.`,
          why_it_matters: 'Sensitive-looking routes should require auth and authorization checks at the server boundary.',
          minimal_redacted_proof: `status=${statusCode}, keys=[${hits.slice(0, 4).join(',') || 'structured_json'}]`,
          fix_path: [
            'Require auth middleware for this route family.',
            'Enforce role and tenant checks server-side for all sensitive resources.',
          ],
          retest_steps: ['Repeat unauthenticated request and verify 401/403 with no sensitive JSON body.'],
          affected_assets: [absolute],
          tags: ['api', 'route_protection', 'auth_boundary'],
        });
      }
    }

    if (statusCode >= 500 && /error|exception|stack|sql|postgres|sequelize|prisma/i.test(bodyText)) {
      findings.push({
        family: 'verbose_server_error',
        title: 'Public route returns verbose server error indicators',
        domain: 'public_data_spill_risk',
        severity: 'medium',
        confidence: 'medium',
        status: 'possible',
        where_found: {
          asset_type: 'api_endpoint',
          location: absolute,
          line_hint: null,
        },
        what_was_observed: `Public route returned ${statusCode} with error-oriented response content.`,
        why_it_matters: 'Verbose errors can leak internals and aid targeted reconnaissance.',
        minimal_redacted_proof: `status=${statusCode}, body~"Internal Server Error"`,
        fix_path: ['Return generic client-facing 5xx messages and keep internal errors in server logs only.'],
        retest_steps: ['Trigger same route condition and verify generic error envelope without internals.'],
        affected_assets: [absolute],
        tags: ['error_handling', 'data_spill', 'public_response'],
      });
    }
  }

  try {
    const preflight = await fetch(`${apiBase}/api/health`, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,Content-Type',
      },
    });

    const acao = preflight.headers.get('access-control-allow-origin') || '';
    const acac = preflight.headers.get('access-control-allow-credentials') || '';

    if (preflight.status >= 500) {
      findings.push({
        family: 'cors_deny_returns_500',
        title: 'CORS deny path returns 500 response',
        domain: 'route_protection_integrity',
        severity: 'medium',
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'api_endpoint',
          location: `${apiBase}/api/health`,
          line_hint: null,
        },
        what_was_observed: 'Disallowed-origin preflight returned a server error status.',
        why_it_matters: 'CORS denials should fail predictably (403/blocked), not as internal server errors.',
        minimal_redacted_proof: `OPTIONS status=${preflight.status}, acao=${acao || '<empty>'}`,
        fix_path: ['Handle disallowed origins with explicit policy response and avoid throwing generic 500 errors.'],
        retest_steps: ['Send preflight from non-allowlisted origin and verify deterministic non-500 deny behavior.'],
        affected_assets: [`${apiBase}/api/health`],
        tags: ['cors', 'route_protection', 'hardening'],
      });
    }

    if (acao === '*' && acac.toLowerCase() === 'true') {
      findings.push({
        family: 'cors_wildcard_credentials',
        title: 'CORS allows wildcard origin with credentials',
        domain: 'route_protection_integrity',
        severity: 'critical',
        confidence: 'high',
        status: 'confirmed',
        where_found: {
          asset_type: 'response_header',
          location: `${apiBase}/api/health`,
          line_hint: null,
        },
        what_was_observed: 'CORS response allowed wildcard origin while credential sharing was enabled.',
        why_it_matters: 'Wildcard + credentials can expose authenticated resources across untrusted origins.',
        minimal_redacted_proof: `Access-Control-Allow-Origin=*, Access-Control-Allow-Credentials=true`,
        fix_path: ['Use strict allowlist CORS policy and never pair wildcard origins with credentialed requests.'],
        retest_steps: ['Send preflight from foreign origin and confirm wildcard is not returned.'],
        affected_assets: [`${apiBase}/api/health`],
        tags: ['cors', 'critical', 'auth_boundary'],
      });
    }
  } catch {
    // CORS probe failure does not create finding by itself
  }

  const scoredFindings = assignEvidenceIds(findings);
  const { domain_scores, exposure_surface_score } = computeScores(scoredFindings);

  const report: PrivateExposureScanReport = {
    scan_type: 'private_exposure_scan',
    scan_version: '1.0.0',
    scope: {
      target_type: args.targetType || 'site',
      target_label: args.targetLabel || target.hostname,
      ownership_asserted: Boolean(args.ownershipAsserted),
      scan_mode: 'passive',
      authenticated_context_provided: Boolean(args.authenticatedContextProvided),
    },
    summary: {
      exposure_surface_score,
      score_band: scoreBand(exposure_surface_score),
      verdict: verdictFromFindings(scoredFindings),
      top_priorities: ensureTopPriorities(scoredFindings),
    },
    domain_scores,
    findings: scoredFindings,
    quick_wins_under_30m: [
      'Disable public source maps in production builds',
      'Set CSP, HSTS, and Referrer-Policy on frontend responses',
      'Avoid token persistence in localStorage for auth sessions',
      'Return generic 5xx envelopes without raw internal error messages',
    ],
    needs_engineering_changes: [
      'Move session handling to HttpOnly cookie-based auth',
      'Standardize server-side authorization checks across sensitive route families',
      'Introduce rescan diffing and stable finding persistence for historical tracking',
    ],
    retest_plan: {
      recommended: scoredFindings.length > 0,
      retest_scope: ['affected assets only', 'headers', 'auth/session flows'],
    },
    history: {
      prior_scan_id: null,
      regressions: [],
      resolved_evidence_ids: [],
    },
  };

  return report;
}
