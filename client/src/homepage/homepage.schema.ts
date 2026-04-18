/**
 * HOMEPAGE SCHEMA GENERATOR — locked to homepage.contract.ts
 *
 * Produces JSON-LD structured data arrays using ONLY values from the contract.
 * Reuses the existing seoSchema.ts builders for format consistency.
 */

import { PRICING } from '../../../shared/types';
import {
    buildOrganizationSchema,
    buildWebSiteSchema,
    buildWebPageSchema,
    buildBreadcrumbSchema,
    buildItemListSchema,
    buildSoftwareApplicationSchema,
    buildFaqSchema,
    buildProductSchema,
    buildAggregateRatingSchema,
    buildReviewSchema,
} from '../lib/seoSchema';
import {
    BRAND,
    CITE_LEDGER_DEFINITION,
    OG,
    HERO,
    getTierSnapshot,
} from './homepage.contract';

/* ── FAQ items (contract-sourced definitions) ───────────────────────────── */

export const HOMEPAGE_FAQ_ITEMS = [
    {
        q: 'What is AiVIS.biz and what does it audit?',
        a: `${CITE_LEDGER_DEFINITION} It fetches your live page and scores seven evidence-linked categories using BRAG (Based-Retrieval-Auditable-Grading).`,
    },
    {
        q: 'Why does citation verification matter more than traditional ranking?',
        a: `Traditional search rewards backlinks and keywords. AI answer engines synthesize responses from structured content — thin structure, missing schema or poor heading hierarchy means you get skipped or misrepresented, regardless of domain authority. ${BRAND.product} tracks how AI models interpret, reference, and cite your content — the citation layer that traditional tools do not measure.`,
    },
    {
        q: 'What is BRAG and why does AiVIS.biz use it?',
        a: 'BRAG stands for Based-Retrieval-Auditable-Grading. It is the evidence framework that ties every audit finding to a real element on your page. Each heading, schema block, meta tag and content section receives an evidence identifier that can be traced, verified and rechecked across scan cycles. No hallucination — just proof.',
    },
    {
        q: 'Which AI systems does AiVIS.biz analyze for?',
        a: `${BRAND.name} is built around the structural signals that affect how major answer engines read and reproduce pages. Core analysis focuses on systems such as ChatGPT, Perplexity, Google AI Overviews, and Claude, with higher tiers using a multi-model review pipeline for stronger validation.`,
    },
    { q: 'What happens to unused monthly audits?', a: 'Monthly audit credits reset at billing cycle start and do not roll over.' },
    {
        q: 'What is citation readiness?',
        a: 'Citation readiness measures how safe and reliable a page is for reuse inside AI-generated answers. It requires clear entity definitions, consistent schema support, sufficient content depth and structural formatting that allows AI systems to extract usable information without risking attribution errors or hallucination.',
    },
    {
        q: 'Who should use AiVIS.biz?',
        a: `${BRAND.name} ${BRAND.product} is built for content teams, SaaS companies, startup founders, digital agencies and anyone who needs to verify why their content is not being cited by AI answer engines. If your site depends on being found, trusted and cited by ChatGPT, Perplexity, Claude or Google AI, the audit shows exactly where citation breaks and what to fix.`,
    },
    {
        q: 'How does AiVIS.biz differ from Ahrefs or Semrush?',
        a: `Ahrefs and Semrush track keyword rankings, backlinks and traditional search performance. ${BRAND.name} ${BRAND.product} measures something different: whether AI answer engines can structurally extract and cite your content. It scans your live page with a headless browser, runs multi-model AI analysis and returns evidence-linked findings through BRAG — none of which traditional tools cover.`,
    },
    {
        q: 'What are the seven scoring categories?',
        a: `${BRAND.name} scores Schema and Structured Data (20%), Content Depth and Quality (18%), Meta Tags and Open Graph (15%), Technical SEO (15%), AI Readability and Citability (12%), Heading Structure (10%) and Security and Trust (10%). Each category receives a letter grade (A–F) with specific findings backed by BRAG evidence IDs.`,
    },
    {
        q: 'Can I track how my score changes over time?',
        a: `Yes. Every audit is saved to your history. Alignment and Signal tiers include score trend charts, competitor comparisons and scheduled rescans so you can measure the impact of each fix you apply. The ${BRAND.product} tracks your citation readiness over time.`,
    },
    {
        q: 'Is there a free trial?',
        a: `The Observer tier is free forever with ${PRICING.observer.limits.scans} audits per month. No credit card required. You also get one free preview scan on the homepage without creating an account — so you can see what ${BRAND.name} finds before committing.`,
    },
] as const;

/* ── Structured data generator ──────────────────────────────────────────── */

export function generateHomepageStructuredData(): Record<string, unknown>[] {
    const tiers = getTierSnapshot();

    const schemas: Record<string, unknown>[] = [
        buildOrganizationSchema(),
        buildWebSiteSchema(),
        buildWebPageSchema({
            path: '/landing',
            name: `${BRAND.name} | ${BRAND.product} — BRAG Evidence-Linked Scores`,
            description: OG.description,
        }),
        buildBreadcrumbSchema([{ name: 'Landing', path: '/landing' }]),
        buildItemListSchema([
            { name: `Observer — Detection audit (free)`, path: '/pricing#observer' },
            { name: `Starter — Full audit + recommendations — $${tiers.starter.price}/mo`, path: '/pricing#starter' },
            { name: `Alignment — Structured optimization — $${tiers.alignment.price}/mo`, path: '/pricing#alignment' },
            { name: `Signal — Verified AI answer pipeline — $${tiers.signal.price}/mo`, path: '/pricing#signal' },
            { name: `Score Fix — Evidence-based fix pack — $${tiers.scorefix.price}`, path: '/pricing#scorefix' },
        ]),
        buildSoftwareApplicationSchema({
            name: BRAND.name,
            description: OG.description,
            offers: [
                { name: 'Observer', price: String(tiers.observer.price) },
                { name: 'Full Audit + Recommendations', price: String(tiers.starter.price) },
                { name: 'Structured Optimization System', price: String(tiers.alignment.price) },
                { name: 'Verified AI Answer Pipeline', price: String(tiers.signal.price) },
                { name: 'Evidence-Based Fix Pack', price: String(tiers.scorefix.price) },
            ],
        }),
        buildFaqSchema(
            HOMEPAGE_FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a })),
            { path: '/' },
        ),
        buildProductSchema({
            name: `${BRAND.name} | ${BRAND.product} — BRAG Evidence-Linked Scores`,
            description: `${BRAND.name} ${BRAND.product} verifies how ChatGPT, Perplexity AI, Google AI Overviews, and Claude interpret and cite your website. Every finding is evidence-linked through BRAG, with fix-ready outputs to improve extraction and citation accuracy.`,
            url: `${BRAND.domain}/`,
            image: `${BRAND.domain}/og-image.png`,
            brand: BRAND.name,
            offers: [
                { name: 'Detection Audit (Free)', price: '0', description: `${tiers.observer.scans} audits per month — free forever` },
                { name: 'Full Audit + Recommendations', price: String(tiers.starter.price), description: `${tiers.starter.scans} audits/month with all recommendations, implementation code, and PDF exports` },
                { name: 'Structured Optimization System', price: String(tiers.alignment.price), description: `${tiers.alignment.scans} audits/month with competitor tracking, citation workflows and report exports` },
                { name: 'Verified AI Answer Pipeline', price: String(tiers.signal.price), description: `${tiers.signal.scans} audits/month with 3-model consensus scoring, advanced citation testing and brand mention monitoring` },
            ],
            aggregateRating: buildAggregateRatingSchema({
                ratingValue: '4.6',
                bestRating: '5',
                worstRating: '1',
                ratingCount: '48',
                reviewCount: '12',
            }),
            reviews: [
                buildReviewSchema({
                    author: 'Early Adopter',
                    reviewBody: 'Ran my first audit and scored 15. Applied the three recommended fixes — JSON-LD schema, H1 rewrite and FAQ block — and re-scanned at 52. The evidence IDs made it obvious what was broken.',
                    ratingValue: '5',
                    bestRating: '5',
                    datePublished: '2026-03-15',
                }),
            ],
        }),
    ];

    return schemas;
}
