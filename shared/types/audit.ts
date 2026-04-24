/**
 * Audit-related types
 */

export interface Audit {
  id: string;
  user_id: string;
  url: string;
  status: AuditStatus;
  visibility_score: number | null;
  result: AuditResult | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type AuditStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AuditResult {
  visibility_score: number;
  ai_platform_scores: Record<string, number>;
  recommendations: AuditRecommendation[];
  summary: string;
}

export interface AuditRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  impact: string;
}

export interface AuditRequest {
  url: string;
  force_refresh?: boolean;
}

export interface AuditListParams {
  page?: number;
  page_size?: number;
  status?: AuditStatus;
}

/* ── Audit module types ─────────────────────────────────────────────────── */

export interface AuditEvidence {
  id: string;
  type: string;
  label: string;
  pageUrl: string;
  observedValue: string;
  captureTimeUtc: string;
  source: string;
  confidence: number;
  locator?: string;
  expectedValue?: string;
  snippet?: string;
}

export interface AuditFinding {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  pageUrl?: string;
  impact?: string;
  evidenceIds: string[];
}

export interface AuditFix {
  id: string;
  title: string;
  priority: string;
  implementationSurface?: string;
  findingIds: string[];
  evidenceIds: string[];
  instructions: string[];
  expectedOutcome?: string;
}

export interface AuditScoreBreakdown {
  source: number;
  signal: number;
  fact: number;
  relationship: number;
  overall: number;
  interpretability?: number;
  extractability?: number;
  structuralClarity?: number;
  evidenceAvailability?: number;
  freshnessIntegrity?: number;
  trustEntityClarity?: number;
  technicalIntegrity?: number;
  accessibilitySurface?: number;
  securityExposure?: number;
  /** Cloudflare URL Scanner: security verdict score (0–100) */
  cfSecurityScore?: number;
  /** Cloudflare URL Scanner: performance / Core Web Vitals score (0–100) */
  cfPerformanceScore?: number;
  /** Cloudflare URL Scanner: accessibility score (0–100) */
  cfAccessibilityScore?: number;
}

export interface AuditModuleResult {
  findings: AuditFinding[];
  evidence: AuditEvidence[];
  fixes: AuditFix[];
  scores: Partial<AuditScoreBreakdown>;
  completeness: number;
  confidence: number;
  constraints: string[];
}