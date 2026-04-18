$content = @'
// Landing — AiVIS.biz
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import { MARKETING_CLAIMS } from '../constants/marketingClaims';
import {
  BASE_URL,
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildWebPageSchema,
  buildBreadcrumbSchema,
  buildItemListSchema,
  buildSoftwareApplicationSchema,
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
    const data = await r.json();
    if (!data.success) throw new Error(data.error || 'Checkout failed');
    return data.data;
  },
};

const LANDING_STRUCTURED_DATA = [
  buildOrganizationSchema(),
  buildWebSiteSchema(),
  buildWebPageSchema({
    path: '/landing',
    name: 'AiVIS — AI Visibility Audit | Evidence-Backed by CITE LEDGER',
    description: 'AiVIS.biz is an Evidence-backed site analysis for AI answers platform that audits how answer engines read trust and cite a website using BRAG based retrieval and auditable grading tied to real page evidence',
  }),
  buildBreadcrumbSchema([{ name: 'Home', path: '/' }]),
  buildItemListSchema([
    { name: 'Observer [Free] – 3 audits/month', path: '/pricing#observer' },
    { name: 'Starter – 15 audits/month – $15/mo', path: '/pricing#starter' },
    { name: 'Alignment [Core] – 60 audits/month – $49/mo', path: '/pricing#alignment' },
    { name: 'Signal [Pro] – 200 audits/month – $149/mo', path: '/pricing#signal' },
    { name: 'Score Fix [AutoFix PR] – 250 credits – $299 one-time', path: '/pricing#scorefix' },
  ]),
  buildSoftwareApplicationSchema({
    name: 'AiVIS.biz -> evidence-backed site analysis for AI answers',
    description: 'Evidence-backed site analysis for AI answers platform — ChatGPT, Perplexity, Google AI, Claude. Evidence-backed scoring.',
    offers: [
      { name: 'Observer [Free]', price: '0' },
      { name: 'Alignment [Core]', price: '9' },
      { name: 'Signal [Pro]', price: '29' },
      { name: 'Score Fix [AutoFix PR]', price: '299' },
    ],
  }),
];

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
      <text x="170" y="383" fontSize="5" fill="rgba(34,211,238,0.3)" fontFamily="monospace" letterSpacing="2">Evidence-backed site analysis for AI answers PLATFORM</text>
    </svg>
  );
}

const TIERS = [
  {
    key: 'observer', name: 'Observer', subtitle: 'Free', monthlyPrice: 0, annualMonthlyPrice: 0, scans: 3,
    color: 'border-white/20 bg-[#111827]/50', accentClass: 'text-white/70', badge: null, creditHint: null,
    features: ['3 audits / month','AI visibility score (0–100)','Keyword intelligence','Schema markup audit','Heading & meta tag analysis','Auto','Public share links (redacted)'],
  },
  {
    key: 'starter', name: 'Starter', subtitle: 'Starter', monthlyPrice: 15, annualMonthlyPrice: 12, scans: 15,
    color: 'border-emerald-400/30 bg-[#0d1f1a]/60 ring-1 ring-emerald-400/20', accentClass: 'text-emerald-300', badge: null, creditHint: null,
    features: ['15 audits / month','Full recommendations with code','PDF exports','Shareable links','Content highlights','Force-refresh audits','30-day report history'],
  },
  {
    key: 'alignment', name: 'Alignment', subtitle: 'Core', monthlyPrice: 49, annualMonthlyPrice: 38, scans: 60,
    color: 'border-cyan-400/30 bg-[#0d1f2d]/60 ring-1 ring-cyan-400/20', accentClass: 'text-cyan-300', badge: 'Most Popular for Solo/F', creditHint: 'Annual plan: earn credits toward API add-ons',
    features: ['60 audits / month','Competitor tracking','Citation workflows','CSV & PDF exports','Force-refresh audits','Shareable report links','Report history'],
  },
  {
    key: 'signal', name: 'Signal', subtitle: 'Pro', monthlyPrice: 149, annualMonthlyPrice: 116, scans: 200,
    color: 'border-violet-400/35 bg-[#160d2a]/60 ring-1 ring-violet-400/20', accentClass: 'text-violet-300', badge: 'Annual earns credits', creditHint: 'Yearly subscribers earn tier credits redeemable within Signal features',
    features: ['200 audits / month','Triple-Check AI Pipeline (3 models)','Expanded competitor tracking','Advanced citation testing','AI Citation Tracker','API access + white-label reports','Scheduled rescans'],
  },
  {
    key: 'scorefix', name: 'Score Fix', subtitle: 'AutoFix PR', monthlyPrice: 299, annualMonthlyPrice: 299, scans: 15,
    color: 'border-amber-400/30 bg-[#1a1200]/60 ring-1 ring-amber-400/20', accentClass: 'text-amber-300', badge: 'Annual earns credits', creditHint: 'Yearly subscribers earn credits redeemable within Score Fix feature set',
    features: ['250 audits / month','Triple-Check AI Pipeline','Thorough evidence audit mode','Actual Fix Plan (evidence-linked)','Issue-level validation checklist','API access + white-label','Priority support'],
  },
] as const;

const CREDIT_COSTS = [
  { action: 'Standard audit', cost: '1.0 credit', note: 'Cached result served free' },
  { action: 'Force-refresh rerun', cost: '+0.5 credits', note: 'Bypasses cache, live scrape' },
  { action: 'Mock-data flag scan', cost: '1.33 credits', note: 'Detects placeholder content' },
  { action: 'Findability-goal analysis', cost: '1.33 credits', note: 'Goal-aware prompt layer' },
  { action: 'Upload analysis', cost: '1.0 / file', note: 'Alignment+ only' },
  { action: 'API v1 audit call', cost: '1.0 credit', note: 'Signal+ plans only' },
];

// ─── Landing ─────────────────────────────────────────────────────────────────
const Landing = () => {
  usePageMeta({
    title: 'Evidence-backed site analysis for AI answers | AiVIS.biz',
    description: 'Evidence-backed site analysis for AI answers assembling in ChatGPT, Perplexity, Google AI and Claude. BRAG scoring with implementation-ready fixes.',
    path: '/landing',
    ogTitle: 'AiVIS.biz - Measure How AI Sees Your Site',
    structuredData: LANDING_STRUCTURED_DATA,
  });

  const { isAuthenticated } = useAuthStore();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [creditCostOpen, setCreditCostOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); });
    const iv = setInterval(() => { getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); }); }, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const handlePayment = async (tier: string) => {
    if (!isAuthenticated) { toast.error('Please login to upgrade'); return; }
    if (!tier || loadingTier) return;
    setLoadingTier(tier);
    try {
      const url = await paymentService.createStripeCheckout(tier);
      toast.success('Redirecting to Stripe…');
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#060607]">

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#060607]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
        <div className="hero-flow-overlay" aria-hidden="true" />
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
              <div className="mb-8">
                <img src="/images/aivis-logo-hero.png" alt="AiVIS.biz | AI Visibility Audit |AiVIS.biz - CITE LEDGER |AiVIS.biz - CITE LEDGER | Evidence-Linked Scores " className="h-20 sm:h-24 lg:h-28 w-auto object-contain mix-blend-screen brightness-110 saturate-125" loading="eager" />
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Free Starter Tier
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300/80 text-xs font-semibold tracking-wide">Evidence-backed · No black box</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-white mb-6 tracking-tight">
                Measure whether{' '}
                <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">AI can read,</span>
                <br />trust, and cite{' '}
                <span className="bg-gradient-to-r from-amber-300 to-white bg-clip-text text-transparent">your site</span>
              </h1>
              <p className="text-lg text-white/60 mb-4 leading-relaxed max-w-xl">
                AiVIS.biz audits your live page against the signals that determine whether ChatGPT, Perplexity, Google AI and Claude include you in their answers. Every finding is tied to evidence scraped from your real page — not inferred from your domain.
              </p>
              <p className="text-sm text-white/40 font-mono mb-8 max-w-xl">
                Pages with FAQPage schema are cited in AI Overviews 3.2× more than unstructured equivalents. Pages with correct H1-H3, H4-H6 hierarchy score 28 points higher on average. Start with structure.
              </p>
              <div className="flex items-center gap-4 mb-8">
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 bg-[#111827]/60">
                  <span className="text-5xl font-black text-white tabular-nums leading-none">3</span>
                  <div>
                    <p className="text-white font-bold text-lg leading-tight">FREE Audits</p>
                    <p className="text-white/50 text-xs">every month · no credit card</p>
                  </div>
                </div>
                {platformStats?.completedAudits && (
                  <div className="hidden sm:flex flex-col items-start px-4 py-3 rounded-2xl border border-white/8 bg-[#111827]/40">
                    <span className="text-2xl font-bold text-cyan-300">{Number(platformStats.completedAudits).toLocaleString()}+</span>
                    <span className="text-xs text-white/45">audits completed</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/auth" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-7 py-3.5 rounded-full text-base font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20">
                  Analyze your site free
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </Link>
                <Link to="/pricing" className="inline-flex items-center justify-center bg-transparent text-white/60 px-7 py-3.5 rounded-full text-base font-medium hover:text-white transition-colors border border-white/15 hover:border-white/25">
                  View plans &amp; pricing
                </Link>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }} className="hidden lg:block">
              <div className="relative rounded-2xl border border-cyan-400/15 bg-[#060c14]/60 p-4 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5" />
                <NeuralCityIllustration />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-400/15 border border-cyan-400/25 text-cyan-300 text-[9px] font-mono tracking-wider">SCAN ACTIVE</span>
                  <span className="px-2 py-0.5 rounded bg-violet-400/15 border border-violet-400/25 text-violet-300 text-[9px] font-mono tracking-wider">AI LAYER</span>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/25 text-amber-300 text-[9px] font-mono tracking-wider">AIVIS.BIZ</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="py-8 border-y border-white/8 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {[
              { label: 'AI Platforms Scored', value: '4', accent: 'text-cyan-300' },
              { label: 'Audit categories', value: '6', accent: 'text-violet-300' },
              { label: 'Avg score improvement', value: '31%', accent: 'text-emerald-300' },
              { label: 'Scans completed', value: platformStats?.completedAudits ? `${Number(platformStats.completedAudits).toLocaleString()}+` : '—', accent: 'text-amber-300' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="text-center">
                <div className={`text-3xl sm:text-4xl font-black ${accent} tabular-nums`}>{value}</div>
                <div className="text-xs text-white/45 mt-1 font-medium tracking-wide">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ── */}
      <section className="py-24 bg-gradient-to-b from-[#0a0a0f] to-[#060607]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-500/8 text-amber-300 text-xs font-semibold uppercase tracking-widest mb-4">The problem</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-amber-300 via-white to-amber-100 bg-clip-text text-transparent">AI models skip sites they cannot extract</span>
            </h2>
            <p className="text-white/55 text-lg max-w-2xl mx-auto">58.5% of Google searches now end in zero clicks. AI answer engines extract, compress, and cite structured content. If your page is not structured for extraction, you do not get cited — regardless of your domain authority.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {([
              { accentClass:'border-cyan-400/20 bg-cyan-400/10', titleClass:'text-cyan-300', title:'Live page audit', desc:'Every finding is tied to a specific scraped element from your actual page — not inferred from your domain name or Alexa rank.' },
              { accentClass:'border-violet-400/20 bg-violet-400/10', titleClass:'text-violet-300', title:'Six-category grading', desc:'Content depth, heading structure, schema completeness, meta tags, technical SEO and AI readability. Each grade traces to real evidence.' },
              { accentClass:'border-amber-400/20 bg-amber-400/10', titleClass:'text-amber-300', title:'Impact-ranked fixes', desc:'Every recommendation cites the exact evidence ID — heading, meta tag, schema block, or content gap; that triggered it. Filter by effort level.' },
            ] as const).map((card) => (
              <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
                className={`rounded-2xl border ${card.accentClass} p-6`}>
                <h3 className={`text-lg font-bold ${card.titleClass} mb-2`}>{card.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCORE FIX PREVIEW ── */}
      <section className="py-20 bg-[#060607] border-t border-white/8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">✓ Real paid output</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Score Fix Pack — what you actually receive</h2>
            <p className="text-white/50 text-sm max-w-xl mx-auto">This is not a mockup. Score Fix subscribers receive an evidence-linked JSON-LD patch, H1 rewrite, and FAQ block in one exportable output; generated from their live audit findings.</p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-[#323a4c]/40 p-3 sm:p-4 shadow-2xl">
            <img src="/images/fix-pack-preview.svg" alt="Real Score Fix Pack: JSON-LD patch + H1 rewrite + FAQ block" className="w-full h-auto rounded-xl" loading="lazy" />
          </div>
          <p className="mt-3 text-xs text-white/40 text-center">Real Fix Pack output: JSON-LD patch + H1 rewrite + FAQ block · Generated from live audit evidence</p>
          <div className="mt-5 flex justify-center">
            <Link to="/score-fix" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/18 transition-colors">
              See Score Fix details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── METERED CREDIT COSTS ── */}
      <section className="py-16 bg-gradient-to-b from-[#060607] to-[#0a0a0f] border-t border-white/8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/25 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-2">Transparent billing</span>
              <h2 className="text-xl sm:text-2xl font-bold">
                <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">Granular credit usage</span>
              </h2>
              <p className="text-white/45 text-sm mt-1">Exactly what each action costs against your monthly allowance</p>
            </div>
            <button type="button" onClick={() => setCreditCostOpen(!creditCostOpen)} className="shrink-0 px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-white/60 text-xs font-semibold hover:text-white hover:bg-white/10 transition-colors">
              {creditCostOpen ? 'Hide' : 'Show all'}
            </button>
          </div>
          <AnimatePresence>
            {creditCostOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <div className="rounded-2xl border border-white/10 bg-[#111827]/80 overflow-hidden">
                  <div className="grid grid-cols-3 px-5 py-3 border-b border-white/8 text-[10px] uppercase tracking-widest text-white/40 font-semibold"><span>Action</span><span>Credit cost</span><span>Notes</span></div>
                  {CREDIT_COSTS.map((row) => (
                    <div key={row.action} className="grid grid-cols-3 px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/2 text-sm">
                      <span className="text-white/80 font-medium">{row.action}</span>
                      <span className="text-cyan-300 font-mono text-xs">{row.cost}</span>
                      <span className="text-white/45 text-xs">{row.note}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-white/35 text-center">Credits reset monthly. Unused credits do not roll over.</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!creditCostOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CREDIT_COSTS.slice(0, 3).map((row) => (
                <div key={row.action} className="rounded-xl border border-white/10 bg-[#111827]/60 p-4">
                  <div className="text-cyan-300 font-mono text-lg font-bold">{row.cost}</div>
                  <div className="text-white/70 text-xs font-medium mt-1">{row.action}</div>
                  <div className="text-white/35 text-[11px] mt-0.5">{row.note}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── METHODOLOGY ── */}
      <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">Method</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              <span className="bg-gradient-to-r from-cyan-300 to-white bg-clip-text text-transparent">What happens when you submit a URL</span>
            </h2>
            <p className="text-white/45 text-sm mt-2 font-mono">No black box. <Link to="/methodology" className="text-cyan-300/70 hover:text-cyan-300 underline">Canonical methodology page</Link></p>
          </div>
          <ol className="space-y-6">
            {([
              { n:'01', color:'text-cyan-300', title:'Scrape', desc:'Fetch your live page: title, headings, schema, meta tags, body text, links, image count.' },
              { n:'02', color:'text-violet-300', title:'Label evidence', desc:'Each scraped field gets an evidence ID so every finding traces back to an observed page element.' },
              { n:'03', color:'text-amber-300', title:'Prompt AI', desc:'Model allocation is tier-based and enforced server-side. Outputs are required in structured JSON.' },
              { n:'04', color:'text-emerald-300', title:'Validate', desc:'Responses are validated for score shape, category integrity, and evidence linkage before persistence.' },
              { n:'05', color:'text-cyan-300', title:'Recommend', desc:'Recommendations are ranked high / medium / low and cite the specific evidence ID that triggered each one.' },
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
              {['Live ChatGPT or Perplexity traffic to your site','Google SERP rankings or traditional SEO authority signals','Backlinks, domain age or historical content performance'].map((i) => (
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
            <p className="text-white/50 text-lg mb-6">All pricing verified server-side at checkout — no client-side overrides</p>
            <div className="inline-flex items-center gap-1 rounded-xl border border-white/12 bg-[#111827]/70 p-1">
              {(['monthly','annual'] as const).map((cycle) => (
                <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${billingCycle===cycle?'bg-white/12 text-white':'text-white/50 hover:text-white/75'}`}>
                  {cycle === 'monthly' ? 'Monthly' : <><span>Annual</span><span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">Save ~20%</span></>}
                </button>
              ))}
            </div>
            {billingCycle === 'annual' && <p className="mt-3 text-xs text-emerald-300/70">✓ Annual upfront purchase of Signal &amp; Score Fix earns redeemable credits toward features within your tier</p>}
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {TIERS.map((plan) => {
              const displayPrice = billingCycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
              return (
                <motion.div key={plan.key} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`rounded-2xl border p-6 flex flex-col ${plan.color}`}>
                  {plan.badge && <div className={`inline-block px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mb-3 ${plan.accentClass} border-current opacity-80`}>{plan.badge}</div>}
                  <h3 className="text-xl font-bold text-white mb-0.5">{plan.name}</h3>
                  <p className={`text-xs uppercase tracking-widest ${plan.accentClass} mb-4 font-semibold`}>{plan.subtitle}</p>
                  <div className="mb-2">
                    {plan.monthlyPrice === 0 ? <span className="text-4xl font-black text-white">Free</span> : (
                      <div>
                        <span className="text-4xl font-black text-white">{billingCycle==='annual'?`$${plan.annualMonthlyPrice}`:`$${plan.monthlyPrice}`}</span>
                        <span className="text-white/45 text-sm">/mo</span>
                        {billingCycle==='annual' && <span className="ml-2 text-white/30 text-xs line-through">${plan.monthlyPrice}/mo</span>}
                      </div>
                    )}
                    <p className="text-xs text-white/40 mt-1">{plan.scans} audits / month</p>
                  </div>
                  {plan.creditHint && billingCycle==='annual' && <p className="text-[11px] text-emerald-300/65 mb-3 border-l-2 border-emerald-400/30 pl-2">{plan.creditHint}</p>}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <svg className={`w-4 h-4 shrink-0 mt-0.5 ${plan.accentClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-white/60">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" disabled={plan.monthlyPrice===0||loadingTier!==null} onClick={() => handlePayment(plan.key)}
                    className={`w-full py-3 px-5 rounded-xl font-semibold text-sm transition ${
                      plan.monthlyPrice===0?'bg-white/5 text-white/30 cursor-default border border-white/10':
                      loadingTier===plan.key?'opacity-60 cursor-wait bg-white/10 text-white border border-white/15':
                      `border ${plan.accentClass} border-current bg-current/10 hover:bg-current/20 text-white`
                    }`}>
                    {plan.monthlyPrice===0?'Start Free':loadingTier===plan.key?'Processing…':billingCycle==='annual'?`Get ${plan.name} (Annual)`:`Get ${plan.name}`}
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
            {([
              { q:'What is AiVIS.biz and what does it audit?', a:'AiVIS.biz measures AI visibility — how well AI answer engines like ChatGPT, Perplexity, Google AI, and Claude can read, extract, trust, and cite your page content. It fetches your live page and scores six evidence-backed categories.' },
              { q:'How is AI visibility different from traditional SEO?', a:'Traditional SEO targets keyword rankings and backlinks. AI answer engines synthesize responses from structured content — thin structure, missing schema, or poor heading hierarchy means you get skipped, regardless of domain authority.' },
              { q:'Is the Score Fix output a real feature or a marketing preview?', a:'The Score Fix Pack is a real paid output. Signal and Score Fix subscribers receive an evidence-linked JSON-LD patch, H1 rewrite suggestion, and FAQ block generated from their actual audit findings.' },
              { q:'Does AiVIS.biz work across all AI platforms?', a:'Yes. AiVIS.biz scores visibility for ChatGPT, Perplexity AI, Google AI Overviews, and Claude individually (0–100). Signal and Score Fix run a 3-model triple-check pipeline for higher accuracy.' },
              { q:'What happens to unused monthly audits?', a:'Monthly audit credits reset at billing cycle start and do not roll over. Annual Signal and Score Fix subscribers earn redeemable credits toward features within their tier.' },
            ] as const).map(({ q, a }) => (
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
          <div className="mb-8">
            <img src="/images/aivis-logo-hero.png" alt="AiVIS.biz" className="h-16 sm:h-20 w-auto object-contain mx-auto mix-blend-screen brightness-110 saturate-125" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Know your{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">AI visibility score</span>
            <br />in under a minute
          </h2>
          <p className="text-lg text-white/50 mb-10">Free tier · No credit card · Evidence-backed output from your live page</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-9 py-4 rounded-full text-lg font-bold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/25">
              Audit your site free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
            <Link to="/pricing" className="inline-flex items-center justify-center gap-2 bg-transparent text-white/65 px-9 py-4 rounded-full text-lg font-semibold border border-white/18 hover:text-white hover:border-white/30 transition-all">
              View all plans
            </Link>
          </div>
          <p className="mt-8 text-xs text-white/30">{MARKETING_CLAIMS.modelAllocation}</p>
        </div>
      </section>
    </div>
  );
};

export default Landing;
'@

$outPath = "C:\Users\Ma`$e\Downloads\ai-visible-engine-v2\aivis\client\src\pages\Landing.tsx"
[IO.File]::WriteAllText($outPath, $content)
Write-Host "Written: $((Get-Content $outPath | Measure-Object -Line).Lines) lines"
