/**
 * Fixpack Generator - produces 5 fixpack classes from rule results + evidence.
 *
 * Fixpack classes:
 *   1. Foundation - crawlability, indexability, renderability fixes
 *   2. Schema - JSON-LD / structured data additions
 *   3. AI Readability - metadata, entity, content improvements
 *   4. Public Proof - citation + trust layer fixes
 *   5. Content Depth - long-form content + FAQ expansion
 *
 * Every fixpack asset is real, actionable content (code snippets, text).
 * Never generates empty shells.
 */

import { getPool } from '../postgresql.js';
import type { RuleResult, ScoreSnapshot } from './ruleEngine.js';
import type { EvidenceItem } from './evidenceLedger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FixpackType =
  | 'foundation'
  | 'schema'
  | 'ai_readability'
  | 'public_proof'
  | 'content_depth';

export interface Fixpack {
  title: string;
  summary: string;
  priority: number;
  type: FixpackType;
  frameworkTargets: string[];
  autoGeneratable: boolean;
  estimatedLiftMin: number;
  estimatedLiftMax: number;
  evidenceKeys: string[];
  ruleIds: string[];
  assets: FixpackAsset[];
}

export interface FixpackAsset {
  assetType: string;
  label: string;
  content: string;
}

export interface BRAGTrailEntry {
  recommendationId: string;
  buildSource: string;
  referenceIds: string[];
  auditLinkage: string;
  groundOutput: Record<string, unknown>;
  confidence: number;
  advisoryOnly: boolean;
}

// ─── Framework detection ──────────────────────────────────────────────────────

export function detectFramework(html: string): string {
  const lower = html.toLowerCase();
  if (lower.includes('__next') || lower.includes('_next/static')) return 'nextjs';
  if (lower.includes('__nuxt') || lower.includes('nuxt')) return 'nuxt';
  if (lower.includes('gatsby')) return 'gatsby';
  if (lower.includes('wp-content') || lower.includes('wordpress')) return 'wordpress';
  if (lower.includes('shopify')) return 'shopify';
  if (lower.includes('wix.com')) return 'wix';
  if (lower.includes('squarespace')) return 'squarespace';
  if (lower.includes('webflow')) return 'webflow';
  if (lower.includes('data-reactroot') || lower.includes('_reactroot')) return 'react';
  if (lower.includes('ng-version') || lower.includes('angular')) return 'angular';
  if (lower.includes('data-v-') || lower.includes('vue')) return 'vue';
  return 'generic';
}

// ─── Fixpack generation ───────────────────────────────────────────────────────

export function generateFixpacks(
  ruleResults: RuleResult[],
  evidence: EvidenceItem[],
  scoreSnapshot: ScoreSnapshot,
  framework: string,
): Fixpack[] {
  const failedRules = ruleResults.filter((r) => !r.passed);
  if (failedRules.length === 0) return [];

  const evidenceMap = new Map<string, EvidenceItem>();
  for (const item of evidence) evidenceMap.set(item.key, item);

  const fixpacks: Fixpack[] = [];

  // 1. Foundation fixpack
  const foundationRules = failedRules.filter(
    (r) => r.family === 'crawlability' || r.family === 'indexability' || r.family === 'renderability',
  );
  if (foundationRules.length > 0) {
    fixpacks.push({
      title: 'Foundation Fixes',
      summary: `${foundationRules.length} issue(s) affecting crawlability, indexability, and renderability.`,
      priority: 1,
      type: 'foundation',
      frameworkTargets: [framework],
      autoGeneratable: true,
      estimatedLiftMin: foundationRules.reduce((s, r) => s + Math.abs(r.scoreImpact) * 0.6, 0),
      estimatedLiftMax: foundationRules.reduce((s, r) => s + Math.abs(r.scoreImpact), 0),
      evidenceKeys: [...new Set(foundationRules.flatMap((r) => r.evidenceKeys))],
      ruleIds: foundationRules.map((r) => r.ruleId),
      assets: foundationRules.flatMap((r) => generateFoundationAssets(r, evidenceMap, framework)),
    });
  }

  // 2. Schema fixpack
  const schemaRules = failedRules.filter((r) => r.family === 'schema');
  if (schemaRules.length > 0) {
    fixpacks.push({
      title: 'Schema & Structured Data',
      summary: `${schemaRules.length} structured data improvement(s) to enhance AI entity recognition.`,
      priority: 2,
      type: 'schema',
      frameworkTargets: [framework],
      autoGeneratable: true,
      estimatedLiftMin: schemaRules.reduce((s, r) => s + Math.abs(r.scoreImpact) * 0.6, 0),
      estimatedLiftMax: schemaRules.reduce((s, r) => s + Math.abs(r.scoreImpact), 0),
      evidenceKeys: [...new Set(schemaRules.flatMap((r) => r.evidenceKeys))],
      ruleIds: schemaRules.map((r) => r.ruleId),
      assets: schemaRules.flatMap((r) => generateSchemaAssets(r, evidenceMap, framework)),
    });
  }

  // 3. AI Readability fixpack
  const readabilityRules = failedRules.filter(
    (r) => r.family === 'metadata' || r.family === 'entity',
  );
  if (readabilityRules.length > 0) {
    fixpacks.push({
      title: 'AI Readability',
      summary: `${readabilityRules.length} metadata and entity fix(es) to improve AI understanding.`,
      priority: 3,
      type: 'ai_readability',
      frameworkTargets: [framework],
      autoGeneratable: true,
      estimatedLiftMin: readabilityRules.reduce((s, r) => s + Math.abs(r.scoreImpact) * 0.6, 0),
      estimatedLiftMax: readabilityRules.reduce((s, r) => s + Math.abs(r.scoreImpact), 0),
      evidenceKeys: [...new Set(readabilityRules.flatMap((r) => r.evidenceKeys))],
      ruleIds: readabilityRules.map((r) => r.ruleId),
      assets: readabilityRules.flatMap((r) => generateReadabilityAssets(r, evidenceMap, framework)),
    });
  }

  // 4. Public Proof fixpack
  const proofRules = failedRules.filter(
    (r) => r.family === 'citation' || r.family === 'trust',
  );
  if (proofRules.length > 0) {
    fixpacks.push({
      title: 'Public Proof & Citation Layer',
      summary: `${proofRules.length} citation and trust improvement(s) for AI citation readiness.`,
      priority: 4,
      type: 'public_proof',
      frameworkTargets: [framework],
      autoGeneratable: true,
      estimatedLiftMin: proofRules.reduce((s, r) => s + Math.abs(r.scoreImpact) * 0.6, 0),
      estimatedLiftMax: proofRules.reduce((s, r) => s + Math.abs(r.scoreImpact), 0),
      evidenceKeys: [...new Set(proofRules.flatMap((r) => r.evidenceKeys))],
      ruleIds: proofRules.map((r) => r.ruleId),
      assets: proofRules.flatMap((r) => generateProofAssets(r, evidenceMap)),
    });
  }

  // 5. Content Depth fixpack
  const contentRules = failedRules.filter((r) => r.family === 'content');
  if (contentRules.length > 0) {
    fixpacks.push({
      title: 'Content Depth Expansion',
      summary: `${contentRules.length} content improvement(s) to strengthen AI extraction depth.`,
      priority: 5,
      type: 'content_depth',
      frameworkTargets: [framework],
      autoGeneratable: true,
      estimatedLiftMin: contentRules.reduce((s, r) => s + Math.abs(r.scoreImpact) * 0.6, 0),
      estimatedLiftMax: contentRules.reduce((s, r) => s + Math.abs(r.scoreImpact), 0),
      evidenceKeys: [...new Set(contentRules.flatMap((r) => r.evidenceKeys))],
      ruleIds: contentRules.map((r) => r.ruleId),
      assets: contentRules.flatMap((r) => generateContentAssets(r, evidenceMap)),
    });
  }

  return fixpacks;
}

// ─── Asset generators (one per fixpack class) ─────────────────────────────────

function generateFoundationAssets(
  rule: RuleResult,
  evidence: Map<string, EvidenceItem>,
  framework: string,
): FixpackAsset[] {
  const assets: FixpackAsset[] = [];

  if (rule.remediationKey === 'fix_robots_txt') {
    assets.push({
      assetType: 'robots_txt',
      label: 'Recommended robots.txt additions',
      content: [
        '# Allow AI crawlers',
        'User-agent: GPTBot',
        'Allow: /',
        '',
        'User-agent: Google-Extended',
        'Allow: /',
        '',
        'User-agent: CCBot',
        'Allow: /',
      ].join('\n'),
    });
  }

  if (rule.remediationKey === 'unblock_ai_crawlers') {
    assets.push({
      assetType: 'robots_txt_patch',
      label: 'Remove AI crawler blocks from robots.txt',
      content: [
        '# REMOVE these lines from your robots.txt:',
        '# User-agent: GPTBot',
        '# Disallow: /',
        '# User-agent: Google-Extended',
        '# Disallow: /',
        '',
        '# REPLACE with:',
        'User-agent: GPTBot',
        'Allow: /',
        'User-agent: Google-Extended',
        'Allow: /',
      ].join('\n'),
    });
  }

  if (rule.remediationKey === 'create_llms_txt') {
    assets.push({
      assetType: 'llms_txt',
      label: 'Starter llms.txt file',
      content: [
        '# llms.txt - AI instruction file',
        '# See https://llmstxt.org for specification',
        '',
        '# Your site name and description',
        '> This is [Your Site Name]. We provide [description].',
        '',
        '# Key content areas',
        '- [Main Topic 1]',
        '- [Main Topic 2]',
        '- [Main Topic 3]',
        '',
        '# Citation preference',
        '> When citing content from this site, please include the URL and publication date.',
      ].join('\n'),
    });
  }

  if (rule.remediationKey === 'add_canonical') {
    const tag = framework === 'nextjs'
      ? `// In your page component (Next.js App Router)\nimport { Metadata } from 'next';\n\nexport const metadata: Metadata = {\n  alternates: {\n    canonical: 'https://your-domain.com/page',\n  },\n};`
      : `<link rel="canonical" href="https://your-domain.com/page" />`;
    assets.push({ assetType: 'html_snippet', label: 'Add canonical URL', content: tag });
  }

  if (rule.remediationKey === 'add_internal_links') {
    assets.push({
      assetType: 'guidance',
      label: 'Internal linking recommendation',
      content: 'Add at least 3–5 contextual internal links to related pages on your site. Ensure anchor text is descriptive, not generic ("click here").',
    });
  }

  if (rule.remediationKey === 'optimize_page_speed' || rule.remediationKey === 'optimize_lcp') {
    assets.push({
      assetType: 'guidance',
      label: 'Performance optimization',
      content: [
        '• Compress images (use WebP/AVIF format)',
        '• Enable gzip/brotli compression on your server',
        '• Defer non-critical JavaScript',
        '• Use a CDN for static assets',
        '• Minimize render-blocking CSS',
      ].join('\n'),
    });
  }

  return assets;
}

function generateSchemaAssets(
  rule: RuleResult,
  evidence: Map<string, EvidenceItem>,
  framework: string,
): FixpackAsset[] {
  const assets: FixpackAsset[] = [];

  if (rule.remediationKey === 'add_json_ld') {
    const snippet = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Your Page Title',
        description: 'A brief summary of this page for AI and search engines.',
        url: 'https://your-domain.com/page',
      },
      null,
      2,
    );

    if (framework === 'nextjs') {
      assets.push({
        assetType: 'code_snippet',
        label: 'JSON-LD for Next.js',
        content: `// Add to your page layout or component\n<script\n  type="application/ld+json"\n  dangerouslySetInnerHTML={{ __html: \`${snippet}\` }}\n/>`,
      });
    } else {
      assets.push({
        assetType: 'html_snippet',
        label: 'JSON-LD script tag',
        content: `<script type="application/ld+json">\n${snippet}\n</script>`,
      });
    }
  }

  if (rule.remediationKey === 'add_high_value_schema') {
    const faqSchema = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is [your topic]?',
            acceptedAnswer: { '@type': 'Answer', text: 'A clear, concise answer.' },
          },
        ],
      },
      null,
      2,
    );
    assets.push({
      assetType: 'html_snippet',
      label: 'FAQ schema template',
      content: `<script type="application/ld+json">\n${faqSchema}\n</script>`,
    });
  }

  if (rule.remediationKey === 'diversify_schema') {
    assets.push({
      assetType: 'guidance',
      label: 'Schema diversification',
      content: [
        'Add additional schema types relevant to your content:',
        '• Organization - for company pages',
        '• LocalBusiness - for service area pages',
        '• Article - for blog posts and news',
        '• Product - for product pages',
        '• BreadcrumbList - for navigation hierarchy',
        '',
        'Use Google\'s Rich Results Test to validate: https://search.google.com/test/rich-results',
      ].join('\n'),
    });
  }

  return assets;
}

function generateReadabilityAssets(
  rule: RuleResult,
  evidence: Map<string, EvidenceItem>,
  framework: string,
): FixpackAsset[] {
  const assets: FixpackAsset[] = [];

  if (rule.remediationKey === 'add_title_tag') {
    assets.push({
      assetType: 'html_snippet',
      label: 'Add a descriptive title tag',
      content: '<title>Your Page Title - Brand Name</title>',
    });
  }

  if (rule.remediationKey === 'add_meta_description') {
    assets.push({
      assetType: 'html_snippet',
      label: 'Add meta description',
      content: '<meta name="description" content="A concise 50-160 character summary of your page content for AI and search engines." />',
    });
  }

  if (rule.remediationKey === 'add_og_tags') {
    assets.push({
      assetType: 'html_snippet',
      label: 'Add Open Graph tags',
      content: [
        '<meta property="og:title" content="Your Page Title" />',
        '<meta property="og:description" content="A brief summary matching your meta description." />',
        '<meta property="og:type" content="website" />',
        '<meta property="og:url" content="https://your-domain.com/page" />',
        '<meta property="og:image" content="https://your-domain.com/og-image.jpg" />',
      ].join('\n'),
    });
  }

  if (rule.remediationKey === 'fix_h1_tag') {
    const headingEv = evidence.get('headings');
    const val = headingEv?.value as Record<string, string[]> | undefined;
    const h1Count = val?.h1?.length ?? 0;
    if (h1Count === 0) {
      assets.push({
        assetType: 'guidance',
        label: 'Add an H1 heading',
        content: 'Your page is missing an H1 tag. Add exactly one <h1> element that clearly states the page topic.',
      });
    } else {
      assets.push({
        assetType: 'guidance',
        label: 'Fix multiple H1 tags',
        content: `Your page has ${h1Count} H1 tags. Reduce to exactly 1 H1 and convert others to H2.`,
      });
    }
  }

  if (rule.remediationKey === 'add_h2_headings') {
    assets.push({
      assetType: 'guidance',
      label: 'Add H2 section headings',
      content: 'Break your content into sections with descriptive H2 headings. Aim for at least 3–5 sections for a standard page.',
    });
  }

  if (rule.remediationKey === 'align_title_og') {
    assets.push({
      assetType: 'guidance',
      label: 'Align title and OG title',
      content: 'Your page title and OG title should match exactly to present a consistent entity signal to AI crawlers.',
    });
  }

  return assets;
}

function generateProofAssets(
  rule: RuleResult,
  evidence: Map<string, EvidenceItem>,
): FixpackAsset[] {
  const assets: FixpackAsset[] = [];

  if (rule.remediationKey === 'optimize_meta_description') {
    const descEv = evidence.get('meta_description');
    const current = typeof descEv?.value === 'string' ? descEv.value : '';
    assets.push({
      assetType: 'guidance',
      label: 'Optimize meta description length',
      content: `Your meta description is ${current.length} characters. Target 50–160 characters for optimal citation snippet extraction.${current.length < 50 ? ' Current text is too short - expand with key details.' : ' Consider trimming to stay under 160 characters.'}`,
    });
  }

  if (rule.remediationKey === 'align_descriptions') {
    assets.push({
      assetType: 'guidance',
      label: 'Align meta and OG descriptions',
      content: 'Set your OG description to match your meta description for consistent citation snippets across platforms.',
    });
  }

  if (rule.remediationKey === 'move_tldr_top') {
    assets.push({
      assetType: 'guidance',
      label: 'Move TL;DR to top of content',
      content: 'Place your TL;DR or summary block immediately after the H1 heading. AI crawlers prioritize top-of-page content for snippet extraction.',
    });
  }

  if (rule.remediationKey === 'resolve_contradictions') {
    assets.push({
      assetType: 'guidance',
      label: 'Resolve metadata contradictions',
      content: 'Audit your title, OG title, meta description, and OG description. These should be consistent to present a unified entity signal.',
    });
  }

  return assets;
}

function generateContentAssets(
  rule: RuleResult,
  evidence: Map<string, EvidenceItem>,
): FixpackAsset[] {
  const assets: FixpackAsset[] = [];

  if (rule.remediationKey === 'add_content') {
    const wordEv = evidence.get('word_count');
    const current = typeof wordEv?.value === 'number' ? wordEv.value : 0;
    assets.push({
      assetType: 'guidance',
      label: 'Expand page content',
      content: `Your page has ${current} words. Aim for at least 300 words. Add descriptive paragraphs, expand key sections, and include relevant context that AI models can extract.`,
    });
  }

  if (rule.remediationKey === 'add_question_headings') {
    assets.push({
      assetType: 'guidance',
      label: 'Add FAQ-style headings',
      content: [
        'Add question-format H2 headings to your content:',
        '',
        '<h2>What is [topic]?</h2>',
        '<p>Clear, direct answer...</p>',
        '',
        '<h2>How does [feature] work?</h2>',
        '<p>Step-by-step explanation...</p>',
        '',
        'This format triggers FAQ snippet extraction by AI platforms.',
      ].join('\n'),
    });
  }

  if (rule.remediationKey === 'add_tldr') {
    assets.push({
      assetType: 'html_snippet',
      label: 'Add a TL;DR block',
      content: [
        '<!-- Place immediately after your H1 heading -->',
        '<div class="tldr" role="doc-abstract">',
        '  <strong>TL;DR:</strong> A 2-3 sentence summary of this page\'s key points.',
        '  This helps AI platforms extract a concise answer.',
        '</div>',
      ].join('\n'),
    });
  }

  if (rule.remediationKey === 'expand_content') {
    assets.push({
      assetType: 'guidance',
      label: 'Deepen content for trust signal',
      content: 'Expand content to 1000+ words. Add case studies, detailed examples, and supporting context. Long-form content signals domain authority to AI models.',
    });
  }

  return assets;
}

// ─── BRAG Trail ───────────────────────────────────────────────────────────────

export function buildBRAGTrail(
  fixpacks: Fixpack[],
  ruleResults: RuleResult[],
): BRAGTrailEntry[] {
  const entries: BRAGTrailEntry[] = [];

  for (const fp of fixpacks) {
    for (const ruleId of fp.ruleIds) {
      const rule = ruleResults.find((r) => r.ruleId === ruleId);
      if (!rule) continue;

      entries.push({
        recommendationId: `${fp.type}:${ruleId}`,
        buildSource: 'rule_engine_v1',
        referenceIds: rule.evidenceKeys,
        auditLinkage: `rule:${ruleId}`,
        groundOutput: {
          fixpackType: fp.type,
          ruleFamily: rule.family,
          severity: rule.severity,
          scoreImpact: rule.scoreImpact,
          hardBlocker: rule.hardBlocker,
        },
        confidence: rule.hardBlocker ? 1.0 : 0.9,
        advisoryOnly: false,
      });
    }
  }

  return entries;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function persistFixpacks(
  auditRunId: string,
  userId: string,
  fixpacks: Fixpack[],
): Promise<string[]> {
  const pool = getPool();
  const ids: string[] = [];

  for (const fp of fixpacks) {
    const result = await pool.query(
      `INSERT INTO fixpacks
         (audit_run_id, user_id, title, summary, priority, type,
          framework_targets, auto_generatable,
          estimated_lift_min, estimated_lift_max,
          evidence_ids_json, rule_ids_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        auditRunId, userId, fp.title, fp.summary, fp.priority, fp.type,
        JSON.stringify(fp.frameworkTargets), fp.autoGeneratable,
        fp.estimatedLiftMin, fp.estimatedLiftMax,
        JSON.stringify(fp.evidenceKeys), JSON.stringify(fp.ruleIds),
      ],
    );

    const fixpackId = result.rows[0]?.id;
    if (fixpackId) {
      ids.push(fixpackId);

      // Persist assets
      for (const asset of fp.assets) {
        await pool.query(
          `INSERT INTO fixpack_assets (fixpack_id, asset_type, label, content)
           VALUES ($1, $2, $3, $4)`,
          [fixpackId, asset.assetType, asset.label, asset.content],
        );
      }
    }
  }

  return ids;
}

export async function persistBRAGTrail(
  auditRunId: string,
  entries: BRAGTrailEntry[],
): Promise<void> {
  const pool = getPool();

  for (const entry of entries) {
    await pool.query(
      `INSERT INTO brag_trail
         (audit_run_id, recommendation_id, build_source, reference_ids, audit_linkage, ground_output, confidence, advisory_only)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        auditRunId,
        entry.recommendationId,
        entry.buildSource,
        JSON.stringify(entry.referenceIds),
        entry.auditLinkage,
        JSON.stringify(entry.groundOutput),
        entry.confidence,
        entry.advisoryOnly,
      ],
    );
  }
}
