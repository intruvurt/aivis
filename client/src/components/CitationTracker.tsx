import React, { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Eye,
  Quote,
  Play,
  Clock,
  BarChart3,
  Copy,
  Save,
  History,
  Globe,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import type { AICitationResult, AuthorityCheckResponse, AuthorityPlatform, CitationIdentityResponse, WebSearchPresenceResult, BrandMentionScanResponse, BrandMentionHistoryResponse, BrandMentionTimelinePoint, MentionKPIData, NERRunSummary } from "../../../shared/types";
import { meetsMinimumTier } from "../../../shared/types";

import { API_URL } from '../config';
import apiFetch from '../utils/api';
import { getCitationIdentity } from '../api';
import EvidenceReviewPanel from './EvidenceReviewPanel';
import QueryPackManager from './QueryPackManager';
import { toSafeHref } from '../utils/safeHref';
import RevCiteModal from './RevCiteModal';
import { buildTargetKey, normalizePublicUrlInput } from '../utils/targetKey';

const PLATFORM_CONFIG = {
  chatgpt: { name: "ChatGPT", color: "text-white/80", bg: "bg-charcoal", icon: "" },
  perplexity: { name: "Perplexity", color: "text-white/80", bg: "bg-charcoal", icon: "" },
  claude: { name: "Claude", color: "text-white/80", bg: "bg-charcoal", icon: "" },
  google_ai: { name: "Google AI", color: "text-white/80", bg: "bg-charcoal", icon: "" },
};

type CitationPlatform = keyof typeof PLATFORM_CONFIG;
const DEFAULT_TEST_PLATFORMS: CitationPlatform[] = ['chatgpt', 'perplexity', 'claude', 'google_ai'];

const VISIBILITY_OUTCOMES = [
  {
    title: 'Measure mention rate',
    detail: 'Track how often your brand appears across AI answers using real query runs and platform counts.',
  },
  {
    title: 'See exact excerpts',
    detail: 'Inspect concrete response text where your brand and competitors are named to validate signal quality.',
  },
  {
    title: 'Query-level testing',
    detail: 'Run realistic prompts tied to intent, product, and service discovery rather than vanity checks.',
  },
  {
    title: 'Monitor movement over time',
    detail: 'Re-run saved query sets and compare mention share after implementing fixes.',
  },
];

// ─── Citation Result Card ───────────────────────────────────────────────────

interface CitationResultCardProps {
  result: AICitationResult;
}

const DEFAULT_PLATFORM = { name: "AI", color: "text-white/55", bg: "bg-charcoal", icon: "" };

function CitationResultCard({ result }: CitationResultCardProps) {
  const platform = PLATFORM_CONFIG[result.platform] || DEFAULT_PLATFORM;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border transition-all ${
      result.mentioned
        ? "border-white/10 bg-charcoal"
        : "border-white/10 bg-charcoal"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <div className={`p-2 rounded-lg ${platform.bg}`}>
          <span className="text-lg">{platform.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${platform.color}`}>
              {platform.name}
            </span>
            {result.source_type === 'direct' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
                Live
              </span>
            )}
            {result.mentioned ? (
              <CheckCircle2 className="w-4 h-4 text-white/80" />
            ) : (
              <XCircle className="w-4 h-4 text-white/60" />
            )}
          </div>
          <p className="text-xs text-white/55 line-clamp-1">
            {result.mentioned ? `Position ${result.position}` : "Not mentioned"}
          </p>
        </div>

        {result.mentioned && result.position && (
          <div className="flex-shrink-0">
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
              result.position <= 3 ? "bg-charcoal text-white/80" :
              result.position <= 6 ? "bg-charcoal/20 text-white/85" :
              "bg-charcoal text-white/80"
            }`}>
              #{result.position}
            </div>
          </div>
        )}
      </button>

      {expanded && result.excerpt && (
        <div className="px-3 pb-3 border-t border-white/10 pt-3 mt-2">
          <div className="flex items-start gap-2">
            <Quote className="w-4 h-4 text-white/60 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/75 italic leading-relaxed">
              {result.excerpt}
            </p>
          </div>
          {result.citation_urls && result.citation_urls.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10/20">
              <p className="text-[10px] text-emerald-400/80 font-semibold uppercase tracking-wide mb-1">
                Sources Cited by Perplexity:
              </p>
              <div className="flex flex-col gap-1">
                {result.citation_urls.slice(0, 5).map((citUrl, i) => (
                  <a
                    key={i}
                    href={toSafeHref(citUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400/80 hover:text-blue-300 truncate"
                  >
                    [{i + 1}] {citUrl}
                  </a>
                ))}
                {result.citation_urls.length > 5 && (
                  <span className="text-[10px] text-white/40">
                    +{result.citation_urls.length - 5} more sources
                  </span>
                )}
              </div>
            </div>
          )}
          {result.competitors_mentioned.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10/20">
              <p className="text-[10px] text-white/80 font-semibold uppercase tracking-wide mb-1">
                Competitors Also Mentioned:
              </p>
              <div className="flex flex-wrap gap-1">
                {result.competitors_mentioned.map((comp, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal text-white/80">
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Web Search Presence Card ───────────────────────────────────────────────

function WebSearchCard({ data }: { data: WebSearchPresenceResult }) {
  const [expanded, setExpanded] = useState(false);
  const isBing = data.source === 'bing_web';
  const isInstant = data.source === 'ddg_instant';
  const isBrave = data.source === 'brave_web';
  const isWikipedia = data.source === 'wikipedia_web';
  const isYahoo = data.source === 'yahoo_web';
  const accentBg = isWikipedia ? 'bg-violet-500/10' : isInstant ? 'bg-emerald-500/10' : isBing ? 'bg-blue-500/10' : isBrave ? 'bg-orange-500/10' : isYahoo ? 'bg-fuchsia-500/10' : 'bg-cyan-500/10';
  const accentIcon = isWikipedia ? 'text-violet-400' : isInstant ? 'text-emerald-400' : isBing ? 'text-blue-400' : isBrave ? 'text-orange-400' : isYahoo ? 'text-fuchsia-400' : 'text-cyan-400';
  const accentText = isWikipedia ? 'text-violet-300/90' : isInstant ? 'text-emerald-300/90' : isBing ? 'text-blue-300/90' : isBrave ? 'text-orange-300/90' : isYahoo ? 'text-fuchsia-300/90' : 'text-cyan-300/90';
  const accentBadgeBg = isWikipedia ? 'bg-violet-500/20' : isInstant ? 'bg-emerald-500/20' : isBing ? 'bg-blue-500/20' : isBrave ? 'bg-orange-500/20' : isYahoo ? 'bg-fuchsia-500/20' : 'bg-cyan-500/20';
  const accentBadgeText = isWikipedia ? 'text-violet-400' : isInstant ? 'text-emerald-400' : isBing ? 'text-blue-400' : isBrave ? 'text-orange-400' : isYahoo ? 'text-fuchsia-400' : 'text-cyan-400';
  const label = isWikipedia ? 'Wikipedia' : isInstant ? 'DuckDuckGo Instant' : isBing ? 'Bing' : isBrave ? 'Brave' : isYahoo ? 'Yahoo' : 'DuckDuckGo Web';

  return (
    <div className="rounded-lg border border-white/10 bg-charcoal transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <div className={`p-2 rounded-lg ${accentBg}`}>
          <Search className={`w-4 h-4 ${accentIcon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${accentText}`}>
              {label}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${accentBadgeBg} ${accentBadgeText} font-bold uppercase tracking-wider`}>
              Free
            </span>
            {data.found ? (
              <CheckCircle2 className="w-4 h-4 text-white/80" />
            ) : (
              <XCircle className="w-4 h-4 text-white/60" />
            )}
          </div>
          <p className="text-xs text-white/55 line-clamp-1">
            {data.found
              ? `Found at position ${data.position} of ${data.results_checked} results`
              : `Not found in top ${data.results_checked} results`}
          </p>
        </div>

        {data.found && data.position > 0 && (
          <div className="flex-shrink-0">
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
              data.position <= 3 ? `${accentBadgeBg} ${accentBadgeText}` :
              data.position <= 10 ? "bg-charcoal text-white/80" :
              "bg-charcoal text-white/60"
            }`}>
              #{data.position}
            </div>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/10 pt-3 mt-2 space-y-2">
          {data.matching_results.length > 0 && (
            <div>
              <p className={`text-[10px] ${accentBadgeText} font-semibold uppercase tracking-wide mb-1`}>
                Matching Results:
              </p>
              {data.matching_results.slice(0, 3).map((r, i) => (
                <div key={i} className="mb-1.5">
                  <a
                    href={toSafeHref(r.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-400/80 hover:text-blue-300 block truncate"
                  >
                    #{r.position} - {r.title}
                  </a>
                  <p className="text-[10px] text-white/50 line-clamp-2">{r.description}</p>
                </div>
              ))}
            </div>
          )}
          {data.competitor_urls_found.length > 0 && (
            <div className="pt-2 border-t border-white/10/20">
              <p className="text-[10px] text-white/80 font-semibold uppercase tracking-wide mb-1">
                Competitors in Results:
              </p>
              <div className="flex flex-wrap gap-1">
                {data.competitor_urls_found.map((comp, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal text-white/80">
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.top_results.length > 0 && !data.found && (
            <div>
              <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wide mb-1">
                Top Results Instead:
              </p>
              {data.top_results.slice(0, 5).map((r, i) => (
                <p key={i} className="text-[10px] text-white/40 truncate">
                  #{r.position} {r.title}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Query Result Group ─────────────────────────────────────────────────────

interface QueryResultsProps {
  query: string;
  results: AICitationResult[];
  webSearch?: WebSearchPresenceResult;
  bingSearch?: WebSearchPresenceResult;
  ddgSearch?: WebSearchPresenceResult;
  braveSearch?: WebSearchPresenceResult;
  wikipediaSearch?: WebSearchPresenceResult;
  yahooSearch?: WebSearchPresenceResult;
}

function QueryResults({ query, results, webSearch, bingSearch, ddgSearch, braveSearch, wikipediaSearch, yahooSearch }: QueryResultsProps) {
  const [expanded, setExpanded] = useState(false);
  const mentionCount = results.filter(r => r.mentioned).length;
  const totalPlatforms = results.length;

  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-deep overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-charcoal transition-colors"
      >
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <p className="text-sm font-medium text-white truncate">{query}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/55">
            <span>{mentionCount}/{totalPlatforms} platforms</span>
            {mentionCount > 0 && (
              <span className="flex items-center gap-1 text-white/80">
                <CheckCircle2 className="w-3 h-3" />
                Mentioned
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <div className="flex -space-x-2">
            {results.slice(0, 4).map((r, i) => {
              const platform = PLATFORM_CONFIG[r.platform] || DEFAULT_PLATFORM;
              return (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full ${platform.bg} border-2 border-white/10 flex items-center justify-center text-xs`}
                  title={platform.name}
                >
                  {r.mentioned ? "" : "×"}
                </div>
              );
            })}
          </div>
          {expanded ? "▲" : "▼"}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/10 pt-3">
          {webSearch && <WebSearchCard data={webSearch} />}
          {bingSearch && <WebSearchCard data={bingSearch} />}
          {ddgSearch && <WebSearchCard data={ddgSearch} />}
          {braveSearch && <WebSearchCard data={braveSearch} />}
          {wikipediaSearch && <WebSearchCard data={wikipediaSearch} />}
          {yahooSearch && <WebSearchCard data={yahooSearch} />}
          {results.map((result, i) => (
            <CitationResultCard key={i} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface CitationTrackerProps {
  url: string;
  token?: string;
  userTier?: 'observer' | 'alignment' | 'signal' | 'scorefix';
}

const AUTHORITY_PLATFORMS: AuthorityPlatform[] = [
  'reddit',
  'linkedin',
  'substack',
  'medium',
  'github',
  'stackoverflow',
  'wikipedia',
  'youtube',
  'g2',
  'trustpilot',
  'crunchbase',
  'producthunt',
  'techcrunch',
  'blogger',
  'facebook',
  'devpost',
  'hackernews',
  'chrome_web_store',
  'twitter',
  'devto',
  'bluesky',
];

function platformLabel(platform: AuthorityPlatform): string {
  const map: Record<AuthorityPlatform, string> = {
    reddit: 'Reddit',
    linkedin: 'LinkedIn',
    substack: 'Substack',
    medium: 'Medium',
    github: 'GitHub',
    stackoverflow: 'Stack Overflow',
    wikipedia: 'Wikipedia',
    youtube: 'YouTube',
    g2: 'G2',
    trustpilot: 'Trustpilot',
    crunchbase: 'Crunchbase',
    producthunt: 'Product Hunt',
    techcrunch: 'TechCrunch',
    blogger: 'Blogger',
    facebook: 'Facebook',
    devpost: 'Devpost',
    hackernews: 'Hacker News',
    chrome_web_store: 'Chrome Web Store',
    twitter: 'Twitter / X',
    devto: 'dev.to',
    bluesky: 'Bluesky',
  };
  return map[platform] || platform;
}

function natureLabel(nature: string): string {
  if (nature === 'organic_pain_solution') return 'Organic Pain/Solution';
  if (nature === 'direct_promo') return 'Direct Promo';
  if (nature === 'spammy') return 'Spammy';
  return 'Neutral';
}

export default function CitationTracker({ url, token, userTier = 'observer' }: CitationTrackerProps) {
  const [loading, setLoading] = useState(false);
  const [generatingQueries, setGeneratingQueries] = useState(false);
  const [queries, setQueries] = useState<string[]>([]);
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
  const [testId, setTestId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<AICitationResult[] | null>(null);
  const [testSummary, setTestSummary] = useState<any>(null);
  const [webSearchByQuery, setWebSearchByQuery] = useState<Record<string, WebSearchPresenceResult> | null>(null);
  const [bingSearchByQuery, setBingSearchByQuery] = useState<Record<string, WebSearchPresenceResult> | null>(null);
  const [ddgSearchByQuery, setDdgSearchByQuery] = useState<Record<string, WebSearchPresenceResult> | null>(null);
  const [braveSearchByQuery, setBraveSearchByQuery] = useState<Record<string, WebSearchPresenceResult> | null>(null);
  const [wikipediaSearchByQuery, setWikipediaSearchByQuery] = useState<Record<string, WebSearchPresenceResult> | null>(null);
  const [yahooSearchByQuery, setYahooSearchByQuery] = useState<Record<string, WebSearchPresenceResult> | null>(null);
  const [authorityLoading, setAuthorityLoading] = useState(false);
  const [authorityTarget, setAuthorityTarget] = useState(url || '');
  const [authorityReport, setAuthorityReport] = useState<AuthorityCheckResponse | null>(null);
  const [citationIdentity, setCitationIdentity] = useState<CitationIdentityResponse | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [identityLoading, setIdentityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryCount, setQueryCount] = useState(50);
  const [selectedPlatforms, setSelectedPlatforms] = useState<CitationPlatform[]>(DEFAULT_TEST_PLATFORMS);
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
  const [queryPackManagerOpen, setQueryPackManagerOpen] = useState(false);

  // Competitor Discovery state
  const [competitorQueries, setCompetitorQueries] = useState('');
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorRunId, setCompetitorRunId] = useState<string | null>(null);
  const [competitorStatus, setCompetitorStatus] = useState<string | null>(null);
  const [competitorProgress, setCompetitorProgress] = useState(0);
  const [competitorTotal, setCompetitorTotal] = useState(0);
  type CompetitorInsight = { domain: string; mentions: number; citations: number; avg_position: number | null; score: number };
  const [competitorData, setCompetitorData] = useState<CompetitorInsight[] | null>(null);

  // Entity Clarity state
  type EntityClarityResult = {
    entity_clarity_score: number;
    authority_score: number;
    recognition_rate: number;
    category_consistency: number;
    description_consistency: number;
    avg_confidence: number;
    dominant_category: string | null;
    all_categories: Array<{ category: string; count: number }>;
    sample_descriptions: string[];
    total_snapshots: number;
    insights: string[];
  };
  const [entityClarityData, setEntityClarityData] = useState<EntityClarityResult | null>(null);
  const [nerData, setNerData] = useState<NERRunSummary | null>(null);

  // Brand Mention Tracker state
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionResult, setMentionResult] = useState<BrandMentionScanResponse | null>(null);
  const [mentionHistory, setMentionHistory] = useState<BrandMentionHistoryResponse | null>(null);
  const [mentionTimeline, setMentionTimeline] = useState<BrandMentionTimelinePoint[] | null>(null);
  const [mentionShowHistory, setMentionShowHistory] = useState(false);
  const [mentionKPI, setMentionKPI] = useState<MentionKPIData | null>(null);

  const canRunAuthorityCheck = meetsMinimumTier(userTier as any, 'alignment');
  const canTrackMentions = meetsMinimumTier(userTier as any, 'alignment');
  const canRunCitationTests = meetsMinimumTier(userTier as any, 'signal');
  const normalizedAuthorityTarget = normalizePublicUrlInput(authorityTarget || url || '');
  const businessNameStorageKey = normalizedAuthorityTarget
    ? `aivis-citation-business:${buildTargetKey(normalizedAuthorityTarget)}`
    : '';
  const engineUseCases = [
    'Global live search for branded mentions across community, review, docs, and editorial surfaces',
    'Product and service discovery testing using audited page entities, topics, and quoteable proof blocks',
    'Executive, buyer, and shortlist query packs for revenue teams and agencies',
    'Competitive mention tracking across simulated answer-engine outputs',
  ];

  useEffect(() => {
    setAuthorityTarget(normalizePublicUrlInput(url || ''));
  }, [url]);

  useEffect(() => {
    if (!businessNameStorageKey) {
      setBusinessName('');
      return;
    }

    try {
      const saved = window.localStorage.getItem(businessNameStorageKey);
      setBusinessName(saved || '');
    } catch {
      setBusinessName('');
    }
  }, [businessNameStorageKey]);

  useEffect(() => {
    if (!normalizedAuthorityTarget || !canRunAuthorityCheck) {
      setCitationIdentity(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setIdentityLoading(true);
        const payload = await getCitationIdentity(normalizedAuthorityTarget);
        if (cancelled) return;
        const identity = payload?.identity || null;
        setCitationIdentity(identity);
        if (identity?.business_name && businessNameStorageKey) {
          const saved = window.localStorage.getItem(businessNameStorageKey);
          if (!saved) {
            setBusinessName(identity.business_name);
            window.localStorage.setItem(businessNameStorageKey, identity.business_name);
          }
        }
      } catch {
        if (!cancelled) setCitationIdentity(null);
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [businessNameStorageKey, canRunAuthorityCheck, normalizedAuthorityTarget]);

  useEffect(() => {
    if (!businessNameStorageKey) return;
    try {
      const normalizedName = businessName.trim();
      if (!normalizedName) {
        window.localStorage.removeItem(businessNameStorageKey);
        return;
      }
      window.localStorage.setItem(businessNameStorageKey, normalizedName);
    } catch {
      // ignore local storage failures
    }
  }, [businessName, businessNameStorageKey]);

  // Poll for competitor discovery run completion
  useEffect(() => {
    if (!competitorRunId || !token) return;
    if (competitorStatus === 'completed' || competitorStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/tracking/runs/${competitorRunId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const run = data.run || {};
        const status: string = run.status || 'queued';
        setCompetitorStatus(status);
        const completed = Number(run.completed_queries || 0);
        const total = Number(run.total_queries || competitorTotal);
        setCompetitorProgress(total > 0 ? Math.round((completed / total) * 100) : 0);

        if (status === 'completed') {
          const compRes = await fetch(`${API_URL}/api/tracking/runs/${competitorRunId}/competitors`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (compRes.ok) {
            const compData = await compRes.json();
            setCompetitorData(compData.competitors || []);
          }
          // Also fetch entity clarity (runs post-completion in worker)
          try {
            const clarityRes = await fetch(`${API_URL}/api/tracking/runs/${competitorRunId}/entity-clarity`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (clarityRes.ok) {
              const clarityData = await clarityRes.json();
              setEntityClarityData(clarityData);
            }
          } catch { /* clarity is optional */ }
          // Fetch NER entity co-mention data (zero-cost, post-completion)
          try {
            const nerRes = await fetch(`${API_URL}/api/tracking/runs/${competitorRunId}/ner`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (nerRes.ok) {
              const nerJson = await nerRes.json();
              setNerData(nerJson);
            }
          } catch { /* NER is optional */ }
          setCompetitorLoading(false);
          clearInterval(interval);
        } else if (status === 'failed') {
          toast.error('Competitor discovery failed');
          setCompetitorLoading(false);
          clearInterval(interval);
        }
      } catch { /* ignore poll errors */ }
    }, 2000);

    return () => clearInterval(interval);
  }, [competitorRunId, competitorStatus, token, competitorTotal]);

  // Poll for test completion
  useEffect(() => {
    if (!testId || testStatus === 'completed' || testStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/citations/test/${testId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 401) {
          setError('Session expired or unauthorized. Please sign in again from the account menu.');
          setLoading(false);
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setTestStatus(data.test.status);

          if (data.test.status === 'completed') {
            setTestResults(data.test.results);
            setTestSummary(data.test.summary);
            setWebSearchByQuery(data.test.web_search_by_query || null);
            setBingSearchByQuery(data.test.bing_search_by_query || null);
            setDdgSearchByQuery(data.test.ddg_search_by_query || null);
            setBraveSearchByQuery(data.test.brave_search_by_query || null);
            setWikipediaSearchByQuery(data.test.wikipedia_search_by_query || null);
            setYahooSearchByQuery(data.test.yahoo_search_by_query || null);
            setLoading(false);
          } else if (data.test.status === 'failed') {
            setError(data.test.error || 'Citation test failed. Please try again.');
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Poll error:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [testId, testStatus, token]);

  async function handleGenerateQueries() {
    if (!token || !url || !canRunCitationTests) return;

    try {
      setGeneratingQueries(true);
      setError(null);

      const response = await apiFetch(`${API_URL}/api/citations/generate-queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, count: queryCount }),
      });

      if (response.status === 401) {
        setError('Session expired or unauthorized. Please sign in again from the account menu.');
        return;
      }
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Citation query generation requires a Signal plan or higher.');
        return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate queries');
      }

      const data = await response.json();
      setQueries(data.queries);
      setSelectedQueries(data.queries.slice(0, Math.min(10, data.queries.length))); // Pre-select top 10
    } catch (err: any) {
      console.error('Generate queries error:', err);
      setError(err.message);
    } finally {
      setGeneratingQueries(false);
    }
  }

  async function handleStartTest() {
    if (!token || !url || selectedQueries.length === 0 || !canRunCitationTests || selectedPlatforms.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch(`${API_URL}/api/citations/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          queries: selectedQueries,
          platforms: selectedPlatforms,
        }),
      });

      if (response.status === 401) {
        setError('Session expired or unauthorized. Please sign in again from the account menu.');
        setLoading(false);
        return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start citation test');
      }

      const data = await response.json();
      setTestId(data.test_id);
      setTestStatus('pending');
    } catch (err: any) {
      console.error('Start test error:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleAuthorityCheck() {
    if (!token || !normalizedAuthorityTarget || !canRunAuthorityCheck) return;

    const timeoutMs = 90000;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      setAuthorityLoading(true);
      setError(null);
      const response = await apiFetch(`${API_URL}/api/citations/authority-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          target: normalizedAuthorityTarget,
          officialUrl: normalizedAuthorityTarget,
          platforms: AUTHORITY_PLATFORMS,
        }),
      });

      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.error || 'Failed authority check');
      }

      const data = await response.json();
      setAuthorityReport(data.report || null);
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('aborted');
      setError(isAbort ? 'Authority check timed out. Please try again in a few seconds.' : (err.message || 'Authority check failed'));
    } finally {
      window.clearTimeout(timer);
      setAuthorityLoading(false);
    }
  }

  async function handleDiscoverCompetitors() {
    if (!token || !url || !canRunAuthorityCheck) return;
    const lines = competitorQueries.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error('Enter at least one query'); return; }
    if (lines.length > 50) { toast.error('Maximum 50 queries'); return; }

    try {
      setCompetitorLoading(true);
      setCompetitorData(null);
      setEntityClarityData(null);
      setNerData(null);
      setCompetitorStatus('starting');
      setCompetitorProgress(0);

      const projRes = await apiFetch(`${API_URL}/api/tracking/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: url, queries: lines }),
      });
      if (!projRes.ok) {
        const e = await projRes.json().catch(() => ({}));
        throw new Error((e as any).error || 'Failed to create tracking project');
      }
      const { projectId } = await projRes.json();

      const runRes = await apiFetch(`${API_URL}/api/tracking/projects/${projectId}/runs`, { method: 'POST' });
      if (!runRes.ok) {
        const e = await runRes.json().catch(() => ({}));
        throw new Error((e as any).error || 'Failed to start tracking run');
      }
      const { runId, totalQueries } = await runRes.json();
      setCompetitorRunId(runId);
      setCompetitorTotal(totalQueries);
      setCompetitorStatus('queued');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start competitor discovery');
      setCompetitorLoading(false);
      setCompetitorStatus(null);
    }
  }

  async function handleMentionScan() {
    if (!token || !canTrackMentions) return;
    const brand = businessName.trim() || citationIdentity?.business_name || '';
    if (!brand) {
      toast.error('Enter a business/brand name first');
      return;
    }
    const domain = normalizedAuthorityTarget.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    try {
      setMentionLoading(true);
      setMentionResult(null);
      const response = await apiFetch(`${API_URL}/api/mentions/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, domain }),
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.error || 'Mention scan failed');
      }
      const data: BrandMentionScanResponse = await response.json();
      setMentionResult(data);
      toast.success(`Found ${data.mentions.length} mentions across ${data.sources_checked.length} sources`);

      // Also load history + timeline + KPI
      const [histRes, tlRes, kpiRes] = await Promise.all([
        apiFetch(`${API_URL}/api/mentions/history?brand=${encodeURIComponent(brand)}&limit=50`),
        apiFetch(`${API_URL}/api/mentions/timeline?brand=${encodeURIComponent(brand)}&days=30`),
        apiFetch(`${API_URL}/api/mentions/kpi?brand=${encodeURIComponent(brand)}`),
      ]);
      if (histRes.ok) setMentionHistory(await histRes.json());
      if (tlRes.ok) {
        const tlData = await tlRes.json();
        setMentionTimeline(tlData.timeline || []);
      }
      if (kpiRes.ok) {
        const kpiData = await kpiRes.json();
        if (kpiData.kpi) setMentionKPI(kpiData.kpi);
      }
    } catch (err: any) {
      toast.error(err.message || 'Mention scan failed');
    } finally {
      setMentionLoading(false);
    }
  }

  function toggleQuery(query: string) {
    setSelectedQueries(prev =>
      prev.includes(query) ? prev.filter(q => q !== query) : [...prev, query]
    );
  }

  function selectTopQueries(count: number) {
    setSelectedQueries(queries.slice(0, Math.min(count, queries.length)));
  }

  function togglePlatform(platform: CitationPlatform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((item) => item !== platform)
        : [...prev, platform]
    );
  }

  async function copySummary() {
    if (!testSummary) return;
    const lines = [
      `URL: ${url}`,
      `Queries tested: ${testSummary.total_queries}`,
      `Mention rate: ${testSummary.mention_rate}%`,
      `Average position: #${Number(testSummary.avg_position || 0).toFixed(1)}`,
    ];
    if (testSummary.web_search_found_rate != null) {
      lines.push(`Web Search found rate: ${testSummary.web_search_found_rate}%`);
    }
    if (testSummary.web_search_avg_position > 0) {
      lines.push(`Web Search avg position: #${testSummary.web_search_avg_position.toFixed(1)}`);
    }
    if (testSummary.bing_found_rate != null) {
      lines.push(`Bing found rate: ${testSummary.bing_found_rate}%`);
    }
    if (testSummary.bing_avg_position > 0) {
      lines.push(`Bing avg position: #${testSummary.bing_avg_position.toFixed(1)}`);
    }
    if (testSummary.ddg_found_rate != null) {
      lines.push(`DuckDuckGo found rate: ${testSummary.ddg_found_rate}%`);
    }
    if (testSummary.ddg_avg_position > 0) {
      lines.push(`DuckDuckGo avg position: #${testSummary.ddg_avg_position.toFixed(1)}`);
    }
    if (testSummary.brave_found_rate != null) {
      lines.push(`Brave found rate: ${testSummary.brave_found_rate}%`);
    }
    if (testSummary.brave_avg_position > 0) {
      lines.push(`Brave avg position: #${testSummary.brave_avg_position.toFixed(1)}`);
    }
    if (testSummary.yahoo_found_rate != null) {
      lines.push(`Yahoo found rate: ${testSummary.yahoo_found_rate}%`);
    }
    if (testSummary.yahoo_avg_position > 0) {
      lines.push(`Yahoo avg position: #${testSummary.yahoo_avg_position.toFixed(1)}`);
    }
    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Citation summary copied');
    } catch {
      toast.error('Could not copy summary');
    }
  }

  async function exportCsv() {
    if (!testId || !token) return;
    try {
      const response = await fetch(`${API_URL}/api/citations/test/${testId}/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to export CSV');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `citation-test-${testId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
      toast.success('Citation CSV exported');
    } catch (err: any) {
      toast.error(err?.message || 'Could not export citation CSV');
    }
  }

  // Group results by query
  const groupedResults = testResults
    ? selectedQueries.map(query => ({
        query,
        results: testResults.filter(r => r.query === query),
      }))
    : [];

  const queryDiagnostics = groupedResults.map((group) => {
    const mentionCount = group.results.filter((result) => result.mentioned).length;
    const top3Count = group.results.filter((result) => result.mentioned && Number(result.position || 999) <= 3).length;
    const competitorMentionCount = group.results.reduce((acc, result) => acc + (result.competitors_mentioned?.length || 0), 0);

    const reasons: string[] = [];
    if (mentionCount === 0) {
      reasons.push("No platform cited your brand for this query.");
    }
    if (mentionCount > 0 && top3Count === 0) {
      reasons.push("Mentions exist, but your brand is below top 3 placement.");
    }
    if (competitorMentionCount > 0) {
      reasons.push(`Competitors were cited ${competitorMentionCount} times across platform outputs.`);
    }
    if (/best|top|vs|compare|alternative/i.test(group.query) && mentionCount < 2) {
      reasons.push("Comparison intent is underperforming; add explicit comparison tables and answer blocks.");
    }

    const priority = mentionCount === 0 ? "high" : top3Count === 0 ? "medium" : "low";
    return {
      query: group.query,
      priority,
      mentionCount,
      top3Count,
      reasons: reasons.length ? reasons : ["Query is performing acceptably; monitor trend for consistency."],
    };
  }).sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return order[a.priority as keyof typeof order] - order[b.priority as keyof typeof order];
  });

  return (
    <div className="space-y-6">
      <div className="brand-bar-top rounded-2xl border border-white/10 bg-charcoal-deep p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-charcoal border border-white/10">
            <BarChart3 className="w-5 h-5 text-white/85" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Authority / Citation Granular Check</h3>
            <p className="text-xs text-white/55">Enterprise live-search engine for product, service, and quoteable-content discovery across public authority surfaces.</p>
          </div>
        </div>

        {!canRunAuthorityCheck ? (
          <div className="rounded-xl border border-white/10 bg-charcoal p-4 text-sm text-white/75">
            Paid tiers only. Upgrade to <strong className="text-white">Alignment</strong> or <strong className="text-white">Signal</strong> to run granular authority/citation checks.
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-white/10 bg-charcoal p-4">
              <p className="text-xs uppercase tracking-wide text-white/45 brand-dot-cyan">What this engine is best used for</p>
              <ul className="brand-list mt-3 space-y-2 list-none">
                {engineUseCases.map((item) => (
                  <li key={item} className="text-xs text-white/75">{item}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">Official URL</label>
                <input
                  value={authorityTarget}
                  onChange={(e) => setAuthorityTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && authorityTarget.trim() && handleAuthorityCheck()}
                  enterKeyHint="go"
                  placeholder="https://yourdomain.com"
                  className="field-vivid bg-charcoal w-full px-4 py-2.5 rounded-full border border-white/10 text-white text-sm placeholder-white/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">Business / brand name</label>
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value.replace(/\s+/g, ' ').trimStart())}
                  onKeyDown={(e) => e.key === "Enter" && authorityTarget.trim() && handleAuthorityCheck()}
                  enterKeyHint="go"
                  placeholder={citationIdentity?.business_name || 'Auto-filled from audit evidence'}
                  className="field-vivid bg-charcoal w-full px-4 py-2.5 rounded-full border border-white/10 text-white text-sm placeholder-white/50"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-white/55">
              {identityLoading
                ? 'Reading the latest audited evidence to populate the business name…'
                : citationIdentity?.business_name
                  ? `Using ${citationIdentity.business_name_source === 'audit_evidence' ? 'recent audit evidence' : citationIdentity.business_name_source === 'schema_org' ? 'schema.org structured data' : citationIdentity.business_name_source === 'og_site_name' ? 'Open Graph site name' : citationIdentity.business_name_source === 'page_title' ? 'live page title' : 'domain fallback'} for repeatable citation identity.`
                  : 'Business name falls back to the latest audited evidence first, then live page title, then domain label.'}
            </p>
            <div className="mt-3">
              <button
                onClick={handleAuthorityCheck}
                disabled={authorityLoading || !normalizedAuthorityTarget}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-white/28 to-white/14 text-white text-sm font-medium disabled:opacity-40"
              >
                {authorityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {authorityLoading ? 'Checking…' : 'Run Authority Check'}
              </button>
            </div>
          </>
        )}

        {authorityReport && (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card-charcoal rounded-xl p-3 border border-white/10"><p className="text-xs text-white/55 brand-dot-cyan">Authority Index</p><p className="text-xl font-bold text-white">{authorityReport.overall.authority_index}</p></div>
              <div className="card-charcoal rounded-xl p-3 border border-white/10"><p className="text-xs text-white/55 brand-dot-amber">Citations</p><p className="text-xl font-bold text-white">{authorityReport.overall.total_citations}</p></div>
              <div className="card-charcoal rounded-xl p-3 border border-white/10"><p className="text-xs text-white/55 brand-dot-violet">Backlinks</p><p className="text-xl font-bold text-white">{authorityReport.overall.total_backlinks}</p></div>
              <div className="card-charcoal rounded-xl p-3 border border-white/10"><p className="text-xs text-white/55 brand-dot-amber">Organic P/S</p><p className="text-xl font-bold text-white">{authorityReport.overall.organic_pain_solution_count}</p></div>
            </div>

            {(authorityReport.security || authorityReport.phishing_risk || authorityReport.compliance) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-xl bg-charcoal p-3 border border-white/10">
                  <p className="text-xs text-white/55 mb-1">Security Posture</p>
                  <p className="text-sm text-white/85">
                    HTTPS: {authorityReport.security?.https ? 'Yes' : 'No'}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Missing headers: {authorityReport.security?.missing_header_count || 0}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Hardening score: {authorityReport.security?.hardening_score ?? 0}/100
                  </p>
                </div>
                <div className="rounded-xl bg-charcoal p-3 border border-white/10">
                  <p className="text-xs text-white/55 mb-1">Phishing Risk</p>
                  <p className="text-sm text-white/85 capitalize">
                    {authorityReport.phishing_risk?.level || 'low'}
                  </p>
                  <p className="text-xs text-white/60 mt-1 line-clamp-2">
                    {(authorityReport.phishing_risk?.reasons || []).join(' • ') || 'No high-risk domain patterns detected.'}
                  </p>
                </div>
                <div className="rounded-xl bg-charcoal p-3 border border-white/10">
                  <p className="text-xs text-white/55 mb-1">Compliance Signals</p>
                  <p className="text-sm text-white/85 capitalize">
                    Niche: {authorityReport.compliance?.detected_niche || 'general'}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Missing required markers: {authorityReport.compliance?.missing_signals?.length || 0}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {authorityReport.platforms.map((platform) => (
                <div key={platform.platform} className="rounded-xl bg-charcoal p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-white">{platformLabel(platform.platform)}</h4>
                    <span className="text-xs text-white/70">Authority {platform.authority_score} • Citations {platform.citation_count} • Backlinks {platform.backlink_count}</span>
                  </div>
                  <div className="space-y-2">
                    {platform.items.slice(0, 5).map((item, index) => (
                      <div key={`${item.platform}-${index}`} className="rounded-lg bg-charcoal-light p-3 border border-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <a href={toSafeHref(item.source_url) || undefined} target="_blank" rel="noreferrer" className="text-xs text-white/85 hover:text-white truncate">#{item.rank} {item.title}</a>
                          <span className="brand-data-chip text-[10px] px-2 py-0.5 text-white/75">{natureLabel(item.content_nature)}</span>
                        </div>
                        <p className="text-xs text-white/60 mt-1 line-clamp-2">{item.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Brand Mention Tracker ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-white/28/20 to-white/14/20">
            <Globe className="w-5 h-5 text-white/85" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Brand Mention Tracker</h3>
            <p className="text-xs text-white/55">
              Scan Reddit, Hacker News, Mastodon, GitHub, Product Hunt, Quora, Google News, and search engine dorks for live brand mentions - no API keys required.
            </p>
          </div>
        </div>

        {!canTrackMentions ? (
          <div className="rounded-xl border border-white/10 bg-charcoal p-4 text-sm text-white/75">
            Upgrade to <strong className="text-white">Alignment</strong> or higher to track brand mentions across 9+ free public sources.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleMentionScan}
                disabled={mentionLoading || (!businessName.trim() && !citationIdentity?.business_name)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-white/28 to-white/14 text-white text-sm font-medium disabled:opacity-40"
              >
                {mentionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {mentionLoading ? 'Scanning…' : 'Scan for Mentions'}
              </button>
              {mentionResult && (
                <button
                  onClick={() => setMentionShowHistory(!mentionShowHistory)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 text-white/70 text-xs hover:text-white transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  {mentionShowHistory ? 'Hide history' : 'Show history'}
                </button>
              )}
            </div>

            {/* Scan results */}
            {mentionResult && (
              <div className="space-y-4">
                {/* ── KPI Dashboard ─────────────────────────────────────── */}
                {mentionKPI && (
                  <div className="rounded-xl border border-white/10 bg-charcoal p-4 space-y-4">
                    <p className="text-[10px] uppercase tracking-wide text-white/45">KPI Dashboard</p>

                    {/* 4 stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-center">
                        <p className="text-2xl font-bold text-white">{mentionKPI.volume}</p>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Total Mentions</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-center">
                        <p className={`text-2xl font-bold ${mentionKPI.net_sentiment_score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {mentionKPI.net_sentiment_score >= 0 ? '+' : ''}{mentionKPI.net_sentiment_score.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Net Sentiment</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-center">
                        <p className="text-2xl font-bold text-white">{mentionKPI.source_count}<span className="text-sm text-white/40">/17</span></p>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Sources Active</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-center">
                        <p className={`text-2xl font-bold ${mentionKPI.brand_health_score >= 65 ? 'text-emerald-400' : mentionKPI.brand_health_score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {Math.round(mentionKPI.brand_health_score)}
                        </p>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Brand Health</p>
                      </div>
                    </div>

                    {/* Sentiment breakdown bar */}
                    {mentionKPI.volume > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-white/45 mb-1">
                          <span>Positive {mentionKPI.positive_count} ({Math.round(mentionKPI.positive_count / mentionKPI.volume * 100)}%)</span>
                          <span>Neutral {mentionKPI.neutral_count}</span>
                          <span>Negative {mentionKPI.negative_count} ({Math.round(mentionKPI.negative_count / mentionKPI.volume * 100)}%)</span>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden gap-px">
                          {mentionKPI.positive_count > 0 && (
                            <div
                              className="bg-emerald-500 rounded-full"
                              style={{ flex: mentionKPI.positive_count }}
                              title={`Positive: ${mentionKPI.positive_count}`}
                            />
                          )}
                          {mentionKPI.neutral_count > 0 && (
                            <div
                              className="bg-white/30 rounded-full"
                              style={{ flex: mentionKPI.neutral_count }}
                              title={`Neutral: ${mentionKPI.neutral_count}`}
                            />
                          )}
                          {mentionKPI.negative_count > 0 && (
                            <div
                              className="bg-rose-500 rounded-full"
                              style={{ flex: mentionKPI.negative_count }}
                              title={`Negative: ${mentionKPI.negative_count}`}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Top sources */}
                    {mentionKPI.top_sources.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-white/45 mb-2">Top Sources</p>
                        <div className="space-y-1">
                          {mentionKPI.top_sources.map((s) => {
                            const pct = mentionKPI.volume > 0 ? Math.round((s.count / mentionKPI.volume) * 100) : 0;
                            return (
                              <div key={s.source} className="flex items-center gap-2">
                                <span className="text-[10px] text-white/60 w-24 shrink-0 capitalize">{s.source.replace('_', ' ')}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-white/40" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-white/50 w-8 text-right">{s.count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Source breakdown cards */}
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                  {mentionResult.sources_checked.map((src) => {
                    const count = mentionResult.mentions.filter(m => m.source === src).length;
                    return (
                      <div key={src} className="rounded-xl border border-white/10 bg-charcoal p-2.5 text-center">
                        <p className="text-lg font-bold text-white">{count}</p>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{src.replace('_', ' ')}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Timeline mini-bar */}
                {mentionTimeline && mentionTimeline.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-charcoal p-3">
                    <p className="text-[10px] uppercase tracking-wide text-white/45 mb-2">Mentions - Last 30 days</p>
                    <div className="flex items-end gap-[2px] h-12">
                      {mentionTimeline.map((pt) => {
                        const maxCount = Math.max(...mentionTimeline.map(p => p.count), 1);
                        const h = Math.max((pt.count / maxCount) * 100, 4);
                        return (
                          <div
                            key={pt.date}
                            className="flex-1 rounded-sm bg-white/20 hover:bg-white/40 transition-colors"
                            style={{ height: `${h}%` }}
                            title={`${pt.date}: ${pt.count}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent mentions list */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/45">
                    Recent mentions ({mentionResult.mentions.length} found)
                  </p>
                  {mentionResult.mentions.slice(0, 20).map((m, i) => (
                    <div key={`${m.source}-${i}`} className="rounded-lg bg-charcoal p-3 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 font-bold uppercase tracking-wider">
                          {m.source.replace('_', ' ')}
                        </span>
                        <a href={toSafeHref(m.url) || undefined} target="_blank" rel="noreferrer" className="text-xs text-white/85 hover:text-white truncate flex-1">
                          {m.title || m.url}
                        </a>
                      </div>
                      {m.snippet && <p className="text-xs text-white/55 line-clamp-2">{m.snippet}</p>}
                    </div>
                  ))}
                  {mentionResult.mentions.length > 20 && (
                    <p className="text-xs text-white/45 text-center">+ {mentionResult.mentions.length - 20} more</p>
                  )}
                </div>

                {/* Full history */}
                {mentionShowHistory && mentionHistory && (
                  <div className="space-y-2 mt-4">
                    <p className="text-[10px] uppercase tracking-wide text-white/45">All stored mentions ({mentionHistory.total} total)</p>
                    {mentionHistory.source_breakdown && mentionHistory.source_breakdown.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {mentionHistory.source_breakdown.map((sb: { source: string; count: number }) => (
                          <span key={sb.source} className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/65">
                            {sb.source.replace('_', ' ')}: {sb.count}
                          </span>
                        ))}
                      </div>
                    )}
                    {mentionHistory.mentions.slice(0, 50).map((m, i) => (
                      <div key={`hist-${m.id || i}`} className="rounded-lg bg-charcoal p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 font-bold uppercase tracking-wider">
                            {m.source.replace('_', ' ')}
                          </span>
                          <a href={toSafeHref(m.url) || undefined} target="_blank" rel="noreferrer" className="text-xs text-white/85 hover:text-white truncate flex-1">
                            {m.title || m.url}
                          </a>
                          <span className="text-[10px] text-white/40">{new Date(m.detected_at).toLocaleDateString()}</span>
                        </div>
                        {m.snippet && <p className="text-xs text-white/55 line-clamp-2">{m.snippet}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Authority + Entity Clarity Engine ─────────────────────────────── */}
      {canRunAuthorityCheck && entityClarityData && (
        <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-white/28/20 to-white/14/20">
              <Sparkles className="w-5 h-5 text-white/85" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Authority + Entity Clarity Engine</h3>
              <p className="text-xs text-white/55">
                How consistently AI models recognize, categorize, and describe your entity across queries.
              </p>
            </div>
          </div>

          {/* Score pair */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl border border-white/10 bg-charcoal p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest text-white/45 mb-1">Entity Clarity</p>
              <p className={`text-4xl font-bold tabular-nums ${entityClarityData.entity_clarity_score >= 70 ? 'text-emerald-400' : entityClarityData.entity_clarity_score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                {entityClarityData.entity_clarity_score}
              </p>
              <p className="text-[10px] text-white/40 mt-1">/ 100</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest text-white/45 mb-1">Authority Score</p>
              <p className={`text-4xl font-bold tabular-nums ${entityClarityData.authority_score >= 70 ? 'text-emerald-400' : entityClarityData.authority_score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                {entityClarityData.authority_score}
              </p>
              <p className="text-[10px] text-white/40 mt-1">/ 100</p>
            </div>
          </div>

          {/* Signal bars */}
          <div className="space-y-3 mb-5">
            {([
              { label: 'Recognition Rate', value: entityClarityData.recognition_rate, description: 'How often AI identifies your product by name' },
              { label: 'Category Consistency', value: entityClarityData.category_consistency, description: 'How consistently AI places you in the same category' },
              { label: 'Description Consistency', value: entityClarityData.description_consistency, description: 'How stable AI descriptions are across queries' },
              { label: 'Avg Confidence', value: entityClarityData.avg_confidence, description: 'How certain the model is when it describes you' },
            ] as Array<{ label: string; value: number; description: string }>).map((sig) => (
              <div key={sig.label}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-white/70 font-medium">{sig.label}</span>
                  <span className="text-xs tabular-nums text-white/85 font-semibold">{sig.value.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${sig.value >= 70 ? 'bg-emerald-500' : sig.value >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(sig.value, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/35 mt-0.5">{sig.description}</p>
              </div>
            ))}
          </div>

          {/* Dominant category */}
          {entityClarityData.all_categories.length > 0 && (
            <div className="mb-5 rounded-xl border border-white/10 bg-charcoal p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">How AI categorizes you</p>
              <div className="space-y-1.5">
                {entityClarityData.all_categories.map((cat) => {
                  const pct = entityClarityData.total_snapshots > 0
                    ? Math.round((cat.count / entityClarityData.total_snapshots) * 100)
                    : 0;
                  return (
                    <div key={cat.category} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-white/75 capitalize">{cat.category}</span>
                          <span className="text-[10px] tabular-nums text-white/50">{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-white/40" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description samples */}
          {entityClarityData.sample_descriptions.length > 0 && (
            <div className="mb-5 rounded-xl border border-white/10 bg-charcoal p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">How AI describes you (sample)</p>
              <div className="space-y-2">
                {entityClarityData.sample_descriptions.map((desc, i) => (
                  <div key={i} className="flex gap-2">
                    <Quote className="w-3 h-3 text-white/30 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-white/65 leading-relaxed italic">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {entityClarityData.insights.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-white/45">AI Diagnosis</p>
              {entityClarityData.insights.map((insight, i) => (
                <div key={i} className={`flex gap-2.5 rounded-lg border p-3 ${entityClarityData.entity_clarity_score >= 70 ? 'border-emerald-500/20 bg-emerald-500/8' : 'border-amber-500/20 bg-amber-500/8'}`}>
                  <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${entityClarityData.entity_clarity_score >= 70 ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <p className="text-xs text-white/75 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-white/35">
            Based on {entityClarityData.total_snapshots} AI response{entityClarityData.total_snapshots !== 1 ? 's' : ''} analyzed from this run.
            Entity extraction uses GPT-4o-mini structured output + deterministic domain validation.
          </p>
        </div>
      )}

      {/* ─── NER: Entity Co-mention Cloud ──────────────────────────────────── */}
      {canRunAuthorityCheck && nerData && nerData.entities.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-white/28/20 to-white/14/20">
              <Layers className="w-5 h-5 text-white/85" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Named Entity Co-mention Map</h3>
              <p className="text-xs text-white/55">
                Every ORG, product, person and location AI mentions in the same responses as your brand.
              </p>
            </div>
          </div>

          {/* Summary stat row */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {([
              { label: 'Total Entities', value: nerData.total_unique_entities },
              { label: 'Orgs', value: nerData.org_count },
              { label: 'Products', value: nerData.product_count },
              { label: 'Co-mentioned', value: nerData.co_mentioned_count },
            ] as Array<{ label: string; value: number }>).map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-charcoal p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-white/90">{s.value}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/45 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Entity list grouped by type */}
          {(['ORG', 'PRODUCT', 'PERSON', 'LOCATION'] as Array<'ORG' | 'PRODUCT' | 'PERSON' | 'LOCATION' | 'BRAND'>).map((type) => {
            const group = nerData.entities.filter((e) => e.type === type && !e.is_target_brand);
            if (group.length === 0) return null;
            const typeLabel: Record<string, string> = {
              ORG: 'Organizations', PRODUCT: 'Products & Brands',
              PERSON: 'People', LOCATION: 'Locations',
            };
            const typeBadge: Record<string, string> = {
              ORG: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
              PRODUCT: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
              PERSON: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
              LOCATION: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
            };
            return (
              <div key={type} className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{typeLabel[type]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.slice(0, 20).map((e) => (
                    <span
                      key={e.text}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${typeBadge[type]}`}
                    >
                      {e.text}
                      <span className="opacity-60 text-[10px]">×{e.total_count}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Your brand row if present */}
          {nerData.entities.filter((e) => e.is_target_brand).length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/8">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Your Brand</p>
              <div className="flex flex-wrap gap-1.5">
                {nerData.entities.filter((e) => e.is_target_brand).map((e) => (
                  <span
                    key={e.text}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/25 bg-white/10 text-xs font-semibold text-white"
                  >
                    {e.text}
                    <span className="opacity-60 text-[10px]">×{e.total_count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-white/35 mt-4">
            Extracted from {nerData.total_unique_entities} unique entity tokens across all AI model responses.
            No API cost — pure pattern-based extraction.
          </p>
        </div>
      )}

      {/* ─── AI Competitor Pressure Engine ──────────────────────────────────── */}
      {canRunAuthorityCheck && (
        <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-white/28/20 to-white/14/20">
              <TrendingUp className="w-5 h-5 text-white/85" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Competitor Pressure Engine</h3>
              <p className="text-xs text-white/55">
                Discovers who AI trusts instead of you — extracted from real query outputs, not SERP rankings.
              </p>
            </div>
          </div>

          {!competitorLoading && !competitorData && (
            <div className="mb-4 rounded-xl border border-white/10 bg-charcoal p-4 text-xs text-white/55">
              <p className="mb-3 leading-relaxed">
                Enter realistic queries your buyers use. The engine runs each through AI models, extracts all cited domains from the responses, scores them by mention frequency + citation rate, and surfaces the domains that are replacing you in AI answers.
              </p>
              <textarea
                value={competitorQueries}
                onChange={(e) => setCompetitorQueries(e.target.value)}
                placeholder={"best AI visibility tools\nwho should I use for AI SEO\nalternatives to manual schema markup\nhow to rank in ChatGPT answers\n..."}
                rows={5}
                disabled={competitorLoading}
                className="field-vivid w-full px-4 py-3 rounded-xl border border-white/10 bg-charcoal-deep text-white text-xs placeholder-white/30 resize-none disabled:opacity-40"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-white/40">
                  {competitorQueries.split('\n').filter((s) => s.trim()).length}/50 queries
                </span>
                <button
                  onClick={handleDiscoverCompetitors}
                  disabled={competitorLoading || !competitorQueries.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-white/28 to-white/14 text-white text-sm font-medium disabled:opacity-40"
                >
                  <TrendingUp className="w-4 h-4" />
                  Discover Competitors
                </button>
              </div>
            </div>
          )}

          {competitorLoading && (
            <div className="mb-4 rounded-xl border border-white/10 bg-charcoal p-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white/60" />
                <p className="text-xs text-white/75">
                  Running {competitorTotal} queries across AI models — extracting domain signals…
                </p>
              </div>
              <div className="w-full bg-charcoal-deep rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-white/80 rounded-full transition-all duration-500"
                  style={{ width: `${competitorProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-white/40 mt-1">{competitorProgress}% complete</p>
            </div>
          )}

          {competitorData && competitorData.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-charcoal p-4">
              <p className="text-xs text-white/55">
                No significant competitors detected in this query set. Try broader or more commercial queries to surface domain competition.
              </p>
              <button
                onClick={() => { setCompetitorData(null); setEntityClarityData(null); setCompetitorRunId(null); setCompetitorStatus(null); }}
                className="mt-3 text-xs text-white/60 hover:text-white/80 underline"
              >
                Try different queries
              </button>
            </div>
          )}

          {competitorData && competitorData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-white/80 flex-shrink-0" />
                  <p className="text-sm font-semibold text-white">You are losing to these domains:</p>
                </div>
                <button
                  onClick={() => { setCompetitorData(null); setEntityClarityData(null); setCompetitorRunId(null); setCompetitorStatus(null); setCompetitorQueries(''); }}
                  className="text-xs text-white/45 hover:text-white/70 transition-colors"
                >
                  Run again
                </button>
              </div>

              <div className="space-y-2">
                {competitorData.map((comp) => {
                  const voiceShare = competitorTotal > 0 ? Math.round((comp.mentions / competitorTotal) * 100) : 0;
                  const citationRate = comp.mentions > 0 ? Math.round((comp.citations / comp.mentions) * 100) : 0;
                  return (
                    <div key={comp.domain} className="rounded-xl border border-white/10 bg-charcoal p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{comp.domain}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/55">
                            <span>
                              appears in <span className="text-white/85 font-medium">{comp.mentions}</span>/{competitorTotal} queries
                            </span>
                            <span>
                              citation rate <span className="text-white/85 font-medium">{citationRate}%</span>
                            </span>
                            {comp.avg_position != null && (
                              <span>
                                avg position <span className="text-white/85 font-medium">#{Number(comp.avg_position).toFixed(1)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xl font-bold text-white">{voiceShare}%</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-wide">voice share</p>
                        </div>
                      </div>
                      <div className="mt-3 w-full bg-charcoal-deep rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-white/30 rounded-full"
                          style={{ width: `${Math.min(voiceShare * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-white/10 bg-charcoal p-4">
                <p className="text-xs font-semibold text-white/80 mb-1">Fix to beat them</p>
                <p className="text-xs text-white/55 leading-relaxed mb-3">
                  These competitors win because of stronger schema, consistent citations, and higher answer-engine presence. Run a ScoreFix to build a targeted action plan that closes the gap.
                </p>
                <a
                  href="/scorefix"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-white/28 to-white/14 text-white text-xs font-medium"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Go to ScoreFix
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="brand-bar-top rounded-2xl border border-white/10 bg-charcoal-deep p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-white/28/20 to-white/14/20">
            <Eye className="w-5 h-5 text-white/85" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Citation Tracker</h3>
            <p className="text-xs text-white/55">
              Generate enterprise query packs from audited entities, then test where your product, service, and quoteable proof appear in live AI answer simulations.
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VISIBILITY_OUTCOMES.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-charcoal p-3">
              <p className="text-xs font-semibold text-white/85">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-white/60">{item.detail}</p>
            </div>
          ))}
        </div>

        {/* Methodology Transparency */}
        <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-500/8 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80 mb-1.5">How citation testing works</p>
          <div className="space-y-1.5 text-xs text-white/65 leading-relaxed">
            <p>
              <span className="text-white/80 font-medium">AI platform simulation</span> - Each query is routed through proxy LLMs (via OpenRouter) configured to mimic ChatGPT, Perplexity, Claude, and Google AI response patterns. These are behavioral simulations, not direct API calls to those platforms.
            </p>
            <p>
              <span className="text-white/80 font-medium">Web search verification</span> - Brand presence is cross-checked against real search results using DuckDuckGo HTML, Bing, Brave, Yahoo, DuckDuckGo Instant, and locale-aware Wikipedia for ground-truth validation.
            </p>
            <p>
              <span className="text-white/80 font-medium">Google Gemini direct</span> - When available, Google AI tests use the Gemini API directly for higher-fidelity results.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Query Count</span>
            <select
              value={queryCount}
              onChange={(e) => setQueryCount(Number(e.target.value))}
              className="field-vivid px-2 py-1.5 border border-white/10 rounded-lg text-xs text-white"
              disabled={generatingQueries || loading || !canRunCitationTests}
            >
              {[20, 30, 50, 75].map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerateQueries}
            disabled={generatingQueries || loading || !canRunCitationTests}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal/20 hover:bg-charcoal/30 text-white/85 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generatingQueries ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Test Queries
              </>
            )}
          </button>

            {!canRunCitationTests && (
              <span className="text-xs text-white/60">Alignment unlocks the live authority engine. Signal unlocks AI query generation and full multi-platform citation test runs.</span>
            )}

          {canRunCitationTests && (
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_TEST_PLATFORMS.map((platform) => {
                const active = selectedPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    type="button"
                    className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                      active
                        ? "bg-charcoal/20 border-white/12 text-white/85"
                        : "card-charcoal border-white/10 text-white/55 hover:text-white/80"
                    }`}
                  >
                    {PLATFORM_CONFIG[platform].name}
                  </button>
                );
              })}
            </div>
          )}

          {selectedQueries.length > 0 && (
            <button
              onClick={handleStartTest}
              disabled={loading || selectedPlatforms.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-white/28 to-white/14 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Test ({selectedQueries.length} queries)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-white/10 bg-charcoal p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-white/80 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white/80 mb-1">Error</p>
              <p className="text-xs text-white/55">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Query Selection */}
      {queries.length > 0 && !testResults && (
        <div className="brand-bar-top rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h4 className="text-sm font-semibold text-white">
              Select Queries to Test ({selectedQueries.length} selected)
            </h4>
            <div className="flex items-center gap-2">
              <button onClick={() => selectTopQueries(10)} className="text-xs px-2.5 py-1.5 rounded-md bg-charcoal border border-white/10 text-white/80" type="button">Top 10</button>
              <button onClick={() => selectTopQueries(20)} className="text-xs px-2.5 py-1.5 rounded-md bg-charcoal border border-white/10 text-white/80" type="button">Top 20</button>
              <button onClick={() => setSelectedQueries(queries)} className="text-xs px-2.5 py-1.5 rounded-md bg-charcoal border border-white/10 text-white/80" type="button">All</button>
              <button onClick={() => setSelectedQueries([])} className="text-xs px-2.5 py-1.5 rounded-md bg-charcoal border border-white/10 text-white/80" type="button">Clear</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {queries.map((query, i) => (
              <button
                key={i}
                onClick={() => toggleQuery(query)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedQueries.includes(query)
                    ? "border-white/12 bg-charcoal/10"
                    : "border-white/10 card-charcoal hover:border-white/10"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedQueries.includes(query)}
                    readOnly
                    className="mt-0.5 flex-shrink-0"
                  />
                  <span className="text-xs text-white/75">{query}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Test Status */}
      {loading && testStatus && testStatus !== 'completed' && (
        <div className="rounded-xl border border-white/12/30 bg-charcoal/5 p-6 text-center">
          <img src="/aivis-progress-spinner.png" alt="" className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/85 font-medium">
            Testing {selectedQueries.length} queries across {selectedPlatforms.length} AI platform{selectedPlatforms.length === 1 ? '' : 's'}...
          </p>
          <p className="text-xs text-white/60 mt-1">This may take a few minutes</p>
        </div>
      )}

      {/* Summary Stats */}
      {testSummary && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              onClick={() => setEvidencePanelOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-charcoal hover:border-white/20 text-xs text-white/80 hover:text-white/85 transition-colors"
              type="button"
              title="Review high-confidence mentions for curation"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Review Evidence
            </button>
            <button
              onClick={() => setQueryPackManagerOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-charcoal hover:border-white/20 text-xs text-white/80 hover:text-white/85 transition-colors"
              type="button"
              title="Save or load reusable query packs"
            >
              <History className="w-3.5 h-3.5" />
              Query Packs
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-charcoal text-xs text-white/80"
              type="button"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={copySummary}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-charcoal text-xs text-white/80"
              type="button"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Summary
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <p className="text-xs text-white/55 mb-1">Queries Tested</p>
            <p className="text-2xl font-bold text-white">{testSummary.total_queries}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <p className="text-xs text-white/55 mb-1">Mention Rate</p>
            <p className="text-2xl font-bold text-white/80">{testSummary.mention_rate}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <p className="text-xs text-white/55 mb-1">Avg Position</p>
            <p className="text-2xl font-bold text-white/85">#{testSummary.avg_position.toFixed(1)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <p className="text-xs text-white/55 mb-1">Platforms</p>
            <div className="flex gap-1 mt-2">
              {Object.entries(testSummary.platforms).map(([platform, count]) => (
                <span key={platform} className="brand-data-chip text-xs px-2 py-0.5 text-white/75">
                  {platform}: {count as number}
                </span>
              ))}
            </div>
          </div>
          </div>
          {(testSummary.web_search_found_rate != null || testSummary.web_search_avg_position != null) && (
            <div className="rounded-xl border border-cyan-500/20 bg-charcoal-deep p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <p className="text-xs text-cyan-400/80 font-semibold uppercase tracking-wide">DuckDuckGo Web</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold uppercase tracking-wider">Free</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/55 mb-1">Found Rate</p>
                  <p className="text-xl font-bold text-cyan-300">{testSummary.web_search_found_rate}%</p>
                </div>
                {testSummary.web_search_avg_position > 0 && (
                  <div>
                    <p className="text-xs text-white/55 mb-1">Avg Search Position</p>
                    <p className="text-xl font-bold text-cyan-300">#{testSummary.web_search_avg_position.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {(testSummary.bing_found_rate != null || testSummary.bing_avg_position != null) && (
            <div className="rounded-xl border border-blue-500/20 bg-charcoal-deep p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-xs text-blue-400/80 font-semibold uppercase tracking-wide">Bing</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold uppercase tracking-wider">Free</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/55 mb-1">Found Rate</p>
                  <p className="text-xl font-bold text-blue-300">{testSummary.bing_found_rate}%</p>
                </div>
                {testSummary.bing_avg_position > 0 && (
                  <div>
                    <p className="text-xs text-white/55 mb-1">Avg Search Position</p>
                    <p className="text-xl font-bold text-blue-300">#{testSummary.bing_avg_position.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {(testSummary.ddg_found_rate != null || testSummary.ddg_avg_position != null) && (
            <div className="rounded-xl border border-emerald-500/20 bg-charcoal-deep p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-xs text-emerald-400/80 font-semibold uppercase tracking-wide">DuckDuckGo Instant</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">Free</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/55 mb-1">Found Rate</p>
                  <p className="text-xl font-bold text-emerald-300">{testSummary.ddg_found_rate}%</p>
                </div>
                {testSummary.ddg_avg_position > 0 && (
                  <div>
                    <p className="text-xs text-white/55 mb-1">Avg Position</p>
                    <p className="text-xl font-bold text-emerald-300">#{testSummary.ddg_avg_position.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {(testSummary.brave_found_rate != null || testSummary.brave_avg_position != null) && (
            <div className="rounded-xl border border-orange-500/20 bg-charcoal-deep p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-3.5 h-3.5 text-orange-400" />
                <p className="text-xs text-orange-400/80 font-semibold uppercase tracking-wide">Brave</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold uppercase tracking-wider">Free</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/55 mb-1">Found Rate</p>
                  <p className="text-xl font-bold text-orange-300">{testSummary.brave_found_rate}%</p>
                </div>
                {testSummary.brave_avg_position > 0 && (
                  <div>
                    <p className="text-xs text-white/55 mb-1">Avg Position</p>
                    <p className="text-xl font-bold text-orange-300">#{testSummary.brave_avg_position.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {(testSummary.yahoo_found_rate != null || testSummary.yahoo_avg_position != null) && (
            <div className="rounded-xl border border-fuchsia-500/20 bg-charcoal-deep p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-3.5 h-3.5 text-fuchsia-400" />
                <p className="text-xs text-fuchsia-400/80 font-semibold uppercase tracking-wide">Yahoo</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 font-bold uppercase tracking-wider">Free</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/55 mb-1">Found Rate</p>
                  <p className="text-xl font-bold text-fuchsia-300">{testSummary.yahoo_found_rate}%</p>
                </div>
                {testSummary.yahoo_avg_position > 0 && (
                  <div>
                    <p className="text-xs text-white/55 mb-1">Avg Position</p>
                    <p className="text-xl font-bold text-fuchsia-300">#{testSummary.yahoo_avg_position.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {queryDiagnostics.length > 0 && (
        <div className="brand-bar-top rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h4 className="text-sm font-semibold text-white mb-3">Why You Were Not Cited (Diagnostics)</h4>
          <div className="space-y-2">
            {queryDiagnostics.slice(0, 8).map((item) => (
              <div key={`diag-${item.query}`} className="card-charcoal rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-white truncate">{item.query}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    item.priority === 'high' ? 'bg-charcoal text-white/80' :
                    item.priority === 'medium' ? 'bg-charcoal/20 text-white/85' : 'bg-charcoal text-white/70'
                  }`}>
                    {item.priority.toUpperCase()}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {item.reasons.slice(0, 2).map((reason, index) => (
                    <li key={`${item.query}-reason-${index}`} className="text-xs text-white/65">• {reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {groupedResults.length > 0 && (
        <div className="space-y-3">
          {groupedResults.map((group, i) => (
            <QueryResults key={i} query={group.query} results={group.results} webSearch={webSearchByQuery?.[group.query]} bingSearch={bingSearchByQuery?.[group.query]} ddgSearch={ddgSearchByQuery?.[group.query]} braveSearch={braveSearchByQuery?.[group.query]} wikipediaSearch={wikipediaSearchByQuery?.[group.query]} yahooSearch={yahooSearchByQuery?.[group.query]} />
          ))}
        </div>
      )}

      {/* Evidence Review Panel Modal */}
      <EvidenceReviewPanel
        testId={testId || ''}
        isOpen={evidencePanelOpen}
        onClose={() => setEvidencePanelOpen(false)}
      />

      {/* Query Pack Manager Modal */}
      <QueryPackManager
        isOpen={queryPackManagerOpen}
        onClose={() => setQueryPackManagerOpen(false)}
        currentQueries={selectedQueries}
        url={url}
        defaultClientName={businessName || citationIdentity?.business_name || ''}
        onPackSelected={(queries) => {
          setSelectedQueries(queries);
          setQueryPackManagerOpen(false);
          toast.success(`${queries.length} queries loaded`);
        }}
        onPackExecuted={(newTestId) => {
          setTestId(newTestId);
          setTestStatus('pending');
          setTestResults(null);
          setTestSummary(null);
          setWebSearchByQuery(null);
          setBingSearchByQuery(null);
          setDdgSearchByQuery(null);
          setBraveSearchByQuery(null);
          setWikipediaSearchByQuery(null);
          setLoading(true);
        }}
      />
    </div>
  );
}
