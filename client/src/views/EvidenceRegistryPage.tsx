import React, { useEffect, useMemo, useState } from 'react';
import { Database, ShieldCheck, AlertTriangle, Target, Search, Filter } from 'lucide-react';
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

export default function EvidenceRegistryPage() {
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [latestProjection, setLatestProjection] = useState<EvidenceLedgerProjection | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RegistryPattern['category']>('all');

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

  return (
    <AppPageFrame
      icon={<Database className="h-5 w-5 text-orange-300" />}
      title="Evidence Registry"
      subtitle="Live ledger explorer: every score, mismatch, and citation judgment is rendered as claim → evidence → computation → result."
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/70">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Ledger Entries</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {latestProjection?.totals.entryCount ?? registry.length}
              </p>
              <p className="mt-1 text-sm text-slate-400">
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
              <p className="mt-1 text-sm text-slate-400">
                Aggregate score effect from the latest ledger projection
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Evidence Count</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-300">
                {latestProjection?.totals.evidenceCount ??
                  seoHealth.fail + seoHealth.warn + seoHealth.pass}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Underlying evidence refs in the latest projection
              </p>
            </div>
          </section>

          {latestProjection && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    Latest audit projection
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white break-all">
                    {latestProjection.url}
                  </h2>
                </div>
                <div className="text-right text-sm text-slate-400">
                  <div>{latestProjection.auditId}</div>
                  <div>{new Date(latestProjection.generatedAt).toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {latestProjection.entries.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-white/10 bg-slate-950/45 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                        {entry.claimType}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${entry.result.status === 'pass' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : entry.result.status === 'partial' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}
                      >
                        {entry.result.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white">{entry.claim}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>{entry.entityName || 'audit-wide'}</span>
                      <span>impact {entry.result.impactScore}</span>
                    </div>
                    {entry.evidenceRefs[0] && (
                      <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-slate-300">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">
                          {entry.evidenceRefs[0].type} · {entry.evidenceRefs[0].location}
                        </div>
                        <div className="mt-1 line-clamp-3">{entry.evidenceRefs[0].excerpt}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search registry patterns"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
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
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1.2fr)_140px_140px_170px] gap-4 border-b border-slate-700 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span>Pattern</span>
              <span>Category</span>
              <span>Observed</span>
              <span>Status</span>
            </div>
            {filteredRegistry.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No registry patterns match your filter.
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {filteredRegistry.slice(0, 120).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1.2fr)_140px_140px_170px] gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.label}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Impact score: {item.impactScore}
                      </p>
                    </div>
                    <span className="text-xs text-slate-300 capitalize">
                      {item.category.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-300">{item.observedCount}</span>
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

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-center gap-2 text-orange-200">
              <Target className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Mandatory SEO Impact Model</h2>
            </div>
            <p className="text-sm text-slate-300">
              Mandatory SEO is scored separately and acts as a floor for visibility. Missing
              structural factors (schema coverage, crawlability, canonical integrity, accessibility
              signals) reduce reachable citation ceiling even if content quality is strong.
            </p>
          </section>
        </div>
      )}
    </AppPageFrame>
  );
}
