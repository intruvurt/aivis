/**
 * HOMEPAGE SCHEMA GENERATOR — locked to homepage.contract.ts
 *
 * Produces JSON-LD structured data arrays using ONLY values from the contract.
 * Reuses the existing seoSchema.ts builders for format consistency.
 */

import { PRICING } from '../../../shared/types';
import {
    BASE_URL,
    ORGANIZATION_ID,
    buildWebSiteSchema,
    buildSoftwareApplicationSchema,
    buildFaqSchema,
} from '../lib/seoSchema';
import {
    BRAND,
    getTierSnapshot,
} from './homepage.contract';

/* ── FAQ items (contract-sourced definitions) ───────────────────────────── */

export const HOMEPAGE_FAQ_ITEMS = [
    {
        q: 'What is AI visibility and why does it matter for my website?',
        a: 'AI visibility is the degree to which AI answer engines including ChatGPT, Perplexity AI, Google AI Overviews, and Claude can correctly read, interpret, trust, and cite your website when answering user queries. A website can rank first in traditional search and still be completely invisible to AI answer engines if it lacks the structural signals those systems require. As AI-driven answers replace click-through results for millions of queries, AI visibility directly affects whether your brand gets cited or ignored.',
    },
    {
        q: 'Why is AI ignoring my website even though it ranks well in Google?',
        a: 'Traditional search ranking and AI citation readiness are measured differently. Google ranks pages based on links, authority, and relevance. AI answer engines prioritize pages that have clear structured data (JSON-LD schema), unambiguous heading hierarchies, verifiable author attribution, outbound citations to authoritative sources, and content that directly answers specific questions. A page can be highly ranked but still fail all of these signals, making it invisible to AI systems that generate cited answers.',
    },
    {
        q: 'What is CITE LEDGER and how does it score my website?',
        a: 'CITE LEDGER is the verification layer inside AiVIS.biz that checks whether AI systems can extract, attribute, and cite your content. It produces a score from 0 to 100 across seven weighted dimensions: Schema and Structured Data (20%), Content Depth (18%), Technical Trust (15%), Meta Tags and Open Graph (15%), AI Readability (12%), Heading Structure (10%), and Security and Trust (10%). Every finding is tied to verifiable on-page evidence; if a signal cannot be proven from the live page, it is not included in the score. Hard-blocker caps prevent inflated scores when critical signals are missing.',
    },
    {
        q: 'What does BRAG stand for and what makes it different from standard SEO audits?',
        a: 'BRAG stands for Based-Retrieval-Auditable-Grading. It is the evidence methodology behind every AiVIS.biz finding. Unlike standard SEO audits that flag issues based on assumptions or estimated scores, BRAG requires every finding to be tied to a stable, verifiable identifier from the live page. If the evidence is not present on the page at the time of the audit, the finding is not reported. This makes AiVIS.biz results reproducible, defensible, and directly actionable rather than speculative.',
    },
    {
        q: 'Which AI answer engines does AiVIS.biz test my website against?',
        a: 'AiVIS.biz audits citation readiness against the four major AI answer engines: ChatGPT (OpenAI), Perplexity AI, Google AI Overviews, and Claude (Anthropic). Each system uses different extraction and trust signals. AiVIS.biz maps your page\'s structural signals against the shared requirements across all four engines, identifying which gaps are universal and which are engine-specific, so fixes are prioritized by maximum cross-engine impact.',
    },
    {
        q: 'What is the most common reason AI answer engines do not cite a website?',
        a: 'The most common reason is missing or incomplete structured data. When a page has no JSON-LD schema, AI systems cannot resolve what the page is, who published it, or what entity it represents. The second most common reason is the absence of direct question-and-answer content. AI engines prefer pages that explicitly answer questions in a standalone format, such as FAQ sections, definition blocks, or step-by-step guides. Pages that only describe a product or service in general prose are frequently passed over in favor of pages that answer specific queries directly.',
    },
    {
        q: 'How long does it take to improve my AI visibility score after making fixes?',
        a: 'Structural fixes such as adding JSON-LD schema, correcting heading hierarchy, and resolving canonical URL issues can be re-crawled and reflected in AI systems within days to a few weeks depending on how frequently your site is indexed. Content fixes such as adding FAQ blocks, author attribution, and outbound citations take effect as soon as the updated page is crawled. AiVIS.biz supports a baseline-fix-re-audit workflow: run an initial audit, implement prioritized fixes, then re-audit to verify and measure score improvement.',
    },
    {
        q: 'Who should use AiVIS.biz and what do I need to get started?',
        a: `AiVIS.biz is built for founders, marketers, developers, and agencies who need to understand why their content is not being cited by AI answer engines. If AI models are ignoring your brand, misquoting your content, or attributing your expertise to competitors, AiVIS.biz shows you exactly why and what to fix. To get started, enter any URL into the audit tool. No account is required for an initial scan. Results include a 0 to 100 ${BRAND.product} score, category grades, BRAG evidence-linked findings, and a prioritized implementation fix list.`,
    },
] as const;

/* ── Structured data generator ──────────────────────────────────────────── */

export function generateHomepageStructuredData(): Record<string, unknown>[] {
    const tiers = getTierSnapshot();

    const homepageOrganizationSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Intruvurt Labs',
        legalName: 'Intruvurt Labs',
        url: BRAND.domain,
        logo: {
            '@type': 'ImageObject',
            url: `${BASE_URL}/aivis-logo.png`,
            width: 400,
            height: 400,
        },
        description:
            'Intruvurt Labs builds AI visibility and citation readiness tools. AiVIS.biz is the flagship product, an evidence-backed audit platform that measures whether AI answer engines can extract, trust, and cite your website content.',
        foundingDate: '2026',
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: 'support@aivis.biz',
            telephone: '+1-706-907-5299',
        },
        sameAs: [
            'https://twitter.com/intruvurt',
            'https://www.linkedin.com/in/web4aidev',
            'https://github.com/dobleduche',
        ],
        knowsAbout: [
            'AI visibility',
            'Answer engine optimization',
            'AI citation readiness',
            'Structured data and JSON-LD schema',
            'ChatGPT citation signals',
            'Perplexity AI indexing',
            'Google AI Overviews',
            'BRAG evidence-linked auditing',
        ],
        hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'AiVIS.biz AI Visibility Audit Tools',
            itemListElement: [
                {
                    '@type': 'Offer',
                    itemOffered: {
                        '@type': 'Service',
                        name: 'AI Visibility Audit',
                        description:
                            'A CITE LEDGER audit that scores any URL across seven weighted dimensions and returns BRAG evidence-linked findings with prioritized fixes.',
                        url: BASE_URL,
                    },
                },
            ],
        },
    };

    const schemas: Record<string, unknown>[] = [
        homepageOrganizationSchema,
        buildWebSiteSchema(),
        buildSoftwareApplicationSchema({
            name: 'AiVIS - AI Visibility Audit',
            description:
                'AiVIS.biz audits how AI answer engines including ChatGPT, Perplexity AI, Google AI Overviews, and Claude read, interpret, and cite your website. Every finding is tied to verifiable on-page evidence through BRAG evidence identifiers and scored via CITE LEDGER across seven weighted dimensions.',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            featureList: [
                'AI citation readiness scoring (0-100)',
                'CITE LEDGER seven-dimension weighted audit',
                'BRAG evidence-linked findings',
                'Schema and structured data analysis',
                'Content depth and AI readability scoring',
                'Meta tag and Open Graph validation',
                'Prioritized implementation fix list',
                'Support for ChatGPT, Perplexity AI, Google AI Overviews, and Claude',
            ],
            offers: [
                {
                    name: 'Free AI visibility audit',
                    price: String(tiers.observer.price),
                    priceCurrency: 'USD',
                    availability: 'https://schema.org/InStock',
                },
            ],
        }),
        buildFaqSchema(
            HOMEPAGE_FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a })),
            { path: '/' },
        ),
    ];

    return schemas;
}
