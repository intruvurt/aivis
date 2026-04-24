import type {
  AuditEvidence,
  AuditFinding,
  AuditFix,
  AuditModuleResult,
  AuditScoreBreakdown,
} from '../../../../shared/types/audit.js';

export interface CloudflareUrlScannerInput {
  url: string;
}

export type CloudflareUrlScannerResult = AuditModuleResult;

/* ── Cloudflare API response shapes (partial) ───────────────────────────── */

interface CfScanTask {
  uuid?: string;
  url?: string;
  time?: string;
  status?: string;
}

interface CfPageLoad {
  /** Total page load time in milliseconds */
  time?: number;
}

interface CfPerformanceMetrics {
  /** First Contentful Paint (ms) */
  fcp?: number;
  /** Largest Contentful Paint (ms) */
  lcp?: number;
  /** Time to Interactive (ms) */
  tti?: number;
  /** Total Blocking Time (ms) */
  tbt?: number;
  /** Cumulative Layout Shift score */
  cls?: number;
  /** Speed Index */
  speedIndex?: number;
}

interface CfVerdicts {
  malicious?: boolean;
  phishing?: boolean;
  spam?: boolean;
  suspicious?: boolean;
  overall?: string;
}

interface CfAccessibilityIssue {
  id?: string;
  description?: string;
  impact?: string;
}

interface CfSeoIssue {
  id?: string;
  description?: string;
}

interface CfScanResult {
  task?: CfScanTask;
  page?: {
    url?: string;
    title?: string;
    mimeType?: string;
    status?: number;
    country?: string;
    server?: string;
    ip?: string;
  };
  performance?: CfPerformanceMetrics;
  pageload?: CfPageLoad;
  verdicts?: CfVerdicts;
  accessibility?: {
    issues?: CfAccessibilityIssue[];
    score?: number;
  };
  seo?: {
    issues?: CfSeoIssue[];
    score?: number;
  };
  certificates?: Array<{
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    subjectName?: string;
  }>;
  meta?: {
    processors?: Record<string, unknown>;
  };
}

interface CfApiResponse {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: CfScanResult;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function penalty(condition: boolean, points: number): number {
  return condition ? points : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/* ── Main export ─────────────────────────────────────────────────────────── */

/**
 * Calls the Cloudflare URL Scanner API and maps the response into the
 * standard AuditModuleResult shape used by all other analysis engines.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN   – Cloudflare API token with url_scanner:write permission
 *   CLOUDFLARE_ACCOUNT_ID  – Cloudflare account ID
 */
export async function analyzeWithCloudflareUrlScanner(
  input: CloudflareUrlScannerInput,
): Promise<CloudflareUrlScannerResult> {
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
    const id = `ev_cf_${evidence.length + 1}`;
    evidence.push({
      id,
      type,
      label,
      pageUrl: input.url,
      observedValue: truncate(observedValue, 500),
      captureTimeUtc: new Date().toISOString(),
      source: 'cloudflare_url_scanner',
      confidence: 0.9,
      ...options,
    });
    return id;
  };

  const addFix = (fix: Omit<AuditFix, 'id'>) => {
    fixes.push({ id: `fix_cf_${fixes.length + 1}`, ...fix });
  };

  /* ── Env-var guard ───────────────────────────────────────────────────── */
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    constraints.push('cloudflare_credentials_not_configured');
    return {
      findings,
      evidence,
      fixes,
      scores: {},
      completeness: 0,
      confidence: 0,
      constraints,
    };
  }

  /* ── API call ────────────────────────────────────────────────────────── */
  let scanResult: CfScanResult;

  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/url_scanner/scan`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: input.url }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      constraints.push(`cloudflare_api_http_error_${response.status}`);
      if (response.status === 401 || response.status === 403) {
        constraints.push('cloudflare_api_auth_failed');
      }
      console.error(
        `[cloudflareUrlScanner] API returned ${response.status}: ${truncate(errorText, 200)}`,
      );
      return { findings, evidence, fixes, scores: {}, completeness: 0, confidence: 0, constraints };
    }

    const json: CfApiResponse = await response.json();

    if (!json.success || !json.result) {
      const errMsg = json.errors?.map((e) => e.message).join('; ') ?? 'unknown error';
      constraints.push('cloudflare_api_unsuccessful');
      console.error(`[cloudflareUrlScanner] API unsuccessful: ${errMsg}`);
      return { findings, evidence, fixes, scores: {}, completeness: 0, confidence: 0, constraints };
    }

    scanResult = json.result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    constraints.push('cloudflare_api_request_failed');
    console.error(`[cloudflareUrlScanner] Request failed: ${message}`);
    return { findings, evidence, fixes, scores: {}, completeness: 0, confidence: 0, constraints };
  }

  /* ── Evidence collection ─────────────────────────────────────────────── */

  // Page load time
  const pageLoadMs = scanResult.pageload?.time ?? scanResult.performance?.tti;
  const pageLoadEv = addEvidence(
    'technical',
    'Page load time (ms)',
    pageLoadMs != null ? String(pageLoadMs) : '(not reported)',
  );

  // Performance metrics
  const perf = scanResult.performance ?? {};
  const perfEv = addEvidence(
    'technical',
    'Core Web Vitals',
    JSON.stringify({
      fcp: perf.fcp,
      lcp: perf.lcp,
      tti: perf.tti,
      tbt: perf.tbt,
      cls: perf.cls,
      speedIndex: perf.speedIndex,
    }),
  );

  // Security verdicts
  const verdicts = scanResult.verdicts ?? {};
  const securityEv = addEvidence(
    'security',
    'Cloudflare security verdicts',
    JSON.stringify({
      malicious: verdicts.malicious,
      phishing: verdicts.phishing,
      spam: verdicts.spam,
      suspicious: verdicts.suspicious,
      overall: verdicts.overall,
    }),
  );

  // Accessibility
  const a11yIssues = scanResult.accessibility?.issues ?? [];
  const a11yScore = scanResult.accessibility?.score;
  const a11yEv = addEvidence(
    'technical',
    'Accessibility issues',
    JSON.stringify({
      count: a11yIssues.length,
      score: a11yScore,
      issues: a11yIssues.slice(0, 10).map((i) => ({ id: i.id, impact: i.impact })),
    }),
  );

  // SEO issues
  const seoIssues = scanResult.seo?.issues ?? [];
  const seoScore = scanResult.seo?.score;
  const seoEv = addEvidence(
    'technical',
    'SEO issues from Cloudflare scan',
    JSON.stringify({
      count: seoIssues.length,
      score: seoScore,
      issues: seoIssues.slice(0, 10).map((i) => ({ id: i.id, description: i.description })),
    }),
  );

  /* ── Findings ────────────────────────────────────────────────────────── */

  // Security: malicious / phishing
  if (verdicts.malicious) {
    findings.push({
      id: 'finding_cf_malicious',
      category: 'Security Exposure',
      title: 'Cloudflare flagged page as malicious',
      description:
        'The Cloudflare URL Scanner returned a malicious verdict for this page. The page may contain malware, drive-by downloads, or other harmful content.',
      severity: 'critical',
      pageUrl: input.url,
      impact:
        'AI systems and browsers may block or demote this page. Users and crawlers are at risk.',
      evidenceIds: [securityEv],
    });
    addFix({
      title: 'Investigate and remediate malicious content immediately',
      priority: 'p1',
      implementationSurface: 'security',
      findingIds: ['finding_cf_malicious'],
      evidenceIds: [securityEv],
      instructions: [
        'Scan the server and all hosted files for malware or injected scripts.',
        'Review recent deployments and third-party scripts for unauthorized changes.',
        'Request a re-scan from Cloudflare after remediation.',
      ],
      expectedOutcome: 'Malicious verdict cleared, page restored to safe status.',
    });
  }

  if (verdicts.phishing) {
    findings.push({
      id: 'finding_cf_phishing',
      category: 'Security Exposure',
      title: 'Cloudflare flagged page as phishing',
      description:
        'The Cloudflare URL Scanner returned a phishing verdict. The page may be impersonating a trusted brand or collecting credentials deceptively.',
      severity: 'critical',
      pageUrl: input.url,
      impact: 'Page will be blocked by browsers and security tools, destroying AI visibility.',
      evidenceIds: [securityEv],
    });
    addFix({
      title: 'Remove phishing indicators and request re-evaluation',
      priority: 'p1',
      implementationSurface: 'security',
      findingIds: ['finding_cf_phishing'],
      evidenceIds: [securityEv],
      instructions: [
        'Audit all forms, login flows, and brand assets for deceptive patterns.',
        'Ensure the page does not impersonate another brand or service.',
        'Submit a dispute to Cloudflare if the verdict is incorrect.',
      ],
      expectedOutcome: 'Phishing verdict cleared, page trust restored.',
    });
  }

  if (verdicts.suspicious && !verdicts.malicious && !verdicts.phishing) {
    findings.push({
      id: 'finding_cf_suspicious',
      category: 'Security Exposure',
      title: 'Cloudflare flagged page as suspicious',
      description:
        'The Cloudflare URL Scanner returned a suspicious verdict. The page exhibits signals that may indicate unwanted or risky behaviour.',
      severity: 'high',
      pageUrl: input.url,
      impact: 'May reduce trust signals and AI citation likelihood.',
      evidenceIds: [securityEv],
    });
  }

  // Performance: slow page load
  if (pageLoadMs != null && pageLoadMs > 5000) {
    findings.push({
      id: 'finding_cf_slow_page_load',
      category: 'Performance',
      title: 'Slow page load time detected by Cloudflare',
      description: `Cloudflare measured a page load time of ${pageLoadMs}ms, which exceeds the 5 000ms threshold for good user and crawler experience.`,
      severity: pageLoadMs > 10_000 ? 'high' : 'medium',
      pageUrl: input.url,
      impact: 'Slow pages are deprioritised by crawlers and may score lower in AI retrieval pipelines.',
      evidenceIds: [pageLoadEv, perfEv],
    });
    addFix({
      title: 'Reduce page load time below 3 000ms',
      priority: 'p2',
      implementationSurface: 'performance',
      findingIds: ['finding_cf_slow_page_load'],
      evidenceIds: [pageLoadEv, perfEv],
      instructions: [
        'Audit and defer non-critical JavaScript and CSS.',
        'Enable Cloudflare caching and compression for static assets.',
        'Optimise images with modern formats (WebP/AVIF) and lazy loading.',
        'Consider a CDN edge cache for HTML responses.',
      ],
      expectedOutcome: 'Page load time reduced, improving crawl efficiency and user experience.',
    });
  }

  // Performance: poor LCP
  if (perf.lcp != null && perf.lcp > 4000) {
    findings.push({
      id: 'finding_cf_poor_lcp',
      category: 'Performance',
      title: 'Poor Largest Contentful Paint (LCP)',
      description: `LCP is ${perf.lcp}ms. Google's "good" threshold is under 2 500ms; above 4 000ms is considered poor.`,
      severity: 'medium',
      pageUrl: input.url,
      impact: 'Poor LCP correlates with lower Core Web Vitals scores and reduced ranking signals.',
      evidenceIds: [perfEv],
    });
  }

  // Performance: high CLS
  if (perf.cls != null && perf.cls > 0.25) {
    findings.push({
      id: 'finding_cf_high_cls',
      category: 'Performance',
      title: 'High Cumulative Layout Shift (CLS)',
      description: `CLS score is ${perf.cls}. Google's "good" threshold is under 0.1; above 0.25 is considered poor.`,
      severity: 'medium',
      pageUrl: input.url,
      impact: 'Layout instability degrades user experience and Core Web Vitals scores.',
      evidenceIds: [perfEv],
    });
  }

  // Accessibility issues
  const criticalA11y = a11yIssues.filter((i) => i.impact === 'critical' || i.impact === 'serious');
  if (criticalA11y.length > 0) {
    findings.push({
      id: 'finding_cf_accessibility_issues',
      category: 'Accessibility Surface',
      title: `${criticalA11y.length} critical/serious accessibility issue${criticalA11y.length > 1 ? 's' : ''} detected`,
      description:
        'Cloudflare URL Scanner identified critical or serious accessibility violations that may prevent assistive technologies from interpreting the page.',
      severity: criticalA11y.length > 3 ? 'high' : 'medium',
      pageUrl: input.url,
      impact: 'Accessibility failures reduce the page\'s usability for screen readers and may lower AI interpretability.',
      evidenceIds: [a11yEv],
    });
    addFix({
      title: 'Resolve critical accessibility violations',
      priority: 'p2',
      implementationSurface: 'accessibility',
      findingIds: ['finding_cf_accessibility_issues'],
      evidenceIds: [a11yEv],
      instructions: [
        'Run an axe-core or Lighthouse accessibility audit to enumerate all violations.',
        'Prioritise critical and serious issues: missing ARIA labels, insufficient colour contrast, keyboard traps.',
        'Validate fixes with a screen reader before re-deploying.',
      ],
      expectedOutcome: 'Improved accessibility score and broader interpretability for assistive and AI systems.',
    });
  } else if (a11yIssues.length > 5) {
    findings.push({
      id: 'finding_cf_minor_accessibility_issues',
      category: 'Accessibility Surface',
      title: `${a11yIssues.length} minor accessibility issues detected`,
      description:
        'Cloudflare URL Scanner found multiple minor accessibility issues that, while not critical, reduce overall page quality.',
      severity: 'low',
      pageUrl: input.url,
      impact: 'Accumulated minor issues can compound into a meaningful accessibility gap.',
      evidenceIds: [a11yEv],
    });
  }

  // SEO issues from Cloudflare
  if (seoIssues.length > 0) {
    findings.push({
      id: 'finding_cf_seo_issues',
      category: 'Extractability',
      title: `${seoIssues.length} SEO issue${seoIssues.length > 1 ? 's' : ''} detected by Cloudflare scan`,
      description:
        'The Cloudflare URL Scanner identified SEO-related issues that may reduce the page\'s discoverability and extractability.',
      severity: seoIssues.length > 5 ? 'medium' : 'low',
      pageUrl: input.url,
      impact: 'SEO issues reduce crawl efficiency and weaken signals used by AI retrieval systems.',
      evidenceIds: [seoEv],
    });
  }

  /* ── Score calculation ───────────────────────────────────────────────── */

  const isMalicious = verdicts.malicious ?? false;
  const isPhishing = verdicts.phishing ?? false;
  const isSuspicious = verdicts.suspicious ?? false;

  const cfSecurityScore = clampScore(
    100 -
      penalty(isMalicious, 80) -
      penalty(isPhishing, 80) -
      penalty(isSuspicious && !isMalicious && !isPhishing, 30),
  );

  const cfPerformanceScore = clampScore(
    100 -
      penalty(pageLoadMs != null && pageLoadMs > 10_000, 40) -
      penalty(pageLoadMs != null && pageLoadMs > 5_000 && pageLoadMs <= 10_000, 20) -
      penalty(perf.lcp != null && perf.lcp > 4_000, 20) -
      penalty(perf.cls != null && perf.cls > 0.25, 15),
  );

  const cfAccessibilityScore = clampScore(
    a11yScore != null
      ? a11yScore
      : 100 -
          penalty(criticalA11y.length > 0, Math.min(50, criticalA11y.length * 12)) -
          penalty(a11yIssues.length > 5, 10),
  );

  const completeness = clampScore(
    100 -
      penalty(!scanResult.verdicts, 20) -
      penalty(!scanResult.performance, 20) -
      penalty(!scanResult.accessibility, 20) -
      penalty(!scanResult.seo, 20),
  );

  const confidence = clampScore(
    90 -
      penalty(isMalicious || isPhishing, 10) -
      penalty(!scanResult.performance, 10),
  );

  return {
    findings,
    evidence,
    fixes,
    scores: {
      cfSecurityScore,
      cfPerformanceScore,
      cfAccessibilityScore,
    } as Partial<AuditScoreBreakdown>,
    completeness,
    confidence,
    constraints,
  };
}
