import { useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export interface TierPricingLite {
  key: string;
  displayName: string;
  billingModel: 'free' | 'subscription' | 'one_time';
  pricing: {
    monthly: { amount: number; formatted: string } | null;
    yearly: { amount: number; formatted: string } | null;
    one_time: { amount: number; formatted: string } | null;
  };
  limits: Record<string, number | string>;
}

interface QuizOption {
  label: string;
  score: Partial<Record<string, number>>;
}

interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

interface TierRecommendationQuizProps {
  tiers: TierPricingLite[];
  billingCycle: 'monthly' | 'yearly';
  onSelectTier: (tierKey: string) => void;
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'role',
    prompt: 'Who are you optimizing for?',
    options: [
      { label: 'Founder or solo operator', score: { observer: 2, starter: 3, alignment: 2 } },
      { label: 'Agency or consultancy', score: { starter: 1, alignment: 3, signal: 3 } },
      { label: 'Growth or SEO team', score: { alignment: 2, signal: 3, scorefix: 2 } },
      { label: 'Technical team with automation', score: { alignment: 2, signal: 3, scorefix: 3 } },
    ],
  },
  {
    id: 'volume',
    prompt: 'How many audits per month do you expect?',
    options: [
      { label: '1 to 10', score: { observer: 3, starter: 2 } },
      { label: '11 to 40', score: { starter: 3, alignment: 2 } },
      { label: '41 to 90', score: { alignment: 3, signal: 2 } },
      { label: '90+', score: { signal: 3, scorefix: 3 } },
    ],
  },
  {
    id: 'automation',
    prompt: 'How much automation do you need?',
    options: [
      { label: 'Manual scans only', score: { observer: 2, starter: 2 } },
      { label: 'Scheduled scans and reporting', score: { starter: 1, alignment: 3 } },
      { label: 'API or MCP integration', score: { alignment: 2, signal: 3 } },
      { label: 'Autofix PR and high-volume ops', score: { signal: 2, scorefix: 4 } },
    ],
  },
];

const TIER_PRIORITY = ['observer', 'starter', 'alignment', 'signal', 'scorefix'];

export default function TierRecommendationQuiz({
  tiers,
  billingCycle,
  onSelectTier,
}: TierRecommendationQuizProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const recommendation = useMemo(() => {
    if (Object.keys(answers).length !== QUESTIONS.length) return null;

    const scoreByTier = new Map<string, number>();
    TIER_PRIORITY.forEach((tier) => scoreByTier.set(tier, 0));

    QUESTIONS.forEach((question) => {
      const optionIndex = answers[question.id];
      const option = question.options[optionIndex];
      if (!option) return;
      Object.entries(option.score).forEach(([tier, score]) => {
        scoreByTier.set(tier, (scoreByTier.get(tier) ?? 0) + score);
      });
    });

    const sorted = [...scoreByTier.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return TIER_PRIORITY.indexOf(a[0]) - TIER_PRIORITY.indexOf(b[0]);
    });

    const [tierKey, confidence] = sorted[0];
    const tier =
      tiers.find((item) => item.key === tierKey) ?? tiers.find((item) => item.key === 'starter');

    if (!tier) return null;

    return { tier, confidence };
  }, [answers, tiers]);

  return (
    <section className="mb-14 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-orange-500/10 p-6 sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-300">
        <Sparkles className="h-3.5 w-3.5" />
        60-second tier selector
      </div>
      <h2 className="mt-3 text-2xl font-bold">Find your best-fit plan before you checkout</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
        Answer three questions and we will map your workload, team shape, and automation needs to
        the tier that fits your operating cadence.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {QUESTIONS.map((question) => (
          <article
            key={question.id}
            className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4"
          >
            <h3 className="text-sm font-semibold text-slate-100">{question.prompt}</h3>
            <div className="mt-3 space-y-2">
              {question.options.map((option, index) => {
                const selected = answers[question.id] === index;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: index }))}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selected
                        ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
        {!recommendation ? (
          <p className="text-sm text-slate-400">
            Complete all three answers to reveal your best-fit tier.
          </p>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-cyan-300">Recommended tier</p>
              <h3 className="mt-1 text-xl font-bold text-slate-100">
                {recommendation.tier.displayName}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                {recommendation.tier.billingModel === 'one_time' &&
                recommendation.tier.pricing.one_time
                  ? `${recommendation.tier.pricing.one_time.formatted} one-time`
                  : billingCycle === 'yearly' && recommendation.tier.pricing.yearly
                    ? `${recommendation.tier.pricing.yearly.formatted} / year`
                    : recommendation.tier.pricing.monthly
                      ? `${recommendation.tier.pricing.monthly.formatted} / month`
                      : 'Free'}
                {' · '}
                {recommendation.tier.limits.scans_per_month} audits/month
                {' · '}
                {recommendation.tier.limits.pages_per_scan} pages/scan
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Confidence score: {recommendation.confidence}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectTier(recommendation.tier.key)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              Choose {recommendation.tier.displayName}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
