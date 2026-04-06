/**
 * fixpackGenerator.ts - Generates concrete, actionable fixpacks from
 * failed SSFR rule results and evidence items.
 *
 * Each fixpack contains real, ready-to-use assets (JSON-LD patches,
 * meta tags, content blocks) based on the actual evidence collected.
 */

import type {
  SSFREvidenceItem,
  SSFRRuleResult,
  SSFRFixpack,
  SSFRFixpackAsset,
  SSFRFixpackType,
  SSFRRuleSeverity,
} from '../../../shared/types.js';

const SEVERITY_PRIORITY: Record<SSFRRuleSeverity, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

// ─── Fixpack template registry ──────────────────────────────────────────────

interface FixpackTemplate {
  rule_id: string;
  type: SSFRFixpackType;
  title: string;
  summary: string;
  auto_generatable: boolean;
  generate: (evidence: SSFREvidenceItem[], targetUrl?: string) => SSFRFixpackAsset[];
}

function findEvidence(items: SSFREvidenceItem[], key: string): SSFREvidenceItem | undefined {
  return items.find(e => e.evidence_key === key);
}

function extractDomain(url?: string): string {
  if (!url) return 'example.com';
  try {
    return new URL(url).hostname;
  } catch {
    return 'example.com';
  }
}

// ─── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES: FixpackTemplate[] = [

  // ════════ SOURCE fixes ════════

  {
    rule_id: 'source_org_schema',
    type: 'schema_fix',
    title: 'Add Organization schema markup',
    summary: 'Missing Organization or LocalBusiness JSON-LD schema. This is a hard blocker for AI citation eligibility.',
    auto_generatable: true,
    generate(evidence, targetUrl) {
      const domain = extractDomain(targetUrl);
      const sameAs = findEvidence(evidence, 'same_as_links');
      const links = Array.isArray(sameAs?.value) ? sameAs.value as string[] : [];
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: domain.replace(/^www\./, '').split('.')[0],
        url: targetUrl || `https://${domain}`,
        ...(links.length > 0 ? { sameAs: links } : {}),
      };
      return [{
        type: 'json_ld' as const,
        label: 'Organization JSON-LD',
        content: `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
      }];
    },
  },

  {
    rule_id: 'source_same_as',
    type: 'entity_patch',
    title: 'Add sameAs social verification links',
    summary: 'Organization schema is missing sameAs links. Add verified social profile URLs to establish cross-platform identity.',
    auto_generatable: false,
    generate() {
      return [{
        type: 'markdown' as const,
        label: 'sameAs setup guide',
        content: `## Add sameAs Links to Organization Schema\n\nAdd a \`sameAs\` array to your Organization JSON-LD with your verified profiles:\n\n\`\`\`json\n"sameAs": [\n  "https://twitter.com/YOUR_HANDLE",\n  "https://linkedin.com/company/YOUR_COMPANY",\n  "https://github.com/YOUR_ORG"\n]\n\`\`\`\n\nMinimum 2 links required. Use actual verified social profiles.`,
      }];
    },
  },

  {
    rule_id: 'source_author_entity',
    type: 'schema_fix',
    title: 'Add author entity to structured data',
    summary: 'No author entity detected. Adding Person schema with author attribution improves citation trustworthiness.',
    auto_generatable: true,
    generate(_, targetUrl) {
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        author: {
          '@type': 'Person',
          name: 'Author Name',
          url: targetUrl ? `${targetUrl}/about` : '#',
        },
      };
      return [{
        type: 'json_ld' as const,
        label: 'Author entity JSON-LD patch',
        content: `<!-- Add author to your existing Article/WebPage schema -->\n<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
      }];
    },
  },

  {
    rule_id: 'source_canonical',
    type: 'meta_fix',
    title: 'Add canonical URL tag',
    summary: 'No canonical URL declared. This can cause duplicate content confusion for AI crawlers.',
    auto_generatable: true,
    generate(_, targetUrl) {
      return [{
        type: 'meta_tag' as const,
        label: 'Canonical link tag',
        content: `<link rel="canonical" href="${targetUrl || 'https://your-site.com/page'}" />`,
      }];
    },
  },

  {
    rule_id: 'source_robots_txt',
    type: 'content_block',
    title: 'Create or fix robots.txt',
    summary: 'robots.txt is missing or inaccessible. Hard blocker - search engines and AI crawlers cannot verify access permissions.',
    auto_generatable: true,
    generate(_, targetUrl) {
      const domain = extractDomain(targetUrl);
      return [{
        type: 'text' as const,
        label: 'robots.txt template',
        content: `User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml`,
      }];
    },
  },

  {
    rule_id: 'source_ai_crawler_access',
    type: 'content_block',
    title: 'Unblock AI crawlers in robots.txt',
    summary: 'One or more AI crawlers are explicitly blocked. Critical hard blocker - blocked crawlers cannot index or cite your content.',
    auto_generatable: true,
    generate(evidence) {
      const item = findEvidence(evidence, 'ai_crawler_access');
      const access = item?.value as Record<string, boolean> | undefined;
      const blocked = access ? Object.entries(access).filter(([, v]) => v === false).map(([k]) => k) : [];
      const lines = blocked.map(c => `User-agent: ${c}\nAllow: /`).join('\n\n');
      return [{
        type: 'text' as const,
        label: 'Unblock AI crawlers',
        content: `## Remove AI crawler blocks from robots.txt\n\nThe following crawlers are currently blocked:\n${blocked.map(b => `- ${b}`).join('\n')}\n\nReplace their Disallow directives with:\n\n${lines || 'User-agent: GPTBot\nAllow: /'}`,
      }];
    },
  },

  {
    rule_id: 'source_llms_txt',
    type: 'content_block',
    title: 'Create llms.txt file',
    summary: 'No llms.txt detected. This emerging standard helps LLMs understand your site structure and preferred citation format.',
    auto_generatable: true,
    generate(_, targetUrl) {
      const domain = extractDomain(targetUrl);
      return [{
        type: 'text' as const,
        label: 'llms.txt template',
        content: `# ${domain}\n\n> Brief description of your site/organization\n\n## Docs\n\n- [Homepage](https://${domain}/)\n- [About](https://${domain}/about)\n\n## Optional\n\n- [Blog](https://${domain}/blog)\n- [API Reference](https://${domain}/docs/api)`,
      }];
    },
  },

  // ════════ SIGNAL fixes ════════

  {
    rule_id: 'signal_title_quality',
    type: 'meta_fix',
    title: 'Fix page title tag',
    summary: 'Title tag is missing or outside optimal length (20-70 chars). Hard blocker for AI extraction.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'title_tag');
      const current = typeof item?.value === 'string' ? item.value : '';
      return [{
        type: 'meta_tag' as const,
        label: 'Title tag fix',
        content: `<!-- Current: "${current}" -->\n<!-- Recommendation: Write a descriptive title between 20-70 characters -->\n<title>Your Optimized Page Title Here (20-70 chars)</title>`,
      }];
    },
  },

  {
    rule_id: 'signal_meta_description',
    type: 'meta_fix',
    title: 'Add or improve meta description',
    summary: 'Meta description is missing or not optimal. This directly affects how AI models summarize your page.',
    auto_generatable: false,
    generate() {
      return [{
        type: 'meta_tag' as const,
        label: 'Meta description tag',
        content: `<meta name="description" content="Write a clear, factual description of this page in 120-160 characters." />`,
      }];
    },
  },

  {
    rule_id: 'signal_og_tags',
    type: 'meta_fix',
    title: 'Add Open Graph tags',
    summary: 'Open Graph meta tags are incomplete. These affect how AI platforms preview and reference your content.',
    auto_generatable: true,
    generate(_, targetUrl) {
      return [{
        type: 'meta_tag' as const,
        label: 'Open Graph tags',
        content: `<meta property="og:title" content="Your Page Title" />\n<meta property="og:description" content="Concise page description" />\n<meta property="og:type" content="website" />\n<meta property="og:url" content="${targetUrl || 'https://your-site.com/page'}" />\n<meta property="og:image" content="https://your-site.com/og-image.png" />`,
      }];
    },
  },

  {
    rule_id: 'signal_json_ld',
    type: 'schema_fix',
    title: 'Add JSON-LD structured data',
    summary: 'No JSON-LD schema blocks found. Hard blocker - structured data is essential for AI entity extraction.',
    auto_generatable: true,
    generate(_, targetUrl) {
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Page Title',
        description: 'Page description',
        url: targetUrl || 'https://your-site.com/page',
      };
      return [{
        type: 'json_ld' as const,
        label: 'WebPage JSON-LD',
        content: `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
      }];
    },
  },

  {
    rule_id: 'signal_h1_heading',
    type: 'content_block',
    title: 'Fix H1 heading usage',
    summary: 'Page should have exactly one H1 heading. Multiple or missing H1s confuse AI content extraction.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'h1_heading');
      const h1s = Array.isArray(item?.value) ? item.value : [];
      return [{
        type: 'markdown' as const,
        label: 'H1 heading fix guide',
        content: `## Fix H1 Heading\n\nCurrent H1 count: ${h1s.length}\nIdeal: exactly 1\n\n${h1s.length > 1 ? 'Demote extra H1 tags to H2 or lower.' : 'Add a single descriptive H1 tag at the top of your main content.'}`,
      }];
    },
  },

  {
    rule_id: 'signal_heading_hierarchy',
    type: 'content_block',
    title: 'Fix heading hierarchy structure',
    summary: 'Heading levels are not properly nested. AI crawlers use heading hierarchy to understand content structure.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'heading_hierarchy');
      const val = item?.value as Record<string, number> | undefined;
      return [{
        type: 'markdown' as const,
        label: 'Heading hierarchy guide',
        content: `## Fix Heading Hierarchy\n\nCurrent distribution:\n- H1: ${val?.h1 ?? 0}\n- H2: ${val?.h2 ?? 0}\n- H3: ${val?.h3 ?? 0}\n\nEnsure:\n1. Exactly 1 H1\n2. At least 2 H2 subsections\n3. H3 only under H2 (never skip levels)`,
      }];
    },
  },

  {
    rule_id: 'signal_sitemap',
    type: 'content_block',
    title: 'Create sitemap.xml',
    summary: 'No sitemap.xml detected. Sitemaps help AI crawlers discover and index your content efficiently.',
    auto_generatable: true,
    generate(_, targetUrl) {
      const domain = extractDomain(targetUrl);
      return [{
        type: 'text' as const,
        label: 'sitemap.xml template',
        content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://${domain}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`,
      }];
    },
  },

  {
    rule_id: 'signal_lang',
    type: 'meta_fix',
    title: 'Add language attribute to HTML tag',
    summary: 'No lang attribute on the HTML element. This helps AI models determine content language.',
    auto_generatable: true,
    generate(evidence) {
      const item = findEvidence(evidence, 'lang_attribute');
      return [{
        type: 'html_block' as const,
        label: 'HTML lang attribute',
        content: `<html lang="${typeof item?.value === 'string' && item.value ? item.value : 'en'}">`,
      }];
    },
  },

  // ════════ FACT fixes ════════

  {
    rule_id: 'fact_word_count',
    type: 'insight',
    title: 'Increase content depth',
    summary: 'Content is below 800 words. Hard blocker - thin content is rarely cited by AI models.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'word_count');
      const wc = typeof item?.value === 'number' ? item.value : 0;
      return [{
        type: 'markdown' as const,
        label: 'Content depth recommendation',
        content: `## Increase Content Depth\n\nCurrent word count: ${wc}\nMinimum target: 800 words\nIdeal range: 1200-2500 words\n\nSuggestions:\n- Add detailed explanations for each section\n- Include real examples or case studies\n- Add a FAQ section with 3-5 questions\n- Expand on technical details or methodology`,
      }];
    },
  },

  {
    rule_id: 'fact_question_headings',
    type: 'content_block',
    title: 'Add question-format headings',
    summary: 'Fewer than 3 question-format headings. These directly map to AI Q&A extraction patterns.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'question_headings');
      const val = item?.value as Record<string, unknown> | undefined;
      const samples = Array.isArray(val?.samples) ? val.samples as string[] : [];
      return [{
        type: 'markdown' as const,
        label: 'Question heading examples',
        content: `## Add Question-Format Headings\n\nCurrent count: ${val?.count ?? 0}\nTarget: at least 3\n\n${samples.length > 0 ? `Existing:\n${samples.map(s => `- ${s}`).join('\n')}\n\n` : ''}Add headings like:\n- "What is [topic]?"\n- "How does [feature] work?"\n- "Why is [benefit] important?"`,
      }];
    },
  },

  {
    rule_id: 'fact_tldr',
    type: 'content_block',
    title: 'Add TL;DR or summary block',
    summary: 'No TL;DR or summary section detected. Concise summaries are preferred by AI for citation snippets.',
    auto_generatable: false,
    generate() {
      return [{
        type: 'html_block' as const,
        label: 'TL;DR block template',
        content: `<section id="tldr">\n  <h2>TL;DR</h2>\n  <p>Write a 2-3 sentence summary of the key points on this page.</p>\n</section>`,
      }];
    },
  },

  {
    rule_id: 'fact_image_alt',
    type: 'insight',
    title: 'Improve image alt text coverage',
    summary: 'Image alt text coverage is below 90%. AI models use alt text to understand visual content.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'image_alt_coverage');
      const val = item?.value as Record<string, number> | undefined;
      return [{
        type: 'markdown' as const,
        label: 'Alt text audit guide',
        content: `## Improve Image Alt Text\n\nCurrent coverage: ${Math.round((val?.coverage ?? 0) * 100)}%\nTotal images: ${val?.total ?? 'unknown'}\nWith alt: ${val?.with_alt ?? 'unknown'}\n\nEvery meaningful image needs descriptive alt text. Use specific, factual descriptions - not keyword stuffing.`,
      }];
    },
  },

  {
    rule_id: 'fact_internal_links',
    type: 'insight',
    title: 'Add more internal links',
    summary: 'Fewer than 3 internal links. Internal linking helps AI crawlers discover related content and build entity graphs.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'internal_links');
      const count = typeof item?.value === 'number' ? item.value : 0;
      return [{
        type: 'markdown' as const,
        label: 'Internal linking guide',
        content: `## Add Internal Links\n\nCurrent count: ${count}\nMinimum target: 3\n\nLink to:\n- Related pages or articles on your site\n- Your about/team page\n- Service or product detail pages\n- FAQ or documentation pages`,
      }];
    },
  },

  {
    rule_id: 'fact_external_links',
    type: 'insight',
    title: 'Add external reference links',
    summary: 'Fewer than 2 external reference links. External citations demonstrate factual grounding.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'external_links');
      const count = typeof item?.value === 'number' ? item.value : 0;
      return [{
        type: 'markdown' as const,
        label: 'External linking guide',
        content: `## Add External References\n\nCurrent count: ${count}\nMinimum target: 2\n\nLink to:\n- Industry standards or specifications\n- Research papers or authoritative sources\n- Relevant Wikipedia or documentation pages\n- Government or institutional data sources`,
      }];
    },
  },

  // ════════ RELATIONSHIP fixes ════════

  {
    rule_id: 'rel_schema_depth',
    type: 'schema_fix',
    title: 'Add more schema types for richer entity graph',
    summary: 'Fewer than 3 schema types detected. Multiple interconnected schemas build richer knowledge graphs.',
    auto_generatable: true,
    generate(evidence, targetUrl) {
      const item = findEvidence(evidence, 'schema_depth');
      const existing = Array.isArray(item?.value) ? item.value as string[] : [];
      const suggestions = ['Organization', 'WebPage', 'BreadcrumbList', 'FAQPage', 'Article']
        .filter(t => !existing.includes(t));
      const breadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: targetUrl || 'https://your-site.com',
        }],
      };
      return [{
        type: 'json_ld' as const,
        label: 'BreadcrumbList JSON-LD',
        content: `<!-- Existing types: ${existing.join(', ') || 'none'} -->\n<!-- Suggested additions: ${suggestions.join(', ')} -->\n<script type="application/ld+json">\n${JSON.stringify(breadcrumb, null, 2)}\n</script>`,
      }];
    },
  },

  {
    rule_id: 'rel_link_diversity',
    type: 'insight',
    title: 'Improve link balance ratio',
    summary: 'Internal/external link ratio is imbalanced. A healthy mix signals topical authority and factual grounding.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'link_diversity');
      const val = item?.value as Record<string, number> | undefined;
      return [{
        type: 'markdown' as const,
        label: 'Link diversity guide',
        content: `## Balance Link Diversity\n\nCurrent ratio: ${Math.round((val?.ratio ?? 0) * 100)}%\nInternal: ${val?.internal ?? 0}\nExternal: ${val?.external ?? 0}\n\nAim for at least 15% external links relative to total links.`,
      }];
    },
  },

  {
    rule_id: 'rel_performance',
    type: 'insight',
    title: 'Improve page load performance',
    summary: 'LCP exceeds 2500ms threshold. Slow pages may be deprioritized by AI crawlers.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'performance');
      const val = item?.value as Record<string, number> | undefined;
      return [{
        type: 'markdown' as const,
        label: 'Performance optimization guide',
        content: `## Improve Page Performance\n\nCurrent LCP: ${val?.lcp_ms ?? 'unknown'}ms\nTarget: < 2500ms\n\nActions:\n- Optimize and lazy-load images\n- Minimize render-blocking CSS/JS\n- Enable server-side caching\n- Use a CDN for static assets\n- Preload critical resources`,
      }];
    },
  },

  {
    rule_id: 'rel_contradiction_clean',
    type: 'insight',
    title: 'Resolve content contradictions',
    summary: 'Critical contradictions detected. AI models may refuse to cite content that contains self-contradicting information.',
    auto_generatable: false,
    generate(evidence) {
      const item = findEvidence(evidence, 'contradiction_status');
      return [{
        type: 'markdown' as const,
        label: 'Contradiction resolution guide',
        content: `## Resolve Content Contradictions\n\nStatus: ${item?.value ?? 'unknown'}\n\nReview your page for:\n- Conflicting claims in different sections\n- Outdated statistics alongside newer data\n- Inconsistent terminology or definitions\n- Metadata that contradicts page content`,
      }];
    },
  },

  {
    rule_id: 'rel_geo_source',
    type: 'insight',
    title: 'Improve GEO source verification',
    summary: 'GEO source verification failed. Ensure factual claims are backed by verifiable sources.',
    auto_generatable: false,
    generate() {
      return [{
        type: 'markdown' as const,
        label: 'GEO source verification guide',
        content: `## Improve Source Verification\n\nEnsure:\n- Claims reference specific data sources\n- Statistics include dates and methodology\n- Authority signals (author credentials, org affiliation) are present\n- External links point to primary sources, not aggregators`,
      }];
    },
  },
];

// ─── Build template lookup ──────────────────────────────────────────────────

const templateByRuleId = new Map<string, FixpackTemplate>();
for (const t of TEMPLATES) {
  templateByRuleId.set(t.rule_id, t);
}

/** Look up a single template by its rule_id. Used by fixWorker. */
export function getTemplateByRuleId(ruleId: string): FixpackTemplate | undefined {
  return templateByRuleId.get(ruleId);
}

/** All known rule_ids for iteration */
export function getAllRuleIds(): string[] {
  return Array.from(templateByRuleId.keys());
}

/**
 * Match an issue title (from v1_issues) to a fixpack template rule_id.
 * Uses keyword patterns derived from the SSFR rule engine titles and
 * common issue descriptions created during audit processing.
 */
export function matchRuleIdFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\borganization\b.*\bschema\b|\blocal\s*business\b.*\bschema\b|\borg\b.*\bjson-?ld\b/, 'source_org_schema'],
    [/\bsame\s*as\b.*\blink|\bsocial\b.*\bverif|\bsame\s*as\b.*\bmissing/, 'source_same_as'],
    [/\bauthor\b.*\bentity\b|\bauthor\b.*\bschema\b|\bperson\b.*\bschema\b/, 'source_author_entity'],
    [/\bcanonical\b.*\burl\b|\bcanonical\b.*\btag\b|\bcanonical\b.*\bmissing\b/, 'source_canonical'],
    [/\brobots\.txt\b.*\bmissing\b|\bcreate\b.*\brobots\b|\brobots\.txt\b.*\binaccessible\b/, 'source_robots_txt'],
    [/\bai\s*crawler\b.*\bblock|\bunblock\b.*\bcrawler|\bcrawler\b.*\baccess/, 'source_ai_crawler_access'],
    [/\bllms\.txt\b|\bllms\s+txt\b/, 'source_llms_txt'],
    [/\btitle\b.*\btag\b.*\b(missing|length|quality|fix)\b|\btitle\b.*\b(too short|too long|empty)\b/, 'signal_title_quality'],
    [/\bmeta\s*description\b/, 'signal_meta_description'],
    [/\bopen\s*graph\b|\bog\s*tag|\bog:title\b/, 'signal_og_tags'],
    [/\bjson-?ld\b|\bstructured\s*data\b.*\bmissing\b|\bno\b.*\bjson-?ld\b|\bschema\b.*\bmissing\b/, 'signal_json_ld'],
    [/\bh1\b.*\bheading\b|\bh1\b.*\bmissing\b|\bmultiple\b.*\bh1\b/, 'signal_h1_heading'],
    [/\bheading\b.*\bhierarchy\b|\bheading\b.*\bstructure\b|\bnested\b.*\bheading\b/, 'signal_heading_hierarchy'],
    [/\bsitemap\b.*\bmissing\b|\bcreate\b.*\bsitemap\b|\bsitemap\.xml\b/, 'signal_sitemap'],
    [/\blang\b.*\battribute\b|\bhtml\b.*\blang\b|\blanguage\b.*\bmissing\b/, 'signal_lang'],
    [/\bword\s*count\b|\bcontent\b.*\bdepth\b|\bthin\s*content\b/, 'fact_word_count'],
    [/\bquestion\b.*\bheading|\bfaq\b.*\bheading|\bq&a\b.*\bheading/, 'fact_question_headings'],
    [/\btl;?dr\b|\bsummary\b.*\bblock\b|\bsummary\b.*\bmissing\b/, 'fact_tldr'],
    [/\bimage\b.*\balt\b|\balt\s*text\b|\balt\b.*\bcoverage\b/, 'fact_image_alt'],
    [/\binternal\b.*\blink/, 'fact_internal_links'],
    [/\bexternal\b.*\blink|\breference\b.*\blink/, 'fact_external_links'],
    [/\bschema\b.*\bdepth\b|\bschema\b.*\btype.*\b(few|count|richer)\b|\bentity\s*graph\b/, 'rel_schema_depth'],
    [/\blink\b.*\bdiversity\b|\blink\b.*\bbalance\b|\blink\b.*\bratio\b/, 'rel_link_diversity'],
    [/\bperformance\b|\blcp\b|\bpage\s*load\b|\bpage\s*speed\b/, 'rel_performance'],
    [/\bcontradiction\b/, 'rel_contradiction_clean'],
    [/\bgeo\b.*\bsource\b|\bsource\b.*\bverif/, 'rel_geo_source'],
  ];

  for (const [pattern, ruleId] of patterns) {
    if (pattern.test(t)) return ruleId;
  }

  return null;
}

// ─── Main generation function ───────────────────────────────────────────────

export function generateFixpacks(
  ruleResults: SSFRRuleResult[],
  evidence: SSFREvidenceItem[],
  targetUrl?: string,
): SSFRFixpack[] {
  const failed = ruleResults.filter(r => !r.passed);

  // Sort: critical > high > medium > low, then hard blockers first
  const severityOrder: Record<SSFRRuleSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  failed.sort((a, b) => {
    if (a.is_hard_blocker !== b.is_hard_blocker) return a.is_hard_blocker ? -1 : 1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const fixpacks: SSFRFixpack[] = [];

  for (const rule of failed) {
    const template = templateByRuleId.get(rule.rule_id);
    if (!template) continue;

    const assets = template.generate(evidence, targetUrl);
    if (assets.length === 0) continue;

    fixpacks.push({
      type: template.type,
      title: template.title,
      summary: template.summary,
      priority: SEVERITY_PRIORITY[rule.severity] ?? 3,
      assets,
      auto_generatable: template.auto_generatable,
      verification_status: 'pending',
      based_on_rule_ids: [rule.rule_id],
    });
  }

  return fixpacks;
}
