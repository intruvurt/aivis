// Enterprise Landing — AiVIS
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Sparkles, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import usePageVisible from '../hooks/usePageVisible';
import { MARKETING_CLAIMS } from '../constants/marketingClaims';
import { PLATFORM_NARRATIVE } from '../constants/platformNarrative';
import { CANONICAL_TIER_PRICING, TIER_LIMITS } from '../../../shared/types';
import PlatformShiftBanner from '../components/PlatformShiftBanner';

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
      <text x="170" y="383" fontSize="5" fill="rgba(34,211,238,0.3)" fontFamily="monospace" letterSpacing="2">AI VISIBILITY INTELLIGENCE AUDITS</text>
    </svg>
  );
}

const TIERS = [
  {
    key: 'observer', name: 'Observer', subtitle: 'Free',
    monthlyPrice: CANONICAL_TIER_PRICING.observer.monthlyUsd ?? 0,
    annualMonthlyPrice: CANONICAL_TIER_PRICING.observer.yearlyUsd ? Math.round(CANONICAL_TIER_PRICING.observer.yearlyUsd / 12) : 0,
    scans: TIER_LIMITS.observer.scansPerMonth,
    color: 'border-white/20 bg-[#111827]/50', accentClass: 'text-white/70', badge: null, creditHint: null,
    features: [`${TIER_LIMITS.observer.scansPerMonth} audits / month`,'AI visibility score (0–100)','Keyword intelligence','Schema markup audit','Heading & meta tag analysis','Core recommendations','Public share links (redacted)'],
  },
  {
    key: 'alignment', name: 'Alignment', subtitle: 'Core',
    monthlyPrice: CANONICAL_TIER_PRICING.alignment.monthlyUsd ?? 49,
    annualMonthlyPrice: CANONICAL_TIER_PRICING.alignment.yearlyUsd ? Math.round(CANONICAL_TIER_PRICING.alignment.yearlyUsd / 12) : 29,
    scans: TIER_LIMITS.alignment.scansPerMonth,
    color: 'border-cyan-400/30 bg-[#0d1f2d]/60 ring-1 ring-cyan-400/20', accentClass: 'text-cyan-300', badge: 'Most Popular', creditHint: 'Annual plan: earn credits toward API add-ons',
    features: [`${TIER_LIMITS.alignment.scansPerMonth} audits / month`,'Single-model production audits','Analytics dashboard & trends',`Competitor tracking (${TIER_LIMITS.alignment.competitors})`,`Brand mention tracking (15 sources)`,'BRA authority checker','Reverse Engineer tools','Private exposure scan','Niche URL discovery',`Multi-page SEO crawl (${TIER_LIMITS.alignment.pagesPerScan} pages)`,'CSV, PDF & JSON exports','Force-refresh audits','Scheduled rescans (monthly)',`API key (${TIER_LIMITS.alignment.maxApiKeys})`,`Webhooks (${TIER_LIMITS.alignment.maxWebhooks})`,'MCP Server access','OpenAPI spec + OAuth 2.0'],
  },
  {
    key: 'signal', name: 'Signal', subtitle: 'Premium',
    monthlyPrice: CANONICAL_TIER_PRICING.signal.monthlyUsd ?? 99,
    annualMonthlyPrice: CANONICAL_TIER_PRICING.signal.yearlyUsd ? Math.round(CANONICAL_TIER_PRICING.signal.yearlyUsd / 12) : 89,
    scans: TIER_LIMITS.signal.scansPerMonth,
    color: 'border-violet-400/35 bg-[#160d2a]/60 ring-1 ring-violet-400/20', accentClass: 'text-violet-300', badge: '14-day free trial', creditHint: 'Yearly subscribers earn tier credits redeemable within Signal features',
    features: [`${TIER_LIMITS.signal.scansPerMonth} audits / month`,'Triple-Check AI Pipeline (3 models)','14-day free trial included','Expanded competitor tracking','Advanced citation testing','AI Citation Tracker','Wikipedia search integration','Slack + Discord alerts','Zapier workflows (Notion/Airtable/CRM)','MCP Server (AI agents)','API access + white-label reports','Scheduled rescans'],
  },
  {
    key: 'scorefix', name: 'Score Fix', subtitle: 'AutoPR',
    monthlyPrice: CANONICAL_TIER_PRICING.scorefix.oneTimeUsd ?? 299,
    annualMonthlyPrice: CANONICAL_TIER_PRICING.scorefix.oneTimeUsd ?? 299,
    scans: TIER_LIMITS.scorefix.scansPerMonth,
    color: 'border-amber-400/30 bg-[#1a1200]/60 ring-1 ring-amber-400/20', accentClass: 'text-amber-300', badge: 'Credit pack', creditHint: '250-credit pack · 10-25 credits per automated GitHub PR fix via MCP',
    features: [`${TIER_LIMITS.scorefix.scansPerMonth} credits / pack`,'Signal-grade Triple-Check pipeline','Automated GitHub PR remediation via MCP','10-25 credits per fix (complexity-based)','Schema patches, H1 rewrites, FAQ blocks','Evidence-linked PRs pushed to your repo','API access + white-label','Priority execution support'],
  },
] as const;

const PUBLIC_PROOF_ITEMS = [
  {
    label: 'Before',
    value: '41',
    detail: 'Missing FAQPage schema, weak H1 hierarchy, thin answer coverage',
    tone: 'text-rose-300 border-rose-400/25 bg-rose-500/10',
  },
  {
    label: 'After',
    value: '74',
    detail: 'JSON-LD patch + heading rewrite + direct answer sections',
    tone: 'text-emerald-300 border-emerald-400/25 bg-emerald-500/10',
  },
] as const;

const SCORE_DROP_SIGNALS = [
  'No FAQPage or HowTo schema',
  'Broken H1-H3 intent hierarchy',
  'Meta/title mismatch with page intent',
  'No direct, citation-ready answer blocks',
] as const;

const WHAT_CHANGED_DIFF = [
  {
    title: 'Recommendation Diff',
    removed: ['"Add schema" (generic)', '"Improve headings" (generic)'],
    added: ['Add FAQPage JSON-LD (5 Q/A pairs)', 'Rewrite H1 for top-intent query'],
  },
  {
    title: 'Evidence Links',
    removed: ['No traceable source fields'],
    added: ['EVIDENCE_12: Missing FAQ schema node', 'EVIDENCE_27: H2 chain skips primary intent'],
  },
] as const;

// ─── Landing ─────────────────────────────────────────────────────────────────
const Landing = () => {
  const navigate = useNavigate();
  usePageMeta({
    title: 'AI Visibility Audit Platform | AiVIS',
    description: 'Enterprise AI visibility auditing for ChatGPT, Perplexity, Google AI, and Claude. Evidence-backed scoring with implementation-ready fixes.',
    path: '/landing',
    ogTitle: 'AiVIS – Measure How AI Sees Your Site',
  });

  const { isAuthenticated } = useAuthStore();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [heroUrl, setHeroUrl] = useState('');

  const pageVisible = usePageVisible();

  useEffect(() => {
    let cancelled = false;
    if (!pageVisible) return;
    getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); });
    const iv = setInterval(() => { getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); }); }, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [pageVisible]);

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
    <div className="min-h-screen">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-10 pb-16 min-h-[90vh] flex items-center">
        <div className="pointer-events-none absolute -top-60 -left-40 h-[700px] w-[700px] rounded-full bg-cyan-500/[0.09] blur-[160px]" />
        <div className="pointer-events-none absolute -top-32 right-[-120px] h-[550px] w-[550px] rounded-full bg-violet-500/[0.08] blur-[140px]" />
        <div className="pointer-events-none absolute bottom-[-50px] left-1/2 -translate-x-1/2 h-[250px] w-[700px] rounded-full bg-fuchsia-500/[0.05] blur-[110px]" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="select-none">
            <div className="grid items-center gap-8 sm:grid-cols-[1fr_320px] lg:grid-cols-[1fr_400px] sm:gap-10 lg:gap-16">

              {/* ── Left: Headline + context ── */}
              <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
                {/* Badge + logo */}
                <div className="mb-7 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/[0.08] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300/90">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Visibility Intelligence Audits
                  </div>
                  <img
                    src="/text-logo.png"
                    alt="AiVIS logo"
                    className="h-8 w-auto object-contain"
                    loading="eager"
                    decoding="async"
                  />
                </div>

                {/* H1 with gradient accent */}
                <h1 className="text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-[40px] lg:text-5xl xl:text-[64px]">
                  Measure whether AI can
                  <br className="hidden sm:block" />
                  <span
                    className="bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
                    style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  >
                    &nbsp;read, trust &amp; cite
                  </span>
                  <br />
                  your site
                </h1>

                <p className="mt-5 max-w-xl text-base leading-7 text-white/55 sm:text-[17px] sm:leading-8">
                  One audit returns a 0&#x2013;100 visibility score, six category grades, and
                  evidence-backed fixes &#x2014; ready to implement and re-audit.
                </p>

                {/* Platform coverage badges */}
                <div className="mt-7 flex flex-wrap gap-2">
                  {[
                    { name: 'ChatGPT',    dot: 'bg-emerald-400' },
                    { name: 'Perplexity', dot: 'bg-violet-400'  },
                    { name: 'Claude',     dot: 'bg-amber-400'   },
                    { name: 'Google AI',  dot: 'bg-cyan-400'    },
                  ].map((p) => (
                    <span
                      key={p.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
                      {p.name}
                    </span>
                  ))}
                </div>

                {/* Trust checklist */}
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {['6 scored categories', '8-12 fixes per audit', 'Evidence-backed findings', 'Export-ready reports'].map((stat) => (
                    <span key={stat} className="flex items-center gap-1.5 text-xs text-white/40">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                      {stat}
                    </span>
                  ))}
                </div>

                {/* URL input */}
                <div className="mt-8 max-w-xl">
                  <input
                    value={heroUrl}
                    onChange={(e) => setHeroUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navigate(heroUrl.trim() ? `/analyze?url=${encodeURIComponent(heroUrl.trim())}` : '/analyze'); } }}
                    placeholder="enter your site url"
                    className="w-full rounded-xl border border-white/15 bg-[#171a20] px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>

                {/* CTAs */}
                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(heroUrl.trim() ? `/analyze?url=${encodeURIComponent(heroUrl.trim())}` : '/analyze')}
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-violet-600 text-white px-7 py-3.5 rounded-full text-base font-semibold hover:from-cyan-500 hover:to-violet-500 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Run free audit
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                  <Link to="/pricing" className="inline-flex items-center justify-center bg-transparent text-white/60 px-7 py-3.5 rounded-full text-base font-medium hover:text-white transition-colors border border-white/15 hover:border-white/25">
                    View plans &amp; pricing
                  </Link>
                </div>
                <p className="mt-3 text-xs text-white/40">No signup required. Results in seconds.</p>
              </motion.div>

              {/* ── Right: Sample audit preview card ── */}
              <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }} className="hidden sm:block">
                <div className="card-smoke glass-bleed-cyan relative rounded-3xl p-6 shadow-[0_40px_100px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.035]">
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/[0.05] via-transparent to-violet-500/[0.06]" />
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">Example Audit</span>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Live run</span>
                    </div>
                    <div className="flex items-center gap-4 border-b border-white/[0.06] pb-4">
                      <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 68 68">
                          <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                          <circle cx="34" cy="34" r="28" fill="none" stroke="url(#hsg-landing)" strokeWidth="5" strokeLinecap="round" strokeDasharray="112.6 175.9" />
                          <defs><linearGradient id="hsg-landing" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#a78bfa" /></linearGradient></defs>
                        </svg>
                        <span className="relative text-xl font-black tabular-nums text-white">64</span>
                      </div>
                      <div>
                        <div className="font-mono text-[11px] text-white/30">example-site.com</div>
                        <div className="mt-1 text-sm font-bold text-amber-300">At Risk</div>
                        <div className="mt-0.5 text-[11px] text-white/35">3 high-priority issues</div>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {([
                        { label: 'Content Depth',  grade: 'A', score: 78, grad: 'from-emerald-400 to-emerald-300', gc: 'text-emerald-400' },
                        { label: 'Schema Markup',  grade: 'C', score: 52, grad: 'from-amber-400 to-orange-300',   gc: 'text-amber-400'   },
                        { label: 'Technical SEO',  grade: 'B', score: 66, grad: 'from-cyan-400 to-blue-300',      gc: 'text-cyan-400'    },
                        { label: 'AI Readability', grade: 'D', score: 38, grad: 'from-red-400 to-rose-300',       gc: 'text-red-400'     },
                      ] as const).map((cat) => (
                        <div key={cat.label} className="flex items-center gap-2.5">
                          <span className="w-24 shrink-0 truncate text-[10px] text-white/40">{cat.label}</span>
                          <div className="flex-1 overflow-hidden rounded-full bg-white/[0.07]" style={{ height: '6px' }}>
                            <div className={`h-full rounded-full bg-gradient-to-r ${cat.grad}`} style={{ width: `${cat.score}%` }} />
                          </div>
                          <span className={`w-4 text-right text-[10px] font-bold ${cat.gc}`}>{cat.grade}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/[0.06] pt-3.5">
                      <div className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.13em] text-white/25">Top Findings</div>
                      <div className="space-y-2">
                        {([
                          { text: 'Add FAQPage JSON-LD schema', hi: true  },
                          { text: 'Meta description too short (22 chars)', hi: true  },
                          { text: 'Add structured H2 heading hierarchy',  hi: false },
                        ] as const).map((rec) => (
                          <div key={rec.text} className="flex items-start gap-2">
                            <span className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${rec.hi ? 'bg-red-400' : 'bg-amber-400'}`} />
                            <span className="text-[11px] leading-4 text-white/45">{rec.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT'S ACTUALLY HAPPENING ── */}
      <section className="py-16 bg-[#060607]/80 border-t border-white/8 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-[#111827]/45 p-6 md:p-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">What’s actually happening</h2>
            <p className="text-white/70 mb-3">Your site can rank and still be invisible to AI.</p>
            <p className="text-white/60 mb-4">AI doesn’t choose the best page. It chooses the clearest, most verifiable one.</p>
            <ul className="list-disc pl-5 text-white/65 space-y-1 mb-4">
              <li>unclear content structure</li>
              <li>missing entity signals</li>
              <li>weak trust pages</li>
              <li>incomplete schema relationships</li>
            </ul>
            <p className="text-white/70 font-semibold">If AI can’t verify it, it won’t cite it.</p>
          </div>
        </div>
      </section>

      {/* ── WHAT AIVIS SHOWS ── */}
      <section className="py-16 bg-[#060607]/80 border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-8">What AiVIS shows you</h2>
          <div className="grid md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
              <h3 className="text-white font-semibold mb-2">What AI cannot verify</h3>
              <p className="text-white/65 text-sm">Missing structure, weak trust signals, incomplete schema, and low extraction clarity.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
              <h3 className="text-white font-semibold mb-2">Why competitors get chosen</h3>
              <p className="text-white/65 text-sm">Stronger citation patterns, better source presence, and cleaner extraction signals.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
              <h3 className="text-white font-semibold mb-2">What to fix first</h3>
              <p className="text-white/65 text-sm">Evidence-backed issues prioritized by impact and mapped directly to real pages.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU'RE LOSING ── */}
      <section className="py-14 bg-[#060607]/80 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">What you’re losing</h2>
          <p className="text-white/70 mb-4">You’re not losing rankings. You’re losing answers.</p>
          <ul className="list-disc pl-5 text-white/65 space-y-1">
            <li>competitors get quoted instead of you</li>
            <li>your content gets read but not used</li>
            <li>your pages show up but don’t get chosen</li>
          </ul>
          <p className="text-white/70 mt-4">That gap is where traffic disappears.</p>
        </div>
      </section>

      {/* ── WHAT AIVIS ACTUALLY DOES ── */}
      <section className="py-14 bg-[#060607]/80 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">What AiVIS actually does</h2>
          <p className="text-white/70 mb-3">AiVIS audits how AI systems interpret your site. Not opinions. Not guesses. Evidence.</p>
          <ul className="list-disc pl-5 text-white/65 space-y-1">
            <li>what was found</li>
            <li>where it was found</li>
            <li>why it matters</li>
            <li>what to fix</li>
          </ul>
        </div>
      </section>

      {/* ── HOW THIS WORKS ── */}
      <section className="py-24 bg-gradient-to-b from-[#060607] to-[#0a0a0f] border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">Platform scope</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">How this works: Run audit → See evidence → Fix → Re-audit → Track movement</span>
            </h2>
            <p className="text-white/55 text-lg max-w-3xl mx-auto">
              AiVIS is built for repeated improvement cycles, not one-off scans. Evidence, scoring, and remediation are chained in one loop so teams can ship and verify outcomes.
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="card-smoke glass-bleed-cyan rounded-2xl p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-cyan-300">Structural Readiness</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                The first pillar asks: can AI systems parse, extract, and trust your website content? AiVIS crawls your live page with a real browser, extracts headings, schema markup, meta tags, body content, and technical signals, then scores six evidence-backed categories. Every finding traces to a specific crawled element — not a generic checklist item. The output is a 0–100 visibility score with letter grades, implementation-ready recommendations, and a fix pack tied to evidence IDs.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                Structural readiness covers content depth and quality, heading hierarchy and H1 clarity, JSON-LD schema coverage, meta tag and Open Graph completeness, technical SEO signals like HTTPS and response time, and AI readability measures including citation-ready answer blocks. These six categories are weighted and composed into a single composite score using the BRAG methodology — every recommendation is backed by real, auditable, grounded evidence from your page.
              </p>
              <ul className="space-y-2">
                {['AI visibility score (0–100) with category grades','Evidence-linked findings with traceable IDs','Deterministic rule engine + AI model pipeline','Multi-page BFS crawl for site-wide diagnostics','Document upload audit (PDF, DOCX, images via OCR)','JSON-LD schema generator from page content','Content fix generator with AI-powered rewrite suggestions'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/55">
                    <svg className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="card-smoke glass-bleed-violet rounded-2xl p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-violet-300">Brand Presence Across AI</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                The second pillar asks: when AI systems answer questions about your industry, does your brand appear? AiVIS runs live citation tests across three free web search engines — DuckDuckGo HTML, Bing HTML, and DDG Instant Answer — in parallel, checking whether your brand name, domain, or key entities surface in results that AI models consume as source material. Citation testing on Signal and above uses AI-generated query packs, scheduled recurring tests, and a niche ranking engine that tracks your citation position over time.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                Brand mention tracking extends this further. AiVIS scans nine free public sources — Reddit, Hacker News, Mastodon, DuckDuckGo site-specific search, Bing site-specific search, Google News RSS, GitHub repositories, Quora, and Product Hunt — to find where your brand is being discussed. The mention timeline shows how your public visibility changes over time, while competitor comparison reveals who occupies the citation slots you are missing. Reverse engineering tools let you decompile AI answers, generate ghost blueprints of ideal cited pages, diff how different models respond, and simulate whether your content would be cited.
              </p>
              <ul className="space-y-2">
                {['Citation testing across 3 live search engines','Brand mention scanning across 9 public sources','Competitor tracking with category-by-category comparison','AI answer reverse engineering: decompile, ghost, diff, simulate','Niche ranking engine with historical position tracking','Citation scheduling with recurring automated tests','Mention timeline and trend visualization'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/55">
                    <svg className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
          <p className="text-center text-sm text-white/40 mt-8 max-w-2xl mx-auto">
            Both pillars operate on real infrastructure with live data. Structural readiness audits run through a Puppeteer scraper and AI model pipeline. Brand presence checks hit real search engines and public sources. No synthetic data, no static previews.
          </p>
        </div>
      </section>

      {/* ── WHY MOST SITES FAIL AI ── */}
      <section className="py-14 bg-[#060607]/80 border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold text-white mb-2">What works</h3>
            <ul className="list-disc pl-5 text-white/65 space-y-1">
              <li>clear entities</li>
              <li>strong headings</li>
              <li>real schema relationships</li>
              <li>concise answer blocks</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold text-white mb-2">What fails</h3>
            <ul className="list-disc pl-5 text-white/65 space-y-1">
              <li>vague language</li>
              <li>thin content</li>
              <li>disconnected structure</li>
              <li>incomplete metadata</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── INTELLIGENCE MODULES ── */}
      <section className="py-16 bg-[#060607]/80 border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[11px] tracking-widest uppercase text-violet-300 font-semibold mb-2">Intelligence modules</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Six modules. One operating loop.</h2>
            <p className="text-white/50 text-sm mt-3 max-w-2xl mx-auto">
              Every module answers a different question about your AI visibility. Together they form a closed loop from diagnosis to remediation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { to: '/prompt-intelligence', label: 'Prompt Intelligence', border: 'border-violet-400/15 hover:border-violet-400/30 bg-violet-500/[0.04]', head: 'text-violet-300', desc: 'How do AI models interpret queries about you?', detail: 'Map prompt patterns to inclusion, exclusion, and competitor displacement outcomes.' },
              { to: '/answer-presence', label: 'Answer Presence Engine', border: 'border-cyan-400/15 hover:border-cyan-400/30 bg-cyan-500/[0.04]', head: 'text-cyan-300', desc: 'Are you present in AI-generated answers?', detail: 'Track whether ChatGPT, Perplexity, Claude, and Google AI include your brand.' },
              { to: '/citations', label: 'Citation Intelligence', border: 'border-violet-400/15 hover:border-violet-400/30 bg-violet-500/[0.04]', head: 'text-violet-300', desc: 'Are AI systems citing your content as source?', detail: 'Run live citation tests across search engines and track mention rates over time.' },
              { to: '/brand-integrity', label: 'Brand Integrity Monitor', border: 'border-emerald-400/15 hover:border-emerald-400/30 bg-emerald-500/[0.04]', head: 'text-emerald-300', desc: 'Is what AI says about you correct?', detail: 'Monitor brand accuracy across 9 public sources and detect misrepresentations.' },
              { to: '/competitors', label: 'Competitor Displacement Map', border: 'border-emerald-400/15 hover:border-emerald-400/30 bg-emerald-500/[0.04]', head: 'text-emerald-300', desc: 'Who occupies the space you should own?', detail: 'Side-by-side visibility benchmarks with category-level competitor comparison.' },
              { to: '/score-fix', label: 'Remediation Engine', border: 'border-amber-400/15 hover:border-amber-400/30 bg-amber-500/[0.04]', head: 'text-amber-300', desc: 'How do you fix what the audit found?', detail: 'Automated GitHub PRs with schema patches, content rewrites, and evidence-linked fixes.' },
            ].map((mod) => (
              <Link key={mod.to} to={mod.to} className={`group rounded-2xl border ${mod.border} p-6 transition-all`}>
                <h3 className={`text-lg font-bold ${mod.head} mb-1`}>{mod.label}</h3>
                <p className="text-white/70 text-sm font-medium mb-2">{mod.desc}</p>
                <p className="text-white/40 text-xs leading-relaxed">{mod.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPETITIVE DIFFERENTIATOR ── */}
      <section className="py-20 bg-gradient-to-b from-[#060607] to-[#0a0a0f] border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-rose-400/25 bg-rose-500/8 text-rose-300 text-xs font-semibold uppercase tracking-widest mb-4">Beyond the dashboard</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-rose-300 via-white to-cyan-300 bg-clip-text text-transparent">Tracking platforms tell you IF AI sees your brand.<br />AiVIS tells you WHY it doesn't — and fixes it.</span>
            </h2>
            <p className="text-white/55 text-lg max-w-3xl mx-auto">
              Market-share charts and brand-mention dashboards are a starting point. But they never answer the hard question: what is technically broken on your page, and what exact change fixes it?
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/10 bg-[#111827]/40 p-6">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-2">Visibility dashboards</p>
              <p className="text-white/50 text-sm leading-relaxed">"Your brand appears in 12% of AI answers for your category." No explanation of why. No path to improve. Check back next month.</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-[#0d1f2d]/50 p-6 ring-1 ring-cyan-400/10">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-xs uppercase tracking-widest text-cyan-300 font-semibold mb-2">AiVIS diagnoses</p>
              <p className="text-white/65 text-sm leading-relaxed">"Your FAQPage schema is missing. H1 doesn't match primary intent. Answer blocks are too thin to extract. Here are 10 evidence-linked fixes ranked by impact."</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-6 ring-1 ring-emerald-400/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              </div>
              <p className="text-xs uppercase tracking-widest text-emerald-300 font-semibold mb-2">AiVIS fixes</p>
              <p className="text-white/65 text-sm leading-relaxed">"PR #47 opened: JSON-LD schema patch + H1 rewrite + 5 FAQ blocks. Pushed to your repo via MCP. Score moved from 41 to 74."</p>
            </div>
          </div>
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#111827]/40 p-6">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-base font-bold text-white mb-3">What tracking platforms give you</h3>
                <ul className="space-y-2">
                  {['Market share percentages by AI platform','Brand mention counts','Competitor visibility rankings','Trend lines over time'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/45">
                      <span className="text-white/30 mt-0.5">—</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-base font-bold text-cyan-300 mb-3">What AiVIS gives you on top of that</h3>
                <ul className="space-y-2">
                  {['6-dimension technical audit with evidence IDs','Specific broken elements traced to your page','8-12 prioritized, implementation-ready fixes','Triple-check AI consensus scoring (3 models)','Automated GitHub PRs that ship the fix','Before/after proof with stored baselines','15-source brand mention tracking','AI answer reverse engineering tools'].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/65">
                      <svg className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-white/40 mt-6 max-w-2xl mx-auto">
            {PLATFORM_NARRATIVE.competitiveWedge}
          </p>
        </div>
      </section>

      {/* ── PUBLIC PROOF ── */}
      <section className="py-14 bg-[#060607]/80 border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-[#111827]/65 p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] tracking-widest uppercase text-emerald-300 font-semibold">Public proof snapshot</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">What changed, what moved, and why</h2>
              </div>
              <Link to="/score-fix" className="text-sm text-cyan-300 hover:text-cyan-200 underline underline-offset-4">View full Score Fix flow</Link>
            </div>

            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5 items-stretch">
              <div>
                <div className="grid md:grid-cols-2 gap-4 mb-5">
                  {PUBLIC_PROOF_ITEMS.map((item) => (
                    <div key={item.label} className={`rounded-xl border p-4 ${item.tone}`}>
                      <p className="text-xs uppercase tracking-widest font-semibold mb-2">{item.label} score</p>
                      <p className="text-4xl font-black tabular-nums leading-none">{item.value}</p>
                      <p className="text-xs mt-2 text-white/65">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0b1220]/70 p-4">
                  <p className="text-xs uppercase tracking-widest text-white/45 mb-2">Mini evidence ledger</p>
                  <div className="grid sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/70">EVIDENCE_12 · Missing FAQPage node</div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/70">EVIDENCE_27 · Heading intent mismatch</div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/70">EVIDENCE_44 · Thin answer coverage</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0b1220]/70 p-4 flex flex-col justify-between overflow-hidden">
                <div>
                  <p className="text-xs uppercase tracking-widest text-cyan-300 mb-2">Platform output</p>
                  <h3 className="text-lg font-bold text-white mb-2">Live audit intelligence, not a static mockup</h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    AiVIS connects scoring, evidence, and remediation into one operating loop so teams can move from diagnosis to implementation without losing context.
                  </p>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#111827]/50 p-4 overflow-hidden">
                  <img src="/images/upload-analysis-pipeline.svg" alt="AiVIS analysis pipeline visualization" className="w-full h-auto rounded-xl border border-white/10 bg-black/20" loading="lazy" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FULL PLATFORM CAPABILITIES ── */}
      <section className="py-24 bg-[#060607]/80 border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/25 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">Full platform</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">Everything ships real — no gated mockups</span>
            </h2>
            <p className="text-white/55 text-lg max-w-3xl mx-auto">
              Every feature listed here runs on live infrastructure with real data. From audit evidence to automated PRs, citation testing to brand mention scanning — the platform delivers working results, not placeholder screens. Tier-gated features require the corresponding plan; free tools are available to everyone.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {([
              { icon: '🔍', title: 'AI Visibility Audits', desc: 'Puppeteer-based crawling with evidence-linked AI analysis. Six weighted categories scored 0–100 with letter grades. Single-page, multi-page (up to 500 pages), and document upload modes.', tier: 'All tiers' },
              { icon: '🧠', title: 'Triple-Check AI Pipeline', desc: 'Three independent AI models in sequence: primary analysis, peer critique with bounded score adjustment, and validation gate. If any stage fails, the system degrades gracefully to the last valid result.', tier: 'Signal+' },
              { icon: '📊', title: 'Decision Query Gaps', desc: 'Score history trends and query-level diagnostics that show where AI chooses competitors over your pages.', tier: 'Alignment+' },
              { icon: '🏷️', title: 'Schema & Content Generators', desc: 'AI-powered JSON-LD schema generation from your page content plus content fix suggestions for weak audit categories. Both generators reference your actual crawl evidence, not generic templates.', tier: 'Alignment+' },
              { icon: '🔗', title: 'Citation Testing', desc: 'Live citation checks across DuckDuckGo HTML, Bing HTML, and DDG Instant Answer — all running in parallel. Includes AI-generated query packs, scheduled recurring tests, niche ranking engine, and evidence curation.', tier: 'Signal+' },
              { icon: '📡', title: 'Brand Mention Tracking', desc: 'Scans nine free public sources — Reddit, Hacker News, Mastodon, DuckDuckGo, Bing, Google News RSS, GitHub, Quora, and Product Hunt — for brand mentions. Timeline view and trend analysis included.', tier: 'Alignment+' },
              { icon: '⚔️', title: 'Competitor Advantage Signals', desc: 'Track up to 10 competitor URLs with category comparison, source-level deltas, and opportunity detection to expose why they get cited.', tier: 'Alignment+' },
              { icon: '🔬', title: 'Reverse Engineering Suite', desc: 'Five tools for understanding AI answers: decompile AI responses, generate ghost blueprints of ideal cited pages, diff how models answer differently, simulate citation likelihood, and get AI rewrite suggestions.', tier: 'Alignment+' },
              { icon: '🛠️', title: 'Score Fix AutoPR', desc: 'Connects to your GitHub repo via MCP and pushes pull requests with concrete fixes — JSON-LD patches, H1 rewrites, FAQ blocks — each costing 10–25 credits per fix based on complexity.', tier: 'Score Fix' },
              { icon: '🔌', title: 'API, OAuth 2.0 & MCP', desc: 'REST API with OpenAPI 3.0 spec and full OAuth 2.0 authorization code flow. MCP Server with 14 tool endpoints for AI coding agents. WebMCP discovery for browser-based AI integration.', tier: 'Alignment+' },
              { icon: '🪝', title: 'Webhooks & Deploy Hooks', desc: 'HMAC-signed webhook payloads dispatched on audit events. Deploy hooks trigger automatic rescans after deployment. Report delivery targets auto-send results to email or endpoints.', tier: 'Alignment+' },
              { icon: '📈', title: 'GSC Integration & IndexNow', desc: 'Google Search Console OAuth integration correlates GSC performance data with AI visibility audits. IndexNow submission for faster search indexing of updated pages.', tier: 'Alignment+' },
              { icon: '👥', title: 'Team Workspaces', desc: 'Multi-tenant workspace system with role-based access, member invitations, and workspace-scoped audit filtering. Up to 3 members on Alignment, 10 on Signal, unlimited on Score Fix.', tier: 'Alignment+' },
              { icon: '🛡️', title: 'Private Exposure Scan', desc: 'Scans scraped page content for private data exposure risks: leaked API keys, credentials, internal URLs, and sensitive configurations visible in page source.', tier: 'All tiers' },
              { icon: '🆓', title: 'Free Public Tools', desc: 'Schema validator, robots.txt checker, content extractability analyzer, and server headers check — all available without login or subscription. Rate-limited to prevent abuse.', tier: 'Public' },
            ] as const).map((feature) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="rounded-xl border border-white/10 bg-[#111827]/50 p-5 hover:border-white/18 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg">{feature.icon}</span>
                  <h3 className="text-base font-bold text-white">{feature.title}</h3>
                </div>
                <p className="text-sm text-white/55 leading-relaxed mb-3">{feature.desc}</p>
                <span className="inline-block px-2 py-0.5 rounded-full border border-white/12 bg-white/5 text-[10px] text-white/40 font-mono tracking-wider">{feature.tier}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 rounded-2xl border border-white/10 bg-[#111827]/40 p-6">
            <h3 className="text-lg font-bold text-white mb-3">Implementation integrity</h3>
            <p className="text-sm text-white/55 leading-relaxed">
              AiVIS does not display features that are not built. Every capability listed above runs production code with real database operations, live API calls, and user-scoped data persistence. Tier-gated features check server-side entitlements — the client displays the gate, but the server enforces it. Locked features return clear HTTP status codes; the Integration Hub classifies each endpoint as operational, gated, or temporarily unavailable. If a feature is marked as locked or under upgrade, that status is truthful and intentional.
            </p>
          </div>
        </div>
      </section>

      {/* ── SCORE FIX PREVIEW ── */}
      <section className="py-20 bg-[#060607]/80 border-t border-white/8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">✓ Automated PRs</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              <span className="bg-gradient-to-r from-emerald-300 via-white to-cyan-300 bg-clip-text text-transparent">Score Fix AutoPR — automated GitHub remediation</span>
            </h2>
            <p className="text-white/50 text-sm max-w-xl mx-auto">Not a mockup. Score Fix connects to your GitHub repo via MCP and opens PRs with schema patches, H1 rewrites, and FAQ blocks — costing 10-25 credits per fix.</p>
          </div>
          <div className="max-w-3xl mx-auto mb-8 rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-5">
            <h3 className="text-base font-bold text-emerald-300 mb-2">How Score Fix AutoPR works</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Score Fix connects to your GitHub repo via MCP and generates pull requests for each remediation. Each PR contains concrete fixes — JSON-LD schema patches, H1 rewrites, FAQ blocks — tied to audit evidence IDs. Each automated PR costs 10-25 credits depending on complexity. Your 250 credits typically cover 10-25 full remediation PRs per pack.
            </p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-[#323a4c]/40 p-3 sm:p-4 shadow-2xl">
            <img src="/images/fix-pack-preview.svg" alt="Score Fix AutoPR: automated GitHub PR with schema patch + H1 rewrite + FAQ block" className="w-full h-auto rounded-xl" loading="lazy" />
          </div>
          <p className="mt-3 text-xs text-white/40 text-center">Automated PR output: schema patch + H1 rewrite + FAQ block · Pushed to your GitHub repo via MCP</p>
          <div className="mt-5 flex justify-center">
            <Link to="/score-fix" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/18 transition-colors">
              See Score Fix AutoPR details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── METHODOLOGY ── */}
      <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 items-start">
            <div>
              <div className="mb-12">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">Method</span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  <span className="bg-gradient-to-r from-cyan-300 to-white bg-clip-text text-transparent">What happens when you submit a URL</span>
                </h2>
                <p className="text-white/45 text-sm mt-2 font-mono">No black box. <Link to="/methodology" className="text-cyan-300/70 hover:text-cyan-300 underline">Methodology</Link></p>
              </div>
              <ol className="space-y-6">
                {([
                  { n:'01', color:'text-cyan-300', title:'Scrape', desc:'Fetch live page signals: title, headings, schema, meta tags, content, and links.' },
                  { n:'02', color:'text-violet-300', title:'Label evidence', desc:'Assign evidence IDs so every finding traces to a page element.' },
                  { n:'03', color:'text-amber-300', title:'Prompt AI', desc:'Use tier-based server-side model routing with structured JSON output.' },
                  { n:'04', color:'text-emerald-300', title:'Validate', desc:'Validate score shape, category integrity, and evidence linkage.' },
                  { n:'05', color:'text-cyan-300', title:'Recommend', desc:'Rank recommendations by impact and cite the triggering evidence IDs.' },
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
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Scope and limitations — what AiVIS does NOT measure</h3>
                <ul className="space-y-2">
                  {['Live ChatGPT or Perplexity traffic to your site','Google SERP rankings or traditional SEO authority signals','Backlinks, domain age, or historical content performance'].map((i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/50"><span className="text-red-400 mt-0.5">✕</span><span>{i}</span></li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-white/45 leading-relaxed">
                  AiVIS focuses exclusively on structural readiness — whether AI systems can parse, trust, and cite your content. It does not track referral traffic from AI platforms or replicate traditional SEO ranking metrics. This separation ensures the audit measures what you can directly control: content depth, schema quality, heading clarity, and metadata completeness.
                </p>
              </div>
            </div>

            <div className="lg:pt-8">
              <div className="rounded-2xl border border-white/10 bg-[#111827]/65 p-4 overflow-hidden">
                <p className="text-xs uppercase tracking-widest text-cyan-300 mb-2">Workflow visualization</p>
                <h3 className="text-lg font-bold text-white mb-2">One platform, one flow</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-4">
                  Audit, evidence, remediation, and validation should live in the same system. That is how teams move fast without introducing drift between diagnosis and execution.
                </p>
                <img src="/images/platform-workflow-flowchart.svg" alt="AiVIS platform workflow flowchart" className="w-full h-auto rounded-xl border border-white/10 bg-black/20" loading="lazy" />
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#111827]/50 p-4 overflow-hidden">
                <img src="/images/upload-analysis-pipeline.svg" alt="AiVIS analysis pipeline visualization" className="w-full h-auto rounded-xl border border-white/10 bg-black/20" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-[#060607] to-[#0a0a0f] border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/25 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">Transparent pricing</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400 mb-3">
              <span className="bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">Simple, transparent pricing</span>
            </h2>
            <p className="text-white/50 text-lg mb-6">All pricing verified server-side at checkout — no client-side overrides</p>
            <div className="inline-flex items-center gap-1 rounded-xl border border-white/12 bg-[#111827]/70 p-1">
              {(['monthly','annual'] as const).map((cycle) => (
                <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${billingCycle===cycle?'bg-white/12 text-white':'text-white/50 hover:text-white/75'}`}>
                  {cycle === 'monthly' ? 'Monthly' : <><span>Annual</span><span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">Save ~20%</span></>}
                </button>
              ))}
            </div>
            {billingCycle === 'annual' && <p className="mt-3 text-xs text-emerald-300/70">✓ Annual Signal purchase earns redeemable credits toward features within your tier</p>}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-[#111827]/55 p-3 overflow-hidden">
                <img src="/images/tier-alignment-sm.png" alt="Alignment tier workflow preview" className="w-full h-auto rounded-xl border border-white/10 bg-black/20" loading="lazy" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111827]/55 p-3 overflow-hidden">
                <img src="/images/tier-signal-sm.png" alt="Signal tier workflow preview" className="w-full h-auto rounded-xl border border-white/10 bg-black/20" loading="lazy" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111827]/55 p-3 overflow-hidden">
                <img src="/images/tier-scorefix-sm.png" alt="Score Fix tier workflow preview" className="w-full h-auto rounded-xl border border-white/10 bg-black/20" loading="lazy" />
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {TIERS.map((plan) => {
              const isOneTimePlan = plan.key === 'scorefix';
              const displayPrice = billingCycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
              return (
                <motion.div key={plan.key} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`rounded-2xl border p-6 flex flex-col ${plan.color}`}>
                  {plan.badge && <div className={`inline-block px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mb-3 ${plan.accentClass} border-current opacity-80`}>{plan.badge}</div>}
                  <h3 className="text-xl font-bold text-white mb-0.5">{plan.name}</h3>
                  <p className={`text-xs uppercase tracking-widest ${plan.accentClass} mb-4 font-semibold`}>{plan.subtitle}</p>
                  <div className="mb-2">
                    {plan.monthlyPrice === 0 ? <span className="text-4xl font-black text-white">Free</span> : (
                      <div>
                        <span className="text-4xl font-black text-white">{isOneTimePlan ? `$${plan.monthlyPrice}` : billingCycle==='annual' ? `$${plan.annualMonthlyPrice}` : `$${plan.monthlyPrice}`}</span>
                        <span className="text-white/45 text-sm">{isOneTimePlan ? ' one-time' : '/mo'}</span>
                        {!isOneTimePlan && billingCycle==='annual' && <span className="ml-2 text-white/30 text-xs line-through">${plan.monthlyPrice}/mo</span>}
                      </div>
                    )}
                    <p className="text-xs text-white/40 mt-1">{plan.scans} audits / month</p>
                  </div>
                  {plan.creditHint && ((billingCycle==='annual' && !isOneTimePlan) || isOneTimePlan) && <p className="text-[11px] text-emerald-300/65 mb-3 border-l-2 border-emerald-400/30 pl-2">{plan.creditHint}</p>}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <svg className={`w-4 h-4 shrink-0 mt-0.5 ${plan.accentClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-white/60">{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.monthlyPrice===0?(
                    <Link to={isAuthenticated?'/':'/auth?mode=signup'}
                      className="block w-full py-3 px-5 rounded-xl font-semibold text-sm transition border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-center">
                      {isAuthenticated?'Go to Dashboard':'Start Free'}
                    </Link>
                  ):(
                  <button type="button" disabled={loadingTier!==null} onClick={() => handlePayment(plan.key)}
                    className={`w-full py-3 px-5 rounded-xl font-semibold text-sm transition ${
                      loadingTier===plan.key?'opacity-60 cursor-wait bg-white/10 text-white border border-white/15':
                      `border ${plan.accentClass} border-current bg-current/10 hover:bg-current/20 text-white`
                    }`}>
                    {loadingTier===plan.key?'Processing…':isOneTimePlan?`Buy ${plan.name}`:billingCycle==='annual'?`Get ${plan.name} (Annual)`:`Get ${plan.name}`}
                  </button>
                  )}
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
            <h2 className="text-3xl font-bold text-white">
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">Frequently asked questions</span>
            </h2>
          </div>
          <dl className="space-y-5">
            {([
              { q:'What is included in the free tier?', a:'Observer includes 3 lifetime audits with up to 3 pages per audit. You get verdict, top blockers, and a competitor gap preview. Full evidence + competitor source intelligence are intentionally locked for paid tiers.' },
              { q:'What does AiVIS actually audit?', a:'AiVIS audits whether ChatGPT, Perplexity, Google AI, and Claude can read, extract, trust, and cite your page. It scores six evidence-backed categories — content depth, heading structure, schema markup, metadata, technical SEO, and AI citability — from your live URL. The output is a 0–100 visibility score with category grades and prioritized, evidence-linked recommendations. Every finding references a specific crawled page element through BRAG evidence IDs.' },
              { q:'How is this different from a standard SEO audit?', a:'Standard SEO audits optimize for ranked pages and clicks. AiVIS measures whether AI systems can actually understand, trust, and cite your business when answers replace links, summaries, and overviews. Every finding is tied to a specific crawled signal, not a generic checklist. The platform also tracks brand presence across citation sources and public discussion platforms — something traditional SEO tools do not measure.' },
              { q:'What are the two types of AI visibility?', a:'The first type is structural readiness — whether AI can parse your schema, headings, content depth, and metadata well enough to extract trustworthy information. The second type is brand presence — whether your business actually appears when AI systems answer questions in your industry. AiVIS measures both: the audit pipeline handles structural readiness, while citation testing, brand mention scanning, and competitor tracking handle brand presence.' },
              { q:'How does citation testing work?', a:'AiVIS runs live citation checks across three free web search engines — DuckDuckGo HTML, Bing HTML, and DDG Instant Answer — all in parallel. On Signal tier and above, you can create AI-generated query packs, schedule recurring tests, and track your niche ranking position over time. The citation evidence view shows exactly which sources mention your brand and how the results change between test runs.' },
              { q:'What sources does brand mention tracking monitor?', a:'Brand mention tracking scans nine free public sources: Reddit, Hacker News, Mastodon, DuckDuckGo site-specific search, Bing site-specific search, Google News RSS, GitHub repositories, Quora, and Product Hunt. The mention timeline shows when and where your brand appears, and trend analysis tracks changes over time. Available on the Alignment tier and above.' },
              { q:'Is the Score Fix output real?', a:'Yes. Score Fix connects to your GitHub repo via MCP and opens pull requests with concrete patches — JSON-LD schema blocks, H1 rewrites, FAQ sections — each tied to audit evidence IDs from your latest scan. Each automated PR costs 10–25 credits based on fix complexity. A 250-credit pack typically covers 10–25 full remediation PRs.' },
              { q:'How many AI models validate a single audit?', a:'On the Signal and Score Fix tiers, AiVIS runs a Triple-Check Pipeline: three independent AI models score, peer-critique, and validate each audit. The primary model generates the analysis, a second model reviews and adjusts within bounded limits, and a third model confirms the final score. If any stage fails, the system degrades gracefully to the previous valid result instead of failing the entire request.' },
              { q:'What integrations are available?', a:'AiVIS includes a REST API with OpenAPI 3.0 documentation, full OAuth 2.0 authorization code flow, MCP Server with 14 tool endpoints for AI coding agents, WebMCP for browser-based AI integration, HMAC-signed webhooks, deploy hooks that trigger rescans after deployment, report delivery to email or endpoints, Google Search Console integration, and IndexNow URL submission. All integrations are available on the Alignment tier and above.' },
              { q:'What scoring categories does AiVIS use?', a:'AiVIS evaluates six weighted categories: Content Depth and Quality (20%), Schema and Structured Data (20%), AI Readability and Citability (20%), Technical SEO Signals (15%), Meta Tags and Open Graph (13%), and Heading Structure and H1 (12%). Each category receives a letter grade and contributes to the composite 0–100 visibility score. The audit report shows which categories are strongest and which have the highest improvement potential.' },
            ] as const).map(({ q, a }) => (
              <div key={q} className="border border-white/10 bg-[#111827]/50 rounded-2xl p-6 hover:border-white/18 transition-colors">
                <h3 className="text-base font-semibold text-white mb-2">{q}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{a}</p>
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
            <img src="/text-logo.png" alt="AiVIS" className="h-11 sm:h-12 w-auto object-contain mx-auto mix-blend-screen brightness-110 saturate-125" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Know your{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">AI visibility score</span>
            <br />before your buyers never see you
          </h2>
          <p className="text-lg text-white/50 mb-10">Free tier · No credit card · Evidence-backed fixes from your live page</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?mode=signup" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-9 py-4 rounded-full text-lg font-bold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/25">
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
