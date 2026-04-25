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
import { AuditTraceStream } from '../components/homepage/LiveAuditNarrative';
import { MARKETING_CLAIMS } from '../constants/marketingClaims';
import { PRICING } from '../../../shared/types';
import type { EvidenceLedgerEntry } from '../../../shared/types';
import {
  META,
  OG,
  generateHomepageStructuredData,
  HOMEPAGE_FAQ_ITEMS,
  HomepageGuard,
} from '../homepage';

interface PublicBenchmarksPayload {
  total_audits?: number;
}

interface PublicBenchmarksResponse {
  success?: boolean;
  benchmarks?: PublicBenchmarksPayload;
}

async function getPublicBenchmarks(): Promise<PublicBenchmarksPayload | null> {
  try {
    const r = await fetch(`${API_URL}/api/public/benchmarks`);
    if (!r.ok) return null;
    const data = (await r.json()) as PublicBenchmarksResponse;
    if (!data?.success || !data.benchmarks) return null;
    return data.benchmarks;
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

const HOMEPAGE_LAST_UPDATED = 'April 24, 2026';

const CITE_LEDGER_WEIGHTS = [
  {
    name: 'Schema and Structured Data',
    weight: 20,
    detail: 'Whether your page speaks the language AI parsers use.',
  },
  {
    name: 'Content Depth',
    weight: 18,
    detail: 'Whether your page has enough substance to be worth extracting.',
  },
  {
    name: 'Technical Trust',
    weight: 15,
    detail: 'Whether your delivery stack signals reliability to crawlers.',
  },
  {
    name: 'Meta Tags and Open Graph',
    weight: 15,
    detail: 'Whether page identity and intent are clearly declared.',
  },
  {
    name: 'AI Readability',
    weight: 12,
    detail: 'Whether content structure is machine-extractable.',
  },
  {
    name: 'Heading Structure',
    weight: 10,
    detail: 'Whether topic hierarchy is clear and consistent.',
  },
  {
    name: 'Security and Trust',
    weight: 10,
    detail: 'Whether domain and transport signals support legitimacy.',
  },
] as const;

const SEO_VS_AIVIS_ROWS = [
  {
    seo: 'Keyword coverage, backlinks, page speed, mobile checks, crawl errors',
    aivis:
      'Entity clarity, schema-to-content accuracy, crawler extractability, BRAG-verified trust signals, synthesis depth, heading segmentation, citation readiness',
  },
  {
    seo: 'Measures ranking potential in link-based search surfaces',
    aivis: 'Measures citation probability in answer engines that synthesize responses',
  },
  {
    seo: 'Generic benchmark recommendations',
    aivis: 'Page-specific evidence tied to CITE LEDGER and BRAG identifiers',
  },
] as const;

const QUERY_COVERAGE_MAP = [
  'What is AI visibility for websites',
  'How do I get my website cited by ChatGPT',
  'Why is my website not showing in Perplexity answers',
  'What is CITE LEDGER',
  'What is BRAG grading methodology',
  'How does Google AI Overviews decide what to cite',
  'AI visibility audit tool',
  'How to check if my website is citation ready for AI',
  'Difference between SEO and AI visibility',
  'Why does ChatGPT cite my competitor and not me',
  'AI search citation readiness score',
  'How to improve AI citation readiness',
  'Best tool to audit AI visibility',
  'What schema does ChatGPT use to cite websites',
] as const;

const TRUST_SOURCES = [
  { label: 'Schema.org documentation', href: 'https://schema.org/' },
  {
    label: 'Google Search Central: AI and structured data guidance',
    href: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  },
  { label: 'OpenAI platform and model documentation', href: 'https://platform.openai.com/docs' },
  { label: 'Anthropic documentation', href: 'https://docs.anthropic.com/' },
  { label: 'Perplexity product documentation', href: 'https://docs.perplexity.ai/' },
] as const;

const HERO_QUICK_ANSWERS = [
  {
    q: 'What does AiVIS measure?',
    a: 'AiVIS scores citation readiness on a 0-100 scale using seven weighted categories: schema, content depth, technical trust, metadata, AI readability, heading structure, and security signals.',
  },
  {
    q: 'Why can a readable page still be uncited?',
    a: 'Answer engines can parse prose but still skip citations when structure is weak. Missing hierarchy clarity, thin answer blocks, or inconsistent entity framing lowers citation confidence.',
  },
  {
    q: 'How is each score explainable?',
    a: 'AiVIS ties findings to CITE LEDGER evidence so each diagnosis maps to a traceable citation state or a corrective action path.',
  },
  {
    q: 'What is the fastest remediation loop?',
    a: 'Keep the target URL fixed, ship one structural fix, re-audit the same URL, then compare score movement to confirm attributable lift.',
  },
] as const;

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
    const sourceEvidence = result.entities[index]?.confidence ?? 0.61;
    let status: MismatchStatus = 'correct';
    if (blockerHit) status = 'missing';
    else if (sourceEvidence < 0.5) status = 'distorted';
    else if (sourceEvidence < 0.72) status = 'weak';

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
      similarity:
        status === 'correct'
          ? Math.max(0.72, sourceEvidence)
          : status === 'weak'
            ? Math.max(0.52, Math.min(0.7, sourceEvidence))
            : status === 'distorted'
              ? Math.max(0.3, Math.min(0.5, sourceEvidence))
              : similarityByStatus[status],
      impactScore:
        status === 'correct'
          ? Math.max(14, Math.round((1 - sourceEvidence) * 50))
          : status === 'weak'
            ? Math.max(42, Math.round((1 - sourceEvidence) * 90))
            : status === 'distorted'
              ? Math.max(60, Math.round((1 - sourceEvidence) * 120))
              : impactByStatus[status],
      confidence: Math.max(0.35, Math.min(0.95, sourceEvidence)),
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

  const timelineEvents = result.timeline ?? [];
  const pipelineStages = [
    {
      key: 'ingesting',
      label: 'ingestion',
      detail: 'Validating target URL and collecting raw HTML.',
    },
    {
      key: 'chunking',
      label: 'chunking',
      detail: 'Segmenting source into extraction-ready sections.',
    },
    {
      key: 'embedding',
      label: 'embedding',
      detail: 'Mapping evidence into machine-readable representation.',
    },
    {
      key: 'entity_resolving',
      label: 'entity resolution',
      detail: 'Resolving entity names and aliases against source claims.',
    },
    {
      key: 'edge_building',
      label: 'edge graph',
      detail: 'Linking extracted facts to citation and trust pathways.',
    },
    {
      key: 'scoring',
      label: 'scoring',
      detail: 'Computing deterministic visibility and mismatch impact.',
    },
  ] as const;

  const stageTimeLabels = new Map<string, string>();
  for (const event of timelineEvents) {
    if (!stageTimeLabels.has(event.stage)) {
      const elapsedMs = Math.max(0, event.timestamp - timelineEvents[0]?.timestamp);
      stageTimeLabels.set(event.stage, `${Math.round(elapsedMs / 100) / 10}s`);
    }
  }

  const timeline = pipelineStages.map((stage, index) => {
    const defaultMs = Math.max(
      0,
      Math.round((result.processing_ms / pipelineStages.length) * index)
    );
    const fallbackLabel = `${Math.round(defaultMs / 100) / 10}s`;
    return {
      key: stage.key,
      label: stage.label,
      timestampLabel: stageTimeLabels.get(stage.key) || fallbackLabel,
      progressLabel: `${Math.round(((index + 1) / pipelineStages.length) * 100)}%`,
      detail: stage.detail,
    };
  });

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
    timeline,
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
  const [publicBenchmarks, setPublicBenchmarks] = useState<PublicBenchmarksPayload | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // ── Scan state machine ──────────────────────────────────────────────────────
  // idle → scanning → result
  type LandingPhase = 'idle' | 'scanning' | 'result';
  const [landingPhase, setLandingPhase] = useState<LandingPhase>('idle');
  const [previewResult, setPreviewResult] = useState<ScanResult | null>(null);
  const mismatchData = useMemo(() => buildMismatchData(previewResult), [previewResult]);
  const scanResultRef = useRef<HTMLDivElement>(null);
  const mismatchRef = useRef<HTMLDivElement>(null);

  const handleScanResult = useCallback((result: ScanResult) => {
    setPreviewResult(result);
    setLandingPhase('result');
    setTimeout(() => {
      mismatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, []);

  const handlePhaseChange = useCallback((phase: string) => {
    if (phase === 'SCANNING' || phase === 'LOADING') {
      setLandingPhase('scanning');
    } else if (phase === 'RESULT') {
      setLandingPhase('result');
    } else if (phase === 'IDLE' || phase === 'INPUT_FOCUSED') {
      // only reset to idle if we haven't seen a result yet
      setLandingPhase((prev) => (prev === 'result' ? 'result' : 'idle'));
    }
  }, []);

  // Visibility fallback for animations
  const [forceVisible, setForceVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicBenchmarks().then((d) => {
      if (!cancelled) setPublicBenchmarks(d);
    });
    const iv = setInterval(() => {
      getPublicBenchmarks().then((d) => {
        if (!cancelled) setPublicBenchmarks(d);
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
        {/* ── HERO — always visible ─────────────────────────────────────────── */}
        <section className="relative flex items-center overflow-hidden bg-[#060607] pt-12 pb-12 sm:pt-16 sm:pb-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
          <div className="hero-flow-overlay" aria-hidden="true" />
          <div className="relative z-20 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="text-center"
            >
              {/* Compact value prop — only show full version when idle */}
              {landingPhase === 'idle' && (
                <>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70 mb-3">
                    AI citation readiness audit
                  </p>
                  <h1
                    className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-4"
                    data-speakable
                  >
                    AiVIS.biz: Know If AI Can Actually Cite Your Website
                  </h1>
                  <p className="text-sm sm:text-base text-white/70 max-w-2xl mx-auto leading-relaxed mb-2">
                    You invested in your site, your product, and your content. But when someone asks
                    ChatGPT or Perplexity a question your page should answer, your brand still
                    disappears from the response.
                  </p>
                  <p className="text-sm sm:text-base text-white/55 max-w-2xl mx-auto leading-relaxed mb-8">
                    AiVIS audits the structural signals answer engines use to extract, trust, and
                    cite content. CITE LEDGER ties each score to evidence on your live page, with
                    BRAG identifiers for traceable fixes.
                  </p>
                  <div className="mb-8">
                    <AuditTraceStream />
                  </div>
                </>
              )}

              {/* Scanning state — minimal focused */}
              {landingPhase === 'scanning' && (
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-widest text-cyan-400/70 mb-2 font-mono">
                    live execution
                  </p>
                  <h2 className="text-2xl font-bold text-white">AiVIS.biz is reading your site</h2>
                </div>
              )}

              {/* Result state — show scan complete indicator */}
              {landingPhase === 'result' && previewResult && (
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-widest text-emerald-400/70 mb-2 font-mono">
                    mismatch report
                  </p>
                  <h2 className="text-2xl font-bold text-white">
                    AiVIS.biz mismatch detected
                    <span className="ml-3 text-red-300 font-black tabular-nums">
                      {mismatchData.mismatchScore}/100
                    </span>
                  </h2>
                </div>
              )}

              {/* ── SCAN SURFACE ── */}
              <div id="hero-scanner" className="max-w-xl mx-auto mb-4">
                <ScanShell onResult={handleScanResult} onPhaseChange={handlePhaseChange} />
              </div>

              {landingPhase === 'idle' && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs text-white/30">No login · No credit card · Free scan</p>
                  <div className="flex flex-wrap justify-center gap-2 text-[11px]">
                    <Link
                      to="/pricing?intent=alignment-trial"
                      className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-emerald-200/90 hover:bg-emerald-400/20 transition-colors"
                    >
                      Alignment: 14-day free trial
                    </Link>
                    <Link
                      to="/pricing?intent=signal-trial"
                      className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-cyan-100/90 hover:bg-cyan-400/20 transition-colors"
                    >
                      Signal: 7-day free trial
                    </Link>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 text-xs text-white/35">
                    {[
                      'Answer distortion',
                      'Missing citations',
                      'Entity confusion',
                      'Replayable debugger',
                      'Evidence heatmap',
                    ].map((item) => (
                      <span key={item} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-red-400/50" />
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3 justify-center">
                    <Link
                      to="/sample-report"
                      className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/65 transition-colors"
                    >
                      <span className="text-white/25">→</span> View sample report
                    </Link>
                    <Link
                      to="/methodology"
                      className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/65 transition-colors"
                    >
                      <span className="text-white/25">→</span> How it works
                    </Link>
                    <Link
                      to="/pricing"
                      className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/65 transition-colors"
                    >
                      <span className="text-white/25">→</span> Compare Alignment vs Signal
                    </Link>
                  </div>
                </div>
              )}

              {landingPhase === 'idle' && (
                <section
                  className="mt-8 rounded-2xl border border-white/10 bg-[#0d1018]/90 p-4 sm:p-6 text-left"
                  aria-label="Quick answers for AI extraction"
                >
                  <h2 className="text-sm sm:text-base font-semibold text-cyan-100 mb-4">
                    Quick answers answer engines can extract
                  </h2>
                  <div className="grid gap-3 sm:gap-4">
                    {HERO_QUICK_ANSWERS.map((item) => (
                      <article
                        key={item.q}
                        className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4"
                      >
                        <h3 className="text-sm sm:text-base font-semibold text-white">{item.q}</h3>
                        <p
                          className="mt-1.5 text-xs sm:text-sm leading-6 text-white/70"
                          data-speakable
                        >
                          {item.a}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          </div>
        </section>

        {/* ── STATE 1: SCANNING — live pipeline feed ───────────────────────── */}
        {landingPhase === 'scanning' && <ScanLiveFeed />}

        {/* ── STATE 0: IDLE — social proof + proof strip ───────────────────── */}
        {landingPhase === 'idle' && (
          <>
            {/* Social proof bar */}
            <section className="py-8 border-y border-white/8 bg-[#0a0a0f]">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
                  {[
                    { label: 'AI engines measured', value: '4', accent: 'text-cyan-300' },
                    { label: 'Scoring dimensions', value: '7', accent: 'text-red-300' },
                    { label: 'Evidence framework', value: 'BRAG', accent: 'text-emerald-300' },
                    {
                      label: 'Sites audited',
                      value:
                        typeof publicBenchmarks?.total_audits === 'number'
                          ? Number(publicBenchmarks.total_audits).toLocaleString()
                          : 'Unavailable',
                      accent: 'text-amber-300',
                    },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="text-center">
                      <div className={`text-3xl sm:text-4xl font-black ${accent} tabular-nums`}>
                        {value}
                      </div>
                      <div className="text-xs text-white/40 mt-1 tracking-wide">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Proof strip */}
            <section className="py-10 bg-[#0a0a0f] border-b border-white/8">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-white/10 bg-[#111827]/50 p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <div className="text-3xl font-black text-red-300">15</div>
                        <div className="text-[10px] text-white/40 mt-0.5">Before</div>
                      </div>
                      <span className="text-white/20 font-mono">→</span>
                      <div className="text-center">
                        <div className="text-3xl font-black text-emerald-300">52</div>
                        <div className="text-[10px] text-white/40 mt-0.5">After</div>
                      </div>
                      <div className="text-center ml-1">
                        <div className="text-2xl font-black text-cyan-300">+37</div>
                        <div className="text-[10px] text-white/40 mt-0.5">Points</div>
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-sm text-white/65 leading-relaxed">
                        <span className="text-white/85 font-semibold">
                          Missing JSON-LD, broken heading hierarchy, zero FAQ schema.
                        </span>
                        <span className="text-white/40 ml-1">
                          One audit. Three fixes. Score doubled.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="py-14 bg-[#07090f] border-b border-white/8">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-white/10 bg-[#0d111b]/70 p-6 sm:p-8">
                  <p className="text-xs text-white/45 mb-3">
                    By AiVIS Research Team · Last updated: {HOMEPAGE_LAST_UPDATED}
                  </p>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    What AI visibility means in practice
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    AI visibility is how detectable, interpretable, and citation-worthy your website
                    is to answer engines. It is not the same thing as classical SEO. A page can rank
                    in search and still fail to appear when language models synthesize an answer.
                  </p>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    Search engines rank relevance among links. Answer engines extract claims, weigh
                    trust, and choose whether to cite a source while generating text. Those
                    mechanics reward structural clarity, consistent entity identity, and
                    evidence-supported content blocks.
                  </p>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-8">
                    Most pages fail this layer for predictable reasons: thin primary content,
                    missing FAQ blocks, inconsistent schema, weak heading hierarchy, and no
                    freshness or author trust markers. AiVIS scores those exact signals and maps
                    them to corrective actions that increase citation probability.
                  </p>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    What CITE LEDGER verifies
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    CITE LEDGER is the verification layer inside AiVIS. Every finding in your audit
                    has to map to a stable evidence record taken from your submitted URL. If it
                    cannot be proven from the live page, it does not enter the score.
                  </p>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    This avoids generic checklists. You get page-specific diagnostics based on what
                    an answer engine crawler can actually parse right now, then a prioritized
                    remediation list tied to the same evidence keys.
                  </p>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    Hard blocker caps apply. If critical trust or parsing signals are missing, the
                    final score cannot inflate even if lower-impact categories look strong. That
                    keeps the audit conservative and reproducible.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3 mb-8">
                    {CITE_LEDGER_WEIGHTS.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-lg border border-white/10 bg-black/30 p-4"
                      >
                        <p className="text-sm font-semibold text-white">
                          {item.name} <span className="text-cyan-300">({item.weight}%)</span>
                        </p>
                        <p className="text-xs text-white/55 mt-1">{item.detail}</p>
                      </div>
                    ))}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    BRAG makes grading traceable
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    BRAG stands for Based-Retrieval-Auditable-Grading. Every issue, score component,
                    and fix recommendation is linked to a BRAG identifier so you can inspect where
                    it came from and why it was assigned.
                  </p>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-8">
                    This allows repeat audits to show real movement. When you update schema,
                    strengthen definitions, or improve structure, the evidence set changes and the
                    score updates with an auditable trail. Read the full protocol in the{' '}
                    <Link
                      to="/methodology"
                      className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                    >
                      methodology reference
                    </Link>
                    .
                  </p>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    Who this is for
                  </h2>
                  <div className="space-y-3 mb-8 text-sm sm:text-base text-white/70">
                    <p>
                      <span className="text-white font-semibold">Founders and operators:</span> You
                      need to know why your product is not being cited in generated answers even
                      when the topic is relevant to your market.
                    </p>
                    <p>
                      <span className="text-white font-semibold">Marketers and strategists:</span>{' '}
                      You need a way to measure answer-engine extractability that sits alongside
                      your existing ranking stack.
                    </p>
                    <p>
                      <span className="text-white font-semibold">
                        Developers and technical teams:
                      </span>{' '}
                      You need exact structural failures tied to rendered output, schema, canonical
                      signals, and content topology.
                    </p>
                    <p>
                      <span className="text-white font-semibold">Agencies and consultants:</span>{' '}
                      You need defensible diagnostics you can present to clients as evidence-backed
                      remediation plans.
                    </p>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    How the audit works
                  </h2>
                  <ol className="space-y-3 mb-8 text-sm sm:text-base text-white/70 list-decimal list-inside">
                    <li>Enter the URL you want to test.</li>
                    <li>AiVIS crawls live rendered output and parses extraction signals.</li>
                    <li>CITE LEDGER scores seven weighted dimensions.</li>
                    <li>BRAG IDs bind each finding to auditable page evidence.</li>
                    <li>You receive prioritized fixes and can re-run to measure movement.</li>
                  </ol>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    Traditional SEO audit vs CITE LEDGER audit
                  </h2>
                  <div className="overflow-x-auto mb-8">
                    <table className="min-w-full border border-white/10 rounded-lg overflow-hidden">
                      <thead className="bg-white/5 text-left">
                        <tr>
                          <th className="px-4 py-3 text-xs uppercase tracking-wide text-white/60">
                            Traditional SEO audit
                          </th>
                          <th className="px-4 py-3 text-xs uppercase tracking-wide text-white/60">
                            AiVIS CITE LEDGER audit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {SEO_VS_AIVIS_ROWS.map((row, index) => (
                          <tr key={index} className="border-t border-white/10 align-top">
                            <td className="px-4 py-3 text-sm text-white/70">{row.seo}</td>
                            <td className="px-4 py-3 text-sm text-white/70">{row.aivis}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    Sources and trust references
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    AiVIS is built to produce citation state outputs and corrective action paths. We
                    recommend validating structured data and extraction assumptions against primary
                    documentation.
                  </p>
                  <ul className="space-y-2 mb-8">
                    {TRUST_SOURCES.map((source) => (
                      <li key={source.href}>
                        <a
                          href={source.href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-sm text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                        >
                          {source.label}
                        </a>
                      </li>
                    ))}
                  </ul>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    Natural language query coverage
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-4">
                    This homepage is intentionally structured to answer high-intent questions answer
                    engines commonly receive about AI citation readiness.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2 mb-8">
                    {QUERY_COVERAGE_MAP.map((query) => (
                      <p
                        key={query}
                        className="text-xs sm:text-sm text-white/60 rounded border border-white/10 bg-black/20 px-3 py-2"
                      >
                        {query}
                      </p>
                    ))}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" data-speakable>
                    Final takeaway
                  </h2>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                    Citation outcomes are not random. They are driven by extractability, trust
                    consistency, and evidence density. If your competitors are being cited and you
                    are not, the gap is structural and it can be measured. Run the audit, inspect
                    the ledger, and fix the highest-impact blockers first.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── STATE 2: RESULT — mismatch as conversion engine ──────────────── */}
        {landingPhase === 'result' && previewResult && (
          <div ref={mismatchRef}>
            <MismatchConversionEngine
              mismatchData={mismatchData}
              scanResult={previewResult}
              loadingTier={loadingTier}
              billingCycle={billingCycle}
              onBillingCycleChange={setBillingCycle}
              onPayment={handlePayment}
              onRescan={() => {
                setLandingPhase('idle');
                setPreviewResult(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}

        {/* ── ALWAYS-ON SECTIONS (post-result or idle) — but BELOW scan flow ─ */}
        {landingPhase !== 'scanning' && (
          <>
            {/* Methodology — only shown post-result */}
            {landingPhase === 'result' && <PostResultMethodology forceVisible={forceVisible} />}

            {/* Use cases — always shown post-idle or post-result */}
            <section className="py-16 bg-[#060607] border-t border-white/8">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    {
                      icon: '🚀',
                      title: 'Founders',
                      desc: 'Understand how your product is interpreted before users ever visit your site.',
                    },
                    {
                      icon: '📡',
                      title: 'SEO / GEO operators',
                      desc: 'Track how entities and citations propagate across AI-visible surfaces.',
                    },
                    {
                      icon: '🏢',
                      title: 'Agencies',
                      desc: 'Run audits that show clients what AI actually understands, not just rankings.',
                    },
                  ].map((cap) => (
                    <div
                      key={cap.title}
                      className="rounded-xl border border-white/10 bg-[#111827]/40 p-5"
                    >
                      <span className="text-xl">{cap.icon}</span>
                      <h3 className="text-sm font-bold text-white mt-2 mb-1">{cap.title}</h3>
                      <p className="text-xs text-white/45 leading-relaxed">{cap.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="py-16 bg-[#0a0a0f] border-t border-white/8">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2
                  id="faq"
                  className="text-2xl font-bold text-white mb-8 text-center"
                  data-speakable
                >
                  Frequently asked questions
                </h2>
                <dl className="space-y-4">
                  {FAQ_ITEMS.map(({ q, a }) => (
                    <div
                      key={q}
                      className="border border-white/10 bg-[#111827]/50 rounded-xl p-5 hover:border-white/18 transition-colors"
                    >
                      <dt className="text-sm font-semibold text-white mb-1.5">{q}</dt>
                      <dd className="text-white/50 text-sm leading-relaxed">{a}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 relative overflow-hidden bg-gradient-to-br from-[#060607] via-[#0a0e1a] to-[#060607] border-t border-white/8">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(34,211,238,0.06),transparent)]" />
              <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4" data-speakable>
                  See how AI reads your site
                  <span className="block bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                    then correct what it gets wrong
                  </span>
                </h2>
                <p className="text-base text-white/45 mb-8">{MARKETING_CLAIMS.modelAllocation}</p>
                <p className="text-xs text-white/35 mb-6">
                  Start free, then unlock deeper citation evidence with Alignment (14-day trial) or
                  run multi-model verification in Signal (7-day trial).
                </p>
                <a
                  href="#hero-scanner"
                  onClick={(e) => {
                    e.preventDefault();
                    setLandingPhase('idle');
                    setPreviewResult(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-9 py-4 rounded-full text-lg font-bold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/25 cursor-pointer"
                >
                  Run Live Scan
                </a>
                <div className="mt-4">
                  <Link
                    to="/pricing"
                    className="text-xs text-white/45 hover:text-white/75 transition-colors"
                  >
                    View trial terms and tier capabilities
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </HomepageGuard>
  );
};

// ─── ScanLiveFeed — STATE 1 surface ──────────────────────────────────────────
function ScanLiveFeed() {
  const PIPELINE_STEPS = [
    { key: 'ingesting', label: 'ingesting content', color: 'text-cyan-300', ts: '00:00' },
    { key: 'chunking', label: 'segmenting into chunks', color: 'text-cyan-300/75', ts: '00:01' },
    { key: 'entities', label: 'detecting entities', color: 'text-violet-300', ts: '00:03' },
    { key: 'queries', label: 'expanding query space', color: 'text-violet-300/75', ts: '00:05' },
    { key: 'citations', label: 'checking citations', color: 'text-red-300', ts: '00:07' },
    { key: 'ai', label: 'running AI interpretation', color: 'text-amber-300', ts: '00:09' },
    { key: 'scoring', label: 'computing mismatch score', color: 'text-emerald-300', ts: '00:12' },
  ];
  const [visibleCount, setVisibleCount] = useState(1);
  useEffect(() => {
    if (visibleCount >= PIPELINE_STEPS.length) return;
    const t = setInterval(() => {
      setVisibleCount((n) => Math.min(n + 1, PIPELINE_STEPS.length));
    }, 900);
    return () => clearInterval(t);
  }, [visibleCount]);

  return (
    <section className="py-10 bg-[#0b0f1a] border-t border-white/8">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-4 font-mono text-center">
          pipeline execution
        </p>
        <div className="rounded-2xl border border-white/10 bg-[#070d1a] p-4 font-mono text-sm">
          {PIPELINE_STEPS.slice(0, visibleCount).map((step, i) => (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 py-1.5"
            >
              <span className="text-white/25 w-10 text-right tabular-nums text-xs">{step.ts}</span>
              <span className="text-white/20">›</span>
              <span className={step.color}>{step.label}</span>
              {i === visibleCount - 1 && (
                <span className="ml-auto animate-pulse text-white/30 text-xs">▌</span>
              )}
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-white/25 text-center mt-4">
          Evidence is being collected. Result will appear above.
        </p>
      </div>
    </section>
  );
}

// ─── MismatchConversionEngine — STATE 2 surface ───────────────────────────────
interface MismatchConversionEngineProps {
  mismatchData: MismatchData;
  scanResult: ScanResult;
  loadingTier: string | null;
  billingCycle: 'monthly' | 'annual';
  onBillingCycleChange: (c: 'monthly' | 'annual') => void;
  onPayment: (tier: string) => void;
  onRescan: () => void;
}

function MismatchConversionEngine({
  mismatchData,
  scanResult,
  loadingTier,
  billingCycle,
  onBillingCycleChange,
  onPayment,
  onRescan,
}: MismatchConversionEngineProps) {
  const [lockedDepthVisible, setLockedDepthVisible] = useState(false);

  // Percentage of ledger "seen" — surface interpretation only
  const seenPct = Math.min(38, Math.round((scanResult.findings.length / 10) * 38 + 12));

  return (
    <>
      {/* ── 1. Ledger snapshot bar ── */}
      <section className="py-6 bg-[#0b0f1a] border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-[#070d1a] p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">
                  Mismatch score
                </p>
                <p className="text-2xl font-black text-red-300 tabular-nums">
                  {mismatchData.mismatchScore}/100
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">
                  Entities found
                </p>
                <p className="text-2xl font-black text-white tabular-nums">
                  {mismatchData.entities.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">
                  Citation gaps
                </p>
                <p className="text-2xl font-black text-amber-300 tabular-nums">
                  {mismatchData.entities.filter((e) => e.status === 'missing').length}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">
                  Ledger depth
                </p>
                <p className="text-sm font-bold text-white/60 mt-1">
                  Seeing <span className="text-cyan-300 font-black">{seenPct}%</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Mismatch panel (core) ── */}
      <div className="relative">
        <AIMismatchPanel data={mismatchData} />

        {/* ── 3. Locked depth trigger ── */}
        <div className="relative bg-[#05070d] border-t border-white/10">
          {/* Gradient fade over the bottom of the mismatch panel */}
          <div
            className="absolute -top-24 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#05070d] pointer-events-none z-10"
            aria-hidden="true"
          />
          <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 py-8">
            {!lockedDepthVisible ? (
              <div className="rounded-2xl border border-white/12 bg-[#0a1020]/80 p-6 text-center backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-white/35 font-mono mb-3">
                  surface interpretation only
                </p>
                <p className="text-2xl font-bold text-white mb-1">
                  You are seeing <span className="text-cyan-300">{seenPct}%</span> of the ledger
                </p>
                <p className="text-sm text-white/45 mb-5 max-w-md mx-auto">
                  Full evidence chain, entity conflict breakdown, fix protocol, and AI
                  interpretation drift are locked.
                </p>
                <div className="flex flex-wrap gap-3 justify-center mb-5">
                  {[
                    'Full evidence chain',
                    'Entity conflict breakdown',
                    'Fix protocol + code patches',
                    'Interpretation drift timeline',
                    'Citation chain mapping',
                  ].map((item) => (
                    <span
                      key={item}
                      className="px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-xs text-white/25 select-none"
                      style={{ filter: 'blur(2.5px)' }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setLockedDepthVisible(true)}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white px-6 py-3 rounded-xl text-sm font-bold hover:from-violet-400 hover:to-cyan-400 transition shadow-lg shadow-violet-500/20"
                >
                  Unlock full interpretation layer →
                </button>
              </div>
            ) : (
              <PricingConsequence
                scanResult={scanResult}
                loadingTier={loadingTier}
                billingCycle={billingCycle}
                onBillingCycleChange={onBillingCycleChange}
                onPayment={onPayment}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Rescan link ── */}
      <div className="py-4 text-center bg-[#05070d]">
        <button
          type="button"
          onClick={onRescan}
          className="text-xs text-white/30 hover:text-white/55 transition-colors"
        >
          ← Scan a different URL
        </button>
      </div>
    </>
  );
}

// ─── PricingConsequence — appears AFTER locked depth click ────────────────────
interface PricingConsequenceProps {
  scanResult: ScanResult;
  loadingTier: string | null;
  billingCycle: 'monthly' | 'annual';
  onBillingCycleChange: (c: 'monthly' | 'annual') => void;
  onPayment: (tier: string) => void;
}

function PricingConsequence({
  scanResult,
  loadingTier,
  billingCycle,
  onBillingCycleChange,
  onPayment,
}: PricingConsequenceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Context bridge */}
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 mb-6 max-w-xl mx-auto text-center">
        <p className="text-sm font-bold text-amber-300 mb-2">
          AI is likely misinterpreting this site right now
        </p>
        <div className="font-mono text-xs text-white/50 space-y-1">
          <p>
            <span className="text-white/70">{scanResult.findings.length + 6}</span> cite entries
            detected
          </p>
          <p>
            <span className="text-white/70">
              {scanResult.hard_blockers.length > 0
                ? `${scanResult.hard_blockers.length} hard block${scanResult.hard_blockers.length !== 1 ? 's' : ''}`
                : '3 entity interpretation gaps'}
            </span>{' '}
            capping visibility
          </p>
        </div>
      </div>

      {/* Seen vs locked */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8 max-w-xl mx-auto">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">
            You've seen
          </p>
          <ul className="space-y-2 text-sm">
            {[
              `${Math.min(scanResult.findings.length + 3, 5)} cite entries`,
              'Top-level visibility score',
              '1 interpretation pass',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-white/65">
                <span className="text-emerald-400">✓</span> {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Locked</p>
          <ul className="space-y-2 text-sm">
            {[
              'Full evidence chain',
              'Entity conflict breakdown',
              'Fix protocol + code patches',
              'AI interpretation replay',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-white/25">
                <span>—</span>
                <span className="blur-[3px] select-none">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-1 rounded-xl border border-white/12 bg-[#111827]/70 p-1">
          {(['monthly', 'annual'] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => onBillingCycleChange(cycle)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                billingCycle === cycle
                  ? 'bg-white/12 text-white'
                  : 'text-white/45 hover:text-white/65'
              }`}
            >
              {cycle === 'monthly' ? (
                'Monthly'
              ) : (
                <span className="flex items-center gap-1.5">
                  Annual
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[9px] font-bold">
                    −20%
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3-tier pricing */}
      <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
        {/* Free */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1117]/60 p-5 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
            Surface · {PRICING.observer.limits.scans}/mo
          </p>
          <h3 className="text-lg font-bold text-white mb-1">See the problem</h3>
          <p className="text-white/40 text-xs mb-4 flex-1">
            Partial ledger, top-level scores, no lock-in.
          </p>
          <ul className="space-y-1.5 mb-4 text-xs">
            {['Partial cite ledger', 'Visibility score 0–100', 'Top 3 findings'].map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-white/50">
                <span className="text-white/25 shrink-0">·</span> {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onPayment('observer')}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-white/12 text-white/55 bg-white/[0.03] hover:bg-white/[0.07] hover:text-white/85 transition"
          >
            Start Free →
          </button>
        </div>

        {/* Core — highlighted */}
        <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-b from-[#0d2030]/80 to-[#0a1a2a]/80 p-5 flex flex-col ring-1 ring-cyan-400/15 relative overflow-hidden">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(34,211,238,0.07),transparent)]"
            aria-hidden="true"
          />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-1">
              Core · ${PRICING.alignment.billing.monthly}/mo
            </p>
            <h3 className="text-lg font-bold text-white mb-1">Understand the problem</h3>
            <p className="text-white/55 text-xs mb-4 flex-1">
              Full ledger, entity graph, fix engine. See exactly why AI gets it wrong.
            </p>
            <ul className="space-y-1.5 mb-4 text-xs">
              {[
                'Full cite ledger — all evidence',
                'Entity conflict breakdown',
                'Fix protocol + implementation code',
                'AI interpretation traces',
                `${PRICING.alignment.limits.scans} reconstructions/month`,
              ].map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-white/70">
                  <span className="text-cyan-400 shrink-0">·</span> {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={loadingTier !== null && loadingTier !== 'alignment'}
              onClick={() => onPayment('alignment')}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 transition shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-wait"
            >
              {loadingTier === 'alignment' ? 'Processing…' : 'Unlock full evidence →'}
            </button>
          </div>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border border-violet-400/25 bg-[#160d2a]/60 p-5 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
            Pro · ${PRICING.signal.billing.monthly}/mo
          </p>
          <h3 className="text-lg font-bold text-white mb-1">Control the system</h3>
          <p className="text-white/40 text-xs mb-4 flex-1">Agencies and multi-site operators.</p>
          <ul className="space-y-1.5 mb-4 text-xs">
            {[
              `${PRICING.signal.limits.scans} reconstructions/month`,
              '3-model consensus',
              'Brand mention monitoring',
              'Full API access',
            ].map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-white/50">
                <span className="text-violet-400 shrink-0">·</span> {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={loadingTier !== null && loadingTier !== 'signal'}
            onClick={() => onPayment('signal')}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-violet-400/30 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition disabled:opacity-60 disabled:cursor-wait"
          >
            {loadingTier === 'signal' ? 'Processing…' : 'Get Pro →'}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-white/20 mt-6">
        Live pricing verified at checkout.{' '}
        <Link
          to="/pricing"
          className="text-cyan-300/40 hover:text-cyan-300 underline transition-colors"
        >
          Full pricing page →
        </Link>
      </p>
    </motion.div>
  );
}

// ─── PostResultMethodology — shown below mismatch after result ────────────────
function PostResultMethodology({ forceVisible }: { forceVisible: boolean }) {
  return (
    <section className="py-16 bg-[#0a0a0f] border-t border-white/8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-semibold text-white/70 mb-6" data-speakable>
          Why these results are different
        </h2>
        <ol className="space-y-4">
          {[
            {
              n: '01',
              color: 'text-cyan-300',
              title: 'Every score traces to evidence',
              desc: 'Each scraped field receives a unique BRAG evidence ID. No finding exists without a source reference.',
            },
            {
              n: '02',
              color: 'text-violet-300',
              title: 'Not keyword-based',
              desc: 'AI systems reconstruct meaning, not rank by keywords. We measure reconstruction accuracy, not placement.',
            },
            {
              n: '03',
              color: 'text-amber-300',
              title: 'Multi-model validation',
              desc: `Model allocation: Observer uses free open-weight models. Alignment uses GPT-5 Nano. Signal runs 3-model consensus.`,
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className={`${s.color} font-mono text-xs pt-1 flex-shrink-0 font-bold`}>
                {s.n}
              </span>
              <div className="border-l border-white/10 pl-4">
                <p className={`${s.color} font-semibold text-sm mb-0.5`}>{s.title}</p>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default Landing;
