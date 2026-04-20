// Landing - AiVIS.biz
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardPaste } from 'lucide-react';
import { normalizePublicUrlInput } from '../utils/targetKey';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import { MARKETING_CLAIMS } from '../constants/marketingClaims';
import { PRICING, annualMonthlyPrice } from '../../../shared/types';
import {
  META,
  OG,
  HERO,
  SCORING_CATEGORIES,
  BRAND,
  PLATFORM_TARGETS,
  generateHomepageStructuredData,
  HOMEPAGE_FAQ_ITEMS,
  HomepageGuard,
} from '../homepage';

interface PlatformStats {
  status: string; db: string; uptime: number;
  totalUsers?: number; completedAudits?: number; averageScore?: number;
}

async function getPlatformStats(): Promise<PlatformStats | null> {
  try { const r = await fetch(`${API_URL}/api/health`); if (!r.ok) return null; return r.json(); } catch { return null; }
}

const paymentService = {
  createStripeCheckout: async (tier: string): Promise<string> => {
    const token = useAuthStore.getState().token;
    const r = await fetch(`${API_URL}/api/payment/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tier: tier.toLowerCase() }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: 'Checkout request failed' }));
      throw new Error(err.error || `Checkout failed (${r.status})`);
    }
    const data = await r.json();
    if (!data.success) throw new Error(data.error || 'Checkout failed');
    return data.data;
  },
};

const LANDING_STRUCTURED_DATA = generateHomepageStructuredData();

const FAQ_ITEMS = HOMEPAGE_FAQ_ITEMS;

// ─── Live score animation for hero visual ────────────────────────────────────
function useAnimatedScore(initial: number) {
  const [score, setScore] = useState(initial);
  useEffect(() => {
    const iv = setInterval(() => {
      setScore((s) => Math.round(Math.max(72, Math.min(94, s + (Math.random() * 8 - 4)))));
    }, 2200);
    return () => clearInterval(iv);
  }, []);
  return score;
}

// ─── Preview scan types + helpers ────────────────────────────────────────────

interface PreviewScanResult {
  url: string;
  score: number;
  status_line: string;
  findings: string[];
  recommendation: string;
  hard_blockers: string[];
  scanned_at: string;
}

const PROGRESS_STEPS = [
  'Fetching live page',
  'Extracting structure',
  'Evaluating 7 dimensions',
  'Scoring citation readiness',
] as const;

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 40) return 'text-amber-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'border-emerald-400/40 bg-emerald-400/10';
  if (score >= 60) return 'border-green-400/40 bg-green-400/10';
  if (score >= 40) return 'border-amber-400/40 bg-amber-400/10';
  if (score >= 20) return 'border-orange-400/40 bg-orange-400/10';
  return 'border-red-400/40 bg-red-400/10';
}

const TIERS = [
  {
    key: 'observer' as const, name: PRICING.observer.name, subtitle: 'Free',
    monthlyPrice: PRICING.observer.billing.monthly, annualMonthlyPrice: PRICING.observer.billing.monthly,
    scans: PRICING.observer.limits.scans,
    color: 'border-white/20 bg-[#111827]/50', accentClass: 'text-white/70', badge: null as string | null,
    features: [`${PRICING.observer.limits.scans} audits / month`, 'See your AI visibility score (0\u2013100)', 'Discover which keywords AI associates with your site', 'Find missing schema that blocks citations', 'Spot heading and meta tag gaps AI models penalise'],
  },
  {
    key: 'starter' as const, name: PRICING.starter.name, subtitle: '$15/mo',
    monthlyPrice: PRICING.starter.billing.monthly, annualMonthlyPrice: annualMonthlyPrice('starter'),
    scans: PRICING.starter.limits.scans,
    color: 'border-teal-400/30 bg-[#0d2420]/60 ring-1 ring-teal-400/20', accentClass: 'text-teal-300', badge: null as string | null,
    features: [`${PRICING.starter.limits.scans} audits / month`, 'All recommendations with step-by-step implementation code', 'Content highlights showing what AI reads best', 'Export reports as PDF', 'Force-refresh to measure changes instantly', 'Share audit links with clients or stakeholders', '30-day report history'],
  },
  {
    key: 'alignment' as const, name: PRICING.alignment.name, subtitle: 'Core',
    monthlyPrice: PRICING.alignment.billing.monthly, annualMonthlyPrice: annualMonthlyPrice('alignment'),
    scans: PRICING.alignment.limits.scans,
    color: 'border-cyan-400/30 bg-[#0d1f2d]/60 ring-1 ring-cyan-400/20', accentClass: 'text-cyan-300', badge: 'Most Popular' as string | null,
    features: [`${PRICING.alignment.limits.scans} audits / month`, 'Track competitors and find visibility gaps', 'Test if AI engines actually cite your domain', 'Export reports as CSV or PDF to share with your team', 'Force-refresh to measure changes instantly', 'Share audit links with clients or stakeholders', 'Full audit history with score trends'],
  },
  {
    key: 'signal' as const, name: PRICING.signal.name, subtitle: 'Pro',
    monthlyPrice: PRICING.signal.billing.monthly, annualMonthlyPrice: annualMonthlyPrice('signal'),
    scans: PRICING.signal.limits.scans,
    color: 'border-violet-400/35 bg-[#160d2a]/60 ring-1 ring-violet-400/20', accentClass: 'text-violet-300', badge: 'Full power' as string | null,
    features: [`${PRICING.signal.limits.scans} audits / month`, '3-model consensus scoring for higher accuracy', 'Deep competitor intelligence across multiple rivals', 'Advanced citation testing across 3 search engines', 'Monitor when AI engines mention your brand', 'API access and white-label reports for agencies', 'Scheduled rescans to track progress automatically'],
  },
  {
    key: 'scorefix' as const, name: 'Score Fix', subtitle: 'Managed',
    monthlyPrice: -1, annualMonthlyPrice: -1,
    scans: PRICING.scorefix.limits.scans,
    color: 'border-amber-400/30 bg-[#1a1608]/60 ring-1 ring-amber-400/20', accentClass: 'text-amber-300', badge: 'AutoFix PR' as string | null,
    features: [`${PRICING.scorefix.credits} remediation credits / month`, 'AI-generated pull requests that fix visibility issues', 'Evidence-linked diffs tied to audit findings', 'Batch remediation across multiple pages', 'CI/CD integration for automated fixes'],
  },
];

// ─── Landing ─────────────────────────────────────────────────────────────────
const Landing = () => {
  usePageMeta({
    title: META.title,
    description: META.description,
    path: '/landing',
    ogTitle: OG.title,
    structuredData: LANDING_STRUCTURED_DATA,
  });

  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Preview scan state
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewScanResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Visibility fallback: if whileInView animations fail (e.g. Capacitor WebView),
  // force all animated elements visible after 1.5 s
  const [forceVisible, setForceVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); });
    const iv = setInterval(() => { getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); }); }, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const handlePayment = async (tier: string) => {
    if (!isAuthenticated) { navigate('/auth?mode=signin&redirect=/landing'); return; }
    if (!tier || loadingTier) return;
    setLoadingTier(tier);
    try {
      const url = await paymentService.createStripeCheckout(tier);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
      setLoadingTier(null);
    }
  };

  const handlePreviewScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = previewUrl.trim();
    if (!trimmed || scanning) return;
    // Normalize bare domains to https:// before sending to server
    const normalizedPreviewUrl = normalizePublicUrlInput(trimmed);

    setScanning(true);
    setScanStep(0);
    setScanError(null);
    setPreviewResult(null);

    // Animate through progress steps
    const stepInterval = setInterval(() => {
      setScanStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 2500);

    try {
      const res = await fetch(`${API_URL}/api/analyze/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedPreviewUrl }),
      });
      const data = await res.json();

      clearInterval(stepInterval);

      if (!res.ok || !data.success) {
        setScanError(data.error || 'Scan failed. Check the URL and try again.');
        setScanning(false);
        return;
      }

      // Show final step briefly before revealing
      setScanStep(PROGRESS_STEPS.length - 1);
      await new Promise((r) => setTimeout(r, 600));

      setPreviewResult(data.preview);
      setScanning(false);

      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch {
      clearInterval(stepInterval);
      setScanError('Network error. Please check your connection and try again.');
      setScanning(false);
    }
  };

  return (
    <HomepageGuard>
    <div className="min-h-screen bg-[#060607]">

      {/* ── PLATFORM ACCENT BANNER ── */}
      <div className="relative w-full h-16 sm:h-20 overflow-hidden" aria-hidden="true">
        <img
          src="/aivis-circ-pfp-landscape-banner.png"
          alt=""
          width="1440"
          height="80"
          fetchPriority="high"
          className="w-full h-full object-cover opacity-40"
          style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#060607]" />
      </div>

      {/* ── HERO ── */}
      <section className="relative flex items-center overflow-hidden bg-[#060607] pt-8 pb-16 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
        <div className="hero-flow-overlay" aria-hidden="true" />
        <div className="relative z-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="text-center">
            <h1 id="hero-headline" data-speakable className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.12] text-white mb-6 tracking-tight">
              <span className="block">{HERO.headline[0]}</span>
              <span className="block text-white/55 font-semibold text-2xl sm:text-3xl lg:text-4xl mt-1 mb-2 tracking-wide">{HERO.headline[1]}</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                {HERO.headline[2]}
              </span>
              <span className="block bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
                {HERO.headline[3]}
              </span>
            </h1>

            <p className="text-lg text-white/60 mb-4 leading-relaxed max-w-xl mx-auto">
              {HERO.subHeadline}
            </p>

            <p className="text-sm text-white/40 mb-8 max-w-xl mx-auto leading-relaxed">
              {HERO.description}
            </p>

            {/* ── URL INPUT FORM ── */}
            <form onSubmit={handlePreviewScan} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  placeholder={HERO.inputPlaceholder}
                  disabled={scanning}
                  className="w-full px-4 py-3.5 pr-10 rounded-xl bg-[#111827]/80 border border-white/15 text-white placeholder-white/30 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text?.trim()) setPreviewUrl(text.trim());
                    } catch { /* clipboard permission denied */ }
                  }}
                  disabled={scanning}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/30 hover:text-white/70 transition disabled:opacity-40"
                  title="Paste from clipboard"
                  aria-label="Paste from clipboard"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </button>
              </div>
              <button
                type="submit"
                disabled={scanning || !previewUrl.trim()}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-6 py-3.5 rounded-xl text-base font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {scanning ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Scanning…
                  </>
                ) : (
                  <>
                    {HERO.ctaText}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </>
                )}
              </button>
            </form>

            {/* Trust microcopy */}
            <p className="text-xs text-white/35 mb-4">No login for first result · No credit card · 5 free checks per hour</p>
            <p className="text-xs text-white/30 mb-6">Built from live audits across real sites by <a href="/about" className="underline decoration-white/20 hover:text-white/50 transition-colors">AiVIS.biz</a></p>

            {/* What you'll see strip */}
            {!scanning && !previewResult && (
              <div className="flex flex-wrap justify-center gap-4 text-xs text-white/40">
                {['Answer distortion', 'Missing citations', 'Entity confusion', 'Fix protocol'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-red-400/60" />
                    {item}
                  </span>
                ))}
              </div>
            )}

            {/* ── SCAN PROGRESS ── */}
            {scanning && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-white/10 bg-[#111827]/60 p-6 max-w-md mx-auto">
                <div className="space-y-3">
                  {PROGRESS_STEPS.map((step, i) => (
                    <div key={step} className="flex items-center gap-3">
                      {i < scanStep ? (
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : i === scanStep ? (
                        <svg className="w-4 h-4 text-cyan-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/15 shrink-0" />
                      )}
                      <span className={`text-sm ${i <= scanStep ? 'text-white/80' : 'text-white/30'}`}>{step}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── SCAN ERROR ── */}
            {scanError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 p-4 rounded-xl border border-red-400/25 bg-red-500/10 text-red-300 text-sm max-w-md mx-auto">
                {scanError}
              </motion.div>
            )}
          </motion.div>

          {/* ── MINI SCAN RESULT ── */}
          {previewResult && (
            <motion.div ref={resultRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-10">
              <div className="rounded-2xl border border-white/10 bg-[#111827]/60 p-6 sm:p-8">
                {/* Score + status */}
                <div className="flex items-center gap-5 mb-6">
                  <div className={`w-20 h-20 rounded-full border-4 ${getScoreRingColor(previewResult.score)} flex items-center justify-center shrink-0`}>
                    <span className={`text-3xl font-black ${getScoreColor(previewResult.score)}`}>{previewResult.score}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-lg">{previewResult.status_line}</p>
                    <p className="text-white/40 text-sm mt-0.5">{previewResult.url}</p>
                  </div>
                </div>

                {/* Findings */}
                <div className="space-y-3 mb-6">
                  {previewResult.findings.map((finding, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <span className="text-sm text-white/70 text-left">{finding}</span>
                    </div>
                  ))}
                </div>

                {/* Recommendation */}
                {previewResult.recommendation && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/20 mb-6">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <div className="text-left">
                      <p className="text-xs text-emerald-400 font-semibold mb-1">TOP FIX</p>
                      <p className="text-sm text-emerald-200/80">{previewResult.recommendation}</p>
                    </div>
                  </div>
                )}

                {/* Hard blockers callout */}
                {previewResult.hard_blockers.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-400/20 mb-6">
                    <p className="text-xs text-red-400 font-semibold mb-2">HARD BLOCKERS — these cap your score</p>
                    <div className="space-y-1.5">
                      {previewResult.hard_blockers.map((b, i) => (
                        <p key={i} className="text-sm text-red-300/80 text-left">• {b}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gated preview tease */}
                <div className="relative rounded-xl border border-white/8 bg-[#0a0a14]/80 p-6 overflow-hidden">
                  <div className="absolute inset-0 backdrop-blur-sm bg-[#060607]/60 z-10 flex flex-col items-center justify-center gap-3">
                    <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <p className="text-white/60 text-sm font-medium">Full audit includes category breakdowns, BRAG evidence, and fix priorities</p>
                    <Link
                      to={isAuthenticated ? '/app/analyze' : `/auth?redirect=/app/analyze&url=${encodeURIComponent(previewResult.url)}`}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20"
                    >
                      Unlock full audit — free
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </Link>
                  </div>
                  {/* Blurred preview content */}
                  <div className="space-y-3 opacity-40 select-none" aria-hidden="true">
                    <div className="h-3 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                    <div className="h-3 bg-white/10 rounded w-2/3" />
                    <div className="h-8 bg-white/5 rounded mt-4" />
                    <div className="h-3 bg-white/10 rounded w-5/6" />
                    <div className="h-3 bg-white/10 rounded w-1/3" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── TLDR / SUMMARY ── */}
      <section id="tldr" className="py-10 bg-[#0b0f1a]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="summary" className="text-lg font-semibold text-white/80 mb-3" data-speakable>What CITE LEDGER exposes</h2>
          <p className="feature-summary text-white/55 text-sm sm:text-base leading-relaxed" data-speakable>
            AI answer engines don&apos;t just skip your site — they rewrite what you say, drop your name,
            and cite competitors instead. AiVIS.biz CITE LEDGER scans your live page, measures the distortion across
            ChatGPT, Perplexity, Google AI and Claude, and traces every finding to a real page element
            using BRAG evidence identifiers. No hallucination. No assumptions. Just proof.
          </p>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="py-8 border-y border-white/8 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {[
              { label: 'AI engines measured', value: '4', accent: 'text-cyan-300' },
              { label: 'Scoring dimensions', value: '7', accent: 'text-red-300' },
              { label: 'Evidence framework', value: 'BRAG', accent: 'text-emerald-300' },
              { label: 'Sites audited', value: platformStats?.completedAudits ? `${Number(platformStats.completedAudits).toLocaleString()}+` : '-', accent: 'text-amber-300' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="text-center">
                <div className={`text-3xl sm:text-4xl font-black ${accent} tabular-nums`}>{value}</div>
                <div className="text-xs text-white/45 mt-1 font-medium tracking-wide">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROOF STRIP ── */}
      <section className="py-10 bg-[#0a0a0f] border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-[#111827]/50 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <div className="text-3xl font-black text-red-300">15</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Before</div>
                </div>
                <svg className="w-6 h-6 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                <div className="text-center">
                  <div className="text-3xl font-black text-emerald-300">52</div>
                  <div className="text-[10px] text-white/40 mt-0.5">After</div>
                </div>
                <div className="text-center ml-2">
                  <div className="text-2xl font-black text-cyan-300">+37</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Points</div>
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-sm text-white/70 leading-relaxed mb-1">
                  <span className="text-white/90 font-semibold">Missing JSON-LD, broken heading hierarchy, zero FAQ schema.</span>
                </p>
                <p className="text-xs text-white/45">One audit. Three fixes applied. Score doubled on re-scan.</p>
              </div>
              <a href="#hero-scanner" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="shrink-0 inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 cursor-pointer">
                Expose your distortions
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (bridge) ── */}
      <section className="py-20 bg-gradient-to-b from-[#0a0a0f] to-[#060607]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">How it works</span>
            <h2 id="how-it-works" className="text-3xl sm:text-4xl font-bold text-white mb-3" data-speakable>Four layers. One audit.</h2>
            <p className="feature-summary text-white/50 text-base max-w-2xl mx-auto">Every finding traces back to a real element on your page through BRAG — Based-Retrieval-Auditable-Grading. No black boxes. No guessing.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {([
              { n: '01', color: 'text-cyan-300', borderColor: 'border-cyan-400/20 bg-cyan-400/5', title: 'BRAG Engine', desc: 'Scans your live page with a headless browser. Extracts every heading, schema block, meta tag and content section. Labels each element with a unique evidence identifier that follows it through the entire pipeline.' },
              { n: '02', color: 'text-violet-300', borderColor: 'border-violet-400/20 bg-violet-400/5', title: 'Citation Layer', desc: 'Measures whether AI engines can structurally extract and cite your content. Tests entity clarity, schema completeness, content depth and attribution safety across ChatGPT, Perplexity, Google AI and Claude.' },
              { n: '03', color: 'text-red-300', borderColor: 'border-red-400/20 bg-red-400/5', title: 'Distortion Map', desc: 'Exposes what AI gets wrong: dropped entities, rewritten claims, missing attributions and competitor substitutions. Every distortion links to the BRAG evidence ID that proves it.' },
              { n: '04', color: 'text-emerald-300', borderColor: 'border-emerald-400/20 bg-emerald-400/5', title: 'Fix Protocol', desc: 'Produces ranked corrections with expected score lift. JSON-LD patches, heading rewrites, FAQ blocks and entity clarifications — each one tied to the specific evidence that triggered it.' },
            ] as const).map((step) => (
              <motion.div key={step.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                className={`rounded-2xl border ${step.borderColor} p-6`}>
                <span className={`${step.color} font-mono text-xs font-bold`}>{step.n}</span>
                <h3 className={`text-lg font-bold ${step.color} mt-3 mb-2`}>{step.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE DEMO ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/25 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">See it in action</span>
            <h2 id="what-an-audit-looks-like" className="text-3xl sm:text-4xl font-bold text-white mb-3" data-speakable>What an audit actually exposes</h2>
            <p className="text-white/50 text-base max-w-2xl mx-auto">Paste a URL. Get evidence of what AI gets wrong — and the exact fix. Not a mockup.</p>
          </div>
          <div className="space-y-6">
            {([
              { step: '1', accent: 'border-cyan-400/20 bg-cyan-400/5', color: 'text-cyan-300', title: 'Enter any URL', desc: 'Paste your site into the scanner. No signup needed for your first free audit.', visual: (
                <div className="mt-3 rounded-xl border border-white/10 bg-[#0d1117] p-3">
                  <div className="flex items-center gap-2 bg-[#161b22] rounded-lg border border-white/8 px-4 py-2.5">
                    <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>
                    <span className="text-white/60 text-sm font-mono">https://example.com</span>
                    <span className="ml-auto px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-xs font-semibold">Analyze</span>
                  </div>
                </div>
              )},
              { step: '2', accent: 'border-violet-400/20 bg-violet-400/5', color: 'text-violet-300', title: 'BRAG Engine + AI pipeline', desc: 'Multi-model analysis scores 7 evidence-backed dimensions. Signal tier runs triple-check with 3 independent models.', visual: (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {['Content Depth', 'Schema', 'AI Readability', 'Technical Trust', 'Meta Tags', 'Headings', 'Security & Trust'].map((cat) => (
                    <div key={cat} className="rounded-lg border border-white/8 bg-[#0d1117] p-2 text-center">
                      <div className="text-xs text-white/40">{cat}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500" style={{ width: `${50 + Math.random() * 40}%` }} /></div>
                    </div>
                  ))}
                </div>
              )},
              { step: '3', accent: 'border-emerald-400/20 bg-emerald-400/5', color: 'text-emerald-300', title: 'Distortion Map + Fix Protocol', desc: 'Every recommendation cites a BRAG evidence ID that traces back to a real element on your page. No guesswork — just proof and the fix.', visual: (
                <div className="mt-3 space-y-1.5">
                  {[
                    { pri: 'HIGH', label: 'Add Organization JSON-LD schema', ev: 'ev_schema_org' },
                    { pri: 'HIGH', label: 'Fix H1 to include primary entity name', ev: 'ev_h1' },
                    { pri: 'MED', label: 'Add FAQ schema for question-format headings', ev: 'ev_faq' },
                  ].map((rec) => (
                    <div key={rec.ev} className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#0d1117] px-3 py-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rec.pri === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{rec.pri}</span>
                      <span className="text-white/70 flex-1">{rec.label}</span>
                      <span className="text-white/25 font-mono">{rec.ev}</span>
                    </div>
                  ))}
                </div>
              )},
            ] as const).map((item) => (
              <motion.div key={item.step} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} {...(forceVisible && { animate: { opacity: 1, x: 0 } })}
                className={`rounded-2xl border ${item.accent} p-5 sm:p-6`}>
                <div className="flex items-start gap-4">
                  <span className={`${item.color} font-mono text-lg font-black mt-0.5`}>{item.step}</span>
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold ${item.color} mb-1`}>{item.title}</h3>
                    <p className="text-white/55 text-sm leading-relaxed">{item.desc}</p>
                    {item.visual}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a href="#hero-scanner" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-7 py-3 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 cursor-pointer">
              See what AI gets wrong — free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── THE GAP + WHAT YOU GET (compressed) ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 id="ai-visibility-gap" className="text-3xl sm:text-4xl font-bold mb-3" data-speakable>
              <span className="bg-gradient-to-r from-red-300 via-white to-amber-100 bg-clip-text text-transparent">What AI gets wrong about your site</span>
            </h2>
            <p className="text-white/55 text-lg max-w-2xl mx-auto">
              AI doesn&apos;t crawl like search engines. It extracts, compresses, and decides what survives. If your structure breaks, your content gets skipped — or worse, rewritten incorrectly. AiVIS.biz finds those breakpoints and fixes them before they spread.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {([
              { accentClass: 'border-cyan-400/20 bg-cyan-400/8', titleClass: 'text-cyan-300', title: 'What AI extracts', desc: 'The headings, entities, schema and content AI can already pull from your page — and whether it gets the attribution right.' },
              { accentClass: 'border-red-400/20 bg-red-400/8', titleClass: 'text-red-300', title: 'What AI distorts', desc: 'Rewritten claims, dropped entities, competitor substitutions and invented context that AI generates when your structure is too weak to extract from.' },
              { accentClass: 'border-emerald-400/20 bg-emerald-400/8', titleClass: 'text-emerald-300', title: 'What to correct first', desc: 'The highest-impact fix right now — with the BRAG evidence ID, correction description, and expected score lift.' },
            ] as const).map((card) => (
              <motion.div key={card.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }} {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                className={`rounded-2xl border ${card.accentClass} p-5`}>
                <h3 className={`text-base font-bold ${card.titleClass} mb-1.5`}>{card.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#hero-scanner" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-7 py-3 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 cursor-pointer">
              See what AI gets wrong about you
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
            <Link to="/sample-report" className="inline-flex items-center justify-center gap-2 bg-transparent text-white/55 px-7 py-3 rounded-full text-sm font-medium border border-white/15 hover:text-white hover:border-white/25 transition-all">
              View sample report
            </Link>
          </div>
        </div>
      </section>

      {/* ── CASE STUDY (Social Proof) ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">Real result</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">From invisible to extractable in two audits</h2>
            <p className="text-white/50 text-sm max-w-xl mx-auto">A real user ran their first audit, applied the fixes from the Fix Protocol, and re-scanned. Score doubled — with clear evidence of what changed and why.</p>
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
            className="relative rounded-2xl border border-white/12 bg-[#0d1117]/60 p-3 sm:p-4 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ boxShadow: 'inset 0 0 60px 30px rgba(6,6,7,0.85)' }} />
            <img src="/images/case-study-score-lift.png" alt="Real AiVIS.biz audit showing score improvement from 15 to 52 after applying recommended fixes" width="1024" height="576" className="w-full h-auto rounded-xl" loading="lazy" />
          </motion.div>
          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
            <div className="rounded-2xl border border-red-400/20 bg-red-400/8 p-4">
              <div className="text-3xl font-black text-red-300">15</div>
              <div className="text-xs text-white/50 mt-1">Before (first audit)</div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4">
              <div className="text-3xl font-black text-emerald-300">52</div>
              <div className="text-xs text-white/50 mt-1">After (second audit)</div>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4">
              <div className="text-3xl font-black text-cyan-300">+37</div>
              <div className="text-xs text-white/50 mt-1">Points gained</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/35 text-center">Real user data. Score improvement varies by starting conditions and fix implementation quality.</p>
          {/* Category breakdown */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#0d1117]/50 p-5 sm:p-6">
            <p className="text-sm font-semibold text-white mb-4">Category-level breakdown</p>
            <div className="space-y-3">
              {([
                { cat: 'Schema Markup', before: 0, after: 65, color: 'from-red-400 to-emerald-400', fix: 'Added Organization + WebPage JSON-LD' },
                { cat: 'Heading Structure', before: 20, after: 60, color: 'from-red-400 to-emerald-400', fix: 'Fixed H1 → H2 → H3 hierarchy' },
                { cat: 'Content Depth', before: 25, after: 50, color: 'from-amber-400 to-emerald-400', fix: 'Expanded thin content sections' },
                { cat: 'AI Readability', before: 15, after: 55, color: 'from-red-400 to-emerald-400', fix: 'Added FAQ schema with 4 Q&A pairs' },
                { cat: 'Meta Tags', before: 30, after: 50, color: 'from-amber-400 to-emerald-400', fix: 'Fixed missing Open Graph tags' },
                { cat: 'Technical Trust', before: 20, after: 45, color: 'from-red-400 to-emerald-400', fix: 'Added canonical URL + robots meta' },
                { cat: 'Security & Trust', before: 10, after: 40, color: 'from-red-400 to-emerald-400', fix: 'Added HSTS + author entity + sameAs links' },
              ] as const).map((row) => (
                <div key={row.cat} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-28 sm:w-32 shrink-0">{row.cat}</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 bg-white/10 rounded-full" style={{ width: `${row.before}%` }} />
                    <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${row.color} rounded-full transition-all`} style={{ width: `${row.after}%`, opacity: 0.7 }} />
                  </div>
                  <span className="text-xs text-white/40 w-16 text-right">{row.before}→{row.after}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/8">
              <p className="text-xs text-white/40"><span className="text-white/55 font-medium">Fixes applied:</span> JSON-LD schema patch, H1 rewrite, FAQ block, Open Graph tags, canonical URL. Total time: under 30 minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCORE FIX PREVIEW ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">Real output</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">What changes when you apply the Fix Protocol</h2>
            <p className="text-white/50 text-sm max-w-xl mx-auto">Each Fix Pack is generated from your live audit evidence. You get a JSON-LD patch, H1 rewrite, and FAQ block — and this is what they correct.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-center">
              <div className="text-2xl font-black text-emerald-300 mb-1">+25–40</div>
              <p className="text-xs text-white/50">Typical score lift after one Fix Pack</p>
            </div>
            <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-center">
              <div className="text-lg font-bold text-cyan-300 mb-1">Schema + H1 + FAQ</div>
              <p className="text-xs text-white/50">Three fixes that cover most visibility gaps</p>
            </div>
            <div className="rounded-xl border border-violet-400/15 bg-violet-400/5 p-4 text-center">
              <div className="text-lg font-bold text-violet-300 mb-1">Copy → Paste → Re-scan</div>
              <p className="text-xs text-white/50">Apply the patch, re-audit, and measure the difference</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-[#323a4c]/40 p-3 sm:p-4 shadow-2xl">
            <img src="/images/fix-pack-preview.svg" alt="Real Score Fix Pack: JSON-LD patch + H1 rewrite + FAQ block" width="960" height="540" className="w-full h-auto rounded-xl" loading="lazy" />
          </div>
          <p className="mt-3 text-xs text-white/40 text-center">Real Fix Pack output · Generated from live audit evidence · Not a mockup</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/sample-report" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/18 transition-colors">
              View sample report
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
            <Link to={isAuthenticated ? '/app/analyze' : '/auth?redirect=/app/analyze'} className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300/80 text-sm font-semibold hover:bg-cyan-500/15 transition-colors">
              Run your audit first
            </Link>
          </div>
        </div>
      </section>

      {/* ── METHODOLOGY ── */}
      <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">Method</span>
            <h2 id="methodology" className="text-2xl sm:text-3xl font-bold text-white" data-speakable>
              <span className="bg-gradient-to-r from-cyan-300 to-white bg-clip-text text-transparent">What happens when you submit a URL</span>
            </h2>
            <p className="text-white/45 text-sm mt-2 font-mono">No black box. Scoring categories grounded in <a href="https://schema.org" target="_blank" rel="noopener noreferrer" className="text-cyan-300/70 hover:text-cyan-300 underline">Schema.org</a> vocabulary. <Link to="/methodology" className="text-cyan-300/70 hover:text-cyan-300 underline">Full methodology</Link></p>
          </div>
          <ol className="space-y-6">
            {([
              { n: '01', color: 'text-cyan-300', title: 'Scan the page', desc: 'Fetches your live page with a headless browser: title, H1–H6 headings, JSON-LD schema blocks, meta tags, Open Graph, body text, internal/external links, image count, robots directives and canonical URL.' },
              { n: '02', color: 'text-violet-300', title: 'Label evidence', desc: 'Each scraped field receives a unique BRAG evidence ID (e.g. ev_h1, ev_schema_org, ev_meta_desc). No finding exists without a source reference. Every distortion is traceable.' },
              { n: '03', color: 'text-amber-300', title: 'Measure with AI models', desc: 'Model allocation is tier-based: Observer uses free open-weight models, Alignment uses fast commercial models at ~$0.002/scan, Signal runs a 3-model consensus pipeline at ~$0.005/scan. Outputs are structured JSON.' },
              { n: '04', color: 'text-emerald-300', title: 'Validate score integrity', desc: 'Responses are validated for score shape (0–100 range), category weight consistency (must sum to 100%), evidence linkage completeness and JSON structure before persistence.' },
              { n: '05', color: 'text-cyan-300', title: 'Deliver the Fix Protocol', desc: 'Corrections ranked high/medium/low by expected score lift, each citing the specific BRAG evidence ID that triggered it. Typical high-priority fixes: JSON-LD schema patches, heading hierarchy corrections and entity clarifications.' },
            ] as const).map((s) => (
              <li key={s.n} className="flex gap-5">
                <span className={`${s.color} font-mono text-xs pt-1 flex-shrink-0 w-6 tabular-nums font-bold`}>{s.n}</span>
                <div className="border-l border-white/10 pl-5">
                  <p className={`${s.color} font-semibold text-sm mb-1`}>{s.title}</p>
                  <p className="text-white/55 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 pt-8 border-t border-white/10">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">AiVIS.biz does NOT measure</h3>
            <ul className="space-y-2">
              {['Live ChatGPT or Perplexity traffic to your site', 'Google SERP rankings or traditional SEO authority signals', 'Backlinks, domain age, or historical content performance'].map((i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/50"><span className="text-red-400 mt-0.5">✕</span><span>{i}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-[#060607] to-[#0a0a0f] border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/25 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">Transparent pricing</span>
            <h2 id="pricing-overview" className="text-3xl sm:text-4xl font-bold text-white mb-3" data-speakable>Simple, transparent pricing</h2>
            <p className="feature-summary text-white/50 text-lg mb-6">All pricing verified server-side at checkout - no client-side overrides</p>
            <div className="inline-flex items-center gap-1 rounded-xl border border-white/12 bg-[#111827]/70 p-1">
              {(['monthly', 'annual'] as const).map((cycle) => (
                <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${billingCycle === cycle ? 'bg-white/12 text-white' : 'text-white/50 hover:text-white/75'}`}>
                  {cycle === 'monthly' ? 'Monthly' : <><span>Annual</span><span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">Save ~20%</span></>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {TIERS.map((plan) => {
              const isScoreFix = plan.key === 'scorefix';
              const displayPrice = billingCycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
              return (
                <motion.div key={plan.key} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} {...(forceVisible && { animate: { opacity: 1, y: 0 } })} className={`rounded-2xl border p-6 flex flex-col ${plan.color}`}>
                  {plan.badge && <div className={`inline-block px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mb-3 ${plan.accentClass} border-current opacity-80`}>{plan.badge}</div>}
                  <h3 className="text-xl font-bold text-white mb-0.5">{plan.name}</h3>
                  <p className={`text-xs uppercase tracking-widest ${plan.accentClass} mb-4 font-semibold`}>{plan.subtitle}</p>
                  <div className="mb-2">
                    {plan.monthlyPrice === 0 ? <span className="text-4xl font-black text-white">Free</span> : (
                      <div>
                        <span className="text-4xl font-black text-white">${displayPrice}</span>
                        <span className="text-white/45 text-sm">/mo</span>
                        {billingCycle === 'annual' && <span className="ml-2 text-white/30 text-xs line-through">${plan.monthlyPrice}/mo</span>}
                      </div>
                    )}
                    <p className="text-xs text-white/40 mt-1">{isScoreFix ? `${PRICING.scorefix.credits} credits/month` : `${plan.scans} audits / month`}</p>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <svg className={`w-4 h-4 shrink-0 mt-0.5 ${plan.accentClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-white/60">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" disabled={loadingTier !== null && loadingTier !== plan.key} onClick={() => plan.monthlyPrice === 0 ? navigate('/auth?mode=signup') : handlePayment(plan.key)}
                    className={`w-full py-3 px-5 rounded-xl font-semibold text-sm transition ${
                      plan.monthlyPrice === 0 ? 'border border-cyan-400/40 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 cursor-pointer' :
                      loadingTier === plan.key ? 'opacity-60 cursor-wait bg-white/10 text-white border border-white/15' :
                      `border ${plan.accentClass} border-current bg-current/10 hover:bg-current/20 text-white`
                    }`}>
                    {plan.monthlyPrice === 0 ? 'Start Free →' : loadingTier === plan.key ? 'Processing…' : plan.key === 'scorefix' ? 'Get Score Fix' : billingCycle === 'annual' ? `Get ${plan.name} (Annual)` : `Get ${plan.name}`}
                  </button>
                </motion.div>
              );
            })}
          </div>
          <p className="text-center text-xs text-white/30 mt-8">Live pricing verified at checkout. <Link to="/pricing" className="text-cyan-300/60 hover:text-cyan-300 underline">Full pricing page →</Link></p>
        </div>
      </section>

      {/* ── BUILT FOR THE AI ERA (Team / Credibility) ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-500/8 text-amber-300 text-xs font-semibold uppercase tracking-widest mb-4">The platform</span>
            <h2 id="platform-capabilities" className="text-3xl sm:text-4xl font-bold text-white mb-3" data-speakable>Built for the AI audit era</h2>
            <p className="feature-summary text-white/50 text-base max-w-2xl mx-auto">AiVIS.biz is an evidence-backed audit and fix system — not a wrapper around a single API call. Every layer is purpose-built to expose extraction failures and deliver fixes tied to real page evidence.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              { icon: '🧠', title: 'Multi-model AI pipeline', desc: 'Up to 3 independent models score every audit. Signal tier runs triple-check consensus so no single model bias distorts your results.' },
              { icon: '🔍', title: 'BRAG evidence system', desc: 'Every finding links to a real page element via a unique evidence ID — so you can verify exactly what triggered each distortion and each fix.' },
              { icon: '📊', title: '7-dimension evidence scoring', desc: 'Schema (20%), Content Depth (18%), Technical Trust (15%), Meta Tags (15%), AI Readability (12%), Headings (10%), Security & Trust (10%) — each weighted and measured against your live page.' },
              { icon: '⚡', title: 'Live page scanning', desc: 'A headless browser pulls your live page data: JSON-LD, headings, meta tags, Open Graph, robots directives and canonical URLs — nothing cached or guessed.' },
              { icon: '🏢', title: 'Competitor intelligence', desc: 'Track rivals, expose opportunity gaps, compare AI visibility scores and monitor brand mentions across 19 sources including Reddit, Hacker News and Bluesky.' },
              { icon: '🔗', title: 'Citation testing', desc: 'Test whether ChatGPT, Perplexity and Google AI actually cite your domain — with real query evidence, not simulated results.' },
            ] as const).map((cap) => (
              <motion.div key={cap.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                className="rounded-xl border border-white/10 bg-[#111827]/40 p-5">
                <span className="text-2xl">{cap.icon}</span>
                <h3 className="text-sm font-bold text-white mt-2 mb-1">{cap.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#111827]/40 p-6 sm:p-8">
            <div className="grid sm:grid-cols-2 gap-6 items-center">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Engineering-led. Not marketing-led.</h3>
                <p className="text-sm text-white/55 leading-relaxed mb-3">AiVIS.biz was built by engineers who noticed that AI answer engines were rewriting how businesses get discovered — and that nobody was measuring the distortion. The audit engine, evidence system and fix protocol were all designed from first principles.</p>
                <ul className="space-y-1.5">
                  {[
                    'Full-stack TypeScript monorepo (React + Express + Postgres)',
                    'Multi-provider AI with automatic failover and budget control',
                    'Zero external SaaS dependencies for core audit pipeline',
                    'External API, MCP server, and GitHub App integration',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-white/45">
                      <span className="text-cyan-400 mt-0.5">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: '100+', label: 'Keyword pages', accent: 'text-cyan-300' },
                  { value: '19', label: 'Mention sources', accent: 'text-violet-300' },
                  { value: '3', label: 'Citation engines', accent: 'text-emerald-300' },
                  { value: '7', label: 'Scoring dimensions', accent: 'text-amber-300' },
                ] as const).map(({ value, label, accent }) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
                    <div className={`text-2xl font-black ${accent}`}>{value}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">FAQ</span>
            <h2 id="faq" className="text-3xl font-bold text-white" data-speakable>Frequently asked questions</h2>
          </div>
          <dl className="space-y-5">
            {FAQ_ITEMS.map(({ q, a }) => (
              <div key={q} className="border border-white/10 bg-[#111827]/50 rounded-2xl p-6 hover:border-white/18 transition-colors">
                <dt className="text-base font-semibold text-white mb-2">{q}</dt>
                <dd className="text-white/55 text-sm leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-br from-[#060607] via-[#0a0e1a] to-[#060607] border-t border-white/8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(34,211,238,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_30%,rgba(139,92,246,0.07),transparent)]" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="cta-headline" className="text-4xl sm:text-5xl font-extrabold text-white mb-4" data-speakable>
            Audit your site
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
              see what AI can actually use
            </span>
          </h2>
          <p className="text-lg text-white/50 mb-10">
            Free Observer tier. No credit card. Evidence-backed output from your live page.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#hero-scanner" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-9 py-4 rounded-full text-lg font-bold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/25 cursor-pointer">
              See what AI gets wrong about you
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
            <Link to="/sample-report" className="inline-flex items-center justify-center gap-2 bg-transparent text-white/65 px-9 py-4 rounded-full text-lg font-semibold border border-white/18 hover:text-white hover:border-white/30 transition-all">
              View sample report
            </Link>
          </div>
          <p className="mt-8 text-xs text-white/30">{MARKETING_CLAIMS.modelAllocation}</p>
        </div>
      </section>
    </div>
    </HomepageGuard>
  );
};

export default Landing;
