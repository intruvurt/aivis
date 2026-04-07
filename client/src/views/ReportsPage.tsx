// client/src/views/ReportsPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  Eye,
  Trash2,
  Share2,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  X,
  ExternalLink,
  Loader2,
  Check,
  Search,
  ArrowUpDown,
  Briefcase,
  Building2,
  TrendingUp,
  Wand2,
  ChevronRight,
} from "lucide-react";
import PlatformProofLoopCard from "../components/PlatformProofLoopCard";
import type { AnalysisResponse } from "@shared/types";
import { meetsMinimumTier } from "@shared/types";

import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import { useSettingsStore } from "../stores/settingsStore";
import UpgradeWall from "../components/UpgradeWall";
import FeatureInstruction, { ButtonTooltip, InfoTip } from "../components/FeatureInstruction";
import { API_URL, PUBLIC_APP_ORIGIN } from "../config";
import apiFetch from "../utils/api";
import { usePageMeta } from "../hooks/usePageMeta";

interface Report {
  id: string;
  auditId?: string;
  name: string;
  url: string;
  score: number;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  type: "full" | "quick";
  // keep a stable pointer to the history entry
  timestamp: number;
  summary?: string;
  seoSummary?: { pass: number; warn: number; fail: number };
}

interface ApiAudit {
  id: string;
  url: string;
  visibility_score: number | string;
  summary?: string;
  seo_diagnostics?: Record<string, { status?: 'pass' | 'warn' | 'fail' }>;
  created_at: string;
}

interface FixpackQueueItem {
  reportId: string;
  auditId?: string;
  url: string;
  createdAt: string;
  score: number;
  reliabilityIndex: number;
  passRate: number;
  fixpackId: string;
  fixpackLabel: string;
  expectedLiftMin: number;
  expectedLiftMax: number;
  targetGateIds: string[];
}

const PAGE_USE_CASES = [
  {
    icon: Briefcase,
    title: "Manage audits",
    detail: "Use this page to manage active client audits, export evidence, and prep review-ready snapshots before strategy calls.",
  },
  {
    icon: Building2,
    title: "Track performance",
    detail: "Use report history to show leadership score movement, operational proof, and where remediation is still required.",
  },
  {
    icon: TrendingUp,
    title: "Progress",
    detail: "Consolidate repeated scans by URL to see whether the account is improving over time instead of reading isolated audits.",
  },
];

type ShareState =
  | { open: false }
  | {
      open: true;
      report: Report;
      link: string;
      copied: boolean;
      copyError?: boolean;
      redacted?: boolean;
      scanLabel?: string;
      expiresAt?: string;
      expirationDays?: number;
    };

function resolvePublicShareUrl(sharePath?: string, token?: string): string {
  const baseOrigin =
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : PUBLIC_APP_ORIGIN
    ).replace(/\/$/, "");

  const fallbackPath = token ? `/report/public/${token}` : "/reports/public";
  const rawPath = String(sharePath || fallbackPath).trim();
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return `${baseOrigin}${normalizedPath}`;
}

async function writeClipboardWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand fallback
    }
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

function formatShareExpiryLabel(expiresAt?: string): string {
  if (!expiresAt) return 'Expires based on your configured share-link policy.';
  const dt = new Date(expiresAt);
  if (Number.isNaN(dt.getTime())) return 'Expires based on your configured share-link policy.';
  const diffMs = dt.getTime() - Date.now();
  if (diffMs > 60 * 60 * 24 * 365 * 5 * 1000) return 'Expiration: never (long-lived public snapshot link).';
  if (diffMs <= 0) return `Expired: ${dt.toLocaleString()}`;
  return `Expires: ${dt.toLocaleString()}`;
}

function filenameSafe(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeReportUrl(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  return trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
}

function buildReportTargetKey(input: string | null | undefined): string {
  if (!input) return "";
  const raw = input.trim();
  if (!raw) return "";
  if (raw.startsWith("upload://")) return raw.toLowerCase();

  const normalized = normalizeReportUrl(raw);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return normalized.toLowerCase();
  }
}

function formatScanLabel(scanNumber: number): string {
  return `Audit #${Math.max(1, scanNumber)}`;
}

function formatDelta(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, isAuthenticated, refreshUser, logout, user } = useAuthStore();
  const { history, removeFromHistory } = useAnalysisStore();

  // Read ?audit=<id> param from notification deep-links
  const highlightAuditId = searchParams.get("audit") || undefined;

  usePageMeta({
    title: 'Reports',
    description: 'View, download, and share your AI visibility audit reports. Access your full analysis history.',
    path: '/reports',
  });

  const hasAccess = meetsMinimumTier((user?.tier as any) || 'observer', 'alignment');

  const [filter, setFilter] = useState<"all" | "completed" | "processing">("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pdfExportingId, setPdfExportingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "score-desc" | "score-asc">("newest");
  const [scoreRange, setScoreRange] = useState<"all" | "critical" | "low" | "medium" | "high">("all");
  const [consolidateByUrl, setConsolidateByUrl] = useState(true);
  const [share, setShare] = useState<ShareState>({ open: false });
  const [shareExpiryDays, setShareExpiryDays] = useState<number>(30);
  const [apiAudits, setApiAudits] = useState<ApiAudit[]>([]);
  const [apiAuditsTotal, setApiAuditsTotal] = useState<number | null>(null);
  const [auditResultsByAuditId, setAuditResultsByAuditId] = useState<Record<string, AnalysisResponse | null>>({});
  // fixpack_status keyed by `${auditId}:${fixpackId}` → 'open' | 'in-progress' | 'validated'
  const [fixpackStatuses, setFixpackStatuses] = useState<Record<string, string>>({});
  const fixpackFetchedAuditIds = useRef(new Set<string>());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [compareTargetKey, setCompareTargetKey] = useState("");
  const [baselineReportId, setBaselineReportId] = useState("");
  const [comparisonReportId, setComparisonReportId] = useState("");

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated && token) {
      refreshUser().then((success) => {
        if (!success) {
          logout();
          navigate("/auth?mode=signin");
        }
      });
      return;
    }

    if (!isAuthenticated && !token) {
      navigate("/auth?mode=signin");
    }
  }, [isAuthenticated, token, refreshUser, logout, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !hasAccess) return;

    let cancelled = false;

    const fetchAudits = async () => {
      try {
        const response = await apiFetch(`${API_URL}/api/audits?limit=100`);
        if (!response.ok) return;

        const payload = (await response.json().catch(() => null)) as { audits?: ApiAudit[]; total?: number } | null;
        const audits = Array.isArray(payload?.audits) ? payload!.audits : [];
        if (!cancelled) {
          setApiAudits(audits);
          setApiAuditsTotal(Number.isFinite(Number(payload?.total)) ? Number(payload?.total) : audits.length);
        }
      } catch {
        if (!cancelled) {
          setApiAudits([]);
          setApiAuditsTotal(null);
        }
      }
    };

    fetchAudits();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hasAccess]);

  const localReports: Report[] = useMemo(() => {
    return history.filter((entry) => entry?.url).map((entry, idx) => {
      const domain = (() => {
        try {
          return entry.url ? new URL(entry.url).hostname : "Unknown";
        } catch {
          return entry.url || "Unknown";
        }
      })();

      const score = entry?.result?.visibility_score ?? 0;
      const createdAt = entry?.result?.analyzed_at || new Date(entry.timestamp).toISOString();
      const seo = entry?.result?.seo_diagnostics as unknown as Record<string, { status?: 'pass' | 'warn' | 'fail' }> | undefined;
      const seoSummary: Report['seoSummary'] = seo && typeof seo === 'object'
        ? Object.values(seo).reduce(
            (acc: { pass: number; warn: number; fail: number }, item: any) => {
              if (item?.status === 'pass') acc.pass += 1;
              else if (item?.status === 'warn') acc.warn += 1;
              else if (item?.status === 'fail') acc.fail += 1;
              return acc;
            },
            { pass: 0, warn: 0, fail: 0 }
          )
        : undefined;

      return {
        id: `analysis_${idx}_${entry.timestamp}`,
        auditId: entry.result?.audit_id,
        name: `${domain} Analysis`,
        url: entry.url || "",
        score,
        createdAt,
        status: "completed",
        type: "full",
        timestamp: entry.timestamp,
        summary: entry?.result?.summary,
        seoSummary,
      };
    });
  }, [history]);

  const remoteReports: Report[] = useMemo(() => {
    return apiAudits.filter((audit) => audit?.url).map((audit, idx) => {
      const domain = (() => {
        try {
          return audit.url ? new URL(audit.url).hostname : "Unknown";
        } catch {
          return audit.url || "Unknown";
        }
      })();

      const score = Number(audit.visibility_score || 0);
      const createdAt = audit.created_at || new Date().toISOString();
      const timestamp = new Date(createdAt).getTime() || Date.now() - idx;
      const seo = audit.seo_diagnostics;
      const seoSummary: Report['seoSummary'] = seo && typeof seo === 'object'
        ? Object.values(seo).reduce(
            (acc: { pass: number; warn: number; fail: number }, item: any) => {
              if (item?.status === 'pass') acc.pass += 1;
              else if (item?.status === 'warn') acc.warn += 1;
              else if (item?.status === 'fail') acc.fail += 1;
              return acc;
            },
            { pass: 0, warn: 0, fail: 0 }
          )
        : undefined;

      return {
        id: `audit_${audit.id}`,
        auditId: audit.id,
        name: `${domain} Analysis`,
        url: audit.url || "",
        score,
        createdAt,
        status: "completed",
        type: "full",
        timestamp,
        summary: audit.summary,
        seoSummary,
      };
    });
  }, [apiAudits]);

  // History merge contract:
  // - remoteReports (/api/audits) are canonical server truth and are always preferred.
  // - localReports (useAnalysisStore().history) are local-only client memory; they fill
  //   gaps where the server snapshot doesn't exist yet (e.g. immediately after a new scan).
  // - Dedup key: normalized target URL + exact ISO timestamp. When both exist for the same
  //   audit, the server snapshot wins and the local entry is dropped.
  const reports: Report[] = useMemo(() => {
    const merged = [...remoteReports];
    const seen = new Set(
      remoteReports.map((report) => `${buildReportTargetKey(report.url)}|${new Date(report.createdAt).toISOString()}`)
    );

    for (const report of localReports) {
      const key = `${buildReportTargetKey(report.url)}|${new Date(report.createdAt).toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(report);
    }

    return merged;
  }, [remoteReports, localReports]);

  useEffect(() => {
    if (!isAuthenticated || !hasAccess) return;

    const candidateAuditIds = reports
      .filter((report) => report.status === "completed" && report.auditId)
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 12)
      .map((report) => String(report.auditId));

    const missingAuditIds = candidateAuditIds.filter((auditId) => !(auditId in auditResultsByAuditId));
    if (missingAuditIds.length === 0) return;

    let cancelled = false;

    const fetchAuditDetails = async () => {
      const entries = await Promise.all(
        missingAuditIds.map(async (auditId) => {
          try {
            const response = await apiFetch(`${API_URL}/api/audits/${auditId}`);
            if (!response.ok) return [auditId, null] as const;

            const payload = (await response.json().catch(() => null)) as { audit?: any; result?: any } | null;
            const audit = payload?.audit ?? payload;
            const parsedResult = typeof audit?.result === "string"
              ? (() => {
                  try {
                    return JSON.parse(audit.result) as AnalysisResponse;
                  } catch {
                    return null;
                  }
                })()
              : (audit?.result as AnalysisResponse | null);

            return [auditId, parsedResult && typeof parsedResult === "object" ? parsedResult : null] as const;
          } catch {
            return [auditId, null] as const;
          }
        })
      );

      if (cancelled) return;
      setAuditResultsByAuditId((current) => {
        const next = { ...current };
        entries.forEach(([auditId, result]) => {
          next[auditId] = result;
        });
        return next;
      });
    };

    fetchAuditDetails();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hasAccess, reports, auditResultsByAuditId]);

  // Auto-scroll to a specific audit when navigating from notification deep-link
  const scrolledToHighlightRef = useRef(false);
  useEffect(() => {
    if (!highlightAuditId || scrolledToHighlightRef.current) return;
    const el = document.getElementById(`report-${highlightAuditId}`);
    if (el) {
      scrolledToHighlightRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-400/60");
      setTimeout(() => el.classList.remove("ring-2", "ring-emerald-400/60"), 4000);
      // Clean up the query param so refreshing doesn't re-highlight
      searchParams.delete("audit");
      setSearchParams(searchParams, { replace: true });
    }
  }, [highlightAuditId, reports, searchParams, setSearchParams]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reports.filter((r) => {
      if (filter === "all") return true;
      return r.status === filter;
    }).filter((r) => {
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
    }).filter((r) => {
      if (scoreRange === "all") return true;
      const s = r.score ?? 0;
      if (scoreRange === "critical") return s >= 0 && s < 25;
      if (scoreRange === "low") return s >= 25 && s < 50;
      if (scoreRange === "medium") return s >= 50 && s < 75;
      return s >= 75; // "high"
    });

    return list.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "score-desc") return (b.score || 0) - (a.score || 0);
      return (a.score || 0) - (b.score || 0);
    });
  }, [reports, filter, searchQuery, sortBy, scoreRange]);

  const consolidatedMetaByReportId = useMemo(() => {
    const metadata: Record<string, { scanCount: number }> = {};

    if (!consolidateByUrl) {
      filteredReports.forEach((report) => {
        metadata[report.id] = { scanCount: 1 };
      });
      return metadata;
    }

    const countsByTarget = new Map<string, number>();
    filteredReports.forEach((report) => {
      const key = buildReportTargetKey(report.url);
      countsByTarget.set(key, (countsByTarget.get(key) || 0) + 1);
    });

    filteredReports.forEach((report) => {
      const key = buildReportTargetKey(report.url);
      metadata[report.id] = { scanCount: countsByTarget.get(key) || 1 };
    });

    return metadata;
  }, [filteredReports, consolidateByUrl]);

  const displayedReports = useMemo(() => {
    if (!consolidateByUrl) return filteredReports;

    const grouped = new Map<string, Report>();
    filteredReports.forEach((report) => {
      const key = buildReportTargetKey(report.url);
      if (!grouped.has(key)) {
        grouped.set(key, report);
      }
    });

    return Array.from(grouped.values());
  }, [filteredReports, consolidateByUrl]);

  const compareTargets = useMemo(() => {
    const grouped = new Map<string, Report[]>();

    reports.forEach((report) => {
      if (report.status !== "completed") return;
      const key = buildReportTargetKey(report.url);
      const current = grouped.get(key) || [];
      current.push(report);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .map(([key, targetReports]) => {
        const sorted = [...targetReports].sort((left, right) => left.timestamp - right.timestamp);
        return {
          key,
          url: sorted[0]?.url || "",
          reports: sorted,
        };
      })
      .filter((group) => group.reports.length >= 2)
      .sort((left, right) => {
        const leftLatest = left.reports[left.reports.length - 1]?.timestamp || 0;
        const rightLatest = right.reports[right.reports.length - 1]?.timestamp || 0;
        return rightLatest - leftLatest;
      });
  }, [reports]);

  useEffect(() => {
    if (compareTargets.length === 0) {
      setCompareTargetKey("");
      setBaselineReportId("");
      setComparisonReportId("");
      return;
    }

    const hasActiveTarget = compareTargets.some((target) => target.key === compareTargetKey);
    if (!hasActiveTarget) {
      setCompareTargetKey(compareTargets[0].key);
    }
  }, [compareTargets, compareTargetKey]);

  const activeCompareTarget = useMemo(() => {
    return compareTargets.find((target) => target.key === compareTargetKey) || null;
  }, [compareTargets, compareTargetKey]);

  useEffect(() => {
    if (!activeCompareTarget) {
      setBaselineReportId("");
      setComparisonReportId("");
      return;
    }

    const reportsForTarget = activeCompareTarget.reports;
    const oldest = reportsForTarget[0];
    const newest = reportsForTarget[reportsForTarget.length - 1];

    setBaselineReportId((current) => {
      if (current && reportsForTarget.some((report) => report.id === current)) {
        return current;
      }
      return oldest?.id || "";
    });

    setComparisonReportId((current) => {
      if (
        current &&
        reportsForTarget.some((report) => report.id === current) &&
        current !== oldest?.id
      ) {
        return current;
      }
      return newest?.id || "";
    });
  }, [activeCompareTarget]);

  useEffect(() => {
    if (!activeCompareTarget) return;
    if (!baselineReportId || !comparisonReportId) return;
    if (baselineReportId !== comparisonReportId) return;

    const alternate = activeCompareTarget.reports.find((report) => report.id !== baselineReportId);
    if (alternate) {
      setComparisonReportId(alternate.id);
    }
  }, [activeCompareTarget, baselineReportId, comparisonReportId]);

  const compareReportOptions = useMemo(() => {
    if (!activeCompareTarget) return [] as Report[];
    return [...activeCompareTarget.reports].sort((left, right) => right.timestamp - left.timestamp);
  }, [activeCompareTarget]);

  const baselineReport = useMemo(() => {
    if (!baselineReportId) return null;
    return compareReportOptions.find((report) => report.id === baselineReportId) || null;
  }, [compareReportOptions, baselineReportId]);

  const comparisonReport = useMemo(() => {
    if (!comparisonReportId) return null;
    return compareReportOptions.find((report) => report.id === comparisonReportId) || null;
  }, [compareReportOptions, comparisonReportId]);

  const comparisonInsights = useMemo(() => {
    if (!baselineReport || !comparisonReport) return null;

    const scoreDelta = (Number(comparisonReport.score) || 0) - (Number(baselineReport.score) || 0);
    const baselineSeo = baselineReport.seoSummary || { pass: 0, warn: 0, fail: 0 };
    const comparisonSeo = comparisonReport.seoSummary || { pass: 0, warn: 0, fail: 0 };
    const passDelta = comparisonSeo.pass - baselineSeo.pass;
    const warnDelta = comparisonSeo.warn - baselineSeo.warn;
    const failDelta = comparisonSeo.fail - baselineSeo.fail;
    const elapsedMs = new Date(comparisonReport.createdAt).getTime() - new Date(baselineReport.createdAt).getTime();
    const elapsedDays = Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs / (1000 * 60 * 60 * 24))) : 0;

    const positiveSignals: string[] = [];
    const riskSignals: string[] = [];

    if (scoreDelta > 0) {
      positiveSignals.push(`Visibility score improved by ${scoreDelta} points.`);
    } else if (scoreDelta < 0) {
      riskSignals.push(`Visibility score dropped by ${Math.abs(scoreDelta)} points.`);
    }

    if (passDelta > 0) {
      positiveSignals.push(`Pass checks increased by ${passDelta}, indicating cleaner implementation coverage.`);
    } else if (passDelta < 0) {
      riskSignals.push(`Pass checks decreased by ${Math.abs(passDelta)}, suggesting regression in core signals.`);
    }

    if (warnDelta < 0) {
      positiveSignals.push(`Warning checks reduced by ${Math.abs(warnDelta)}, showing fewer unresolved edge issues.`);
    } else if (warnDelta > 0) {
      riskSignals.push(`Warning checks increased by ${warnDelta}, which can suppress answer quality.`);
    }

    if (failDelta < 0) {
      positiveSignals.push(`Fail checks dropped by ${Math.abs(failDelta)}, reducing hard blockers to citation trust.`);
    } else if (failDelta > 0) {
      riskSignals.push(`Fail checks increased by ${failDelta}, adding new blockers that likely impacted score.`);
    }

    if (positiveSignals.length === 0 && riskSignals.length === 0) {
      positiveSignals.push("Score stayed flat with no material SEO diagnostic movement detected.");
    }

    // Gate-level delta - only populated when both audits have strict_rubric loaded
    const baselineResult = baselineReport.auditId ? auditResultsByAuditId[baselineReport.auditId] : null;
    const comparisonResult = comparisonReport.auditId ? auditResultsByAuditId[comparisonReport.auditId] : null;
    type GateDiffRow = {
      id: string;
      label: string;
      baselineScore: number;
      comparisonScore: number;
      delta: number;
      baselineStatus: string;
      comparisonStatus: string;
    };
    const gateDiff: GateDiffRow[] = [];
    if (baselineResult?.strict_rubric?.gates && comparisonResult?.strict_rubric?.gates) {
      const comparisonGateMap = new Map(
        comparisonResult.strict_rubric.gates.map((g) => [g.id, g])
      );
      for (const bg of baselineResult.strict_rubric.gates) {
        const cg = comparisonGateMap.get(bg.id);
        if (!cg) continue;
        gateDiff.push({
          id: bg.id,
          label: bg.label,
          baselineScore: bg.score_0_100,
          comparisonScore: cg.score_0_100,
          delta: cg.score_0_100 - bg.score_0_100,
          baselineStatus: bg.status,
          comparisonStatus: cg.status,
        });
      }
      gateDiff.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    }

    return {
      scoreDelta,
      passDelta,
      warnDelta,
      failDelta,
      elapsedDays,
      positiveSignals,
      riskSignals,
      gateDiff,
    };
  }, [baselineReport, comparisonReport, auditResultsByAuditId]);

  const totalCompleted = useMemo(() => reports.filter((r) => r.status === "completed"), [reports]);
  const canonicalCompletedCount = useMemo(
    () => Math.max(totalCompleted.length, Number.isFinite(Number(apiAuditsTotal)) ? Number(apiAuditsTotal) : 0),
    [totalCompleted.length, apiAuditsTotal]
  );

  const averageScore = useMemo(() => {
    if (!totalCompleted.length) return 0;
    return Math.round(totalCompleted.reduce((sum, report) => sum + (Number(report.score) || 0), 0) / totalCompleted.length);
  }, [totalCompleted]);

  const bestScore = useMemo(() => {
    if (!totalCompleted.length) return 0;
    return Math.max(...totalCompleted.map((report) => Number(report.score) || 0));
  }, [totalCompleted]);

  const latestMomentum = useMemo(() => {
    if (totalCompleted.length < 2) return 0;
    const ordered = [...totalCompleted].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return (Number(ordered[0]?.score) || 0) - (Number(ordered[1]?.score) || 0);
  }, [totalCompleted]);

  const opsQueue = useMemo(() => {
    const historyResultByTimestamp = new Map<number, AnalysisResponse>();
    history.forEach((entry) => {
      if (entry?.result && typeof entry.result === "object") {
        historyResultByTimestamp.set(entry.timestamp, entry.result as AnalysisResponse);
      }
    });

    const queueItems: FixpackQueueItem[] = [];

    reports.forEach((report) => {
      const result = report.auditId
        ? auditResultsByAuditId[String(report.auditId)]
        : historyResultByTimestamp.get(report.timestamp);
      const strictRubric = result?.strict_rubric;
      if (!strictRubric || !Array.isArray(strictRubric.required_fixpacks) || strictRubric.required_fixpacks.length === 0) {
        return;
      }

      strictRubric.required_fixpacks.forEach((fixpack) => {
        queueItems.push({
          reportId: report.id,
          auditId: report.auditId,
          url: report.url,
          createdAt: report.createdAt,
          score: Number(report.score) || 0,
          reliabilityIndex: Number(strictRubric.reliability_index_0_100) || 0,
          passRate: Number(strictRubric.pass_rate) || 0,
          fixpackId: fixpack.id,
          fixpackLabel: fixpack.label,
          expectedLiftMin: Number(fixpack.estimated_score_lift_min) || 0,
          expectedLiftMax: Number(fixpack.estimated_score_lift_max) || 0,
          targetGateIds: Array.isArray(fixpack.target_gate_ids) ? fixpack.target_gate_ids : [],
        });
      });
    });

    return queueItems
      .sort((left, right) => {
        if (right.expectedLiftMax !== left.expectedLiftMax) return right.expectedLiftMax - left.expectedLiftMax;
        if (left.reliabilityIndex !== right.reliabilityIndex) return left.reliabilityIndex - right.reliabilityIndex;
        if (left.score !== right.score) return left.score - right.score;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 8);
  }, [reports, history, auditResultsByAuditId]);

  // Load persisted fixpack statuses from server for all remote audits in the ops queue
  useEffect(() => {
    if (!isAuthenticated) return;
    const auditIds = opsQueue
      .map((item) => item.auditId)
      .filter((id): id is string => Boolean(id) && !fixpackFetchedAuditIds.current.has(id));

    if (auditIds.length === 0) return;
    auditIds.forEach((id) => fixpackFetchedAuditIds.current.add(id));

    let cancelled = false;
    const fetchStatuses = async () => {
      const results = await Promise.all(
        auditIds.map(async (auditId) => {
          try {
            const response = await apiFetch(`${API_URL}/api/audits/${auditId}/fixpacks`);
            if (!response.ok) return null;
            const payload = (await response.json().catch(() => null)) as { fixpacks?: Array<{ fixpack_id: string; status: string }> } | null;
            return { auditId, fixpacks: payload?.fixpacks ?? [] };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setFixpackStatuses((current) => {
        const next = { ...current };
        results.forEach((r) => {
          if (!r) return;
          r.fixpacks.forEach(({ fixpack_id, status }) => {
            next[`${r.auditId}:${fixpack_id}`] = status;
          });
        });
        return next;
      });
    };
    fetchStatuses();
    return () => { cancelled = true; };
  }, [isAuthenticated, opsQueue]);

  const cycleFixpackStatus = useCallback(async (auditId: string, fixpackId: string) => {
    const key = `${auditId}:${fixpackId}`;
    const current = fixpackStatuses[key] || 'open';
    const next = current === 'open' ? 'in-progress' : current === 'in-progress' ? 'validated' : 'open';
    setFixpackStatuses((prev) => ({ ...prev, [key]: next }));
    try {
      await apiFetch(`${API_URL}/api/audits/${auditId}/fixpacks/${encodeURIComponent(fixpackId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
    } catch {
      // Revert on failure
      setFixpackStatuses((prev) => ({ ...prev, [key]: current }));
    }
  }, [fixpackStatuses]);

  const scanOrdinalByReportId = useMemo(() => {
    const grouped = new Map<string, Report[]>();

    reports.forEach((report) => {
      const key = buildReportTargetKey(report.url);
      const current = grouped.get(key) || [];
      current.push(report);
      grouped.set(key, current);
    });

    const ordinals: Record<string, number> = {};
    grouped.forEach((group) => {
      group
        .sort((left, right) => left.timestamp - right.timestamp)
        .forEach((report, index) => {
          ordinals[report.id] = index + 1;
        });
    });

    return ordinals;
  }, [reports]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-300";
    if (score >= 60) return "text-green-300";
    if (score >= 40) return "text-amber-300";
    if (score >= 20) return "text-orange-300";
    return "text-red-300";
  };

  const getScoreChipClass = (score: number) => {
    if (score >= 80) return "score-chip-excellent";
    if (score >= 60) return "score-chip-good";
    if (score >= 40) return "score-chip-fair";
    if (score >= 20) return "score-chip-weak";
    return "score-chip-critical";
  };

  const getScoreAccentClass = (score: number) => {
    if (score >= 80) return "section-accent-emerald";
    if (score >= 60) return "section-accent-cyan";
    if (score >= 40) return "section-accent-amber";
    if (score >= 20) return "section-accent-orange";
    return "section-accent-rose";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    if (score >= 20) return "Weak";
    return "Critical";
  };

  const getStatusIcon = (status: Report["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-white/80" />;
      case "processing":
        return <Clock className="w-4 h-4 text-white/80 animate-pulse" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-white/80" />;
      default:
        return null;
    }
  };

  const deleteReport = async (report: Report) => {
    const confirmed = window.confirm(
      `Delete this report for ${report.url}? This removes it${report.auditId ? ' from your account history' : ' from local browser history'} and cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(report.id);
    try {
      if (report.auditId) {
        const response = await apiFetch(`${API_URL}/api/audits/${report.auditId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.error || `Failed to delete report (${response.status})`);
        }

        setApiAudits((current) => current.filter((audit) => String(audit.id) !== String(report.auditId)));
      }

      removeFromHistory(report.timestamp);
      toast.success('Report deleted');

      if (share.open && share.report.id === report.id) {
        setShare({ open: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete report';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  function handleDownload(report: Report) {
    if (report.status !== "completed") return;

    setDownloadingId(report.id);

    const buildAndDownload = (payload: {
      url: string;
      analysis: any;
      findability_goals?: any;
      goal_alignment?: any;
    }) => {
      const reportData = {
        report_name: report.name,
        url: payload.url,
        analyzed_at: report.createdAt,
        visibility_score: report.score,
        findability_goals: payload.findability_goals || payload.analysis?.findability_goals || [],
        goal_alignment: payload.goal_alignment || payload.analysis?.goal_alignment || null,
        analysis: payload.analysis,
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: "application/json",
      });

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${filenameSafe(report.name) || "report"}-${new Date(report.timestamp)
        .toISOString()
        .split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success("Report downloaded");
    };

    (async () => {
      try {
        if (report.auditId) {
          const response = await apiFetch(`${API_URL}/api/audits/${report.auditId}`);
          if (!response.ok) {
            throw new Error(`Failed to load report snapshot (${response.status})`);
          }
          const payload = (await response.json().catch(() => null)) as { audit?: any; result?: any; url?: string } | null;
          const audit = payload?.audit ?? payload;
          const analysis =
            typeof audit?.result === 'string'
              ? (() => {
                  try {
                    return JSON.parse(audit.result);
                  } catch {
                    return null;
                  }
                })()
              : audit?.result;

          if (!analysis || typeof analysis !== 'object') {
            throw new Error("Report snapshot is incomplete.");
          }
          buildAndDownload({
            url: audit.url || report.url,
            analysis,
            findability_goals: analysis?.findability_goals,
            goal_alignment: analysis?.goal_alignment,
          });
          return;
        }

        const entry = history.find((e) => e.timestamp === report.timestamp);
        if (!entry?.result) {
          throw new Error("Report data not found. Try re-running the analysis.");
        }

        buildAndDownload({
          url: entry.url,
          analysis: entry.result,
          findability_goals: entry.result?.findability_goals,
          goal_alignment: entry.result?.goal_alignment,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Download failed";
        console.error(e);
        toast.error(msg);
      } finally {
        setDownloadingId(null);
      }
    })();
  }

  async function handlePdfExport(report: Report) {
    if (report.status !== "completed" || !report.auditId) return;
    setPdfExportingId(report.id);
    try {
      // 1. Fetch full audit data
      const auditResp = await apiFetch(`${API_URL}/api/audits/${report.auditId}`);
      if (!auditResp.ok) throw new Error(`Failed to load audit (${auditResp.status})`);
      const payload = await auditResp.json().catch(() => null) as { audit?: any; result?: any } | null;
      const audit = payload?.audit ?? payload;
      const analysis = typeof audit?.result === 'string'
        ? (() => { try { return JSON.parse(audit.result); } catch { return null; } })()
        : audit?.result;
      if (!analysis || typeof analysis !== 'object') throw new Error("Audit data is incomplete");

      // 2. Build minimal HTML for PDF
      const score = Number(analysis.visibility_score ?? report.score) || 0;
      const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#06b6d4' : score >= 40 ? '#f59e0b' : '#ef4444';
      const recs = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:system-ui,sans-serif;background:#fff;color:#1a1a2e;margin:40px;line-height:1.6}
        h1{font-size:22px;margin-bottom:4px} h2{font-size:16px;margin-top:24px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
        .score{font-size:48px;font-weight:800;color:${scoreColor}} .meta{color:#6b7280;font-size:13px}
        .rec{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:8px}
        .rec-title{font-weight:600;font-size:14px} .rec-body{font-size:13px;color:#374151}
        .summary{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0}
        table{width:100%;border-collapse:collapse;margin-top:8px} td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:13px}
        th{font-weight:600;background:#f9fafb}
      </style></head><body>
        <h1>${report.name || report.url}</h1>
        <p class="meta">${report.url} &mdash; ${new Date(report.createdAt).toLocaleDateString()}</p>
        <div class="score">${score}/100</div>
        ${analysis.summary ? `<div class="summary">${String(analysis.summary).replace(/</g,'&lt;')}</div>` : ''}
        <h2>Recommendations (${recs.length})</h2>
        ${recs.map((r: any, i: number) => `<div class="rec"><div class="rec-title">${i + 1}. ${String(r.title || r.recommendation || '').replace(/</g,'&lt;')}</div><div class="rec-body">${String(r.description || r.details || r.reasoning || '').replace(/</g,'&lt;')}</div></div>`).join('')}
        ${analysis.content_analysis ? `<h2>Content Analysis</h2><table><tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Word Count</td><td>${analysis.content_analysis.word_count ?? 'N/A'}</td></tr>
          <tr><td>Headings</td><td>${analysis.content_analysis.heading_count ?? 'N/A'}</td></tr>
          <tr><td>Internal Links</td><td>${analysis.content_analysis.internal_links ?? 'N/A'}</td></tr>
          <tr><td>External Links</td><td>${analysis.content_analysis.external_links ?? 'N/A'}</td></tr></table>` : ''}
        <p class="meta" style="margin-top:32px">Generated by AI Visibility Intelligence Platform &mdash; ${new Date().toISOString().split('T')[0]}</p>
      </body></html>`;

      // 3. Send to PDF endpoint
      const resp = await apiFetch(`${API_URL}/api/features/exports/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, branded: false }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || `PDF generation failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameSafe(report.name) || "report"}-${new Date(report.timestamp).toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF exported");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF export failed";
      toast.error(msg);
    } finally {
      setPdfExportingId(null);
    }
  }

  async function handleShare(report: Report) {
    if (report.status !== "completed") return;

    setSharingId(report.id);
    try {
      const endpointPath = "/api/audits/share-link";
      const endpoints = [endpointPath, `${API_URL}${endpointPath}`].filter(
        (value, index, arr) => arr.indexOf(value) === index
      );

      let payload: {
        token?: string;
        share_path?: string;
        expires_at?: string;
        scan_label?: string;
        scan_ordinal?: number;
        public_view?: { tier?: string; redacted?: boolean };
      } | null = null;
      let lastError = "Could not generate secure public snapshot link.";

      for (const endpoint of endpoints) {
        const response = await apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: report.url,
            analyzedAt: report.createdAt,
            auditId: report.auditId,
            expiration_days: shareExpiryDays,
          }),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          if (response.status === 403) {
            throw new Error("Shareable public links are not enabled for your current plan.");
          }
          lastError = errorPayload?.error || `Failed to create share link (${response.status})`;
          continue;
        }

        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("application/json")) {
          lastError = "Share endpoint returned non-JSON response.";
          continue;
        }

        const parsedPayload = (await response.json().catch(() => null)) as {
          token?: string;
          share_path?: string;
          expires_at?: string;
          scan_label?: string;
          scan_ordinal?: number;
          public_view?: { tier?: string; redacted?: boolean };
        } | null;
        if (!parsedPayload?.token && !parsedPayload?.share_path) {
          lastError = "Share endpoint returned an invalid payload.";
          continue;
        }

        payload = parsedPayload;
        break;
      }

      if (!payload) {
        throw new Error(lastError);
      }

      const shareLink = resolvePublicShareUrl(payload.share_path, payload.token);

      setShare({
        open: true,
        report,
        link: shareLink,
        copied: false,
        copyError: false,
        redacted: Boolean(payload.public_view?.redacted),
        expiresAt: payload.expires_at,
        expirationDays: shareExpiryDays,
        scanLabel:
          payload.scan_label ||
          formatScanLabel(Math.max(1, payload.scan_ordinal || scanOrdinalByReportId[report.id] || 1)),
      });
      const expiryLabel = formatShareExpiryLabel(payload.expires_at);
      toast.success(`Public link ready. ${expiryLabel}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not generate secure public snapshot link.";
      toast.error(msg);
    } finally {
      window.setTimeout(() => setSharingId(null), 150);
    }
  }

  async function copyShareLink() {
    if (!share.open) return;
    const report = share.report;

    // Always regenerate a fresh share token on every copy - previous link is
    // superseded and will expire per the user's configured expiration policy.
    let freshLink = share.link;
    let freshExpiresAt = share.expiresAt;
    try {
      const endpointPath = "/api/audits/share-link";
      const endpoints = [endpointPath, `${API_URL}${endpointPath}`].filter(
        (value, index, arr) => arr.indexOf(value) === index
      );

      type SharePayload = {
        token?: string;
        slug?: string;
        share_path?: string;
        expires_at?: string;
        scan_label?: string;
        scan_ordinal?: number;
        public_view?: { tier?: string; redacted?: boolean };
      };
      let freshPayload: SharePayload | null = null;

      for (const endpoint of endpoints) {
        const response = await apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: report.url,
            analyzedAt: report.createdAt,
            auditId: report.auditId,
            expiration_days: share.open ? (share.expirationDays ?? shareExpiryDays) : shareExpiryDays,
          }),
        });
        if (!response.ok) continue;
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("application/json")) continue;
        const parsed = (await response.json().catch(() => null)) as SharePayload | null;
        if (!parsed?.token && !parsed?.share_path) continue;
        freshPayload = parsed;
        break;
      }

      if (freshPayload) {
        freshLink = resolvePublicShareUrl(freshPayload.share_path, freshPayload.token);
        freshExpiresAt = freshPayload.expires_at;
        setShare((s) => (s.open ? { ...s, link: freshLink, expiresAt: freshPayload.expires_at, copyError: false } : s));
      }
    } catch {
      // Non-fatal: fall back to existing link
    }

    const message = `${report.url} scored ${report.score}/100 for AI Visibility. Here is the evidence-backed breakdown of how ChatGPT and Perplexity interpret this site.`;
    const copyPayload = `${message}\n${freshLink}`;
    try {
      const didCopy = await writeClipboardWithFallback(copyPayload);
      if (!didCopy) throw new Error("Clipboard copy failed");
      setShare((s) => (s.open ? { ...s, copied: true, copyError: false } : s));
      const expiryText = formatShareExpiryLabel(freshExpiresAt);
      toast.success(`New share link generated and copied. ${expiryText}`);
      window.setTimeout(() => setShare((s) => (s.open ? { ...s, copied: false, copyError: false } : s)), 2000);
    } catch (err) {
      console.error("[ReportsPage] Failed to copy public report URL", err);
      setShare((s) => (s.open ? { ...s, copied: false, copyError: true } : s));
      toast.error("Could not copy. Please select and copy the link manually.");
    }
  }

  async function nativeShare() {
    if (!share.open) return;
    const navShare = (navigator as any).share;
    if (!navShare) return;

    try {
      const message = `${share.report.url} scored ${share.report.score}/100 for AI Visibility. Here is the evidence-backed breakdown of how ChatGPT and Perplexity interpret this site.`;
      await navShare({
        title: `AI Visibility Report: ${share.report.name}`,
        text: message,
        url: share.link,
      });
    } catch {
      // user canceled or share failed: ignore
    }
  }

  async function copyExecutiveSummary(report: Report) {
    const entry = history.find((item) => item.timestamp === report.timestamp);
    const summary = report.summary || entry?.result?.summary || "No summary available";

    // Resolve share link (non-expiring) so the copied text includes a public URL
    let shareUrl = "";
    try {
      const endpointPath = "/api/audits/share-link";
      const response = await apiFetch(`${API_URL}${endpointPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: report.url,
          analyzedAt: report.createdAt,
          auditId: report.auditId,
        }),
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.share_path || data?.token) {
          shareUrl = resolvePublicShareUrl(data.share_path, data.token);
        }
      }
    } catch {
      // share link generation failed — copy without it
    }

    const lines = [
      `Report: ${report.name}`,
      `URL: ${report.url}`,
      `Score: ${report.score}/100`,
      `Date: ${formatDate(report.createdAt)} ${formatTime(report.createdAt)}`,
      `Summary: ${summary}`,
    ];
    if (shareUrl) lines.push(`Full report: ${shareUrl}`);
    const payload = lines.join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Executive summary copied");
    } catch {
      toast.error("Could not copy summary");
    }
  }

  return (
    <div className="space-y-6">

      {/* Page heading + controls */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Audit Reports
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Delivery hub for agencies, operators, and executive reviews
          </p>
          <FeatureInstruction
            headline="How to use Audit Reports"
            steps={[
              "Run audits from the Analyze page — completed audits appear here automatically",
              "Use Re-analyze to refresh a report with the latest data",
              "Export PDF or JSON to share results with clients or leadership",
              "Share a public link for stakeholders who don't have an account",
            ]}
            benefit="Your reports hub — manage, compare, export, and share every audit in one place."
            defaultCollapsed
          />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:max-w-full lg:items-end">
          <div className="relative w-full lg:w-[18rem] lg:max-w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports"
              className="w-full min-w-0 pl-9 pr-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/30"
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <div className="flex min-w-0 items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/10">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "score-desc" | "score-asc")}
                className="min-w-0 bg-transparent text-xs text-white/80 outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="score-desc">Score High → Low</option>
                <option value="score-asc">Score Low → High</option>
              </select>
            </div>

            <div className="flex min-w-0 items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/10">
              <select
                value={scoreRange}
                onChange={(e) => setScoreRange(e.target.value as typeof scoreRange)}
                className="min-w-0 bg-transparent text-xs text-white/80 outline-none"
              >
                <option value="all">All Scores</option>
                <option value="critical">Critical (0-24)</option>
                <option value="low">Low (25-49)</option>
                <option value="medium">Medium (50-74)</option>
                <option value="high">High (75-100)</option>
              </select>
            </div>

            <div className="flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-white/[0.04] p-1">
              {(["all", "completed", "processing"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                    filter === f
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : "text-slate-500 hover:text-white"
                  }`}
                  type="button"
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              onClick={() => setConsolidateByUrl((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                consolidateByUrl
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                  : "bg-white/[0.04] text-slate-400 border-white/10 hover:text-white"
              }`}
              type="button"
              title="Consolidate duplicate URLs"
            >
              Consolidate URLs
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {share.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShare({ open: false })}
            role="button"
            tabIndex={-1}
            onKeyDown={(e) => e.key === "Escape" && setShare({ open: false })}
          />
          <div className="relative w-full max-w-lg bg-[#323a4c] border border-white/12 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/55">Share report</p>
                <h3 className="text-lg font-semibold text-white">{share.report.name}</h3>
                <p className="text-xs text-white/60 mt-1">{share.report.url}</p>
              </div>
              <button
                onClick={() => setShare({ open: false })}
                className="p-2 rounded-full hover:bg-charcoal text-white/55 hover:text-white"
                type="button"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-white/55">
                Share this link to open a view-only snapshot of this historical report.
              </p>
              <p className="text-xs text-white/60">
                {formatShareExpiryLabel(share.expiresAt)}
              </p>
              {share.redacted && (
                <p className="text-xs text-amber-300/90">
                  Public view link is redacted on Observer to reduce signup friction while keeping sensitive implementation details private.
                </p>
              )}

              <div className="flex items-center gap-2">
                <input
                  value={share.link}
                  readOnly
                  className="flex-1 px-3 py-2 border border-white/12 rounded-xl text-sm text-white/85 select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyShareLink}
                  className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-2 transition-all ${
                    share.copied
                      ? "bg-charcoal border-white/10 text-white/80"
                      : share.copyError
                        ? "bg-red-500/10 border-red-300/40 text-red-100"
                      : "bg-charcoal-deep hover:bg-charcoal/60 border-white/12 text-white/85"
                  }`}
                  type="button"
                  title="Copy link"
                >
                  {share.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {share.copied ? "copied!" : share.copyError ? "copy failed" : "copy"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={share.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-charcoal/10 hover:bg-charcoal/15 border border-white/12/20 text-white/85 text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  open
                </a>

                {(navigator as any).share && (
                  <button
                    onClick={nativeShare}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-charcoal hover:card-charcoal/20 text-white/80 text-sm transition-colors"
                    type="button"
                  >
                    <Share2 className="w-4 h-4" />
                    share
                  </button>
                )}
              </div>

              <p className="text-xs text-white/60">
                Score: <span className="text-white font-medium">{share.report.score}</span>
                &nbsp;·&nbsp; Analyzed: {formatDate(share.report.createdAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div>
        {!hasAccess ? (
          <UpgradeWall
            feature="Report History"
            description="View, download, and share your past analysis reports."
            requiredTier="alignment"
            icon={<FileText className="w-12 h-12 text-white/80" />}
          />
        ) : (
          <>
            <section className="brand-bar-top card-charcoal rounded-xl p-6 mb-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-orange-300">
                    <Briefcase className="w-3.5 h-3.5" />
                    Agency + Executive delivery hub
                  </div>
                  <h2 className="mt-3 text-2xl sm:text-3xl brand-title">Your audit archive, remediation queue, and proof-of-work layer - in one place.</h2>
                  <p className="mt-3 text-sm leading-7 text-white/60">
                    Manage active client audits, build review-ready snapshots, track score movement across accounts, and route weak audits directly into Score Fix. Each report is evidence - not just a number.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row xl:flex-col xl:min-w-[16rem] xl:self-start">
                  <button
                    onClick={() => navigate('/app/score-fix?source=reports')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl btn-cta-primary px-5 py-3 text-sm font-bold"
                    type="button"
                  >
                    <Wand2 className="w-4 h-4" />
                    Open Score Fix
                  </button>
                  <button
                    onClick={() => navigate('/compare')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl btn-cta-secondary px-5 py-3 text-sm font-semibold"
                    type="button"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Compare URLs
                  </button>
                  <button
                    onClick={() => navigate('/guide?section=report-history&source=reports-page')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-charcoal px-5 py-3 text-sm text-white/70 transition-colors hover:text-white"
                    type="button"
                  >
                    Reporting guide
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {PAGE_USE_CASES.map((item, i) => {
                  const Icon = item.icon;
                  const accents = ['section-accent-cyan', 'section-accent-amber', 'section-accent-violet'];
                  const iconColors = ['text-cyan-300', 'text-amber-300', 'text-violet-300'];
                  return (
                    <div key={item.title} className={`card-charcoal rounded-xl p-4 ${accents[i % 3]}`}>
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg border border-white/10 bg-charcoal p-2">
                          <Icon className={`w-4 h-4 ${iconColors[i % 3]}`} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-white/55">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Agency Stat Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <div className="card-charcoal agency-stat-cyan rounded-xl p-4">
                <p className="text-xs font-semibold text-cyan-300/80 uppercase tracking-wide mb-2">Total Audits</p>
                <p className="text-3xl font-extrabold text-white">{canonicalCompletedCount}</p>
                <p className="mt-1 text-xs text-white/45">from full account audit history</p>
              </div>
              <div className="card-charcoal agency-stat-emerald rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-300/80 uppercase tracking-wide mb-2">Completed</p>
                <p className="text-3xl font-extrabold text-emerald-300">{canonicalCompletedCount}</p>
                <p className="mt-1 text-xs text-white/45">ready to review or export</p>
              </div>
              <div className="card-charcoal agency-stat-amber rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-300/80 uppercase tracking-wide mb-2">Avg Score</p>
                <p className={`text-3xl font-extrabold ${getScoreColor(averageScore)}`}>{averageScore}</p>
                <p className="mt-1 text-xs text-white/45">Best: <span className={`font-bold ${getScoreColor(bestScore)}`}>{bestScore}</span></p>
              </div>
              <div className="card-charcoal agency-stat-violet rounded-xl p-4">
                <p className="text-xs font-semibold text-violet-300/80 uppercase tracking-wide mb-2">Momentum</p>
                <p className={`text-3xl font-extrabold ${latestMomentum > 0 ? 'text-emerald-300' : latestMomentum < 0 ? 'text-red-300' : 'text-white/60'}`}>
                  {latestMomentum > 0 ? `+${latestMomentum}` : latestMomentum}
                </p>
                <p className="mt-1 text-xs text-white/45">vs previous audit</p>
              </div>
            </div>

            {displayedReports.length > 0 && (
              <div className="mb-8">
                <PlatformProofLoopCard
                  url={displayedReports[0]?.url}
                  score={displayedReports[0]?.status === "completed" ? displayedReports[0].score : undefined}
                  title="Validation loop"
                  subtitle="Historical reports should turn directly into a next action: re-audit the same URL, fix the blockers, and validate the movement."
                />
              </div>
            )}

            {opsQueue.length > 0 && (
              <section className="brand-bar-top card-charcoal rounded-2xl p-5 sm:p-6 mb-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-violet-200">
                      <Wand2 className="w-3.5 h-3.5" />
                      Fixpack Ops Queue
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">
                      Run the highest-lift remediation packs first
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-white/60">
                      Queue is ranked by expected lift, low reliability, and low score so weak audits become a deterministic weekly operating list.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[20rem]">
                    <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
                      <p className="text-[10px] uppercase tracking-wide text-white/45">Queued packs</p>
                      <p className="mt-1 text-xl font-bold text-white">{opsQueue.length}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
                      <p className="text-[10px] uppercase tracking-wide text-white/45">Top expected delta band</p>
                      <p className="mt-1 text-xl font-bold text-emerald-300">+{Math.max(...opsQueue.map((item) => item.expectedLiftMax))}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
                      <p className="text-[10px] uppercase tracking-wide text-white/45">Lowest reliability</p>
                      <p className="mt-1 text-xl font-bold text-amber-300">{Math.min(...opsQueue.map((item) => item.reliabilityIndex))}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {opsQueue.map((item) => {
                    const statusKey = `${item.auditId}:${item.fixpackId}`;
                    const packStatus = item.auditId ? (fixpackStatuses[statusKey] || 'open') : null;
                    return (
                    <div key={`${item.reportId}:${item.fixpackId}`} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 rounded-full border border-emerald-500/35 text-[11px] text-emerald-300">
                              +{item.expectedLiftMin} to +{item.expectedLiftMax}
                            </span>
                            <span className="px-2 py-0.5 rounded-full border border-white/10 text-[11px] text-white/65">
                              Reliability {item.reliabilityIndex}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] ${getScoreChipClass(item.score)}`}>
                              Score {item.score}
                            </span>
                            {packStatus && (
                              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                                packStatus === 'validated' ? 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10'
                                : packStatus === 'in-progress' ? 'border-amber-500/35 text-amber-300 bg-amber-500/10'
                                : 'border-white/10 text-white/40'
                              }`}>
                                {packStatus === 'validated' ? '✓ validated' : packStatus === 'in-progress' ? '⬤ in progress' : '○ open'}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-white">{item.fixpackLabel}</h4>
                          <p className="mt-1 text-xs text-cyan-300/75 break-all">{item.url}</p>
                          <p className="mt-2 text-xs text-white/55">
                            Targets: {item.targetGateIds.join(', ')} · Pass rate {Math.round(item.passRate * 100)}% · {formatDate(item.createdAt)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {item.auditId && packStatus && (
                            <button
                              onClick={() => cycleFixpackStatus(item.auditId!, item.fixpackId)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                                packStatus === 'validated'
                                  ? 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                                  : packStatus === 'in-progress'
                                  ? 'border-amber-500/35 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                                  : 'border-white/12 bg-charcoal text-white/60 hover:text-white'
                              }`}
                              type="button"
                              title="Cycle status: open → in-progress → validated"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {packStatus === 'validated' ? 'Reopen' : packStatus === 'in-progress' ? 'Mark done' : 'Start'}
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/app/score-fix?source=ops-queue&report=${encodeURIComponent(item.auditId || item.reportId)}&url=${encodeURIComponent(item.url)}`)}
                            className="inline-flex items-center gap-1.5 rounded-lg btn-cta-primary px-3 py-2 text-xs font-bold"
                            type="button"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            Run fixpack
                          </button>
                          <button
                            onClick={() => navigate(`/app/analyze?url=${encodeURIComponent(item.url)}`)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-charcoal px-3 py-2 text-xs text-white/70 hover:text-white transition-colors"
                            type="button"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Re-audit
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </section>
            )}

            {compareTargets.length > 0 && baselineReport && comparisonReport && comparisonInsights && (
              <section className="brand-bar-top card-charcoal rounded-2xl p-5 sm:p-6 mb-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-200">
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Compare two audits
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">
                      Validate movement on the same target before presenting results
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-white/60">
                      Compare historical scans for one URL to explain exactly what changed and why the score moved.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:w-auto">
                    <button
                      onClick={() => navigate(`/app/analyze?url=${encodeURIComponent(activeCompareTarget?.url || "")}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl btn-cta-primary px-4 py-2.5 text-xs font-bold"
                      type="button"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Re-audit target
                    </button>
                    <button
                      onClick={() => navigate(`/app/score-fix?source=reports-compare&url=${encodeURIComponent(activeCompareTarget?.url || "")}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl btn-cta-secondary px-4 py-2.5 text-xs font-semibold"
                      type="button"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Route to Score Fix
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  <label className="flex flex-col gap-2 text-xs text-white/60">
                    Target URL
                    <select
                      value={compareTargetKey}
                      onChange={(event) => setCompareTargetKey(event.target.value)}
                      className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-white/85"
                    >
                      {compareTargets.map((target) => (
                        <option key={target.key} value={target.key}>
                          {target.url}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-xs text-white/60">
                    Baseline audit
                    <select
                      value={baselineReportId}
                      onChange={(event) => setBaselineReportId(event.target.value)}
                      className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-white/85"
                    >
                      {compareReportOptions.map((report) => (
                        <option key={report.id} value={report.id}>
                          {formatScanLabel(scanOrdinalByReportId[report.id] || 1)} · {formatDate(report.createdAt)} {formatTime(report.createdAt)} · {report.score}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-xs text-white/60">
                    Comparison audit
                    <select
                      value={comparisonReportId}
                      onChange={(event) => setComparisonReportId(event.target.value)}
                      className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-white/85"
                    >
                      {compareReportOptions.map((report) => (
                        <option key={report.id} value={report.id}>
                          {formatScanLabel(scanOrdinalByReportId[report.id] || 1)} · {formatDate(report.createdAt)} {formatTime(report.createdAt)} · {report.score}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
                    <p className="text-[10px] uppercase tracking-wide text-white/45">Score delta</p>
                    <p className={`mt-1 text-xl font-bold ${comparisonInsights.scoreDelta > 0 ? "text-emerald-300" : comparisonInsights.scoreDelta < 0 ? "text-red-300" : "text-white"}`}>
                      {formatDelta(comparisonInsights.scoreDelta)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
                    <p className="text-[10px] uppercase tracking-wide text-white/45">Pass checks</p>
                    <p className={`mt-1 text-xl font-bold ${comparisonInsights.passDelta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {formatDelta(comparisonInsights.passDelta)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
                    <p className="text-[10px] uppercase tracking-wide text-white/45">Warn checks</p>
                    <p className={`mt-1 text-xl font-bold ${comparisonInsights.warnDelta <= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                      {formatDelta(comparisonInsights.warnDelta)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
                    <p className="text-[10px] uppercase tracking-wide text-white/45">Fail checks</p>
                    <p className={`mt-1 text-xl font-bold ${comparisonInsights.failDelta <= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {formatDelta(comparisonInsights.failDelta)}
                    </p>
                  </div>
                </div>

                {comparisonInsights.gateDiff.length > 0 && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-charcoal-deep overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-[10px] uppercase tracking-wide text-white/45 font-semibold">Strict rubric gate delta</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-3 text-white/40 font-medium">Gate</th>
                            <th className="text-center px-4 py-3 text-white/40 font-medium">Baseline</th>
                            <th className="text-center px-4 py-3 text-white/40 font-medium">Latest</th>
                            <th className="text-center px-4 py-3 text-white/40 font-medium">Delta</th>
                            <th className="text-center px-4 py-3 text-white/40 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonInsights.gateDiff.map((row) => (
                            <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                              <td className="px-4 py-3 text-white/75">{row.label}</td>
                              <td className="px-4 py-3 text-center text-white/55">{row.baselineScore}</td>
                              <td className="px-4 py-3 text-center text-white/75">{row.comparisonScore}</td>
                              <td className={`px-4 py-3 text-center font-semibold ${row.delta > 0 ? "text-emerald-300" : row.delta < 0 ? "text-red-300" : "text-white/45"}`}>
                                {formatDelta(row.delta)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  row.comparisonStatus === 'pass' ? 'bg-emerald-500/15 text-emerald-300'
                                  : row.comparisonStatus === 'warn' ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-red-500/15 text-red-300'
                                }`}>
                                  {row.comparisonStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-200">Why score moved (positive)</p>
                    <div className="mt-2 space-y-2 text-xs leading-6 text-emerald-100/90">
                      {comparisonInsights.positiveSignals.map((signal) => (
                        <p key={signal}>• {signal}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-4">
                    <p className="text-xs uppercase tracking-wide text-amber-200">Risk regression signals</p>
                    <div className="mt-2 space-y-2 text-xs leading-6 text-amber-100/90">
                      {comparisonInsights.riskSignals.length > 0 ? (
                        comparisonInsights.riskSignals.map((signal) => <p key={signal}>• {signal}</p>)
                      ) : (
                        <p>• No clear regression signal detected between the selected scans.</p>
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-white/55">
                  Time elapsed between selected scans: {comparisonInsights.elapsedDays} day{comparisonInsights.elapsedDays === 1 ? "" : "s"}.
                  Keep the target fixed to ensure the delta is attributable to implemented changes.
                </p>
              </section>
            )}

            {/* Reports List */}
            <div className="min-w-0 space-y-3">
              {displayedReports.map((report) => (
                <div
                  key={report.id}
                  id={report.auditId ? `report-${report.auditId}` : undefined}
                  className={`card-charcoal min-w-0 rounded-2xl p-4 sm:p-5 transition-all ${report.status === 'completed' ? getScoreAccentClass(report.score) : 'border-l-[3px] border-l-white/10'}`}
                >
                  <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    {/* Left: Identity and meta */}
                    <div className="flex min-w-0 items-start gap-3">
                      {/* Score ring */}
                      {report.status === "completed" && (
                        <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${getScoreChipClass(report.score)}`}>
                          <span className="text-xl leading-none font-extrabold">{report.score}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide opacity-80 mt-0.5">{getScoreLabel(report.score)}</span>
                        </div>
                      )}
                      {report.status === "processing" && (
                        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-charcoal-light flex items-center justify-center">
                          <img src="/aivis-progress-spinner.png" alt="" className="w-5 h-5 animate-spin" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white text-sm">{report.name}</h3>
                          {getStatusIcon(report.status)}
                          {consolidatedMetaByReportId[report.id]?.scanCount > 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-900/30 border border-violet-500/30 text-violet-300">
                              {consolidatedMetaByReportId[report.id].scanCount} scans
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-cyan-300/75 break-all mt-0.5">{report.url}</p>
                        {report.summary && (
                          <p className="mt-1.5 text-xs leading-5 text-white/55 max-w-2xl line-clamp-2">
                            {report.summary}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(report.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(report.createdAt)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-charcoal-solid text-white/50 uppercase text-[9px] tracking-wide">
                            {report.type}
                          </span>
                          {report.seoSummary && (
                            <span className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-500/30 text-emerald-300">✓ {report.seoSummary.pass}</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-500/30 text-amber-300">⚠ {report.seoSummary.warn}</span>
                              <span className="px-1.5 py-0.5 rounded bg-red-900/30 border border-red-500/30 text-red-300">✗ {report.seoSummary.fail}</span>
                              <InfoTip text="Pass = criteria met. Warn = improvement opportunity. Fail = blocking issue that hurts AI visibility." />
                              <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-500/30 text-amber-300">⚠ {report.seoSummary.warn}</span>
                              <span className="px-1.5 py-0.5 rounded bg-red-900/30 border border-red-500/30 text-red-300">✗ {report.seoSummary.fail}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Action strip */}
                    <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:ml-4">
                      {/* Primary: Re-analyze */}
                      <ButtonTooltip tip="Run a fresh audit on this URL with the latest AI models">
                      <button
                        onClick={() => navigate(`/?url=${encodeURIComponent(report.url)}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg btn-cta-primary px-3 py-1.5 text-xs font-bold"
                        title="Re-analyze this URL"
                        type="button"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Re-analyze
                      </button>
                      </ButtonTooltip>

                      {/* Score Fix for low scores */}
                      {report.status === 'completed' && report.score < 75 && (
                        <ButtonTooltip tip="Get an AI-generated fix plan to raise this score above 75">
                        <button
                          onClick={() => navigate(`/app/score-fix?source=reports&report=${encodeURIComponent(report.auditId || report.id)}&url=${encodeURIComponent(report.url)}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg btn-cta-secondary px-3 py-1.5 text-xs font-semibold"
                          title="Open Score Fix remediation"
                          type="button"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          Fix Score
                        </button>
                        </ButtonTooltip>
                      )}

                      {/* Compare */}
                      <ButtonTooltip tip="Compare this URL side-by-side with competitors">
                      <button
                        onClick={() => navigate(`/compare?url=${encodeURIComponent(report.url)}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-charcoal px-3 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
                        title="Open competitor comparison"
                        type="button"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Compare
                      </button>
                      </ButtonTooltip>

                      {/* Icon actions */}
                      <div className="flex items-center gap-1.5 ml-1">
                        <ButtonTooltip tip="Download raw audit data as JSON" position="bottom">
                        <button
                          onClick={() => handleDownload(report)}
                          disabled={report.status !== "completed" || downloadingId === report.id}
                          className="p-1.5 rounded-lg bg-charcoal hover:bg-charcoal-light transition-colors text-white/45 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Download JSON"
                          type="button"
                        >
                          {downloadingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        </ButtonTooltip>
                        <ButtonTooltip tip="Export a branded PDF report for stakeholders" position="bottom">
                        <button
                          onClick={() => void handlePdfExport(report)}
                          disabled={report.status !== "completed" || !report.auditId || pdfExportingId === report.id}
                          className="p-1.5 rounded-lg bg-charcoal hover:bg-charcoal-light transition-colors text-white/45 hover:text-orange-300/80 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Export PDF"
                          type="button"
                        >
                          {pdfExportingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        </button>
                        </ButtonTooltip>
                        <ButtonTooltip tip="Generate a shareable public link for this audit" position="bottom">
                        <button
                          onClick={() => handleShare(report)}
                          disabled={report.status !== "completed" || sharingId === report.id}
                          className="p-1.5 rounded-lg bg-charcoal hover:bg-charcoal-light transition-colors text-white/45 hover:text-cyan-300/80 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Share public link"
                          type="button"
                        >
                          {sharingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                        </button>
                        </ButtonTooltip>
                        <ButtonTooltip tip="Copy a text summary of key findings to your clipboard" position="bottom">
                        <button
                          onClick={() => copyExecutiveSummary(report)}
                          disabled={report.status !== "completed"}
                          className="p-1.5 rounded-lg bg-charcoal hover:bg-charcoal-light transition-colors text-white/45 hover:text-amber-300/80 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Copy executive summary"
                          type="button"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        </ButtonTooltip>
                        <ButtonTooltip tip="Permanently remove this report" position="bottom">
                        <button
                          onClick={() => void deleteReport(report)}
                          disabled={deletingId === report.id}
                          className="p-1.5 rounded-lg bg-charcoal hover:bg-red-900/20 transition-colors text-white/35 hover:text-red-300/80 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete"
                          type="button"
                        >
                          {deletingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                        </ButtonTooltip>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {displayedReports.length === 0 && (
                <div className="text-center py-16">
                  <FileText className="w-12 h-12 text-white/70 mx-auto mb-4" />
                  <p className="text-white/55 text-lg font-medium">No reports yet</p>
                  <p className="text-white/60 text-sm mt-1">
                    Run an analysis from the{" "}
                    <button
                      onClick={() => navigate("/app/analyze")}
                      className="text-cyan-400 hover:underline"
                      type="button"
                    >
                      audit page
                    </button>{" "}
                    to generate your first report.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
