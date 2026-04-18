import React, { useEffect, useMemo, useState } from "react";
import { Database, ShieldCheck, AlertTriangle, Target, Search, Filter } from "lucide-react";
import AppPageFrame from "../components/AppPageFrame";
import Spinner from "../components/Spinner";
import apiFetch from "../utils/api";

interface AuditRow {
  id?: string;
  url?: string;
  visibility_score?: number;
  seo_diagnostics?: Record<string, { status?: "pass" | "warn" | "fail" }>;
  recommendations?: Array<{ title?: string; description?: string; implementation?: string; category?: string }>;
  query_insights?: Array<{ query?: string; niche?: string; score?: number }>;
}

interface RegistryPattern {
  id: string;
  label: string;
  category: "schema" | "content" | "entity" | "mandatory_seo";
  observedCount: number;
  impactScore: number;
  status: "verified" | "candidate";
}

function normalizeCategory(raw?: string): RegistryPattern["category"] {
  const v = (raw || "").toLowerCase();
  if (v.includes("schema") || v.includes("json-ld")) return "schema";
  if (v.includes("entity") || v.includes("brand")) return "entity";
  if (v.includes("seo") || v.includes("wcag") || v.includes("robots") || v.includes("canonical")) return "mandatory_seo";
  return "content";
}

export default function EvidenceRegistryPage() {
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | RegistryPattern["category"]>("all");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch("/api/audits?limit=100");
        const payload = await response.json().catch(() => null) as { audits?: AuditRow[] } | AuditRow[] | null;
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.audits) ? payload.audits : [];
        if (!cancelled) setAudits(rows);
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
        const weight = typeof audit.visibility_score === "number" ? Math.max(1, Math.round((100 - audit.visibility_score) / 10)) : 1;

        if (!prev) {
          map.set(id, {
            id,
            label,
            category: normalizeCategory(rec.category || rec.implementation || rec.title),
            observedCount: 1,
            impactScore: weight,
            status: "candidate",
          });
          return;
        }

        prev.observedCount += 1;
        prev.impactScore += weight;
      });

      const seo = audit.seo_diagnostics;
      if (seo && typeof seo === "object") {
        Object.entries(seo).forEach(([check, value]) => {
          if (value?.status !== "fail") return;
          const label = `Mandatory SEO: ${check.replace(/_/g, " ")}`;
          const id = label.toLowerCase();
          const prev = map.get(id);
          if (!prev) {
            map.set(id, {
              id,
              label,
              category: "mandatory_seo",
              observedCount: 1,
              impactScore: 2,
              status: "candidate",
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
        status: item.observedCount >= 3 ? "verified" as const : "candidate" as const,
      }))
      .sort((a, b) => b.impactScore - a.impactScore);
  }, [audits]);

  const filteredRegistry = useMemo(() => {
    return registry.filter((item) => {
      const matchesFilter = categoryFilter === "all" || item.category === categoryFilter;
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
        if (check?.status === "pass") pass += 1;
        else if (check?.status === "warn") warn += 1;
        else if (check?.status === "fail") fail += 1;
      });
    });

    return { pass, warn, fail };
  }, [audits]);

  return (
    <AppPageFrame
      icon={<Database className="h-5 w-5 text-orange-300" />}
      title="Evidence Registry"
      subtitle="CITE LEDGER-backed pattern inventory from historical audits, including Mandatory SEO factors and model query gaps."
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/70">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Verified Patterns</p>
              <p className="mt-2 text-3xl font-semibold text-white">{registry.filter((p) => p.status === "verified").length}</p>
              <p className="mt-1 text-sm text-slate-400">Patterns seen in 3+ audits</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Mandatory SEO Fails</p>
              <p className="mt-2 text-3xl font-semibold text-rose-300">{seoHealth.fail}</p>
              <p className="mt-1 text-sm text-slate-400">Structural blockers reducing visibility</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Registry Entries</p>
              <p className="mt-2 text-3xl font-semibold text-cyan-300">{registry.length}</p>
              <p className="mt-1 text-sm text-slate-400">All extracted patterns across audits</p>
            </div>
          </section>

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
              <div className="py-10 text-center text-sm text-slate-400">No registry patterns match your filter.</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {filteredRegistry.slice(0, 120).map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1.2fr)_140px_140px_170px] gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.label}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Impact score: {item.impactScore}</p>
                    </div>
                    <span className="text-xs text-slate-300 capitalize">{item.category.replace("_", " ")}</span>
                    <span className="text-xs text-slate-300">{item.observedCount}</span>
                    <span className={`inline-flex w-max items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${item.status === "verified" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"}`}>
                      {item.status === "verified" ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
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
              Mandatory SEO is scored separately and acts as a floor for visibility. Missing structural factors (schema coverage,
              crawlability, canonical integrity, accessibility signals) reduce reachable citation ceiling even if content quality is strong.
            </p>
          </section>
        </div>
      )}
    </AppPageFrame>
  );
}
