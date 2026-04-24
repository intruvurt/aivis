/**
 * HOMEPAGE SCHEMA GENERATOR — locked to homepage.contract.ts
 *
 * Produces JSON-LD structured data arrays using ONLY values from the contract.
 * Reuses the existing seoSchema.ts builders for format consistency.
 */

import {
    BASE_URL,
    buildWebSiteSchema,
    buildHowToSchema,
    buildFaqSchema,
} from '../lib/seoSchema';
import {
    BRAND,
    getTierSnapshot,
} from './homepage.contract';

/* ── FAQ items (contract-sourced definitions) ───────────────────────────── */

export const HOMEPAGE_FAQ_ITEMS = [
    {
        q: 'What does an AI visibility score between 0 and 100 actually mean?',
        a: 'Your CITE LEDGER score reflects how citation-ready your page is to AI answer engines right now. A score above 80 means the major structural signals are in place and AI systems have what they need to extract, attribute, and cite your content. A score below 50 means critical signals are missing and your page is likely invisible to AI-generated answers even when your content is directly relevant to the query.',
    },
    {
        q: 'Does AiVIS replace my existing SEO tools?',
        a: 'No. AiVIS audits the AI citation layer, the structural signals that determine whether AI answer engines use your content when generating responses. Your existing tools handle rankings, backlinks, and technical crawl health. Those are different problems. AiVIS covers what they were not built to see.',
    },
    {
        q: 'How is BRAG different from a standard audit methodology?',
        a: 'BRAG stands for Based-Retrieval-Auditable-Grading. Every finding in your report is tied to a verifiable evidence identifier from your live page. If it cannot be proven from the page, it does not make it into the score. Standard audit methodologies score against general benchmarks. BRAG scores against your actual page as AI systems see it.',
    },
    {
        q: 'Which AI systems does AiVIS audit for?',
        a: 'AiVIS measures citation readiness across ChatGPT (OpenAI), Perplexity AI, Google AI Overviews, and Claude (Anthropic). These are the four primary AI answer engines that currently surface web content in synthesized responses.',
    },
    {
        q: 'How long does an audit take?',
        a: 'The audit runs in real time against your live URL. Most results are returned within 60 to 90 seconds depending on page complexity and server response time.',
    },
    {
        q: 'Will fixing my AiVIS score guarantee AI citations?',
        a: 'No tool can guarantee AI citation because models make probabilistic decisions at inference time. What AiVIS guarantees is that structural barriers preventing AI systems from reading, trusting, and citing your content are identified and quantified. Remove those barriers and your citation probability increases.',
    },
    {
        q: 'Is AiVIS built for crypto and Web3 projects?',
        a: 'Yes. AI answer engines treat crypto and Web3 pages with elevated skepticism because the space has high noise to signal content ratios. CITE LEDGER applies the same evidence-based methodology, and the trust signal and schema dimensions are particularly high leverage for projects in that space.',
    },
] as const;

/* ── Structured data generator ──────────────────────────────────────────── */

export function generateHomepageStructuredData(): Record<string, unknown>[] {
    const tiers = getTierSnapshot();
    const publishedAt = '2026-04-24';
    const modifiedAt = '2026-04-24';

    const homepageOrganizationSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://aivis.biz/#org',
        name: 'AiVIS',
        alternateName: 'AiVIS.biz',
        url: BRAND.domain,
        description:
            'AiVIS is an AI visibility and citation readiness platform that audits how AI answer engines read, interpret, and cite websites using CITE LEDGER and BRAG evidence-linked grading.',
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: 'support@aivis.biz',
            telephone: '+1-706-907-5299',
        },
        hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'AI Visibility Audit Services',
            itemListElement: [
                {
                    '@type': 'Offer',
                    itemOffered: {
                        '@type': 'Service',
                        name: 'Free AI Visibility Audit',
                        description:
                            'Enter any URL to receive a 0 to 100 CITE LEDGER score with BRAG evidence-linked findings, category grades, and prioritized fixes.',
                    },
                    price: '0',
                    priceCurrency: 'USD',
                },
            ],
        },
    };

    const homepageWebApplicationSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        '@id': 'https://aivis.biz/#webapp',
        name: 'AiVIS',
        alternateName: 'AiVIS.biz',
        url: 'https://aivis.biz',
        description:
            'AiVIS audits whether AI answer engines including ChatGPT, Perplexity AI, Google AI Overviews, and Claude can read, trust, and cite your website. Every score is tied to real on-page evidence through CITE LEDGER and BRAG evidence identifiers.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires modern browser with JavaScript enabled',
        datePublished: publishedAt,
        dateModified: modifiedAt,
        offers: {
            '@type': 'Offer',
            name: 'Free AI visibility audit',
            price: '0',
            priceCurrency: 'USD',
        },
        featureList: [
            'AI citation readiness scoring',
            'CITE LEDGER evidence-linked audit',
            'BRAG auditable grading methodology',
            'Schema and structured data analysis',
            'Content depth measurement',
            'AI readability assessment',
            'Technical trust signal evaluation',
            'Heading structure audit',
            'Meta tag and Open Graph analysis',
            'ChatGPT citation readiness',
            'Perplexity citation readiness',
            'Google AI Overviews citation readiness',
            'Claude citation readiness',
        ],
        publisher: {
            '@id': 'https://aivis.biz/#org',
        },
    };

    const homepageSoftwareApplicationSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        '@id': 'https://aivis.biz/#software-application-home',
        name: 'AiVIS AI Visibility Audit',
        operatingSystem: 'Web',
        applicationCategory: 'UtilitiesApplication',
        url: 'https://aivis.biz',
        description:
            'AI citation readiness auditing tool that scores websites on their ability to be extracted, attributed, and cited by AI answer engines including ChatGPT, Perplexity, Google AI Overviews, and Claude.',
        datePublished: publishedAt,
        dateModified: modifiedAt,
        offers: {
            '@type': 'Offer',
            name: 'Free AI visibility audit',
            price: String(tiers.observer.price),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
        },
    };

    const schemas: Record<string, unknown>[] = [
        homepageOrganizationSchema,
        buildWebSiteSchema('AiVIS.biz | AI Citation Readiness Audit - CITE LEDGER Score'),
        homepageWebApplicationSchema,
        homepageSoftwareApplicationSchema,
        buildFaqSchema(
            HOMEPAGE_FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a })),
            { path: '/' },
        ),
        buildHowToSchema({
            id: 'https://aivis.biz/#howto-home-audit',
            name: 'How to run an AI visibility audit on AiVIS.biz',
            description:
                'Run a CITE LEDGER audit to find out whether AI answer engines can read, trust, and cite your website.',
            url: `${BASE_URL}/`,
            steps: [
                {
                    name: 'Enter your URL',
                    text: 'Go to AiVIS.biz and enter the full URL of the page you want to audit into the audit tool.',
                },
                {
                    name: 'AiVIS crawls the live page',
                    text: 'AiVIS crawls the live rendered page the same way AI answer engine crawlers do, parsing the actual output as AI systems see it.',
                },
                {
                    name: 'CITE LEDGER scores your page',
                    text: 'Your page is scored across seven weighted dimensions and every finding is tied to a BRAG evidence identifier from your live page.',
                },
                {
                    name: 'Review your score and fix list',
                    text: 'Receive a 0 to 100 score, category grades, and a prioritized fix list ordered by impact on AI citation readiness.',
                },
                {
                    name: 'Fix issues and re-audit',
                    text: 'Implement the recommended fixes, re-run the audit, and track score improvement against the BRAG evidence trail.',
                },
            ],
        }),
    ];

    return schemas;
}
