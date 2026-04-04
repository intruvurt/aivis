import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, ClipboardList, Clock3, Gauge, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import AppPageFrame from "../components/AppPageFrame";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../utils/api";
import { TIER_LIMITS, uiTierFromCanonical } from "@shared/types";

type AuditRecord = {
  _id?: string;
  id?: string;
  url?: string;
  createdAt?: string;
  created_at?: string;
  status?: string;
  overallScore?: number;
  visibility_score?: number;
  visibilityStatus?: string;
};

function normalizeAudits(payload: any): AuditRecord[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.audits)
      ? payload.audits
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return raw.map((item: any) => ({
    _id: item?._id || item?.id,
    id: item?.id || item?._id,
    url: item?.url,
    createdAt: item?.createdAt || item?.created_at,
    created_at: item?.created_at || item?.createdAt,
    status: item?.status || "completed",
    overallScore:
      typeof item?.overallScore === "number"
        ? item.overallScore
        : typeof item?.visibility_score === "number"
          ? item.visibility_score
          : undefined,
    visibility_score:
      typeof item?.visibility_score === "number"
        ? item.visibility_score
        : typeof item?.overallScore === "number"
          ? item.overallScore
          : undefined,
    visibilityStatus: item?.visibilityStatus || item?.summary,
  }));
}

export default function Dashboard() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const userTier = useAuthStore((state) => state.user?.tier || "observer");
  const uiTier = uiTierFromCanonical(userTier as any);
  const canLoadHistory = TIER_LIMITS[uiTier].hasReportHistory;

  useEffect(() => {
    const run = async () => {
      if (!canLoadHistory) {
        setAudits([]);
        setLoading(false);
        return;
      }

      try {
        const response = await apiFetch("/api/audits?limit=20");
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const isFeatureLocked = response.status === 403 && data?.code === "FEATURE_LOCKED";
          if (isFeatureLocked) {
            setAudits([]);
            return;
          }
          throw new Error(data?.error || "Failed to load audit history");
        }

        setAudits(normalizeAudits(data));
      } catch {
        toast.error("Failed to load audits");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [canLoadHistory]);

  const sortedAudits = useMemo(() => {
    return [...audits].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [audits]);

  const primaryAudit = sortedAudits[0] || null;

  const metrics = useMemo(() => {
    const completed = audits.filter((audit) => audit.status === "completed").length;
    const processing = audits.filter((audit) => audit.status === "processing").length;
    const scored = audits.filter((audit) => typeof audit.overallScore === "number");
    const averageScore = scored.length
      ? Math.round(scored.reduce((total, audit) => total + (audit.overallScore || 0), 0) / scored.length)
      : 0;
    const needsAttention = audits.filter((audit) => (audit.overallScore || 0) < 70).length;
    return [
      { label: "Total audits", value: audits.length, icon: ClipboardList },
      { label: "Completed", value: completed, icon: Gauge },
      { label: "Average score", value: averageScore, icon: Activity },
      { label: "Needs attention", value: needsAttention + processing, icon: Clock3 },
    ];
  }, [audits]);

  const priorityPages = useMemo(() => {
    return [...audits]
      .filter((audit) => typeof audit.overallScore === "number")
      .sort((left, right) => (left.overallScore || 0) - (right.overallScore || 0))
      .slice(0, 3);
  }, [audits]);

  const primaryVerdict = useMemo(() => {
    const score = primaryAudit?.overallScore || 0;
    if (!primaryAudit || typeof primaryAudit.overallScore !== "number") return "No completed audit yet";
    if (score >= 80) return "Citation-ready with minor gaps";
    if (score >= 65) return "Readable, but still missing trust signals";
    if (score >= 40) return "Not citation-ready yet";
    return "Critical visibility blockers detected";
  }, [primaryAudit]);

  return (
    <AppPageFrame
      icon={<Gauge className="h-5 w-5 text-orange-300" />}
      title="Dashboard"
      subtitle="Track audit volume, surface the latest visibility work, and move straight into the next run."
      actions={
        <Link
          to="/app/analyze"
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
        >
          New audit
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {primaryAudit && typeof primaryAudit.overallScore === "number" && (
        <section className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/75">Latest verdict</p>
              <div className="mt-3 flex items-end gap-4">
                <div className="text-5xl font-semibold tracking-tight text-white">{primaryAudit.overallScore}</div>
                <div className="pb-1 text-sm text-cyan-100/80">{primaryVerdict}</div>
              </div>
              <p className="mt-3 text-sm text-white/70">
                Focus the next action on the latest audited page first, then re-scan the same target to prove the lift.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {primaryAudit._id && (
                <Link
                  to={`/audit/${primaryAudit._id}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                >
                  Open latest report
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/app/score-fix"
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
              >
                Fix these now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/46">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-cyan-200" />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Priority pages</h2>
            <p className="mt-1 text-sm text-white/56">
              {canLoadHistory
                ? "These are the lowest-scoring recent pages. Use the full report to inspect issue-level evidence."
                : "Audit history unlocks on Alignment. Run a scan to see your latest score, then upgrade when you need retained history and evidence trails."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-white/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : audits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center text-sm text-white/58">
            {canLoadHistory
              ? "No audits yet. Run your first audit to start building a visibility history."
              : "Run your first audit to see what AI can verify now. Alignment adds retained report history, evidence trails, and rescan comparison."}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-white/46">
                <tr>
                  <th className="px-4 py-3 font-semibold">Site</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(priorityPages.length > 0 ? priorityPages : sortedAudits.slice(0, 12)).map((audit) => (
                  <tr key={audit._id || audit.url} className="bg-transparent text-white/76">
                    <td className="px-4 py-4">
                      <div className="max-w-[26rem] truncate font-medium text-white">{audit.url || "Untitled audit"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium capitalize text-white/72">
                        {audit.status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{typeof audit.overallScore === "number" ? audit.overallScore : "—"}</td>
                    <td className="px-4 py-4 text-white/58">{audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-4">
                      {audit._id ? (
                        <Link to={`/audit/${audit._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-200 transition hover:text-white">
                          View
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-white/40">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppPageFrame>
  );
}
