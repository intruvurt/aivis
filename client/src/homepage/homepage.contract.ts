/**
 * HOMEPAGE CONTRACT — SINGLE SOURCE OF TRUTH
 *
 * Every meta tag, OG tag, Twitter card, JSON-LD schema block, hero headline,
 * scoring category weight, and pricing number on the homepage MUST derive from
 * this contract. If a value appears hardcoded anywhere else, it is a bug.
 *
 * This file is the canonical artifact. The build will fail if anything drifts.
 */

import { PRICING, BRAG_ACRONYM, BRAG_EXPANSION } from '../../../shared/types';

/* ── Brand identity ─────────────────────────────────────────────────────── */

export const BRAND = {
    name: 'AiVIS.biz',
    product: 'CITE LEDGER',
    domain: 'https://aivis.biz',
    tagline: `See why the model said no`,
    secondaryTagline: 'diagnostic instrumentation for AI visibility',
    slogan: 'Stop guessing why AI ignores you. See the exact decision machine — source-by-source forensics of citation collapse, retrieval failure, and semantic gaps.',
    author: {
        name: 'Ryan Mason',
        twitter: '@dobleduche',
    },
} as const;

/* ── CITE LEDGER canonical definition ───────────────────────────────────── */

export const CITE_LEDGER_DEFINITION =
    'CITE LEDGER is the immutable forensic log that records why AI models made citation choices — showing precisely where your content was selected, rejected, or reranked against competitors.' as const;

/* ── BRAG (re-exported from shared for colocation) ──────────────────────── */

export const BRAG = {
    acronym: BRAG_ACRONYM,
    expansion: BRAG_EXPANSION,
    repo: 'https://github.com/dobleduche/brag',
} as const;

/* ── Platform targets ───────────────────────────────────────────────────── */

export const PLATFORM_TARGETS = [
    'ChatGPT',
    'Perplexity',
    'Google AI Overviews',
    'Claude',
] as const;

/* ── Scoring model (7 categories, weights sum to 100) ───────────────────── */

export const SCORING_CATEGORIES = [
    { name: 'Schema and Structured Data', weight: 20 },
    { name: 'Content Depth and Quality', weight: 18 },
    { name: 'Meta Tags and Open Graph', weight: 15 },
    { name: 'Technical Trust', weight: 15 },
    { name: 'AI Readability and Citability', weight: 12 },
    { name: 'Heading Structure and H1', weight: 10 },
    { name: 'Security and Trust', weight: 10 },
] as const;

export const SCORE_RANGE = { min: 0, max: 100 } as const;

/* ── Meta tags ──────────────────────────────────────────────────────────── */

export const META = {
    title: `AiVIS — See Why the Model Said No | Diagnostic AI Visibility`,
    description: `${CITE_LEDGER_DEFINITION} ${BRAND.name} shows you the exact decision points where AI models reject, rerank, or forget your content. Every gap is forensically mapped: where the semantic bridge breaks, why competitors rank higher, what entity decay looks like. This is system instrumentation, not optimization advice.`,
    // NOTE: description must include CITE_LEDGER_DEFINITION and diagnostic framing verbatim — enforced at build time.
    keywords: `AI citation diagnostics, why AI ignores you, competitor retrieval analysis, semantic bridge failure, entity decay detection, citation collapse forensics, AI reasoning transparency, ${BRAND.name}, ${BRAG.acronym} evidence scoring, source preference mapping, ChatGPT selection logic, Perplexity retrieval analysis, Claude synthesis debugging, AI answer engine decision making, citation ledger, post-mortem AI visibility, system instrumentation, retrieval failure diagnosis`,
    author: BRAND.name,
    canonical: BRAND.domain,
} as const;

/* ── Open Graph ─────────────────────────────────────────────────────────── */

export const OG = {
    type: 'website',
    siteName: BRAND.name,
    title: META.title,
    description: `Forensic analysis: Why ${PLATFORM_TARGETS.join(', ').replace(/, ([^,]+)$/, ', and $1')} cite your competitors instead of you. See the citation collapse points, semantic bridges, and entity stability patterns. System instrumentation, not tips.`,
    url: BRAND.domain,
    locale: 'en_US',
    image: {
        url: `${BRAND.domain}/og-image2.png`,
        type: 'image/png',
        width: 1200,
        height: 630,
        alt: META.title,
    },
} as const;

/* ── Twitter Card ───────────────────────────────────────────────────────── */

export const TWITTER = {
    card: 'summary_large_image',
    site: BRAND.author.twitter,
    creator: BRAND.author.twitter,
    title: `${BRAND.name} | See Why the Model Said No`,
    description: `Forensic AI visibility: Why your content is ignored, where citations collapse, why competitors win. Post-mortem instrumentation for AI answer engines.`,
    image: OG.image.url,
    imageAlt: `${BRAND.name} | Diagnostic AI Citation Analysis`,
} as const;

/* ── Hero copy ──────────────────────────────────────────────────────────── */

export const HERO = {
    headline: [
        BRAND.name,
        'See Why the Model Said No',
        'Forensic instrumentation of AI citation collapse.',
    ] as const,
    subHeadline:
        'Every model decision has a reason. Run a scan. Watch where your content gets selected vs. skipped vs. reranked. See semantic gaps, entity decay, competitor reassignment. This is diagnosis, not optimization.',
    description:
        'Real-time forensics. Evidence-linked. Ledger-traceable. The exact decision machine laid bare.',
    ctaText: 'Run diagnostic scan',
    inputPlaceholder: 'yourdomain.com',
} as const;

/* ── Tier pricing snapshot (derived from shared PRICING) ────────────────── */

export function getTierSnapshot() {
    return {
        observer: { name: PRICING.observer.name, price: PRICING.observer.billing.monthly, scans: PRICING.observer.limits.scans },
        starter: { name: PRICING.starter.name, price: PRICING.starter.billing.monthly, scans: PRICING.starter.limits.scans },
        alignment: { name: PRICING.alignment.name, price: PRICING.alignment.billing.monthly, scans: PRICING.alignment.limits.scans },
        signal: { name: PRICING.signal.name, price: PRICING.signal.billing.monthly, scans: PRICING.signal.limits.scans },
        scorefix: { name: PRICING.scorefix.name, price: PRICING.scorefix.billing.monthly, credits: PRICING.scorefix.credits },
    } as const;
}

/* ── Aggregate contract object ──────────────────────────────────────────── */

export const HOMEPAGE_CONTRACT = {
    brand: BRAND,
    citeLedgerDefinition: CITE_LEDGER_DEFINITION,
    brag: BRAG,
    platformTargets: PLATFORM_TARGETS,
    scoringCategories: SCORING_CATEGORIES,
    scoreRange: SCORE_RANGE,
    meta: META,
    og: OG,
    twitter: TWITTER,
    hero: HERO,
    getTierSnapshot,
} as const;
