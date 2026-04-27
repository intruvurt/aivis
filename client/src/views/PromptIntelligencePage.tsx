import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  Globe,
  ListChecks,
  Loader2,
  Search,
  Sparkles,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import { meetsMinimumTier } from '@shared/types';
import { useAuthStore } from '../stores/authStore';
import { useAnalysisStore } from '../stores/analysisStore';
import { usePageMeta } from '../hooks/usePageMeta';
import UpgradeWall from '../components/UpgradeWall';
import PlatformProofLoopCard from '../components/PlatformProofLoopCard';
import PageQASection from '../components/PageQASection';
import { normalizePublicUrlInput } from '../utils/targetKey';
import apiFetch from '../utils/api';
import { API_URL } from '../config';
import { buildFaqSchema, buildWebPageSchema } from '../lib/seoSchema';

interface PromptMappingHint {
  prompt: string;
  intent: string;
  recommended_block: string;
  recommended_schema: string;
  reason: string;
}

interface PromptCoverageDiagnostics {
  coverage_score: number;
  reasons: string[];
  strengths: string[];
  content_gaps: string[];
}

interface PromptAnswerPack {
  definition_block: string;
  steps: string[];
  faq: Array<{ question: string; answer: string }>;
  schema: Record<string, unknown>;
  implementation_notes: string[];
  confidence: number;
}

function normalizePromptValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const PROMPT_INTELLIGENCE_FAQ = [
  {
    question: 'What is Prompt Intelligence?',
    answer:
      'Prompt Intelligence tests how AI models respond to different query phrasings about your brand. It maps which prompt types trigger inclusion, exclusion, or competitor displacement in AI-generated answers.',
  },
  {
    question: 'Which AI platforms are analyzed?',
    answer:
      'Prompt Intelligence runs query variants across ChatGPT, Perplexity, Claude, and Google AI to map cross-platform prompt patterns and brand mention rates.',
  },
  {
    question: 'What tier do I need to access Prompt Intelligence?',
    answer:
      'Prompt Intelligence is available on the Alignment plan and above. It generates realistic prompt variants from your page content and runs them across AI platforms to detect coverage gaps.',
  },
  {
    question: 'How do I close prompt coverage gaps?',
    answer:
      'Review the query types where your brand is absent or displaced, then build content that addresses those intent patterns through answer-ready definitions, step blocks, and FAQ schema.',
  },
];

export default function PromptIntelligencePage() {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: 'Prompt Intelligence - AI Query Analysis',
    description:
      'Understand how AI models interpret queries about your brand. Map prompt patterns to inclusion, exclusion, and competitor displacement outcomes.',
    path: '/prompt-intelligence',
    structuredData: [
      buildWebPageSchema({
        path: '/prompt-intelligence',
        name: 'Prompt Intelligence — AI Query Pattern Analysis | AiVIS.biz',
        description:
          'Test how AI models respond to different query phrasings about your brand. Map prompt variant patterns to citation inclusion, exclusion, and competitor displacement outcomes.',
      }),
      buildFaqSchema(PROMPT_INTELLIGENCE_FAQ, { path: '/prompt-intelligence' }),
    ],
  });

  React.useEffect(() => {
    if (!isAuthenticated) navigate('/auth?mode=signin');
  }, [isAuthenticated, navigate]);

  const userTier = (user?.tier as any) || 'observer';
  const hasAccess = meetsMinimumTier(userTier, 'alignment');

  const [urlInput, setUrlInput] = useState(latestResult?.url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [promptMapping, setPromptMapping] = useState<PromptMappingHint[]>([]);
  const [coverageDiagnostics, setCoverageDiagnostics] = useState<PromptCoverageDiagnostics | null>(
    null
  );
  const [identity, setIdentity] = useState<{ business_name?: string } | null>(null);
  const [promptLedger, setPromptLedger] = useState<Array<{ query?: string; mentioned?: boolean }>>(
    []
  );

  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [generatingPack, setGeneratingPack] = useState(false);
  const [answerPack, setAnswerPack] = useState<PromptAnswerPack | null>(null);

  const handleAnalyze = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      const normalized = normalizePublicUrlInput(urlInput.trim());
      if (!normalized || !token) return;

      setLoading(true);
      setError(null);
      setAnswerPack(null);
      try {
        const response = await apiFetch(`${API_URL}/api/citations/generate-queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: normalized }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate prompt variants');
        }

        const data = await response.json();
        const queries = Array.isArray(data.queries) ? data.queries : [];
        const mapping = Array.isArray(data.prompt_mapping) ? data.prompt_mapping : [];

        setQueryResults(queries);
        setPromptMapping(mapping);
        setCoverageDiagnostics(data.coverage_diagnostics || null);
        setIdentity(data.identity || null);
        setIsFallback(data.fallback === true);

        const firstPrompt =
          (mapping[0] && typeof mapping[0].prompt === 'string' ? mapping[0].prompt : '') ||
          (typeof queries[0] === 'string'
            ? queries[0]
            : queries[0]?.query || queries[0]?.text || '');
        setSelectedPrompt(typeof firstPrompt === 'string' ? firstPrompt : '');

        if (meetsMinimumTier(userTier, 'signal')) {
          const ledgerResponse = await apiFetch(
            `${API_URL}/api/citations/prompt-ledger?url=${encodeURIComponent(normalized)}&limit=200`,
            { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
          );
          if (ledgerResponse.ok) {
            const ledgerPayload = await ledgerResponse.json().catch(() => null);
            setPromptLedger(Array.isArray(ledgerPayload?.prompts) ? ledgerPayload.prompts : []);
          } else {
            setPromptLedger([]);
          }
        } else {
          setPromptLedger([]);
        }
      } catch (err: any) {
        setError(err?.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [urlInput, token, userTier]
  );

  const visiblePrompts = useMemo(() => {
    if (!Array.isArray(queryResults)) return [] as string[];
    return queryResults
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.query === 'string') return item.query;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .filter(Boolean)
      .slice(0, 12);
  }, [queryResults]);

  const ledgerState = useMemo(() => {
    const map = new Map<string, 'appearing' | 'missing'>();
    for (const entry of promptLedger) {
      const key = normalizePromptValue(String(entry.query || ''));
      if (!key) continue;
      const next = entry.mentioned ? 'appearing' : 'missing';
      const prev = map.get(key);
      if (prev === 'appearing') continue;
      map.set(key, next);
    }
    return map;
  }, [promptLedger]);

  const coverageSummary = useMemo(() => {
    let appearing = 0;
    let missing = 0;
    let untested = 0;

    for (const prompt of visiblePrompts) {
      const state = ledgerState.get(normalizePromptValue(prompt));
      if (state === 'appearing') appearing += 1;
      else if (state === 'missing') missing += 1;
      else untested += 1;
    }

    return {
      total: visiblePrompts.length,
      appearing,
      missing,
      untested,
    };
  }, [visiblePrompts, ledgerState]);

  const handleGenerateAnswerPack = useCallback(async () => {
    const normalized = normalizePublicUrlInput(urlInput.trim());
    if (!normalized || !token || !selectedPrompt) return;

    const selectedMapping = promptMapping.find((row) => row.prompt === selectedPrompt);

    setGeneratingPack(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/content/prompt-answer-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: normalized,
          prompt: selectedPrompt,
          intent: selectedMapping?.intent || 'informational',
          recommended_block: selectedMapping?.recommended_block || 'definition',
          recommended_schema: selectedMapping?.recommended_schema || 'FAQPage',
          brand_name: identity?.business_name || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate answer-ready content');
      }

      const payload = await response.json();
      setAnswerPack(payload?.pack || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate answer-ready content');
    } finally {
      setGeneratingPack(false);
    }
  }, [urlInput, token, selectedPrompt, promptMapping, identity]);

  if (!hasAccess) {
    return (
      <div className="py-16">
        <h1 className="text-2xl font-semibold text-white mb-4">Prompt Intelligence</h1>
        <p className="text-white/60 text-lg mb-8 max-w-2xl">
          Understand how AI models interpret questions about your brand. See which query phrasings
          trigger mentions, which get skipped, and which hand the answer to competitors.
        </p>
        <UpgradeWall
          feature="Prompt Intelligence"
          description="Map AI query patterns to brand inclusion outcomes."
          requiredTier="alignment"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-semibold text-white">Prompt Intelligence</h1>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-300 text-[10px] font-bold uppercase tracking-widest">
            Alignment+
          </span>
        </div>
        <p className="text-white/50 text-sm mb-8 max-w-2xl">
          What people ask AI and why you do not show up. Map gaps, generate fixes, and improve
          citation probability.
        </p>

        <form onSubmit={handleAnalyze} className="mb-8">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                enterKeyHint="go"
                placeholder="Enter URL to analyze prompt patterns..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-white/30 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/25 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 text-white font-semibold hover:from-amber-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              Analyze Prompt Coverage
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {queryResults && queryResults.length > 0 && (
          <div className="space-y-6">
            {isFallback && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                AI query generation is temporarily unavailable, so template prompts are shown.
              </div>
            )}

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-amber-400" />
                1. Prompts You Should Appear In
              </h2>
              <div className="space-y-2">
                {visiblePrompts.map((prompt, index) => {
                  const status = ledgerState.get(normalizePromptValue(prompt));
                  return (
                    <div
                      key={`${prompt}-${index}`}
                      className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-white">{prompt}</p>
                        {status === 'appearing' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Appearing
                          </span>
                        ) : status === 'missing' ? (
                          <span className="inline-flex items-center gap-1 text-rose-300 text-xs font-semibold">
                            <XCircle className="w-4 h-4" /> Missing
                          </span>
                        ) : (
                          <span className="text-white/40 text-xs font-semibold">
                            Not yet verified
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                2. Why You Are Not Appearing
              </h2>
              <div className="space-y-2">
                {(coverageDiagnostics?.reasons || []).map((reason, idx) => (
                  <div
                    key={`reason-${idx}`}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200"
                  >
                    {reason}
                  </div>
                ))}
                {!coverageDiagnostics?.reasons?.length && (
                  <p className="text-sm text-white/50">Analyze a URL to get exclusion reasons.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                3. Prompt → Content Mapping
              </h2>
              <div className="space-y-2">
                {promptMapping.slice(0, 10).map((row, idx) => (
                  <div
                    key={`${row.prompt}-${idx}`}
                    className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"
                  >
                    <p className="text-sm font-medium text-white">{row.prompt}</p>
                    <p className="mt-1 text-xs text-white/50">
                      Intent: {row.intent} · Block: {row.recommended_block} · Schema:{' '}
                      {row.recommended_schema}
                    </p>
                    <p className="mt-1 text-xs text-emerald-300/90">{row.reason}</p>
                  </div>
                ))}
                {!promptMapping.length && (
                  <p className="text-sm text-white/50">Prompt mapping appears after analysis.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <WandSparkles className="w-5 h-5 text-amber-400" />
                4. Generate Answer-Ready Content
              </h2>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <select
                  value={selectedPrompt}
                  onChange={(e) => setSelectedPrompt(e.target.value)}
                  aria-label="Select prompt for answer-ready content generation"
                  title="Select prompt for answer-ready content generation"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-amber-400"
                >
                  <option value="">Select a prompt</option>
                  {promptMapping.map((row) => (
                    <option key={row.prompt} value={row.prompt}>
                      {row.prompt}
                    </option>
                  ))}
                  {promptMapping.length === 0 &&
                    visiblePrompts.map((prompt) => (
                      <option key={prompt} value={prompt}>
                        {prompt}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleGenerateAnswerPack}
                  disabled={generatingPack || !selectedPrompt}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 text-white font-semibold hover:from-amber-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
                >
                  {generatingPack ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <WandSparkles className="w-4 h-4" />
                  )}
                  Fix My Prompt Coverage
                </button>
              </div>

              {answerPack && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                    <p className="text-xs uppercase tracking-wider text-emerald-300">
                      Definition Block
                    </p>
                    <p className="mt-1 text-sm text-white">{answerPack.definition_block}</p>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wider text-white/60">Steps</p>
                    <div className="mt-2 space-y-1">
                      {answerPack.steps.map((step, idx) => (
                        <p key={`step-${idx}`} className="text-sm text-white/85">
                          {idx + 1}. {step}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wider text-white/60">FAQ + Schema</p>
                    <div className="mt-2 space-y-2">
                      {answerPack.faq.map((item, idx) => (
                        <div key={`faq-${idx}`}>
                          <p className="text-sm text-white font-medium">Q: {item.question}</p>
                          <p className="text-sm text-white/75">A: {item.answer}</p>
                        </div>
                      ))}
                    </div>
                    <pre className="mt-3 text-xs text-emerald-200 bg-black/30 border border-white/10 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(answerPack.schema, null, 2)}
                    </pre>
                  </div>

                  <p className="text-xs text-white/50">
                    Generation confidence: {answerPack.confidence}%
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-400" />
                5. Prompt Coverage Score
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                  <p className="text-xs text-white/50">Coverage Score</p>
                  <p className="text-2xl font-bold text-amber-300">
                    {coverageDiagnostics?.coverage_score ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                  <p className="text-xs text-white/50">Appearing</p>
                  <p className="text-2xl font-bold text-emerald-300">{coverageSummary.appearing}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                  <p className="text-xs text-white/50">Missing</p>
                  <p className="text-2xl font-bold text-rose-300">{coverageSummary.missing}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                  <p className="text-xs text-white/50">Untested</p>
                  <p className="text-2xl font-bold text-white">{coverageSummary.untested}</p>
                </div>
              </div>

              {!!coverageDiagnostics?.content_gaps?.length && (
                <div className="mt-4 space-y-2">
                  {coverageDiagnostics.content_gaps.map((gap, idx) => (
                    <p key={`gap-${idx}`} className="text-sm text-white/70">
                      • {gap}
                    </p>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {!queryResults && !loading && (
          <div className="text-center py-16">
            <Brain className="w-12 h-12 text-amber-400/40 mx-auto mb-4" />
            <h3 className="text-white/70 text-lg font-semibold mb-2">
              Enter a URL to map prompt blind spots
            </h3>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              The engine will generate prompt variants, diagnose why you miss citations, and map
              each prompt to a concrete content fix path.
            </p>
          </div>
        )}

        <div className="mt-10">
          <PlatformProofLoopCard />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/app/citations"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-300 text-sm font-medium hover:bg-amber-500/20 transition"
          >
            <Eye className="w-4 h-4" /> Citation Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/app/answer-presence"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition"
          >
            <Globe className="w-4 h-4" /> Answer Presence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/app/brand-integrity"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition"
          >
            <CheckCircle2 className="w-4 h-4" /> Brand Integrity{' '}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <PageQASection
        items={PROMPT_INTELLIGENCE_FAQ}
        heading="Understanding prompt intelligence for AI visibility"
        className="mt-6"
      />
    </div>
  );
}
