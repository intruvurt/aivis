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
        q: 'What is AiVIS and what makes it different from other AI optimization tools?',
        a: 'AiVIS is not an optimization tool—it is a diagnostic forensics system. Where other tools say "here\'s how to rank," AiVIS says "here\'s why the model rejected you." We instrument the decision machine itself: showing which semantic bridges you\'re missing, where your entity decays, why a competitor was chosen instead of you, and the exact prompt-to-source mappings the model uses. You get evidence, not advice.',
    },
    {
        q: 'Why should I care about AI citation over traditional search ranking?',
        a: 'Traditional search gives you links. AI-generated answers remove the links entirely and generate synthesis instead. In a ChatGPT or Perplexity answer, your brand is either cited as a source or invisible. No middle ground. You can rank #1 in Google Search and be completely absent from AI answer synthesis if the model\'s retrieval logic decides to skip you. AI visibility is becoming the gate for expert authority in search.',
    },
    {
        q: 'What does the CITE LEDGER actually show me?',
        a: 'CITE LEDGER is an immutable forensic log of model decisions. When you run a scan, we show you: which search results the model considered, where it chose to cite competitors instead of you, what semantic bridges it needed that you don\'t have, where your entity went unstable (decay patterns), and proof of the retrieval logic it used. Every claim traces to a verifiable ledger entry—no guessing, no assumptions.',
    },
    {
        q: 'How is diagnostic reporting different from standard audit findings?',
        a: 'Standard audits list problems: "Add more schema," "Fix your headers." Diagnostic reports explain *why* those problems matter for this model. We show: the exact query pattern that triggers your gap, what the model does when it encounters it, why competitors aren\'t affected, and the specific semantic shift that would restore retrieval. It\'s forensic analysis, not a checklist.',
    },
    {
        q: 'Which AI models and search systems does AiVIS analyze?',
        a: 'AiVIS maps your content readiness against ChatGPT, Perplexity AI, Google AI Overviews, and Claude. Each has different extraction and trust signals. We identify which gaps are universal (affecting all four) and which are engine-specific. Fixes are prioritized by maximum cross-engine impact—meaning one change can restore visibility across multiple systems simultaneously.',
    },
    {
        q: 'What is entity decay and why does it matter?',
        a: 'Entity decay happens when a model stops citing your brand or topic over time because it\'s reassigned trust to a competitor or found conflicting information. Unlike traditional search rankings (which update in weeks), model entity decay can happen in days. AiVIS shows you the decay timeline: when it started, which queries were affected first, which competitors gained during your decay period, and what signal patterns restore stability. It\'s real-time competitive intelligence.',
    },
    {
        q: 'How do I know if the report is actually correct or just theoretical?',
        a: 'Every diagnostic output traces to CITE LEDGER—our immutable forensic ledger. We don\'t make claims about "should work" or "likely to help." We capture the actual decision path the model took, the sources it evaluated, the ones it rejected, and the reasoning signals it used. If we can\'t verify it from the scan, we don\'t report it. You get forensic evidence, not theory.',
    },
    {
        q: 'What happens after I run a diagnostic scan?',
        a: `Results include: a citability score (0-100 based on seven forensic dimensions), entity decay patterns with timelines, competitor analysis (why they rank higher for shared topics), semantic bridge gaps (what connections are missing), and prompt-to-source mapping (which queries route away from you). Each finding links to ${BRAND.product} ledger entries you can inspect. You can then re-scan after fixes to measure actual impact against the baseline.`,
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
            'Intruvurt Labs builds diagnostic forensics systems for AI visibility. AiVIS.biz is the flagship product: a forensic instrumentation platform that explains why AI models decide to cite, reject, or rerank your content. Every finding traces to an immutable ledger of model decisions.',
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
            'AI citation diagnostics',
            'Citation collapse forensics',
            'Entity decay detection',
            'Semantic bridge failure analysis',
            'Competitor retrieval analysis',
            'Prompt-to-source mapping',
            'AI reasoning transparency',
            'Decision instrumentation',
            'Forensic source preference analysis',
            'CITE LEDGER immutable ledger',
        ],
        hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'AiVIS.biz Diagnostic AI Visibility Tools',
            itemListElement: [
                {
                    '@type': 'Offer',
                    itemOffered: {
                        '@type': 'Service',
                        name: 'AI Citation Diagnostics',
                        description:
                            'Forensic analysis of why AI models cite your competitors instead of you. CITE LEDGER traces every decision.',
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
            name: 'AiVIS - AI Citation Diagnostics',
            description:
                'AiVIS.biz is the forensic instrumentation layer for AI visibility. It shows exactly why ChatGPT, Perplexity AI, Google AI Overviews, and Claude cite your competitors instead of you. Every finding traces to CITE LEDGER—an immutable audit log of model decisions.',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            featureList: [
                'Citability diagnostics score (0-100)',
                'CITE LEDGER forensic decision ledger',
                'Entity decay timeline analysis',
                'Competitor retrieval dissection',
                'Semantic bridge gap detection',
                'Prompt-to-source mapping',
                'Citation collapse point analysis',
                'Multi-engine reasoning trace (ChatGPT, Perplexity, Google AI Overviews, Claude)',
            ],
            offers: [
                {
                    name: 'Free diagnostic scan',
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
