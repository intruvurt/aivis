import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  FileSearch,
  Gauge,
  Globe,
  Link2,
  ListChecks,
  Loader2,
  Search,
  Sparkles,
  WandSparkles,
  Workflow,
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
import { COMPETITOR_PROMPT_MAP } from '../content/competitorPromptMap';

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

interface PromptIntelligenceReport {
  mode: 'fast' | 'deep';
  summary: string;
  intent_decomposition: string[];
  output_structure_analysis: string[];
  citation_likelihood_signals: {
    score: number;
    positives: string[];
    risks: string[];
  };
  pattern_signature_extraction: string[];
  prompt_output_causality: string[];
  optimized_prompt_rewrite: string;
  content_blueprint_generation: {
    opening_block: string;
    sections: string[];
    faq: Array<{ question: string; answer: string }>;
    schema_targets: string[];
    evidence_requirements: string[];
  };
  action_graph: Array<{
    action: string;
    owner: 'content' | 'schema' | 'technical';
    impact: 'high' | 'medium' | 'low';
  }>;
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
  const [answerSample, setAnswerSample] = useState('');
  const [runningFastPass, setRunningFastPass] = useState(false);
  const [runningDeepPass, setRunningDeepPass] = useState(false);
  const [promptReport, setPromptReport] = useState<PromptIntelligenceReport | null>(null);

  const handleAnalyze = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      const normalized = normalizePublicUrlInput(urlInput.trim());
      if (!normalized || !token) return;

      setLoading(true);
      setError(null);
      setAnswerPack(null);
      setPromptReport(null);
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

  const handleRunPromptExtraction = useCallback(
    async (mode: 'fast' | 'deep') => {
      const normalized = normalizePublicUrlInput(urlInput.trim());
      if (!normalized || !token) return;

      const activePrompt =
        selectedPrompt ||
        promptMapping[0]?.prompt ||
        visiblePrompts[0] ||
        (typeof queryResults?.[0] === 'string' ? queryResults[0] : '');

      if (!activePrompt) {
        setError('Run prompt analysis first so the extraction engine has a prompt target.');
        return;
      }

      if (mode === 'deep' && !promptReport) {
        setError('Run fast pass first before deep optimization.');
        return;
      }

      if (mode === 'fast') setRunningFastPass(true);
      else setRunningDeepPass(true);

      setError(null);

      try {
        const response = await apiFetch(`${API_URL}/api/content/prompt-intelligence-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            url: normalized,
            prompt: activePrompt,
            answer: answerSample.trim() || undefined,
            mode,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to run ${mode} pass extraction`);
        }

        const payload = await response.json();
        setPromptReport(payload?.report || null);
      } catch (err: any) {
        setError(err?.message || `Failed to run ${mode} pass extraction`);
      } finally {
        if (mode === 'fast') setRunningFastPass(false);
        else setRunningDeepPass(false);
      }
    },
    [
      urlInput,
      token,
      selectedPrompt,
      promptMapping,
      visiblePrompts,
      queryResults,
      answerSample,
      promptReport,
    ]
  );

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

        <section className="mb-8 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-300" />
            Competitor and prompt map
          </h2>
          <p className="text-sm text-white/55 mb-4">
            Run targeted prompt families against direct competitors to expose displacement patterns
            and recover citation share with answer-first content changes.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-white/75">
              <thead className="text-left text-white/55 border-b border-slate-700">
                <tr>
                  <th className="py-2 pr-4">Competitor</th>
                  <th className="py-2 pr-4">Strongest on</th>
                  <th className="py-2 pr-4">Weakest on</th>
                  <th className="py-2">Prompt families</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_PROMPT_MAP.map((row) => (
                  <tr key={row.competitor} className="border-b border-slate-800">
                    <td className="py-2 pr-4 font-semibold text-white">{row.competitor}</td>
                    <td className="py-2 pr-4">{row.strongestOn.join(', ')}</td>
                    <td className="py-2 pr-4">{row.weakerOn.join(', ')}</td>
                    <td className="py-2 text-cyan-200">{row.suggestedPromptFamilies.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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
                <FileSearch className="w-5 h-5 text-amber-400" />
                4. Prompt Intelligence Extraction Engine (Fast + Deep)
              </h2>
              <p className="text-sm text-white/60 mb-4">
                Run a fast extraction pass for immediate diagnosis, then a deep optimization pass to
                produce a prompt rewrite and content blueprint connected to citation outcomes.
              </p>

              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 mb-4">
                <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
                  Optional AI answer sample
                </p>
                <textarea
                  value={answerSample}
                  onChange={(e) => setAnswerSample(e.target.value)}
                  rows={4}
                  placeholder="Paste an AI-generated answer sample to improve causality analysis..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => handleRunPromptExtraction('fast')}
                  disabled={runningFastPass || runningDeepPass || !visiblePrompts.length}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600/90 text-white font-semibold hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-2"
                >
                  {runningFastPass ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Workflow className="w-4 h-4" />
                  )}
                  Run Fast Pass
                </button>
                <button
                  type="button"
                  onClick={() => handleRunPromptExtraction('deep')}
                  disabled={runningFastPass || runningDeepPass || !promptReport}
                  className="px-4 py-2.5 rounded-xl bg-amber-600/90 text-white font-semibold hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-2"
                >
                  {runningDeepPass ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Run Deep Pass
                </button>
              </div>

              {promptReport && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-xs uppercase tracking-wider text-emerald-300">
                        {promptReport.mode.toUpperCase()} PASS REPORT
                      </p>
                      <span className="text-xs text-white/70">
                        Confidence {promptReport.confidence}%
                      </span>
                    </div>
                    <p className="text-sm text-white/90">{promptReport.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
                        1. Intent decomposition
                      </p>
                      {promptReport.intent_decomposition.map((item, idx) => (
                        <p key={`intent-${idx}`} className="text-sm text-white/85">
                          • {item}
                        </p>
                      ))}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
                        2. Output structure analysis
                      </p>
                      {promptReport.output_structure_analysis.map((item, idx) => (
                        <p key={`structure-${idx}`} className="text-sm text-white/85">
                          • {item}
                        </p>
                      ))}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                      <p className="text-xs uppercase tracking-wider text-white/60 mb-2 inline-flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5" /> 3. Citation likelihood signals
                      </p>
                      <p className="text-xl font-bold text-amber-300 mb-2">
                        {promptReport.citation_likelihood_signals.score}/100
                      </p>
                      {promptReport.citation_likelihood_signals.positives.map((item, idx) => (
                        <p key={`positive-${idx}`} className="text-xs text-emerald-300">
                          + {item}
                        </p>
                      ))}
                      {promptReport.citation_likelihood_signals.risks.map((item, idx) => (
                        <p key={`risk-${idx}`} className="text-xs text-rose-300">
                          - {item}
                        </p>
                      ))}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
                        4. Pattern signature extraction
                      </p>
                      {promptReport.pattern_signature_extraction.map((item, idx) => (
                        <p key={`pattern-${idx}`} className="text-sm text-white/85">
                          • {item}
                        </p>
                      ))}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
                        5. Prompt to output causality
                      </p>
                      {promptReport.prompt_output_causality.map((item, idx) => (
                        <p key={`causality-${idx}`} className="text-sm text-white/85">
                          • {item}
                        </p>
                      ))}
                    </div>
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-wider text-amber-300 mb-2">
                        6. Optimized prompt rewrite
                      </p>
                      <p className="text-sm text-white/90">
                        {promptReport.optimized_prompt_rewrite}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
                        7. Content blueprint generation
                      </p>
                      <p className="text-sm text-white/90 mb-2">
                        {promptReport.content_blueprint_generation.opening_block}
                      </p>
                      {promptReport.content_blueprint_generation.sections.map((item, idx) => (
                        <p key={`section-${idx}`} className="text-sm text-white/80">
                          • {item}
                        </p>
                      ))}
                      {!!promptReport.content_blueprint_generation.evidence_requirements.length && (
                        <div className="mt-2">
                          <p className="text-xs text-white/60 mb-1">Evidence requirements</p>
                          {promptReport.content_blueprint_generation.evidence_requirements.map(
                            (item, idx) => (
                              <p key={`ev-${idx}`} className="text-xs text-amber-200">
                                • {item}
                              </p>
                            )
                          )}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-wider text-white/60 mb-2">
                        Corrective action graph
                      </p>
                      {promptReport.action_graph.map((row, idx) => (
                        <p key={`action-${idx}`} className="text-sm text-white/85">
                          • [{row.owner} / {row.impact}] {row.action}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <WandSparkles className="w-5 h-5 text-amber-400" />
                5. Generate Answer-Ready Content
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
                6. Prompt Coverage Score
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

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-amber-400" />
                7. Execution Wiring: Reverse Engineer + CITE LEDGER
              </h2>
              <p className="text-sm text-white/60 mb-4">
                Use the extraction outputs as deterministic next actions. Move optimized prompts
                into Reverse Engineer and validate outcomes in citation ledger traces.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/app/reverse-engineer?tool=model-diff&input=${encodeURIComponent(
                    promptReport?.optimized_prompt_rewrite || selectedPrompt || ''
                  )}&secondary=${encodeURIComponent(identity?.business_name || '')}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition"
                >
                  <Workflow className="w-4 h-4" /> Send To Reverse Engineer
                </Link>
                <Link
                  to={`/app/citations?section=prompt-ledger&url=${encodeURIComponent(
                    normalizePublicUrlInput(urlInput.trim()) || ''
                  )}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-300 text-sm font-medium hover:bg-amber-500/20 transition"
                >
                  <Eye className="w-4 h-4" /> Open CITE LEDGER Context
                </Link>
              </div>
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
