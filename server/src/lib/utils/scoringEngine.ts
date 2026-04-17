// Comprehensive Evidence-Based Scoring Engine for SEO and AI Visibility
import type { Evidence } from '../../../../shared/types/evidence.js';

export interface ScoreComponents {
  content: number;
  technical: number;
  ux: number;
  aiOptimization: number;
}

export interface ComputedScores {
  overall: number;
  components: ScoreComponents;
}

export interface Risk {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  impact: string;
  recommendation: string;
  evidence?: string;
}

/**
 * Comprehensive scoring function analyzing real forensic evidence
 * Evaluates SEO technical foundation, content quality, UX, and AI search optimization
 */
export function computeScores(
  evidence: Evidence[],
  discoveryData: any,
  technicalData: any,
  contentData: any
): ComputedScores {
  // Technical SEO Score (0-100)
  const technicalScore = calculateTechnicalScore(technicalData, discoveryData);

  // Content Quality Score (0-100)
  const contentScore = calculateContentScore(contentData, technicalData);

  // UX & Performance Score (0-100)
  const uxScore = calculateUXScore(technicalData, contentData);

  // AI Optimization Score (0-100)
  const aiOptimizationScore = calculateAIOptimizationScore(technicalData, contentData);

  // Weighted overall score
  // Technical and AI optimization are most critical for Evidence-backed site analysis for AI answers Platform
  const overall = Math.round(
    technicalScore * 0.30 +
    contentScore * 0.25 +
    uxScore * 0.20 +
    aiOptimizationScore * 0.25
  );

  return {
    overall,
    components: {
      technical: technicalScore,
      content: contentScore,
      ux: uxScore,
      aiOptimization: aiOptimizationScore
    }
  };
}

/**
 * Calculate Technical SEO Score
 * Evaluates: HTTPS, canonical tags, redirects, compression, caching, robots.txt, sitemap
 */
function calculateTechnicalScore(technicalData: any, discoveryData: any): number {
  let score = 100;
  const penalties: { [key: string]: number } = {};

  // Critical: HTTPS enforcement (-20 if missing)
  if (!technicalData?.https?.enforced) {
    penalties['no_https'] = 20;
  }

  // Critical: Canonical tag (-15 if missing, -10 if incorrect)
  if (!technicalData?.canonical?.present) {
    penalties['no_canonical'] = 15;
  } else if (!technicalData?.canonical?.correct) {
    penalties['incorrect_canonical'] = 10;
  }

  // High: Schema markup (-15 if missing)
  if (!technicalData?.schema?.present || technicalData?.schema?.types?.length === 0) {
    penalties['no_schema'] = 15;
  }

  // Medium: Robots.txt (-10 if missing)
  if (!discoveryData?.robotsTxt?.found) {
    penalties['no_robots_txt'] = 10;
  }

  // Medium: XML Sitemap (-10 if missing)
  if (!discoveryData?.sitemap?.found) {
    penalties['no_sitemap'] = 10;
  }

  // Low: Redirect chains (-5 per redirect, max -15)
  if (technicalData?.redirects?.hasRedirects && technicalData?.redirects?.count > 0) {
    const redirectPenalty = Math.min(technicalData.redirects.count * 5, 15);
    penalties['redirect_chains'] = redirectPenalty;
  }

  // Low: Missing compression (-8)
  if (!technicalData?.compression?.enabled) {
    penalties['no_compression'] = 8;
  }

  // Low: Missing cache headers (-7)
  if (!technicalData?.caching?.configured) {
    penalties['no_caching'] = 7;
  }

  // Low: Missing viewport meta tag (-5)
  if (!technicalData?.viewport?.present) {
    penalties['no_viewport'] = 5;
  }

  // Apply all penalties
  const totalPenalty = Object.values(penalties).reduce((sum, p) => sum + p, 0);
  score = Math.max(0, score - totalPenalty);

  return Math.round(score);
}

/**
 * Calculate Content Quality Score
 * Evaluates: word count, heading structure, metadata, structured content
 */
function calculateContentScore(contentData: any, technicalData: any): number {
  let score = 100;
  const penalties: { [key: string]: number } = {};

  // Critical: Thin content (< 300 words) (-25)
  if (contentData?.thinContent || (contentData?.wordCount && contentData.wordCount < 300)) {
    penalties['thin_content'] = 25;
  }
  // Low word count but not critical (300-500 words) (-10)
  else if (contentData?.wordCount && contentData.wordCount < 500) {
    penalties['low_word_count'] = 10;
  }

  // High: Missing or multiple H1 tags (-15)
  const h1Count = contentData?.headingStructure?.h1Count ?? 0;
  if (h1Count === 0) {
    penalties['no_h1'] = 15;
  } else if (h1Count > 1) {
    penalties['multiple_h1'] = 12;
  }

  // Medium: Poor heading structure (-10)
  const totalHeadings = contentData?.headingStructure?.totalHeadings ?? 0;
  if (totalHeadings < 3) {
    penalties['poor_heading_structure'] = 10;
  }

  // Medium: No H2 tags (poor content organization) (-8)
  if ((contentData?.headingStructure?.h2Count ?? 0) === 0 && contentData?.wordCount > 300) {
    penalties['no_h2_tags'] = 8;
  }

  // Medium: Missing Open Graph tags (-12)
  if (!technicalData?.openGraph?.present || technicalData?.openGraph?.tags?.length === 0) {
    penalties['no_opengraph'] = 12;
  }

  // Low: Missing entity signals (-8)
  if (!contentData?.entitySignals || contentData.entitySignals.length === 0) {
    penalties['no_entity_signals'] = 8;
  }

  // Low: Missing About/Company info (-5)
  if (!contentData?.hasAbout) {
    penalties['no_about_section'] = 5;
  }

  // Low: Missing contact info (-5)
  if (!contentData?.hasContact) {
    penalties['no_contact_info'] = 5;
  }

  const totalPenalty = Object.values(penalties).reduce((sum, p) => sum + p, 0);
  score = Math.max(0, score - totalPenalty);

  return Math.round(score);
}

/**
 * Calculate UX & Performance Score
 * Evaluates: mobile optimization, performance indicators
 */
function calculateUXScore(technicalData: any, contentData: any): number {
  let score = 100;
  const penalties: { [key: string]: number } = {};

  // Critical: No viewport meta tag (not mobile-optimized) (-30)
  if (!technicalData?.viewport?.present) {
    penalties['not_mobile_optimized'] = 30;
  }

  // High: No compression (slow load times) (-20)
  if (!technicalData?.compression?.enabled) {
    penalties['no_compression_ux'] = 20;
  }

  // Medium: No caching configured (-15)
  if (!technicalData?.caching?.configured) {
    penalties['no_caching_ux'] = 15;
  }

  // Medium: Redirect chains (slower UX) (-10)
  if (technicalData?.redirects?.hasRedirects && technicalData?.redirects?.count > 0) {
    penalties['redirects_ux'] = Math.min(technicalData.redirects.count * 5, 15);
  }

  // Low: Very long content without proper structure (-10)
  if (contentData?.wordCount > 2000 && (contentData?.headingStructure?.totalHeadings ?? 0) < 5) {
    penalties['long_unstructured_content'] = 10;
  }

  const totalPenalty = Object.values(penalties).reduce((sum, p) => sum + p, 0);
  score = Math.max(0, score - totalPenalty);

  return Math.round(score);
}

/**
 * Calculate AI Optimization Score
 * Evaluates: structured data, semantic markup, entity clarity, AI-readable content
 */
function calculateAIOptimizationScore(technicalData: any, contentData: any): number {
  let score = 100;
  const penalties: { [key: string]: number } = {};

  // Critical: No structured data/schema (-30)
  if (!technicalData?.schema?.present || technicalData?.schema?.types?.length === 0) {
    penalties['no_structured_data'] = 30;
  }

  // High: Poor entity signals (-20)
  if (!contentData?.entitySignals || contentData.entitySignals.length === 0) {
    penalties['weak_entity_signals'] = 20;
  } else if (contentData.entitySignals.length < 2) {
    penalties['limited_entity_signals'] = 10;
  }

  // High: No clear heading hierarchy (-15)
  const h1Count = contentData?.headingStructure?.h1Count ?? 0;
  const h2Count = contentData?.headingStructure?.h2Count ?? 0;
  if (h1Count !== 1 || h2Count < 2) {
    penalties['unclear_hierarchy'] = 15;
  }

  // Medium: Missing Open Graph (AI indexing signals) (-12)
  if (!technicalData?.openGraph?.present) {
    penalties['no_og_tags'] = 12;
  }

  // Medium: Thin or missing content (-15)
  if (contentData?.thinContent || (contentData?.wordCount && contentData.wordCount < 300)) {
    penalties['insufficient_content_ai'] = 15;
  }

  // Medium: No Twitter Cards (limited social AI indexing) (-8)
  if (!technicalData?.twitterCards?.present) {
    penalties['no_twitter_cards'] = 8;
  }

  // Low: No hreflang tags (if international site) (-5)
  if (!technicalData?.hreflang?.present || technicalData?.hreflang?.count === 0) {
    penalties['no_hreflang'] = 5;
  }

  const totalPenalty = Object.values(penalties).reduce((sum, p) => sum + p, 0);
  score = Math.max(0, score - totalPenalty);

  return Math.round(score);
}

/**
 * Determine visibility status based on overall score
 */
export function determineVisibilityStatus(score: number): 'visible' | 'risky' | 'invisible' {
  if (score >= 75) return 'visible';
  if (score >= 45) return 'risky';
  return 'invisible';
}

/**
 * Generate comprehensive risks from real evidence
 * Identifies specific, actionable issues with SEO and AI visibility impact
 */
export function generateRisks(
  scores: ComputedScores,
  technicalData: any,
  contentData: any
): Risk[] {
  const risks: Risk[] = [];

  // === CRITICAL RISKS ===

  // No HTTPS
  if (!technicalData?.https?.enforced) {
    risks.push({
      severity: 'critical',
      category: 'Security & Trust',
      description: 'Website not using HTTPS encryption',
      impact: 'AI systems and search engines deprioritize non-HTTPS sites. Users see security warnings. Massive trust and ranking penalty.',
      recommendation: 'Install SSL certificate immediately and enforce HTTPS redirects. Use Let\'s Encrypt for free SSL.',
      evidence: 'HTTP protocol detected without secure connection'
    });
  }

  // No structured data
  if (!technicalData?.schema?.present || technicalData?.schema?.types?.length === 0) {
    risks.push({
      severity: 'critical',
      category: 'AI Visibility',
      description: 'No structured data (Schema.org markup) found',
      impact: 'AI systems cannot understand your content context, entities, or relationships. Severely limits AI visibility, citation eligibility, and rich results.',
      recommendation: 'Implement JSON-LD structured data for Organization, WebSite, Article, Product, or relevant schema types. Use Google\'s Structured Data Testing Tool to validate.',
      evidence: 'No JSON-LD or microdata detected in page source'
    });
  }

  // Thin content
  if (contentData?.thinContent || (contentData?.wordCount && contentData.wordCount < 300)) {
    risks.push({
      severity: 'critical',
      category: 'Content Quality',
      description: `Thin content detected (${contentData?.wordCount || 0} words)`,
      impact: 'AI systems require substantial content to understand topic depth and authority. Thin pages are filtered from AI-generated answers and search results.',
      recommendation: 'Expand content to minimum 800-1200 words with comprehensive coverage of the topic. Add sections addressing common questions, use cases, and detailed explanations.',
      evidence: `Word count: ${contentData?.wordCount || 0} (below 300-word threshold)`
    });
  }

  // === HIGH PRIORITY RISKS ===

  // Missing or incorrect canonical
  if (!technicalData?.canonical?.present) {
    risks.push({
      severity: 'high',
      category: 'Technical SEO',
      description: 'No canonical tag present',
      impact: 'Search engines and AI systems may index wrong URL variations, diluting your ranking signals and causing duplicate content issues.',
      recommendation: 'Add self-referencing canonical tag: <link rel="canonical" href="https://yourdomain.com/page" /> to every page.',
      evidence: 'Canonical link element missing from <head>'
    });
  } else if (!technicalData?.canonical?.correct) {
    risks.push({
      severity: 'high',
      category: 'Technical SEO',
      description: 'Canonical tag points to different URL',
      impact: 'Tells search engines this page is a duplicate. You\'re voluntarily giving ranking power to another URL.',
      recommendation: 'Update canonical tag to self-reference this page, or confirm if this is intentional duplicate content.',
      evidence: 'Canonical URL does not match current page URL'
    });
  }

  // No H1 or multiple H1s
  const h1Count = contentData?.headingStructure?.h1Count ?? 0;
  if (h1Count === 0) {
    risks.push({
      severity: 'high',
      category: 'Content Structure',
      description: 'Missing H1 heading tag',
      impact: 'AI systems use H1 to identify primary page topic. Missing H1 makes it difficult for AI to understand page purpose and categorization.',
      recommendation: 'Add a single, descriptive H1 tag that clearly states the page\'s main topic. Place it near the top of the content.',
      evidence: 'No <h1> tags found in page structure'
    });
  } else if (h1Count > 1) {
    risks.push({
      severity: 'high',
      category: 'Content Structure',
      description: `Multiple H1 tags found (${h1Count})`,
      impact: 'Multiple H1 tags confuse AI about primary page topic. Dilutes topical clarity and keyword focus.',
      recommendation: 'Consolidate to single H1 tag representing main topic. Convert other H1s to H2 or H3 based on content hierarchy.',
      evidence: `${h1Count} H1 tags detected - should have exactly one`
    });
  }

  // === MEDIUM PRIORITY RISKS ===

  // No Open Graph tags
  if (!technicalData?.openGraph?.present || technicalData?.openGraph?.tags?.length === 0) {
    risks.push({
      severity: 'medium',
      category: 'Social & AI Signals',
      description: 'Missing Open Graph meta tags',
      impact: 'Social platforms and AI systems use OG tags for content understanding and previews. Missing tags result in poor social sharing and reduced AI comprehension.',
      recommendation: 'Add Open Graph tags: og:title, og:description, og:image, og:type, og:url. These help AI systems understand your content context.',
      evidence: 'No og: meta tags found in page head'
    });
  }

  // Poor heading structure
  const totalHeadings = contentData?.headingStructure?.totalHeadings ?? 0;
  if (totalHeadings < 3 && (contentData?.wordCount ?? 0) > 300) {
    risks.push({
      severity: 'medium',
      category: 'Content Organization',
      description: 'Insufficient heading structure',
      impact: 'AI systems use heading hierarchy to understand content sections and importance. Poor structure reduces AI\'s ability to extract and cite your content.',
      recommendation: 'Add H2 and H3 headings to organize content into clear sections. Use headings to break up content every 200-400 words.',
      evidence: `Only ${totalHeadings} heading tags found (recommend 5+ for content pages)`
    });
  }

  // No compression
  if (!technicalData?.compression?.enabled) {
    risks.push({
      severity: 'medium',
      category: 'Performance',
      description: 'No content compression enabled',
      impact: 'Larger page sizes slow down AI crawlers and user experience. May result in incomplete indexing by resource-constrained AI systems.',
      recommendation: 'Enable GZIP or Brotli compression on your web server. This typically reduces HTML size by 70-80%.',
      evidence: 'No Content-Encoding header detected in HTTP response'
    });
  }

  // No viewport meta tag (not mobile-friendly)
  if (!technicalData?.viewport?.present) {
    risks.push({
      severity: 'medium',
      category: 'Mobile Optimization',
      description: 'Missing viewport meta tag',
      impact: 'Page not optimized for mobile devices. AI systems prioritize mobile-friendly content. Poor mobile UX reduces rankings and AI citation likelihood.',
      recommendation: 'Add viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1">',
      evidence: 'No viewport meta tag found in <head>'
    });
  }

  // === LOW PRIORITY RISKS ===

  // Redirect chains
  if (technicalData?.redirects?.hasRedirects && technicalData?.redirects?.count > 0) {
    risks.push({
      severity: 'low',
      category: 'Performance',
      description: `${technicalData.redirects.count} redirect(s) in chain`,
      impact: 'Each redirect adds latency and consumes crawler budget. May cause AI systems to stop crawling before reaching final content.',
      recommendation: 'Update links to point directly to final URL. Remove unnecessary redirects from your server configuration.',
      evidence: `${technicalData.redirects.count} HTTP redirects detected before final page load`
    });
  }

  // No caching headers
  if (!technicalData?.caching?.configured) {
    risks.push({
      severity: 'low',
      category: 'Performance',
      description: 'No cache control headers configured',
      impact: 'Browsers and AI systems must re-fetch resources on every visit, slowing performance and wasting bandwidth.',
      recommendation: 'Configure Cache-Control headers with appropriate max-age values for static assets (images, CSS, JS).',
      evidence: 'No Cache-Control header found in HTTP response'
    });
  }

  // Missing entity signals
  if (!contentData?.entitySignals || contentData.entitySignals.length === 0) {
    risks.push({
      severity: 'low',
      category: 'Semantic Clarity',
      description: 'Weak entity signals detected',
      impact: 'AI systems identify entities (people, organizations, products) to understand content. Weak signals reduce AI\'s confidence in citing your content.',
      recommendation: 'Strengthen entity references: add clear organization info, author names, product identifiers. Implement Organization or Person schema markup.',
      evidence: 'No strong entity identifiers found in structured data or content'
    });
  }

  // No contact information
  if (!contentData?.hasContact) {
    risks.push({
      severity: 'low',
      category: 'Trust Signals',
      description: 'No contact information found',
      impact: 'Contact details build trust with AI systems evaluating site authority. Missing info may reduce trust scores.',
      recommendation: 'Add contact page or footer with email, phone, address. Include ContactPoint schema markup.',
      evidence: 'No contact-related content detected on page'
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return risks;
}
