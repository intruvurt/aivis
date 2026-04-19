import React, { useState, useMemo, useCallback } from 'react';
import { Check, Copy, ExternalLink, Eye, MousePointerClick, Globe } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePageMeta } from '../hooks/usePageMeta';

const API_URL = import.meta.env.VITE_API_URL || '';
const SITE_URL = API_URL ? new URL(API_URL).origin : 'https://aivis.biz';

export default function BadgeEmbedPage() {
  usePageMeta({
    title: 'Visibility Badge',
    description: 'Embed the AiVIS.biz visibility badge on your website to signal AI citation readiness and track impressions.',
    path: '/badge',
  });

  const user = useAuthStore((s) => s.user);
  const uid = user?.id || '';

  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{
    impressions: { count: number; unique_domains: number };
    clicks: { count: number; unique_domains: number };
    top_domains: { referrer_domain: string; hits: number }[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const badgeImageUrl = `${SITE_URL}/aivis-footer-badge-dofollow.png`;
  const clickUrl = `${SITE_URL}/api/badge/click${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`;
  const trackPixelUrl = `${SITE_URL}/api/badge/img${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`;

  const snippet = useMemo(
    () =>
      `<!-- AiVIS.biz Visibility Badge -->\n<a href="${clickUrl}" target="_blank" rel="dofollow" title="AI Visibility Audit by AiVIS.biz">\n  <img src="${badgeImageUrl}" alt="Audited by AiVIS.biz – AI Visibility Audit" width="150" height="42" style="border:0;" loading="lazy" />\n</a>\n<img src="${trackPixelUrl}" alt="" width="1" height="1" style="position:absolute;opacity:0;pointer-events:none;" aria-hidden="true" />`,
    [clickUrl, badgeImageUrl, trackPixelUrl],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: select text */
    }
  }, [snippet]);

  const fetchStats = useCallback(async () => {
    if (!uid) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/badge/stats?uid=${encodeURIComponent(uid)}`);
      if (res.ok) setStats(await res.json());
    } catch {
      /* silent */
    } finally {
      setStatsLoading(false);
    }
  }, [uid]);

  return (
    <div className="min-h-screen bg-[#060607] text-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AiVIS.biz Dofollow <span className="text-cyan-400">Backlink Badge</span>
          </h1>
          <p className="mt-3 text-sm text-gray-400 max-w-xl mx-auto">
            Add a professionally designed badge to your website footer. You earn a
            high-quality <span className="text-cyan-300 font-medium">dofollow backlink</span> to
            boost your SEO while showing visitors your site is AI-visibility audited.
            Every impression and click is tracked so you can measure referral impact.
          </p>
        </div>

        {/* Badge Preview */}
        <div className="rounded-xl border border-white/10 bg-charcoal-deep/50 p-6 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Preview</h2>
          <div className="flex items-center justify-center rounded-lg bg-[#0d0d10] border border-white/5 p-8">
            <a href={clickUrl} target="_blank" rel="dofollow noopener" title="AI Visibility Audit by AiVIS.biz">
              <img
                src="/aivis-footer-badge-dofollow.png"
                alt="Audited by AiVIS.biz – AI Visibility Audit"
                width={150}
                height={42}
                className="h-auto"
              />
            </a>
          </div>
        </div>

        {/* Embed Code */}
        <div className="rounded-xl border border-white/10 bg-charcoal-deep/50 p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Embed Code
            </h2>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-[#0d0d10] border border-white/5 p-4 text-[13px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap break-all select-all">
            {snippet}
          </pre>
          <p className="mt-3 text-xs text-gray-500">
            Paste this snippet into your website footer HTML. The badge links back to AiVIS.biz
            with a <code className="text-cyan-400/80">rel="dofollow"</code> attribute and includes
            a 1×1 tracking pixel for impression counting.
          </p>
        </div>

        {/* How It Works */}
        <div className="rounded-xl border border-white/10 bg-charcoal-deep/50 p-6 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                <ExternalLink className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Dofollow Link</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Search engines follow the link, passing authority to your site and AiVIS.biz.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                <Eye className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Impression Tracking</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  A hidden 1×1 pixel records every page view where the badge appears.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                <MousePointerClick className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Click Analytics</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Every click routes through a tracker so you can see referral traffic.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats (authenticated users only) */}
        {uid && (
          <div className="rounded-xl border border-white/10 bg-charcoal-deep/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Your Badge Analytics
              </h2>
              <button
                onClick={fetchStats}
                disabled={statsLoading}
                className="flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {statsLoading ? 'Loading…' : 'Refresh Stats'}
              </button>
            </div>

            {stats ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    icon={<Eye className="h-4 w-4 text-cyan-400" />}
                    label="Impressions"
                    value={stats.impressions.count}
                  />
                  <StatCard
                    icon={<MousePointerClick className="h-4 w-4 text-emerald-400" />}
                    label="Clicks"
                    value={stats.clicks.count}
                  />
                  <StatCard
                    icon={<Globe className="h-4 w-4 text-purple-400" />}
                    label="Unique Domains"
                    value={stats.impressions.unique_domains}
                  />
                </div>

                {stats.top_domains.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 mb-2">Top Referring Domains</h3>
                    <div className="divide-y divide-white/5 rounded-lg border border-white/5 bg-[#0d0d10]">
                      {stats.top_domains.map((d) => (
                        <div key={d.referrer_domain} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-gray-300 truncate">{d.referrer_domain}</span>
                          <span className="text-xs text-gray-500 tabular-nums">{d.hits} hits</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Click "Refresh Stats" to load your badge impression and click data.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d0d10] p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
