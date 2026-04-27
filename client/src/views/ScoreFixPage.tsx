import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  BadgeCheck,
  Link2,
  Workflow,
  ClipboardList,
} from 'lucide-react';
import useFeatureStatus from '../hooks/useFeatureStatus';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import apiFetch from '../utils/api';
import { Card, CardContent } from '@/components/ui/Card';
import { ScoreFixIcon, ContentBlueprintIcon, AuditEngineIcon } from '../components/icons';
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildOrganizationRef,
  buildWebPageSchema,
} from '../lib/seoSchema';
import UpgradeWall from '../components/UpgradeWall';
import ScoreFixWizard from '../components/ScoreFixWizard';

const blockerRows = [
  {
    blocker: 'Weak entity clarity',
    evidence:
      'AI systems cannot confidently resolve what the business is, who it serves, or what exact service the page represents.',
    fix: 'Automated PR: rewrites hero, H1, intro copy, and service framing with exact category language and audience definition.',
    lift: 'Higher extraction confidence and better citation eligibility',
  },
  {
    blocker: 'Thin answer blocks',
    evidence:
      'Critical buyer questions are buried in long-form copy instead of concise retrieval-friendly sections.',
    fix: 'Automated PR: adds direct answers, structured FAQs, comparison blocks, and concise extraction sections.',
    lift: 'Better answer-engine summarization and snippet reuse',
  },
  {
    blocker: 'Missing proof layer',
    evidence:
      'Claims exist without enough visible evidence such as examples, diff notes, validation, or remediation detail.',
    fix: 'Automated PR: adds proof strips, issue-level notes, remediation details, and before/after examples.',
    lift: 'Stronger trust signals and claim credibility',
  },
  {
    blocker: 'Schema-content mismatch',
    evidence: 'Structured data is absent, incomplete, or disconnected from visible page content.',
    fix: 'Automated PR: deploys aligned JSON-LD for Organization, WebSite, WebPage, Service, BreadcrumbList, FAQPage.',
    lift: 'More reliable machine-readable interpretation',
  },
  {
    blocker: 'Weak topical reinforcement',
    evidence:
      'The page is not sufficiently supported by internal links to related entities, methods, pricing, or proof pages.',
    fix: 'Automated PR: adds internal links to pricing, audits, reports, FAQ, methodology using exact topical anchors.',
    lift: 'Stronger topic graph and contextual support',
  },
  {
    blocker: 'No freshness signal',
    evidence:
      'There is no visible recency marker, update signal, or change log to reinforce active maintenance.',
    fix: 'Automated PR: adds last-updated notes, validation timestamps, and optional revision history.',
    lift: 'Improved trust and temporal relevance',
  },
];

const deliverables = [
  'Continuous ledger monitoring — evaluates citation presence, entity clarity, and schema integrity every 6 hours',
  'Auto-detection of citation decay: tracks when AI systems stop citing your entity',
  'Auto-detection of entity graph drift: flags missing @id continuity and broken schema links',
  'Evidence delta tracking: compares repair cycle outcomes over time',
  'Automated GitHub PR with entity rewrites tied to ledger evidence IDs',
  'Automated GitHub PR with schema patches, FAQ blocks, and answer-section additions',
  'PR regression rollback: auto-flags PRs that lowered your visibility score',
  'Weekly Visibility Repair Cycle summary — up to 5 auto-PRs/week',
  '250 monthly repair credits (reset each billing cycle)',
];

const bestFor = [
  'Products and brands that cannot afford to disappear from AI-generated answers',
  'Dev teams that want automated GitHub PRs instead of manual content edits',
  'SaaS teams with citation decay — presence that was once there and is now fading',
  'Agencies managing AI visibility stability for multiple clients',
];

const proofCards = [
  {
    label: 'Before',
    title: 'Invisible and decaying',
    text: 'Citations fading. Entity clarity drifting. Schema @id broken. No signal that it is happening.',
  },
  {
    label: 'After',
    title: 'Maintained and stable',
    text: 'Ledger watch active. Drift detected within 6 hours. Evidence-linked PR submitted. Score verified post-merge.',
  },
  {
    label: 'Example lift',
    title: '54 → 91',
    text: 'Representative score movement after structural edits, schema alignment, entity clarity repairs, and internal reinforcement.',
  },
  {
    label: 'Trust moat',
    title: 'Rollback on regression',
    text: 'If a merged PR lowers your visibility score, Score Fix flags it for rollback automatically.',
  },
];

const faq = [
  {
    q: 'What is Score Fix?',
    a: 'Score Fix is a continuous evidence repair system for AI visibility. It runs an always-on ledger monitoring loop that detects citation decay, entity graph drift, and schema @id breaks — then generates evidence-linked GitHub PRs to close each gap. It is not a one-time tool or a scan add-on. It is preventative infrastructure for AI-perceived existence.',
  },
  {
    q: 'What does the ledger watch mode do?',
    a: 'Every 6 hours, Score Fix evaluates your entity against the Evidence Ledger. It checks whether citations are still present, whether your entity graph is intact, and whether schema integrity is maintained. If the visibility score drops below the configured threshold (default: 70), a repair PR is automatically queued without requiring a manual trigger.',
  },
  {
    q: 'How many credits does each repair cycle use?',
    a: 'Each automated GitHub PR costs 10-25 credits depending on fix scope. Simple schema patches cost fewer credits; multi-file entity rewrites with FAQ blocks and answer sections cost more. Your 250 monthly credits typically cover 10-25 full repair PRs. Credits reset each billing cycle.',
  },
  {
    q: 'What is the rollback guarantee?',
    a: 'After every PR is merged, Score Fix runs a post-merge rescan. If the new visibility score is lower than the score before the PR, Score Fix flags the job as a regression and marks it for rollback. This is the trust moat: Score Fix only keeps changes that demonstrably improve citation eligibility.',
  },
  {
    q: 'Who is this for?',
    a: 'Score Fix is for teams that cannot afford invisible citation decay — SaaS products, agencies, and service brands that need AI visibility stability maintained continuously, not checked once and forgotten.',
  },
  {
    q: 'Can Score Fix guarantee citations?',
    a: 'No legitimate service can guarantee citations. What Score Fix does is maintain the underlying clarity, evidence structure, and machine-readable integrity that make a page citation-eligible — and continuously repair drift before it becomes disappearance.',
  },
];

const scoreModel = [
  ['Entity clarity', '15/15'],
  ['Heading structure', '14/15'],
  ['Answer blocks', '15/15'],
  ['Evidence depth', '14/15'],
  ['Schema alignment', '12/15'],
  ['Internal links', '10/10'],
  ['Freshness', '5/5'],
  ['Trust signals', '10/10'],
];

const SITE_URL = 'https://aivis.biz';
const PAGE_URL = `${SITE_URL}/score-fix`;
const PAGE_TITLE = 'Score Fix | AiVIS.biz — Continuous Evidence Repair for AI Visibility';
const PAGE_DESCRIPTION =
  'Score Fix is the continuous evidence repair layer for AI-visible entities. Always-on ledger monitoring detects citation decay, entity drift, and schema breaks — then generates evidence-linked GitHub PRs to close the gap. 250 repair credits/month, $299/mo.';
const OG_IMAGE = `${SITE_URL}/og/aivis-score-fix.jpg`;

const scoreFixFaqEntities = faq.map((item) => ({
  question: item.q,
  answer: item.a,
}));

const scoreFixJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      ...buildWebPageSchema({
        path: '/score-fix',
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        mainEntityId: `${PAGE_URL}#service`,
      }),
      breadcrumb: {
        '@id': `${PAGE_URL}#breadcrumb`,
      },
      inLanguage: 'en-US',
      dateModified: '2026-03-11',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${PAGE_URL}#service`,
      name: 'Score Fix — Continuous Evidence Repair System',
      serviceType: 'Continuous AI Visibility Maintenance and Automated GitHub PR Remediation',
      description:
        'An always-on evidence repair system that monitors the Citation Ledger every 6 hours, detects entity drift and citation decay, and generates evidence-linked GitHub PRs to maintain AI visibility integrity. 250 monthly repair credits, rollback protection, $299/mo.',
      provider: buildOrganizationRef(),
      areaServed: 'Worldwide',
      audience: {
        '@type': 'Audience',
        audienceType: 'Dev teams, SaaS teams, agencies, and service operators',
      },
      url: PAGE_URL,
    },
    {
      ...buildFaqSchema(scoreFixFaqEntities),
      '@id': `${PAGE_URL}#faq`,
    },
    {
      ...buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Score Fix', path: '/score-fix' },
      ]),
      '@id': `${PAGE_URL}#breadcrumb`,
    },
  ],
};

const sectionFade = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.45 },
};

type LiveRecommendation = {
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  implementation?: string;
  evidence_ids?: string[];
};

type LiveEvidenceItem = {
  id?: string;
  label?: string;
  status?: string;
  value?: string;
  source?: string;
};

type ScoreFixStatus = {
  eligible?: boolean;
  available_credits?: number;
  required_credits?: number;
  locked?: boolean;
  execution_mode?: string;
  pipeline?: {
    redis_configured?: boolean;
    github_app_configured?: boolean;
    pr_worker_ready?: boolean;
  };
};

export default function ScoreFixPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { status: featureStatus } = useFeatureStatus();
  const packCreditsBalance = Math.max(0, Number(featureStatus?.credits?.packCreditsRemaining ?? 0));
  const hasAccess = isAuthenticated && packCreditsBalance > 0;
  const [liveRecommendations, setLiveRecommendations] = useState<LiveRecommendation[]>([]);
  const [liveEvidenceById, setLiveEvidenceById] = useState<Record<string, LiveEvidenceItem>>({});
  const [liveEvidenceState, setLiveEvidenceState] = useState<
    'idle' | 'loading' | 'ready' | 'unavailable'
  >('idle');
  const [liveAuditId, setLiveAuditId] = useState('');
  const [liveTargetUrl, setLiveTargetUrl] = useState('');
  const [liveVisibilityScore, setLiveVisibilityScore] = useState(0);
  const [scoreFixStatus, setScoreFixStatus] = useState<ScoreFixStatus | null>(null);

  usePageMeta({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    path: '/score-fix',
    structuredData: scoreFixJsonLd,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchScoreFixStatus = async () => {
      if (!isAuthenticated) {
        if (!cancelled) setScoreFixStatus(null);
        return;
      }
      try {
        const res = await apiFetch(`${API_URL}/api/auto-score-fix/status`, {
          method: 'GET',
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as ScoreFixStatus | null;
        if (!cancelled) setScoreFixStatus(data);
      } catch {
        if (!cancelled) setScoreFixStatus(null);
      }
    };

    const fetchLiveEvidence = async () => {
      if (!isAuthenticated || !token) {
        setLiveEvidenceState('unavailable');
        setLiveRecommendations([]);
        setLiveEvidenceById({});
        return;
      }

      setLiveEvidenceState('loading');

      try {
        const auditsRes = await apiFetch(`${API_URL}/api/audits?limit=1`);

        if (!auditsRes.ok) {
          setLiveEvidenceState('unavailable');
          return;
        }

        const auditsPayload = (await auditsRes.json().catch(() => ({}))) as {
          audits?: Array<{ id?: string; url?: string; target_url?: string }>;
        };
        const latestAuditId = String(auditsPayload?.audits?.[0]?.id || '').trim();
        const auditUrl = (
          auditsPayload?.audits?.[0]?.url ||
          auditsPayload?.audits?.[0]?.target_url ||
          ''
        ).trim();
        if (!latestAuditId) {
          setLiveEvidenceState('unavailable');
          return;
        }

        const detailRes = await apiFetch(
          `${API_URL}/api/audits/${encodeURIComponent(latestAuditId)}`
        );

        if (!detailRes.ok) {
          setLiveEvidenceState('unavailable');
          return;
        }

        const detail = (await detailRes.json().catch(() => ({}))) as {
          url?: string;
          target_url?: string;
          result?: {
            recommendations?: LiveRecommendation[];
            evidence_ledger?: Record<string, LiveEvidenceItem>;
            visibility_score?: number;
            url?: string;
          };
        };

        if (cancelled) return;

        const recommendations = Array.isArray(detail?.result?.recommendations)
          ? detail.result!.recommendations!
          : [];
        const evidenceLedger =
          detail?.result?.evidence_ledger && typeof detail.result.evidence_ledger === 'object'
            ? detail.result.evidence_ledger
            : {};

        setLiveRecommendations(recommendations);
        setLiveEvidenceById(evidenceLedger as Record<string, LiveEvidenceItem>);
        setLiveEvidenceState(recommendations.length > 0 ? 'ready' : 'unavailable');
        setLiveAuditId(latestAuditId);
        setLiveTargetUrl(
          auditUrl || detail?.url || detail?.target_url || detail?.result?.url || ''
        );
        setLiveVisibilityScore(detail?.result?.visibility_score ?? 0);
      } catch {
        if (!cancelled) setLiveEvidenceState('unavailable');
      }
    };

    void fetchScoreFixStatus();
    void fetchLiveEvidence();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  const liveEvidenceRows = useMemo(() => {
    return liveRecommendations.map((rec, idx) => {
      const evidenceIds = Array.isArray(rec.evidence_ids) ? rec.evidence_ids.slice(0, 3) : [];
      const evidence = evidenceIds
        .map((id) => ({ id, item: liveEvidenceById[id] }))
        .filter((row) => Boolean(row.item));

      return {
        key: `${rec.title || rec.category || 'rec'}-${idx}`,
        recommendation: rec,
        evidence,
      };
    });
  }, [liveRecommendations, liveEvidenceById]);

  const scoreFixPipelineReady = Boolean(scoreFixStatus?.pipeline?.pr_worker_ready);
  const scoreFixReadinessText = scoreFixPipelineReady
    ? 'Automation pipeline ready: queue worker and GitHub App are configured for PR execution.'
    : 'Automation pipeline not fully configured: remediation plans remain evidence-linked, but automatic PR execution requires Redis and GitHub App configuration.';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(scoreFixJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-400" />
          Score Fix
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Continuous Evidence Repair — always-on ledger monitoring, drift detection, and GitHub PRs
        </p>
      </div>
      {!hasAccess ? (
        <div className="w-full py-16">
          <UpgradeWall
            feature="Score Fix"
            description="Subscribe to Score Fix ($299/mo) to unlock the Continuous Evidence Repair System — 250 monthly credits, always-on ledger monitoring, citation decay detection, and evidence-linked GitHub PRs."
            requiredTier="scorefix"
            icon={<Sparkles className="w-12 h-12 text-amber-400" />}
            featurePreview={[
              'Ledger watch mode: evaluates citation presence and entity integrity every 6 hours',
              'Auto-detects citation decay, broken schema @id continuity, and entity graph drift',
              'Generates evidence-linked GitHub PRs and rolls back regressions automatically',
            ]}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ScoreFix Wizard — primary flow */}
          {liveTargetUrl ? (
            <ScoreFixWizard
              token={token || ''}
              auditSnapshot={{
                audit_id: liveAuditId,
                target_url: liveTargetUrl,
                visibility_score: liveVisibilityScore,
                recommendations: liveRecommendations,
                evidence_ledger: liveEvidenceById,
              }}
              packCreditsBalance={packCreditsBalance}
              creditCost={10}
            />
          ) : liveEvidenceState === 'loading' ? (
            <div className="flex items-center justify-center gap-2 py-20 text-white/40">
              <span>Loading your latest audit…</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <p className="text-sm text-white/60">
                No audit found.{' '}
                <Link to="/app/analyze" className="text-amber-300 underline">
                  Run an audit first
                </Link>
                , then return here to apply fixes automatically.
              </p>
            </div>
          )}
          {/* Reference info for context */}
          <motion.section
            {...sectionFade}
            className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-2xl sm:p-6 lg:p-7"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.14),transparent_20%),radial-gradient(circle_at_15%_85%,rgba(168,85,247,0.12),transparent_22%)]" />
            <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium tracking-[0.18em] text-amber-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  SCORE FIX
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl lg:leading-[1.08]">
                  Score Fix AutoFix PR — Automated GitHub Remediation for Citation Readiness
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  Score Fix turns audit findings into evidence-linked remediation. When the
                  automation pipeline is configured, it can open GitHub pull requests with schema
                  patches, H1 rewrites, FAQ blocks, and structural improvements. Each remediation
                  job costs 10-25 credits depending on complexity.
                </p>

                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${scoreFixPipelineReady ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/25 bg-amber-400/10 text-amber-100'}`}
                >
                  {scoreFixReadinessText}
                </div>

                {packCreditsBalance > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 w-fit mb-4">
                    <Sparkles className="h-3 w-3" />
                    {packCreditsBalance} credit{packCreditsBalance !== 1 ? 's' : ''} remaining in
                    your Score Fix pack
                  </div>
                )}
                {packCreditsBalance === 0 && (
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200/70 w-fit mb-4">
                    <Sparkles className="h-3 w-3" />
                    Score Fix credits: 0 — subscribe to Score Fix ($299/mo) to receive 250
                    credits/month
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link
                    to="/pricing?intent=score-fix&plan=score-fix&source=score-fix-page"
                    className="inline-flex items-center rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-slate-100"
                  >
                    Start Score Fix
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    to="/guide#audit-criteria&source=score-fix-page"
                    className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                  >
                    View audit criteria
                  </Link>
                </div>

                <div className="mt-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { icon: AuditEngineIcon, label: 'Goal', value: 'Automated PR generation' },
                    { icon: Search, label: 'Focus', value: 'GitHub MCP remediation' },
                    {
                      icon: Workflow,
                      label: 'Method',
                      value: scoreFixPipelineReady
                        ? 'Evidence to automated PR'
                        : 'Evidence to PR-ready remediation plan',
                    },
                    { icon: ScoreFixIcon, label: 'Cost', value: '600-1008 code lines' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Card
                        key={item.label}
                        className="rounded-[18px] border-white/10 bg-slate-950/50 text-white shadow-xl"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                              <Icon className="h-4 w-4 text-amber-300" />
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                {item.label}
                              </div>
                              <div className="mt-1 text-sm font-medium leading-6 text-slate-100">
                                {item.value}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <Card className="rounded-[22px] border-white/10 bg-slate-950/65 text-white shadow-2xl">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-5 overflow-hidden rounded-2xl border border-white/10">
                    <img
                      src="/score-fix.png"
                      alt="Score Fix remediation workflow preview"
                      className="h-32 w-full object-cover object-center"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <ContentBlueprintIcon className="h-5 w-5 text-amber-300" />
                    <BadgeCheck className="h-5 w-5 text-emerald-300" />
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Target score model
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        Built for high-confidence page structure
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {scoreModel.map(([label, score]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <span className="text-sm text-slate-300">{label}</span>
                        <span className="text-sm font-semibold text-white">{score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
                    Direct answer: a 90+ page is easy to identify, easy to summarize, easy to
                    verify, and easy to connect to supporting evidence.
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.section>

          <motion.section {...sectionFade} className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <AuditEngineIcon className="h-5 w-5 text-amber-300" />
                  <ContentBlueprintIcon className="h-5 w-5 text-amber-300" />
                  <h2 className="text-2xl brand-title">What Score Fix AutoFix PR does</h2>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Score Fix AutoFix PR translates audit findings into remediation packages
                  containing schema patches, content rewrites, and structural fixes. When the
                  automation pipeline is ready, those packages can be opened as GitHub pull
                  requests. Every change references evidence IDs so you can verify exactly which
                  audit signal drove it.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    scoreFixPipelineReady
                      ? 'Generates PRs with schema patches'
                      : 'Generates PR-ready schema patch sets',
                    'Rewrites H1 and hero copy from audit evidence',
                    'Adds FAQ blocks and answer sections',
                    'Links evidence IDs to every change',
                    'Adds internal links via topical anchors',
                    scoreFixPipelineReady
                      ? 'PR execution enabled by queue worker'
                      : 'Automatic PR execution waits for queue worker setup',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span className="text-sm leading-6 text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <ScoreFixIcon className="h-5 w-5 text-amber-300" />
                  <AuditEngineIcon className="h-5 w-5 text-amber-300" />
                  <h2 className="text-2xl brand-title">Best fit</h2>
                </div>
                <div className="mt-6 space-y-3">
                  {bestFor.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-6 text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section {...sectionFade} className="mt-6">
            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5 lg:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                    <ClipboardList className="h-5 w-5 text-amber-300" />
                  </div>
                  <h2 className="text-2xl brand-title">Blocker → Evidence → Fix → Expected lift</h2>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  This is the spine of the page. Each issue is named, each weakness is explained,
                  and each remediation path is tied to a practical reason it matters.
                </p>

                <div className="mt-6 hidden overflow-hidden rounded-[24px] border border-white/10 lg:block">
                  <div className="grid grid-cols-[1fr_1.1fr_1.1fr_0.9fr] bg-white/5 text-sm font-medium text-slate-200">
                    <div className="border-r border-white/10 p-3">Blocker</div>
                    <div className="border-r border-white/10 p-3">Evidence</div>
                    <div className="border-r border-white/10 p-3">Fix</div>
                    <div className="p-3">Expected lift</div>
                  </div>
                  {blockerRows.map((row, idx) => (
                    <div
                      key={row.blocker}
                      className={`grid grid-cols-[1fr_1.1fr_1.1fr_0.9fr] ${idx !== blockerRows.length - 1 ? 'border-t border-white/10' : ''}`}
                    >
                      <div className="border-r border-white/10 bg-slate-950/55 p-3 text-sm font-medium text-white">
                        {row.blocker}
                      </div>
                      <div className="border-r border-white/10 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">
                        {row.evidence}
                      </div>
                      <div className="border-r border-white/10 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">
                        {row.fix}
                      </div>
                      <div className="bg-slate-950/35 p-3 text-sm leading-6 text-slate-200">
                        {row.lift}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:hidden">
                  {blockerRows.map((row) => (
                    <div
                      key={row.blocker}
                      className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4"
                    >
                      <h3 className="text-lg font-semibold">{row.blocker}</h3>
                      <div className="mt-4 space-y-3 text-sm leading-6">
                        <p>
                          <span className="font-medium text-white">Evidence:</span>{' '}
                          <span className="text-slate-300">{row.evidence}</span>
                        </p>
                        <p>
                          <span className="font-medium text-white">Fix:</span>{' '}
                          <span className="text-slate-300">{row.fix}</span>
                        </p>
                        <p>
                          <span className="font-medium text-white">Expected lift:</span>{' '}
                          <span className="text-slate-300">{row.lift}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section {...sectionFade} className="mt-6">
            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5 lg:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl brand-title">Live recommendation evidence linkage</h2>
                  <span className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-charcoal-light text-white/70">
                    {liveEvidenceState === 'loading'
                      ? 'Loading'
                      : liveEvidenceState === 'ready'
                        ? 'Live'
                        : 'Unavailable'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Score Fix recommendations are tied to evidence IDs from your latest stored audit
                  whenever available. This keeps remediation grounded in measured findings, not
                  generic copy edits.
                </p>

                {liveEvidenceState === 'loading' && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                    Pulling your latest audit evidence…
                  </div>
                )}

                {liveEvidenceState !== 'loading' && liveEvidenceRows.length === 0 && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                    No live audit evidence is available on this account yet. Run an audit, then
                    return to map recommendations to evidence.
                  </div>
                )}

                {liveEvidenceRows.length > 0 && (
                  <div className="mt-4 grid gap-3">
                    {liveEvidenceRows.map((row) => (
                      <div
                        key={row.key}
                        className="rounded-xl border border-white/10 bg-slate-950/50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white">
                            {row.recommendation.title || 'Recommendation'}
                          </h3>
                          <span className="text-[11px] text-slate-400 uppercase tracking-[0.14em]">
                            {row.recommendation.priority || 'priority'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-300">
                          {row.recommendation.description ||
                            row.recommendation.implementation ||
                            'No description provided.'}
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {(Array.isArray(row.recommendation.evidence_ids)
                            ? row.recommendation.evidence_ids.slice(0, 3)
                            : []
                          ).map((id) => {
                            const ev = liveEvidenceById[id];
                            return (
                              <div
                                key={id}
                                className="rounded-lg border border-white/10 bg-charcoal-light/40 px-2.5 py-2"
                              >
                                <div className="text-[11px] font-medium text-emerald-200">{id}</div>
                                <div className="text-[11px] text-slate-300 mt-0.5">
                                  {ev?.label || ev?.source || 'Evidence item'}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {String(ev?.value || ev?.status || 'Linked')}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>

          <motion.section {...sectionFade} className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                    <Link2 className="h-5 w-5 text-emerald-300" />
                  </div>
                  <h2 className="text-2xl brand-title">What each automated PR contains</h2>
                </div>
                <div className="mt-6 space-y-3">
                  {deliverables.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span className="text-sm leading-6 text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                    <AuditEngineIcon className="h-5 w-5 text-amber-300" />
                  </div>
                  <h2 className="text-2xl brand-title">Proof structure</h2>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {proofCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4"
                    >
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        {card.label}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">{card.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{card.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section {...sectionFade} className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5">
                <h2 className="text-2xl brand-title">Implementation checklist</h2>
                <div className="mt-6 grid gap-3">
                  {[
                    'Exact H1 aligned to service intent',
                    'Hero copy with audience and outcome clarity',
                    'Direct answer section near top of page',
                    'Proof-backed claim sections',
                    'Concise FAQ answers',
                    'Schema aligned to visible copy',
                    'Internal links to pricing, reports, methodology, and proof pages',
                    'Freshness marker or last updated signal',
                    'Clear remediation CTA',
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-6 text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5">
                <h2 className="text-2xl brand-title">FAQ for retrieval and buyer clarity</h2>
                <div className="mt-6 space-y-4">
                  {faq.map((item) => (
                    <div
                      key={item.q}
                      className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4"
                    >
                      <h3 className="text-lg font-medium text-white">{item.q}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{item.a}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section {...sectionFade} className="mt-6">
            <Card className="rounded-[22px] border-amber-400/20 bg-amber-400/10 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5 lg:p-6">
                <h2 className="text-2xl font-semibold tracking-tight text-amber-100">
                  Structured data and trust notes
                </h2>
                <p className="mt-4 max-w-5xl text-sm leading-7 text-amber-50/90 sm:text-base">
                  Deploy Organization, WebSite, WebPage, Service, BreadcrumbList, and FAQPage schema
                  where appropriate. Keep all values aligned to what the page visibly says. Do not
                  claim entities, offers, or facts in JSON-LD that the page itself does not support.
                  For trust posture, reinforce methodology, evidence source clarity, and visible
                  last-updated signals.
                </p>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section {...sectionFade} className="mt-6">
            <Card className="overflow-hidden rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
              <CardContent className="relative p-4 sm:p-5 lg:p-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.16),transparent_22%),radial-gradient(circle_at_10%_90%,rgba(59,130,246,0.14),transparent_20%)]" />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                      Ready to fix the weak points
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                      Turn the audit into real page changes
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-200 sm:text-base">
                      Score Fix is for pages that need stronger machine-readable clarity, trust
                      posture, and evidence density. Connect your GitHub repo via MCP and let Score
                      Fix generate the PRs automatically.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/pricing?intent=score-fix&plan=score-fix&source=score-fix-cta-bottom"
                      className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-medium bg-charcoal text-white border-2 border-black/85 hover:bg-charcoal-light transition-all duration-200"
                    >
                      Get Score Fix AutoFix PR
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                    <Link
                      to="/pricing?source=score-fix-compare"
                      className="inline-flex items-center justify-center rounded-2xl border-2 border-black/85 bg-transparent hover:bg-charcoal-light text-white/80 px-5 py-3 text-sm transition-all duration-200"
                    >
                      Compare audit tiers
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <footer className="px-1 pb-6 pt-8 text-sm text-slate-500">
            Last updated: March 2026 · Evidence-validated remediation for enterprise white-label
            delivery.
          </footer>
        </div>
      )}
    </>
  );
}

export const scoreFixSeo = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  canonical: PAGE_URL,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: 'AiVIS.biz',
    images: [
      {
        url: OG_IMAGE,
        alt: 'AiVIS.biz AI Visibility Score Fix page preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    image: OG_IMAGE,
  },
};

export { scoreFixJsonLd };
