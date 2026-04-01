/**
 * Citation Readiness Engine
 * 
 * Analyzes whether AI can quote and cite this site cleanly
 * Returns structured output on quotability, answer-readiness, and blockers
 */

import * as cheerio from 'cheerio';
import type { CitationReadinessOutput, CitableSection } from '../../../../shared/types.js';

interface CitationEngineInput {
  html: string;
  domain: string;
  target_url: string;
}

/**
 * Extract answer blocks from HTML
 * Looks for: FAQ schema, Q&A schema, article tags, main tags with clear structure
 */
function extractAnswerBlocks(html: string): CitableSection[] {
  const $ = cheerio.load(html);
  const sections: CitableSection[] = [];

  // Look for FAQ schema
  $('script[type="application/ld+json"]').each((_idx, elem) => {
    try {
      const json = JSON.parse($(elem).html() || '{}');
      if (json['@type'] === 'FAQPage' && Array.isArray(json.mainEntity)) {
        json.mainEntity.forEach((item: any, idx: number) => {
          sections.push({
            page: '/faq',
            section_heading: item.acceptedAnswer?.text ? item.question : `FAQ #${idx + 1}`,
            confidence: 0.95,
            extractable_text: item.acceptedAnswer?.text || '',
            word_count: (item.acceptedAnswer?.text || '').split(/\s+/).length,
            risk_factors: [],
          });
        });
      }
    } catch {
      // Ignore JSON parse errors
    }
  });

  // Look for explicit answer blocks (h2 followed by p with substantial content)
  $('h2, h3').each((_idx, elem) => {
    const heading = $(elem).text().trim();
    if (!heading) return;

    // Get next paragraph(s)
    let content = '';
    let wordCount = 0;
    $(elem)
      .nextUntil('h1, h2, h3, h4')
      .each((_pidx, pelem) => {
        const ptext = $(pelem).text().trim();
        if (ptext) {
          content += ' ' + ptext;
          wordCount += ptext.split(/\s+/).length;
        }
      });

    if (wordCount > 20) {
      // Good candidate for citation
      sections.push({
        page: `/${heading.toLowerCase().replace(/\s+/g, '-')}`,
        section_heading: heading,
        confidence: 0.85,
        extractable_text: content.trim().substring(0, 500),
        word_count: wordCount,
        risk_factors: wordCount < 50 ? ['brief: may lack context'] : [],
      });
    }
  });

  // Look for article tags
  $('article').each((_idx, elem) => {
    const heading = $(elem).find('h1, h2').first().text().trim();
    const content = $(elem).text().trim();
    const wordCount = content.split(/\s+/).length;

    if (wordCount > 50) {
      sections.push({
        page: '/article',
        section_heading: heading || 'Article',
        confidence: 0.88,
        extractable_text: content.substring(0, 500),
        word_count: wordCount,
        risk_factors: [],
      });
    }
  });

  return sections;
}

/**
 * Detect blockers to citation
 */
function detectBlockers(html: string, sections: CitableSection[]): string[] {
  const $ = cheerio.load(html);
  const blockers: string[] = [];

  // Missing schema
  const hasSchema = !!$('script[type="application/ld+json"]').length;
  if (!hasSchema) blockers.push('No JSON-LD schema markup found');

  // Missing answer blocks
  if (sections.length === 0) {
    blockers.push('No clear answer blocks or FAQ sections');
  }

  // Ambiguous headings (too generic)
  const headings = $('h2, h3')
    .map((_, el) => $(el).text().trim())
    .get();
  const vague = headings.filter((h) => /^(services|about|home|page|section|content)$/i.test(h));
  if (vague.length > 2) {
    blockers.push('Overly generic section headings reduce clarity for AI extraction');
  }

  // Check for contact info
  const hasContact = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/.test(html);
  if (!hasContact) {
    blockers.push('No email address found (reduces trust signals)');
  }

  // Check for bylines / author info
  const hasAuthor =
    !!$('[rel="author"]').length ||
    !!$('[name="author"]').length ||
    /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i.test(html); // Simple author pattern
  if (!hasAuthor) {
    blockers.push('No author or byline information');
  }

  return blockers;
}

/**
 * Calculate citation readiness score
 * Formula: Base 100, deduct for blockers and low-confidence sections
 */
function calculateCitationScore(
  sections: CitableSection[],
  blockers: string[],
  html: string
): number {
  let score = 100;

  // Deduct for blockers
  score -= Math.min(20, blockers.length * 5);

  // Deduct for low-confidence sections
  const lowConfidence = sections.filter((s) => s.confidence < 0.80).length;
  score -= lowConfidence * 3;

  // Bonus for high-confidence sections
  const highConfidence = sections.filter((s) => s.confidence >= 0.90).length;
  score += highConfidence * 2;

  // Check for article metadata
  const hasMetadata = /og:type|twitter:card|article:/i.test(html);
  if (hasMetadata) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate quotability index
 * How easy is it to extract a clean quote from this site?
 */
function calculateQuotabilityIndex(sections: CitableSection[]): number {
  if (sections.length === 0) return 0;

  let score = 0;

  // Average confidence of all sections
  const avgConfidence = sections.reduce((sum, s) => sum + s.confidence, 0) / sections.length;
  score += avgConfidence * 50;

  // Sections with low risk factors
  const cleanSections = sections.filter((s) => s.risk_factors.length === 0).length;
  score += (cleanSections / sections.length) * 30;

  // Sections with adequate word count (>50 words)
  const substantialSections = sections.filter((s) => s.word_count > 50).length;
  score += (substantialSections / sections.length) * 20;

  return Math.round(score);
}

/**
 * Main Citation Readiness Engine
 */
export async function runCitationReadinessEngine(
  input: CitationEngineInput
): Promise<CitationReadinessOutput> {
  const startTime = Date.now();

  try {
    // Extract answer blocks
    const citableSections = extractAnswerBlocks(input.html);

    // Detect blockers
    const blockers = detectBlockers(input.html, citableSections);

    // Calculate scores
    const citationReadinessScore = calculateCitationScore(citableSections, blockers, input.html);
    const quotabilityIndex = calculateQuotabilityIndex(citableSections);

    // Generate recommendations
    const recommendations: string[] = [];
    if (citableSections.length === 0) {
      recommendations.push('Add FAQ schema or answer blocks to improve citation readiness');
    }
    if (blockers.length > 0) {
      recommendations.push('Fix structuring issues: ' + blockers.slice(0, 2).join(', '));
    }
    if (citationReadinessScore < 60) {
      recommendations.push('Reorganize content into clear, titled sections with answer blocks');
    }

    return {
      status: 'success',
      timeMs: Date.now() - startTime,
      data: {
        citation_readiness_score: citationReadinessScore,
        quotability_index: quotabilityIndex,
        citable_sections: citableSections.slice(0, 10), // Top 10 sections
        blockers_to_citation: blockers,
        recommendations,
      },
    };
  } catch (error) {
    return {
      status: 'failed',
      timeMs: Date.now() - startTime,
      errors: [String(error)],
      data: {
        citation_readiness_score: 0,
        quotability_index: 0,
        citable_sections: [],
        blockers_to_citation: ['Engine error: ' + String(error)],
        recommendations: [],
      },
    };
  }
}
