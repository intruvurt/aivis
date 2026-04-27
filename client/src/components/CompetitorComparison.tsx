import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Target,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import type { CompetitorComparison as ComparisonType, CompetitorFixPayload } from '@shared/types';
import Spinner from './Spinner';
import { API_URL } from '../config';
import apiFetch from '../utils/api';
import { toSafeHref } from '../utils/safeHref';

interface CompetitorComparisonProps {
  yourUrl: string;
  token?: string;
  userTier?: string;
}

function humanizeGap(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function CompetitorComparison({ yourUrl, token }: CompetitorComparisonProps) {
  const [comparison, setComparison] = useState<ComparisonType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<CompetitorFixPayload | null>(null);
  const [fixesLoading, setFixesLoading] = useState(false);
  const [fixesError, setFixesError] = useState<string | null>(null);

  useEffect(() => {
    if (!yourUrl || !token) return;
    const controller = new AbortController();
    void fetchComparison(controller.signal);
    return () => controller.abort();
  }, [yourUrl, token]);

  async function fetchComparison(signal?: AbortSignal) {
    if (!yourUrl || !token) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch(
        `${API_URL}/api/competitors/comparison?url=${encodeURIComponent(yourUrl)}`,
        { signal }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error || 'Failed to fetch comparison');
      }
      const data = await response.json();
      setComparison(data.comparison as ComparisonType);
      setFixes(null);
      setFixesError(null);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(String(err?.message || 'Failed to fetch comparison'));
    } finally {
      setLoading(false);
    }
  }

  async function generateFixes() {
    if (!comparison || fixesLoading) return;
    if (!comparison.feature_gate.can_generate_fixes) {
      setFixesError('Upgrade to Signal to unlock automated fix generation.');
      return;
    }

    try {
      setFixesLoading(true);
      setFixesError(null);
      const response = await apiFetch(`${API_URL}/api/competitors/generate-fix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: comparison.your_url,
          gaps: comparison.competitor_insights.gaps.missing,
          competitor_format: comparison.competitor_insights.ai_behavior.competitor_format,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error || 'Failed to generate fixes');
      }

      const data = await response.json();
      setFixes(data.fixes as CompetitorFixPayload);
    } catch (err: any) {
      setFixesError(String(err?.message || 'Failed to generate fixes'));
    } finally {
      setFixesLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-8 text-center">
        <Spinner className="inline-block h-8 w-8" />
        <p className="mt-4 text-sm text-white/60">Loading competitor advantage insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-white/75" />
          <div>
            <p className="text-sm font-semibold text-white">
              Unable to load competitor intelligence
            </p>
            <p className="mt-1 text-xs text-white/60">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison || comparison.competitors.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-8 text-center">
        <p className="text-sm text-white/70">
          Add at least one competitor to see why they are being cited and what to fix next.
        </p>
      </div>
    );
  }

  const insights = comparison.competitor_insights;
  const topCompetitors = insights.top_competitors.slice(0, 3);
  const missingList = [...insights.gaps.missing, ...insights.gaps.weak];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-charcoal to-charcoal p-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
          <Sparkles className="h-3.5 w-3.5" />
          Competitor AI Advantage
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          These pages are being cited by AI. Here is why they win.
        </h3>
      </section>

      <section className="space-y-3">
        <h4 className="text-lg font-semibold text-white">Top competitor wins</h4>
        <div className="grid gap-4 md:grid-cols-3">
          {topCompetitors.map((competitor) => (
            <article
              key={competitor.domain}
              className="rounded-2xl border border-white/10 bg-charcoal p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{competitor.domain}</p>
                  <p className="mt-1 text-xs text-white/60">
                    Being cited for: {competitor.cited_for[0] || 'informational queries'}
                  </p>
                </div>
                <a
                  href={toSafeHref(`https://${competitor.domain}`) || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white"
                  aria-label={`Open ${competitor.domain}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-4 space-y-2">
                {competitor.strengths.slice(0, 3).map((strength) => (
                  <p key={strength} className="text-xs text-emerald-200/90">
                    - {strength}
                  </p>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-red-200/85">
                  What you are missing
                </p>
                <ul className="mt-2 space-y-1 text-xs text-red-100/85">
                  {insights.gaps.missing.slice(0, 2).map((gap) => (
                    <li key={`${competitor.domain}-${gap}`}>- {humanizeGap(gap)}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-6">
        <h4 className="text-lg font-semibold text-amber-100">You are losing citations because:</h4>
        <ol className="mt-3 space-y-2 text-sm text-amber-50/90">
          {missingList.slice(0, 3).map((item) => (
            <li key={item}>{humanizeGap(item)}</li>
          ))}
        </ol>

        <div className="mt-5">
          <button
            type="button"
            onClick={generateFixes}
            disabled={fixesLoading}
            className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-charcoal transition hover:bg-white disabled:opacity-60"
          >
            {fixesLoading ? 'Generating Fixes...' : 'Fix My Page to Match Competitors'}
            <ArrowRight className="h-4 w-4" />
          </button>
          {comparison.feature_gate.preview_limited && (
            <p className="mt-2 text-xs text-amber-100/80">
              Signal unlocks full action list and automated fix generation.
            </p>
          )}
          {fixesError && <p className="mt-2 text-xs text-red-100">{fixesError}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-charcoal p-6">
        <h4 className="text-lg font-semibold text-white">Simple comparison</h4>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-charcoal-deep text-white/70">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Signal</th>
                <th className="px-4 py-2 text-left font-medium">You</th>
                <th className="px-4 py-2 text-left font-medium">Competitor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-charcoal">
              {insights.comparison.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2 text-white">{row.label}</td>
                  <td className="px-4 py-2 text-white/80">{row.you ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 text-white/80">{row.competitor ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-charcoal p-6">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-white/75" />
          <h4 className="text-lg font-semibold text-white">AI behavior insight</h4>
        </div>
        <p className="mt-3 text-sm text-white/80">{insights.ai_behavior.summary}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/75">
            <p className="text-[11px] uppercase tracking-wide text-white/50">Competitor format</p>
            <p className="mt-1 text-sm text-white">{insights.ai_behavior.competitor_format}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/75">
            <p className="text-[11px] uppercase tracking-wide text-white/50">Your format</p>
            <p className="mt-1 text-sm text-white">{insights.ai_behavior.your_format}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/75">
            <p className="text-[11px] uppercase tracking-wide text-white/50">Fix</p>
            <p className="mt-1 text-sm text-white">{insights.ai_behavior.fix}</p>
          </div>
        </div>
      </section>

      {fixes && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-6">
          <div className="flex items-center gap-2 text-emerald-100">
            <Wand2 className="h-4 w-4" />
            <h4 className="text-lg font-semibold">Generated fixes</h4>
          </div>

          <div className="mt-4 space-y-4 text-sm text-emerald-50/95">
            <div className="rounded-xl border border-emerald-300/20 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/70">
                Definition block
              </p>
              <p className="mt-2">{fixes.definition_block}</p>
            </div>

            <div className="rounded-xl border border-emerald-300/20 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/70">FAQ section</p>
              <ul className="mt-2 space-y-2">
                {fixes.faq_section.map((item) => (
                  <li key={item.question}>
                    <p className="font-semibold">{item.question}</p>
                    <p className="text-emerald-50/85">{item.answer}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-emerald-300/20 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/70">
                JSON-LD schema
              </p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-emerald-50/90">
                {JSON.stringify(fixes.schema, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}

      {comparison.feature_gate.preview_limited && (
        <section className="rounded-2xl border border-white/10 bg-charcoal p-4 text-xs text-white/65">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-white/70" />
            <p>
              Alignment includes competitor advantage diagnostics. Signal unlocks complete action
              depth and one-click fix generation.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
