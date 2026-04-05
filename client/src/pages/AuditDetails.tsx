import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Download, FileText, Gauge, Loader2, ShieldAlert, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import AppPageFrame from "../components/AppPageFrame";
import { auditService } from "../services/auditService";

type AuditPayload = Record<string, any>;

export default function AuditDetails() {
  const { id } = useParams();
  const [audit, setAudit] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      try {
        const response = await auditService.getAudit(id);
        setAudit(response?.audit || response?.data || response);
      } catch {
        toast.error("Failed to load audit details");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [id]);

  const categoryCards = useMemo(() => {
    if (!audit?.categoryScores || typeof audit.categoryScores !== "object") return [];
    return Object.entries(audit.categoryScores).map(([key, value]) => ({
      key,
      label: key.replace(/([A-Z])/g, " $1").trim(),
      value,
    }));
  }, [audit]);

  const issueRows = useMemo(() => {
    if (Array.isArray(audit?.risks) && audit.risks.length > 0) {
      return audit.risks.map((item: any, index: number) => ({
        id: `risk-${index}`,
        category: item.category || "Risk",
        title: item.description || item.finding || "Issue",
        severity: item.severity || item.impact || "medium",
        recommendation: item.recommendation || item.action || "No recommendation provided",
      }));
    }
    if (Array.isArray(audit?.recommendations) && audit.recommendations.length > 0) {
      return audit.recommendations.map((item: any, index: number) => ({
        id: `rec-${index}`,
        category: item.category || "Recommendation",
        title: item.action || item.title || "Recommendation",
        severity: item.priority || "medium",
        recommendation: item.impact || item.recommendation || "No impact detail provided",
      }));
    }
    return [];
  }, [audit]);

  const topRecommendations = useMemo(() => {
    if (!Array.isArray(audit?.recommendations)) return [];
    return audit.recommendations.slice(0, 5);
  }, [audit]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!audit) {
    return (
      <AppPageFrame title="Audit not found" subtitle="The requested audit could not be loaded.">
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center text-sm text-white/58">
          <p>The report is unavailable.</p>
          <Link to="/app" className="mt-4 inline-flex items-center gap-2 text-cyan-200 transition hover:text-white">
            Return to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AppPageFrame>
    );
  }

  return (
    <AppPageFrame
      icon={<FileText className="h-5 w-5 text-orange-300" />}
      title={audit.url || "Audit detail"}
      subtitle="scorefix command center view for the selected audit run."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {id ? (
            <Link to={`/export/${id}`} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/74 transition hover:bg-white/[0.07]">
              <Download className="h-4 w-4" />
              Export
            </Link>
          ) : null}
          <Link to="/app/analyze" className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300">
            Re-run audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Summary strip</p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-white/44">Visibility</p>
              <p className="mt-1 text-lg font-semibold capitalize text-white">{audit.visibilityStatus || audit.status || "unknown"}</p>
            </div>
            <div>
              <p className="text-xs text-white/44">Score</p>
              <p className="mt-1 text-lg font-semibold text-white">{typeof audit.overallScore === "number" ? audit.overallScore : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-white/44">Provider</p>
              <p className="mt-1 text-lg font-semibold text-white">{audit.aiProvider || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-white/44">Run date</p>
              <p className="mt-1 text-lg font-semibold text-white">{audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : "-"}</p>
            </div>
          </div>
          {audit.summary ? <p className="mt-5 text-sm leading-7 text-white/64">{audit.summary}</p> : null}
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Fix panel</p>
          <div className="mt-4 space-y-3">
            {topRecommendations.length > 0 ? topRecommendations.map((item: any, index: number) => (
              <div key={`fix-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <Wrench className="mt-0.5 h-4 w-4 text-orange-300" />
                  <div>
                    <p className="text-sm font-semibold text-white">{item.action || item.title || item.category || "Recommendation"}</p>
                    <p className="mt-2 text-xs leading-6 text-white/60">{item.impact || item.recommendation || "No detail available."}</p>
                  </div>
                </div>
              </div>
            )) : <p className="text-sm text-white/56">No prioritized fix recommendations were returned for this run.</p>}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-200" />
              <h2 className="text-lg font-semibold text-white">Category cards</h2>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {categoryCards.length > 0 ? categoryCards.map((card) => (
                <div key={card.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/42">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{typeof card.value === "number" ? card.value : "-"}</p>
                </div>
              )) : <p className="text-sm text-white/56">No category scores available for this audit.</p>}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-300" />
              <h2 className="text-lg font-semibold text-white">Issue table</h2>
            </div>
            {issueRows.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-white/[0.03] text-white/46">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Issue</th>
                      <th className="px-4 py-3 font-semibold">Severity</th>
                      <th className="px-4 py-3 font-semibold">Recommended next move</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {issueRows.map((row) => (
                      <tr key={row.id} className="align-top text-white/74">
                        <td className="px-4 py-4 font-medium text-white">{row.category}</td>
                        <td className="px-4 py-4">{row.title}</td>
                        <td className="px-4 py-4 capitalize text-white/60">{row.severity}</td>
                        <td className="px-4 py-4 text-white/60">{row.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/56">No issue table data is available for this audit.</p>
            )}
          </article>
        </div>

        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-200" />
            <h2 className="text-lg font-semibold text-white">Evidence drawer</h2>
          </div>
          <div className="mt-4 space-y-3">
            {Array.isArray(audit.evidence) && audit.evidence.length > 0 ? audit.evidence.slice(0, 8).map((item: any, index: number) => (
              <details key={`evidence-${index}`} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-semibold text-white">
                  <span>{item.finding || item.category || `Evidence ${index + 1}`}</span>
                  <span className="text-white/40 transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-3 space-y-2 text-xs leading-6 text-white/60">
                  {item.evidence ? <p>{item.evidence}</p> : null}
                  {item.source ? <p>Source: {item.source}</p> : null}
                  {item.recommendation ? <p>Recommendation: {item.recommendation}</p> : null}
                </div>
              </details>
            )) : <p className="text-sm text-white/56">No evidence trail was returned for this run.</p>}
          </div>
        </article>
      </section>
    </AppPageFrame>
  );
}
