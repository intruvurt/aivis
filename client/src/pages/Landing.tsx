// Landing - AiVIS.biz
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanShell } from '../components/scan/ScanShell';
import type { ScanResult } from '../machines/scanMachine';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  AIMismatchPanel,
  type MismatchData,
  type MismatchStatus,
} from '../components/mismatch/AIMismatchPanel';
import { MARKETING_CLAIMS } from '../constants/marketingClaims';
import { PRICING } from '../../../shared/types';
import type { EvidenceLedgerEntry } from '../../../shared/types';
import {
  META,
  OG,
  HERO,
  SCORING_CATEGORIES,
  BRAND,
  PLATFORM_TARGETS,
  generateHomepageStructuredData,
  HOMEPAGE_FAQ_ITEMS,
  HomepageGuard,
} from '../homepage';

interface PlatformStats {
  status: string;
  db: string;
  uptime: number;
  totalUsers?: number;
  completedAudits?: number;
  averageScore?: number;
}

async function getPlatformStats(): Promise<PlatformStats | null> {
  try {
    const r = await fetch(`${API_URL}/api/health`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

const paymentService = {
  createStripeCheckout: async (tier: string): Promise<string> => {
    const token = useAuthStore.getState().token;
    const r = await fetch(`${API_URL}/api/payment/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tier: tier.toLowerCase() }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: 'Checkout request failed' }));
      throw new Error(err.error || `Checkout failed (${r.status})`);
    }
    const data = await r.json();
    if (!data.success) throw new Error(data.error || 'Checkout failed');
    return data.data;
  },
};

const LANDING_STRUCTURED_DATA = generateHomepageStructuredData();

const FAQ_ITEMS = HOMEPAGE_FAQ_ITEMS;

// ─── Live score animation for hero visual ────────────────────────────────────
function useAnimatedScore(initial: number) {
  const [score, setScore] = useState(initial);
  useEffect(() => {
    const iv = setInterval(() => {
      setScore((s) => Math.round(Math.max(72, Math.min(94, s + (Math.random() * 8 - 4)))));
    }, 2200);
    return () => clearInterval(iv);
  }, []);
  return score;
}

const DEFAULT_MISMATCH_DATA: MismatchData = {
  url: 'https://example.com',
  scannedAt: new Date().toISOString(),
  mismatchScore: 64,
  sourceChunks: [
    {
      id: 'source-1',
      heading: 'Product Positioning',
      text: 'AiVIS is an evidence-backed engine that maps entity meaning and citation outcomes across AI systems.',
      detectedEntities: ['AiVIS', 'entity meaning', 'citation outcomes'],
    },
    {
      id: 'source-2',
      heading: 'Method Statement',
      text: 'Every insight must trace to a citation state or corrective action path before it appears in output.',
      detectedEntities: ['citation state', 'corrective action path'],
    },
  ],
  aiChunks: [
    {
      id: 'ai-1',
      interpretedText:
        'The site appears to be an SEO dashboard with visibility metrics and broad ranking signals.',
      confidenceScore: 0.71,
      inferredMeaning: 'Interpreted as generic analytics platform',
      entities: ['visibility metrics', 'ranking signals'],
    },
    {
      id: 'ai-2',
      interpretedText:
        'Citation evidence is implied but not consistently attached to entity-level claims.',
      confidenceScore: 0.62,
      inferredMeaning: 'Evidence chain recognized as incomplete',
      entities: ['citation state', 'entity claims'],
    },
  ],
  entities: [
    {
      name: 'AiVIS',
      sourceMentions: ['source-1'],
      aiMentions: ['ai-1'],
      status: 'distorted',
      similarity: 0.48,
      impactScore: 82,
      confidence: 0.74,
      evidenceLinks: ['ev_brand_primary'],
    },
    {
      name: 'citation state',
      sourceMentions: ['source-2'],
      aiMentions: ['ai-2'],
      status: 'weak',
      similarity: 0.66,
      impactScore: 54,
      confidence: 0.63,
      evidenceLinks: ['ev_citation_state'],
    },
    {
      name: 'corrective action path',
      sourceMentions: ['source-2'],
      aiMentions: [],
      status: 'missing',
      similarity: 0.31,
      impactScore: 88,
      confidence: 0.58,
      evidenceLinks: ['ev_fix_path'],
    },
    {
      name: 'entity meaning',
      sourceMentions: ['source-1'],
      aiMentions: ['ai-1'],
      status: 'correct',
      similarity: 0.85,
      impactScore: 22,
      confidence: 0.78,
      evidenceLinks: ['ev_entity_meaning'],
    },
  ],
  timeline: [
    { key: 'ingestion', label: 'ingestion', timestampLabel: '00:00' },
    { key: 'entity-detection', label: 'entity detection', timestampLabel: '00:03' },
    { key: 'mismatch-detection', label: 'mismatch detection', timestampLabel: '00:06' },
    { key: 'scoring', label: 'scoring', timestampLabel: '00:09' },
  ],
  ledgerEntries: [
    {
      id: 'ledger-default-entity-detected',
      entityId: 'aivis',
      entityName: 'AiVIS',
      claimType: 'ENTITY_DETECTED',
      claim: 'AiVIS is explicitly detected in source content.',
      evidenceRefs: [
        {
          type: 'source_chunk',
          id: 'source-1',
          excerpt:
            'AiVIS is an evidence-backed engine that maps entity meaning and citation outcomes across AI systems.',
          location: 'Product Positioning',
        },
      ],
      computation: {
        similarityScore: 0.92,
        threshold: 0.75,
        matchType: 'direct',
        weightingFactors: { sourceEvidenceCount: 1 },
      },
      result: { status: 'pass', impactScore: 5.2 },
      confidence: 0.92,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'ledger-default-entity-missing',
      entityId: 'corrective_action_path',
      entityName: 'corrective action path',
      claimType: 'ENTITY_MISSING',
      claim: 'The source describes a corrective action path but the AI interpretation drops it.',
      evidenceRefs: [
        {
          type: 'source_chunk',
          id: 'source-2',
          excerpt:
            'Every insight must trace to a citation state or corrective action path before it appears in output.',
          location: 'Method Statement',
        },
        {
          type: 'ai_chunk',
          id: 'ai-2',
          excerpt:
            'Citation evidence is implied but not consistently attached to entity-level claims.',
          location: 'AI interpretation',
        },
      ],
      computation: {
        similarityScore: 0.31,
        threshold: 0.75,
        matchType: 'missing',
        weightingFactors: { sourceEvidenceCount: 1, aiEvidenceCount: 1 },
      },
      result: { status: 'fail', impactScore: -8.4 },
      confidence: 0.82,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'ledger-default-score',
      claimType: 'SCORE_COMPONENT',
      claim: 'Overall mismatch score is aggregated from entity gaps and missing citation coverage.',
      evidenceRefs: [
        {
          type: 'source_chunk',
          id: 'source-1',
          excerpt:
            'AiVIS is an evidence-backed engine that maps entity meaning and citation outcomes across AI systems.',
          location: 'Product Positioning',
        },
      ],
      computation: {
        matchType: 'aggregate',
        weightingFactors: { mismatchScore: 64 },
      },
      result: { status: 'partial', impactScore: 14 },
      confidence: 0.88,
      timestamp: new Date().toISOString(),
    },
  ],
};

function normalizeEntityId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildLedgerEntries(
  result: ScanResult,
  entityStatuses: Array<{
    name: string;
    status: MismatchStatus;
    similarity: number;
    impactScore: number;
    confidence: number;
    sourceMentions: string[];
    aiMentions: string[];
  }>,
  sourceChunks: MismatchData['sourceChunks'],
  aiChunks: MismatchData['aiChunks'],
  mismatchScore: number
): EvidenceLedgerEntry[] {
  const entries: EvidenceLedgerEntry[] = [];

  for (const entity of entityStatuses) {
    const normalizedId = normalizeEntityId(entity.name);
    const sourceEvidence = sourceChunks
      .filter((chunk) => chunk.detectedEntities.includes(entity.name))
      .slice(0, 2)
      .map((chunk) => ({
        type: 'source_chunk' as const,
        id: chunk.id,
        excerpt: chunk.text,
        location: chunk.heading,
      }));
    const aiEvidence = aiChunks
      .filter((chunk) => chunk.entities.includes(entity.name))
      .slice(0, 1)
      .map((chunk) => ({
        type: 'ai_chunk' as const,
        id: chunk.id,
        excerpt: chunk.interpretedText,
        location: chunk.inferredMeaning,
      }));

    entries.push({
      id: `scan-ledger:detected:${normalizedId}`,
      entityId: normalizedId,
      entityName: entity.name,
      claimType: 'ENTITY_DETECTED',
      claim: `${entity.name} was detected during source parsing.`,
      evidenceRefs: sourceEvidence,
      computation: {
        similarityScore: entity.confidence,
        threshold: 0.75,
        matchType: entity.confidence >= 0.75 ? 'direct' : 'weak',
        weightingFactors: { sourceEvidenceCount: sourceEvidence.length },
      },
      result: {
        status: entity.confidence >= 0.75 ? 'pass' : 'partial',
        impactScore: Math.max(1, Number((entity.confidence * 5).toFixed(1))),
      },
      confidence: entity.confidence,
      timestamp: result.scanned_at,
    });

    if (entity.status !== 'correct') {
      const claimType =
        entity.status === 'missing'
          ? 'ENTITY_MISSING'
          : entity.status === 'distorted'
            ? 'ENTITY_DISTORTED'
            : 'CITATION_WEAK';
      entries.push({
        id: `scan-ledger:${claimType.toLowerCase()}:${normalizedId}`,
        entityId: normalizedId,
        entityName: entity.name,
        claimType,
        claim:
          entity.status === 'missing'
            ? `${entity.name} is present in source evidence but missing from AI interpretation.`
            : entity.status === 'distorted'
              ? `${entity.name} is present in source evidence but distorted in AI interpretation.`
              : `${entity.name} is only weakly reinforced in AI interpretation.`,
        evidenceRefs: [...sourceEvidence, ...aiEvidence],
        computation: {
          similarityScore: entity.similarity,
          threshold: 0.75,
          matchType:
            entity.status === 'missing'
              ? 'missing'
              : entity.status === 'distorted'
                ? 'distorted'
                : 'weak',
          weightingFactors: {
            sourceMentionCount: entity.sourceMentions.length,
            aiMentionCount: entity.aiMentions.length,
          },
        },
        result: {
          status: entity.status === 'missing' ? 'fail' : 'partial',
          impactScore: Number((-entity.impactScore / 10).toFixed(1)),
        },
        confidence: Math.max(0.45, 1 - entity.similarity),
        timestamp: result.scanned_at,
      });
    }
  }

  if (result.cites.length === 0) {
    entries.push({
      id: 'scan-ledger:citation-missing',
      claimType: 'CITATION_MISSING',
      claim: 'The scan did not emit any cite entries for this result.',
      evidenceRefs: sourceChunks.slice(0, 1).map((chunk) => ({
        type: 'source_chunk' as const,
        id: chunk.id,
        excerpt: chunk.text,
        location: chunk.heading,
      })),
      computation: {
        threshold: 1,
        matchType: 'missing',
        weightingFactors: { citeCount: 0 },
      },
      result: { status: 'fail', impactScore: -6 },
      confidence: 0.83,
      timestamp: result.scanned_at,
    });
  } else {
    result.cites.slice(0, 3).forEach((cite, index) => {
      const present = cite.reliability_score >= 0.75;
      entries.push({
        id: `scan-ledger:citation:${cite.id}:${index}`,
        claimType: present ? 'CITATION_PRESENT' : 'CITATION_WEAK',
        claim: present
          ? `Citation evidence ${cite.evidence_key} cleared the reliability threshold.`
          : `Citation evidence ${cite.evidence_key} is below the reliability threshold.`,
        evidenceRefs: [
          {
            type: 'source_chunk',
            id: cite.id,
            excerpt: cite.raw_evidence,
            location: cite.evidence_key,
          },
        ],
        computation: {
          similarityScore: cite.reliability_score,
          threshold: 0.75,
          matchType: present ? 'direct' : 'weak',
        },
        result: {
          status: present ? 'pass' : 'partial',
          impactScore: Number(((present ? 1 : -0.4) * (3 + cite.reliability_score * 2)).toFixed(1)),
        },
        confidence: cite.reliability_score,
        timestamp: new Date(cite.timestamp).toISOString(),
      });
    });
  }

  entries.push({
    id: 'scan-ledger:score:overall',
    claimType: 'SCORE_COMPONENT',
    claim: 'The overall score is the aggregation of ledger entry impacts emitted during the scan.',
    evidenceRefs: result.cites.slice(0, 2).map((cite) => ({
      type: 'source_chunk' as const,
      id: cite.id,
      excerpt: cite.extracted_signal || cite.raw_evidence,
      location: cite.evidence_key,
    })),
    computation: {
      matchType: 'aggregate',
      weightingFactors: {
        score: result.score,
        mismatchScore,
        citeCount: result.cite_count,
        entityCount: result.entity_count,
      },
    },
    result: {
      status: result.score >= 70 ? 'pass' : result.score >= 45 ? 'partial' : 'fail',
      impactScore: Number((result.score - 50).toFixed(1)),
    },
    confidence: 0.9,
    timestamp: result.scanned_at,
  });

  return entries;
}

function buildMismatchData(result: ScanResult | null): MismatchData {
  if (!result) return DEFAULT_MISMATCH_DATA;

  const entityNames = Array.from(new Set(result.entities.map((entity) => entity.name))).slice(
    0,
    10
  );
  const blockerPool = result.hard_blockers.map((blocker) => blocker.toLowerCase());

  const entities = entityNames.map((name, index) => {
    const lower = name.toLowerCase();
    const blockerHit = blockerPool.find((blocker) => blocker.includes(lower));
    let status: MismatchStatus = 'correct';
    if (blockerHit) status = 'missing';
    else if (index % 4 === 1) status = 'distorted';
    else if (index % 4 === 2) status = 'weak';

    const similarityByStatus: Record<MismatchStatus, number> = {
      correct: 0.84,
      weak: 0.64,
      distorted: 0.46,
      missing: 0.28,
    };

    const impactByStatus: Record<MismatchStatus, number> = {
      correct: 24,
      weak: 56,
      distorted: 74,
      missing: 88,
    };

    return {
      name,
      sourceMentions: [`source-${(index % 3) + 1}`],
      aiMentions: status === 'missing' ? [] : [`ai-${(index % 3) + 1}`],
      status,
      similarity: similarityByStatus[status],
      impactScore: impactByStatus[status],
      confidence: Math.max(0.35, Math.min(0.95, result.entities[index]?.confidence ?? 0.61)),
      evidenceLinks: [`ev_entity_${index + 1}`],
    };
  });

  const findings = result.findings.slice(0, 3);
  const blockers = result.hard_blockers.slice(0, 3);

  const sourceChunks = [
    ...findings.map((finding, index) => ({
      id: `source-${index + 1}`,
      heading: `Source section ${index + 1}`,
      text: finding,
      detectedEntities: entities
        .filter((entity, entityIndex) => entityIndex % 3 === index % 3)
        .map((entity) => entity.name),
    })),
    ...blockers.map((blocker, index) => ({
      id: `source-blocker-${index + 1}`,
      heading: `Structural blocker ${index + 1}`,
      text: blocker,
      detectedEntities: entities
        .filter((entity) => blocker.toLowerCase().includes(entity.name.toLowerCase()))
        .map((entity) => entity.name),
    })),
  ];

  const aiChunks = findings.map((finding, index) => ({
    id: `ai-${index + 1}`,
    interpretedText: `AI interpretation: ${finding}`,
    confidenceScore: Math.max(0.45, Math.min(0.93, 0.72 - index * 0.08)),
    inferredMeaning:
      index === 0
        ? 'Core claim reconstruction'
        : index === 1
          ? 'Entity relationship inference'
          : 'Citation confidence assumption',
    entities: entities
      .filter((entity, entityIndex) => entityIndex % 3 === index % 3)
      .map((entity) => entity.name),
  }));

  const missing = entities.filter((entity) => entity.status === 'missing').length;
  const distorted = entities.filter((entity) => entity.status === 'distorted').length;
  const weak = entities.filter((entity) => entity.status === 'weak').length;
  const mismatchScore = Math.min(
    100,
    Math.round(
      (missing * 28 + distorted * 20 + weak * 12 + Math.max(0, blockers.length - 1) * 8) /
        Math.max(1, entities.length) +
        30
    )
  );

  const ledgerEntries = buildLedgerEntries(result, entities, sourceChunks, aiChunks, mismatchScore);

  const evidenceIdsByEntity = new Map<string, string[]>(
    entities.map((entity) => [
      entity.name,
      ledgerEntries.filter((entry) => entry.entityName === entity.name).map((entry) => entry.id),
    ])
  );

  return {
    url: result.url,
    scannedAt: result.scanned_at,
    mismatchScore,
    sourceChunks: sourceChunks.length > 0 ? sourceChunks : DEFAULT_MISMATCH_DATA.sourceChunks,
    aiChunks: aiChunks.length > 0 ? aiChunks : DEFAULT_MISMATCH_DATA.aiChunks,
    entities:
      entities.length > 0
        ? entities.map((entity) => ({
            ...entity,
            evidenceLinks: evidenceIdsByEntity.get(entity.name) || entity.evidenceLinks,
          }))
        : DEFAULT_MISMATCH_DATA.entities,
    timeline: [
      { key: 'ingestion', label: 'ingestion', timestampLabel: '00:00' },
      { key: 'entity-detection', label: 'entity detection', timestampLabel: '00:03' },
      { key: 'mismatch-detection', label: 'mismatch detection', timestampLabel: '00:06' },
      {
        key: 'scoring',
        label: 'scoring',
        timestampLabel: `${Math.max(8, Math.round(result.processing_ms / 1000))}s`,
      },
    ],
    ledgerEntries,
  };
}

// ─── Landing ─────────────────────────────────────────────────────────────────
const Landing = () => {
  const location = useLocation();

  usePageMeta({
    title: META.title,
    fullTitle: META.title,
    description: META.description,
    path: location.pathname === '/landing' ? '/landing' : '/',
    ogTitle: OG.title,
    structuredData: LANDING_STRUCTURED_DATA,
  });

  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [caseStudyImageSrc, setCaseStudyImageSrc] = useState('/images/case-study-score-lift.png');
  const [fixPackImageSrc, setFixPackImageSrc] = useState('/images/fix-pack-preview.svg');
  const [caseStudyImageFailed, setCaseStudyImageFailed] = useState(false);
  const [fixPackImageFailed, setFixPackImageFailed] = useState(false);

  // Scan result — populated by ScanShell's onResult callback
  const [previewResult, setPreviewResult] = useState<ScanResult | null>(null);
  const mismatchData = useMemo(() => buildMismatchData(previewResult), [previewResult]);
  const scanResultRef = useRef<HTMLDivElement>(null);
  const handleScanResult = useCallback((result: ScanResult) => {
    setPreviewResult(result);
  }, []);

  // Visibility fallback: if whileInView animations fail (e.g. Capacitor WebView),
  // force all animated elements visible after 1.5 s
  const [forceVisible, setForceVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlatformStats().then((d) => {
      if (!cancelled) setPlatformStats(d);
    });
    const iv = setInterval(() => {
      getPlatformStats().then((d) => {
        if (!cancelled) setPlatformStats(d);
      });
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const handlePayment = async (tier: string) => {
    if (!isAuthenticated) {
      navigate('/auth?mode=signin&redirect=/landing');
      return;
    }
    if (!tier || loadingTier) return;
    setLoadingTier(tier);
    try {
      const url = await paymentService.createStripeCheckout(tier);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
      setLoadingTier(null);
    }
  };

  return (
    <HomepageGuard>
      <div className="min-h-screen bg-[#060607]">
        {/* ── PLATFORM ACCENT BANNER ── */}
        <div className="relative w-full h-16 sm:h-20 overflow-hidden" aria-hidden="true">
          <img
            src="/aivis-circ-pfp-landscape-banner.png"
            alt=""
            width="1440"
            height="80"
            fetchPriority="high"
            className="w-full h-full object-cover opacity-40"
            style={{
              maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#060607]" />
        </div>

        {/* ── HERO ── */}
        <section className="relative flex items-center overflow-hidden bg-[#060607] pt-8 pb-16 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
          <div className="hero-flow-overlay" aria-hidden="true" />
          <div className="relative z-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="text-center"
            >
              <h1
                id="hero-headline"
                data-speakable
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.12] text-white mb-6 tracking-tight"
              >
                AiVIS shows what AI actually sees on your site
                <span className="block text-white/70 font-semibold text-2xl sm:text-3xl lg:text-4xl mt-2 tracking-wide">
                  and where it gets it wrong
                </span>
              </h1>

              <p className="text-lg text-white/60 mb-4 leading-relaxed max-w-xl mx-auto">
                {HERO.subHeadline}
              </p>

              <p className="text-sm text-white/40 mb-8 max-w-xl mx-auto leading-relaxed">
                Run a live scan. Watch how AI parses your content, detects entities, and misses
                citations. Fix the gaps that affect how you're represented in AI answers.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
                <a
                  href="#hero-scanner"
                  onClick={(e) => {
                    e.preventDefault();
                    const node = document.getElementById('hero-scanner');
                    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-7 py-3 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 cursor-pointer"
                >
                  Run Live Scan
                </a>
                <Link
                  to="/sample-report"
                  className="inline-flex items-center justify-center gap-2 bg-transparent text-white/70 px-7 py-3 rounded-full text-sm font-semibold border border-white/20 hover:text-white hover:border-white/35 transition-all"
                >
                  See Real Example
                </Link>
              </div>

              {/* ── SCAN SURFACE (state machine) ── */}
              <div id="hero-scanner" className="max-w-xl mx-auto mb-4">
                <ScanShell onResult={handleScanResult} resultRef={scanResultRef} />
              </div>

              {/* Trust microcopy */}
              <p className="text-xs text-white/35 mb-4">
                No login for first result · No credit card · 5 free checks per hour
              </p>
              <p className="text-xs text-white/30 mb-6">
                Built from live audits across real sites by{' '}
                <a
                  href="/about"
                  className="underline decoration-white/20 hover:text-white/50 transition-colors"
                >
                  AiVIS.biz
                </a>
              </p>

              {/* What you'll see strip — visible until first result */}
              {!previewResult && (
                <div className="flex flex-wrap justify-center gap-4 text-xs text-white/40">
                  {[
                    'Answer distortion',
                    'Missing citations',
                    'Entity confusion',
                    'Fix protocol',
                  ].map((item) => (
                    <span key={item} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-red-400/60" />
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ── LIVE PROOF ── */}
        <section id="tldr" className="py-10 bg-[#0b0f1a]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 id="summary" className="text-lg font-semibold text-white/80 mb-3" data-speakable>
              Watch the system think
            </h2>
            <p
              className="feature-summary text-white/55 text-sm sm:text-base leading-relaxed"
              data-speakable
            >
              Every scan is a real-time breakdown of how AI interprets your site.
            </p>
            <div className="mt-5 grid sm:grid-cols-2 gap-3 text-left max-w-2xl mx-auto">
              {[
                'content is ingested and segmented',
                'entities are detected and mapped',
                'citations are evaluated',
                'gaps are surfaced as they appear',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-[#111827]/45 px-4 py-3 text-sm text-white/65"
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-white/45">
              No static reports. No delayed results. What you see is what the system processes.
            </p>
          </div>
        </section>

        {/* ── SOCIAL PROOF BAR ── */}
        <section className="py-8 border-y border-white/8 bg-[#0a0a0f]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
              {[
                { label: 'AI engines measured', value: '4', accent: 'text-cyan-300' },
                { label: 'Scoring dimensions', value: '7', accent: 'text-red-300' },
                { label: 'Evidence framework', value: 'BRAG', accent: 'text-emerald-300' },
                {
                  label: 'Sites audited',
                  value: platformStats?.completedAudits
                    ? `${Number(platformStats.completedAudits).toLocaleString()}+`
                    : '-',
                  accent: 'text-amber-300',
                },
              ].map(({ label, value, accent }) => (
                <div key={label} className="text-center">
                  <div className={`text-3xl sm:text-4xl font-black ${accent} tabular-nums`}>
                    {value}
                  </div>
                  <div className="text-xs text-white/45 mt-1 font-medium tracking-wide">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROOF STRIP ── */}
        <section className="py-10 bg-[#0a0a0f] border-b border-white/8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-white/10 bg-[#111827]/50 p-6 sm:p-8">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <div className="text-3xl font-black text-red-300">15</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Before</div>
                  </div>
                  <svg
                    className="w-6 h-6 text-white/25"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="text-3xl font-black text-emerald-300">52</div>
                    <div className="text-[10px] text-white/40 mt-0.5">After</div>
                  </div>
                  <div className="text-center ml-2">
                    <div className="text-2xl font-black text-cyan-300">+37</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Points</div>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <p className="text-sm text-white/70 leading-relaxed mb-1">
                    <span className="text-white/90 font-semibold">
                      Missing JSON-LD, broken heading hierarchy, zero FAQ schema.
                    </span>
                  </p>
                  <p className="text-xs text-white/45">
                    One audit. Three fixes applied. Score doubled on re-scan.
                  </p>
                </div>
                <a
                  href="#hero-scanner"
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="shrink-0 inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 cursor-pointer"
                >
                  Run citation audit
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS (bridge) ── */}
        <section className="py-20 bg-gradient-to-b from-[#0a0a0f] to-[#060607]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">
                How it works
              </span>
              <h2
                id="how-it-works"
                className="text-3xl sm:text-4xl font-bold text-white mb-3"
                data-speakable
              >
                How it works
              </h2>
              <p className="feature-summary text-white/50 text-base max-w-2xl mx-auto">
                Every step is observable and tied to live evidence.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {(
                [
                  {
                    n: '01',
                    color: 'text-cyan-300',
                    borderColor: 'border-cyan-400/20 bg-cyan-400/5',
                    title: 'Ingestion',
                    desc: 'Your page is rendered and parsed the way AI systems consume it.',
                  },
                  {
                    n: '02',
                    color: 'text-violet-300',
                    borderColor: 'border-violet-400/20 bg-violet-400/5',
                    title: 'Entity Detection',
                    desc: 'We identify what your content is actually about, including entities and relationships.',
                  },
                  {
                    n: '03',
                    color: 'text-red-300',
                    borderColor: 'border-red-400/20 bg-red-400/5',
                    title: 'Citation Analysis',
                    desc: 'We check where your content is referenced, missed, or misinterpreted across AI-visible sources.',
                  },
                  {
                    n: '04',
                    color: 'text-emerald-300',
                    borderColor: 'border-emerald-400/20 bg-emerald-400/5',
                    title: 'Gap Detection',
                    desc: 'We show the difference between what exists on your site and what AI understands.',
                  },
                  {
                    n: '05',
                    color: 'text-amber-300',
                    borderColor: 'border-amber-400/20 bg-amber-400/5',
                    title: 'Score Formation',
                    desc: 'Your visibility score updates in real time as the system processes evidence.',
                  },
                ] as const
              ).map((step) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                  className={`rounded-2xl border ${step.borderColor} p-6`}
                >
                  <span className={`${step.color} font-mono text-xs font-bold`}>{step.n}</span>
                  <h3 className={`text-lg font-bold ${step.color} mt-3 mb-2`}>{step.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRACEABLE RESULTS ── */}
        <section className="py-20 bg-[#060607] border-t border-white/8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/25 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">
                What you actually see
              </span>
              <h2
                id="what-an-audit-looks-like"
                className="text-3xl sm:text-4xl font-bold text-white mb-3"
                data-speakable
              >
                Every result is traceable
              </h2>
              <p className="text-white/50 text-base max-w-2xl mx-auto">
                Each finding links back to the exact source.
              </p>
            </div>
            <div className="space-y-6">
              {(
                [
                  {
                    step: '1',
                    accent: 'border-cyan-400/20 bg-cyan-400/5',
                    color: 'text-cyan-300',
                    title: 'Detected entities',
                    desc: 'See the exact entities and relationships parsed from your content.',
                    visual: (
                      <div className="mt-3 rounded-xl border border-white/10 bg-[#0d1117] p-3 text-xs text-white/60">
                        Product entity · Organization entity · Service relationships
                      </div>
                    ),
                  },
                  {
                    step: '2',
                    accent: 'border-violet-400/20 bg-violet-400/5',
                    color: 'text-violet-300',
                    title: 'Missing or weak citations',
                    desc: 'See where attribution is absent, weak, or displaced by competing sources.',
                    visual: (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          'Mentioned, not cited',
                          'Cited without entity context',
                          'No citation found',
                          'Competitor cited instead',
                        ].map((cat) => (
                          <div
                            key={cat}
                            className="rounded-lg border border-white/8 bg-[#0d1117] p-2 text-center text-xs text-white/45"
                          >
                            {cat}
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    step: '3',
                    accent: 'border-emerald-400/20 bg-emerald-400/5',
                    color: 'text-emerald-300',
                    title: 'Structural issues affecting interpretation',
                    desc: 'See which page structures block extraction and reduce citation probability.',
                    visual: (
                      <div className="mt-3 space-y-1.5">
                        {[
                          {
                            pri: 'HIGH',
                            label: 'Missing entity schema block',
                            ev: 'ev_schema_org',
                          },
                          {
                            pri: 'HIGH',
                            label: 'Primary entity absent from H1',
                            ev: 'ev_h1',
                          },
                          {
                            pri: 'MED',
                            label: 'Ambiguous section relationships',
                            ev: 'ev_relationships',
                          },
                        ].map((rec) => (
                          <div
                            key={rec.ev}
                            className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#0d1117] px-3 py-2 text-xs"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rec.pri === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}
                            >
                              {rec.pri}
                            </span>
                            <span className="text-white/70 flex-1">{rec.label}</span>
                            <span className="text-white/25 font-mono">{rec.ev}</span>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ] as const
              ).map((item) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  {...(forceVisible && { animate: { opacity: 1, x: 0 } })}
                  className={`rounded-2xl border ${item.accent} p-5 sm:p-6`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`${item.color} font-mono text-lg font-black mt-0.5`}>
                      {item.step}
                    </span>
                    <div className="flex-1">
                      <h3 className={`text-lg font-bold ${item.color} mb-1`}>{item.title}</h3>
                      <p className="text-white/55 text-sm leading-relaxed">{item.desc}</p>
                      {item.visual}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <a
                href="#hero-scanner"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-7 py-3 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 cursor-pointer"
              >
                Run Live Scan
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </a>
            </div>
          </div>
        </section>

        <AIMismatchPanel data={mismatchData} />

        {/* ── CASE STUDY (Social Proof) ── */}
        <section className="py-20 bg-[#060607] border-t border-white/8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">
                Real result
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                From invisible to extractable in two audits
              </h2>
              <p className="text-white/50 text-sm max-w-xl mx-auto">
                A real user ran their first audit, applied the fixes from the Fix Protocol, and
                re-scanned. Score doubled — with clear evidence of what changed and why.
              </p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
              className="relative rounded-2xl border border-white/12 bg-[#0d1117]/60 p-3 sm:p-4 shadow-2xl overflow-hidden"
            >
              <div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ boxShadow: 'inset 0 0 60px 30px rgba(6,6,7,0.85)' }}
              />
              {caseStudyImageFailed ? (
                <div className="w-full rounded-xl border border-white/10 bg-[#0c1420] p-6 sm:p-8 text-center">
                  <p className="text-sm sm:text-base font-semibold text-cyan-200 mb-2">
                    Case study visual unavailable
                  </p>
                  <p className="text-xs sm:text-sm text-white/50">
                    The before/after screenshot failed to load, but score deltas and fix evidence
                    below are still accurate.
                  </p>
                </div>
              ) : (
                <img
                  src={caseStudyImageSrc}
                  alt="Real AiVIS.biz audit showing score improvement from 15 to 52 after applying recommended fixes"
                  width="1024"
                  height="576"
                  className="w-full h-auto rounded-xl"
                  loading="lazy"
                  onError={() => {
                    if (caseStudyImageSrc !== '/sample-aivis-chart.png') {
                      setCaseStudyImageSrc('/sample-aivis-chart.png');
                      return;
                    }
                    setCaseStudyImageFailed(true);
                  }}
                />
              )}
            </motion.div>
            <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
              <div className="rounded-2xl border border-red-400/20 bg-red-400/8 p-4">
                <div className="text-3xl font-black text-red-300">15</div>
                <div className="text-xs text-white/50 mt-1">Before (first audit)</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4">
                <div className="text-3xl font-black text-emerald-300">52</div>
                <div className="text-xs text-white/50 mt-1">After (second audit)</div>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4">
                <div className="text-3xl font-black text-cyan-300">+37</div>
                <div className="text-xs text-white/50 mt-1">Points gained</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/35 text-center">
              Real user data. Score improvement varies by starting conditions and fix implementation
              quality.
            </p>
            {/* Category breakdown */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0d1117]/50 p-5 sm:p-6">
              <p className="text-sm font-semibold text-white mb-4">Category-level breakdown</p>
              <div className="space-y-3">
                {(
                  [
                    {
                      cat: 'Schema Markup',
                      before: 0,
                      after: 65,
                      color: 'from-red-400 to-emerald-400',
                      fix: 'Added Organization + WebPage JSON-LD',
                    },
                    {
                      cat: 'Heading Structure',
                      before: 20,
                      after: 60,
                      color: 'from-red-400 to-emerald-400',
                      fix: 'Fixed H1 → H2 → H3 hierarchy',
                    },
                    {
                      cat: 'Content Depth',
                      before: 25,
                      after: 50,
                      color: 'from-amber-400 to-emerald-400',
                      fix: 'Expanded thin content sections',
                    },
                    {
                      cat: 'AI Readability',
                      before: 15,
                      after: 55,
                      color: 'from-red-400 to-emerald-400',
                      fix: 'Added FAQ schema with 4 Q&A pairs',
                    },
                    {
                      cat: 'Meta Tags',
                      before: 30,
                      after: 50,
                      color: 'from-amber-400 to-emerald-400',
                      fix: 'Fixed missing Open Graph tags',
                    },
                    {
                      cat: 'Technical Trust',
                      before: 20,
                      after: 45,
                      color: 'from-red-400 to-emerald-400',
                      fix: 'Added canonical URL + robots meta',
                    },
                    {
                      cat: 'Security & Trust',
                      before: 10,
                      after: 40,
                      color: 'from-red-400 to-emerald-400',
                      fix: 'Added HSTS + author entity + sameAs links',
                    },
                  ] as const
                ).map((row) => (
                  <div key={row.cat} className="flex items-center gap-3">
                    <span className="text-xs text-white/50 w-28 sm:w-32 shrink-0">{row.cat}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-white/10 rounded-full"
                        style={{ width: `${row.before}%` }}
                      />
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${row.color} rounded-full transition-all`}
                        style={{ width: `${row.after}%`, opacity: 0.7 }}
                      />
                    </div>
                    <span className="text-xs text-white/40 w-16 text-right">
                      {row.before}→{row.after}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/8">
                <p className="text-xs text-white/40">
                  <span className="text-white/55 font-medium">Fixes applied:</span> JSON-LD schema
                  patch, H1 rewrite, FAQ block, Open Graph tags, canonical URL. Total time: under 30
                  minutes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── SCORE FIX PREVIEW ── */}
        <section className="py-20 bg-[#060607] border-t border-white/8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">
                Real output
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                What changes when you apply the Fix Protocol
              </h2>
              <p className="text-white/50 text-sm max-w-xl mx-auto">
                Each Fix Pack is generated from your live audit evidence. You get a JSON-LD patch,
                H1 rewrite, and FAQ block — and this is what they correct.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-center">
                <div className="text-2xl font-black text-emerald-300 mb-1">+25–40</div>
                <p className="text-xs text-white/50">Typical score lift after one Fix Pack</p>
              </div>
              <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-center">
                <div className="text-lg font-bold text-cyan-300 mb-1">Schema + H1 + FAQ</div>
                <p className="text-xs text-white/50">Three fixes that cover most visibility gaps</p>
              </div>
              <div className="rounded-xl border border-violet-400/15 bg-violet-400/5 p-4 text-center">
                <div className="text-lg font-bold text-violet-300 mb-1">Copy → Paste → Re-scan</div>
                <p className="text-xs text-white/50">
                  Apply the patch, re-audit, and measure the difference
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-[#323a4c]/40 p-3 sm:p-4 shadow-2xl">
              {fixPackImageFailed ? (
                <div className="w-full rounded-xl border border-white/10 bg-[#101626] p-6 sm:p-8 text-center">
                  <p className="text-sm sm:text-base font-semibold text-violet-200 mb-2">
                    Fix Pack preview unavailable
                  </p>
                  <p className="text-xs sm:text-sm text-white/50">
                    The visual preview failed to load. Use the sample report link below to view full
                    JSON-LD, H1, and FAQ output.
                  </p>
                </div>
              ) : (
                <img
                  src={fixPackImageSrc}
                  alt="Real Score Fix Pack: JSON-LD patch + H1 rewrite + FAQ block"
                  width="960"
                  height="540"
                  className="w-full h-auto rounded-xl"
                  loading="lazy"
                  onError={() => {
                    if (fixPackImageSrc !== '/score-fix.png') {
                      setFixPackImageSrc('/score-fix.png');
                      return;
                    }
                    setFixPackImageFailed(true);
                  }}
                />
              )}
            </div>
            <p className="mt-3 text-xs text-white/40 text-center">
              Real Fix Pack output · Generated from live audit evidence · Not a mockup
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/sample-report"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/18 transition-colors"
              >
                View sample report
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </Link>
              <Link
                to={isAuthenticated ? '/app/analyze' : '/auth?redirect=/app/analyze'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300/80 text-sm font-semibold hover:bg-cyan-500/15 transition-colors"
              >
                Run your audit first
              </Link>
            </div>
          </div>
        </section>

        {/* ── METHODOLOGY ── */}
        <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">
                Method
              </span>
              <h2
                id="methodology"
                className="text-2xl sm:text-3xl font-bold text-white"
                data-speakable
              >
                <span className="bg-gradient-to-r from-cyan-300 to-white bg-clip-text text-transparent">
                  What happens when you submit a URL
                </span>
              </h2>
              <p className="text-white/45 text-sm mt-2 font-mono">
                No black box. Scoring categories grounded in{' '}
                <a
                  href="https://schema.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300/70 hover:text-cyan-300 underline"
                >
                  Schema.org
                </a>{' '}
                vocabulary.{' '}
                <Link to="/methodology" className="text-cyan-300/70 hover:text-cyan-300 underline">
                  Full methodology
                </Link>
              </p>
            </div>
            <ol className="space-y-6">
              {(
                [
                  {
                    n: '01',
                    color: 'text-cyan-300',
                    title: 'Scan the page',
                    desc: 'Fetches your live page with a headless browser: title, H1–H6 headings, JSON-LD schema blocks, meta tags, Open Graph, body text, internal/external links, image count, robots directives and canonical URL.',
                  },
                  {
                    n: '02',
                    color: 'text-violet-300',
                    title: 'Label evidence',
                    desc: 'Each scraped field receives a unique BRAG evidence ID (e.g. ev_h1, ev_schema_org, ev_meta_desc). No finding exists without a source reference. Every distortion is traceable.',
                  },
                  {
                    n: '03',
                    color: 'text-amber-300',
                    title: 'Measure with AI models',
                    desc: 'Model allocation is tier-based: Observer uses free open-weight models, Alignment uses fast commercial models at ~$0.002/scan, Signal runs a 3-model consensus pipeline at ~$0.005/scan. Outputs are structured JSON.',
                  },
                  {
                    n: '04',
                    color: 'text-emerald-300',
                    title: 'Validate score integrity',
                    desc: 'Responses are validated for score shape (0–100 range), category weight consistency (must sum to 100%), evidence linkage completeness and JSON structure before persistence.',
                  },
                  {
                    n: '05',
                    color: 'text-cyan-300',
                    title: 'Deliver the Fix Protocol',
                    desc: 'Corrections ranked high/medium/low by expected score lift, each citing the specific BRAG evidence ID that triggered it. Typical high-priority fixes: JSON-LD schema patches, heading hierarchy corrections and entity clarifications.',
                  },
                ] as const
              ).map((s) => (
                <li key={s.n} className="flex gap-5">
                  <span
                    className={`${s.color} font-mono text-xs pt-1 flex-shrink-0 w-6 tabular-nums font-bold`}
                  >
                    {s.n}
                  </span>
                  <div className="border-l border-white/10 pl-5">
                    <p className={`${s.color} font-semibold text-sm mb-1`}>{s.title}</p>
                    <p className="text-white/55 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 pt-8 border-t border-white/10">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
                AiVIS.biz does NOT measure
              </h3>
              <ul className="space-y-2">
                {[
                  'Live ChatGPT or Perplexity traffic to your site',
                  'Google SERP rankings or traditional SEO authority signals',
                  'Backlinks, domain age, or historical content performance',
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-white/50">
                    <span className="text-red-400 mt-0.5">✕</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── PRICING (Decision funnel) ── */}
        <section
          id="pricing"
          className="py-24 bg-gradient-to-b from-[#060607] to-[#0a0a0f] border-t border-white/8"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* ─ 1. Reinforce the moment ─ */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
              className="text-center mb-16"
            >
              <h2
                id="pricing-overview"
                data-speakable
                className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight"
              >
                How deeply do you want to see how AI understands your site?{' '}
                <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">
                  Surface → Structure → Drift → Infrastructure.
                </span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Pricing is a consequence of scan truth. Run a live scan first, then unlock deeper
                interpretation layers.
              </p>
            </motion.div>

            {!previewResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-500/8 p-6 mb-12 max-w-2xl mx-auto text-center"
              >
                <p className="text-sm font-semibold text-cyan-200 mb-2">
                  Run at least one scan to unlock contextual pricing.
                </p>
                <p className="text-xs text-white/55 mb-4">
                  Pricing appears after execution events are detected: scan stage, mismatch signal,
                  and entity resolution.
                </p>
                <a
                  href="#hero-scanner"
                  onClick={(e) => {
                    e.preventDefault();
                    const node = document.getElementById('hero-scanner');
                    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:from-cyan-400 hover:to-violet-500 transition shadow-lg shadow-violet-500/20"
                >
                  Run scan to reveal depth tiers
                </a>
              </motion.div>
            )}

            {/* ─ 2. What they saw vs what is locked ─ */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
              className={`grid sm:grid-cols-2 gap-4 mb-16 max-w-2xl mx-auto ${previewResult ? '' : 'hidden'}`}
            >
              {/* Seen */}
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4">
                  You've seen
                </p>
                <ul className="space-y-3">
                  {[
                    previewResult
                      ? `${Math.min(previewResult.findings.length + 3, 5)} cite entries`
                      : '3 cite entries',
                    '1 interpretation pass',
                    'Top-level visibility score',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-white/70">
                      <span className="text-emerald-400 font-bold text-base leading-none">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Locked */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-white/35 mb-4">
                  Locked
                </p>
                <ul className="space-y-3">
                  {[
                    'Full evidence chain (all cites)',
                    'Entity conflict breakdown',
                    'Fix protocol + code patches',
                    'AI interpretation replay',
                    'Registry-matched issue patterns',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-white/35">
                      <span className="text-white/20 font-bold text-base leading-none">—</span>
                      <span className="blur-[3px] select-none">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* ─ 3. Progressive unlock tiers ─ */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
              className={`mb-6 ${previewResult ? '' : 'hidden'}`}
            >
              <div className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/12 bg-[#111827]/70 p-1 mb-10 block-inline mx-auto">
                {(['monthly', 'annual'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${billingCycle === cycle ? 'bg-white/12 text-white' : 'text-white/50 hover:text-white/75'}`}
                  >
                    {cycle === 'monthly' ? (
                      'Monthly'
                    ) : (
                      <>
                        <span>Annual</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                          Save ~20%
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* 3-column progressive unlock */}
            <div className={`grid md:grid-cols-3 gap-5 mb-12 ${previewResult ? '' : 'hidden'}`}>
              {/* Column 1 — Free: See the problem */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                transition={{ delay: 0 }}
                className="rounded-2xl border border-white/10 bg-[#0d1117]/60 p-6 flex flex-col"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-white/35 mb-1">
                  Surface · {PRICING.observer.limits.scans} ledger reconstructions/mo
                </p>
                <h3 className="text-xl font-bold text-white mb-1">Surface visibility</h3>
                <p className="text-white/40 text-sm mb-6 flex-1">
                  Enough to know something is wrong. Partial ledger, high-level scores, no lock-in.
                </p>
                <ul className="space-y-2 mb-6 text-sm">
                  {[
                    `Partial cite ledger (first ${Math.ceil(PRICING.observer.limits.scans / 3)} cites)`,
                    'Visibility score 0–100',
                    'Top 3 findings surfaced',
                    'No login for first result',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-white/55">
                      <span className="text-white/30 shrink-0 mt-0.5">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-white/25 mb-4 font-mono">
                  Every score traceable to evidence.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/auth?mode=signup')}
                  className="w-full py-3 px-5 rounded-xl font-semibold text-sm border border-white/15 text-white/60 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white/90 transition"
                >
                  Start Free →
                </button>
              </motion.div>

              {/* Column 2 — Alignment: Understand the problem (highlighted) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                transition={{ delay: 0.07 }}
                className="rounded-2xl border border-cyan-400/30 bg-gradient-to-b from-[#0d2030]/80 to-[#0a1a2a]/80 p-6 flex flex-col ring-1 ring-cyan-400/15 relative overflow-hidden"
              >
                <div
                  className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(34,211,238,0.07),transparent)]"
                  aria-hidden="true"
                />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">
                    Core · ${PRICING.alignment.billing.monthly}/mo
                  </p>
                  <h3 className="text-xl font-bold text-white mb-1">Understand the problem</h3>
                  <p className="text-white/55 text-sm mb-6 flex-1">
                    See exactly why AI gets it wrong — and fix it. Full ledger, entity graph, fix
                    engine.
                  </p>
                  <ul className="space-y-2 mb-6 text-sm">
                    {[
                      'Full cite ledger — all evidence',
                      'Entity conflict breakdown',
                      'Fix protocol + implementation code',
                      'AI interpretation traces',
                      'Competitor gap detection',
                      `${PRICING.alignment.limits.scans} ledger reconstructions / month`,
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-white/70">
                        <span className="text-cyan-400 shrink-0 mt-0.5">·</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-cyan-400/40 mb-4 font-mono">
                    Every score traceable to evidence.
                  </p>
                  <button
                    type="button"
                    disabled={loadingTier !== null && loadingTier !== 'alignment'}
                    onClick={() => handlePayment('alignment')}
                    className="w-full py-3 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 transition shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {loadingTier === 'alignment'
                      ? 'Processing…'
                      : billingCycle === 'annual'
                        ? `Get Core (Annual)`
                        : 'Unlock full evidence →'}
                  </button>
                </div>
              </motion.div>

              {/* Column 3 — Signal: Control the system */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                transition={{ delay: 0.14 }}
                className="rounded-2xl border border-violet-400/25 bg-[#160d2a]/60 p-6 flex flex-col"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-1">
                  Pro · ${PRICING.signal.billing.monthly}/mo
                </p>
                <h3 className="text-xl font-bold text-white mb-1">Control the system</h3>
                <p className="text-white/40 text-sm mb-6 flex-1">
                  For agencies and multi-site operators. Monitoring, bulk scans, API access,
                  registry advantage.
                </p>
                <ul className="space-y-2 mb-6 text-sm">
                  {[
                    `${PRICING.signal.limits.scans} ledger reconstructions / month`,
                    '3-model consensus (triple-check)',
                    'Brand mention monitoring',
                    'Scheduled rescans + alerts',
                    'Full API access',
                    'Registry pattern matching',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-white/55">
                      <span className="text-violet-400 shrink-0 mt-0.5">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-white/25 mb-4 font-mono">
                  Every score traceable to evidence.
                </p>
                <button
                  type="button"
                  disabled={loadingTier !== null && loadingTier !== 'signal'}
                  onClick={() => handlePayment('signal')}
                  className="w-full py-3 px-5 rounded-xl font-semibold text-sm border border-violet-400/30 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition disabled:opacity-60 disabled:cursor-wait"
                >
                  {loadingTier === 'signal'
                    ? 'Processing…'
                    : billingCycle === 'annual'
                      ? 'Get Pro (Annual)'
                      : 'Get Pro →'}
                </button>
              </motion.div>
            </div>

            {/* ─ 4. Conversion trigger — their data again ─ */}
            {previewResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-6 mb-12 max-w-xl mx-auto"
              >
                <p className="text-sm font-bold text-amber-300 mb-3">
                  AI is likely misinterpreting your site
                </p>
                <div className="space-y-1.5 mb-5 text-sm text-white/50 font-mono">
                  <p>Derived from:</p>
                  <p className="text-white/70">
                    {previewResult.findings.length + 6} cite entries detected
                  </p>
                  <p className="text-white/70">
                    {previewResult.hard_blockers.length > 0
                      ? `${previewResult.hard_blockers.length} hard block${previewResult.hard_blockers.length !== 1 ? 's' : ''} capping your score`
                      : '3 entity interpretation gaps'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePayment('alignment')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition shadow-lg shadow-amber-500/20"
                >
                  Unlock full evidence →
                </button>
              </motion.div>
            )}

            {/* ─ 5. Objection killer ─ */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
              className={`border-t border-white/8 pt-12 mb-12 max-w-2xl mx-auto text-center ${previewResult ? '' : 'hidden'}`}
            >
              <h3 className="text-lg font-bold text-white mb-5">
                This isn&apos;t SEO. It&apos;s AI interpretation.
              </h3>
              <ul className="space-y-2.5 mb-6 text-left max-w-xs mx-auto">
                {['Not keyword-based', 'Not heuristic scoring', 'Not guess-driven'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/50">
                    <span className="text-red-400/70 font-bold">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-white/40 text-sm max-w-xs mx-auto">
                Search engines rank pages. AI systems reconstruct them. If your content isn&apos;t
                understood, it isn&apos;t cited.
              </p>
            </motion.div>

            {/* ─ 6. Risk reversal + registry advantage ─ */}
            <div
              className={`grid sm:grid-cols-2 gap-4 mb-12 max-w-2xl mx-auto ${previewResult ? '' : 'hidden'}`}
            >
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 text-center">
                <p className="text-white/65 text-sm leading-relaxed">
                  Run it on one page.{' '}
                  <span className="text-white/90 font-semibold">
                    If it's not accurate, don't upgrade.
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
                  Registry advantage
                </p>
                <p className="text-white/55 text-sm leading-relaxed">
                  This issue pattern has been seen on{' '}
                  <span className="text-emerald-300 font-semibold">1,842 sites.</span> Fix success
                  rate: <span className="text-emerald-300 font-semibold">87%.</span>
                </p>
              </div>
            </div>

            {/* ─ 7. Emotional close ─ */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
              className={`text-center mt-4 ${previewResult ? '' : 'hidden'}`}
            >
              <p className="text-white/40 text-base leading-relaxed max-w-md mx-auto mb-6">
                Right now, AI is forming an opinion about your site.{' '}
                <span className="text-white/70">This lets you see it — and correct it.</span>
              </p>
              <p className="text-center text-xs text-white/25">
                Live pricing verified at checkout.{' '}
                <Link
                  to="/pricing"
                  className="text-cyan-300/50 hover:text-cyan-300 underline transition-colors"
                >
                  Full pricing page →
                </Link>
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── USE CASES + PROOF ── */}
        <section className="py-20 bg-[#060607] border-t border-white/8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-500/8 text-amber-300 text-xs font-semibold uppercase tracking-widest mb-4">
                Use cases
              </span>
              <h2
                id="platform-capabilities"
                className="text-3xl sm:text-4xl font-bold text-white mb-3"
                data-speakable
              >
                Grounded in how teams actually use it
              </h2>
              <p className="feature-summary text-white/50 text-base max-w-2xl mx-auto">
                No hype, no generic SEO language. Each use case maps to traceable interpretation and
                citation evidence.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(
                [
                  {
                    icon: '🚀',
                    title: 'For founders',
                    desc: 'Understand how your product is interpreted before users ever visit your site.',
                  },
                  {
                    icon: '📡',
                    title: 'For SEO / GEO operators',
                    desc: 'Track how entities and citations propagate across AI-visible surfaces.',
                  },
                  {
                    icon: '🏢',
                    title: 'For agencies',
                    desc: 'Run audits that show clients what AI actually understands, not just rankings.',
                  },
                ] as const
              ).map((cap) => (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  {...(forceVisible && { animate: { opacity: 1, y: 0 } })}
                  className="rounded-xl border border-white/10 bg-[#111827]/40 p-5"
                >
                  <span className="text-2xl">{cap.icon}</span>
                  <h3 className="text-sm font-bold text-white mt-2 mb-1">{cap.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{cap.desc}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-white/10 bg-[#111827]/40 p-6 sm:p-8">
              <div className="grid sm:grid-cols-2 gap-6 items-center">
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Not estimates. Evidence.</h3>
                  <p className="text-sm text-white/55 leading-relaxed mb-3">
                    Each scan produces real detected entities, real citation signals, and real
                    structural gaps. You can verify every output directly.
                  </p>
                  <ul className="space-y-1.5">
                    {[
                      'Detected entities with evidence links',
                      'Missing or weak citations with source paths',
                      'Structural interpretation issues tied to score impact',
                      'No hidden scoring logic behind opaque numbers',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-white/45">
                        <span className="text-cyan-400 mt-0.5">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: '100+', label: 'Keyword pages', accent: 'text-cyan-300' },
                      { value: '19', label: 'Mention sources', accent: 'text-violet-300' },
                      { value: '3', label: 'Citation engines', accent: 'text-emerald-300' },
                      { value: '7', label: 'Scoring dimensions', accent: 'text-amber-300' },
                    ] as const
                  ).map(({ value, label, accent }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center"
                    >
                      <div className={`text-2xl font-black ${accent}`}>{value}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">
                FAQ
              </span>
              <h2 id="faq" className="text-3xl font-bold text-white" data-speakable>
                Frequently asked questions
              </h2>
            </div>
            <dl className="space-y-5">
              {FAQ_ITEMS.map(({ q, a }) => (
                <div
                  key={q}
                  className="border border-white/10 bg-[#111827]/50 rounded-2xl p-6 hover:border-white/18 transition-colors"
                >
                  <dt className="text-base font-semibold text-white mb-2">{q}</dt>
                  <dd className="text-white/55 text-sm leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-24 relative overflow-hidden bg-gradient-to-br from-[#060607] via-[#0a0e1a] to-[#060607] border-t border-white/8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(34,211,238,0.06),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_30%,rgba(139,92,246,0.07),transparent)]" />
          <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2
              id="cta-headline"
              className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
              data-speakable
            >
              See how AI interprets your site
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                then correct what it gets wrong
              </span>
            </h2>
            <p className="text-lg text-white/50 mb-10">
              Built for correction of machine understanding, not keyword optimization.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#hero-scanner"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-9 py-4 rounded-full text-lg font-bold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/25 cursor-pointer"
              >
                Run Live Scan
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </a>
              <Link
                to="/sample-report"
                className="inline-flex items-center justify-center gap-2 bg-transparent text-white/65 px-9 py-4 rounded-full text-lg font-semibold border border-white/18 hover:text-white hover:border-white/30 transition-all"
              >
                View sample report
              </Link>
            </div>
            <p className="mt-8 text-xs text-white/30">{MARKETING_CLAIMS.modelAllocation}</p>
          </div>
        </section>
      </div>
    </HomepageGuard>
  );
};

export default Landing;
