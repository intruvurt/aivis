/**
 * ScanResultScreen — Full-page post-scan audit result view.
 *
 * Sections (top → bottom):
 *  1. Top bar       — URL anchor, live dot, timestamp  (trust signal)
 *  2. Hero          — Score ring + AI engine citation status chips
 *  3. Blockers row  — Grade pill + hard-blocker callouts
 *  4. Dimensions    — score-out-of-weight cards (9/20 pts format)
 *  5. Issues        — severity-triaged, color-coded, badge-labeled
 *  6. Fix list      — ranked with estimated point impact
 *  7. BRAG evidence — keyed BRAG-ID findings tied to live page
 *  8. Bottom bar    — Re-scan | Export PDF | Upgrade CTA
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Minus,
  RefreshCcw,
  Download,
  Zap,
  ChevronDown,
  ChevronRight,
  Shield,
  ArrowUpRight,
  TrendingUp,
  Compass,
  Lock,
  ExternalLink,
  Share2,
  Check,
  BookOpen,
  Code2,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnalysisResponse, CitationDivergenceSignal } from '@shared/types';
import { getScoreBand } from '../utils/scoreUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = 'observer' | 'starter' | 'alignment' | 'signal' | 'agency' | 'scorefix';

interface Props {
  result: AnalysisResponse;
  tier: Tier;
  onRerunAudit?: () => void;
  auditId?: string;
  analyzedAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<string, number> = {
  'Schema & Structured Data': 20,
  'Content Depth': 18,
  'Technical Trust': 15,
  'Meta & Open Graph': 15,
  'AI Readability': 12,
  'Heading Structure': 10,
  'Security & Trust': 10,
};

function getDimensionWeight(label: string): number {
  if (DIMENSION_WEIGHTS[label] !== undefined) return DIMENSION_WEIGHTS[label];
  const l = label.toLowerCase();
  if (l.includes('schema')) return 20;
  if (l.includes('content')) return 18;
  if (l.includes('technical')) return 15;
  if (l.includes('meta') || l.includes('og')) return 15;
  if (l.includes('ai') || l.includes('read')) return 12;
  if (l.includes('head')) return 10;
  return 10;
}

const ENGINE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  claude: 'Claude',
};

// ─── AI citation impact reasons ───────────────────────────────────────────────
// Maps every evidence key to WHY AI systems care about it.
// This is what turns a bug list into a citation court record.

const AI_CITATION_IMPACT: Record<string, { why: string; consequence: string }> = {
  organization_schema: {
    why: 'AI models use Organization schema to verify entity identity before attributing any claim.',
    consequence:
      'Without it, AI cannot confirm this is a real, named organisation — citation trust drops.',
  },
  json_ld_schemas: {
    why: 'JSON-LD is the primary machine-readable signal AI crawlers use to extract entities and facts.',
    consequence:
      'No JSON-LD means AI must guess meaning from raw text — accuracy and citation rate drop.',
  },
  faq_schema: {
    why: 'FAQ schema creates structured Q&A pairs that AI can extract verbatim for answer blocks.',
    consequence:
      'Competitors with FAQ schema get quoted directly in AI answers instead of this page.',
  },
  author_entity: {
    why: 'AI weighting systems favour authored content — a named, verifiable author signals trustworthy source.',
    consequence: 'Anonymous content is down-ranked for citation; AI prefers attributable claims.',
  },
  same_as_links: {
    why: 'sameAs links connect this entity to trusted knowledge graphs (Wikidata, LinkedIn, Crunchbase).',
    consequence: 'Without sameAs, AI cannot cross-reference the entity — it remains unverified.',
  },
  llms_txt: {
    why: 'llms.txt tells AI crawlers explicitly what content is available and citable.',
    consequence:
      "Without it, AI must infer what's safe to cite — coverage gaps appear in AI answers.",
  },
  ai_crawler_access: {
    why: 'If GPTBot, ClaudeBot, or PerplexityBot are blocked, those systems cannot index the content.',
    consequence: "Blocked AI crawlers = zero chance of appearing in that AI system's answers.",
  },
  robots_txt: {
    why: 'A missing or malformed robots.txt creates uncertainty — AI crawlers may skip the domain.',
    consequence: 'Ambiguous crawl permissions reduce indexing confidence across all AI systems.',
  },
  title_tag: {
    why: 'The title tag is the primary signal AI uses to understand what a page is about.',
    consequence:
      'Weak or missing title = AI misidentifies page topic, reducing citation match rate.',
  },
  meta_description: {
    why: 'AI uses the meta description as a summary candidate for answer synthesis.',
    consequence: 'No description means AI generates its own summary — often less accurate.',
  },
  h1_heading: {
    why: 'The H1 is the strongest on-page entity signal after schema — AI aligns topic identity to it.',
    consequence: 'Missing or mismatched H1 creates entity confusion; AI citation confidence drops.',
  },
  heading_hierarchy: {
    why: 'Logical heading structure lets AI segment and extract specific answer sections.',
    consequence: 'Flat or broken hierarchy means AI cannot reliably extract sub-topic answers.',
  },
  word_count: {
    why: 'AI models prefer pages with sufficient depth to extract confident, citable answers.',
    consequence:
      'Thin content is treated as low-authority — AI cites deeper competitor pages instead.',
  },
  question_headings: {
    why: 'Question-format headings directly match AI query patterns — they are extraction targets.',
    consequence: 'Without them, AI cannot find a pre-structured answer; citation frequency drops.',
  },
  tldr_block: {
    why: 'A TL;DR or summary block gives AI an immediately extractable answer in the first 300 words.',
    consequence:
      'AI answer engines strongly prefer pages with a clear definition or summary up top.',
  },
  external_links: {
    why: 'AI models give higher trust weight to pages that cite sources — it signals research quality.',
    consequence: 'Pages with zero external citations are treated as low-authority by AI systems.',
  },
  canonical_url: {
    why: 'Canonical URLs prevent AI from fragmenting authority across duplicate pages.',
    consequence:
      'Without canonical tags, citation authority is split — AI confidence in the domain drops.',
  },
  sitemap: {
    why: 'Sitemaps improve AI crawler coverage — pages not in the sitemap may never be indexed.',
    consequence: 'Key pages may be invisible to AI systems that rely on sitemaps for discovery.',
  },
  og_tags: {
    why: 'Open Graph tags are used by Perplexity and Google AI to enrich answer cards with metadata.',
    consequence: 'Missing OG tags reduce the quality of AI citations and answer card displays.',
  },
  performance: {
    why: 'Slow pages increase AI crawler timeout rates — content may not be fully indexed.',
    consequence:
      'High load times correlate with incomplete AI indexing and reduced citation coverage.',
  },
  image_alt_coverage: {
    why: 'Alt text extends semantic coverage — AI uses it to understand page context more fully.',
    consequence: 'Images without alt text represent missed entity signals that AI cannot read.',
  },
  link_diversity: {
    why: "Diverse internal linking signals content authority and helps AI map the site's knowledge graph.",
    consequence:
      'Poor link diversity leaves topical authority concentrated — AI citation scope is narrow.',
  },
  schema_depth: {
    why: 'Deep schema (nested entities, typed properties) lets AI extract precise, attributed facts.',
    consequence: 'Shallow schema produces vague entity signals — AI citation confidence is low.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierRank(tier: Tier): number {
  return ['observer', 'starter', 'alignment', 'signal', 'agency', 'scorefix'].indexOf(tier);
}
function atLeast(tier: Tier, required: Tier) {
  return tierRank(tier) >= tierRank(required);
}

/** Parse "18-32%" or "25%" into a midpoint integer */
function parseImpactPts(raw?: string, priority?: string): number {
  if (raw) {
    const rng = raw.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rng) return Math.round((parseInt(rng[1]) + parseInt(rng[2])) / 2);
    const single = raw.match(/(\d+)/);
    if (single) return parseInt(single[1]);
  }
  if (priority === 'high') return 20;
  if (priority === 'medium') return 10;
  return 4;
}

function fmtTimestamp(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ─── Engine citation chip ─────────────────────────────────────────────────────

function EngineChip({ name, score }: { name: string; score: number }) {
  const cited = score >= 70;
  const rare = score >= 40 && score < 70;

  if (cited) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium text-white/80 truncate">{name}</span>
        </div>
        <span className="text-xs font-semibold text-emerald-400 shrink-0">Citable</span>
      </div>
    );
  }

  if (rare) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium text-white/80 truncate">{name}</span>
        </div>
        <span className="text-xs font-semibold text-amber-400 shrink-0">Rare mentions</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/20">
      <div className="flex items-center gap-2 min-w-0">
        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="text-sm font-medium text-white/80 truncate">{name}</span>
      </div>
      <span className="text-xs font-semibold text-red-400 shrink-0">Not citable</span>
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const band = getScoreBand(score);
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="relative inline-flex items-center justify-center w-32 h-32 shrink-0">
      <svg viewBox="0 0 108 108" className="w-32 h-32 -rotate-90">
        {/* track */}
        <circle cx="54" cy="54" r={r} strokeWidth="9" fill="none" className="stroke-white/8" />
        {/* fill */}
        <circle
          cx="54"
          cy="54"
          r={r}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          stroke={band.hex}
          style={{
            strokeDasharray: circ,
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-3xl font-extrabold text-white">{score}</span>
        <span className="text-[11px] font-bold mt-1 tracking-wide" style={{ color: band.hex }}>
          {band.grade} — {band.label}
        </span>
      </div>
    </div>
  );
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ label, score, weight }: { label: string; score: number; weight: number }) {
  const earnedPts = Math.round((score / 100) * weight);
  const band = getScoreBand(score);
  const fillPct = `${score}%`;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d111c]/70 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white/80 leading-tight">{label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${band.badgeClass}`}>
          {band.grade}
        </span>
      </div>

      {/* Points: earned / max */}
      <div className="flex items-end gap-1">
        <span className="text-2xl font-extrabold leading-none" style={{ color: band.hex }}>
          {earnedPts}
        </span>
        <span className="text-sm text-white/35 mb-0.5">/ {weight} pts</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: fillPct, backgroundColor: band.hex }}
        />
      </div>
    </div>
  );
}

// ─── Severity bullet styling ──────────────────────────────────────────────────

const SEV_STYLE: Record<string, { dot: string; badge: string; border: string }> = {
  critical: {
    dot: 'bg-red-400',
    badge: 'text-red-300 bg-red-500/10 border-red-500/25',
    border: 'border-red-500/15',
  },
  high: {
    dot: 'bg-orange-400',
    badge: 'text-orange-300 bg-orange-500/10 border-orange-500/25',
    border: 'border-orange-500/15',
  },
  medium: {
    dot: 'bg-amber-400',
    badge: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
    border: 'border-amber-500/15',
  },
  low: {
    dot: 'bg-white/25',
    badge: 'text-white/40 bg-white/5 border-white/10',
    border: 'border-white/8',
  },
};

// ─── Issue row ────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
}: {
  issue: {
    id: string;
    finding: string;
    severity: string;
    evidence_ids: string[];
    actual_fix: string;
    evidence_excerpt?: string;
    evidence_type: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const s = SEV_STYLE[issue.severity] ?? SEV_STYLE.low;

  return (
    <div className={`rounded-lg border ${s.border} bg-white/[0.018] overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.025] transition-colors"
      >
        {/* severity dot */}
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${s.badge}`}
            >
              {issue.severity}
            </span>
            <span className="text-[10px] font-mono text-white/25 uppercase tracking-wider">
              {issue.id}
            </span>
          </div>
          <p className="text-sm text-white/80 leading-snug">{issue.finding}</p>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          {issue.evidence_excerpt && (
            <blockquote className="text-xs text-white/50 italic border-l-2 border-white/15 pl-3 leading-relaxed">
              {issue.evidence_excerpt}
            </blockquote>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1.5">
              Required fix
            </p>
            <p className="text-sm text-white/65 leading-relaxed">{issue.actual_fix}</p>
          </div>
          {issue.evidence_ids?.length > 0 && (
            <p className="text-[10px] text-white/25 font-mono">
              Evidence IDs: {issue.evidence_ids.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fix row ──────────────────────────────────────────────────────────────────

function FixRow({
  rank,
  rec,
  pts,
}: {
  rank: number;
  rec: {
    title: string;
    description: string;
    priority: string;
    category: string;
    impact: string;
    implementation: string;
    estimatedVisibilityLoss?: string;
    consequenceStatement?: string;
    brag_id?: string;
    suggested_content?: string;
  };
  pts: number;
}) {
  const [open, setOpen] = useState(false);
  const priorityColor =
    rec.priority === 'high'
      ? 'text-red-300'
      : rec.priority === 'medium'
        ? 'text-amber-300'
        : 'text-white/40';
  const priorityBadge =
    rec.priority === 'high'
      ? 'text-red-300 bg-red-500/10 border-red-500/25'
      : rec.priority === 'medium'
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
        : 'text-white/40 bg-white/5 border-white/10';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.018] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        {/* rank */}
        <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-xs font-bold text-white/50">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${priorityBadge}`}
            >
              {rec.priority}
            </span>
            <span className="text-[10px] text-white/30">{rec.category}</span>
          </div>
          <p className="text-sm font-semibold text-white/85">{rec.title}</p>
        </div>

        {/* point impact */}
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold text-emerald-400">+{pts}</span>
          <span className="text-[10px] text-white/30 block leading-none">pts est.</span>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-1" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          <p className="text-sm text-white/60 leading-relaxed">{rec.description}</p>

          {rec.consequenceStatement && (
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400/70 mb-1">
                AI consequence
              </p>
              <p className="text-xs text-orange-200/70 leading-relaxed">
                {rec.consequenceStatement}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1.5">
              How to fix
            </p>
            <p className="text-sm text-white/60 leading-relaxed">{rec.implementation}</p>
          </div>

          {rec.suggested_content && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/70 mb-1.5">
                Add this to your page
              </p>
              <pre className="text-xs text-emerald-200/70 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                {rec.suggested_content}
              </pre>
            </div>
          )}

          {rec.brag_id && (
            <p className="text-[10px] font-mono text-white/20">BRAG-ID: {rec.brag_id}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Behavior Simulation ───────────────────────────────────────────────────
// Shows exactly what AI extracted (or failed to extract) for each tested query.

function AIBehaviorSimulation({
  evidence,
  gaps,
}: {
  evidence: Array<{
    query: string;
    intent: string;
    source: string;
    mentioned: boolean;
    position?: number;
    snippet?: string;
    citation_strength: number;
  }>;
  gaps: Array<{
    type: string;
    description: string;
    query?: string;
    dominant_sources?: string[];
    action: string;
  }>;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) => setExpanded((v) => ({ ...v, [i]: !v[i] }));

  if (evidence.length === 0 && gaps.length === 0) return null;

  return (
    <div className="space-y-2">
      {evidence.map((ev, i) => {
        const isOpen = expanded[i];
        const confPct = Math.round(ev.citation_strength * 100);

        return (
          <div
            key={i}
            className={`rounded-lg border overflow-hidden ${
              ev.mentioned
                ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                : 'border-red-500/15 bg-red-500/[0.03]'
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
            >
              {ev.mentioned ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/45 mb-0.5 font-mono">
                  {ev.source} · {ev.intent}
                </p>
                <p className="text-sm text-white/80 leading-snug">{ev.query}</p>
              </div>
              <div className="shrink-0 text-right">
                {ev.mentioned ? (
                  <span className="text-[10px] font-bold text-emerald-400">Cited</span>
                ) : (
                  <span className="text-[10px] font-bold text-red-400">Not cited</span>
                )}
                <span className="text-[10px] text-white/25 block">{confPct}%</span>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-white/25 shrink-0 mt-0.5" />
              ) : (
                <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-white/8 pt-3 space-y-2">
                {ev.snippet ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/70 mb-1.5">
                      AI would quote this
                    </p>
                    <blockquote className="text-sm text-emerald-200/70 border-l-2 border-emerald-500/30 pl-3 leading-relaxed italic">
                      "{ev.snippet}"
                    </blockquote>
                    {ev.position && (
                      <p className="text-[10px] text-white/30 mt-1.5">
                        Result position: #{ev.position}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400/70 mb-1">
                      Not extracted
                    </p>
                    <p className="text-xs text-red-200/60 leading-relaxed">
                      AI searched for this entity in the context of this query and found no citable
                      excerpt. The page either did not appear in results or contained no extractable
                      answer.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Competitor Citation Theft ─────────────────────────────────────────────────
// Shows which domains are being cited INSTEAD of the target — for every gap query.

function CompetitorCitationTheft({
  gaps,
}: {
  gaps: Array<{
    type: string;
    description: string;
    query?: string;
    dominant_sources?: string[];
    action: string;
  }>;
}) {
  const competitorGaps = gaps.filter((g) => g.dominant_sources && g.dominant_sources.length > 0);

  if (competitorGaps.length === 0) return null;

  return (
    <div className="space-y-2">
      {competitorGaps.map((gap, i) => (
        <div
          key={i}
          className="rounded-lg border border-orange-500/20 bg-orange-500/[0.03] overflow-hidden"
        >
          <div className="px-4 py-3">
            {gap.query && (
              <p className="text-[10px] font-mono text-white/35 mb-1">Query: "{gap.query}"</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-orange-400/80 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                {gap.type}
              </span>
            </div>
            <p className="text-sm text-white/70 leading-snug mb-3">{gap.description}</p>

            {/* Competitors winning this query */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400/60">
                AI cites instead
              </p>
              <div className="flex flex-wrap gap-1.5">
                {gap.dominant_sources!.map((src, j) => (
                  <span
                    key={j}
                    className="text-xs font-mono text-orange-300/70 bg-orange-500/8 border border-orange-500/15 px-2 py-1 rounded"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 border-t border-white/8 pt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1">
                Action to reclaim
              </p>
              <p className="text-xs text-white/55 leading-relaxed">{gap.action}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── BRAG finding row ──────────────────────────────────────────────────────────

function BragRow({
  finding,
}: {
  finding: {
    brag_id: string;
    title: string;
    severity: string;
    is_hard_blocker: boolean;
    evidence_keys: string[];
    evidence_value?: string;
    confidence: number;
    remediation?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const s = SEV_STYLE[finding.severity] ?? SEV_STYLE.low;
  const confPct = Math.round(finding.confidence * 100);

  return (
    <div className={`rounded-lg border ${s.border} bg-white/[0.018] overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.025] transition-colors"
      >
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            {/* BRAG key identifier — the differentiated trust layer */}
            <span className="text-[10px] font-mono text-[#22ff6e]/80 bg-[#22ff6e]/8 border border-[#22ff6e]/20 px-1.5 py-0.5 rounded">
              {finding.brag_id}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${s.badge}`}
            >
              {finding.severity}
            </span>
            {finding.is_hard_blocker && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-red-300 bg-red-500/10 border border-red-500/25 px-1.5 py-0.5 rounded">
                Hard blocker
              </span>
            )}
          </div>
          <p className="text-sm text-white/80 leading-snug">{finding.title}</p>
        </div>

        <div className="shrink-0 text-right">
          <span className="text-[10px] text-white/30">{confPct}% conf.</span>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          {finding.evidence_value && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/30 mb-1.5">
                Evidence from live page
              </p>
              <blockquote className="text-xs text-white/50 italic border-l-2 border-[#22ff6e]/25 pl-3 leading-relaxed font-mono">
                {finding.evidence_value}
              </blockquote>
            </div>
          )}
          {finding.evidence_keys?.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-1 mb-2">
                {finding.evidence_keys.map((k, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono text-white/30 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded"
                  >
                    {k}
                  </span>
                ))}
              </div>
              {/* AI citation impact — the differentiated layer */}
              {finding.evidence_keys
                .map((k) => AI_CITATION_IMPACT[k])
                .filter(Boolean)
                .slice(0, 1)
                .map((impact, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#ffb830]/20 bg-[#ffb830]/5 px-3 py-2.5 space-y-1.5"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#ffb830]/80">
                      Why AI systems care
                    </p>
                    <p className="text-xs text-[#ffe0a3]/80 leading-relaxed">{impact.why}</p>
                    <p className="text-xs text-red-300/60 leading-relaxed border-t border-white/8 pt-1.5">
                      <span className="font-semibold text-red-400/70">Citation consequence: </span>
                      {impact.consequence}
                    </p>
                  </div>
                ))}
            </div>
          )}
          {finding.remediation && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#22ff6e]/60 mb-1.5">
                Remediation
              </p>
              <p className="text-sm text-white/60 leading-relaxed">{finding.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Plain-language summary view ─────────────────────────────────────────────

function PlainSummary({
  score,
  band,
  domain,
  hardBlockers,
  fixes,
  engines,
}: {
  score: number;
  band: ReturnType<typeof getScoreBand>;
  domain: string;
  hardBlockers: string[];
  fixes: AnalysisResponse['recommendations'];
  engines: Record<string, number>;
}) {
  const verdict =
    score >= 80
      ? `${domain} is consistently citation-ready. AI answer engines like ChatGPT, Perplexity, Claude, and Google AI can read, trust, and quote this site in their answers.`
      : score >= 60
        ? `${domain} is on the radar for AI systems but is not consistently cited. A few specific gaps are preventing it from appearing reliably in AI-generated answers.`
        : score >= 40
          ? `${domain} is partially readable by AI, but is frequently skipped over. Key trust signals are missing — AI systems tend to cite competitors instead.`
          : score >= 20
            ? `${domain} is largely invisible to AI answer engines. Most searches related to this site's topics will pull from other sources rather than here.`
            : `${domain} cannot be reliably read or cited by AI systems. Critical barriers are blocking all meaningful mention in AI-generated answers.`;

  const topFixes = (fixes ?? [])
    .filter((r) => r.priority === 'high' || r.priority === 'medium')
    .slice(0, 3);

  const engineEntries = Object.entries(engines) as [string, number][];

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="rounded-xl border border-white/15 bg-white/[0.04] p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">
          Plain English — What This Score Means
        </p>
        <p className="text-base text-white/90 leading-relaxed">{verdict}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xl font-extrabold" style={{ color: band.hex }}>
            {score}/100
          </span>
          <span className="text-sm font-semibold" style={{ color: band.hex }}>
            {band.grade} — {band.label}
          </span>
        </div>
      </div>

      {/* What each AI can/can't see */}
      {engineEntries.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">
            What Each AI System Sees
          </p>
          <div className="space-y-3">
            {engineEntries.map(([key, val]) => {
              const name = ENGINE_LABELS[key] ?? key;
              const desc =
                val >= 70
                  ? `Can read and cite ${domain} in answers`
                  : val >= 40
                    ? `Sometimes mentions ${domain} but often skips it`
                    : `Cannot reliably find or cite ${domain}`;
              return (
                <div key={key} className="flex items-start gap-3">
                  <div
                    className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${val >= 70 ? 'bg-emerald-400' : val >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                  />
                  <div>
                    <span className="text-sm font-semibold text-white/85">{name} — </span>
                    <span className="text-sm text-white/55">{desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* What's blocking citation */}
      {hardBlockers.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/60 mb-3">
            What's Blocking AI Citation Right Now
          </p>
          <div className="space-y-2.5">
            {hardBlockers.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <XCircle className="h-4 w-4 text-red-400/70 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200/80 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top actions in plain English */}
      {topFixes.length > 0 && (
        <div className="rounded-xl border border-[#22ff6e]/15 bg-[#22ff6e]/[0.03] p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#22ff6e]/60 mb-3">
            What To Do First — Highest Impact Actions
          </p>
          <div className="space-y-4">
            {topFixes.map((fix, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-[#22ff6e]/15 border border-[#22ff6e]/25 flex items-center justify-center text-xs font-bold text-[#22ff6e]">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/85">{fix.title}</p>
                  <p className="text-sm text-white/55 mt-0.5 leading-relaxed">{fix.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topFixes.length === 0 && hardBlockers.length === 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
          <p className="text-sm text-emerald-200/80">
            No critical blockers found. This site is well-positioned for AI citation. Minor
            improvements may still raise the score.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Citation Divergence Card ─────────────────────────────────────────────────

function CitationDivergenceCard({ divergence }: { divergence: CitationDivergenceSignal }) {
  if (divergence.direction === 'aligned') return null;

  const isOffPageDominant = divergence.direction === 'off_page_dominant';
  const absDelta = Math.abs(divergence.divergence_delta);

  const borderColor = isOffPageDominant ? 'border-[#ffb830]/25' : 'border-[#22ff6e]/20';
  const bgColor = isOffPageDominant ? 'bg-[#ffb830]/[0.04]' : 'bg-[#22ff6e]/[0.03]';
  const labelColor = isOffPageDominant ? 'text-[#ffb830]/75' : 'text-[#22ff6e]/60';
  const badgeColor = isOffPageDominant
    ? 'bg-[#ffb830]/15 border-[#ffb830]/30 text-[#ffe0a3]'
    : 'bg-[#22ff6e]/15 border-[#22ff6e]/30 text-[#dfffe9]';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${labelColor} mb-0.5`}>
            Citation Behaviour vs Technical Score
          </p>
          <p className="text-sm font-semibold text-white/80">
            {isOffPageDominant
              ? 'Off-page authority is overriding on-page gaps'
              : 'Strong structure — build the external footprint next'}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md border ${badgeColor}`}>
          {isOffPageDominant ? `+${absDelta} off-page` : `+${absDelta} on-page`}
        </span>
      </div>

      {/* Score comparison bar */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3">
          <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1">
            On-page Technical
          </p>
          <p className="text-2xl font-extrabold text-white/70">
            {divergence.on_page_score}
            <span className="text-sm font-normal text-white/30">/100</span>
          </p>
          <p className="text-[11px] text-white/35 mt-0.5">Schema · Structure · Meta</p>
        </div>
        <div
          className={`rounded-lg border ${isOffPageDominant ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.04]'} px-4 py-3`}
        >
          <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1">
            Off-page Citation Behavior
          </p>
          <p
            className={`text-2xl font-extrabold ${isOffPageDominant ? 'text-amber-300' : 'text-white/70'}`}
          >
            {divergence.off_page_score}
            <span className="text-sm font-normal text-white/30">/100</span>
          </p>
          <p className="text-[11px] text-white/35 mt-0.5">Authority · Coverage · Presence</p>
        </div>
      </div>

      <p className="text-sm text-white/60 leading-relaxed mb-3">{divergence.explanation}</p>

      {divergence.scoring_context && (
        <p className="text-[12px] text-white/35 leading-relaxed border-t border-white/8 pt-3 mt-3">
          {divergence.scoring_context}
        </p>
      )}

      <p className="text-[10px] text-white/20 mt-2">
        Confidence: {Math.round(divergence.confidence * 100)}% · Dominant signal:{' '}
        {divergence.dominant_signal.replace(/_/g, ' ')}
      </p>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(13,18,16,0.92)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[color:var(--border)] bg-[rgba(17,24,20,0.72)]">
        <Icon className="h-4 w-4 text-[#22ff6e] shrink-0" />
        <span className="text-sm font-semibold text-white/90 tracking-tight">{title}</span>
        {badge && (
          <span className="ml-auto text-[10px] font-medium text-white/35 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Upgrade gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Lock className="h-6 w-6 text-white/20" />
      <p className="text-sm text-white/40">{feature} available on Alignment+</p>
      <Link
        to="/pricing"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[linear-gradient(135deg,#22ff6e,#b3ff61)] text-[#08110c] text-sm font-semibold hover:brightness-110 transition-all"
      >
        Upgrade <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScanResultScreen({
  result,
  tier,
  onRerunAudit,
  auditId,
  analyzedAt,
}: Props) {
  const score = result.visibility_score ?? 0;
  const band = getScoreBand(score);
  const [viewMode, setViewMode] = useState<'summary' | 'technical'>('summary');
  const [shareCopied, setShareCopied] = useState(false);

  const canSeeDimensions = atLeast(tier, 'starter');
  const canSeeIssues = atLeast(tier, 'alignment');
  const canSeeFixes = atLeast(tier, 'starter');
  const canSeeBrag = atLeast(tier, 'alignment');

  // AI engine scores
  const engines = result.ai_platform_scores ?? {
    chatgpt: 0,
    perplexity: 0,
    google_ai: 0,
    claude: 0,
  };

  // Hard blockers — prefer BRAG findings flagged as hard blockers, fall back to high-priority recs
  const bragFindings = result.brag_validation?.findings ?? [];
  const hardBlockers =
    bragFindings.filter((f) => f.is_hard_blocker).length > 0
      ? bragFindings.filter((f) => f.is_hard_blocker).map((f) => f.title)
      : (result.recommendations ?? [])
          .filter((r) => r.priority === 'high')
          .slice(0, 3)
          .map((r) => r.title);

  // Citation divergence signal
  const divergence = result.citation_divergence ?? null;

  // Dimensions
  const dims = (result.category_grades ?? []).map((g) => ({
    label: g.label,
    score: g.score,
    weight: getDimensionWeight(g.label),
  }));
  const strategic = result.strategic_breakdown;
  const masterSystem = strategic?.master_system;

  // Issues — sorted: critical → high → medium → low
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const issues = [...(result.evidence_fix_plan?.issues ?? [])].sort(
    (a, b) =>
      (SEV_ORDER[a.severity as keyof typeof SEV_ORDER] ?? 3) -
      (SEV_ORDER[b.severity as keyof typeof SEV_ORDER] ?? 3)
  );

  // Fixes — sorted by priority
  const fixes = [...(result.recommendations ?? [])].sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    return (o[a.priority as keyof typeof o] ?? 2) - (o[b.priority as keyof typeof o] ?? 2);
  });

  // Metadata
  const isLive = !result.cached;
  const domain = getDomain(result.url ?? '');
  const ts = fmtTimestamp(result.analyzed_at);

  // Export handler — download JSON report
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aivis-audit-${domain}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Share handler — copy audit link or current page URL
  const handleShare = async () => {
    const resolvedId = auditId || result.audit_id;
    const shareUrl = resolvedId
      ? `${window.location.origin}/app/audits/${resolvedId}`
      : window.location.href;
    let ok = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      } catch {
        /**/
      }
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        /**/
      }
    }
    if (!ok) {
      window.prompt('Copy this link:', shareUrl);
      return;
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2200);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* ─── 1. TOP BAR ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(13,18,16,0.94)] px-4 py-3 flex flex-wrap items-center gap-3 shadow-[0_16px_32px_rgba(0,0,0,0.22)]">
        {/* URL anchor */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-mono text-white/60 hover:text-[#22ff6e] transition-colors truncate"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span className="truncate">{result.url}</span>
          </a>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`}
            />
            <span
              className={`text-[11px] font-semibold ${isLive ? 'text-emerald-400' : 'text-white/30'}`}
            >
              {isLive ? 'LIVE' : 'CACHED'}
            </span>
          </div>

          {/* Timestamp */}
          <span className="text-[11px] text-white/30 font-mono">{ts}</span>

          {/* Processing time */}
          {result.processing_time_ms && (
            <span className="text-[11px] text-white/20">
              {(result.processing_time_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* ─── 2. HERO — Score ring + Engine chips ────────────────────────── */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(13,18,16,0.94)] overflow-hidden shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col sm:flex-row gap-5 p-5">
          {/* Score ring */}
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={score} />

            {/* Grade pill */}
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${band.badgeClass}`}
            >
              {score >= 70 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : score >= 40 ? (
                <Minus className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {band.label}
            </span>
          </div>

          {/* Engine citation chips */}
          <div className="flex-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">
              AI Engine Citation Status
            </p>
            {(Object.entries(engines) as [string, number][]).map(([key, val]) => (
              <EngineChip key={key} name={ENGINE_LABELS[key] ?? key} score={val} />
            ))}
          </div>
        </div>

        {/* Hard-blocker callouts — directly under grade pill */}
        {hardBlockers.length > 0 && (
          <div className="px-5 py-4 border-t border-white/8 bg-red-500/[0.04]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 mb-2">
              Hard blockers — capping your score
            </p>
            <div className="space-y-1.5">
              {hardBlockers.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <XCircle className="h-3.5 w-3.5 text-red-400/60 shrink-0 mt-0.5" />
                  <span className="text-sm text-red-200/70 leading-snug">{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {result.summary && (
          <div className="px-5 py-3 border-t border-white/8">
            <p className="text-sm text-white/55 leading-relaxed">{result.summary}</p>
          </div>
        )}
      </div>

      {/* ─── VIEW MODE TOGGLE ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              viewMode === 'summary'
                ? 'bg-[#22ff6e]/15 border border-[#22ff6e]/30 text-[#dfffe9]'
                : 'text-white/45 hover:text-white/70'
            }`}
          >
            <BookOpen className="h-3 w-3" />
            Summary
          </button>
          <button
            type="button"
            onClick={() => setViewMode('technical')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              viewMode === 'technical'
                ? 'bg-white/10 border border-white/20 text-white/80'
                : 'text-white/45 hover:text-white/70'
            }`}
          >
            <Code2 className="h-3 w-3" />
            Technical
          </button>
        </div>
        <p className="text-[11px] text-white/25">
          {viewMode === 'summary' ? 'Plain English — no jargon' : 'Full evidence breakdown'}
        </p>
      </div>

      {/* ─── PLAIN SUMMARY VIEW ──────────────────────────────────────── */}
      {viewMode === 'summary' && (
        <>
          <PlainSummary
            score={score}
            band={band}
            domain={domain}
            hardBlockers={hardBlockers}
            fixes={fixes}
            engines={engines}
          />
          {divergence && divergence.direction !== 'aligned' && (
            <CitationDivergenceCard divergence={divergence} />
          )}
          {/* Competitor citation theft — shown in summary so every tier sees it */}
          {result.answer_presence?.gaps?.some(
            (g) => g.dominant_sources && g.dominant_sources.length > 0
          ) && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400 shrink-0" />
                <p className="text-sm font-semibold text-white/85">
                  Competitors are winning your citations
                </p>
              </div>
              <CompetitorCitationTheft gaps={result.answer_presence.gaps} />
            </div>
          )}
        </>
      )}

      {/* ─── TECHNICAL SECTIONS (shown only in technical mode) ───────── */}
      {viewMode === 'technical' && (
        <>
          {/* Citation divergence — always shown at top of technical view when non-aligned */}
          {divergence && divergence.direction !== 'aligned' && (
            <CitationDivergenceCard divergence={divergence} />
          )}
          {strategic && (
            <Section
              icon={Compass}
              title="Strategic Engine Model"
              badge={strategic.citation_state.overall.toUpperCase()}
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-[#22ff6e]/20 bg-[#22ff6e]/5 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-[#22ff6e]/70 mb-1">
                    Core question
                  </p>
                  <p className="text-sm text-white/85">{strategic.positioning.core_question}</p>
                  <p className="text-xs text-white/55 mt-1">
                    {strategic.positioning.value_proposition}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] text-white/35 uppercase">Cloudflare</p>
                    <p className="text-xs font-semibold text-white/80">
                      {strategic.api_signal_coverage.cloudflare_bot_signals ? 'online' : 'missing'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] text-white/35 uppercase">KG</p>
                    <p className="text-xs font-semibold text-white/80">
                      {strategic.api_signal_coverage.knowledge_graph_signals ? 'online' : 'missing'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] text-white/35 uppercase">GSC Demand</p>
                    <p className="text-xs font-semibold text-white/80">
                      {strategic.api_signal_coverage.query_demand_signals ? 'online' : 'missing'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] text-white/35 uppercase">SERP</p>
                    <p className="text-xs font-semibold text-white/80">
                      {strategic.api_signal_coverage.serp_answer_signals ? 'online' : 'missing'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                    <p className="text-[10px] text-white/35 uppercase">Technical</p>
                    <p className="text-xs font-semibold text-white/80">
                      {strategic.api_signal_coverage.technical_health_signals
                        ? 'online'
                        : 'missing'}
                    </p>
                  </div>
                </div>

                {masterSystem && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.015] px-3 py-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-white/35">
                        Master system v{masterSystem.version}
                      </p>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          masterSystem.source_policy.requirement_met
                            ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-red-300 border-red-500/30 bg-red-500/10'
                        }`}
                      >
                        source policy {masterSystem.source_policy.requirement_met ? 'met' : 'unmet'}
                      </span>
                    </div>

                    <p className="text-xs text-white/55">
                      active sources: {masterSystem.source_policy.active_sources}/
                      {masterSystem.source_policy.minimum_sources_required} required
                    </p>

                    <div className="space-y-2">
                      {masterSystem.module_scores.map((module, i) => (
                        <div
                          key={`${module.key}-${i}`}
                          className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-white/80">{module.label}</p>
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                module.status === 'healthy'
                                  ? 'text-emerald-300'
                                  : module.status === 'watch'
                                    ? 'text-amber-300'
                                    : 'text-red-300'
                              }`}
                            >
                              {module.score}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-white/45">
                            <span>weight {module.weight}%</span>
                            <span>{module.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {strategic.operating_model.map((stage, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/75">
                          {stage.stage}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase ${stage.status === 'healthy' ? 'text-emerald-300' : stage.status === 'watch' ? 'text-amber-300' : 'text-red-300'}`}
                        >
                          {stage.status}
                        </span>
                      </div>
                      <p className="text-xs text-white/55 mt-1">{stage.rationale}</p>
                      {stage.corrective_action && (
                        <p className="text-xs text-[#dfffe9]/70 mt-1">
                          Action: {stage.corrective_action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {strategic.corrective_action_paths.length > 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.015] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
                      Corrective action paths
                    </p>
                    <div className="space-y-2">
                      {strategic.corrective_action_paths.slice(0, 3).map((path, i) => (
                        <div key={i} className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-white/80">{path.title}</p>
                            <p className="text-[11px] text-white/45">
                              {path.category} · {path.priority}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-emerald-300 whitespace-nowrap">
                            +{path.expected_citation_lift}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── 4. DIMENSION CARDS ─────────────────────────────────────────── */}
          {dims.length > 0 && (
            <Section
              icon={TrendingUp}
              title="Score Breakdown by Dimension"
              badge={`${dims.length} categories`}
            >
              {canSeeDimensions ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {dims.map((d, i) => (
                    <DimensionCard key={i} label={d.label} score={d.score} weight={d.weight} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {/* First 2 visible as teaser */}
                  {dims.slice(0, 2).map((d, i) => (
                    <DimensionCard key={i} label={d.label} score={d.score} weight={d.weight} />
                  ))}
                  {/* Rest blurred */}
                  {dims.slice(2).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/8 bg-[#0d111c]/50 px-4 py-3 blur-[3px] pointer-events-none select-none opacity-40"
                    >
                      <div className="h-4 bg-white/10 rounded mb-2 w-3/4" />
                      <div className="h-7 bg-white/10 rounded w-1/2" />
                    </div>
                  ))}
                  <UpgradeGate feature="Full dimension breakdown" />
                </div>
              )}
            </Section>
          )}

          {/* ─── 5. ISSUES TRIAGE ───────────────────────────────────────────── */}
          {issues.length > 0 && (
            <Section
              icon={AlertTriangle}
              title="Issues — Severity Triage"
              badge={`${issues.length} issues`}
            >
              {canSeeIssues ? (
                <div className="space-y-2">
                  {issues.map((issue, i) => (
                    <IssueRow key={i} issue={issue} />
                  ))}
                </div>
              ) : (
                <UpgradeGate feature="Evidence-backed issues" />
              )}
            </Section>
          )}

          {/* ─── 6. FIX LIST ─────────────────────────────────────────────────── */}
          {fixes.length > 0 && (
            <Section icon={Zap} title="Priority Fix Engine" badge={`${fixes.length} ranked fixes`}>
              {canSeeFixes ? (
                <div className="space-y-2">
                  {fixes.map((rec, i) => (
                    <FixRow
                      key={i}
                      rank={i + 1}
                      rec={rec}
                      pts={parseImpactPts(rec.estimatedVisibilityLoss, rec.priority)}
                    />
                  ))}
                </div>
              ) : (
                <UpgradeGate feature="Ranked fix engine with point estimates" />
              )}
            </Section>
          )}

          {/* ─── 7. BRAG EVIDENCE BLOCK ─────────────────────────────────────── */}
          {bragFindings.length > 0 && (
            <Section
              icon={Shield}
              title="BRAG Evidence — Verified Findings"
              badge={`${bragFindings.length} findings · ${result.brag_validation?.root_hash ? 'chain verified' : 'unverified'}`}
            >
              {canSeeBrag ? (
                <>
                  {/* Chain metadata strip */}
                  {result.brag_validation && (
                    <div className="flex flex-wrap items-center gap-3 mb-4 px-3 py-2 rounded-lg bg-white/[0.025] border border-white/8">
                      <span className="text-[10px] text-white/35 font-mono">
                        audit: {result.brag_validation.audit_id.slice(0, 12)}…
                      </span>
                      <span className="text-white/15">·</span>
                      <span className="text-[10px] text-white/35 font-mono">
                        root: {result.brag_validation.root_hash.slice(0, 16)}…
                      </span>
                      <span className="text-white/15">·</span>
                      <span className="text-[10px] text-white/35">
                        {result.brag_validation.rejected_count} claims rejected
                      </span>
                      <span className="text-white/15">·</span>
                      <span className="text-[10px] text-white/35">
                        gate v{result.brag_validation.gate_version}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {bragFindings.map((f, i) => (
                      <BragRow key={i} finding={f} />
                    ))}
                  </div>
                </>
              ) : (
                <UpgradeGate feature="BRAG evidence chain (Alignment+)" />
              )}
            </Section>
          )}

          {/* ─── 8. AI BEHAVIOR SIMULATION ──────────────────────────────────── */}
          {result.answer_presence &&
            (result.answer_presence.evidence?.length > 0 ||
              result.answer_presence.gaps?.length > 0) && (
              <Section
                icon={Eye}
                title="AI Behavior Simulation"
                badge={`${result.answer_presence.queries_tested} queries tested`}
              >
                {canSeeBrag ? (
                  <AIBehaviorSimulation
                    evidence={result.answer_presence.evidence ?? []}
                    gaps={result.answer_presence.gaps ?? []}
                  />
                ) : (
                  <UpgradeGate feature="AI behavior simulation (Alignment+)" />
                )}
              </Section>
            )}

          {/* ─── 9. COMPETITOR CITATION THEFT ───────────────────────────────── */}
          {result.answer_presence?.gaps?.some(
            (g) => g.dominant_sources && g.dominant_sources.length > 0
          ) && (
            <Section
              icon={TrendingUp}
              title="Competitor Citation Theft"
              badge="queries where competitors win"
            >
              {canSeeBrag ? (
                <CompetitorCitationTheft gaps={result.answer_presence.gaps ?? []} />
              ) : (
                <UpgradeGate feature="Competitor citation analysis (Alignment+)" />
              )}
            </Section>
          )}
        </>
      )}
      {/* End of technical sections */}

      {/* ─── BOTTOM ACTION BAR (sticky) ─────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[color:var(--border)] bg-[rgba(8,12,10,0.96)] backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3 flex-wrap">
          {/* Primary: Re-scan */}
          <button
            type="button"
            onClick={onRerunAudit}
            disabled={!onRerunAudit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-[linear-gradient(135deg,#22ff6e,#b3ff61)] text-[#08110c] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#22ff6e]/20"
          >
            <RefreshCcw className="h-4 w-4" />
            Re-scan
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
              shareCopied
                ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                : 'border-white/15 text-white/70 hover:border-white/30 hover:text-white/90'
            }`}
          >
            {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {shareCopied ? 'Link copied!' : 'Share'}
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70 transition-all"
            title="Download full JSON report"
          >
            <Download className="h-4 w-4" />
            JSON
          </button>

          {/* Upgrade CTA — shown when below alignment */}
          {!atLeast(tier, 'alignment') && (
            <Link
              to="/pricing"
              className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-[#ffb830]/35 text-[#ffe0a3] bg-[#ffb830]/10 hover:bg-[#ffb830]/18 hover:border-[#ffb830]/50 transition-all"
            >
              <Zap className="h-4 w-4" />
              Unlock full analysis
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Score baseline label */}
          {atLeast(tier, 'alignment') && (
            <div className="ml-auto text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Baseline</p>
              <p className="text-sm font-bold" style={{ color: band.hex }}>
                {score}/100
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
