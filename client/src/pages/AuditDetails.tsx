import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  Loader2,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppPageFrame from '../components/AppPageFrame';
import ShareButtons from '../components/ShareButtons';
import { auditService } from '../services/auditService';
import { usePageMeta } from '../hooks/usePageMeta';
import type { AnalysisResponse } from '@shared/types';
import Spinner from '../components/Spinner';
import { getScoreColor as scoreColor } from '../utils/scoreUtils';

/** Normalise both "passed via location.state" and "fetched from GET /audits/:id" into a usable AnalysisResponse-shaped object. */
function normaliseAudit(raw: Record<string, any>): Record<string, any> {
  // If the API row wraps the real payload inside `result` JSONB, unwrap it
  const inner = raw.result && typeof raw.result === 'object' ? raw.result : {};
  return {
    ...inner,
    ...raw,
    // Prefer inner (AnalysisResponse) fields, fall back to row-level columns
    url: inner.url || raw.url,
    visibility_score: inner.visibility_score ?? raw.visibility_score ?? null,
    summary: inner.summary || raw.summary || null,
    analyzed_at: inner.analyzed_at || raw.created_at || null,
    category_grades: inner.category_grades || raw.category_grades || [],
    recommendations: inner.recommendations || raw.recommendations || [],
    brag_evidence: inner.brag_evidence || raw.brag_evidence || [],
    key_takeaways: inner.key_takeaways || raw.key_takeaways || [],
    model_provider: inner.model_provider || raw.model_provider || null,
    audit_id: raw.id || raw.audit_id || inner.audit_id || null,
  };
}

export default function AuditDetails() {
  const { id } = useParams();
  const location = useLocation();
  const passedResult = (location.state as any)?.result as AnalysisResponse | undefined;

  usePageMeta({
    title: 'Audit Details — AiVIS.biz',
    description: 'View detailed AI visibility audit results and recommendations.',
    path: `/app/audits/${id ?? ''}`,
  });

  const [audit, setAudit] = useState<Record<string, any> | null>(
    passedResult ? normaliseAudit(passedResult as any) : null
  );
  const [loading, setLoading] = useState(!passedResult);
  const [citeLedger, setCiteLedger] = useState<any[]>([]);
  const [loadingCites, setLoadingCites] = useState(false);

  useEffect(() => {
    // If we have result from navigation state, skip the fetch
    if (passedResult) return;
    if (!id) return;

    const run = async () => {
      try {
        const response = await auditService.getAudit(id);
        const raw = response?.audit || response?.data || response;
        setAudit(normaliseAudit(raw));
      } catch {
        toast.error('Failed to load audit details');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [id, passedResult]);

  // Fetch cite ledger entries for Alignment+ users
  useEffect(() => {
    if (!audit?.id) return;

    const fetchCites = async () => {
      setLoadingCites(true);
      try {
        const result = await auditService.getCiteLedgerForAudit(audit.id);
        setCiteLedger(result?.entries || []);
      } catch {
        // Silently fail if not Alignment+ tier
        setCiteLedger([]);
      } finally {
        setLoadingCites(false);
      }
    };

    void fetchCites();
  }, [audit?.id]);

  const categoryCards = useMemo(() => {
    if (!Array.isArray(audit?.category_grades)) return [];
    return audit.category_grades.map((grade: any) => ({
      key: grade.category || grade.label,
      label: grade.label || grade.category || 'Category',
      score: typeof grade.score === 'number' ? grade.score : null,
      summary: grade.summary || null,
      strengths: grade.strengths || [],
      improvements: grade.improvements || [],
    }));
  }, [audit]);

  const recommendations = useMemo(() => {
    if (!Array.isArray(audit?.recommendations)) return [];
    return audit.recommendations;
  }, [audit]);

  const bragEvidence = useMemo(() => {
    if (!Array.isArray(audit?.brag_evidence)) return [];
    return audit.brag_evidence;
  }, [audit]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/60">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!audit) {
    return (
      <AppPageFrame title="Audit not found" subtitle="The requested audit could not be loaded.">
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center text-sm text-white/58">
          <p>The report is unavailable.</p>
          <Link
            to="/app"
            className="mt-4 inline-flex items-center gap-2 text-cyan-200 transition hover:text-white"
          >
            Return to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AppPageFrame>
    );
  }

  const score = typeof audit.visibility_score === 'number' ? audit.visibility_score : 0;

  return (
    <AppPageFrame
      icon={<FileText className="h-5 w-5 text-orange-300" />}
      title={audit.url || 'Audit detail'}
      subtitle="Full AI visibility report for the selected audit run."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/reports"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/74 transition hover:bg-white/[0.07]"
          >
            <ArrowLeft className="h-4 w-4" />
            Reports
          </Link>
          {id ? (
            <Link
              to={`/export/${id}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/74 transition hover:bg-white/[0.07]"
            >
              <Download className="h-4 w-4" />
              Export
            </Link>
          ) : null}
          <Link
            to="/app/analyze"
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
          >
            Re-run audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      {/* ── Summary strip ─────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Summary</p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-white/44">Score</p>
              <p className={`mt-1 text-3xl font-bold ${scoreColor(score)}`}>
                {score}
                <span className="text-lg text-white/40">/100</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-white/44">Categories</p>
              <p className="mt-1 text-lg font-semibold text-white">{categoryCards.length}</p>
            </div>
            <div>
              <p className="text-xs text-white/44">Model</p>
              <p className="mt-1 text-lg font-semibold text-white truncate">
                {audit.model_provider || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/44">Run date</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {audit.analyzed_at ? new Date(audit.analyzed_at).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>
          {audit.summary ? (
            <p className="mt-5 text-sm leading-7 text-white/64">{audit.summary}</p>
          ) : null}
        </article>

        {/* ── Fix panel (top recommendations) ──────────────────── */}
        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">
            Top fixes
          </p>
          <div className="mt-4 space-y-3">
            {recommendations.slice(0, 5).length > 0 ? (
              recommendations.slice(0, 5).map((item: any, index: number) => (
                <div
                  key={item.id || `fix-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start gap-3">
                    <Wrench className="mt-0.5 h-4 w-4 text-orange-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.title || item.action || 'Recommendation'}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-white/60">
                        {item.impact || 'No detail available.'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/56">
                No fix recommendations were returned for this run.
              </p>
            )}
          </div>
        </article>
      </section>

      {/* ── Share / Copy ──────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <ShareButtons
          url={audit.url}
          score={score}
          analyzedAt={audit.analyzed_at}
          auditId={id || audit.audit_id}
        />
      </section>

      {/* ── Category grades ───────────────────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-200" />
              <h2 className="text-lg font-semibold text-white">Category grades</h2>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {categoryCards.length > 0 ? (
                categoryCards.map((card: any) => (
                  <div
                    key={card.key}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.14em] text-white/42">
                        {card.label}
                      </p>
                      <p className={`text-xl font-bold ${scoreColor(card.score ?? 0)}`}>
                        {card.score ?? '-'}
                      </p>
                    </div>
                    {card.summary && (
                      <p className="mt-2 text-xs leading-relaxed text-white/55">{card.summary}</p>
                    )}
                    {card.strengths.length > 0 && (
                      <div className="mt-2">
                        {card.strengths.slice(0, 2).map((s: string, i: number) => (
                          <p key={i} className="text-xs text-emerald-300/70">
                            + {s}
                          </p>
                        ))}
                      </div>
                    )}
                    {card.improvements.length > 0 && (
                      <div className="mt-1">
                        {card.improvements.slice(0, 2).map((s: string, i: number) => (
                          <p key={i} className="text-xs text-rose-300/70">
                            - {s}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/56">
                  No category scores available for this audit.
                </p>
              )}
            </div>
          </article>

          {/* ── All recommendations table ─────────────────────── */}
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-300" />
              <h2 className="text-lg font-semibold text-white">All recommendations</h2>
            </div>
            {recommendations.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-white/[0.03] text-white/46">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Recommendation</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {recommendations.map((rec: any, i: number) => (
                      <tr key={rec.id || i} className="align-top text-white/74">
                        <td className="px-4 py-4 font-medium text-white">{rec.category || '-'}</td>
                        <td className="px-4 py-4">{rec.title || rec.action || '-'}</td>
                        <td className="px-4 py-4 capitalize text-white/60">
                          {rec.priority || '-'}
                        </td>
                        <td className="px-4 py-4 text-white/60">{rec.impact || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/56">
                No recommendation data is available for this audit.
              </p>
            )}
          </article>
        </div>

        {/* ── BRAG evidence drawer ────────────────────────────── */}
        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-200" />
            <h2 className="text-lg font-semibold text-white">BRAG evidence</h2>
          </div>
          <div className="mt-4 space-y-3">
            {bragEvidence.length > 0 ? (
              bragEvidence.map((item: any, index: number) => (
                <details
                  key={`evidence-${index}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
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
              ))
            ) : (
              <p className="text-sm text-white/56">
                No BRAG evidence trail was returned for this run.
              </p>
            )}
          </div>
        </article>
      </section>

      {/* ── Cite ledger chain (Alignment+ only) ────────────────────────────── */}
      {citeLedger.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-300" />
            <h2 className="text-lg font-semibold text-white">Citation chain</h2>
          </div>
          <div className="mt-4 space-y-3">
            {citeLedger.map((entry: any, index: number) => (
              <details
                key={`cite-${index}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-semibold text-white">
                  <span>
                    {entry.recommendation_title || entry.title || `Citation ${index + 1}`}
                  </span>
                  <span className="text-white/40 transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-3 space-y-2 text-xs leading-6 text-white/60">
                  {entry.entity_title && (
                    <p>
                      <span className="text-white/80 font-medium">Entity:</span>{' '}
                      {entry.entity_title}
                    </p>
                  )}
                  {entry.evidence_ids && (
                    <p>
                      <span className="text-white/80 font-medium">Evidence IDs:</span>{' '}
                      {entry.evidence_ids}
                    </p>
                  )}
                  {entry.created_at && (
                    <p>
                      <span className="text-white/80 font-medium">Traced at:</span>{' '}
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  )}
                  {entry.note && (
                    <p>
                      <span className="text-white/80 font-medium">Note:</span> {entry.note}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </AppPageFrame>
  );
}
