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
    tagline: 'Know If AI Can Actually Cite Your Website',
    secondaryTagline: 'evidence-backed AI citation readiness auditing',
    slogan: 'AiVIS audits whether ChatGPT, Perplexity, Google AI Overviews, and Claude can read, trust, and cite your website using CITE LEDGER evidence trails.',
    author: {
        name: 'Ryan Mason',
        twitter: '@dobleduche',
        linkedin: 'https://www.linkedin.com/in/web4aidev/',
        github: 'https://github.com/dobleduche',
        medium: 'https://intruvurt.medium.com/',
    },
} as const;

/* ── CITE LEDGER canonical definition ───────────────────────────────────── */

export const CITE_LEDGER_DEFINITION =
    'AiVIS CITE LEDGER is the verification layer that ties every score and finding to real, stable on-page evidence from your submitted URL.' as const;

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
    title: 'AiVIS.biz | AI Citation Readiness Audit - CITE LEDGER Score',
    description: `${CITE_LEDGER_DEFINITION} ${BRAG.expansion} powers AiVIS audits for ChatGPT, Perplexity, Google AI Overviews, and Claude. Enter a URL and get a real score backed by on-page evidence, not assumptions.`,
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
    description: META.description,
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
    title: META.title,
    description: OG.description,
    image: OG.image.url,
    imageAlt: `${BRAND.name} | Diagnostic AI Citation Analysis`,
} as const;

/* ── Hero copy ──────────────────────────────────────────────────────────── */

export const HERO = {
    headline: [
        'AiVIS.biz: Know If AI Can Actually Cite Your Website',
        BRAND.product,
        'Evidence-backed AI visibility auditing',
        'Score your citation readiness with traceable proof.',
    ] as const,
    subHeadline:
        'AiVIS audits the structural signals AI answer engines rely on to decide what gets cited and what gets ignored.',
    description:
        'Every score is tied to CITE LEDGER evidence and BRAG identifiers from your live page.',
    ctaText: 'Run your free audit',
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
