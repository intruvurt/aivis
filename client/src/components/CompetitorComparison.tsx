import React, { useState, useEffect } from "react";
import {
  Target,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
  CheckCircle2,
  Users,
  BarChart3,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { CompetitorComparison as ComparisonType } from "@shared/types";

import { API_URL } from '../config';
import apiFetch from '../utils/api';
import { toSafeHref } from '../utils/safeHref';

// ─── Grade Styling ──────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/70";
  if (score >= 60) return "bg-sky-500/60";
  if (score >= 40) return "bg-amber-500/60";
  return "bg-red-500/50";
}

// ─── Competitor Score Card ──────────────────────────────────────────────────

interface CompetitorCardProps {
  nickname: string;
  url: string;
  score: number;
  gap: number;
  isYou?: boolean;
}

function CompetitorCard({ nickname, url, score, gap, isYou }: CompetitorCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border transition-all ${
      isYou
        ? "border-white/12/30 bg-charcoal/5"
        : "border-white/10 bg-charcoal-deep"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          {isYou && (
            <div className="px-2 py-0.5 rounded-full bg-charcoal/20 border border-white/12/30 text-[10px] text-white/85 font-bold uppercase">
              You
            </div>
          )}
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{nickname}</p>
            <p className="text-xs text-white/55 truncate max-w-[200px]">{url}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</p>
            {!isYou && gap !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${gap > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {gap > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(gap)} pts
              </div>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/60" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-white/10">
          <a
            href={toSafeHref(url) || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-white/85 hover:text-white/85"
          >
            Visit Site <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Category Comparison Chart ──────────────────────────────────────────────

interface CategoryBarProps {
  category: string;
  yourScore: number;
  competitorScores: Record<string, number>;
}

function CategoryBar({ category, yourScore, competitorScores }: CategoryBarProps) {
  const allScores = [yourScore, ...Object.values(competitorScores)];
  const maxScore = Math.max(...allScores, 100);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-charcoal overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-charcoal transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white text-left truncate">{category}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-sm font-bold ${getScoreColor(yourScore)}`}>
            {yourScore}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/60" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Your score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/55 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-white/85" />
                You
              </span>
              <span className="text-xs text-white/55">{yourScore}</span>
            </div>
            <div className="h-2 bg-charcoal-light rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreBg(yourScore)}`}
                style={{ width: `${(yourScore / maxScore) * 100}%` }}
              />
            </div>
          </div>

          {/* Competitor scores */}
          {Object.entries(competitorScores).map(([nickname, score]) => (
            <div key={nickname}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/55 truncate max-w-[150px]">{nickname}</span>
                <span className="text-xs text-white/55">{score}</span>
              </div>
              <div className="h-2 bg-charcoal-light rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreBg(score)}`}
                  style={{ width: `${(score / maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Opportunity Card ───────────────────────────────────────────────────────

interface OpportunityCardProps {
  title: string;
  description: string;
  impact: string;
  competitor_doing_it: string[];
}

function OpportunityCard({ title, description, impact, competitor_doing_it }: OpportunityCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-charcoal">
          <Zap className="w-4 h-4 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
          <p className="text-xs text-white/55 mb-2">{description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-white/80 font-medium">{impact}</span>
            {competitor_doing_it.length > 0 && (
              <span className="text-[10px] text-white/60">
                • {competitor_doing_it.join(", ")} doing this
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-white/80 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

// ─── Advantage Card ─────────────────────────────────────────────────────────

interface AdvantageCardProps {
  title: string;
  description: string;
  lead_amount: string;
}

function AdvantageCard({ title, description, lead_amount }: AdvantageCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-charcoal">
          <CheckCircle2 className="w-4 h-4 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
          <p className="text-xs text-white/55 mb-2">{description}</p>
          <span className="text-[10px] text-white/80 font-medium">{lead_amount}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface CompetitorComparisonProps {
  yourUrl: string;
  token?: string;
}

export default function CompetitorComparison({ yourUrl, token }: CompetitorComparisonProps) {
  const [comparison, setComparison] = useState<ComparisonType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchComparison();
  }, [yourUrl, token]);

  async function fetchComparison() {
    if (!yourUrl || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch(`${API_URL}/api/competitors/comparison?url=${encodeURIComponent(yourUrl)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch comparison");
      }

      const data = await response.json();
      setComparison(data.comparison);
    } catch (err: any) {
      console.error("Comparison error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshComparison() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchComparison();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white/12" />
        <p className="mt-4 text-sm text-white/55">Loading comparison...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-white/80 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white/80 mb-1">Failed to load comparison</p>
            <p className="text-xs text-white/55">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison || comparison.competitors.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-8 text-center">
        <Users className="w-12 h-12 text-white/70 mx-auto mb-3" />
        <p className="text-sm text-white/55">No competitors to compare yet.</p>
        <p className="text-xs text-white/60 mt-1">Add competitors to see how you stack up!</p>
      </div>
    );
  }

  const rankedCompetitors = [...comparison.competitors].sort((a, b) => b.score - a.score);
  const bestCompetitor = rankedCompetitors[0];
  const yourLead = bestCompetitor ? comparison.your_score - bestCompetitor.score : 0;
  const gapClosurePlan = (comparison.category_comparison || [])
    .map((category) => {
      const competitorTop = Math.max(...Object.values(category.competitor_scores || {}), 0);
      const gap = Math.max(0, competitorTop - category.your_score);
      return {
        category: category.category,
        gap,
        action:
          /content/i.test(category.category)
            ? "Expand answer blocks and depth on this topic cluster."
            : /schema/i.test(category.category)
              ? "Add or fix JSON-LD entities and validate structured data."
              : /meta/i.test(category.category)
                ? "Improve title/meta for specificity and AI answer relevance."
                : /heading/i.test(category.category)
                  ? "Tighten H1/H2 hierarchy and explicit section labeling."
                  : /technical/i.test(category.category)
                    ? "Resolve technical crawlability and canonical signal issues."
                    : "Implement the top competitor pattern from this category.",
      };
    })
    .filter((item) => item.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 4);

  const weeklyExecutionPlan = [
    {
      step: "Day 1",
      title: "Choose 1 category gap",
      detail: gapClosurePlan[0]
        ? `Start with ${gapClosurePlan[0].category} (${gapClosurePlan[0].gap} point gap).`
        : "Start with the largest scoring category gap.",
    },
    {
      step: "Day 2-3",
      title: "Ship focused improvements",
      detail: gapClosurePlan[0]?.action || "Implement competitor pattern improvements for the chosen category.",
    },
    {
      step: "Day 4",
      title: "Apply one quick win",
      detail: comparison.opportunities?.[0]?.title
        ? `Apply: ${comparison.opportunities[0].title}.`
        : "Apply one high-impact quick win from this comparison.",
    },
    {
      step: "Day 5",
      title: "Re-run comparison",
      detail: "Refresh this view and confirm gap reduction before moving to the next category.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Comparison */}
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gradient-to-br from-white/28/20 to-white/14/20">
            <BarChart3 className="w-5 h-5 text-white/85" />
          </div>
          <h3 className="text-lg font-semibold text-white">Overall Scores</h3>
          <button
            onClick={refreshComparison}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-charcoal text-xs text-white/80 disabled:opacity-50"
            type="button"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-charcoal p-4 mb-4">
          <p className="text-xs text-white/60 uppercase tracking-wide">Benchmark</p>
          <p className="text-sm text-white mt-1">
            {yourLead >= 0
              ? `You lead your top tracked competitor by ${yourLead} points.`
              : `Top competitor currently leads you by ${Math.abs(yourLead)} points.`}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CompetitorCard
            nickname="Your Site"
            url={comparison.your_url}
            score={comparison.your_score}
            gap={0}
            isYou={true}
          />
          {rankedCompetitors.map((comp) => (
            <CompetitorCard
              key={comp.url}
              nickname={comp.nickname}
              url={comp.url}
              score={comp.score}
              gap={comp.gap}
            />
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gradient-to-br from-white/22/20 to-white/14/20">
            <Target className="w-5 h-5 text-white/80" />
          </div>
          <h3 className="text-lg font-semibold text-white">Category Breakdown</h3>
        </div>

        <div className="space-y-3">
          {(comparison.category_comparison || []).map((cat) => (
            <CategoryBar
              key={cat.category}
              category={cat.category}
              yourScore={cat.your_score}
              competitorScores={cat.competitor_scores}
            />
          ))}
        </div>
      </div>

      {/* Opportunities */}
      {gapClosurePlan.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-white/22/20 to-white/14/20">
              <Target className="w-5 h-5 text-white/80" />
            </div>
            <h3 className="text-lg font-semibold text-white">Gap Closure Plan</h3>
          </div>
          <div className="space-y-3">
            {gapClosurePlan.map((item) => (
              <div key={`gap-${item.category}`} className="rounded-xl border border-white/10 bg-charcoal p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-semibold text-white">{item.category}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-charcoal border border-white/10 text-white/80">
                    Gap {item.gap} pts
                  </span>
                </div>
                <p className="text-xs text-white/65">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {(comparison.opportunities || []).length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-br from-white/30/20 to-white/18/20">
              <Zap className="w-5 h-5 text-white/80" />
            </div>
            <h3 className="text-lg font-semibold text-white">Quick Wins</h3>
            <span className="ml-auto text-xs text-white/60 bg-charcoal px-3 py-1 rounded-full">
              {(comparison.opportunities || []).length} opportunities
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(comparison.opportunities || []).map((opp, i) => (
              <OpportunityCard key={i} {...opp} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-gradient-to-br from-white/22/20 to-white/14/20">
            <Target className="w-5 h-5 text-white/80" />
          </div>
          <h3 className="text-lg font-semibold text-white">Weekly Execution Workflow</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {weeklyExecutionPlan.map((item) => (
            <div key={`${item.step}-${item.title}`} className="rounded-xl border border-white/10 bg-charcoal p-4">
              <p className="text-[11px] uppercase tracking-wide text-white/55">{item.step}</p>
              <p className="text-sm font-semibold text-white mt-1">{item.title}</p>
              <p className="text-xs text-white/65 mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Your Advantages */}
      {(comparison.your_advantages || []).length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-br from-white/25/20 to-white/15/20">
              <CheckCircle2 className="w-5 h-5 text-white/80" />
            </div>
            <h3 className="text-lg font-semibold text-white">Your Advantages</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(comparison.your_advantages || []).map((adv, i) => (
              <AdvantageCard key={i} {...adv} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
