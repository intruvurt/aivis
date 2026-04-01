// server/src/services/llmReadabilityValidator.ts
/**
 * LLM Readability Validator: Scores and validates content for AI platform extractability.
 * Measures entity clarity, schema completeness, heading hierarchy, metadata quality, and topical depth.
 */

import type { DomainIntelligence, ContentAnalysis, SchemaMarkup } from '../../../shared/types.js';

export interface LLMReadabilityScore {
  overall_score: number; // 0-100
  entity_clarity: {
    score: number;
    issues: string[];
    entity_count: number;
    primary_entities: string[];
  };
  schema_completeness: {
    score: number;
    missing_schemas: string[];
    found_schemas: string[];
    schema_quality_rating: 'excellent' | 'good' | 'fair' | 'poor';
  };
  heading_hierarchy: {
    score: number;
    h1_count: number;
    h1_present: boolean;
    hierarchy_valid: boolean;
    issues: string[];
  };
  metadata_quality: {
    score: number;
    title_quality: 'good' | 'fair' | 'poor';
    description_quality: 'good' | 'fair' | 'poor';
    og_tags_present: boolean;
    issues: string[];
  };
  topical_depth: {
    score: number;
    topic_count: number;
    keyword_diversity: number; // 0-1
    content_structure: 'strong' | 'moderate' | 'weak';
  };
  recommendation_priority: 'critical' | 'high' | 'medium' | 'low' | 'none';
  actionable_recommendations: string[];
}

/**
 * Validate entity clarity (company name, founder, key identifiers clear)
 */
function validateEntityClarity(
  domainIntel: DomainIntelligence,
  contentAnalysis: ContentAnalysis
): { score: number; issues: string[]; entity_count: number; primary_entities: string[] } {
  const issues: string[] = [];
  let score = 100;
  const entities: string[] = [];

  // Check page title for entities
  const pageTitle = domainIntel.page_title || '';
  if (!pageTitle || pageTitle.length < 10) {
    issues.push('Page title is missing or too short for entity extraction');
    score -= 15;
  } else {
    // Extract potential company name from title
    const titleParts = pageTitle.split('|').map((p: string) => p.trim());
    entities.push(...titleParts);
  }

  // Check description for entity clarity
  const pageDesc = domainIntel.page_description || '';
  if (!pageDesc || pageDesc.length < 25) {
    issues.push('Meta description too short for context clarity (minimum 25 characters)');
    score -= 10;
  }

  // Check primary_topics
  if (!domainIntel.primary_topics || domainIntel.primary_topics.length === 0) {
    issues.push('No primary topics identified');
    score -= 20;
  } else {
    entities.push(...domainIntel.primary_topics.slice(0, 3));
  }

  // Brand entities
  if (!domainIntel.citation_domains || domainIntel.citation_domains.length === 0) {
    issues.push('No citation domains for authority context');
    score -= 10;
  }

  score = Math.max(0, score);
  return { score, issues, entity_count: entities.length, primary_entities: entities };
}

/**
 * Validate schema.org completeness (required schemas present and valid)
 */
function validateSchemaCompleteness(schemaMarkup: SchemaMarkup): {
  score: number;
  missing_schemas: string[];
  found_schemas: string[];
  schema_quality_rating: 'excellent' | 'good' | 'fair' | 'poor';
} {
  const requiredSchemas = ['Organization', 'Article', 'BreadcrumbList'];
  const foundSchemas = schemaMarkup.schema_types || [];
  const missingSchemas = requiredSchemas.filter((s) => !foundSchemas.includes(s));

  let score = 100;
  const issues: string[] = [];

  // Check for Organization schema
  if (!foundSchemas.includes('Organization')) {
    score -= 30;
    issues.push('Missing Organization schema');
  }

  // Check for FAQ / content schemas
  if (foundSchemas.length < 2) {
    score -= 20;
    issues.push('Limited schema diversity');
  }

  // Check for validation errors
  if (schemaMarkup.validation_errors && schemaMarkup.validation_errors.length > 0) {
    score -= 10 * Math.min(schemaMarkup.validation_errors.length, 3);
    issues.push(`Found ${schemaMarkup.validation_errors.length} schema validation errors`);
  }

  // JSON-LD count indicator
  if (schemaMarkup.json_ld_count < 2) {
    score -= 15;
  } else if (schemaMarkup.json_ld_count >= 5) {
    score += 10;
  }

  const quality: 'excellent' | 'good' | 'fair' | 'poor' = score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

  return {
    score: Math.max(0, score),
    missing_schemas: missingSchemas,
    found_schemas: foundSchemas,
    schema_quality_rating: quality,
  };
}

/**
 * Validate H1/H2 heading hierarchy
 */
function validateHeadingHierarchy(contentAnalysis: ContentAnalysis): {
  score: number;
  h1_count: number;
  h1_present: boolean;
  hierarchy_valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  const h1Count = contentAnalysis.headings?.h1 || 0;
  const h2Count = contentAnalysis.headings?.h2 || 0;
  const h3Count = contentAnalysis.headings?.h3 || 0;

  // H1 validation (should be exactly 1)
  const h1Present = h1Count > 0;
  if (!h1Present) {
    issues.push('No H1 heading found');
    score -= 35;
  } else if (h1Count > 1) {
    issues.push(`Multiple H1 tags found (${h1Count}). Should have exactly one.`);
    score -= 20;
  }

  // H2 hierarchy validation
  if (h1Present && h2Count === 0) {
    issues.push('No H2 headings for topic structure');
    score -= 15;
  }

  // Hierarchy validity (H3s shouldn't exist without H2s)
  const hierarchyValid = !h1Present || (h2Count > 0 || h3Count === 0);
  if (!hierarchyValid) {
    issues.push('Invalid heading hierarchy: H3 without H2');
    score -= 20;
  }

  const overallHeadingCount = h1Count + h2Count + h3Count;
  if (overallHeadingCount < 3) {
    issues.push('Too few headings for content structure');
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    h1_count: h1Count,
    h1_present: h1Present,
    hierarchy_valid: hierarchyValid,
    issues,
  };
}

/**
 * Validate metadata quality (title, description, OG tags)
 */
function validateMetadataQuality(domainIntel: DomainIntelligence): {
  score: number;
  title_quality: 'good' | 'fair' | 'poor';
  description_quality: 'good' | 'fair' | 'poor';
  og_tags_present: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // Title validation (50-60 chars optimal)
  const titleLen = (domainIntel.page_title || '').length;
  let titleQuality: 'good' | 'fair' | 'poor' = 'fair';
  if (titleLen === 0) {
    titleQuality = 'poor';
    score -= 20;
    issues.push('Title tag missing');
  } else if (titleLen < 30) {
    titleQuality = 'fair';
    score -= 10;
    issues.push('Title tag too short');
  } else if (titleLen > 60) {
    titleQuality = 'fair';
    score -= 5;
    issues.push('Title tag too long (may truncate in search results)');
  } else {
    titleQuality = 'good';
  }

  // Description validation (25-160 chars per Bing/search engine standards, 70-160 optimal)
  const descLen = (domainIntel.page_description || '').length;
  let descQuality: 'good' | 'fair' | 'poor' = 'fair';
  if (descLen === 0) {
    descQuality = 'poor';
    score -= 20;
    issues.push('Meta description missing');
  } else if (descLen < 25) {
    descQuality = 'poor';
    score -= 15;
    issues.push('Meta description too short (under 25 characters, minimum is 25)');
  } else if (descLen < 70) {
    descQuality = 'fair';
    score -= 5;
    issues.push('Meta description is thin (under 70 characters, aim for 70-160)');
  } else if (descLen > 160) {
    descQuality = 'fair';
    score -= 5;
    issues.push('Meta description too long (over 160 characters, may truncate in search results)');
  } else {
    descQuality = 'good';
  }

  // OG tags (Open Graph for social/AI sharing)
  const ogPresent = !!(domainIntel.open_graph && Object.keys(domainIntel.open_graph).length > 0);
  if (!ogPresent) {
    score -= 10;
    issues.push('Open Graph tags missing for social sharing');
  }

  return {
    score: Math.max(0, score),
    title_quality: titleQuality,
    description_quality: descQuality,
    og_tags_present: ogPresent,
    issues,
  };
}

/**
 * Validate topical depth (keyword diversity, content structure)
 */
function validateTopicalDepth(
  contentAnalysis: ContentAnalysis,
  domainIntel: DomainIntelligence
): {
  score: number;
  topic_count: number;
  keyword_diversity: number;
  content_structure: 'strong' | 'moderate' | 'weak';
} {
  let score = 100;

  // Keyword density diversity
  const keywordDensity = contentAnalysis.keyword_density || {};
  const uniqueKeywords = Object.keys(keywordDensity).length;
  const keywordDiversity = Math.min(uniqueKeywords / 30, 1); // Scale 0-1

  if (uniqueKeywords < 5) {
    score -= 20;
  } else if (uniqueKeywords < 10) {
    score -= 10;
  }

  // Topic Count
  const topicCount = (domainIntel.primary_topics || []).length + (contentAnalysis.keyword_density ? Object.keys(contentAnalysis.keyword_density).length : 0);

  if (topicCount < 3) {
    score -= 15;
  } else if (topicCount >= 8) {
    score += 10;
  }

  // Content structure
  const totalWords = contentAnalysis.word_count || 0;
  const totalHeadings = (contentAnalysis.headings?.h1 || 0) + (contentAnalysis.headings?.h2 || 0) + (contentAnalysis.headings?.h3 || 0);

  let structure: 'strong' | 'moderate' | 'weak' = 'moderate';
  if (totalWords < 300 || totalHeadings < 2) {
    structure = 'weak';
    score -= 15;
  } else if (totalWords > 1500 && totalHeadings >= 5) {
    structure = 'strong';
  }

  return {
    score: Math.max(0, score),
    topic_count: topicCount,
    keyword_diversity: keywordDiversity,
    content_structure: structure,
  };
}

/**
 * Compute overall LLM readability score
 */
export function validateLLMReadability(
  domainIntel: DomainIntelligence,
  contentAnalysis: ContentAnalysis,
  schemaMarkup: SchemaMarkup
): LLMReadabilityScore {
  const entityClarity = validateEntityClarity(domainIntel, contentAnalysis);
  const schemaCompleteness = validateSchemaCompleteness(schemaMarkup);
  const headingHierarchy = validateHeadingHierarchy(contentAnalysis);
  const metadataQuality = validateMetadataQuality(domainIntel);
  const topicalDepth = validateTopicalDepth(contentAnalysis, domainIntel);

  // Weighted average (weights)
  const weights = {
    entity_clarity: 0.2,
    schema: 0.25,
    heading: 0.15,
    metadata: 0.2,
    topical: 0.2,
  };

  const overallScore = Math.round(
    entityClarity.score * weights.entity_clarity +
      schemaCompleteness.score * weights.schema +
      headingHierarchy.score * weights.heading +
      metadataQuality.score * weights.metadata +
      topicalDepth.score * weights.topical
  );

  // Determine priority
  let priority: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none';
  if (overallScore < 50) {
    priority = 'critical';
  } else if (overallScore < 65) {
    priority = 'high';
  } else if (overallScore < 80) {
    priority = 'medium';
  } else if (overallScore < 90) {
    priority = 'low';
  }

  // Generate recommendations
  const recommendations: string[] = [
    ...entityClarity.issues.map((i) => `[Entity Clarity] ${i}`),
    ...schemaCompleteness.missing_schemas.map((s) => `[Schema] Add missing ${s} schema.org markup`),
    ...headingHierarchy.issues.map((i) => `[Heading] ${i}`),
    ...metadataQuality.issues.map((i) => `[Metadata] ${i}`),
  ].slice(0, 8); // Top 8 recommendations

  return {
    overall_score: overallScore,
    entity_clarity: entityClarity,
    schema_completeness: schemaCompleteness,
    heading_hierarchy: headingHierarchy,
    metadata_quality: metadataQuality,
    topical_depth: topicalDepth,
    recommendation_priority: priority,
    actionable_recommendations: recommendations,
  };
}
