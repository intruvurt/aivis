// client/src/views/PricingPage.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  Loader2,
  Zap,
  Shield,
  Rocket,
  ArrowRight,
  Sparkles,
  CreditCard,
  Receipt,
  WalletCards,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import apiFetch from "../utils/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { useTranslation } from "react-i18next";
import { TIER_BRAND_PALETTE } from "../constants/uiPalette";
import { SOFTWARE_APPLICATION_ID, buildFaqSchema, buildOrganizationRef, buildOrganizationSchema, buildWebPageSchema } from "../lib/seoSchema";

type BillingPeriod = "monthly" | "yearly";

interface TierLimits {
  scans_per_month: number;
  pages_per_scan: number;
  competitors: number;
  cache_days: number;
  exports: boolean;
  force_refresh: boolean;
  api_access: boolean;
  white_label: boolean;
}

interface TierPrice {
  amount: number;
  formatted: string;
}

interface TierPricing {
  key: string;
  name: string;
  displayName: string;
  billingModel: "free" | "subscription" | "one_time";
  pricing: {
    monthly: TierPrice | null;
    yearly: TierPrice | null;
    one_time?: TierPrice | null;
  };
  features: string[];
  limits: TierLimits;
  isPaid: boolean;
}

interface PricingResponse {
  success: boolean;
  tiers: TierPricing[];
  defaultTier: string;
}

interface CheckoutResponse {
  success?: boolean;
  url?: string;
  data?: string;
  error?: string;
}

const TIER_ICONS: Record<string, ReactNode> = {
  observer: <Shield className="w-6 h-6" />,
  alignment: (
    <img
      src="/images/tier-alignment-sm.png"
      alt="Alignment"
      className="w-8 h-8 object-contain tier-icon-brand"
    />
  ),
  signal: (
    <img
      src="/images/tier-signal-sm.png"
      alt="Signal"
      className="w-8 h-8 object-contain tier-icon-brand"
    />
  ),
  scorefix: (
    <img
      src="/images/tier-scorefix-sm.png"
      alt="Score Fix"
      className="w-8 h-8 object-contain tier-icon-brand"
    />
  ),
};

const TIER_COLORS: Record<
  string,
  { gradient: string; border: string; glow: string }
> = TIER_BRAND_PALETTE;

const TIER_POSITIONING: Record<string, string> = {
  observer: "find out what AI models can actually read on your site — free",
  alignment: "turn audit findings into fixes you can export and implement",
  signal: "run audit workflows across multiple sites and team members",
  scorefix: "ship fixes automatically as GitHub pull requests via MCP",
};

const TIER_AUDIENCE: Record<string, string> = {
  observer: "For anyone who wants to know what AI can actually read on their site",
  alignment: "For people who need to fix what the audit found, not just see it",
  signal: "For agencies and teams running audits across multiple client sites",
  scorefix: "For teams who want fixes shipped as pull requests automatically",
};

const TIER_COPY: Record<string, { headline: string; body: string; includes: string[]; cta: string; priceLabel?: string }> = {
  observer: {
    headline: "See what AI gets wrong",
    body: "Run your first audits and expose the blockers stopping AI from trusting and citing your site.",
    includes: [
      "3 audits/month",
      "up to 3 pages per audit",
      "top 3 proven blockers",
      "limited evidence preview",
      "1 competitor gap snapshot",
      "shareable report",
    ],
    cta: "Run free audit",
  },
  alignment: {
    headline: "Turn findings into fixes",
    body: "Get full evidence and a clear fix plan so you stop guessing what matters.",
    includes: [
      "full report",
      "full evidence",
      "prioritized fix plan",
      "exportable reports",
      "limited competitor intelligence",
      "40–60 audits/month",
    ],
    cta: "Fix what’s blocking you",
    priceLabel: "$29–49/mo",
  },
  signal: {
    headline: "Track who is beating you and why",
    body: "Monitor citations, competitors, and visibility shifts over time and see what changes after every fix.",
    includes: [
      "citation tracking",
      "competitor intelligence",
      "source gap detection",
      "scheduled rescans",
      "historical deltas",
      "alerts",
      "full evidence ledger",
    ],
    cta: "Track your visibility",
  },
  scorefix: {
    headline: "Ship fixes, not guesses",
    body: "Get exact remediation mapped to code, pages, or structure and verify what improved after deployment.",
    includes: [
      "exact remediation",
      "PR-ready outputs",
      "verification after fix",
    ],
    cta: "Get the fix pack",
    priceLabel: "$299",
  },
};

const VALUE_RAIL = [
  {
    icon: ShieldCheck,
    title: "Diagnose, not just track",
    detail:
      "Visibility dashboards show you a chart. AiVIS shows you the broken schema, the missing FAQ block, and the exact line that needs to change.",
  },
  {
    icon: Zap,
    title: "Evidence-linked fixes, not generic advice",
    detail:
      "Every recommendation traces to a specific crawled element on your page — not a vague suggestion to 'improve your content.'",
  },
  {
    icon: Rocket,
    title: "Ship the fix, not just the report",
    detail:
      "Score Fix opens a real GitHub PR with schema patches, H1 rewrites, and FAQ blocks. No other AI visibility tool goes from audit to merged code.",
  },
] as const;

const PRICING_FAQ_ITEMS = [
  {
    question: "Is AiVIS free to use?",
    answer:
      "Yes. Observer is free and includes 3 audits per month, up to 3 pages per audit, top blockers, and a limited evidence preview. No credit card is required to start.",
  },
  {
    question: "How is AiVIS different from AI visibility dashboards like Semrush?",
    answer:
      "Tracking platforms show you market share charts and tell you if AI mentions your brand. AiVIS goes deeper: it crawls your actual page, identifies the specific technical failures blocking citations (missing schema, weak headings, thin answer blocks), scores six evidence-backed dimensions, and — with Score Fix — opens a GitHub PR that ships the fix. The difference is diagnosis and remediation vs. monitoring.",
  },
  {
    question: "What is the difference between Observer, Alignment, and Signal?",
    answer:
      "Observer gives a verdict, top blockers, and a competitor gap preview. Alignment unlocks full evidence and fix planning. Signal adds ongoing tracking, citation movement, source-gap detection, and alerts so teams can monitor what changes after each fix.",
  },
  {
    question: "What does multi-model AI validation mean?",
    answer:
      "Multi-model validation runs a triple-check AI pipeline: three independent models score, critique, and validate each audit. This surfaces advisory findings that crawl analysis alone cannot fully detect, like answer completeness, claim substantiation, and entity specificity. It is available on Signal and Score Fix plans. Score Fix also adds automated GitHub PR generation via MCP, costing 10-25 credits per fix.",
  },
  {
    question: "How does annual billing work?",
    answer:
      "Annual billing is charged upfront and includes discounted pricing versus month-to-month plans where available. Observer remains free. Alignment and Signal annual totals are shown at checkout and billing settings, and you can switch from monthly to annual at any time.",
  },
  {
    question: "Can I cancel at any time?",
    answer:
      "Yes. Paid plans are managed in Billing Center and can be canceled from account settings. Your plan remains active through the current paid period. Annual plan refund windows and terms are shown during checkout.",
  },
  {
    question: "Do audits roll over if I don't use them all?",
    answer:
      "No. Audit allowances reset at the start of each billing cycle. If your team consistently exceeds your allowance, upgrading to a higher tier is usually more cost-effective than staying on a constrained plan.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "AiVIS accepts major credit and debit cards through Stripe. Enterprise invoiced billing can be arranged for qualifying Signal annual customers — contact sales@aivis.biz. Crypto payment options are available by contacting support.",
  },
] as const;

function normalizeTierPrice(input: unknown): TierPrice | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  const amount = Number(candidate.amount ?? 0);
  const formatted = String(candidate.formatted ?? "").trim();

  if (!Number.isFinite(amount) || amount < 0) return null;

  return {
    amount,
    formatted,
  };
}

function normalizeTierLimits(input: unknown): TierLimits {
  const candidate =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    scans_per_month: Number(candidate.scans_per_month ?? 0),
    pages_per_scan: Number(candidate.pages_per_scan ?? 0),
    competitors: Number(candidate.competitors ?? 0),
    cache_days: Number(candidate.cache_days ?? 0),
    exports: Boolean(candidate.exports),
    force_refresh: Boolean(candidate.force_refresh),
    api_access: Boolean(candidate.api_access),
    white_label: Boolean(candidate.white_label),
  };
}

function normalizePricingTiers(input: unknown): TierPricing[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const tier = entry as Record<string, unknown>;
      const key = String(tier.key ?? "").trim().toLowerCase();
      const name = String(tier.name ?? "").trim();
      const displayName = String(tier.displayName ?? tier.name ?? "").trim();

      if (!key || !name) return null;

      const pricing =
        tier.pricing && typeof tier.pricing === "object"
          ? (tier.pricing as Record<string, unknown>)
          : {};

      const features = Array.isArray(tier.features)
        ? tier.features.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [];

      return {
        key,
        name,
        displayName,
        billingModel:
          String(tier.billingModel ?? "").trim().toLowerCase() === "one_time"
            ? "one_time"
            : String(tier.billingModel ?? "").trim().toLowerCase() === "subscription"
              ? "subscription"
              : "free",
        pricing: {
          monthly: normalizeTierPrice(pricing.monthly),
          yearly: normalizeTierPrice(pricing.yearly),
          one_time: normalizeTierPrice(pricing.one_time),
        },
        features,
        limits: normalizeTierLimits(tier.limits),
        isPaid: Boolean(tier.isPaid),
      } satisfies TierPricing;
    })
    .filter((tier) => Boolean(tier) && tier.key !== undefined) as TierPricing[];
}

function enrichTiersForDisplay(sourceTiers: TierPricing[]): TierPricing[] {
  return sourceTiers.map((tier) => {
    const nextFeatures = [...tier.features];

    const ensureFeature = (label: string, matcher: RegExp) => {
      if (nextFeatures.some((feature) => matcher.test(feature))) return;
      nextFeatures.unshift(label);
    };

    if (tier.key === "observer") {
      ensureFeature("Citation gap diagnosis", /citation gap|keyword intelligence/i);
      ensureFeature("Shareable public report links", /shareable|public report/i);
      ensureFeature("Team-ready baseline audits", /team-ready baseline audits/i);
    }

    if (tier.key === "alignment") {
      ensureFeature("Decision query gap analysis", /decision query gap|analytics dashboard/i);
      ensureFeature("Brand mention tracking (15 sources)", /brand mention/i);
      ensureFeature("Private exposure scan", /private exposure/i);
      ensureFeature("Competitor advantage signals", /competitor advantage|niche url/i);
      ensureFeature("MCP Server access", /mcp server/i);
      ensureFeature(
        "OpenAPI spec + OAuth 2.0 developer access",
        /openapi|oauth/i
      );
    }

    if (tier.key === "signal") {
      ensureFeature(
        "Slack + Discord alerts, Zapier workflow automation",
        /slack|zapier|discord|integrations/i
      );
      ensureFeature(
        "MCP Server for AI agent integration",
        /mcp server|ai agent/i
      );
      ensureFeature(
        "Signal+ team workflow automation (Notion/Airtable/CRM via Zapier)",
        /workflow automation|signal\+/i
      );
    }

    if (tier.key === "scorefix") {
      ensureFeature("Everything in Signal, plus:", /everything in signal/i);
      ensureFeature(
        "Automated GitHub PR remediation via MCP (10-25 credits per fix)",
        /automated.*pr|github.*mcp|autopr/i
      );
    }

    return {
      ...tier,
      features: Array.from(new Set(nextFeatures.map((f) => f.trim()))).filter(
        Boolean
      ),
    };
  });
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function PricingCard({
  tier,
  billingPeriod,
  onSelect,
  onStartTrial,
  currentTier,
  isLoading,
  isHighlighted,
  canStartTrial,
  isStartingTrial,
}: {
  tier: TierPricing;
  billingPeriod: BillingPeriod;
  onSelect: (tierKey: string) => void;
  onStartTrial?: () => void;
  currentTier?: string;
  isLoading?: boolean;
  isHighlighted?: boolean;
  canStartTrial?: boolean;
  isStartingTrial?: boolean;
}) {
  const pricing = tier.pricing;
  const isOneTime = tier.billingModel === "one_time";
  const price = isOneTime
    ? pricing.one_time ?? pricing.monthly
    : billingPeriod === "yearly"
      ? pricing.yearly
      : pricing.monthly;
  const isFree = tier.billingModel === "free" || !tier.isPaid;
  const isCurrent = currentTier?.toLowerCase() === tier.key.toLowerCase();
  const colors = TIER_COLORS[tier.key] || TIER_COLORS.observer;
  const tierCopy = TIER_COPY[tier.key];

  const yearlyEffectiveMonthly =
    pricing.yearly && pricing.yearly.amount > 0
      ? pricing.yearly.amount / 12
      : null;

  const yearlySavings =
    pricing.monthly && pricing.yearly
      ? Math.max(0, pricing.monthly.amount * 12 - pricing.yearly.amount)
      : 0;

  return (
    <div
      id={tier.key === "signal" ? "signal-plan" : undefined}
      className="relative group h-full"
    >
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r ${colors.gradient} rounded-2xl blur opacity-0 transition duration-500 ${
          isHighlighted ? "opacity-30" : "group-hover:opacity-40"
        }`}
      />

      <div
        className={`relative h-full bg-charcoal rounded-2xl p-6 flex flex-col transition-all duration-300 hover:translate-y-[-2px] ${
          isHighlighted
            ? `${colors.border} border-2 shadow-xl ${colors.glow}`
            : "border border-white/10 hover:border-white/14"
        }`}
      >
        {isHighlighted && (
          <div
            className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r ${colors.gradient} text-white text-xs font-bold tracking-wider rounded-full flex items-center gap-1`}
          >
            <Sparkles className="w-3 h-3" />
            RECOMMENDED
          </div>
        )}

        <div className="mb-5">
          {isFree && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 text-[10px] font-black tracking-[0.11em] uppercase">
                FREE
              </span>
            </div>
          )}
          {isOneTime && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-amber-300/35 bg-amber-500/12 text-amber-200 text-[10px] font-black tracking-[0.11em] uppercase">
                ONE-TIME
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-lg bg-gradient-to-br ${colors.gradient} text-white`}
            >
              {TIER_ICONS[tier.key] || <Shield className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{tier.name}</h3>
              <p className="text-xs text-white/60">{tierCopy?.headline || TIER_AUDIENCE[tier.key]}</p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          {tierCopy?.priceLabel ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">{tierCopy.priceLabel}</span>
            </div>
          ) : isFree ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">$0</span>
              <span className="text-white/60">/forever</span>
            </div>
          ) : isOneTime ? (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${price?.amount ?? 0}
                </span>
                <span className="text-white/60">one-time</span>
              </div>
              <p className="text-xs text-white/75 mt-1">
                One payment • no recurring subscription charge
              </p>
            </div>
          ) : billingPeriod === "yearly" && price ? (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${yearlyEffectiveMonthly?.toFixed(2) ?? "0.00"}
                </span>
                <span className="text-white/60">/month</span>
              </div>
              <p className="text-xs text-white/75 mt-1">
                Billed annually at {formatUsd(price.amount)}/year
              </p>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">
                ${price?.amount ?? 0}
              </span>
              <span className="text-white/60">/month</span>
            </div>
          )}

          {!isOneTime && billingPeriod === "yearly" && yearlySavings > 0 && (
            <p className="text-xs text-white/80 mt-1">
              Save {formatUsd(yearlySavings)}/year
            </p>
          )}
        </div>

        <p className="text-sm text-white/75 mb-5 pb-4 border-b border-white/8 min-h-[72px]">
          {tierCopy?.body || `→ ${TIER_POSITIONING[tier.key]}`}
        </p>

        <ul className="space-y-2.5 mb-6 flex-grow min-h-[210px]">
          {(tierCopy?.includes || tier.features).map((feature, idx) => (
            <li
              key={`${tier.key}-${idx}-${feature}`}
              className="flex items-start gap-2.5 text-sm text-white/80"
            >
              <Check className="w-4 h-4 text-white/80 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div
          className={`grid grid-cols-2 gap-2 mb-6 p-3 bg-charcoal-light rounded-lg border ${colors.border}`}
        >
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {tier.limits.scans_per_month}
            </p>
            <p className="text-xs text-white/60">{isOneTime ? "included audits" : "audits/mo"}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {tier.limits.pages_per_scan}
            </p>
            <p className="text-xs text-white/60">pages/audit</p>
          </div>
        </div>

        {isOneTime && (
          <p className="-mt-4 mb-6 text-[11px] text-white/65">
            One-time purchase includes a fixed audit-credit allotment (not a monthly reset).
          </p>
        )}

        <button
          onClick={() => onSelect(tier.key)}
          disabled={isCurrent || isLoading}
          className={`w-full py-3 px-4 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            isCurrent
              ? "bg-charcoal-light text-white/50 cursor-not-allowed"
              : isHighlighted
                ? `bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90 shadow-lg ${colors.glow}`
                : isFree
                  ? "bg-charcoal border border-white/12 text-white hover:bg-charcoal-light"
                  : "bg-charcoal-light border border-white/10 text-white/85 hover:bg-charcoal"
          }`}
          type="button"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isCurrent ? (
            "Current Plan"
          ) : isFree ? (
            tierCopy?.cta || "Start Free"
          ) : isOneTime ? (
            tierCopy?.cta || "Buy One-Time"
          ) : (
            tierCopy?.cta || <>Upgrade <ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        {canStartTrial && tier.key === "signal" && !isCurrent && onStartTrial && (
          <button
            onClick={onStartTrial}
            disabled={isStartingTrial}
            className="w-full mt-2 py-2.5 px-4 rounded-full text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 border border-white/15 bg-charcoal text-white/85 hover:bg-charcoal-light hover:border-white/25"
            type="button"
          >
            {isStartingTrial ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Start 14-Day Free Trial
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function PricingPageSkeleton() {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="relative">
          <div className="bg-charcoal border border-white/10 rounded-2xl p-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-charcoal-light rounded-lg" />
              <div>
                <div className="h-5 w-24 bg-charcoal-light rounded mb-1" />
                <div className="h-3 w-32 bg-charcoal-light rounded" />
              </div>
            </div>
            <div className="h-10 w-28 bg-charcoal-light rounded mb-4" />
            <div className="h-4 w-full bg-charcoal-light rounded mb-4" />
            <div className="space-y-2 mb-6">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-4 bg-charcoal-light rounded w-full" />
              ))}
            </div>
            <div className="h-12 bg-charcoal-light rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");
  const [tiers, setTiers] = useState<TierPricing[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState(true);
  const [isCheckingOutTier, setIsCheckingOutTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [totalAudits, setTotalAudits] = useState<number | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/api/public/benchmarks')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.benchmarks) {
          if (d.benchmarks.total_audits) setTotalAudits(d.benchmarks.total_audits);
          if (d.benchmarks.avg_score) setAvgScore(d.benchmarks.avg_score);
        }
      })
      .catch(() => {});
  }, []);

  const currentTier = String(user?.tier || "observer").toLowerCase();

  const yearlySavingsPercent = Math.max(
    0,
    ...tiers
      .filter((tier) => tier.pricing.monthly && tier.pricing.yearly)
      .map((tier) => {
        const monthly = tier.pricing.monthly!.amount;
        const yearly = tier.pricing.yearly!.amount;
        const annualMonthlyCost = monthly * 12;
        if (annualMonthlyCost <= 0 || yearly >= annualMonthlyCost) return 0;
        return Math.round(
          ((annualMonthlyCost - yearly) / annualMonthlyCost) * 100
        );
      })
  );

  useEffect(() => {
    const hash = String(location.hash || "").trim();
    if (!hash) return;

    const anchorId = hash.replace(/^#/, "");
    if (!anchorId) return;

    const scrollToAnchor = () => {
      const node = document.getElementById(anchorId);
      if (!node) return false;
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    if (scrollToAnchor()) return;

    const timer = window.setTimeout(() => {
      scrollToAnchor();
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [location.hash, tiers.length, isLoadingPricing]);

  const teamRoleUseCases = [
    {
      role: "Founder",
      fit: "Observer / Alignment",
      outcome:
        "Validate AI visibility quickly and share proof links with advisors or clients.",
    },
    {
      role: "SEO Lead",
      fit: "Alignment / Signal",
      outcome:
        "Prioritize evidence-backed fixes and monitor score momentum sprint-to-sprint.",
    },
    {
      role: "Content Ops",
      fit: "Alignment / Signal",
      outcome:
        "Ship extractable pages with clearer entities, structure, and citation readiness.",
    },
    {
      role: "Agency PM",
      fit: "Signal / Score Fix",
      outcome:
        "Coordinate teams with integrations, automation, and client-ready reporting workflows.",
    },
    {
      role: "Remediation Lead",
      fit: "Score Fix (One-time)",
      outcome:
        "Use a one-time remediation purchase for evidence-linked implementation and verification handoff.",
    },
  ] as const;

  const rollingPriceValidUntil = `${new Date().getUTCFullYear() + 1}-12-31`;

  usePageMeta({
    title: "Pricing",
    description:
      "AiVIS plans: Observer free tier plus Alignment, Signal, and legacy Score Fix options with multi-model validation and team reporting.",
    path: "/pricing",
    ogTitle: "AI Visibility Audit Pricing Plans",
    structuredData: [
      buildOrganizationSchema(),
      {
        "@context": "https://schema.org",
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": "https://aivis.biz/#software-pricing",
        name: "AiVIS",
        url: "https://aivis.biz/pricing",
        description:
          "AiVIS pricing for AI visibility audits across ChatGPT, Perplexity, Google AI, and Claude with tiered features for teams and agencies.",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisher: buildOrganizationRef(),
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "47",
          bestRating: "5",
        },
        offers: [
          {
            "@type": "Offer",
            name: "Observer [Free]",
            price: "0",
            priceCurrency: "USD",
            url: "https://aivis.biz/pricing",
            availability: "https://schema.org/InStock",
            priceValidUntil: rollingPriceValidUntil,
            description:
              "Live monthly audit allowance with evidence-backed scoring and core recommendations",
          },
          {
            "@type": "Offer",
            name: "Alignment [Core]",
            price: "49",
            priceCurrency: "USD",
            url: "https://aivis.biz/pricing",
            availability: "https://schema.org/InStock",
            priceValidUntil: rollingPriceValidUntil,
            description:
              "Higher monthly allowances with exports, competitor tracking, and advanced workflows",
          },
          {
            "@type": "Offer",
            name: "Signal [Premium]",
            price: "149",
            priceCurrency: "USD",
            url: "https://aivis.biz/pricing",
            availability: "https://schema.org/InStock",
            priceValidUntil: rollingPriceValidUntil,
            description:
              "Premium allowance with triple-check AI, citation tools, API access, and white-label reporting",
          },
          {
            "@type": "Offer",
            name: "Score Fix [AutoPR]",
            price: "299",
            priceCurrency: "USD",
            url: "https://aivis.biz/pricing",
            availability: "https://schema.org/InStock",
            priceValidUntil: rollingPriceValidUntil,
            description:
              "Automated GitHub PR remediation via MCP connections: 250-credit pack at 10-25 credits per fix with evidence-linked implementation",
          },
        ],
      },
      buildWebPageSchema({
        path: "/pricing",
        name: "AI Visibility Audit Pricing Plans",
        description:
          "AiVIS plans: Observer free tier plus Alignment, Signal, and Score Fix AutoPR options with multi-model validation and team reporting.",
        mainEntityId: SOFTWARE_APPLICATION_ID,
      }),
      {
        ...buildFaqSchema([...PRICING_FAQ_ITEMS]),
        "@id": "https://aivis.biz/pricing#faq",
      },
    ],
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPricing() {
      try {
        setIsLoadingPricing(true);
        setError(null);

        const response = await apiFetch("/api/payment/pricing", {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load pricing (${response.status})`);
        }

        const data = (await response.json()) as PricingResponse;
        const normalized = normalizePricingTiers(data?.tiers || []);

        if (data?.success && normalized.length > 0) {
          setTiers(enrichTiersForDisplay(normalized));
        } else {
          setTiers([]);
          setError(
            "No pricing tiers are currently available. Please try again shortly."
          );
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.warn("Pricing fetch unavailable:", err);
        setTiers([]);
        setError("Unable to load live pricing right now. Please try again shortly.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPricing(false);
        }
      }
    }

    fetchPricing();

    return () => controller.abort();
  }, []);

  // Check trial eligibility when authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setCanStartTrial(false);
      return;
    }
    // Only observers who haven't trialed are eligible
    if (currentTier !== "observer") {
      setCanStartTrial(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await apiFetch("/api/trial/status", {
          signal: controller.signal,
        });
        if (!res.ok) {
          console.warn('[PricingPage] Trial status check failed:', res.status);
          setCanStartTrial(false);
          return;
        }
        const data = await res.json();
        // Can start trial only if not currently active and not already used
        setCanStartTrial(!data.active && !data.trialUsed);
      } catch (err: any) {
        if (!controller.signal.aborted) {
          console.warn('[PricingPage] Trial status check error:', err?.message);
        }
        setCanStartTrial(false);
      }
    })();
    return () => controller.abort();
  }, [isAuthenticated, token, currentTier]);

  async function handleStartTrial() {
    if (!isAuthenticated || !token) {
      navigate("/auth?mode=signin&redirect=/pricing");
      return;
    }
    setIsStartingTrial(true);
    setError(null);
    try {
      const res = await apiFetch("/api/billing/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to start trial");
        return;
      }
      // Reload auth state to reflect new trial tier
      window.location.reload();
    } catch (err: any) {
      console.error('[PricingPage] Start trial error:', err);
      setError("Failed to start trial. Please try again.");
    } finally {
      setIsStartingTrial(false);
    }
  }

  async function handleSelectTier(tierKey: string) {
    if (tierKey === "observer") {
      navigate("/");
      return;
    }

    if (!isAuthenticated || !token) {
      navigate("/auth?mode=signin&redirect=/pricing");
      return;
    }

    setIsCheckingOutTier(tierKey);
    setError(null);

    try {
      const response = await apiFetch("/api/payment/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tier: tierKey,
          billingPeriod,
        }),
      });

      if (response.status === 401) {
        logout();
        navigate("/auth?mode=signin");
        return;
      }

      const data = (await response.json()) as CheckoutResponse;
      const checkoutUrl = data.url || data.data;

      if (!response.ok || !checkoutUrl) {
        setError(data.error || `Failed to create checkout session (${response.status})`);
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Failed to start checkout. Please try again.");
    } finally {
      setIsCheckingOutTier(null);
    }
  }

  return (
    <div className="text-white">
      <div className="max-w-6xl mx-auto px-4 py-16 relative">
        <div id="overview" className="section-anchor text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal-light border border-white/10 rounded-full text-sm text-white/80 mb-6">
            <Sparkles className="w-4 h-4" />
            Ai Visibility Intelligence Audits
          </div>

          <div className="lonely-text">
            <h1 className="text-4xl md:text-5xl brand-title-lg mb-4">
              Stop guessing why AI ignores your site.
            </h1>
            <p className="text-lg text-white/75 max-w-2xl mx-auto">
              Most sites don’t have an AI visibility problem.
            </p>
            <p className="text-sm text-white/55 mt-3 max-w-3xl mx-auto leading-relaxed">
              They have a citation problem.
            </p>

            <div className="mt-6 max-w-3xl mx-auto text-left rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-100">Most sites don’t have an AI visibility problem.</h2>
              <p className="mt-2 text-sm leading-7 text-cyan-50/90">They have a citation problem.</p>
              <p className="text-sm leading-7 text-cyan-50/90">AI can read your site. But it won’t trust it. And it won’t cite it.</p>
              <p className="text-sm leading-7 text-cyan-50/90">AiVIS shows:</p>
              <ul className="list-disc pl-5 text-sm leading-7 text-cyan-50/90">
                <li>what AI can’t verify</li>
                <li>why competitors get chosen instead</li>
                <li>what to fix first to change that</li>
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] text-white/65">
              <span className="px-2.5 py-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 font-black tracking-[0.1em] uppercase">
                Free tier live now
              </span>
              {canStartTrial && (
                <span className="px-2.5 py-1 rounded-full border border-cyan-300/35 bg-cyan-500/12 text-cyan-200 font-black tracking-[0.1em] uppercase">
                  14-day Signal trial available
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
                Live plan data
              </span>
              <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
                3 audits/month
              </span>
              <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
                Exports on Alignment+
              </span>
              <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
                API + OAuth + MCP on Signal+
              </span>
              <span className="px-2.5 py-1 rounded-full border border-amber-300/25 bg-amber-500/10 text-amber-200">
                Score Fix uses 10-25 credits per automated PR
              </span>
              <span className="px-2.5 py-1 rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300/90">
                Top 200 · TechCrunch Startup Battlefield 2026
              </span>
            </div>
          </div>
        </div>

        {/* ── Social proof strip ──────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-white/50 mb-8">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400/70" />
            <strong className="text-white/70">{totalAudits ? `${totalAudits.toLocaleString()}+` : '…'}</strong> audits completed
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400/70" />
            {avgScore ? `${avgScore}/100` : '…'} avg visibility score
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400/70" />
            256-bit encrypted
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-violet-400/70" />
            Stripe-secured billing
          </span>
        </div>

        <div className="text-center mb-8 rounded-2xl border border-white/10 bg-charcoal-light/60 p-5">
          <h2 className="text-2xl font-bold text-white mb-3">You don’t need more SEO tools.</h2>
          <p className="text-white/75">You need to know:</p>
          <p className="text-white/65">why AI ignores you · who is taking your citations · what to fix first</p>
        </div>

        <div id="plans" className="section-anchor flex justify-center mb-8">
          <div className="relative bg-charcoal-light border border-white/10 rounded-full p-1.5 flex items-center">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                billingPeriod === "monthly"
                  ? "text-white"
                  : "text-white/60 hover:text-white"
              }`}
              type="button"
            >
              {billingPeriod === "monthly" && (
                <div className="absolute inset-0 bg-charcoal rounded-full" />
              )}
              <span className="relative">{t('pricing.monthly')}</span>
            </button>

            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                billingPeriod === "yearly"
                  ? "text-white"
                  : "text-white/60 hover:text-white"
              }`}
              type="button"
            >
              {billingPeriod === "yearly" && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/35 to-white/22 rounded-full" />
              )}
              <span className="relative flex items-center gap-2">
                {t('pricing.yearly')}
                {yearlySavingsPercent > 0 && (
                  <span className="px-2 py-0.5 bg-charcoal text-white/80 text-xs font-semibold rounded-full border border-white/10">
                    Save {yearlySavingsPercent}%
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* ── Pricing Cards ──────────────────────────────── */}
        {isLoadingPricing ? (
          <PricingPageSkeleton />
        ) : error && tiers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-full text-sm bg-charcoal-light border border-white/10 text-white/80 hover:text-white transition-colors"
              type="button"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8 mb-4">
            {tiers.map((tier) => (
              <PricingCard
                key={tier.key}
                tier={tier}
                billingPeriod={billingPeriod}
                onSelect={handleSelectTier}
                onStartTrial={handleStartTrial}
                currentTier={currentTier}
                isLoading={isCheckingOutTier === tier.key}
                isHighlighted={tier.key === "signal"}
                canStartTrial={canStartTrial}
                isStartingTrial={isStartingTrial}
              />
            ))}
          </div>
        )}

        {error && tiers.length > 0 && (
          <p className="text-center text-amber-300/80 text-xs mb-4">{error}</p>
        )}

        {/* ── Quick comparison table ──────────────────────── */}
        <div className="mt-12 mb-10 rounded-2xl border border-white/10 bg-charcoal-light/60 overflow-hidden">
          <div className="p-5 border-b border-white/8">
            <h2 className="text-base font-semibold text-white">Compare plans at a glance</h2>
            <p className="text-xs text-white/50 mt-1">Key capabilities by tier — check marks show included features</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/8 text-white/50">
                  <th className="px-5 py-3 font-medium">Capability</th>
                  <th className="px-3 py-3 font-medium text-center">Observer</th>
                  <th className="px-3 py-3 font-medium text-center">Alignment</th>
                  <th className="px-3 py-3 font-medium text-center">Signal</th>
                  <th className="px-3 py-3 font-medium text-center">Score Fix</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                {[
                  ["Audit allowance", "3/mo", "25/mo", "100/mo", "15/mo + 250 PR credits"],
                  ["Visibility score + recs", true, true, true, true],
                  ["Citation gap diagnosis", true, true, true, true],
                  ["Shareable report links", true, true, true, true],
                  ["Export (PDF / JSON)", false, true, true, true],
                  ["Competitor advantage signals", false, true, true, true],
                  ["Brand mention tracking", false, true, true, true],
                  ["Decision query gap analysis", false, true, true, true],
                  ["API + OAuth access", false, true, true, true],
                  ["Triple-check AI validation", false, false, true, true],
                  ["Citation testing", false, false, true, true],
                  ["MCP Server (AI agents)", false, false, true, true],
                  ["Team seats", "1", "3", "10", "10"],
                  ["White-label reports", false, false, true, true],
                  ["Auto GitHub PRs via MCP", false, false, false, true],
                ].map(([label, ...vals], idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white/80">{label}</td>
                    {vals.map((v, vi) => (
                      <td key={vi} className="px-4 py-3 text-center">
                        {v === true ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                        ) : v === false ? (
                          <span className="text-white/20">—</span>
                        ) : (
                          <span className="text-white/70 font-medium">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-10 mb-10">
          {VALUE_RAIL.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-charcoal-light/60 p-5 surface-structured-muted"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-white/80" />
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                </div>
                <p className="text-xs text-white/65 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>

        <div
          id="preview"
          className="section-anchor mt-10 mb-10 rounded-2xl border border-white/10 bg-charcoal-light p-4 sm:p-5 shadow-sm surface-structured-muted"
        >
          <h2 className="text-base brand-title-muted mb-3">
            What buyers get after the score
          </h2>
          <div className="rounded-xl border border-white/10 bg-charcoal/50 p-3">
            <img
              src="/images/fix-pack-preview.svg"
              alt="Fix Pack preview showing implementation-ready outputs"
              className="w-full h-auto rounded-lg"
              loading="lazy"
            />
          </div>
          <p className="text-xs text-white/60 mt-3">
            The redesign pushes the product toward outcomes, not abstract scoring. This preview shows the handoff: evidence, priority, and implementation-ready fixes.
          </p>
        </div>

        <div
          id="audience"
          className="section-anchor mb-10 rounded-2xl border border-white/10 bg-charcoal-light p-5 shadow-sm surface-structured-muted"
        >
          <h2 className="text-base brand-title-muted mb-3">
            Best fit by workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teamRoleUseCases.map((item) => (
              <div
                key={item.role}
                className="rounded-xl border border-white/10 bg-charcoal/55 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/90">
                    {item.role}
                  </p>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-charcoal border border-white/12 text-white/70">
                    {item.fit}
                  </span>
                </div>
                <p className="text-xs text-white/65 mt-1.5 leading-relaxed">
                  {item.outcome}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div id="features" className="section-anchor mt-16 text-center">
          <div className="inline-flex flex-wrap justify-center gap-4 p-4 bg-charcoal-light border border-white/10 rounded-2xl shadow-sm surface-structured-muted">
            {[
              "JSON-LD audit",
              "Meta tag audit",
              "Heading structure",
              "robots.txt check",
              "Sitemap validation",
              "Slack + Discord alerts (Signal+)",
              "Zapier automations (Notion, Airtable, CRM)",
              "OpenAPI 3.0 + OAuth 2.0 (Alignment+)",
              "MCP Server for AI agents (Signal+)",
              "Automated GitHub PR remediation (Score Fix)",
            ].map((feature) => (
              <span
                key={feature}
                className="flex items-center gap-2 text-sm text-white/75"
              >
                <Check className="w-4 h-4 text-white/80" />
                {feature}
              </span>
            ))}
          </div>
          <p className="mt-6 text-white/60 text-sm lonely-text inline-block">
            Every plan covers core visibility analysis. Higher tiers change execution depth, coordination, and remediation support.
          </p>
        </div>

        <div
          id="proof"
          className="section-anchor mt-8 rounded-2xl border border-white/10 bg-charcoal-light p-6 shadow-sm surface-structured-muted"
        >
          <h2 className="text-lg brand-title mb-2">
            What actually changes as you move up
          </h2>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <span className="font-semibold text-white">Observer</span> gives you a baseline score, core recommendations, and shareable proof for lightweight review.
            </li>
            <li>
              <span className="font-semibold text-white">Alignment</span> adds exports, competitor context, repeatable fix prioritization, and developer access via OpenAPI spec and OAuth 2.0.
            </li>
            <li>
              <span className="font-semibold text-white">Signal</span> adds triple-check analysis, Slack/Discord delivery alerts, Zapier automations (including Notion), MCP Server for AI agents, API access, and white-label workflows for teams and agencies.
            </li>
            <li>
              <span className="font-semibold text-white">Score Fix</span> ships automated GitHub PRs via MCP connections. Each fix costs 10-25 credits from your 250-credit pack, targeting schema patches, content fixes, and structural remediations directly in your repo.
            </li>
          </ul>
        </div>

        <div
          id="billing-center"
          className="section-anchor mt-6 rounded-2xl border border-white/10 bg-charcoal/45 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 surface-structured"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg border border-white/10 bg-charcoal-light">
              <WalletCards className="w-4 h-4 text-white/80" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Ready to scale with confidence?
              </p>
              <p className="text-xs text-white/65 mt-1">
                Checkout creates a secure session and activates your selected plan
                immediately after payment confirmation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/app/billing?section=pricing"
              className="inline-flex items-center gap-2 text-xs px-3.5 py-2 rounded-full bg-charcoal-light border border-white/10 text-white/85 hover:text-white transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              Open Billing Center
            </Link>
            <button
              onClick={() => navigate("/")}
              className="text-xs px-3.5 py-2 rounded-full bg-charcoal-light border border-white/10 text-white/75 hover:text-white transition-colors"
              type="button"
            >
              ← Back
            </button>
          </div>
        </div>

        <div
          id="pricing-faq"
          className="section-anchor mt-8 rounded-2xl border border-white/10 bg-charcoal-light p-6 shadow-sm surface-structured-muted"
        >
          <h2 className="text-lg brand-title mb-4">Pricing questions</h2>
          <dl className="space-y-4">
            {PRICING_FAQ_ITEMS.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-white/10 bg-charcoal/45 p-4"
              >
                <dt className="text-sm font-semibold text-white">{item.question}</dt>
                <dd className="text-sm text-white/75 mt-2 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 text-center text-sm text-white/55">
          Enterprise or volume pricing? <a href="mailto:sales@aivis.biz" className="text-white/80 hover:text-white underline underline-offset-2 transition-colors">sales@aivis.biz</a>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/app/billing"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors px-5 py-2 rounded-full bg-charcoal-light border border-white/10 hover:bg-charcoal"
          >
            <CreditCard className="w-4 h-4" />
            Manage subscription and invoices
          </Link>
        </div>
      </div>
    </div>
  );
}
