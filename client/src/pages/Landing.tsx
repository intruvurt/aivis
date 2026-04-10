// Landing - AiVIS
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import { MARKETING_CLAIMS } from '../constants/marketingClaims';
import { PRICING, annualMonthlyPrice } from '../../../shared/types';
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildWebPageSchema,
  buildBreadcrumbSchema,
  buildItemListSchema,
  buildSoftwareApplicationSchema,
  buildFaqSchema,
} from '../lib/seoSchema';

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

const LANDING_STRUCTURED_DATA = [
  buildOrganizationSchema(),
  buildWebSiteSchema(),
  buildWebPageSchema({
    path: '/',
    name: 'AiVIS – AI Visibility Intelligence Platform',
    description: 'AiVIS audits how answer engines read, trust, and cite your website. Evidence-backed scoring with BRAG identifiers.',
  }),
  buildBreadcrumbSchema([{ name: 'Home', path: '/' }]),
  buildItemListSchema([
    { name: `Observer (Free) – ${PRICING.observer.limits.scans} audits/month`, path: '/pricing#observer' },
    { name: `Alignment (Core) – ${PRICING.alignment.limits.scans} audits/month – $${PRICING.alignment.billing.monthly}/mo`, path: '/pricing#alignment' },
    { name: `Signal (Pro) – ${PRICING.signal.limits.scans} audits/month – $${PRICING.signal.billing.monthly}/mo`, path: '/pricing#signal' },
  ]),
  buildSoftwareApplicationSchema({
    name: 'AiVIS - AI Visibility Intelligence Platform',
    description: 'AI visibility intelligence platform - ChatGPT, Perplexity, Google AI, Claude. Evidence-backed scoring.',
    offers: [
      { name: 'Observer (Free)', price: '0' },
      { name: 'Alignment (Core)', price: String(PRICING.alignment.billing.monthly) },
      { name: 'Signal (Pro)', price: String(PRICING.signal.billing.monthly) },
    ],
  }),
];

// Built after FAQ_ITEMS are defined — appended to LANDING_STRUCTURED_DATA below
const FAQ_ITEMS = [
  { q: 'What is AiVIS and what does it audit?', a: 'AiVIS measures AI visibility - how well AI answer engines like ChatGPT, Perplexity, Google AI, and Claude can read, extract, trust, and cite your page content. It fetches your live page and scores six evidence-backed categories.' },
  { q: 'How is AI visibility different from traditional SEO?', a: 'Traditional SEO targets keyword rankings and backlinks. AI answer engines synthesize responses from structured content - thin structure, missing schema, or poor heading hierarchy means you get skipped, regardless of domain authority.' },
  { q: 'What is BRAG and why does AiVIS use it?', a: 'BRAG stands for Based Retrieval and Auditable Grading. It is the evidence framework that ties every audit finding to a real element on your page. Each heading, schema block, meta tag and content section receives a BRAG evidence identifier that can be traced, verified and rechecked across scan cycles.' },
  { q: 'Does AiVIS work across all AI platforms?', a: 'Yes. AiVIS scores visibility for ChatGPT, Perplexity AI, Google AI Overviews, and Claude individually (0–100). Signal subscribers run a 3-model triple-check pipeline for higher accuracy.' },
  { q: 'What happens to unused monthly audits?', a: 'Monthly audit credits reset at billing cycle start and do not roll over.' },
  { q: 'What is citation readiness?', a: 'Citation readiness measures how safe and reliable a page is for reuse inside AI-generated answers. It requires clear entity definitions, consistent schema support, sufficient content depth and structural formatting that allows AI systems to extract usable information without risking attribution errors.' },
  { q: 'Who should use AiVIS?', a: 'AiVIS is built for founders, marketers, developers and agencies who need to understand why their content is not being used by AI answer engines. If your site depends on being found, trusted and reused by ChatGPT, Perplexity, Claude or Google AI, the audit shows exactly where visibility breaks and what changes will fix it.' },
] as const;

// Append FAQ schema now that FAQ_ITEMS is defined
LANDING_STRUCTURED_DATA.push(
  buildFaqSchema(
    FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a })),
    { path: '/' }
  )
);

// ─── Futuristic urban neural SVG ────────────────────────────────────────────
function NeuralCityIllustration() {
  return (
    <svg viewBox="0 0 520 390" xmlns="http://www.w3.org/2000/svg" aria-label="Futuristic urban AI neural network visualization" className="w-full h-auto max-h-[380px] select-none" role="img">
      <defs>
        <linearGradient id="ng-skyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0e1a" /><stop offset="100%" stopColor="#060607" /></linearGradient>
        <linearGradient id="ng-buildingA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(34,211,238,0.55)" /><stop offset="100%" stopColor="rgba(34,211,238,0.06)" /></linearGradient>
        <linearGradient id="ng-buildingB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(139,92,246,0.45)" /><stop offset="100%" stopColor="rgba(139,92,246,0.05)" /></linearGradient>
        <linearGradient id="ng-buildingC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(251,191,36,0.50)" /><stop offset="100%" stopColor="rgba(251,191,36,0.05)" /></linearGradient>
        <filter id="ng-glow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="ng-softglow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="ng-horizonGlow" cx="50%" cy="80%" r="55%"><stop offset="0%" stopColor="rgba(34,211,238,0.16)" /><stop offset="60%" stopColor="rgba(139,92,246,0.07)" /><stop offset="100%" stopColor="transparent" /></radialGradient>
      </defs>
      <rect width="520" height="390" fill="url(#ng-skyGrad)" />
      <rect width="520" height="390" fill="url(#ng-horizonGlow)" />
      <rect x="24" y="185" width="16" height="185" fill="url(#ng-buildingB)" stroke="rgba(139,92,246,0.35)" strokeWidth="0.6" />
      <rect x="87" y="110" width="22" height="260" fill="url(#ng-buildingA)" stroke="rgba(34,211,238,0.4)" strokeWidth="0.7" />
      <line x1="98" y1="98" x2="98" y2="72" stroke="rgba(34,211,238,0.7)" strokeWidth="0.7" />
      <circle cx="98" cy="70" r="2.5" fill="rgba(34,211,238,0.9)" filter="url(#ng-glow)" />
      <rect x="198" y="55" width="32" height="315" fill="url(#ng-buildingA)" stroke="rgba(34,211,238,0.5)" strokeWidth="0.8" />
      <line x1="214" y1="42" x2="214" y2="18" stroke="rgba(34,211,238,0.8)" strokeWidth="0.8" />
      <circle cx="214" cy="16" r="3" fill="rgba(34,211,238,1)" filter="url(#ng-softglow)" />
      <rect x="318" y="108" width="24" height="262" fill="url(#ng-buildingC)" stroke="rgba(251,191,36,0.4)" strokeWidth="0.7" />
      <line x1="330" y1="108" x2="330" y2="82" stroke="rgba(251,191,36,0.7)" strokeWidth="0.7" />
      <circle cx="330" cy="80" r="2.5" fill="rgba(251,191,36,0.9)" filter="url(#ng-glow)" />
      <rect x="407" y="148" width="18" height="222" fill="url(#ng-buildingB)" stroke="rgba(139,92,246,0.38)" strokeWidth="0.6" />
      <rect x="468" y="178" width="24" height="192" fill="url(#ng-buildingB)" stroke="rgba(139,92,246,0.28)" strokeWidth="0.5" />
      <line x1="0" y1="370" x2="520" y2="370" stroke="rgba(34,211,238,0.22)" strokeWidth="0.8" />
      <circle cx="55" cy="95" r="3.5" fill="rgba(139,92,246,0.28)" stroke="rgba(139,92,246,0.7)" strokeWidth="0.8" filter="url(#ng-glow)" />
      <circle cx="162" cy="52" r="3" fill="rgba(34,211,238,0.18)" stroke="rgba(34,211,238,0.55)" strokeWidth="0.8" />
      <circle cx="270" cy="35" r="4" fill="rgba(34,211,238,0.12)" stroke="rgba(34,211,238,0.45)" strokeWidth="0.8" />
      <circle cx="380" cy="60" r="3.5" fill="rgba(251,191,36,0.18)" stroke="rgba(251,191,36,0.55)" strokeWidth="0.8" />
      <circle cx="455" cy="100" r="3" fill="rgba(139,92,246,0.18)" stroke="rgba(139,92,246,0.5)" strokeWidth="0.7" />
      <line x1="214" y1="16" x2="98" y2="70" stroke="rgba(34,211,238,0.25)" strokeWidth="0.7" strokeDasharray="4,3" />
      <line x1="214" y1="16" x2="330" y2="80" stroke="rgba(34,211,238,0.2)" strokeWidth="0.7" strokeDasharray="4,3" />
      <line x1="214" y1="16" x2="162" y2="52" stroke="rgba(34,211,238,0.32)" strokeWidth="0.6" />
      <line x1="214" y1="16" x2="270" y2="35" stroke="rgba(34,211,238,0.28)" strokeWidth="0.6" />
      <line x1="98" y1="70" x2="55" y2="95" stroke="rgba(139,92,246,0.28)" strokeWidth="0.6" strokeDasharray="3,4" />
      <line x1="330" y1="80" x2="270" y2="35" stroke="rgba(251,191,36,0.25)" strokeWidth="0.6" />
      <line x1="330" y1="80" x2="380" y2="60" stroke="rgba(251,191,36,0.28)" strokeWidth="0.6" />
      <line x1="380" y1="60" x2="455" y2="100" stroke="rgba(139,92,246,0.22)" strokeWidth="0.6" strokeDasharray="4,3" />
      <text x="200" y="10" fontSize="6" fill="rgba(34,211,238,0.65)" fontFamily="monospace" letterSpacing="1">AIVIS.BIZ</text>
      <text x="170" y="383" fontSize="5" fill="rgba(34,211,238,0.3)" fontFamily="monospace" letterSpacing="2">AI VISIBILITY INTELLIGENCE PLATFORM</text>
    </svg>
  );
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
  'Fetching page',
  'Reading structure',
  'Checking trust signals',
  'Scoring citation readiness',
] as const;

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreRingColor(score: number): string {
  if (score >= 70) return 'border-emerald-400/40 bg-emerald-400/10';
  if (score >= 40) return 'border-amber-400/40 bg-amber-400/10';
  return 'border-red-400/40 bg-red-400/10';
}

const TIERS = [
  {
    key: 'observer' as const, name: PRICING.observer.name, subtitle: 'Free',
    monthlyPrice: PRICING.observer.billing.monthly, annualMonthlyPrice: PRICING.observer.billing.monthly,
    scans: PRICING.observer.limits.scans,
    color: 'border-white/20 bg-[#111827]/50', accentClass: 'text-white/70', badge: null as string | null,
    features: [`${PRICING.observer.limits.scans} audits / month`, 'AI visibility score (0–100)', 'Keyword intelligence', 'Schema markup audit', 'Heading & meta tag analysis'],
  },
  {
    key: 'alignment' as const, name: PRICING.alignment.name, subtitle: 'Core',
    monthlyPrice: PRICING.alignment.billing.monthly, annualMonthlyPrice: annualMonthlyPrice('alignment'),
    scans: PRICING.alignment.limits.scans,
    color: 'border-cyan-400/30 bg-[#0d1f2d]/60 ring-1 ring-cyan-400/20', accentClass: 'text-cyan-300', badge: 'Most Popular' as string | null,
    features: [`${PRICING.alignment.limits.scans} audits / month`, 'Competitor tracking', 'Citation workflows', 'CSV & PDF exports', 'Force-refresh audits', 'Shareable report links', 'Report history'],
  },
  {
    key: 'signal' as const, name: PRICING.signal.name, subtitle: 'Pro',
    monthlyPrice: PRICING.signal.billing.monthly, annualMonthlyPrice: annualMonthlyPrice('signal'),
    scans: PRICING.signal.limits.scans,
    color: 'border-violet-400/35 bg-[#160d2a]/60 ring-1 ring-violet-400/20', accentClass: 'text-violet-300', badge: 'Full power' as string | null,
    features: [`${PRICING.signal.limits.scans} audits / month`, 'Triple-Check AI Pipeline (3 models)', 'Expanded competitor tracking', 'Advanced citation testing', 'AI Citation Tracker', 'API access + white-label reports', 'Scheduled rescans'],
  },
];

// ─── Landing ─────────────────────────────────────────────────────────────────
const Landing = () => {
  usePageMeta({
    title: 'AiVIS \u2013 AI Visibility Intelligence Platform',
    description: 'AiVIS audits how answer engines read, trust, and cite your website. See what AI understands, what it cannot verify, and what to fix first.',
    path: '/',
    ogTitle: 'AiVIS – Your Site Can Rank and Still Get Skipped by AI',
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
        body: JSON.stringify({ url: trimmed }),
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
    <div className="min-h-screen bg-[#060607]">

      {/* ── PLATFORM ACCENT BANNER ── */}
      <div className="relative w-full h-16 sm:h-20 overflow-hidden" aria-hidden="true">
        <img
          src="/aivis-circ-pfp-landscape-banner.png"
          alt=""
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
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-white mb-4 tracking-tight">
              Is your site{' '}
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">visible to AI?</span>
            </h1>
            <p className="text-base sm:text-lg text-white/55 mb-8 leading-relaxed max-w-xl mx-auto">
              Paste your URL. Get a real score, real findings, and the first fix — in under 30 seconds.
              No login required for your first result.
            </p>

            {/* ── URL INPUT FORM ── */}
            <form onSubmit={handlePreviewScan} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-4">
              <input
                type="url"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                placeholder="https://yourdomain.com"
                disabled={scanning}
                className="flex-1 px-4 py-3.5 rounded-xl bg-[#111827]/80 border border-white/15 text-white placeholder-white/30 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
                required
              />
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
                    Run free AI visibility check
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </>
                )}
              </button>
            </form>

            {/* Trust microcopy */}
            <p className="text-xs text-white/35 mb-4">No login for first result · No credit card · 5 free checks per hour</p>
            <p className="text-xs text-white/30 mb-6">Built by <a href="/about" className="underline decoration-white/20 hover:text-white/50 transition-colors">Intruvurt Labs</a> · Evidence-backed auditing since 2025</p>

            {/* What you'll see strip */}
            {!scanning && !previewResult && (
              <div className="flex flex-wrap justify-center gap-4 text-xs text-white/40">
                {['Citation blockers', 'Trust signal gaps', 'Machine readability issues', 'Priority fix'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
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
          <h2 className="text-lg font-semibold text-white/80 mb-3">Summary:</h2>
          <p className="text-white/55 text-sm sm:text-base leading-relaxed">
            AiVIS audits whether AI answer engines — ChatGPT, Perplexity, Google AI, and Claude —
            can read, trust, and cite your website. Enter any URL to get a 0–100 visibility score
            with evidence-backed findings, category grades, and prioritised fixes.
            Every recommendation is grounded in real page evidence, not synthetic benchmarks.
          </p>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="py-8 border-y border-white/8 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {[
              { label: 'AI Platforms Scored', value: '4', accent: 'text-cyan-300' },
              { label: 'Audit categories', value: '6', accent: 'text-violet-300' },
              { label: 'Evidence-backed method', value: 'BRAG', accent: 'text-emerald-300' },
              { label: 'Scans completed', value: platformStats?.completedAudits ? `${Number(platformStats.completedAudits).toLocaleString()}+` : '-', accent: 'text-amber-300' },
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
                Check your site now
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
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">How does AiVIS audit your site?</h2>
            <p className="text-white/50 text-base max-w-2xl mx-auto">Every audit uses BRAG - Based Retrieval and Auditable Grading - so every finding traces back to a real element on your page.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {([
              { n: '01', color: 'text-cyan-300', borderColor: 'border-cyan-400/20 bg-cyan-400/5', title: 'Run a live audit', desc: 'Enter any public URL. AiVIS scans your page, extracts structure, schema, headings, meta tags and content, then runs them through an AI pipeline.' },
              { n: '02', color: 'text-violet-300', borderColor: 'border-violet-400/20 bg-violet-400/5', title: 'See your visibility snapshot', desc: 'In under a minute you get a 0–100 score with a six-part visibility breakdown: what AI understands, what it cannot verify, and what to fix first.' },
              { n: '03', color: 'text-amber-300', borderColor: 'border-amber-400/20 bg-amber-400/5', title: 'Open the full system', desc: 'Go deeper with competitor tracking, citation testing, score trends and fixes ranked by likely lift. Re-scan after each change to measure the difference.' },
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

      {/* ── THE GAP + WHAT YOU GET (compressed) ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              <span className="bg-gradient-to-r from-amber-300 via-white to-amber-100 bg-clip-text text-transparent">Why do AI models skip your site?</span>
            </h2>
            <p className="text-white/50 text-base max-w-2xl mx-auto"><a href="https://sparktoro.com/blog/2026-zero-click-search-study/" target="_blank" rel="noopener noreferrer" className="text-white/70 underline decoration-white/25 hover:text-white/90 transition-colors">58.5% of Google searches</a> now end in zero clicks. If your page is not structured for extraction, you do not get cited.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {([
              { accentClass: 'border-cyan-400/20 bg-cyan-400/8', titleClass: 'text-cyan-300', title: 'What AI understands', desc: 'Headings, entities, schema and content your page already provides that AI can extract and cite.' },
              { accentClass: 'border-amber-400/20 bg-amber-400/8', titleClass: 'text-amber-300', title: 'What AI cannot verify', desc: 'Missing signals, conflicting schema and unclear entity definitions that stop AI from trusting your page.' },
              { accentClass: 'border-emerald-400/20 bg-emerald-400/8', titleClass: 'text-emerald-300', title: 'What to fix first', desc: 'The highest-impact issue right now - with the evidence ID, fix description, and expected score lift.' },
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
              Run free AI visibility check
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
            <p className="text-white/50 text-sm max-w-xl mx-auto">A real user ran their first audit, applied the recommended fixes, and re-scanned. The result: a jump from 15/100 to 52/100 — with clear evidence of what changed.</p>
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
            className="relative rounded-2xl border border-white/12 bg-[#0d1117]/60 p-3 sm:p-4 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ boxShadow: 'inset 0 0 60px 30px rgba(6,6,7,0.85)' }} />
            <img src="/images/case-study-score-lift.png" alt="Real AiVIS audit showing score improvement from 15 to 52 after applying recommended fixes" className="w-full h-auto rounded-xl" loading="lazy" />
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
        </div>
      </section>

      {/* ── SCORE FIX PREVIEW ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">Real output</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">What changes when you apply the fixes</h2>
            <p className="text-white/50 text-sm max-w-xl mx-auto">Each Fix Pack is generated from your live audit evidence. You get a JSON-LD patch, H1 rewrite, and FAQ block - and this is what they unlock.</p>
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
            <img src="/images/fix-pack-preview.svg" alt="Real Score Fix Pack: JSON-LD patch + H1 rewrite + FAQ block" className="w-full h-auto rounded-xl" loading="lazy" />
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
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              <span className="bg-gradient-to-r from-cyan-300 to-white bg-clip-text text-transparent">What happens when you submit a URL?</span>
            </h2>
            <p className="text-white/45 text-sm mt-2 font-mono">No black box. Scoring categories are grounded in <a href="https://schema.org" target="_blank" rel="noopener noreferrer" className="text-cyan-300/70 hover:text-cyan-300 underline">Schema.org</a> vocabulary. <Link to="/methodology" className="text-cyan-300/70 hover:text-cyan-300 underline">Canonical methodology page</Link></p>
          </div>
          <ol className="space-y-6">
            {([
              { n: '01', color: 'text-cyan-300', title: 'Scan the page', desc: 'Fetch your live page: title, headings, schema, meta tags, body text, links, image count.' },
              { n: '02', color: 'text-violet-300', title: 'Label evidence', desc: 'Each scraped field gets an evidence ID so every finding traces back to an observed page element.' },
              { n: '03', color: 'text-amber-300', title: 'Analyze with AI models', desc: 'Model allocation is tier-based and enforced server-side. Outputs are required in structured JSON.' },
              { n: '04', color: 'text-emerald-300', title: 'Check score integrity', desc: 'Responses are validated for score shape, category integrity, and evidence linkage before persistence.' },
              { n: '05', color: 'text-cyan-300', title: 'Show what to fix next', desc: 'Recommendations are ranked high / medium / low and cite the specific evidence ID that triggered each one.' },
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
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">AiVIS does NOT measure</h3>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Simple, transparent pricing</h2>
            <p className="text-white/50 text-lg mb-6">All pricing verified server-side at checkout - no client-side overrides</p>
            <div className="inline-flex items-center gap-1 rounded-xl border border-white/12 bg-[#111827]/70 p-1">
              {(['monthly', 'annual'] as const).map((cycle) => (
                <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${billingCycle === cycle ? 'bg-white/12 text-white' : 'text-white/50 hover:text-white/75'}`}>
                  {cycle === 'monthly' ? 'Monthly' : <><span>Annual</span><span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">Save ~20%</span></>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TIERS.map((plan) => {
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
                    <p className="text-xs text-white/40 mt-1">{plan.scans} audits / month</p>
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
                    {plan.monthlyPrice === 0 ? 'Start Free →' : loadingTier === plan.key ? 'Processing…' : billingCycle === 'annual' ? `Get ${plan.name} (Annual)` : `Get ${plan.name}`}
                  </button>
                </motion.div>
              );
            })}
          </div>
          <p className="text-center text-xs text-white/30 mt-8">Live pricing verified at checkout. <Link to="/pricing" className="text-cyan-300/60 hover:text-cyan-300 underline">Full pricing page →</Link></p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">FAQ</span>
            <h2 className="text-3xl font-bold text-white">Frequently asked questions</h2>
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
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            If your site isn&apos;t being cited,{' '}
            <span className="bg-gradient-to-r from-amber-300 via-white to-red-300 bg-clip-text text-transparent">it&apos;s already being replaced</span>
          </h2>
          <p className="text-lg text-white/55 mb-3">AiVIS shows why. And gives you a way to fix it.</p>
          <p className="text-sm text-white/35 mb-10">Free tier · No credit card · Your first audit in under a minute</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#hero-scanner" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-9 py-4 rounded-full text-lg font-bold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/25 cursor-pointer">
              Run free AI visibility check
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
  );
};

export default Landing;
