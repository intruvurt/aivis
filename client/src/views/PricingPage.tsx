// client/src/views/PricingPage.tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiFetch from '../utils/api';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from 'react-i18next';
import { TIER_BRAND_PALETTE } from '../constants/uiPalette';
import {
  SOFTWARE_APPLICATION_ID,
  buildFaqSchema,
  buildOrganizationRef,
  buildOrganizationSchema,
  buildWebPageSchema,
} from '../lib/seoSchema';
import { PRICING, TIER_LIMITS } from '../../../shared/types';
import TierConfirmModal from '../components/TierConfirmModal';

type BillingPeriod = 'monthly' | 'yearly';

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
  billingModel: 'core' | 'subscription' | 'one_time' | 'free';
  stripeReady?: boolean;
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
  starter: <Zap className="w-6 h-6" />,
  alignment: (
    <img
      src="/images/tier-alignment-sm.png"
      alt="Alignment"
      className="w-8 h-8 object-contain tier-icon-brand"
      loading="lazy"
      decoding="async"
    />
  ),
  signal: (
    <img
      src="/images/tier-signal-sm.png"
      alt="Signal"
      className="w-8 h-8 object-contain tier-icon-brand"
      loading="lazy"
      decoding="async"
    />
  ),
  scorefix: (
    <img
      src="/images/tier-scorefix-sm.png"
      alt="AutoFix PR"
      className="w-8 h-8 object-contain tier-icon-brand"
      loading="lazy"
      decoding="async"
    />
  ),
};

const TIER_COLORS: Record<string, { gradient: string; border: string; glow: string }> =
  TIER_BRAND_PALETTE;

const TIER_POSITIONING: Record<string, string> = {
  observer: 'Surface layer: prove whether AI interpretation is happening at all.',
  starter: 'Structural layer: inspect entity-level mismatches and evidence traces.',
  alignment: 'Temporal layer: track interpretation drift and cross-scan changes.',
  signal: 'Infrastructure layer: operate the ledger with automation and APIs.',
  scorefix: 'Remediation layer: continuously repair gaps with evidence-linked actions.',
};

const TIER_AUDIENCE: Record<string, string> = {
  observer: 'For teams validating surface interpretation visibility',
  starter: 'For teams investigating entity-level interpretation loss',
  alignment: 'For teams monitoring temporal interpretation drift',
  signal: 'For teams operating AI visibility infrastructure',
  scorefix: 'For teams running continuous evidence-linked repairs',
};

const TIER_COPY: Record<
  string,
  { headline: string; body: string; includes: string[]; cta: string; priceLabel?: string }
> = {
  observer: {
    headline: 'Surface interpretation layer.',
    body: 'Observer shows the first ledger surface: whether AI systems can extract and cite your site at all.',
    includes: [
      'surface interpretation snapshot',
      'first ledger reconstruction samples',
      'basic citation evidence from surfaced results',
    ],
    cta: 'Start free',
  },
  starter: {
    headline: 'Structural interpretation layer.',
    body: 'Starter unlocks structural visibility: full mismatch UI, entity-level ledger entries, and evidence traces tied to each scan.',
    includes: [
      'full mismatch breakdown',
      'entity-level ledger entries',
      'evidence trace per scan',
      'scan timeline replay (basic)',
      'implementation-ready corrections',
    ],
    cta: 'Get Starter',
  },
  alignment: {
    headline: 'Temporal interpretation layer.',
    body: 'Alignment reveals how AI understanding shifts over time with cross-scan context and propagation-level evidence history.',
    includes: [
      'interpretation drift over time',
      'cross-scan entity graph context',
      'citation propagation history',
      'full ledger replay surface',
      'cross-model interpretation verification',
    ],
    cta: 'Get Alignment',
  },
  signal: {
    headline: 'Infrastructure access layer.',
    body: 'Signal operationalizes the ledger as infrastructure with APIs, automation, team workflows, and real-time observability.',
    includes: [
      'real-time scan stream observability',
      'API access to ledger and query engine',
      'workspace-level intelligence workflows',
      'automation and webhook operations',
      'time-travel replay of visibility states',
    ],
    cta: 'Get Signal',
  },
  scorefix: {
    headline: 'Continuous remediation and repair layer.',
    body: 'Score Fix is a $299/mo subscription. It includes Signal plus always-on ledger monitoring, citation decay detection, and automated GitHub PR remediation tied to real evidence gaps.',
    includes: [
      '6-hour ledger watch-mode loop',
      'Citation decay detection & entity graph repair',
      'Auto-generated GitHub PRs (up to 5/week)',
      '250 monthly repair credits — reset each cycle',
      'Evidence delta tracking across repair cycles',
    ],
    cta: 'Get Score Fix',
  },
};

const VALUE_RAIL = [
  {
    icon: ShieldCheck,
    title: 'Depth before features',
    detail:
      'Pricing maps to interpretation depth: surface, structural, temporal, and infrastructure access to the same ledger truth.',
  },
  {
    icon: Zap,
    title: 'Ledger-native progression',
    detail:
      'Each upgrade unlocks a deeper layer of interpretation visibility, not a different scoring system.',
  },
  {
    icon: Rocket,
    title: 'Scan to upgrade loop',
    detail:
      'Run a scan, inspect proof, then unlock deeper reconstruction and control where the gaps are most visible.',
  },
] as const;

const PRICING_FAQ_ITEMS = [
  {
    question: 'Is AiVIS.biz free to use?',
    answer:
      'Yes. Observer is permanently free and includes 3 audits per month, 0-100 visibility scoring, six-dimension analysis, and prioritized findings. No card is required.',
  },
  {
    question: 'What is the difference between Observer, Starter, Alignment, and Signal?',
    answer:
      'Observer provides baseline scoring and findings. Starter adds implementation-ready recommendations, PDF export, and share links. Alignment adds multi-model validation, competitor context, and citation behavior testing. Signal adds API access, automation hooks, advanced entity tracing, and team-scale operations.',
  },
  {
    question: 'How are pricing and limits enforced?',
    answer:
      'Pricing display is informational. Runtime limits and eligibility are enforced server-side via /api/payment/pricing and validated at request time.',
  },
  {
    question: 'How do share links behave?',
    answer:
      'Share links create immutable snapshots of a specific audit. Access can be full or redacted depending on account policy. Links are validated at creation and only change when explicitly regenerated.',
  },
  {
    question: 'How does Score Fix billing work?',
    answer:
      'Score Fix is a $299/mo subscription that includes 250 monthly repair credits, always-on ledger monitoring, citation decay detection, and automated GitHub PR remediation. Credits reset each billing cycle. Annual billing is available at a discount.',
  },
  {
    question: 'How does annual billing work?',
    answer:
      'Annual billing, where available, applies to subscription tiers only and is charged upfront. Observer remains free.',
  },
  {
    question: 'Can I cancel at any time?',
    answer:
      'Yes. Paid plans are managed in Billing Center and can be canceled from account settings. Access remains active through the paid period.',
  },
  {
    question: 'What is the refund policy?',
    answer:
      'Subscription payments include a 24-hour refund window from the date of payment. Refunds are not available after code has been pushed or a pull request has been confirmed through Score Fix. Observer is permanently free — no payment required.',
  },
] as const;

const REFERENCE_TIER_ORDER = ['observer', 'starter', 'alignment', 'signal', 'scorefix'] as const;

function buildReferencePricingTiers(): TierPricing[] {
  return REFERENCE_TIER_ORDER.map((key) => {
    const pricingEntry = PRICING[key];
    const limits = TIER_LIMITS[key];
    const monthlyAmount = Number(pricingEntry?.billing?.monthly ?? 0);
    const yearlyAmount = Number(pricingEntry?.billing?.yearly ?? 0);

    return {
      key,
      name: pricingEntry?.name ?? key,
      displayName: pricingEntry?.name ?? key,
      billingModel: key === 'observer' ? 'free' : 'subscription',
      stripeReady: false,
      pricing: {
        monthly:
          key === 'observer'
            ? null
            : {
                amount: monthlyAmount,
                formatted: formatUsd(monthlyAmount),
              },
        yearly:
          key === 'observer' || !yearlyAmount
            ? null
            : {
                amount: yearlyAmount,
                formatted: formatUsd(yearlyAmount),
              },
        one_time: null,
      },
      features: [...(TIER_COPY[key]?.includes ?? [])],
      limits: {
        scans_per_month: Number(limits?.scansPerMonth ?? 0),
        pages_per_scan: Number(limits?.pagesPerScan ?? 0),
        competitors: Number(limits?.competitors ?? 0),
        cache_days: Number(limits?.cacheDays ?? 0),
        exports: Boolean(limits?.hasExports),
        force_refresh: Boolean(limits?.hasForceRefresh),
        api_access: Boolean(limits?.hasApiAccess),
        white_label: Boolean(limits?.hasWhiteLabel),
      },
      isPaid: key !== 'observer',
    } satisfies TierPricing;
  });
}

const REFERENCE_PRICING_TIERS = enrichTiersForDisplay(buildReferencePricingTiers());

function normalizeTierPrice(input: unknown): TierPrice | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  const amount = Number(candidate.amount ?? 0);
  const formatted = String(candidate.formatted ?? '').trim();

  if (!Number.isFinite(amount) || amount < 0) return null;

  return {
    amount,
    formatted,
  };
}

function normalizeTierLimits(input: unknown): TierLimits {
  const candidate = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

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
      if (!entry || typeof entry !== 'object') return null;
      const tier = entry as Record<string, unknown>;
      const key = String(tier.key ?? '')
        .trim()
        .toLowerCase();
      const name = String(tier.name ?? '').trim();
      const displayName = String(tier.displayName ?? tier.name ?? '').trim();

      if (!key || !name) return null;

      const pricing =
        tier.pricing && typeof tier.pricing === 'object'
          ? (tier.pricing as Record<string, unknown>)
          : {};

      const features = Array.isArray(tier.features)
        ? tier.features.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];

      return {
        key,
        name,
        displayName,
        billingModel:
          String(tier.billingModel ?? '')
            .trim()
            .toLowerCase() === 'one_time'
            ? 'one_time'
            : String(tier.billingModel ?? '')
                  .trim()
                  .toLowerCase() === 'subscription'
              ? 'subscription'
              : 'free',
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

    if (tier.key === 'observer') {
      ensureFeature('Citation gap diagnosis', /citation gap|keyword intelligence/i);
      ensureFeature('Bix AI assistant (5 messages/day)', /bix ai assistant/i);
    }

    if (tier.key === 'starter') {
      ensureFeature(
        'All recommendations with implementation code',
        /all recommendations|implementation code/i
      );
      ensureFeature('Content highlights', /content highlights/i);
      ensureFeature('PDF export', /pdf export/i);
      ensureFeature('Bix AI assistant (8 messages/day)', /bix ai assistant/i);
    }

    if (tier.key === 'alignment') {
      ensureFeature('Decision query gap analysis', /decision query gap|analytics dashboard/i);
      ensureFeature('Brand mention tracking (19 sources)', /brand mention/i);
      ensureFeature('Private exposure scan', /private exposure/i);
      ensureFeature('Competitor advantage signals', /competitor advantage|niche url/i);
      ensureFeature('MCP Server access', /mcp server/i);
      ensureFeature('Bix AI assistant (10 messages/day)', /bix ai assistant/i);
    }

    if (tier.key === 'signal') {
      ensureFeature('OpenAPI spec + OAuth 2.0 developer access', /openapi|oauth/i);
      ensureFeature(
        'Slack + Discord alerts, Zapier workflow automation',
        /slack|zapier|discord|integrations/i
      );
      ensureFeature('MCP Server for AI agent integration', /mcp server|ai agent/i);
      ensureFeature(
        'Signal+ team workflow automation (Notion/Airtable/CRM via Zapier)',
        /workflow automation|signal\+/i
      );
      ensureFeature('Bix AI assistant (30 messages/day)', /bix ai assistant/i);
    }

    if (tier.key === 'scorefix') {
      ensureFeature('Everything in Signal, plus:', /everything in signal/i);
      ensureFeature('Automated GitHub PR remediation via MCP', /automated.*pr|github.*mcp|autopr/i);
    }

    return {
      ...tier,
      features: Array.from(new Set(nextFeatures.map((f) => f.trim()))).filter(Boolean),
    };
  });
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
  onSelect: (tierKey: string) => void | Promise<void>;
  onStartTrial?: () => void | Promise<void>;
  currentTier?: string;
  isLoading?: boolean;
  isHighlighted?: boolean;
  canStartTrial?: boolean;
  isStartingTrial?: boolean;
}) {
  const pricing = tier.pricing;
  const isOneTime = tier.billingModel === 'one_time';
  const price = isOneTime
    ? (pricing.one_time ?? pricing.monthly)
    : billingPeriod === 'yearly'
      ? pricing.yearly
      : pricing.monthly;
  const isFree = tier.billingModel === 'free' || !tier.isPaid;
  const isCurrent = currentTier?.toLowerCase() === tier.key.toLowerCase();
  const stripeReady = tier.stripeReady !== false;
  const colors = TIER_COLORS[tier.key] || TIER_COLORS.observer;
  const tierCopy = TIER_COPY[tier.key];

  const yearlyEffectiveMonthly =
    pricing.yearly && pricing.yearly.amount > 0 ? pricing.yearly.amount / 12 : null;

  const yearlySavings =
    pricing.monthly && pricing.yearly
      ? Math.max(0, pricing.monthly.amount * 12 - pricing.yearly.amount)
      : 0;

  return (
    <div id={tier.key} className="relative group h-full">
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r ${colors.gradient} rounded-2xl blur opacity-0 transition duration-500 ${
          isHighlighted ? 'opacity-50' : 'group-hover:opacity-35'
        }`}
      />

      <div
        className={`relative h-full bg-charcoal rounded-2xl p-7 flex flex-col transition-all duration-300 hover:translate-y-[-2px] ${
          isHighlighted
            ? `${colors.border} border-2 shadow-2xl ${colors.glow}`
            : 'border border-white/10 hover:border-white/20'
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
            <div className={`p-2 rounded-lg bg-gradient-to-br ${colors.gradient} text-white`}>
              {TIER_ICONS[tier.key] || <Shield className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
              <p className="text-xs text-white/45">
                {tierCopy?.headline || TIER_AUDIENCE[tier.key]}
              </p>
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
                <span className="text-4xl font-bold text-white">${price?.amount ?? 0}</span>
                <span className="text-white/60">one-time</span>
              </div>
              <p className="text-xs text-white/75 mt-1">
                One payment • no recurring subscription charge
              </p>
            </div>
          ) : billingPeriod === 'yearly' && price ? (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${yearlyEffectiveMonthly?.toFixed(2) ?? '0.00'}
                </span>
                <span className="text-white/60">/month</span>
              </div>
              <p className="text-xs text-white/75 mt-1">
                Billed annually at {formatUsd(price.amount)}/year
              </p>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">${price?.amount ?? 0}</span>
              <span className="text-white/60">/month</span>
            </div>
          )}

          {!isOneTime && billingPeriod === 'yearly' && yearlySavings > 0 && (
            <p className="text-xs text-white/80 mt-1">Save {formatUsd(yearlySavings)}/year</p>
          )}
        </div>

        <p className="text-sm text-white/60 mb-6 pb-5 border-b border-white/10 min-h-[72px] leading-relaxed">
          {tierCopy?.body || `→ ${TIER_POSITIONING[tier.key]}`}
        </p>

        <ul className="space-y-3 mb-8 flex-grow min-h-[210px]">
          {(tierCopy?.includes || tier.features).map((feature, idx) => (
            <li
              key={`${tier.key}-${idx}-${feature}`}
              className="flex items-start gap-2.5 text-sm text-white/75"
            >
              <Check className="w-4 h-4 text-emerald-400/80 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div
          className={`grid grid-cols-2 gap-3 mb-6 p-4 bg-charcoal-light rounded-xl border ${colors.border}`}
        >
          <div className="text-center">
            <p className="text-lg font-bold text-white">{tier.limits.scans_per_month}</p>
            <p className="text-xs text-white/60">
              {isOneTime ? 'included reconstructions' : 'ledger reconstructions/mo'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{tier.limits.pages_per_scan}</p>
            <p className="text-xs text-white/60">evidence window</p>
          </div>
        </div>

        {isOneTime && (
          <p className="-mt-4 mb-6 text-[11px] text-white/65">
            One-time purchase includes a fixed audit-credit allotment (not a monthly reset).
          </p>
        )}

        <button
          onClick={() => onSelect(tier.key)}
          disabled={isCurrent || isLoading || (!isFree && !stripeReady)}
          className={`w-full py-3 px-4 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            isCurrent
              ? 'bg-charcoal-light text-white/50 cursor-not-allowed'
              : !isFree && !stripeReady
                ? 'bg-charcoal-light text-white/40 cursor-not-allowed border border-white/8'
                : isHighlighted
                  ? `bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90 shadow-lg ${colors.glow}`
                  : isFree
                    ? 'bg-charcoal border border-white/12 text-white hover:bg-charcoal-light'
                    : 'bg-charcoal-light border border-white/10 text-white/85 hover:bg-charcoal'
          }`}
          type="button"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isCurrent ? (
            'Current Plan'
          ) : !isFree && !stripeReady ? (
            'Contact Support'
          ) : isFree ? (
            tierCopy?.cta || 'Start Free'
          ) : isOneTime ? (
            tierCopy?.cta || 'Buy One-Time'
          ) : (
            tierCopy?.cta || (
              <>
                Upgrade <ArrowRight className="w-4 h-4" />
              </>
            )
          )}
        </button>

        {canStartTrial && tier.key === 'signal' && !isCurrent && onStartTrial && (
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

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [tiers, setTiers] = useState<TierPricing[]>(REFERENCE_PRICING_TIERS);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [isCheckingOutTier, setIsCheckingOutTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [pendingTierKey, setPendingTierKey] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
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

  const currentTier = String(user?.tier || 'observer').toLowerCase();

  // Auto-open confirm modal when navigated here with ?tier=X&confirm=1 (e.g. from UpgradeWall)
  useEffect(() => {
    const tierParam = searchParams.get('tier');
    const confirmParam = searchParams.get('confirm');
    if (tierParam && confirmParam === '1' && isAuthenticated && tiers.length > 0) {
      if (['starter', 'alignment', 'signal', 'scorefix', 'agency'].includes(tierParam)) {
        setPendingTierKey(tierParam);
      }
    }
  }, [searchParams, tiers.length, isAuthenticated]);

  const yearlySavingsPercent = Math.max(
    0,
    ...tiers
      .filter((tier) => tier.pricing.monthly && tier.pricing.yearly)
      .map((tier) => {
        const monthly = tier.pricing.monthly!.amount;
        const yearly = tier.pricing.yearly!.amount;
        const annualMonthlyCost = monthly * 12;
        if (annualMonthlyCost <= 0 || yearly >= annualMonthlyCost) return 0;
        return Math.round(((annualMonthlyCost - yearly) / annualMonthlyCost) * 100);
      })
  );

  useEffect(() => {
    const hash = String(location.hash || '').trim();
    if (!hash) return;

    const anchorId = hash.replace(/^#/, '');
    if (!anchorId) return;

    const scrollToAnchor = () => {
      const node = document.getElementById(anchorId);
      if (!node) return false;
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      role: 'Founder',
      fit: 'Observer / Alignment',
      outcome: 'Validate AI visibility quickly and share proof links with advisors or clients.',
    },
    {
      role: 'AI Visibility Lead',
      fit: 'Alignment / Signal',
      outcome: 'Prioritize evidence-backed fixes and monitor score momentum sprint-to-sprint.',
    },
    {
      role: 'Content Ops',
      fit: 'Alignment / Signal',
      outcome: 'Ship extractable pages with clearer entities, structure, and citation readiness.',
    },
    {
      role: 'Agency PM',
      fit: 'Signal / Score Fix',
      outcome:
        'Coordinate teams with integrations, automation, and client-ready reporting workflows.',
    },
    {
      role: 'Remediation Lead',
      fit: 'Score Fix (Managed)',
      outcome:
        'Run recurring evidence-linked remediation with monthly verification handoff and proof packets.',
    },
  ] as const;

  const rollingPriceValidUntil = `${new Date().getUTCFullYear() + 1}-12-31`;

  usePageMeta({
    title: 'Pricing',
    description:
      'Five tiers from free to automated remediation. Compare Observer, Starter, Alignment, Signal, and Score Fix for AI visibility audits and CITE LEDGER evidence-backed scoring.',
    path: '/pricing',
    ogTitle: 'AI Visibility Audit Pricing Plans',
    structuredData: [
      buildOrganizationSchema(),
      {
        '@context': 'https://schema.org',
        '@type': ['SoftwareApplication', 'WebApplication'],
        '@id': 'https://aivis.biz/#software-pricing',
        name: 'AiVIS.biz',
        url: 'https://aivis.biz/pricing',
        description:
          'AiVIS.biz pricing for AI visibility audits with evidence-backed scoring, competitive intelligence, citation testing, and automated remediation.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        publisher: buildOrganizationRef(),
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          reviewCount: '47',
          bestRating: '5',
          worstRating: '1',
        },
        offers: [
          {
            '@type': 'Offer',
            name: 'Observer [Free]',
            price: '0',
            priceCurrency: 'USD',
            url: 'https://aivis.biz/pricing#observer',
            availability: 'https://schema.org/InStock',
            priceValidUntil: rollingPriceValidUntil,
            description:
              'Free tier with evidence-backed scoring, BRAG evidence IDs, and 3 audits per month.',
          },
          {
            '@type': 'Offer',
            name: 'Starter',
            price: String(PRICING.starter.billing.monthly),
            priceCurrency: 'USD',
            url: 'https://aivis.biz/pricing#starter',
            availability: 'https://schema.org/InStock',
            priceValidUntil: rollingPriceValidUntil,
            description:
              'Implementation-ready recommendations, exports, and shareable reporting for growing teams.',
          },
          {
            '@type': 'Offer',
            name: 'Alignment [Core]',
            price: String(PRICING.alignment.billing.monthly),
            priceCurrency: 'USD',
            url: 'https://aivis.biz/pricing#alignment',
            availability: 'https://schema.org/InStock',
            priceValidUntil: rollingPriceValidUntil,
            description:
              'Competitor tracking, brand mention scanning, reverse-engineer tools, and recurring intelligence workflows.',
          },
          {
            '@type': 'Offer',
            name: 'Signal [Pro]',
            price: String(PRICING.signal.billing.monthly),
            priceCurrency: 'USD',
            url: 'https://aivis.biz/pricing#signal',
            availability: 'https://schema.org/InStock',
            priceValidUntil: rollingPriceValidUntil,
            description:
              'Triple-check AI validation, citation testing, developer access, team workflows, and white-label reporting.',
          },
          {
            '@type': 'Offer',
            name: 'Score Fix [AutoFix PR]',
            price: String(PRICING.scorefix.billing.monthly),
            priceCurrency: 'USD',
            url: 'https://aivis.biz/pricing#scorefix',
            availability: 'https://schema.org/InStock',
            priceValidUntil: rollingPriceValidUntil,
            description:
              'Recurring AutoFix PR remediation subscription with monthly credits and evidence-linked GitHub remediation.',
          },
        ],
      },
      buildWebPageSchema({
        path: '/pricing',
        name: 'AI Visibility Audit Pricing Plans',
        description:
          'Compare Observer, Starter, Alignment, Signal, and Score Fix plans for AI visibility audits, competitive intelligence, and automated remediation.',
        mainEntityId: SOFTWARE_APPLICATION_ID,
      }),
      {
        ...buildFaqSchema([...PRICING_FAQ_ITEMS]),
        '@id': 'https://aivis.biz/pricing#faq',
      },
    ],
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPricing() {
      try {
        if (tiers.length === 0) {
          setIsLoadingPricing(true);
        }
        setError(null);

        const response = await apiFetch('/api/payment/pricing', {
          method: 'GET',
          signal: controller.signal,
          timeoutMs: 12_000,
        });

        if (!response.ok) {
          throw new Error(`Failed to load pricing (${response.status})`);
        }

        const data = (await response.json()) as PricingResponse;
        const normalized = normalizePricingTiers(data?.tiers || []);

        if (data?.success && normalized.length > 0) {
          setTiers(enrichTiersForDisplay(normalized));
        } else {
          setTiers(REFERENCE_PRICING_TIERS);
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.warn('Pricing fetch unavailable:', err);
        setTiers((current) => (current.length > 0 ? current : REFERENCE_PRICING_TIERS));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPricing(false);
        }
      }
    }

    fetchPricing();

    return () => controller.abort();
  }, [tiers.length]);

  // Check trial eligibility when authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Show trial CTA to anonymous visitors — clicking will redirect to signup
      setCanStartTrial(true);
      return;
    }
    // Only observers who haven't trialed are eligible
    if (currentTier !== 'observer') {
      setCanStartTrial(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await apiFetch('/api/trial/status', {
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
      navigate('/auth?mode=signup&redirect=/pricing');
      return;
    }
    setIsStartingTrial(true);
    setError(null);
    try {
      const res = await apiFetch('/api/billing/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to start trial');
        return;
      }
      // Navigate to welcome page so user sees what they just unlocked
      navigate('/app/welcome?tier=signal');
    } catch (err: any) {
      console.error('[PricingPage] Start trial error:', err);
      setError('Failed to start trial. Please try again.');
    } finally {
      setIsStartingTrial(false);
    }
  }

  async function handleSelectTier(tierKey: string) {
    if (tierKey === 'observer') {
      navigate('/');
      return;
    }

    if (!isAuthenticated || !token) {
      navigate('/auth?mode=signin&redirect=/pricing');
      return;
    }

    // Show tier intro + confirmation modal before proceeding to Stripe checkout
    setPendingTierKey(tierKey);
  }

  async function handleConfirmCheckout(tierKey: string) {
    setIsCheckingOutTier(tierKey);
    setError(null);

    try {
      const response = await apiFetch('/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: tierKey,
          billingPeriod,
        }),
      });

      if (response.status === 401) {
        logout();
        navigate('/auth?mode=signin');
        return;
      }

      const data = (await response.json()) as CheckoutResponse;
      const checkoutUrl = data.url || data.data;

      if (!response.ok || !checkoutUrl) {
        setError(data.error || `Failed to create checkout session (${response.status})`);
        return;
      }

      // Store pending tier so PaymentSuccessPage can redirect to the welcome intro
      sessionStorage.setItem('aivis_pending_tier', tierKey);
      window.location.assign(checkoutUrl);
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Failed to start checkout. Please try again.');
    } finally {
      setIsCheckingOutTier(null);
    }
  }

  async function handleModalStartTrial() {
    if (!isAuthenticated || !token) {
      navigate('/auth?mode=signup&redirect=/pricing');
      return;
    }
    setIsStartingTrial(true);
    setError(null);
    try {
      const res = await apiFetch('/api/billing/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to start trial');
        return;
      }
      navigate('/app/welcome?tier=signal');
    } catch (err: any) {
      console.error('[PricingPage] Start trial error:', err);
      setError('Failed to start trial. Please try again.');
    } finally {
      setIsStartingTrial(false);
    }
  }

  return (
    <div className="text-white">
      <div className="max-w-6xl mx-auto px-4 py-16 relative">
        <div id="overview" className="section-anchor text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal-light border border-white/10 rounded-full text-sm text-white/70 mb-8">
            <Sparkles className="w-4 h-4" />
            AiVIS - AI Visibility Intelligence Platform
          </div>

          <div className="lonely-text">
            <h1 className="text-5xl md:text-7xl brand-title-lg mb-6 leading-tight tracking-tight">
              Know if AI will cite you
            </h1>
            <p className="text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              Stop guessing. See exactly why AI systems use your content, skip it, or cite a
              competitor instead.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-2 text-[11px] text-white/65">
              <span className="px-2.5 py-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 font-black tracking-[0.1em] uppercase">
                Free tier live now
              </span>
              {canStartTrial && (
                <span className="px-2.5 py-1 rounded-full border border-[#22ff6e]/35 bg-[#22ff6e]/12 text-[#dfffe9] font-black tracking-[0.1em] uppercase">
                  14-day Signal trial available
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300/90">
                Evidence-backed by CITE LEDGER
              </span>
            </div>
          </div>
        </div>

        {/* ── Social proof strip ──────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-white/50 mb-12">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400/70" />
            <strong className="text-white/70">
              {totalAudits ? `${totalAudits.toLocaleString()}+` : '…'}
            </strong>{' '}
            audits completed
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#22ff6e]/70" />
            {avgScore ? `${avgScore}/100` : '…'} avg visibility score
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400/70" />
            256-bit encrypted
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#ffb830]/70" />
            Stripe-secured billing
          </span>
        </div>

        <div className="text-center mb-10 rounded-2xl border border-white/8 bg-charcoal-light/40 p-7">
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">This is not SEO</h2>
          <p className="text-white/60 max-w-3xl mx-auto text-[15px] leading-relaxed">
            AiVIS tells you whether AI systems will actually quote your page - not just where it
            ranks in traditional search.
          </p>
        </div>

        <div id="plans" className="section-anchor flex justify-center mb-10">
          <div className="relative bg-charcoal-light border border-white/10 rounded-full p-1.5 flex items-center">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                billingPeriod === 'monthly' ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
              type="button"
            >
              {billingPeriod === 'monthly' && (
                <div className="absolute inset-0 bg-charcoal rounded-full" />
              )}
              <span className="relative">{t('pricing.monthly')}</span>
            </button>

            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                billingPeriod === 'yearly' ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
              type="button"
            >
              {billingPeriod === 'yearly' && (
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
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mt-10 mb-8">
            {tiers.map((tier) => (
              <div key={tier.key}>
                <PricingCard
                  tier={tier}
                  billingPeriod={billingPeriod}
                  onSelect={handleSelectTier}
                  onStartTrial={handleStartTrial}
                  currentTier={currentTier}
                  isLoading={isCheckingOutTier === tier.key}
                  isHighlighted={tier.key === 'signal'}
                  canStartTrial={canStartTrial}
                  isStartingTrial={isStartingTrial}
                />
              </div>
            ))}
          </div>
        )}

        {error && tiers.length > 0 && (
          <p className="text-center text-amber-300/80 text-xs mb-4">{error}</p>
        )}

        <section className="mt-16 rounded-2xl border border-white/10 bg-charcoal-light/60 p-6 surface-structured-muted">
          <h2 className="text-lg font-semibold text-white">System Rules (Authoritative)</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-white/65">
            <li>All pricing and limits resolve from /api/payment/pricing.</li>
            <li>Feature access is enforced server-side at request time.</li>
            <li>UI can display features, but backend determines eligibility.</li>
            <li>Exports and share links are immutable snapshot artifacts, not live documents.</li>
            <li>Score Fix operates as remediation credits independent of tier names.</li>
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-charcoal-light/60 p-6 surface-structured-muted">
          <h2 className="text-lg font-semibold text-white">Feature Access Model</h2>
          <p className="mt-2 text-sm text-white/55">
            Capability resolution is flag-based, not label-based. Requests resolve user, tier,
            feature flags, then runtime enforcement.
          </p>
          <div className="mt-3 rounded-xl border border-white/10 bg-charcoal/50 p-4">
            <pre className="text-xs text-white/75 overflow-x-auto">{`user -> tier -> feature flags -> runtime enforcement`}</pre>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
            {[
              'audits_per_month',
              'pdf_export',
              'share_links',
              'multi_model_validation',
              'api_access',
              'remediation_credits',
            ].map((flag) => (
              <span
                key={flag}
                className="px-2 py-1 rounded-full border border-white/12 bg-charcoal text-white/80"
              >
                {flag}
              </span>
            ))}
          </div>
        </section>

        {/* ── Quick comparison table ──────────────────────── */}
        <div className="mt-16 mb-12 rounded-2xl border border-white/10 bg-charcoal-light/60 overflow-hidden">
          <div className="p-6 border-b border-white/8">
            <h2 className="text-lg font-semibold text-white">Compare plans at a glance</h2>
            <p className="text-xs text-white/45 mt-1">
              Key capabilities by tier - check marks show included features
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/8 text-white/50">
                  <th className="px-5 py-3 font-medium">Capability</th>
                  <th className="px-3 py-3 font-medium text-center">Observer</th>
                  <th className="px-3 py-3 font-medium text-center">Starter</th>
                  <th className="px-3 py-3 font-medium text-center">Alignment</th>
                  <th className="px-3 py-3 font-medium text-center">Signal</th>
                  <th className="px-3 py-3 font-medium text-center">Score Fix</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                {[
                  [
                    'Ledger reconstructions / month',
                    '3/mo',
                    '15/mo',
                    '60/mo',
                    '200/mo',
                    `${PRICING.scorefix.credits} credits/mo`,
                  ],
                  ['Visibility score + recs', true, true, true, true, true],
                  ['BRAG evidence IDs', true, true, true, true, true],
                  ['Implementation-ready guidance', false, true, true, true, true],
                  ['Shareable report links', false, true, true, true, true],
                  ['Export (PDF / JSON)', false, true, true, true, true],
                  ['Competitor tracking', false, false, true, true, true],
                  ['Brand mention tracking', false, false, true, true, true],
                  ['Reverse-engineer workflows', false, false, true, true, true],
                  ['API + OAuth access', false, false, false, true, true],
                  ['Triple-check AI validation', false, false, false, true, true],
                  ['Citation testing', false, false, false, true, true],
                  ['MCP Server (AI agents)', false, false, true, true, true],
                  [
                    'Team seats',
                    '0',
                    '0',
                    String(TIER_LIMITS.alignment.maxTeamMembers),
                    String(TIER_LIMITS.signal.maxTeamMembers),
                    String(TIER_LIMITS.scorefix.maxTeamMembers),
                  ],
                  ['White-label reports', false, false, false, true, false],
                  ['Auto GitHub PRs via MCP', false, false, false, false, true],
                ].map(([label, ...vals], idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-white/80">{label}</td>
                    {vals.map((v, vi) => (
                      <td key={vi} className="px-4 py-3 text-center">
                        {v === true ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                        ) : v === false ? (
                          <span className="text-white/20">-</span>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 mb-12">
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
                <p className="text-xs text-white/65 leading-relaxed">{item.detail}</p>
              </div>
            );
          })}
        </div>

        <div
          id="preview"
          className="section-anchor mt-10 mb-10 rounded-2xl border border-white/10 bg-charcoal-light p-4 sm:p-5 shadow-sm surface-structured-muted"
        >
          <h2 className="text-lg brand-title-muted mb-4">What buyers get after the score</h2>
          <div className="rounded-xl border border-white/10 bg-charcoal/50 p-3">
            <img
              src="/images/fix-pack-preview.svg"
              alt="Fix Pack preview showing implementation-ready outputs"
              className="w-full h-auto rounded-lg"
              loading="lazy"
            />
          </div>
          <p className="text-xs text-white/60 mt-3">
            The redesign pushes the product toward outcomes, not abstract scoring. This preview
            shows the handoff: evidence, priority, and implementation-ready fixes.
          </p>
        </div>

        <div
          id="audience"
          className="section-anchor mb-10 rounded-2xl border border-white/10 bg-charcoal-light p-5 shadow-sm surface-structured-muted"
        >
          <h2 className="text-lg brand-title-muted mb-4">Best fit by workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teamRoleUseCases.map((item) => (
              <div
                key={item.role}
                className="rounded-xl border border-white/10 bg-charcoal/55 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/90">{item.role}</p>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-charcoal border border-white/12 text-white/70">
                    {item.fit}
                  </span>
                </div>
                <p className="text-xs text-white/65 mt-1.5 leading-relaxed">{item.outcome}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="features" className="section-anchor mt-20 text-center">
          <div className="inline-flex flex-wrap justify-center gap-4 p-4 bg-charcoal-light border border-white/10 rounded-2xl shadow-sm surface-structured-muted">
            {[
              'JSON-LD audit',
              'Meta tag audit',
              'Heading structure',
              'robots.txt check',
              'Sitemap validation',
              'Slack + Discord alerts (Signal+)',
              'Zapier automations (Notion, Airtable, CRM)',
              'OpenAPI 3.0 + OAuth 2.0 (Alignment+)',
              'MCP Server for AI agents (Signal+)',
              'Automated GitHub PR remediation (Score Fix)',
            ].map((feature) => (
              <span key={feature} className="flex items-center gap-2 text-sm text-white/75">
                <Check className="w-4 h-4 text-white/80" />
                {feature}
              </span>
            ))}
          </div>
          <p className="mt-8 text-white/50 text-sm lonely-text inline-block">
            Every plan covers core visibility analysis. Higher tiers change execution depth,
            coordination, and remediation support.
          </p>
        </div>

        <div
          id="proof"
          className="section-anchor mt-8 rounded-2xl border border-white/10 bg-charcoal-light p-6 shadow-sm surface-structured-muted"
        >
          <h2 className="text-lg brand-title mb-2">How the tiers progress</h2>
          <p className="text-sm text-white/60 mb-5 leading-relaxed">
            AiVIS measures whether AI systems can extract, validate, and cite your site. Each tier
            expands operational depth while keeping the same evidence model.
          </p>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <span className="font-semibold text-white">Observer</span> — Am I visible?
            </li>
            <li>
              <span className="font-semibold text-white">Starter</span> — Why am I missing?
            </li>
            <li>
              <span className="font-semibold text-white">Alignment</span> — Who is replacing me?
            </li>
            <li>
              <span className="font-semibold text-white">Signal</span> — Can I control this?
            </li>
            <li>
              <span className="font-semibold text-white">Score Fix</span> — Fix it now.
            </li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/auth?mode=signup&redirect=/pricing')}
            className="inline-flex items-center justify-center gap-2 bg-white text-black px-8 py-3 rounded-xl text-base font-semibold hover:bg-white/90 transition"
            type="button"
          >
            Run Free Audit
            <ArrowRight className="w-4 h-4" />
          </button>
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
              <p className="text-sm font-semibold text-white">Ready to scale with confidence?</p>
              <p className="text-xs text-white/65 mt-1">
                Checkout creates a secure session and activates your selected plan immediately after
                payment confirmation.
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
              onClick={() => navigate('/')}
              className="text-xs px-3.5 py-2 rounded-full bg-charcoal-light border border-white/10 text-white/75 hover:text-white transition-colors"
              type="button"
            >
              ← Back
            </button>
          </div>
        </div>

        <div
          id="pricing-faq"
          className="section-anchor mt-12 rounded-2xl border border-white/10 bg-charcoal-light p-6 shadow-sm surface-structured-muted"
        >
          <h2 className="text-xl brand-title mb-5">Pricing questions</h2>
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
          Enterprise or volume pricing?{' '}
          <a
            href="mailto:sales@aivis.biz"
            className="text-white/80 hover:text-white underline underline-offset-2 transition-colors"
          >
            sales@aivis.biz
          </a>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold text-white/80 mb-4 text-center">
            Learn More About AiVIS.biz
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/methodology"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition"
            >
              Methodology
            </Link>
            <Link
              to="/compliance"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition"
            >
              Compliance
            </Link>
            <Link
              to="/guide"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition"
            >
              Implementation Guide
            </Link>
            <Link
              to="/why-ai-visibility"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition"
            >
              Why AI Visibility?
            </Link>
          </div>
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

      {/* Tier intro + confirmation modal — intercepts direct checkout flow */}
      {pendingTierKey && (
        <TierConfirmModal
          tierKey={pendingTierKey}
          billingPeriod={billingPeriod}
          priceMonthly={
            tiers.find((t) => t.key === pendingTierKey)?.pricing.monthly?.amount ?? null
          }
          priceYearly={tiers.find((t) => t.key === pendingTierKey)?.pricing.yearly?.amount ?? null}
          isOpen={pendingTierKey !== null}
          onClose={() => setPendingTierKey(null)}
          onConfirm={() => handleConfirmCheckout(pendingTierKey)}
          canStartTrial={canStartTrial && pendingTierKey === 'signal'}
          onStartTrial={handleModalStartTrial}
          isCheckingOut={isCheckingOutTier === pendingTierKey}
          isStartingTrial={isStartingTrial}
        />
      )}
    </div>
  );
}
