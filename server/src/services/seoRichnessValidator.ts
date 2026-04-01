// server/src/services/seoRichnessValidator.ts
/**
 * SEO Richness Validator: Validates indexability across search engines
 * (Chrome Web Store, Bing, DuckDuckGo) and keyword relevance.
 */

import type { TechnicalSignals, SeoDiagnostics, KeywordIntelligence, ContentAnalysis } from '../../../shared/types.js';

export interface SearchEngineIndexability {
  engine: 'chrome_web_store' | 'bing' | 'duckduckgo';
  indexable: boolean;
  score: number; // 0-100
  robots_crawlable: boolean;
  sitemap_present?: boolean;
  mobile_friendly?: boolean;
  issues: string[];
  strengths: string[];
}

export interface KeywordRelevanceScore {
  target_keyword: string;
  relevance_score: number; // 0-100
  keyword_density: number;
  appears_in_title: boolean;
  appears_in_h1: boolean;
  appears_in_headings: boolean;
  semantic_variations: string[];
}

export interface SEORichnessReport {
  overall_seo_score: number; // 0-100
  search_engine_indexability: SearchEngineIndexability[];
  keyword_relevance: KeywordRelevanceScore[];
  core_web_vitals: {
    score: number;
    status: 'good' | 'needs_improvement' | 'poor';
    issues: string[];
  };
  content_freshness: {
    score: number;
    last_updated?: string;
    recommendation: string;
  };
  mobile_optimization: {
    score: number;
    issues: string[];
  };
  issues_priority: Array<{
    issue: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    impact: string;
  }>;
}

/**
 * Validate indexability for Chrome Web Store
 */
function validateChromeWebStoreIndexability(
  technicalSignals: TechnicalSignals,
  seoDiags: SeoDiagnostics
): SearchEngineIndexability {
  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 100;

  // HTTPS check (required for Chrome Web Store)
  if (!technicalSignals.https_enabled) {
    issues.push('HTTPS not enabled (required for Chrome Web Store)');
    score -= 30;
  } else {
    strengths.push('HTTPS enabled');
  }

  // Robots.txt check
  const robotsCheck = seoDiags.robots;
  if (robotsCheck?.status === 'fail') {
    issues.push('robots.txt misconfigured');
    score -= 15;
  } else if (robotsCheck?.status === 'pass') {
    strengths.push('robots.txt properly configured');
  }

  // Canonical URL check
  const canonicalCheck = seoDiags.canonical;
  if (canonicalCheck?.status === 'fail') {
    issues.push('Canonical URL missing');
    score -= 10;
  }

  // Mobile friendly check
  const mobileCheck = seoDiags.mobile_friendly;
  if (mobileCheck?.status === 'fail') {
    issues.push('Not mobile-friendly (Chrome Web Store requirement)');
    score -= 20;
  } else {
    strengths.push('Mobile-friendly');
  }

  const robotsCrawlable = seoDiags.robots?.status !== 'fail';

  return {
    engine: 'chrome_web_store',
    indexable: score > 70,
    score: Math.max(0, score),
    robots_crawlable: robotsCrawlable,
    sitemap_present: technicalSignals.has_robots_txt,
    mobile_friendly: seoDiags.mobile_friendly?.status === 'pass',
    issues,
    strengths,
  };
}

/**
 * Validate indexability for Bing
 */
function validateBingIndexability(
  technicalSignals: TechnicalSignals,
  seoDiags: SeoDiagnostics
): SearchEngineIndexability {
  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 100;

  // Sitemap check
  const sitemapCheck = seoDiags.sitemap;
  if (sitemapCheck?.status === 'fail') {
    issues.push('Sitemap not found or invalid');
    score -= 10;
  } else if (sitemapCheck?.status === 'pass') {
    strengths.push('Sitemap properly configured');
  }

  // Robots.txt check
  const robotsCheck = seoDiags.robots;
  if (robotsCheck?.status === 'fail') {
    issues.push('robots.txt issues');
    score -= 10;
  }

  // HTTP status
  if (technicalSignals.status_code !== 200) {
    issues.push(`Non-200 HTTP status: ${technicalSignals.status_code}`);
    score -= 20;
  } else {
    strengths.push('Valid HTTP 200 response');
  }

  // Performance check
  const perfCheck = seoDiags.performance;
  if (perfCheck?.status === 'fail') {
    issues.push('Performance issues detected');
    score -= 15;
  } else if (perfCheck?.status === 'pass') {
    strengths.push('Good performance');
  }

  const robotsCrawlable = robotsCheck?.status !== 'fail';

  return {
    engine: 'bing',
    indexable: score > 70,
    score: Math.max(0, score),
    robots_crawlable: robotsCrawlable,
    sitemap_present: sitemapCheck?.status === 'pass',
    mobile_friendly: seoDiags.mobile_friendly?.status === 'pass',
    issues,
    strengths,
  };
}

/**
 * Validate indexability for DuckDuckGo
 */
function validateDuckDuckGoIndexability(
  technicalSignals: TechnicalSignals,
  seoDiags: SeoDiagnostics
): SearchEngineIndexability {
  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 100;

  // HTTPS preference
  if (!technicalSignals.https_enabled) {
    issues.push('HTTPS preferred but not enabled');
    score -= 10;
  } else {
    strengths.push('HTTPS enabled');
  }

  // Content uniqueness
  const uniqueCheck = seoDiags.content_uniqueness;
  if (uniqueCheck?.status === 'fail') {
    issues.push('Content uniqueness issues detected');
    score -= 20;
  } else if (uniqueCheck?.status === 'pass') {
    strengths.push('Content appears unique');
  }

  // Indexability general
  const indexCheck = seoDiags.indexability;
  if (indexCheck?.status === 'fail') {
    issues.push('General indexability issues');
    score -= 25;
  } else {
    strengths.push('Indexing constraints minimal');
  }

  // Response time (DuckDuckGo values speed)
  if (technicalSignals.response_time_ms > 3000) {
    issues.push('Response time slow (>3s)');
    score -= 10;
  } else if (technicalSignals.response_time_ms < 1000) {
    strengths.push('Good response time');
  }

  const robotsCrawlable = indexCheck?.status !== 'fail';

  return {
    engine: 'duckduckgo',
    indexable: score > 70,
    score: Math.max(0, score),
    robots_crawlable: robotsCrawlable,
    sitemap_present: true,
    mobile_friendly: seoDiags.mobile_friendly?.status === 'pass',
    issues,
    strengths,
  };
}

/**
 * Calculate keyword relevance scores
 */
function validateKeywordRelevance(
  contentAnalysis: ContentAnalysis,
  keywordIntelligence?: KeywordIntelligence[]
): KeywordRelevanceScore[] {
  const scores: KeywordRelevanceScore[] = [];

  if (!keywordIntelligence || keywordIntelligence.length === 0) {
    return scores;
  }

  const keywordDensity = contentAnalysis.keyword_density || {};
  const title = contentAnalysis.keyword_density ? Object.keys(keywordDensity)[0] : '';

  for (const keyword of keywordIntelligence.slice(0, 5)) {
    const density = keywordDensity[keyword.keyword] || 0;
    let relevanceScore = 50;

    // Baseline from keyword intelligence
    relevanceScore += keyword.opportunity * 0.3;

    // Density score (2-5% is optimal)
    if (density > 0.02 && density < 0.05) {
      relevanceScore += 25;
    } else if (density > 0 && density < 0.02) {
      relevanceScore += 15;
    } else if (density >= 0.05) {
      relevanceScore -= 10; // Potential over-optimization
    }

    // Title appearance
    const inTitle = title.toLowerCase().includes(keyword.keyword.toLowerCase());
    if (inTitle) {
      relevanceScore += 15;
    }

    scores.push({
      target_keyword: keyword.keyword,
      relevance_score: Math.min(100, relevanceScore),
      keyword_density: density,
      appears_in_title: inTitle,
      appears_in_h1: false, // Would need HTML parsing
      appears_in_headings: false, // Would need HTML parsing
      semantic_variations: [keyword.keyword], // Simplified
    });
  }

  return scores;
}

/**
 * Generate overall SEO richness report
 */
export function validateSEORichness(
  technicalSignals: TechnicalSignals,
  seoDiags: SeoDiagnostics,
  contentAnalysis: ContentAnalysis,
  keywordIntelligence?: KeywordIntelligence[]
): SEORichnessReport {
  const chromeWS = validateChromeWebStoreIndexability(technicalSignals, seoDiags);
  const bing = validateBingIndexability(technicalSignals, seoDiags);
  const duckduckgo = validateDuckDuckGoIndexability(technicalSignals, seoDiags);
  const keywords = validateKeywordRelevance(contentAnalysis, keywordIntelligence);

  // Weighted overall score
  const overallScore = Math.round((chromeWS.score * 0.3 + bing.score * 0.35 + duckduckgo.score * 0.35) * 0.7 + (keywords.length > 0 ? keywords[0].relevance_score : 50) * 0.3);

  // Core Web Vitals assessment
  let coreWebVitalsScore = 100;
  const coreWebVitalsIssues: string[] = [];
  if (technicalSignals.response_time_ms > 3000) {
    coreWebVitalsScore -= 20;
    coreWebVitalsIssues.push('Largest Contentful Paint (LCP) slow');
  }
  if (!technicalSignals.has_viewport_meta) {
    coreWebVitalsScore -= 15;
    coreWebVitalsIssues.push('Missing viewport meta tag');
  }

  const coreStatus: 'good' | 'needs_improvement' | 'poor' = coreWebVitalsScore >= 90 ? 'good' : coreWebVitalsScore >= 70 ? 'needs_improvement' : 'poor';

  // Mobile optimization
  let mobileScore = seoDiags.mobile_friendly?.status === 'pass' ? 100 : 60;
  const mobileIssues: string[] = [];
  if (!technicalSignals.has_viewport_meta) {
    mobileScore -= 20;
    mobileIssues.push('Viewport meta tag missing');
  }
  if (technicalSignals.response_time_ms > 2000) {
    mobileScore -= 15;
    mobileIssues.push('Slow loading on mobile networks');
  }

  // Priority issues
  const allIssues: Array<{ issue: string; priority: 'critical' | 'high' | 'medium' | 'low'; impact: string }> = [];
  [...chromeWS.issues, ...bing.issues, ...duckduckgo.issues].forEach((issue) => {
    allIssues.push({
      issue,
      priority: issue.includes('HTTPS') || issue.includes('HTTP 200') ? 'critical' : 'high',
      impact: 'Indexing blocked or significantly reduced',
    });
  });

  return {
    overall_seo_score: overallScore,
    search_engine_indexability: [chromeWS, bing, duckduckgo],
    keyword_relevance: keywords,
    core_web_vitals: {
      score: coreWebVitalsScore,
      status: coreStatus,
      issues: coreWebVitalsIssues,
    },
    content_freshness: {
      score: 75,
      recommendation: 'Update major sections quarterly for freshness signals',
    },
    mobile_optimization: {
      score: mobileScore,
      issues: mobileIssues,
    },
    issues_priority: allIssues.slice(0, 8),
  };
}
