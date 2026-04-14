export interface InsightFaqItem {
  question: string;
  answer: string;
}

export interface InsightArticle {
  slug: string;
  path: string;
  title: string;
  description: string;
  category: 'Strategy' | 'AEO' | 'Geo AI' | 'Conversational';
  publishedAt: string;
  readMinutes: number;
  keywords: string[];
  faq: InsightFaqItem[];
}

export const INSIGHT_ARTICLES: InsightArticle[] = [
  {
    slug: 'ai-search-visibility-2026',
    path: '/ai-search-visibility-2026',
    title: 'Evidence-backed site analysis for AI answers Platform in 2026',
    description:
      'Why traditional SEO is collapsing and how to win with AI-first content infrastructure, AEO, and citation-driven visibility.',
    category: 'Strategy',
    publishedAt: '2026-03-02',
    readMinutes: 8,
    keywords: [
      'Evidence-backed site analysis for AI answers Platform',
      'traditional SEO collapse',
      'AI citations',
      'content infrastructure',
      'answer engines',
      'zero-click search',
    ],
    faq: [
      {
        question: 'What changed between SEO and AI search?',
        answer:
          'AI systems increasingly synthesize answers directly from source material, so inclusion and citation quality matter more than classic rank position. The question is no longer whether you rank, but whether AI models extract and attribute your content.',
      },
      {
        question: 'What is the primary KPI in Evidence-backed site analysis for AI answers?',
        answer:
          'Core KPI is whether your content is extracted and cited accurately in AI-generated answers. Secondary KPIs include schema coverage, answer-block readiness, and entity trust signals.',
      },
      {
        question: 'How is an AI visibility audit different from a traditional SEO audit?',
        answer:
          'Traditional SEO audits evaluate crawlability, backlinks, and keyword density. AI visibility audits measure structural extractability, citation readiness, schema completeness, and whether answer engines can parse discrete facts from your content.',
      },
    ],
  },
  {
    slug: 'aeo-playbook-2026',
    path: '/aeo-playbook-2026',
    title: 'AEO Playbook for 2026',
    description:
      'A practical Answer Engine Optimization framework: question mapping, answer blocks, semantic anchors, and extraction-ready formatting.',
    category: 'AEO',
    publishedAt: '2026-03-02',
    readMinutes: 7,
    keywords: [
      'AEO',
      'answer engine optimization',
      'FAQ structure',
      'query alignment',
      'extractable content',
      'answer blocks',
    ],
    faq: [
      {
        question: 'What does AEO optimize for?',
        answer:
          'AEO optimizes for direct answer extraction by AI systems, not only link-based rankings. The goal is to structure content so models can identify, extract, and cite specific claims without losing meaning.',
      },
      {
        question: 'How long should answer blocks be?',
        answer:
          'Use layered responses: concise direct answer first (1-2 sentences), then a short expansion (3-4 sentences), and deeper detail for follow-up questions. This mirrors how AI models synthesize multi-depth answers.',
      },
      {
        question: 'What is the difference between AEO and traditional FAQ optimization?',
        answer:
          'Traditional FAQ optimization targets featured snippets with keyword-stuffed Q/A pairs. AEO structures content so AI models can extract accurate, context-aware answers from any section of your page, not just FAQ blocks.',
      },
    ],
  },
  {
    slug: 'geo-ai-ranking-2026',
    path: '/geo-ai-ranking-2026',
    title: 'Geo AI Ranking in 2026',
    description:
      'How to structure region-aware content so AI systems adapt answers to local intent, entities, and market behavior.',
    category: 'Geo AI',
    publishedAt: '2026-03-02',
    readMinutes: 6,
    keywords: [
      'geo ranking',
      'local AI search',
      'regional relevance',
      'location intent',
      'market-specific content',
      'local entity schema',
    ],
    faq: [
      {
        question: 'Why does location matter more in AI answers?',
        answer:
          'AI models rewrite answers based on regional intent patterns, local entities, and behavior signals from similar users. A question about "best coffee shop" in Tokyo triggers completely different source selection than the same query in Austin.',
      },
      {
        question: 'What is the fastest geo optimization win?',
        answer:
          'Create market-specific Q/A sections and local use cases instead of only inserting city keywords in title tags. Add LocalBusiness and Place schema with geo-coordinates, and ensure region-specific content is on dedicated pages rather than buried in generic landing pages.',
      },
    ],
  },
  {
    slug: 'conversational-query-playbook-2026',
    path: '/conversational-query-playbook-2026',
    title: 'Conversational Query Playbook for 2026',
    description:
      'Conversational queries are how people actually talk to AI models and voice assistants. The structure is completely different from keyword queries and most content is not built for it.',
    category: 'Conversational',
    publishedAt: '2026-03-28',
    readMinutes: 8,
    keywords: [
      'conversational queries',
      'natural language search',
      'voice search optimization',
      'AI assistant queries',
      'question-first content',
      'intent-based content',
    ],
    faq: [
      {
        question: 'How are conversational queries different from keyword queries?',
        answer:
          'Keyword queries are compressed fragments like "best CRM software 2026." Conversational queries are full natural sentences: "What CRM should I use if my sales team is under 10 people and we already use Slack?" The intent is more specific, the context is richer, and the expected answer is more nuanced.',
      },
      {
        question: 'Why does most content fail conversational queries?',
        answer:
          'Most content is optimized for 2-4 word keyword fragments. Conversational queries contain qualifiers, constraints, and follow-up context that keyword-optimized pages never address. A page titled "Best CRM Software" cannot answer "Which CRM works best for a remote nonprofit with under 50 donors?"',
      },
      {
        question: 'How do I structure content for conversational search?',
        answer:
          'Write headings as full questions people would actually ask. Use follow-up sections that address qualifiers (budget, team size, industry). Add comparison blocks that handle "vs" and "instead of" patterns. Structure every major section as a standalone answer that makes sense without reading the full page.',
      },
      {
        question: 'Does voice search require different optimization than text-based AI queries?',
        answer:
          'Voice queries are typically longer and more conversational than typed queries. The core optimization is the same: answer-block structure, question-format headings, and schema markup. The main difference is voice queries skew toward local intent and immediate-action phrasing.',
      },
    ],
  },
  {
    slug: 'voice-search-ai-answer-optimization-2026',
    path: '/voice-search-ai-answer-optimization-2026',
    title: 'Voice Search and AI Answer Optimization in 2026',
    description:
      'Voice is the fastest-growing AI interaction surface. Here is how to structure content so voice assistants extract, trust, and speak your answers.',
    category: 'Conversational',
    publishedAt: '2026-03-28',
    readMinutes: 7,
    keywords: [
      'voice search optimization',
      'AI voice assistants',
      'spoken answer format',
      'voice-first content',
      'speakable schema',
      'voice intent patterns',
    ],
    faq: [
      {
        question: 'Why does voice search matter for AI visibility?',
        answer:
          'Voice interactions produce exactly one answer. There is no scroll, no second result, no "see more." If your content is not the answer the model selects, you are completely invisible for that query. Voice is winner-take-all.',
      },
      {
        question: 'What content structure works best for voice answers?',
        answer:
          'Lead with a single-sentence direct answer, then expand with 2-3 supporting sentences. Keep the primary answer under 30 words for speakability. Use SpeakableSpecification schema to mark which sections are voice-ready.',
      },
      {
        question: 'How do voice queries differ from typed conversational queries?',
        answer:
          'Voice queries are more action-oriented ("find me," "show me," "how do I"), skew heavily toward local intent, and use more filler words and natural phrasing. Typed conversational queries are slightly more structured but still longer than traditional keyword searches.',
      },
      {
        question: 'What schema types help with voice search?',
        answer:
          'SpeakableSpecification marks content as voice-ready. FAQPage and HowTo schemas give voice assistants structured Q/A and step-by-step content. LocalBusiness schema helps with "near me" voice queries. Combine these with clear, concise answer blocks.',
      },
    ],
  },
];

export function getInsightBySlug(slug: string): InsightArticle | undefined {
  return INSIGHT_ARTICLES.find((article) => article.slug === slug);
}
