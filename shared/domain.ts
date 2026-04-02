import type { AnalysisResponse, EvidenceDrivenFixIssue } from "./types.js";

export type AuditStatus = "queued" | "running" | "complete" | "failed";
export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type VerifiedBy = "crawler" | "parser" | "validator" | "system";

export type Evidence = {
  id: string;
  source: string;
  proof: unknown;
  description: string;
  verifiedBy: VerifiedBy;
};

export type Issue = {
  id: string;
  title: string;
  severity: Severity;
  impactScore: number;
  evidenceIds: string[];
  fix: string;
};

export type CompetitorGap = {
  competitor: string;
  advantage: string;
  missingSignal: string;
};

export type AuditReport = {
  id: string;
  domain: string;
  score: number;
  confidence: Confidence;
  blockers: Issue[];
  evidence: Evidence[];
  competitorGaps: CompetitorGap[];
  createdAt: string;
};

function normalizeSeverity(value?: string): Severity {
  if (value === "critical" || value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function confidenceFromScore(score: number): Confidence {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function toAuditReport(result: AnalysisResponse): AuditReport {
  const blockers: Issue[] = (result.evidence_fix_plan?.issues || []).map((issue: EvidenceDrivenFixIssue, index: number) => ({
    id: issue.id || `issue_${index + 1}`,
    title: issue.finding,
    severity: normalizeSeverity(issue.severity),
    impactScore: issue.severity === "critical" ? 0.95 : issue.severity === "high" ? 0.8 : issue.severity === "medium" ? 0.55 : 0.3,
    evidenceIds: issue.evidence_ids || [],
    fix: issue.actual_fix,
  }));

  const evidence: Evidence[] = (result.evidence_fix_plan?.issues || []).map((issue: EvidenceDrivenFixIssue, index: number) => ({
    id: issue.evidence_ids?.[0] || `ev_${index + 1}`,
    source: result.url,
    proof: issue.evidence_excerpt || issue.finding,
    description: issue.finding,
    verifiedBy: "parser",
  }));

  const competitorGaps: CompetitorGap[] = (result.competitor_hint?.match_reasons || []).slice(0, 3).map((reason: string, index: number) => ({
    competitor: `competitor-${index + 1}`,
    advantage: reason,
    missingSignal: "missing source presence",
  }));

  return {
    id: result.audit_id || result.request_id || "audit_report",
    domain: result.url,
    score: result.visibility_score,
    confidence: confidenceFromScore(result.visibility_score),
    blockers,
    evidence,
    competitorGaps,
    createdAt: result.analyzed_at,
  };
}