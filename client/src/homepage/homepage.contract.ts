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
    tagline: `${BRAG_ACRONYM} evidence-linked scores`,
    secondaryTagline: 'get cited fixes',
    slogan: 'Verify whether AI answer engines can find, extract, and cite your content — and trace every gap to a crawl event.',
    author: {
        name: 'Ryan Mason',
        twitter: '@dobleduche',
    },
} as const;

/* ── CITE LEDGER canonical definition ───────────────────────────────────── */

export const CITE_LEDGER_DEFINITION =
    'CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude.' as const;

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
    title: `AiVIS — AI Visibility Audit | Evidence-Backed by ${BRAND.product}`,
    description: `${CITE_LEDGER_DEFINITION} ${BRAND.name} scores pages using ${BRAG.expansion} (BRAG) — an evidence framework that links every finding to a verifiable crawl event, citation_ledger entry, or registry computation.`,
    // NOTE: description must include CITE_LEDGER_DEFINITION and BRAG.expansion verbatim — enforced at build time.
    keywords: `${BRAND.product}, ${BRAND.name}, ${BRAG.acronym} evidence scores, AI citation audit, ChatGPT citation verification, Perplexity citation, Claude citation, structured data verification, AI answer verification, AI citation ledger, evidence-linked audit, anti-hallucination audit, ${BRAG.acronym} framework, entity disambiguation, citation readiness, AI extraction verification, machine readability, fix protocol, citation proof, AI answer distortion`,
    author: BRAND.name,
    canonical: BRAND.domain,
} as const;

/* ── Open Graph ─────────────────────────────────────────────────────────── */

export const OG = {
    type: 'website',
    siteName: BRAND.name,
    title: META.title,
    description: `${BRAND.name} ${BRAND.product} verifies how ${PLATFORM_TARGETS.join(', ').replace(/, ([^,]+)$/, ', and $1')} interpret and cite your website. Every finding is evidence-linked through ${BRAG.acronym} — no hallucination, no assumptions.`,
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
    title: `${BRAND.name} | ${BRAND.product} — ${BRAG.acronym} Evidence-Linked Scores`,
    description: OG.description,
    image: OG.image.url,
    imageAlt: `${BRAND.name} | ${BRAND.product} — ${BRAG.acronym} Evidence-Linked Scores`,
} as const;

/* ── Hero copy ──────────────────────────────────────────────────────────── */

export const HERO = {
    headline: [BRAND.name, BRAND.product, `${BRAG.acronym} evidence-linked scores`, 'get cited fixes'] as const,
    subHeadline: 'Submit a URL. The system extracts entity signals, generates intent queries, and probes live AI and search responses. Every result maps to a ledger entry or a gap detection record — not an inference.',
    description: `${BRAND.name} ingests your URL → extracts entity and structural signals → generates typed query sets → probes AI models and web search in parallel → stores every result as an immutable citation ledger entry → computes visibility gaps and competitive displacement → outputs evidence-linked fix instructions tied to specific crawl observations.`,
    ctaText: 'Run citation audit',
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
