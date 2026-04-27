import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  ShieldCheck,
  AlertTriangle,
  Target,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Lock,
  FileText,
} from 'lucide-react';
import AppPageFrame from '../components/AppPageFrame';
import Spinner from '../components/Spinner';
import apiFetch from '../utils/api';
import type { EvidenceLedgerProjection } from '../../../shared/types';

interface AuditRow {
  id?: string;
  url?: string;
  visibility_score?: number;
  seo_diagnostics?: Record<string, { status?: 'pass' | 'warn' | 'fail' }>;
  recommendations?: Array<{
    title?: string;
    description?: string;
    implementation?: string;
    category?: string;
  }>;
  query_insights?: Array<{ query?: string; niche?: string; score?: number }>;
}

interface RegistryPattern {
  id: string;
  label: string;
  category: 'schema' | 'content' | 'entity' | 'mandatory_seo';
  observedCount: number;
  impactScore: number;
  status: 'verified' | 'candidate';
}

function normalizeCategory(raw?: string): RegistryPattern['category'] {
  const v = (raw || '').toLowerCase();
  if (v.includes('schema') || v.includes('json-ld')) return 'schema';
  if (v.includes('entity') || v.includes('brand')) return 'entity';
  if (v.includes('seo') || v.includes('wcag') || v.includes('robots') || v.includes('canonical'))
    return 'mandatory_seo';
  return 'content';
}

function bragId(index: number): string {
  return `CL-${String(index + 1).padStart(4, '0')}`;
}

const SEVEN_DIMENSIONS = [
  {
    label: 'Schema & Structured Data',
    weight: 20,
    color: 'text-orange-300',
    bar: 'bg-orange-400',
    width: 'w-[100%]',
  },
  {
    label: 'Content Depth',
    weight: 18,
    color: 'text-amber-300',
    bar: 'bg-amber-400',
    width: 'w-[90%]',
  },
  {
    label: 'Technical Trust',
    weight: 15,
    color: 'text-sky-300',
    bar: 'bg-sky-400',
    width: 'w-[75%]',
  },
  {
    label: 'Meta & Open Graph',
    weight: 15,
    color: 'text-indigo-300',
    bar: 'bg-indigo-400',
    width: 'w-[75%]',
  },
  {
    label: 'AI Readability',
    weight: 12,
    color: 'text-violet-300',
    bar: 'bg-violet-400',
    width: 'w-[60%]',
  },
  {
    label: 'Heading Structure',
    weight: 10,
    color: 'text-teal-300',
    bar: 'bg-teal-400',
    width: 'w-[50%]',
  },
  {
    label: 'Security & Trust',
    weight: 10,
    color: 'text-rose-300',
    bar: 'bg-rose-400',
    width: 'w-[50%]',
  },
];

const COMPARISON_ROWS = [
  'Evidence-based scoring',
  'Page-specific proof',
  'AI citation focus',
  'Traceable audit trail',
  'Real-time validation',
];

function StatusBadge({ status }: { status: 'pass' | 'partial' | 'fail' }) {
  const cfg = {
    pass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    partial: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    fail: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${cfg[status]}`}
    >
      {status}
    </span>
  );
}

export default function EvidenceRegistryPage() {
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [latestProjection, setLatestProjection] = useState<EvidenceLedgerProjection | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RegistryPattern['category']>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch('/api/audits?limit=100');
        const payload = (await response.json().catch(() => null)) as
          | { audits?: AuditRow[] }
          | AuditRow[]
          | null;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.audits)
            ? payload.audits
            : [];
        if (!cancelled) setAudits(rows);

        const latestAuditId = String(rows?.[0]?.id || '').trim();
        if (latestAuditId) {
          const projectionResponse = await apiFetch(
            `/api/cite-ledger/audit/${encodeURIComponent(latestAuditId)}/projection`
          );
          if (projectionResponse.ok) {
            const projectionPayload = (await projectionResponse.json().catch(() => null)) as {
              projection?: EvidenceLedgerProjection;
            } | null;
            if (!cancelled) setLatestProjection(projectionPayload?.projection || null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const registry = useMemo(() => {
    const map = new Map<string, RegistryPattern>();

    audits.forEach((audit) => {
      const recs = Array.isArray(audit.recommendations) ? audit.recommendations : [];
      recs.forEach((rec, idx) => {
        const label = (rec.title || rec.description || `Pattern ${idx + 1}`).trim();
        if (!label) return;
        const id = label.toLowerCase();
        const prev = map.get(id);
        const weight =
          typeof audit.visibility_score === 'number'
            ? Math.max(1, Math.round((100 - audit.visibility_score) / 10))
            : 1;

        if (!prev) {
          map.set(id, {
            id,
            label,
            category: normalizeCategory(rec.category || rec.implementation || rec.title),
            observedCount: 1,
            impactScore: weight,
            status: 'candidate',
          });
          return;
        }

        prev.observedCount += 1;
        prev.impactScore += weight;
      });

      const seo = audit.seo_diagnostics;
      if (seo && typeof seo === 'object') {
        Object.entries(seo).forEach(([check, value]) => {
          if (value?.status !== 'fail') return;
          const label = `Mandatory SEO: ${check.replace(/_/g, ' ')}`;
          const id = label.toLowerCase();
          const prev = map.get(id);
          if (!prev) {
            map.set(id, {
              id,
              label,
              category: 'mandatory_seo',
              observedCount: 1,
              impactScore: 2,
              status: 'candidate',
            });
            return;
          }
          prev.observedCount += 1;
          prev.impactScore += 2;
        });
      }
    });

    return [...map.values()]
      .map((item) => ({
        ...item,
        status: item.observedCount >= 3 ? ('verified' as const) : ('candidate' as const),
      }))
      .sort((a, b) => b.impactScore - a.impactScore);
  }, [audits]);

  const filteredRegistry = useMemo(() => {
    return registry.filter((item) => {
      const matchesFilter = categoryFilter === 'all' || item.category === categoryFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || item.label.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [registry, categoryFilter, query]);

  const seoHealth = useMemo(() => {
    let pass = 0;
    let warn = 0;
    let fail = 0;

    audits.forEach((audit) => {
      const seo = audit.seo_diagnostics;
      if (!seo) return;
      Object.values(seo).forEach((check) => {
        if (check?.status === 'pass') pass += 1;
        else if (check?.status === 'warn') warn += 1;
        else if (check?.status === 'fail') fail += 1;
      });
    });

    return { pass, warn, fail };
  }, [audits]);

  function toggleEntry(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppPageFrame
      icon={<Database className="h-5 w-5 text-orange-300" />}
      title="Cite Ledger"
      subtitle="Every score is backed by verifiable, on-page evidence. If it can't be proven from your live page, it doesn't exist in your audit."
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/70">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── SECTION 1: HERO ─────────────────────────────────────────── */}
          <section className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-orange-400">
                System of Record
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                v2.0 · Immutable
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              CITE LEDGER: Proof, Not Opinions
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-300">
              Every score in AiVIS is backed by verifiable, on-page evidence. If it can't be proven
              from your live page, it doesn't exist in your audit.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/app/scan"
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 transition-colors"
              >
                Run Audit
                <ArrowRight className="h-4 w-4" />
              </a>
              <button
                onClick={() => {
                  document.getElementById('live-ledger')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500 transition-colors"
              >
                See Example Ledger
              </button>
            </div>
          </section>

          {/* ── SECTION 2: WHAT CITE LEDGER IS ──────────────────────────── */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              System Definition
            </p>
            <h2 className="mb-2 text-xl font-bold text-white">What CITE LEDGER Actually Is</h2>
            <p className="mb-6 text-sm text-slate-400">
              Not a score. Not a checklist. A verification layer.
            </p>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {[
                { icon: <Database className="h-4 w-4" />, text: 'Extracts real page data' },
                {
                  icon: <ShieldCheck className="h-4 w-4" />,
                  text: 'Assigns evidence IDs to every finding',
                },
                { icon: <FileText className="h-4 w-4" />, text: 'Tracks changes over time' },
                { icon: <Lock className="h-4 w-4" />, text: 'Prevents inflated or fake scores' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                >
                  <span className="text-orange-400">{item.icon}</span>
                  <span className="text-sm text-slate-200">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Pipeline visual */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-5 py-4">
              {['Signal', 'Evidence', 'Score', 'Traceable Fix'].map((step, i, arr) => (
                <React.Fragment key={step}>
                  <span className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-200">
                    {step}
                  </span>
                  {i < arr.length - 1 && (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* ── SECTION 3: STATS + LIVE LEDGER ENTRIES ───────────────────── */}
          <section id="live-ledger" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Ledger Entries</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {latestProjection?.totals.entryCount ?? registry.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Strict claims in the latest stored projection
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Net Impact</p>
                <p
                  className={`mt-2 text-3xl font-semibold ${(latestProjection?.totals.netImpact ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                >
                  {latestProjection?.totals.netImpact ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Aggregate score delta from the latest ledger projection
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Evidence Count</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-300">
                  {latestProjection?.totals.evidenceCount ??
                    seoHealth.fail + seoHealth.warn + seoHealth.pass}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Underlying evidence refs in the latest projection
                </p>
              </div>
            </div>

            {latestProjection ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Live Audit Projection
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-300 break-all">
                      {latestProjection.url}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] text-slate-500">
                      {latestProjection.auditId}
                    </p>
                    <p className="font-mono text-[10px] text-slate-600">
                      {new Date(latestProjection.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-800">
                  {latestProjection.entries.slice(0, 12).map((entry, idx) => {
                    const id = entry.id;
                    const expanded = expandedEntries.has(id);
                    return (
                      <div key={id}>
                        <button
                          onClick={() => toggleEntry(id)}
                          className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-slate-800/40 transition-colors"
                        >
                          <span className="mt-0.5 shrink-0 font-mono text-[11px] text-orange-400/80">
                            {bragId(idx)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300">
                                {entry.claimType}
                              </span>
                              <StatusBadge
                                status={entry.result.status as 'pass' | 'partial' | 'fail'}
                              />
                              <span className="ml-auto text-[11px] text-slate-500">
                                impact {entry.result.impactScore > 0 ? '+' : ''}
                                {entry.result.impactScore}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-white">{entry.claim}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {entry.entityName || 'audit-wide'}
                            </p>
                          </div>
                          {expanded ? (
                            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                          ) : (
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                          )}
                        </button>

                        {expanded && (
                          <div className="border-t border-slate-800 bg-slate-950/60 px-5 py-4 space-y-3">
                            {/* Evidence refs */}
                            {entry.evidenceRefs.length > 0 && (
                              <div>
                                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                                  Evidence
                                </p>
                                <div className="space-y-2">
                                  {entry.evidenceRefs.map((ref, ri) => (
                                    <div
                                      key={ri}
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                                    >
                                      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                                        <span>{ref.type}</span>
                                        <span>·</span>
                                        <span>{ref.location}</span>
                                      </div>
                                      <p className="text-xs text-slate-300">{ref.excerpt}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recommendation */}
                            {entry.result.recommendation && (
                              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-orange-400/70">
                                  Fix
                                </p>
                                <p className="text-xs text-slate-200">
                                  {entry.result.recommendation}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-12 text-center">
                <Database className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                <p className="text-sm font-medium text-slate-300">No ledger projection yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Run your first audit to populate the cite ledger.
                </p>
                <a
                  href="/app/scan"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition-colors"
                >
                  Run Audit
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            )}
          </section>

          {/* ── SECTION 4: WHY OTHER TOOLS FAIL ─────────────────────────── */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Competitive Position
            </p>
            <h2 className="mb-6 text-xl font-bold text-white">Why Other Audits Fail</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-rose-400">
                  Most audits
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {[
                    'Generic checklists applied to every page',
                    'Assumptions based on page type',
                    'No proof layer — scores appear from nowhere',
                    "No traceability — you can't verify the logic",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  CITE LEDGER
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {[
                    'Evidence-based only — real page data',
                    'Page-specific analysis per URL',
                    'Every score is auditable via BRAG ID',
                    'No hidden logic — trace any finding',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ── SECTION 5: 7 DIMENSIONS ──────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Scoring Model
            </p>
            <h2 className="mb-1 text-xl font-bold text-white">The 7 Dimensions</h2>
            <p className="mb-6 text-sm text-slate-400">Weighted, engineered, and non-negotiable.</p>
            <div className="space-y-3">
              {SEVEN_DIMENSIONS.map((dim) => (
                <div key={dim.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`text-sm font-medium ${dim.color}`}>{dim.label}</span>
                    <span className="font-mono text-xs text-slate-400">{dim.weight}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${dim.bar} ${dim.width}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-200">
                Hard caps apply if critical signals are missing. A perfect content score cannot
                compensate for missing schema or broken crawl signals.
              </p>
            </div>
          </section>

          {/* ── SECTION 6: BRAG SYSTEM ───────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Audit ID System
            </p>
            <h2 className="mb-1 text-xl font-bold text-white">BRAG System</h2>
            <p className="mb-1 text-sm text-slate-400">
              <span className="font-semibold text-slate-200">B</span>ased{' '}
              <span className="font-semibold text-slate-200">R</span>etrieval{' '}
              <span className="font-semibold text-slate-200">A</span>uditable{' '}
              <span className="font-semibold text-slate-200">G</span>rading
            </p>
            <p className="mb-6 text-sm text-slate-400">
              Every issue has a BRAG ID. Every BRAG ID maps to real evidence. Every fix updates the
              ID state in the ledger.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-rose-400">
                  Before Fix
                </p>
                <div className="flex items-center gap-3">
                  <span className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 font-mono text-sm text-orange-300">
                    CL-0421
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600" />
                  <span className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-rose-300">
                    FAIL
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Author schema missing. No{' '}
                  <code className="font-mono text-slate-300">&lt;author&gt;</code> detected.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                  After Fix
                </p>
                <div className="flex items-center gap-3">
                  <span className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 font-mono text-sm text-orange-300">
                    CL-0421
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600" />
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-emerald-300">
                    PASS
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Author schema added. Audit trail updated in real-time.
                </p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">
              That's your moat. Traceable. Immutable. Unfakeable.
            </p>
          </section>

          {/* ── SECTION 7: PATTERN REGISTRY + LIVE TRACEABILITY ─────────── */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-700 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Live Traceability
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-white">Pattern Registry</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Click any score → see evidence → see page location → see fix instructions
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search patterns"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 shrink-0 text-slate-500" />
                    <select
                      aria-label="Filter evidence registry by category"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as any)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="all">All categories</option>
                      <option value="schema">Schema</option>
                      <option value="content">Content</option>
                      <option value="entity">Entity</option>
                      <option value="mandatory_seo">Mandatory SEO</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1.2fr)_140px_100px_80px_170px] gap-4 border-b border-slate-700/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>Pattern</span>
              <span>Category</span>
              <span>Impact</span>
              <span>Observed</span>
              <span>Status</span>
            </div>

            {filteredRegistry.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No registry patterns match your filter.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredRegistry.slice(0, 120).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1.2fr)_140px_100px_80px_170px] gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.label}</p>
                    </div>
                    <span className="text-xs capitalize text-slate-400">
                      {item.category.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{item.impactScore}</span>
                    <span className="font-mono text-xs text-slate-400">{item.observedCount}×</span>
                    <span
                      className={`inline-flex w-max items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${item.status === 'verified' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}
                    >
                      {item.status === 'verified' ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── SECTION 8: WHY THIS MATTERS ──────────────────────────────── */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              The Real Problem
            </p>
            <h2 className="mb-6 text-xl font-bold text-white">Why This Matters</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <Zap className="h-5 w-5 text-rose-400" />,
                  heading: "AI doesn't rank",
                  body: "AI answer engines don't use PageRank. They use trust signals — and missing signals mean you simply don't exist in the answer.",
                },
                {
                  icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
                  heading: 'Weak evidence = displacement',
                  body: "If your evidence signals are weaker than a competitor's, AI models cite them instead. No ranking involved — pure trust weighting.",
                },
                {
                  icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
                  heading: 'CITE LEDGER = trust layer',
                  body: 'Every finding in your ledger maps directly to a trust signal AI models evaluate. Fix the evidence, increase citation probability.',
                },
              ].map((card) => (
                <div
                  key={card.heading}
                  className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                >
                  <div className="mb-3">{card.icon}</div>
                  <p className="mb-1.5 text-sm font-semibold text-white">{card.heading}</p>
                  <p className="text-xs leading-relaxed text-slate-400">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-5 py-4">
              <Target className="h-5 w-5 shrink-0 text-orange-400" />
              <p className="text-sm text-slate-300">
                Mandatory SEO acts as a floor for visibility. Missing structural factors reduce
                reachable citation ceiling — even if content quality is strong.
              </p>
            </div>
          </section>

          {/* ── SECTION 9: COMPARISON TABLE ──────────────────────────────── */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-700 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Side by Side
              </p>
              <h2 className="mt-0.5 text-base font-bold text-white">
                SEO Tools vs AiVIS CITE LEDGER
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[11px] uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-5 py-3 text-left font-semibold">Feature</th>
                  <th className="px-5 py-3 text-center font-semibold">SEO Tools</th>
                  <th className="px-5 py-3 text-center font-semibold text-orange-400">
                    AiVIS CITE LEDGER
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-slate-200">{row}</td>
                    <td className="px-5 py-3 text-center">
                      <XCircle className="mx-auto h-4 w-4 text-rose-500" />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── SECTION 10: FINAL CTA ─────────────────────────────────────── */}
          <section className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 text-center">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-orange-400/70">
              Final Judgment
            </p>
            <h2 className="mx-auto mb-4 max-w-xl text-2xl font-bold leading-snug text-white sm:text-3xl">
              You don't need another audit.
              <br />
              <span className="text-orange-300">
                You need proof that AI will trust your content.
              </span>
            </h2>
            <p className="mx-auto mb-6 max-w-md text-sm text-slate-400">
              CITE LEDGER is not a score generator. It's a system of record — like Stripe logs or a
              blockchain explorer — but for AI citation trust.
            </p>
            <a
              href="/app/scan"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-400 transition-colors"
            >
              Run Your CITE LEDGER Audit
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        </div>
      )}
    </AppPageFrame>
  );
}
