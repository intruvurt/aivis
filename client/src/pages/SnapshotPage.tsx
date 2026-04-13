import React, { useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Wrench,
  Eye,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import type { AnalysisResponse } from "@shared/types";
import ShareButtons from "../components/ShareButtons";

function scoreColor(score: number) {
  if (score >= 80) return { ring: "border-emerald-400", text: "text-emerald-300", bg: "bg-emerald-400/10" };
  if (score >= 50) return { ring: "border-amber-400", text: "text-amber-300", bg: "bg-amber-400/10" };
  return { ring: "border-rose-400", text: "text-rose-300", bg: "bg-rose-400/10" };
}

function scoreVerdict(score: number): string {
  if (score >= 80) return "Citation-ready with minor gaps";
  if (score >= 65) return "Readable, but still missing trust signals";
  if (score >= 40) return "Not citation-ready yet";
  return "Critical visibility blockers detected";
}

export default function SnapshotPage() {
  const location = useLocation();
  const result = location.state?.result as AnalysisResponse | undefined;

  const trustIssues = useMemo(() => {
    if (!result) return [];
    const issues: string[] = [];

    // Pull from category_grades with low scores
    if (Array.isArray(result.category_grades)) {
      result.category_grades
        .filter((c) => c.score < 50)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .forEach((c) => {
          if (c.improvements?.length) {
            issues.push(c.improvements[0]);
          } else {
            issues.push(`${c.label}: ${c.summary}`);
          }
        });
    }

    // If we still need more, pull from high-priority recommendations
    if (issues.length < 3 && Array.isArray(result.recommendations)) {
      const critical = result.recommendations
        .filter((r) => r.priority === "high")
        .slice(0, 3 - issues.length);
      critical.forEach((r) => issues.push(r.impact || r.title));
    }

    return issues.slice(0, 3);
  }, [result]);

  const topFixes = useMemo(() => {
    if (!result?.recommendations) return [];
    return result.recommendations.slice(0, 3);
  }, [result]);

  const strengths = useMemo(() => {
    if (!result) return [];
    const items: string[] = [];

    // Pull from key_takeaways
    if (Array.isArray(result.key_takeaways)) {
      items.push(...result.key_takeaways.slice(0, 3));
    }

    // If short, check category_grades with high scores
    if (items.length < 3 && Array.isArray(result.category_grades)) {
      result.category_grades
        .filter((c) => c.score >= 70)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3 - items.length)
        .forEach((c) => {
          if (c.strengths?.length) {
            items.push(c.strengths[0]);
          }
        });
    }

    return items.slice(0, 3);
  }, [result]);

  // No result in state — redirect to analyze
  if (!result) {
    return <Navigate to="/app/analyze" replace />;
  }

  const score = result.visibility_score ?? 0;
  const colors = scoreColor(score);
  const auditId = result.audit_id;

  // Highlight the target URL inside the summary text
  const targetHost = (() => {
    try { return new URL(result.url).hostname.replace(/^www\./, ""); } catch { return ""; }
  })();

  const summaryNode = useMemo(() => {
    const raw = result.summary || "";
    if (!targetHost || !raw.includes(targetHost)) return raw;
    const idx = raw.indexOf(targetHost);
    return (
      <>
        {raw.slice(0, idx)}
        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-400/15 px-1.5 py-0.5 font-semibold text-cyan-300 border border-cyan-400/25">
          {targetHost}
        </span>
        {raw.slice(idx + targetHost.length)}
      </>
    );
  }, [result.summary, targetHost]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-white sm:px-6">
      {/* ── Score hero ───────────────────────────────────────────── */}
      <section className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,33,0.92))] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
          Visibility snapshot
        </p>

        <div className={`flex h-32 w-32 items-center justify-center rounded-full border-4 ${colors.ring} ${colors.bg}`}>
          <span className={`text-5xl font-bold tracking-tight ${colors.text}`}>{score}</span>
        </div>

        <p className="text-center text-sm text-white/70">{scoreVerdict(score)}</p>

        <p className="max-w-xl text-center text-sm leading-relaxed text-white/60">
          {summaryNode}
        </p>
      </section>

      {/* ── What AI understands ──────────────────────────────────── */}
      {strengths.length > 0 && (
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-emerald-200">What AI understands</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {strengths.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75">
                <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── What AI doesn't trust ────────────────────────────────── */}
      {trustIssues.length > 0 && (
        <section className="rounded-3xl border border-rose-400/20 bg-rose-400/[0.06] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <h2 className="text-base font-semibold text-rose-200">What AI doesn&apos;t trust</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {trustIssues.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── What to fix first ────────────────────────────────────── */}
      {topFixes.length > 0 && (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-semibold text-amber-200">Fix this first</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {topFixes.map((rec, i) => (
              <li key={rec.id || i} className="flex items-start gap-2.5 text-sm text-white/75">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" />
                <div>
                  <p className="font-medium text-white/90">{rec.title}</p>
                  <p className="mt-0.5 leading-relaxed text-white/55">{rec.impact}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Share / Copy ────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <ShareButtons
          url={result.url}
          score={score}
          analyzedAt={result.analyzed_at}
          auditId={auditId}
        />
      </section>

      {/* ── CTAs ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to={auditId ? `/app/audits/${auditId}` : "/app/analyze"}
          state={{ result }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
        >
          View full report
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/app/score-fix"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
        >
          Fix this
          <Wrench className="h-4 w-4" />
        </Link>
      </section>

      {/* ── Back link ────────────────────────────────────────────── */}
      <div className="text-center">
        <Link
          to="/app/analyze"
          className="text-sm text-white/40 transition hover:text-white/70"
        >
          ← Run another audit
        </Link>
      </div>
    </div>
  );
}
