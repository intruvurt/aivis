import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useAnalysisStore } from '../stores/analysisStore';
import CompetitorManager from '../components/CompetitorManager';
import CompetitorComparison from '../components/CompetitorComparison';
import UpgradeWall from '../components/UpgradeWall';
import { meetsMinimumTier } from '@shared/types';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { CompetitorRadarIcon } from '../components/icons';
import { usePageMeta } from '../hooks/usePageMeta';
import { API_URL } from '../config';
import apiFetch from '../utils/api';
import { buildWebPageSchema } from '../lib/seoSchema';

const COMPETITOR_TARGET_URL_KEY = 'aivis-competitor-target-url';

type AuditListResponse = {
  audits?: Array<{
    url?: string;
  }>;
};

function normalizeUrlInput(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(candidate);

  if (
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '0.0.0.0'
  ) {
    throw new Error('Invalid host');
  }

  return parsed.href;
}

export default function CompetitorsPage() {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const hasAccess = meetsMinimumTier(user?.tier || 'observer', 'alignment');
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: 'Competitors',
    description:
      'Track competitors and compare search answer-style visibility side by side to see who owns that answer space.',
    path: '/competitors',
    structuredData: [
      buildWebPageSchema({
        path: '/competitors',
        name: 'Competitor AI Visibility Comparison | AiVIS.biz',
        description:
          'Compare your AI visibility scores against competitors. Identify structural gaps, evidence deficits, and schema mismatches that explain why competitors appear in AI answers where you do not.',
      }),
    ],
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [comparisonUrl, setComparisonUrl] = useState('');
  const [comparisonUrlInput, setComparisonUrlInput] = useState('');
  const [comparisonUrlError, setComparisonUrlError] = useState<string | null>(null);
  const [recentAuditUrls, setRecentAuditUrls] = useState<string[]>([]);
  const [recentAuditLoading, setRecentAuditLoading] = useState(false);

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth?mode=signin');
    }
  }, [isAuthenticated, navigate]);

  React.useEffect(() => {
    if (!isAuthenticated) return;

    const stored = window.localStorage.getItem(COMPETITOR_TARGET_URL_KEY) || '';

    if (stored) {
      setComparisonUrl(stored);
      setComparisonUrlInput(stored);
      return;
    }

    if (latestResult?.url) {
      setComparisonUrl(latestResult.url);
      setComparisonUrlInput(latestResult.url);
    }
  }, [isAuthenticated, latestResult?.url]);

  React.useEffect(() => {
    if (!token || !hasAccess || !isAuthenticated) return;

    let isMounted = true;

    const loadRecentAuditUrls = async () => {
      try {
        setRecentAuditLoading(true);

        const response = await apiFetch(`${API_URL}/api/audits?limit=100`);
        const data = (await response.json().catch(() => ({}))) as AuditListResponse;

        const urls = Array.isArray(data?.audits)
          ? data.audits.map((audit) => String(audit?.url || '').trim()).filter(Boolean)
          : [];

        const seen = new Set<string>();
        const deduped: string[] = [];

        for (const url of urls) {
          try {
            const normalized = normalizeUrlInput(url);
            if (!seen.has(normalized)) {
              seen.add(normalized);
              deduped.push(normalized);
            }
          } catch {
            // ignore malformed historical URLs
          }

          if (deduped.length >= 20) break;
        }

        if (isMounted) {
          setRecentAuditUrls(deduped);
        }
      } catch {
        if (isMounted) {
          setRecentAuditUrls([]);
        }
      } finally {
        if (isMounted) {
          setRecentAuditLoading(false);
        }
      }
    };

    void loadRecentAuditUrls();

    return () => {
      isMounted = false;
    };
  }, [token, hasAccess, isAuthenticated, latestResult?.url]);

  function applyComparisonUrl() {
    try {
      const normalized = normalizeUrlInput(comparisonUrlInput);

      setComparisonUrl(normalized);
      setComparisonUrlInput(normalized);
      setComparisonUrlError(null);
      window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, normalized);
      setRefreshKey((k) => k + 1);
    } catch {
      setComparisonUrl('');
      setComparisonUrlError('Enter a valid URL, e.g. https://example.com');
    }
  }

  function useLatestAuditUrl() {
    const url = latestResult?.url || '';
    if (!url) return;

    setComparisonUrl(url);
    setComparisonUrlInput(url);
    setComparisonUrlError(null);
    window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, url);
    setRefreshKey((k) => k + 1);
  }

  function useRecentAuditUrl(url: string) {
    if (!url) return;

    setComparisonUrl(url);
    setComparisonUrlInput(url);
    setComparisonUrlError(null);
    window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, url);
    setRefreshKey((k) => k + 1);
  }

  function handleCompetitorScanComplete(scannedUrl: string) {
    if (!scannedUrl) return;
    setComparisonUrl(scannedUrl);
    setComparisonUrlInput(scannedUrl);
    setComparisonUrlError(null);
    window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, scannedUrl);
    setRefreshKey((k) => k + 1);
  }

  const userTier = user?.tier || 'observer';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-charcoal to-charcoal p-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
          <Sparkles className="h-3.5 w-3.5" />
          Competitor AI Advantage
        </p>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-white">
          <CompetitorRadarIcon className="h-6 w-6 text-slate-300" />
          Competitor AI Advantage
        </h1>
        <p className="mt-2 text-sm text-white/70">
          These pages are being cited by AI. Here is why they win and exactly what to fix.
        </p>
      </section>

      <div className="space-y-6">
        {!hasAccess ? (
          <UpgradeWall
            feature="Competitor Intelligence"
            description="See who is winning AI citations and get action-first remediation plans."
            requiredTier="alignment"
            icon={<CompetitorRadarIcon className="h-12 w-12 text-white/80" />}
            featurePreview={[
              'Why competitors are cited and you are not',
              'Top missing structure and schema gaps',
              'One-click fix generation (Signal)',
            ]}
          />
        ) : (
          <>
            <section className="rounded-xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8">
              <div className="flex items-center gap-2">
                <CompetitorRadarIcon className="h-4 w-4 text-white/75" />
                <h2 className="text-lg font-semibold text-white">Comparison target</h2>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <label className="text-xs text-white/60">Your page URL</label>

                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    type="text"
                    value={comparisonUrlInput}
                    onChange={(e) => setComparisonUrlInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && comparisonUrlInput.trim() && applyComparisonUrl()
                    }
                    enterKeyHint="done"
                    placeholder="https://your-site.com"
                    className="flex-1 rounded-lg border border-white/10 bg-charcoal-deep px-3 py-2 text-sm text-white placeholder:text-white/50"
                  />
                  <button
                    onClick={applyComparisonUrl}
                    className="rounded-lg bg-charcoal-deep px-3 py-2 text-sm text-white/85 transition-colors hover:bg-charcoal-light"
                    type="button"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <button
                    onClick={useLatestAuditUrl}
                    disabled={!latestResult?.url}
                    className="rounded-lg border border-white/10 bg-charcoal-deep px-3 py-2 text-sm text-white/75 disabled:opacity-40"
                    type="button"
                  >
                    Use Latest Audit
                  </button>

                  <div className="relative flex-1">
                    <select
                      value=""
                      onChange={(e) => useRecentAuditUrl(e.target.value)}
                      disabled={recentAuditLoading || recentAuditUrls.length === 0}
                      aria-label="Pick a recent audited URL"
                      title="Pick a recent audited URL"
                      className="w-full appearance-none rounded-lg border border-white/10 bg-charcoal-deep px-3 py-2 pr-10 text-sm text-white/75 disabled:opacity-40"
                    >
                      <option value="">
                        {recentAuditLoading
                          ? 'Loading recent audits...'
                          : recentAuditUrls.length > 0
                            ? 'Pick from recent audits'
                            : 'No recent audits found'}
                      </option>
                      {recentAuditUrls.map((url) => (
                        <option key={url} value={url}>
                          {url}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                  </div>
                </div>

                {comparisonUrlError && (
                  <p className="text-xs text-white/80">{comparisonUrlError}</p>
                )}
              </div>
            </section>

            {comparisonUrl ? (
              <section className="space-y-6">
                <CompetitorManager
                  token={token}
                  comparisonUrl={comparisonUrl}
                  onCompetitorsChange={() => setRefreshKey((k) => k + 1)}
                  onScanComplete={handleCompetitorScanComplete}
                />

                <CompetitorComparison
                  key={`${refreshKey}:${comparisonUrl}`}
                  yourUrl={comparisonUrl}
                  token={token}
                  userTier={userTier}
                />
              </section>
            ) : (
              <section className="rounded-xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-200">
                      <Globe className="h-3.5 w-3.5" />
                      Baseline required first
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-white">
                      Set your site URL before comparing competitors
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
                      Set your page URL, add competitors, and immediately see why they are getting
                      cited and what to fix next.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => navigate('/app/analyze')}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-white/28 to-white/14 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
                        type="button"
                      >
                        Run an audit
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate('/app')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-surface-raised px-6 py-3 text-sm text-white/75 transition-colors hover:text-white"
                        type="button"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
                    <div className="text-xs uppercase tracking-wide text-white/45">
                      Why this works
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        'Shows where competitors are easier for AI to extract',
                        'Turns missing structure into clear next actions',
                        'Connects insight directly to fix generation',
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-2 text-sm text-white/70">
                          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
