/**
 * PricingPage - Single source of truth for AiVIS tier & feature display
 * ═════════════════════════════════════════════════════════════════════════════
 * Fetches real tier data from /api/payment/pricing (which derives from shared/types.ts)
 * Ensures UI always reflects ACTUAL capabilities, not promises.
 *
 * Design: High-contrast monochrome with cyan/amber accents (matches existing app)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TierRecommendationQuiz from '../components/pricing/TierRecommendationQuiz';

interface TierPricingData {
  key: string;
  name: string;
  displayName: string;
  billingModel: 'free' | 'subscription' | 'one_time';
  pricing: {
    monthly: { amount: number; formatted: string } | null;
    yearly: { amount: number; formatted: string } | null;
    one_time: { amount: number; formatted: string } | null;
  };
  features: string[];
  limits: Record<string, number | string>;
  stripeReady: boolean;
}

interface PricingResponse {
  tiers: TierPricingData[];
  timestamp: string;
}

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<TierPricingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch('/api/payment/pricing');
        if (!res.ok) throw new Error('Failed to fetch pricing');
        const data: PricingResponse = await res.json();
        setTiers(data.tiers);
      } catch (err) {
        console.error('Pricing fetch error:', err);
        setError('Could not load pricing. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    fetchPricing();
  }, []);

  const handleCheckout = (tier: TierPricingData) => {
    if (!user) {
      navigate('/signin?redirect=/pricing');
      return;
    }
    if (tier.key === 'observer') {
      navigate('/analyze');
      return;
    }
    navigate(`/checkout?tier=${tier.key}&cycle=${billingCycle}`);
  };

  const handleCheckoutByTierKey = (tierKey: string) => {
    const tier = tiers.find((item) => item.key === tierKey);
    if (!tier) return;
    handleCheckout(tier);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading pricing...</div>
      </div>
    );
  }

  const featuredTier = 'alignment';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="font-mono text-xs font-bold tracking-widest text-cyan-400">
            AiVIS
          </Link>
          <div className="hidden sm:flex gap-6 text-sm">
            <Link to="/methodology" className="text-slate-400 hover:text-slate-300 transition">
              Methodology
            </Link>
            <Link to="/faq" className="text-slate-400 hover:text-slate-300 transition">
              FAQ
            </Link>
            <Link to="/compare" className="text-slate-400 hover:text-slate-300 transition">
              Compare
            </Link>
          </div>
        </div>
      </nav>

      {/* HEADER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs font-mono font-bold tracking-widest text-cyan-400 mb-6">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
            CITE LEDGER — Five Tiers
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            What each tier actually gives you.
          </h1>

          <p className="text-lg text-slate-400 mb-8">
            No artificial feature clipping. Every plan runs the same seven-dimension BRAG pipeline.
            The difference is scan volume, automation depth, and team scale.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 p-1 bg-slate-800/50 border border-slate-700 rounded-lg mb-12">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded transition ${
                billingCycle === 'monthly'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 text-sm font-medium rounded transition ${
                billingCycle === 'yearly'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Yearly <span className="text-xs text-amber-400 ml-1">Save 22%</span>
            </button>
          </div>
        </div>
      </section>

      {tiers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TierRecommendationQuiz
            tiers={tiers}
            billingCycle={billingCycle}
            onSelectTier={handleCheckoutByTierKey}
          />
        </section>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* TIER CARDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {tiers.map((tier) => {
            const isFeatured = tier.key === featuredTier;
            const isExclusive = tier.key === 'scorefix';

            return (
              <div
                key={tier.key}
                className={`relative rounded-xl border transition-all duration-300 ${
                  isFeatured
                    ? 'lg:col-span-1 lg:row-span-1 ring-2 ring-cyan-500/30 border-cyan-500/50 bg-gradient-to-b from-cyan-500/5 to-slate-900 shadow-xl shadow-cyan-500/5'
                    : isExclusive
                      ? 'ring-2 ring-amber-500/30 border-amber-500/50 bg-gradient-to-b from-amber-500/5 to-slate-900'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70'
                }`}
              >
                {/* Featured badge */}
                {isFeatured && (
                  <div className="absolute -top-3 right-6 px-2 py-1 bg-cyan-500 text-slate-950 text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}

                {isExclusive && (
                  <div className="absolute -top-3 right-6 px-2 py-1 bg-amber-500 text-slate-950 text-xs font-bold rounded-full">
                    One-Time
                  </div>
                )}

                <div className="p-6">
                  {/* Tier name & price */}
                  <div className="mb-6">
                    <div
                      className={`text-xs font-mono font-bold tracking-widest mb-2 ${
                        isFeatured
                          ? 'text-cyan-400'
                          : isExclusive
                            ? 'text-amber-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {tier.key.toUpperCase()}
                    </div>
                    <h3 className="text-2xl font-bold mb-1">{tier.displayName}</h3>

                    {/* Price */}
                    <div className="mb-4">
                      {tier.billingModel === 'free' && (
                        <div className="text-3xl font-bold text-cyan-400">Free</div>
                      )}
                      {tier.billingModel === 'subscription' && (
                        <>
                          <div className="text-3xl font-bold">
                            {billingCycle === 'monthly' && tier.pricing.monthly
                              ? tier.pricing.monthly.formatted
                              : tier.pricing.yearly
                                ? tier.pricing.yearly.formatted
                                : '$0'}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {billingCycle === 'monthly' ? '/month' : '/year'}
                          </div>
                        </>
                      )}
                      {tier.billingModel === 'one_time' && tier.pricing.one_time && (
                        <>
                          <div className="text-3xl font-bold text-amber-400">
                            {tier.pricing.one_time.formatted}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">one-time purchase</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Main limits */}
                  <div className="mb-6 pb-6 border-b border-slate-700/50">
                    <div className="text-sm font-mono">
                      <div className="text-slate-300 font-bold">
                        {tier.limits.scans_per_month} audits/month
                      </div>
                      {tier.limits.pages_per_scan > 1 && (
                        <div className="text-xs text-slate-400 mt-1">
                          {tier.limits.pages_per_scan} pages per scan
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-2.5 mb-6 text-sm">
                    {tier.features.slice(0, 8).map((feature, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-300">{feature}</span>
                      </li>
                    ))}
                    {tier.features.length > 8 && (
                      <li className="text-xs text-slate-500 italic pt-2 pl-6">
                        +{tier.features.length - 8} more features
                      </li>
                    )}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleCheckout(tier)}
                    disabled={!tier.stripeReady && tier.key !== 'observer'}
                    className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                      isFeatured
                        ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50'
                        : isExclusive
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50'
                          : 'bg-slate-800 text-slate-100 hover:bg-slate-700/80 border border-slate-700 disabled:opacity-50'
                    }`}
                  >
                    {tier.key === 'observer'
                      ? 'Get Started'
                      : user
                        ? 'Upgrade'
                        : 'Sign In to Upgrade'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold mb-8">Full feature comparison</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 font-mono text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Feature
                </th>
                {tiers.map((tier) => (
                  <th
                    key={tier.key}
                    className={`text-center py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider ${
                      tier.key === 'alignment' ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    {tier.displayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">Audits per month</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4 text-slate-300">
                    {tier.limits.scans_per_month}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">Pages per scan</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4 text-slate-300">
                    {tier.limits.pages_per_scan}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50 bg-slate-900/30">
                <td className="py-3 px-4 font-semibold">Tracked competitors</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.limits.competitors > 0 ? (
                      <span className="text-cyan-400 font-semibold">{tier.limits.competitors}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">PDF/JSON exports</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {(tier.key === 'observer' ? 'false' : tier.limits.has_exports) !== 'false' &&
                    tier.key !== 'observer' ? (
                      <Check className="w-4 h-4 text-cyan-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">Report history</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.features.some((f) => f.includes('history')) ? (
                      <Check className="w-4 h-4 text-cyan-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">Scheduled rescans</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.features.some((f) => f.includes('Scheduled')) ? (
                      <Check className="w-4 h-4 text-cyan-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">API access</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.features.some((f) => f.includes('API')) ? (
                      <Check className="w-4 h-4 text-cyan-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">Team workspaces</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.features.some((f) => f.includes('Team')) ? (
                      <span className="text-cyan-400 font-semibold text-sm">
                        {tier.key === 'alignment'
                          ? '3 members'
                          : tier.key === 'signal'
                            ? '10 members'
                            : tier.key === 'scorefix'
                              ? '10 members'
                              : '—'}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50 bg-slate-900/30">
                <td className="py-3 px-4 font-semibold">Triple-check pipeline</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.features.some((f) => f.includes('Triple')) ? (
                      <Check className="w-4 h-4 text-cyan-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">Citation testing</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.features.some((f) => f.includes('Citation')) ? (
                      <Check className="w-4 h-4 text-cyan-400 mx-auto" />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="py-3 px-4 font-semibold">AutoFix PR generation</td>
                {tiers.map((tier) => (
                  <td key={tier.key} className="text-center py-3 px-4">
                    {tier.key === 'scorefix' ? (
                      <span className="text-amber-400 font-semibold text-sm">250 credits</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold mb-8">Questions?</h2>

        <div className="space-y-6">
          {[
            {
              q: 'Is Observer really free?',
              a: 'Yes. Forever. 3 audits per month, full seven-dimension scoring, no credit card required. Start here to see how AI systems parse your site.',
            },
            {
              q: 'Can I change plans anytime?',
              a: 'Yes. Upgrade or downgrade from your account settings. Changes take effect on your next billing cycle. Score Fix is a one-time purchase and never expires.',
            },
            {
              q: 'What is the triple-check pipeline?',
              a: 'Signal and Score Fix run three independent AI models: GPT-5 Mini runs the initial audit, Claude Sonnet 4.6 peer-critiques and can adjust scores, and Grok 4.1 validates the result. This reduces false positives and surfaces deeper issues.',
            },
            {
              q: 'Does Alignment include team workspaces?',
              a: 'Yes. Alignment includes 3 team member slots. Signal includes 10 seats. Both support scheduled team audits, shared reports, and concurrent usage.',
            },
            {
              q: 'What APIs does Signal include?',
              a: 'Full REST API with 5,000 requests/month, OpenAPI 3.0 spec, MCP Server protocol (10 tools), webhook automation (20 endpoints), and HMAC-signed payloads for secure integrations.',
            },
            {
              q: 'What is AutoFix PR generation?',
              a: 'Score Fix generates GitHub pull requests with actual code changes (schema additions, heading fixes, metadata corrections). 250 credits = 250 audit runs. AiVIS writes code; you review and merge.',
            },
          ].map((item, i) => (
            <div key={i} className="border-b border-slate-700/50 pb-6 last:border-b-0">
              <h3 className="font-semibold mb-2 text-slate-100">{item.q}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center border-t border-slate-800">
        <h2 className="text-2xl font-bold mb-4">Ready to see your AI visibility?</h2>
        <p className="text-slate-400 mb-8">
          Start with Observer — no card, no commitment. Real audit in under 30 seconds.
        </p>
        <Link
          to="/analyze"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-slate-950 font-semibold rounded-lg hover:bg-cyan-400 transition"
        >
          Run a free audit <ChevronRight className="w-4 h-4" />
        </Link>
      </section>

      {/* FOOTER NAV */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-slate-500 flex flex-wrap gap-6">
          <Link to="/" className="hover:text-slate-400 transition">
            Home
          </Link>
          <Link to="/methodology" className="hover:text-slate-400 transition">
            Methodology
          </Link>
          <Link to="/guide" className="hover:text-slate-400 transition">
            Guide
          </Link>
          <Link to="/faq" className="hover:text-slate-400 transition">
            FAQ
          </Link>
          <Link to="/privacy" className="hover:text-slate-400 transition">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-slate-400 transition">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
