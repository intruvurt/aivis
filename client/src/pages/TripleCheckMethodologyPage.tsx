import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Cpu,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileSearch,
} from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import PublicPageFrame from '../components/PublicPageFrame';
import { buildWebPageSchema, buildBreadcrumbSchema, buildFaqSchema } from '../lib/seoSchema';

/* ─── Stage definitions mapped to real pipeline functions ─────────── */

const stages = [
  {
    number: 1,
    name: 'Extraction — Signal Capture',
    icon: FileSearch,
    tone: 'border-cyan-400/20 bg-cyan-400/[0.04]',
    accentText: 'text-cyan-300',
    protocol:
      'The target URL is fetched through a three-step fallback pipeline: HTTP fetch, headless Puppeteer (with JavaScript execution), and cloud-based browser rendering. The full HTML is parsed into structured fields — title, meta tags, headings, links, images, JSON-LD blocks, robots.txt directives, llms.txt content, and sitemap entries. Each extracted field becomes a typed evidence item in the evidence ledger.',
    pipelineFunctions: [
      {
        fn: 'scrapeWebsite()',
        file: 'scraper.ts',
        desc: '3-step fetch pipeline (HTTP → Puppeteer → CF Browser Rendering)',
      },
      {
        fn: 'parseHtml()',
        file: 'scraper.ts',
        desc: 'Regex extraction of title, meta, headings, links, images, JSON-LD',
      },
      {
        fn: 'parseJsonLdStrings()',
        file: 'scraper.ts',
        desc: 'Parses all JSON-LD blocks from raw HTML',
      },
      {
        fn: 'fetchRobotsForOrigin()',
        file: 'scraper.ts',
        desc: 'Fetches and parses robots.txt against 30+ AI crawler user-agents',
      },
      {
        fn: 'fetchLlmsTxt()',
        file: 'scraper.ts',
        desc: 'Fetches and parses /llms.txt for LLM-specific directives',
      },
      {
        fn: 'fetchSitemap()',
        file: 'scraper.ts',
        desc: 'Parses sitemap XML for discovery signals',
      },
      {
        fn: 'extractEvidenceFromScrapedData()',
        file: 'audit/evidenceLedger.ts',
        desc: 'Converts raw scrape result into 30 typed evidence items with status and confidence',
      },
      {
        fn: 'detectContradictions()',
        file: 'audit/evidenceLedger.ts',
        desc: 'Cross-evidence contradiction detection (e.g. title vs OG title mismatch)',
      },
      {
        fn: 'extractSchemaSignalsFromHtml()',
        file: 'server.ts',
        desc: 'Extracts JSON-LD and Microdata schema types, validates graph structure',
      },
      {
        fn: 'assessCitationStrength()',
        file: 'citationStrength.ts',
        desc: 'Heuristic citation readiness scoring based on crawl signals',
      },
    ],
    output:
      'Evidence ledger with 30+ typed fields, contradiction flags, and a structured evidence manifest.',
    constraint:
      'Every downstream stage operates exclusively on signals captured in this stage. If a signal was not observed during extraction, it does not exist in the pipeline. No signal is fabricated or inferred beyond what the crawl produced.',
  },
  {
    number: 2,
    name: 'Verification — Evidence Binding',
    icon: ShieldCheck,
    tone: 'border-orange-400/20 bg-orange-400/[0.04]',
    accentText: 'text-orange-300',
    protocol:
      'The extracted evidence ledger is scored through a deterministic rule engine — evaluateRules() runs 30 rules across 11 families — before any AI model is invoked. Each rule references specific evidence keys from the ledger. computeScore() computes family-level scores and applies hard blocker caps. The scored evidence and manifest are then injected into the AI prompt, which explicitly requires the model to cite evidence IDs for every recommendation. After AI analysis, each recommendation undergoes post-AI verification: its cited evidence IDs are validated against the manifest, and a proof_score is computed per recommendation.',
    pipelineFunctions: [
      {
        fn: 'evaluateRules()',
        file: 'audit/ruleEngine.ts',
        desc: '30 deterministic scoring rules across 11 families, each citing evidenceKeys[]',
      },
      {
        fn: 'computeScore()',
        file: 'audit/ruleEngine.ts',
        desc: 'Hard blocker detection + family score breakdown + score cap enforcement',
      },
      {
        fn: 'Evidence manifest construction',
        file: 'server.ts',
        desc: 'Builds 25+ ev_* evidence keys from scrape data for AI prompt injection',
      },
      {
        fn: 'computeEvidenceScores()',
        file: 'server.ts',
        desc: 'Evidence-derived scoring bounds that constrain AI model output',
      },
      {
        fn: 'buildAuditPrimaryPrompt()',
        file: 'promptRegistry.ts',
        desc: 'Injects evidence block, requires model to cite evidence_ids',
      },
      {
        fn: 'callAIProvider()',
        file: 'aiProviders.ts',
        desc: 'Routes to OpenRouter with tier-based model allocation and fallback chain',
      },
      {
        fn: 'verifyRecommendationEvidence()',
        file: 'server.ts',
        desc: 'Post-AI validation: computes proof_score per recommendation',
      },
    ],
    output:
      'AI analysis with per-recommendation proof_scores, rule-derived family scores, hard blocker caps, and evidence-bound findings.',
    constraint:
      'The AI model receives the evidence manifest as a fixed input block. It cannot score signals that are not in the manifest. If evaluateRules() detects hard blockers (e.g. AI crawlers blocked in robots.txt, missing title, missing JSON-LD), computeScore() enforces a score cap regardless of AI model output. Post-AI verification rejects any recommendation that cites non-existent evidence IDs. If a recommendation cannot demonstrate provenance, its proof_score reflects that.',
  },
  {
    number: 3,
    name: 'Consistency — Drift Validation',
    icon: GitCompare,
    tone: 'border-emerald-400/20 bg-emerald-400/[0.04]',
    accentText: 'text-emerald-300',
    protocol:
      "Signal tier activates the three-model consensus pipeline. AI2 (Claude Sonnet 4.6) runs a peer critique on the AI1 analysis — it can adjust the score by −15 to +10 points and surface additional recommendations. AI2 output is checked for evidence conflicts against the original crawl data. An 8-check quality gate evaluates AI2's critique reliability. AI3 (Grok 4.1 Fast) runs a validation gate that confirms or overrides the final score. The final score is anchored to the evidence-derived deterministic score, with bounded AI2 adjustment (capped −6 to +8).",
    pipelineFunctions: [
      {
        fn: 'buildAuditPeerReviewPrompt()',
        file: 'promptRegistry.ts',
        desc: 'AI2 critique prompt — score_adjustment range −15 to +10',
      },
      {
        fn: 'callAIProvider() [AI2]',
        file: 'aiProviders.ts',
        desc: 'Claude Sonnet 4.6 peer critique execution',
      },
      {
        fn: 'detectPeerCritiqueEvidenceConflicts()',
        file: 'server.ts',
        desc: 'AI2 vs crawl evidence conflict detection',
      },
      {
        fn: 'evaluateAi2PenaltyGate()',
        file: 'server.ts',
        desc: '8-check quality gate for AI2 critique reliability',
      },
      {
        fn: 'buildAuditValidationPrompt()',
        file: 'promptRegistry.ts',
        desc: 'AI3 validation gate prompt',
      },
      {
        fn: 'callAIProvider() [AI3]',
        file: 'aiProviders.ts',
        desc: 'Grok 4.1 Fast validation gate execution',
      },
      {
        fn: 'Score anchoring',
        file: 'server.ts',
        desc: 'Evidence-derived score + bounded AI2 adjustment (capped −6 to +8)',
      },
    ],
    output:
      'Consensus-validated score, peer critique summary, validation verdict, and conflict log.',
    constraint:
      "AI2 cannot raise or lower the score beyond the bounded adjustment cap (−6 to +8 after quality gate). AI3 confirms or overrides — it does not generate new findings. The final score is always anchored to the evidence-derived deterministic score, not to any single model's opinion. If AI2 or AI3 fails, the pipeline degrades gracefully to the prior valid stage output.",
  },
] as const;

/* ─── Enforcement layer ───────────────────────────────────────────── */

const enforcementItems = [
  {
    label: 'Hard blocker cap',
    detail:
      'If evaluateRules() detects one or more hard blockers (e.g., AI crawler blocked in robots.txt, missing title tag, missing JSON-LD), computeScore() caps the score at 79 (or 59 for 3+ blockers) regardless of AI model output.',
    fn: 'evaluateRules() + computeScore() → audit/ruleEngine.ts',
  },
  {
    label: 'Integrity metadata',
    detail:
      'Every response includes buildAnalysisIntegrity() metadata: model identifiers, token counts, pipeline stage completion flags, and evidence manifest hash.',
    fn: 'buildAnalysisIntegrity() → server.ts',
  },
  {
    label: 'Dual-write persistence',
    detail:
      'The complete audit result — score, evidence manifest, recommendations, and pipeline metadata — is written to both Redis (7-day TTL) and PostgreSQL for durable storage.',
    fn: 'AnalysisCacheService.set() → cacheService.ts',
  },
  {
    label: 'Evidence manifest shipped in every response',
    detail:
      'The evidence_manifest is included in every cached and returned response. Any consumer of the audit result can independently verify which evidence was available during analysis.',
    fn: 'evidence_manifest → JSON response payload',
  },
  {
    label: 'Graceful degradation',
    detail:
      'If a multi-stage AI pipeline partially fails, valid earlier work is preserved. The response shape remains stable. Only if no valid output remains from any stage does the audit return an error.',
    fn: 'Pipeline timeout + fallback chain → aiProviders.ts',
  },
] as const;

/* ─── FAQ ──────────────────────────────────────────────────────────── */

const faqItems = [
  {
    question: 'What is the AiVIS.biz Triple-Check Methodology?',
    answer:
      'The AiVIS.biz Triple-Check Methodology is a three-stage verification protocol that validates every audit finding against crawl-observable evidence. Stage 1 (Extraction) captures signals from the target URL. Stage 2 (Verification) binds those signals to deterministic rules and AI analysis, validating evidence provenance. Stage 3 (Consistency) runs a multi-model consensus pipeline where three independent AI models score, critique, and validate the audit — reducing single-model bias. Each stage maps to specific functions in the AiVIS.biz pipeline and produces independently verifiable outputs.',
  },
  {
    question: 'How does the Triple-Check pipeline differ from single-model analysis?',
    answer:
      'Single-model analysis (Starter and Alignment tiers) runs one AI model against the extracted evidence. The Triple-Check pipeline (Signal tier) adds two additional stages: a peer critique by a second model that can adjust scores by −15 to +10 points, and a validation gate by a third model that confirms or overrides the final score. Both additional stages operate on the same evidence manifest — they cannot introduce new evidence. The result is a consensus-validated score with bounded adjustment caps (−6 to +8 after quality gate), reducing the probability of model-specific scoring artifacts.',
  },
  {
    question: 'Which AI models are used in the Triple-Check pipeline?',
    answer:
      "Stage 2 primary analysis uses GPT-5 Mini for deep analysis. The peer critique (AI2) uses Claude Sonnet 4.6 to independently evaluate and adjust the score. The validation gate (AI3) uses Grok 4.1 Fast to confirm or override the final result. Each model operates independently on the same evidence manifest — no model sees another model's raw output during its own analysis stage.",
  },
  {
    question: 'What happens if one of the three models fails during analysis?',
    answer:
      'The pipeline degrades gracefully. If AI2 fails, the AI1 score is preserved without peer adjustment. If AI3 fails, the AI1 + AI2 consensus result is returned. The evidence manifest and deterministic rule scores are never affected by AI model failures — they are computed before any model is invoked. The response always includes pipeline stage completion flags so consumers know exactly which stages completed.',
  },
  {
    question: 'Can the AI models override evidence that was not found during extraction?',
    answer:
      "No. The evidence manifest is constructed before any AI model is invoked. Models receive the manifest as a fixed input block and are required to cite evidence IDs for every finding. Post-AI verification (verifyRecommendationEvidence) checks each cited evidence ID against the manifest. If a model cites evidence that does not exist in the manifest, the recommendation's proof_score reflects the unverifiable claim.",
  },
  {
    question: 'What is the bounded adjustment cap in the Triple-Check pipeline?',
    answer:
      'AI2 (peer critique) can propose a score adjustment of −15 to +10. After passing the 8-check quality gate (evaluateAi2PenaltyGate), the applied adjustment is capped to −6 to +8 points. This prevents a single model from dominating the final score while still allowing meaningful corrections based on evidence the first model may have underweighted.',
  },
  {
    question: 'Is the Triple-Check Methodology available on all plans?',
    answer:
      'The full three-stage pipeline is available on the Signal tier ($149/mo) and Score Fix tier ($299/mo). Starter and Alignment tiers receive Stage 1 (Extraction) and Stage 2 (Verification) with single-model AI analysis. All tiers receive deterministic rule scoring and the full evidence manifest — the Triple-Check adds multi-model consensus validation on top of that foundation.',
  },
  {
    question: 'How does AiVIS.biz ensure the Triple-Check pipeline is reproducible?',
    answer:
      'Every audit result includes the evidence_manifest, pipeline stage completion flags, model identifiers, and integrity metadata (buildAnalysisIntegrity). The complete result is persisted to both Redis and PostgreSQL. Re-auditing the same URL produces a new extraction against the current page state, and score deltas are computed against the stored baseline — not against a re-calculated reconstruction.',
  },
] as const;

/* ─── Component ──────────────────────────────────────────────────── */

export default function TripleCheckMethodologyPage() {
  usePageMeta({
    title: 'Triple-Check Methodology | AiVIS.biz Verification Protocol',
    description:
      'The AiVIS.biz Triple-Check Methodology is a three-stage verification protocol — Extraction, Verification, Consistency — that validates every audit finding against crawl-observable evidence using three independent AI models.',
    path: '/triple-check-methodology',
    ogTitle: 'Triple-Check Methodology — AiVIS.biz Verification Protocol',
    ogDescription:
      'Three-stage verification protocol: Extraction (signal capture), Verification (evidence binding), Consistency (multi-model drift validation). Each stage maps to named functions in the AiVIS.biz pipeline.',
    ogType: 'article',
    structuredData: [
      buildWebPageSchema({
        path: '/triple-check-methodology',
        name: 'Triple-Check Methodology — AiVIS.biz Verification Protocol',
        description:
          'Three-stage verification protocol mapping Extraction, Verification, and Consistency stages to named pipeline functions. Includes enforcement constraints, graceful degradation rules, and structured FAQ.',
        speakableCssSelectors: [
          'h1',
          "[data-speakable='protocol-summary']",
          "[data-speakable='stage-1']",
          "[data-speakable='stage-2']",
          "[data-speakable='stage-3']",
        ],
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Methodology', path: '/methodology' },
        { name: 'Triple-Check Methodology', path: '/triple-check-methodology' },
      ]),
      buildFaqSchema(
        faqItems.map((item) => ({ question: item.question, answer: item.answer })),
        { path: '/triple-check-methodology' }
      ),
    ],
  });

  return (
    <PublicPageFrame
      icon={ShieldCheck}
      title="Triple-Check Methodology"
      subtitle="Three-stage verification protocol for evidence-backed AI audit scoring."
      backTo="/methodology"
      maxWidthClass="max-w-5xl"
    >
      {/* ── Protocol summary ──────────────────────────────────────── */}
      <section className="space-y-6">
        <div
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
          data-speakable="protocol-summary"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50 mb-3">
            Protocol definition
          </p>
          <p className="text-base leading-7 text-white/88 font-medium">
            The AiVIS.biz Triple-Check Methodology is a three-stage verification protocol that
            validates every audit finding against crawl-observable evidence. Stage 1 captures
            signals from the target URL. Stage 2 binds those signals to deterministic rules and AI
            analysis. Stage 3 runs multi-model consensus — three independent AI models score,
            critique, and validate the audit to reduce single-model bias. Each stage maps to named
            functions in the AiVIS.biz pipeline and produces independently verifiable outputs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {stages.map((s) => (
            <div key={s.number} className={`rounded-2xl border ${s.tone} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold ${s.accentText}`}>Stage {s.number}</span>
              </div>
              <p className="text-sm font-semibold text-white">{s.name}</p>
              <p className="mt-1 text-xs text-white/50">{s.output}</p>
            </div>
          ))}
        </div>

        <p className="text-sm leading-6 text-white/56">
          The pipeline executes sequentially: extraction before verification, verification before
          consistency. No stage can reference data that was not produced by a prior stage. The
          evidence manifest is constructed once during extraction and is locked for the duration of
          the audit.
        </p>
      </section>

      {/* ── Stage detail sections ─────────────────────────────────── */}
      {stages.map((stage) => (
        <section
          key={stage.number}
          id={`stage-${stage.number}`}
          className="mt-14"
          data-speakable={`stage-${stage.number}`}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border ${stage.tone}`}
            >
              <stage.icon className={`h-4 w-4 ${stage.accentText}`} />
            </div>
            <div>
              <span className={`text-xs font-bold uppercase tracking-[0.15em] ${stage.accentText}`}>
                Stage {stage.number}
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-white">{stage.name}</h2>
            </div>
          </div>

          <p className="text-sm leading-7 text-white/72 mb-6">{stage.protocol}</p>

          {/* Function mapping table */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_2fr] gap-x-3 px-4 py-2 border-b border-white/10 bg-white/[0.03]">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                Function
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                File
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                Purpose
              </span>
            </div>
            {stage.pipelineFunctions.map((pf, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_auto_2fr] gap-x-3 px-4 py-2.5 ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'} ${i < stage.pipelineFunctions.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <span className="text-sm font-mono text-white/80">{pf.fn}</span>
                <span className="text-xs text-white/40 font-mono self-center">{pf.file}</span>
                <span className="text-sm text-white/60">{pf.desc}</span>
              </div>
            ))}
          </div>

          {/* Output and constraint */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Stage output
              </div>
              <p className="text-sm text-white/60 leading-6">{stage.output}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Constraint
              </div>
              <p className="text-sm text-white/60 leading-6">{stage.constraint}</p>
            </div>
          </div>
        </section>
      ))}

      {/* ── Enforcement layer ─────────────────────────────────────── */}
      <section id="enforcement" className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-white mb-5">Enforcement layer</h2>
        <p className="text-sm leading-6 text-white/56 mb-6">
          These constraints apply across all three stages. They are not configurable per-audit and
          cannot be overridden by AI model output.
        </p>
        <div className="space-y-3">
          {enforcementItems.map((item, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-sm text-white/56 leading-6">{item.detail}</p>
                </div>
                <span className="text-[11px] font-mono text-white/30 whitespace-nowrap self-start mt-0.5">
                  {item.fn}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pipeline flow (text-based, no diagram dependency) ───── */}
      <section id="pipeline-flow" className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-white mb-5">
          Pipeline execution order
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 font-mono text-sm leading-8 text-white/70 overflow-x-auto">
          <div className="flex items-center flex-wrap gap-1">
            <span className="text-cyan-300">scrapeWebsite()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-cyan-300">extractEvidenceFromScrapedData()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-cyan-300/70">evidence ledger + contradictions</span>
          </div>
          <div className="flex items-center flex-wrap gap-1 mt-1">
            <span className="pl-4 text-white/30">→</span>
            <span className="text-orange-300">evaluateRules()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-orange-300">computeScore()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-orange-300/70">score cap + family breakdown</span>
          </div>
          <div className="flex items-center flex-wrap gap-1 mt-1">
            <span className="pl-4 text-white/30">→</span>
            <span className="text-orange-300">buildAuditPrimaryPrompt()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-orange-300">callAIProvider(AI1)</span>
          </div>
          <div className="flex items-center flex-wrap gap-1 mt-1">
            <span className="pl-4 text-white/30">→</span>
            <span className="text-orange-300">verifyRecommendationEvidence()</span>
          </div>
          <div className="flex items-center flex-wrap gap-1 mt-1">
            <span className="pl-4 text-white/30">→</span>
            <span className="text-emerald-300">[Signal+]</span>
            <span className="text-emerald-300">buildAuditPeerReviewPrompt()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-emerald-300">callAIProvider(AI2)</span>
          </div>
          <div className="flex items-center flex-wrap gap-1 mt-1">
            <span className="pl-4 text-white/30">→</span>
            <span className="text-emerald-300">detectPeerCritiqueEvidenceConflicts()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-emerald-300">evaluateAi2PenaltyGate()</span>
          </div>
          <div className="flex items-center flex-wrap gap-1 mt-1">
            <span className="pl-4 text-white/30">→</span>
            <span className="text-emerald-300">buildAuditValidationPrompt()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-emerald-300">callAIProvider(AI3)</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-emerald-300/70">score anchoring</span>
          </div>
          <div className="flex items-center flex-wrap gap-1 mt-1">
            <span className="pl-4 text-white/30">→</span>
            <span className="text-white/50">buildAnalysisIntegrity()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-white/50">AnalysisCacheService.set()</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-white/50">JSON response</span>
          </div>
        </div>
      </section>

      {/* ── Tier availability ─────────────────────────────────────── */}
      <section id="tier-availability" className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-white mb-5">Tier availability</h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-x-2 px-4 py-2 border-b border-white/10 bg-white/[0.03]">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Tier
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Stage 1
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Stage 2
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Stage 3
            </span>
          </div>
          {[
            { tier: 'Observer (Free)', s1: true, s2: true, s3: false, note: 'Free-tier models' },
            { tier: 'Starter ($15/mo)', s1: true, s2: true, s3: false, note: 'GPT-5 Nano primary' },
            {
              tier: 'Alignment ($49/mo)',
              s1: true,
              s2: true,
              s3: false,
              note: 'GPT-5 Nano primary',
            },
            {
              tier: 'Signal ($149/mo)',
              s1: true,
              s2: true,
              s3: true,
              note: 'Triple-check: GPT-5 Mini → Claude Sonnet 4.6 → Grok 4.1 Fast',
            },
            {
              tier: 'Score Fix ($299/mo)',
              s1: true,
              s2: true,
              s3: true,
              note: 'Triple-check + AutoFix PR',
            },
          ].map((row, i) => (
            <div
              key={i}
              className={`grid grid-cols-[1fr_1fr_1fr_1fr] gap-x-2 px-4 py-2.5 ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'} ${i < 4 ? 'border-b border-white/5' : ''}`}
            >
              <div>
                <span className="text-sm text-white/80">{row.tier}</span>
                <p className="text-[11px] text-white/30">{row.note}</p>
              </div>
              <span
                className={`text-sm self-center ${row.s1 ? 'text-emerald-400' : 'text-white/20'}`}
              >
                {row.s1 ? '✓' : '—'}
              </span>
              <span
                className={`text-sm self-center ${row.s2 ? 'text-emerald-400' : 'text-white/20'}`}
              >
                {row.s2 ? '✓' : '—'}
              </span>
              <span
                className={`text-sm self-center ${row.s3 ? 'text-emerald-400' : 'text-white/20'}`}
              >
                {row.s3 ? '✓' : '—'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-white mb-5">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {faqItems.map((item, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-white hover:bg-white/[0.03] transition-colors">
                {item.question}
                <Cpu className="h-4 w-4 text-white/30 transition-transform group-open:rotate-90 shrink-0 ml-3" />
              </summary>
              <div className="px-5 pb-4">
                <p className="text-sm leading-7 text-white/60">{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Cross-links ──────────────────────────────────────────── */}
      <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Related protocol documentation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/methodology"
            className="flex items-center gap-2 text-sm text-orange-300 hover:text-orange-200 transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" /> Full scoring methodology — CITE LEDGER &amp; BRAG
            protocol
          </Link>
          <Link
            to="/pricing"
            className="flex items-center gap-2 text-sm text-orange-300 hover:text-orange-200 transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" /> Tier comparison and pricing
          </Link>
          <Link
            to="/api-docs"
            className="flex items-center gap-2 text-sm text-orange-300 hover:text-orange-200 transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" /> API documentation (v1)
          </Link>
          <Link
            to="/glossary"
            className="flex items-center gap-2 text-sm text-orange-300 hover:text-orange-200 transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" /> Glossary of terms
          </Link>
        </div>
      </section>
    </PublicPageFrame>
  );
}
