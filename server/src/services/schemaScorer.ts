// server/src/services/schemaScorer.ts
// Comprehensive deterministic schema scoring system for AI Visibility Engine.
// Informed by schema.org validation, GS1 Digital Link vocabulary (product identification),
// and MLCommons Croissant metadata patterns (entity graph + @id cross-refs + vocabulary extension).

// ── Types ───────────────────────────────────────────────────────────────────

export interface SchemaScoreBreakdown {
  /** Overall schema quality score 0-100 */
  total: number;

  validity: { score: number; max: 15; details: string[] };
  typeCoverage: { score: number; max: 15; details: string[] };
  propertyCompleteness: { score: number; max: 15; details: string[] };
  entityGraph: { score: number; max: 15; details: string[] };
  contentAlignment: { score: number; max: 10; details: string[] };
  advancedVocabulary: { score: number; max: 10; details: string[] };
  relationshipDepth: { score: number; max: 10; details: string[] };
  bestPractices: { score: number; max: 10; details: string[] };

  /** Flat evidence strings for the AI prompt */
  evidenceSummary: string[];
  /** Schema types found */
  detectedTypes: string[];
  /** Entity @id values declared */
  declaredIds: string[];
  /** Cross-references found (target @id values referenced by other entities) */
  crossReferences: string[];
  /** Validation issues */
  issues: string[];
}

// ── Required/Recommended property maps per schema.org type ──────────────────

const TYPE_PROPERTY_MAP: Record<string, { required: string[]; recommended: string[] }> = {
  Organization:     { required: ['name', 'url'],                       recommended: ['logo', 'address', 'contactPoint', 'sameAs', '@id'] },
  LocalBusiness:    { required: ['name', 'url', 'address'],             recommended: ['telephone', 'openingHours', 'geo', 'sameAs', '@id'] },
  Person:           { required: ['name'],                               recommended: ['sameAs', 'jobTitle', 'worksFor', 'knowsAbout', '@id'] },
  WebSite:          { required: ['name', 'url'],                        recommended: ['potentialAction', '@id'] },
  WebPage:          { required: ['name', 'url'],                        recommended: ['isPartOf', 'about', 'publisher', '@id', 'datePublished'] },
  Article:          { required: ['headline', 'author', 'datePublished'], recommended: ['publisher', 'image', 'mainEntityOfPage', '@id', 'description'] },
  BlogPosting:      { required: ['headline', 'author', 'datePublished'], recommended: ['publisher', 'image', 'mainEntityOfPage', '@id'] },
  NewsArticle:      { required: ['headline', 'author', 'datePublished'], recommended: ['publisher', 'image', '@id'] },
  FAQPage:          { required: ['mainEntity'],                         recommended: ['name', '@id'] },
  HowTo:            { required: ['name', 'step'],                       recommended: ['description', 'image', 'totalTime'] },
  BreadcrumbList:   { required: ['itemListElement'],                    recommended: [] },
  ItemList:         { required: ['itemListElement'],                    recommended: ['numberOfItems', 'name'] },
  Product:          { required: ['name'],                               recommended: ['image', 'offers', 'brand', 'description', 'sku', 'gtin', 'gtin13', 'gtin8', 'mpn', 'aggregateRating', '@id'] },
  SoftwareApplication: { required: ['name'],                            recommended: ['applicationCategory', 'operatingSystem', 'offers', 'aggregateRating', 'featureList', '@id'] },
  Review:           { required: ['itemReviewed', 'reviewRating'],       recommended: ['author', 'datePublished', '@id'] },
  AggregateRating:  { required: ['ratingValue', 'reviewCount'],         recommended: ['bestRating', 'worstRating'] },
  DefinedTermSet:   { required: ['name', 'hasDefinedTerm'],             recommended: ['description'] },
  DefinedTerm:      { required: ['name'],                               recommended: ['description', 'termCode'] },
  Dataset:          { required: ['name', 'description'],                recommended: ['license', 'url', 'creator', 'datePublished', 'distribution'] },
  Event:            { required: ['name', 'startDate'],                  recommended: ['location', 'organizer', 'endDate', 'description'] },
  VideoObject:      { required: ['name', 'uploadDate'],                 recommended: ['description', 'thumbnailUrl', 'contentUrl', 'duration'] },
  ImageObject:      { required: ['contentUrl'],                         recommended: ['caption', 'description'] },
  Service:          { required: ['name'],                               recommended: ['provider', 'serviceType', 'description', 'offers'] },
  Course:           { required: ['name', 'provider'],                   recommended: ['description', 'hasCourseInstance'] },
  Recipe:           { required: ['name', 'recipeIngredient'],           recommended: ['recipeInstructions', 'image', 'nutrition'] },
  JobPosting:       { required: ['title', 'datePosted', 'hiringOrganization'], recommended: ['description', 'employmentType', 'jobLocation'] },
};

// Core types that signal strong overall schema implementation
const CORE_TYPES = new Set(['Organization', 'WebSite', 'WebPage', 'LocalBusiness']);

// Extended types that signal advanced schema usage
const EXTENDED_TYPES = new Set([
  'DefinedTermSet', 'DefinedTerm', 'HowTo', 'ItemList', 'Review',
  'AggregateRating', 'BreadcrumbList', 'Dataset', 'VideoObject',
  'ImageObject', 'Event', 'Course', 'Recipe', 'JobPosting', 'Service',
]);

// GS1 Digital Link product identification properties
const GS1_PROPERTIES = new Set([
  'gtin', 'gtin13', 'gtin14', 'gtin8', 'gtin12', 'mpn', 'sku',
  'brand', 'manufacturer', 'countryOfOrigin', 'weight', 'depth',
  'width', 'height', 'color', 'material', 'model', 'productID',
  'nsn', 'globalLocationNumber',
]);

// Croissant/Dataset metadata properties (schema.org extension for ML datasets)
const CROISSANT_SIGNALS = new Set([
  'Dataset', 'distribution', 'recordSet', 'conformsTo',
  'FileObject', 'FileSet', 'RecordSet', 'Field',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeType(t: unknown): string {
  if (typeof t !== 'string') return '';
  // Strip schema.org URL prefix if present
  return t.replace(/^https?:\/\/schema\.org\//, '').trim();
}

function getTypes(entity: any): string[] {
  const raw = entity?.['@type'] ?? entity?.type;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeType).filter(Boolean);
  return [normalizeType(raw)].filter(Boolean);
}

function hasProperty(entity: any, prop: string): boolean {
  if (prop === '@id') return typeof entity?.['@id'] === 'string' && entity['@id'].length > 0;
  return entity?.[prop] !== undefined && entity?.[prop] !== null && entity?.[prop] !== '';
}

function flattenEntities(blocks: any[]): any[] {
  const entities: any[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (Array.isArray(block)) {
      entities.push(...flattenEntities(block));
      continue;
    }
    if (Array.isArray(block['@graph'])) {
      entities.push(...flattenEntities(block['@graph']));
    } else {
      entities.push(block);
    }
    // Also recurse into nested entities (e.g. mainEntity, author, publisher, etc.)
    for (const val of Object.values(block)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && (val as any)['@type']) {
        entities.push(val as any);
      }
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === 'object' && item['@type']) {
            entities.push(item);
          }
        }
      }
    }
  }
  return entities;
}

function collectAllIds(entities: any[]): Set<string> {
  const ids = new Set<string>();
  for (const e of entities) {
    if (typeof e?.['@id'] === 'string' && e['@id']) ids.add(e['@id']);
  }
  return ids;
}

function collectAllIdReferences(entities: any[], declaredIds: Set<string>): Set<string> {
  const refs = new Set<string>();
  const walk = (node: any, depth: number = 0) => {
    if (depth > 10 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => walk(n, depth + 1)); return; }
    // A reference is an object with @id and no @type (pure ref), or any @id we can match
    const id = node['@id'];
    if (typeof id === 'string' && id && declaredIds.has(id)) {
      // Only count as cross-reference if this node is referencing (not declaring)
      const keys = Object.keys(node).filter(k => k !== '@id');
      if (keys.length === 0 || !node['@type']) {
        refs.add(id);
      }
    }
    for (const [key, val] of Object.entries(node)) {
      if (key === '@id' || key === '@context' || key === '@type') continue;
      walk(val, depth + 1);
    }
  };
  for (const e of entities) walk(e);
  return refs;
}

function hasContext(blocks: any[]): boolean {
  return blocks.some(b => b?.['@context']);
}

// Count FAQ questions with proper acceptedAnswer
function countValidFaqQuestions(entities: any[]): number {
  let count = 0;
  for (const e of entities) {
    if (getTypes(e).some(t => /faqpage/i.test(t))) {
      const questions = Array.isArray(e.mainEntity) ? e.mainEntity : (e.mainEntity ? [e.mainEntity] : []);
      for (const q of questions) {
        if (q?.acceptedAnswer) count++;
      }
    }
  }
  return count;
}

// Check BreadcrumbList items have position
function hasBreadcrumbPositions(entities: any[]): boolean {
  for (const e of entities) {
    if (getTypes(e).some(t => /breadcrumblist/i.test(t))) {
      const items = Array.isArray(e.itemListElement) ? e.itemListElement : [];
      if (items.length > 0 && items.every((i: any) => i.position !== undefined)) return true;
    }
  }
  return false;
}

// Check if any entity has sameAs with social profiles
function hasSameAsProfiles(entities: any[]): boolean {
  return entities.some(e => {
    const sa = e?.sameAs;
    if (!sa) return false;
    const links = Array.isArray(sa) ? sa : [sa];
    return links.some((l: any) => typeof l === 'string' && /linkedin|twitter|facebook|youtube|github|instagram/i.test(l));
  });
}

// Check for contactPoint or email
function hasContactInfo(entities: any[]): boolean {
  return entities.some(e => e?.contactPoint || e?.email || e?.telephone);
}

// Check for address/geo
function hasLocationData(entities: any[]): boolean {
  return entities.some(e => e?.address || e?.geo || e?.location);
}

// ── Scoring dimensions ─────────────────────────────────────────────────────

function scoreValidity(blocks: any[], parseErrors: string[], entities: any[]): SchemaScoreBreakdown['validity'] {
  let score = 0;
  const details: string[] = [];

  // All blocks parsed successfully? (parseErrors tracked during extraction)
  if (blocks.length > 0 && parseErrors.length === 0) {
    score += 5;
    details.push(`All ${blocks.length} JSON-LD block(s) parse as valid JSON`);
  } else if (blocks.length > 0) {
    const valid = blocks.length - parseErrors.length;
    score += Math.round((valid / blocks.length) * 5);
    details.push(`${valid}/${blocks.length + parseErrors.length} JSON-LD blocks valid; ${parseErrors.length} malformed`);
  }

  // No validation errors from type-specific checks
  if (parseErrors.length === 0) {
    score += 5;
    details.push('Zero schema validation errors');
  } else {
    const penalty = Math.min(5, parseErrors.length * 2);
    score += Math.max(0, 5 - penalty);
    details.push(`${parseErrors.length} validation issue(s) detected`);
  }

  // Proper @context
  if (hasContext(blocks)) {
    score += 3;
    details.push('@context declared — proper JSON-LD structure');
  } else if (blocks.length > 0) {
    details.push('Missing @context — JSON-LD should declare vocabulary context');
  }

  // All entities have @type
  const missingType = entities.filter(e => getTypes(e).length === 0);
  if (entities.length > 0 && missingType.length === 0) {
    score += 2;
    details.push('All entities have explicit @type');
  } else if (missingType.length > 0) {
    score += 1;
    details.push(`${missingType.length} entity(ies) missing @type — every entity should declare a type`);
  }

  return { score: Math.min(score, 15), max: 15, details };
}

function scoreTypeCoverage(uniqueTypes: string[]): SchemaScoreBreakdown['typeCoverage'] {
  let score = 0;
  const details: string[] = [];
  const count = uniqueTypes.length;

  if (count === 0) {
    details.push('No schema types detected');
    return { score: 0, max: 15, details };
  }

  // Breadth scoring (scale: 0-13)
  if (count >= 10) { score += 13; details.push(`${count} unique types — exceptional breadth`); }
  else if (count >= 7) { score += 10; details.push(`${count} unique types — strong breadth`); }
  else if (count >= 4) { score += 7; details.push(`${count} unique types — moderate breadth`); }
  else if (count >= 2) { score += 4; details.push(`${count} unique types — basic coverage`); }
  else { score += 2; details.push(`${count} unique type — minimal coverage`); }

  // Bonus for core types (Organization, WebSite, WebPage)
  const coreFound = uniqueTypes.filter(t => CORE_TYPES.has(t));
  if (coreFound.length >= 2) {
    score += 2;
    details.push(`Core types present: ${coreFound.join(', ')}`);
  } else if (coreFound.length === 1) {
    score += 1;
    details.push(`Core type present: ${coreFound[0]}`);
  }

  return { score: Math.min(score, 15), max: 15, details };
}

function scorePropertyCompleteness(entities: any[], uniqueTypes: string[]): SchemaScoreBreakdown['propertyCompleteness'] {
  const details: string[] = [];
  let totalRequired = 0;
  let totalSatisfied = 0;
  let totalRecommended = 0;
  let recommendedSatisfied = 0;

  // For each unique type, find one representative entity and check its properties
  for (const typeName of uniqueTypes) {
    const propMap = TYPE_PROPERTY_MAP[typeName];
    if (!propMap) continue;

    // Find entities of this type
    const typeEntities = entities.filter(e => getTypes(e).includes(typeName));
    if (typeEntities.length === 0) continue;

    // Use best entity (the one with most properties filled)
    const best = typeEntities.reduce((a, b) => {
      const aCount = [...propMap.required, ...propMap.recommended].filter(p => hasProperty(a, p)).length;
      const bCount = [...propMap.required, ...propMap.recommended].filter(p => hasProperty(b, p)).length;
      return bCount > aCount ? b : a;
    });

    const missingRequired: string[] = [];
    for (const prop of propMap.required) {
      totalRequired++;
      if (hasProperty(best, prop)) {
        totalSatisfied++;
      } else {
        missingRequired.push(prop);
      }
    }

    for (const prop of propMap.recommended) {
      totalRecommended++;
      if (hasProperty(best, prop)) {
        recommendedSatisfied++;
      }
    }

    if (missingRequired.length > 0) {
      details.push(`${typeName}: missing required ${missingRequired.join(', ')}`);
    }
  }

  if (totalRequired === 0 && totalRecommended === 0) {
    details.push('No recognized types with property requirements found');
    return { score: 0, max: 15, details };
  }

  // Score: 60% weight on required, 40% on recommended
  const requiredRatio = totalRequired > 0 ? totalSatisfied / totalRequired : 1;
  const recommendedRatio = totalRecommended > 0 ? recommendedSatisfied / totalRecommended : 0;
  const score = Math.round((requiredRatio * 0.6 + recommendedRatio * 0.4) * 15);

  details.push(`Required properties: ${totalSatisfied}/${totalRequired} satisfied (${Math.round(requiredRatio * 100)}%)`);
  details.push(`Recommended properties: ${recommendedSatisfied}/${totalRecommended} satisfied (${Math.round(recommendedRatio * 100)}%)`);

  return { score: Math.min(score, 15), max: 15, details };
}

function scoreEntityGraph(entities: any[]): SchemaScoreBreakdown['entityGraph'] {
  let score = 0;
  const details: string[] = [];

  const declaredIds = collectAllIds(entities);
  const idCount = declaredIds.size;

  if (idCount === 0) {
    details.push('No @id declarations — entity graph cannot be constructed');
    return { score: 0, max: 15, details };
  }

  // Any @id declarations
  if (idCount >= 1) {
    score += 3;
    details.push(`${idCount} @id declaration(s)`);
  }

  // Multiple @id declarations
  if (idCount >= 3) {
    score += 3;
    details.push('Rich entity identity layer (3+ @id nodes)');
  } else if (idCount >= 2) {
    score += 1;
  }

  // Cross-references
  const crossRefs = collectAllIdReferences(entities, declaredIds);
  if (crossRefs.size >= 3) {
    score += 5;
    details.push(`${crossRefs.size} cross-reference(s) — strong entity graph coherence`);
  } else if (crossRefs.size >= 1) {
    score += 3;
    details.push(`${crossRefs.size} cross-reference(s) between entities`);
  } else {
    details.push('@id declared but no cross-references — entities are isolated');
  }

  // Graph coherence: all referenced @ids resolve to declared entities
  // (crossRefs is already filtered to only those that exist in declaredIds)
  if (crossRefs.size > 0) {
    score += 4;
    details.push('All cross-references resolve to declared entities');
  }

  return { score: Math.min(score, 15), max: 15, details, };
}

function scoreContentAlignment(entities: any[], uniqueTypes: string[], pageSignals: { hasQuestionContent: boolean; hasProductContent: boolean; hasArticleContent: boolean; hasBrandContent: boolean }): SchemaScoreBreakdown['contentAlignment'] {
  let score = 0;
  const details: string[] = [];

  // Organization/LocalBusiness + brand signals
  const hasOrg = uniqueTypes.some(t => /organization|localbusiness/i.test(t));
  if (hasOrg && pageSignals.hasBrandContent) {
    score += 3;
    details.push('Organization schema aligns with brand content on page');
  } else if (hasOrg) {
    score += 1;
    details.push('Organization schema present (brand alignment uncertain)');
  }

  // FAQPage + question content
  const hasFaq = uniqueTypes.some(t => /faqpage/i.test(t));
  if (hasFaq && pageSignals.hasQuestionContent) {
    score += 3;
    details.push('FAQPage schema aligns with Q&A content');
  } else if (hasFaq) {
    score += 1;
  }

  // Article/BlogPosting + article content
  const hasArticle = uniqueTypes.some(t => /article|blogposting|newsarticle/i.test(t));
  if (hasArticle && pageSignals.hasArticleContent) {
    score += 2;
    details.push('Article schema aligns with long-form content');
  } else if (hasArticle) {
    score += 1;
  }

  // Product/SoftwareApplication + product descriptions
  const hasProduct = uniqueTypes.some(t => /product|softwareapplication/i.test(t));
  if (hasProduct && pageSignals.hasProductContent) {
    score += 2;
    details.push('Product/App schema aligns with product content');
  } else if (hasProduct) {
    score += 1;
  }

  return { score: Math.min(score, 10), max: 10, details };
}

function scoreAdvancedVocabulary(entities: any[], uniqueTypes: string[]): SchemaScoreBreakdown['advancedVocabulary'] {
  let score = 0;
  const details: string[] = [];

  // GS1 Digital Link product identification properties
  let gs1Found = 0;
  for (const e of entities) {
    for (const prop of GS1_PROPERTIES) {
      if (hasProperty(e, prop)) gs1Found++;
    }
  }
  if (gs1Found >= 3) {
    score += 3;
    details.push(`${gs1Found} GS1 product identification properties (gtin/sku/mpn/brand etc.)`);
  } else if (gs1Found >= 1) {
    score += 1;
    details.push(`${gs1Found} GS1 product property detected`);
  }

  // Croissant / Dataset metadata signals
  let croissantFound = 0;
  for (const t of uniqueTypes) {
    if (CROISSANT_SIGNALS.has(t)) croissantFound++;
  }
  for (const e of entities) {
    for (const prop of ['distribution', 'recordSet', 'conformsTo']) {
      if (hasProperty(e, prop)) croissantFound++;
    }
  }
  if (croissantFound >= 2) {
    score += 3;
    details.push(`Croissant/Dataset metadata patterns detected (${croissantFound} signals)`);
  } else if (croissantFound >= 1) {
    score += 1;
    details.push('Dataset metadata signal detected');
  }

  // Extended schema.org types beyond the basics
  const extendedFound = uniqueTypes.filter(t => EXTENDED_TYPES.has(t));
  if (extendedFound.length >= 4) {
    score += 4;
    details.push(`${extendedFound.length} extended types: ${extendedFound.join(', ')}`);
  } else if (extendedFound.length >= 2) {
    score += 2;
    details.push(`${extendedFound.length} extended type(s): ${extendedFound.join(', ')}`);
  } else if (extendedFound.length === 1) {
    score += 1;
    details.push(`Extended type: ${extendedFound[0]}`);
  }

  return { score: Math.min(score, 10), max: 10, details };
}

function scoreRelationshipDepth(entities: any[], uniqueTypes: string[]): SchemaScoreBreakdown['relationshipDepth'] {
  let score = 0;
  const details: string[] = [];

  // author → Person/Organization
  const hasAuthorLink = entities.some(e => {
    const a = e?.author;
    return a && typeof a === 'object' && (a['@type'] || a['@id']);
  });
  if (hasAuthorLink) {
    score += 2;
    details.push('author linked to typed entity');
  }

  // publisher → Organization
  const hasPublisher = entities.some(e => {
    const p = e?.publisher;
    return p && typeof p === 'object' && (p['@type'] || p['@id']);
  });
  if (hasPublisher) {
    score += 2;
    details.push('publisher linked to Organization');
  }

  // itemReviewed → typed entity
  const hasItemReviewed = entities.some(e => {
    const ir = e?.itemReviewed;
    return ir && typeof ir === 'object' && (ir['@type'] || ir['@id']);
  });
  if (hasItemReviewed) {
    score += 2;
    details.push('Review itemReviewed linked to typed entity');
  }

  // worksFor → Organization
  const hasWorksFor = entities.some(e => {
    const wf = e?.worksFor;
    return wf && typeof wf === 'object' && (wf['@type'] || wf['@id']);
  });
  if (hasWorksFor) {
    score += 2;
    details.push('Person worksFor linked to Organization');
  }

  // isPartOf / about / subjectOf cross-links
  const hasSemanticLinks = entities.some(e =>
    (e?.isPartOf && typeof e.isPartOf === 'object') ||
    (e?.about && typeof e.about === 'object') ||
    (e?.subjectOf && typeof e.subjectOf === 'object') ||
    (e?.mainEntityOfPage && typeof e.mainEntityOfPage === 'object')
  );
  if (hasSemanticLinks) {
    score += 2;
    details.push('Semantic cross-links (isPartOf/about/subjectOf/mainEntityOfPage)');
  }

  return { score: Math.min(score, 10), max: 10, details };
}

function scoreBestPractices(blocks: any[], entities: any[], uniqueTypes: string[], validationErrors: string[]): SchemaScoreBreakdown['bestPractices'] {
  let score = 0;
  const details: string[] = [];

  // No duplicate standalone types
  const topLevelTypes: string[] = [];
  for (const block of blocks) {
    if (block?.['@graph']) continue;
    const types = getTypes(block);
    topLevelTypes.push(...types);
  }
  const typeCounts = topLevelTypes.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
  const duplicates = Object.entries(typeCounts).filter(([_, c]) => c > 1);
  if (duplicates.length === 0) {
    score += 3;
    details.push('No duplicate standalone schema blocks');
  } else {
    score += 1;
    details.push(`Duplicate types: ${duplicates.map(([t, c]) => `${t}(${c})`).join(', ')}`);
  }

  // BreadcrumbList with proper positions
  if (hasBreadcrumbPositions(entities)) {
    score += 2;
    details.push('BreadcrumbList with ordered positions');
  } else if (uniqueTypes.includes('BreadcrumbList')) {
    score += 1;
    details.push('BreadcrumbList present but missing position ordering');
  }

  // sameAs social profiles
  if (hasSameAsProfiles(entities)) {
    score += 2;
    details.push('sameAs social profile links present');
  }

  // Contact info
  if (hasContactInfo(entities)) {
    score += 1;
    details.push('Contact information present in schema');
  }

  // Address/geo for local relevance
  if (hasLocationData(entities)) {
    score += 2;
    details.push('Address/geo location data present');
  }

  return { score: Math.min(score, 10), max: 10, details };
}

// ── Content signal helpers ─────────────────────────────────────────────────

export interface PageContentSignals {
  wordCount: number;
  hasQuestionContent: boolean;
  hasProductContent: boolean;
  hasArticleContent: boolean;
  hasBrandContent: boolean;
}

export function deriveContentSignals(
  bodyText: string,
  wordCount: number,
  h2s: string[],
): PageContentSignals {
  const lower = bodyText.toLowerCase();
  const h2Lower = h2s.map(h => h.toLowerCase()).join(' ');

  return {
    wordCount,
    hasQuestionContent: /\b(what|how|why|when|where|can i|should|faq|q&a|question)\b/i.test(lower + ' ' + h2Lower),
    hasProductContent: /\b(pricing|price|plan|feature|download|install|buy|purchase|subscription|app|software|product)\b/i.test(lower),
    hasArticleContent: wordCount >= 500 && /\b(published|author|posted|article|read more|introduction|conclusion)\b/i.test(lower),
    hasBrandContent: /\b(about us|our mission|founded|company|team|brand)\b/i.test(lower),
  };
}

// ── Main scoring entry point ───────────────────────────────────────────────

/**
 * Score the quality of JSON-LD structured data extracted from a page.
 *
 * @param html Raw HTML of the page
 * @param pageSignals Content signals from page body (word count, question/product signals)
 * @returns Full deterministic schema score breakdown
 */
export function scoreSchema(
  html: string,
  pageSignals: PageContentSignals,
): SchemaScoreBreakdown {
  // ── Extract JSON-LD blocks ──
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: any[] = [];
  const parseErrors: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = ldRegex.exec(html || '')) !== null) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      parseErrors.push('Malformed JSON-LD block');
    }
  }

  // ── Flatten entities ──
  const entities = flattenEntities(blocks);

  // ── Collect unique types ──
  const allTypes: string[] = [];
  for (const e of entities) allTypes.push(...getTypes(e));
  const uniqueTypes = Array.from(new Set(allTypes));

  // ── Collect validation errors ──
  const validationErrors = [...parseErrors];

  // Type-specific validation (mirrors extractSchemaSignalsFromHtml checks)
  for (const entity of entities) {
    const types = getTypes(entity);
    const typeStr = types.join(',');

    if (/review/i.test(typeStr) && entity.itemReviewed) {
      const ir = entity.itemReviewed;
      if (ir && typeof ir === 'object' && !ir['@type'] && !ir['@id']) {
        validationErrors.push('Review.itemReviewed missing @type — requires explicit type or @id reference');
      }
    }
    if (/^product$/i.test(typeStr) && entity.offers && !entity.image) {
      validationErrors.push('Product missing image — required for Google Product snippets');
    }
    if (/article|blogposting|newsarticle/i.test(typeStr)) {
      if (entity.author && typeof entity.author === 'object' && !entity.author['@type'] && !entity.author['@id']) {
        validationErrors.push(`${types[0]} author missing @type or @id`);
      }
    }
    if (/faqpage/i.test(typeStr) && entity.mainEntity) {
      const questions = Array.isArray(entity.mainEntity) ? entity.mainEntity : [entity.mainEntity];
      for (const q of questions) {
        if (!q.acceptedAnswer) {
          validationErrors.push('FAQPage Question missing acceptedAnswer');
          break;
        }
      }
    }
  }

  // ── Score each dimension ──
  const validity = scoreValidity(blocks, validationErrors, entities);
  const typeCoverage = scoreTypeCoverage(uniqueTypes);
  const propertyCompleteness = scorePropertyCompleteness(entities, uniqueTypes);
  const entityGraph = scoreEntityGraph(entities);
  const contentAlignment = scoreContentAlignment(entities, uniqueTypes, pageSignals);
  const advancedVocabulary = scoreAdvancedVocabulary(entities, uniqueTypes);
  const relationshipDepth = scoreRelationshipDepth(entities, uniqueTypes);
  const bestPractices = scoreBestPractices(blocks, entities, uniqueTypes, validationErrors);

  const total = Math.min(100,
    validity.score +
    typeCoverage.score +
    propertyCompleteness.score +
    entityGraph.score +
    contentAlignment.score +
    advancedVocabulary.score +
    relationshipDepth.score +
    bestPractices.score
  );

  // ── Build evidence summary ──
  const declaredIds = Array.from(collectAllIds(entities));
  const crossRefs = Array.from(collectAllIdReferences(entities, new Set(declaredIds)));

  const evidenceSummary: string[] = [
    `Schema quality score: ${total}/100`,
    `JSON-LD blocks: ${blocks.length + parseErrors.length} (${parseErrors.length} malformed)`,
    `Unique types (${uniqueTypes.length}): ${uniqueTypes.join(', ') || 'none'}`,
    `Entity @id nodes: ${declaredIds.length}`,
    `Cross-references: ${crossRefs.length}`,
    `Validation issues: ${validationErrors.length}`,
    ...(validationErrors.length > 0 ? validationErrors.slice(0, 5).map(e => `  ⚠ ${e}`) : []),
    `Dimensions — Validity: ${validity.score}/${validity.max}, Types: ${typeCoverage.score}/${typeCoverage.max}, Properties: ${propertyCompleteness.score}/${propertyCompleteness.max}, Graph: ${entityGraph.score}/${entityGraph.max}, Alignment: ${contentAlignment.score}/${contentAlignment.max}, Vocabulary: ${advancedVocabulary.score}/${advancedVocabulary.max}, Relationships: ${relationshipDepth.score}/${relationshipDepth.max}, Practices: ${bestPractices.score}/${bestPractices.max}`,
  ];

  return {
    total,
    validity,
    typeCoverage,
    propertyCompleteness,
    entityGraph,
    contentAlignment,
    advancedVocabulary,
    relationshipDepth,
    bestPractices,
    evidenceSummary,
    detectedTypes: uniqueTypes,
    declaredIds,
    crossReferences: crossRefs,
    issues: validationErrors,
  };
}
