import { describe, it, expect } from 'vitest';
import { generateTextSummary } from '../services/textSummaryGenerator.js';
import type { AnalysisResponse, TextSummaryDepth } from '../../../shared/types.js';

function makeResult(overrides: Partial<AnalysisResponse> = {}): AnalysisResponse {
  return {
    visibility_score: 38,
    url: 'https://example.com',
    recommendations: [
      { title: 'Add H1 heading', description: 'No H1 found on the page.', implementation: 'Add a descriptive H1 tag.', priority: 'high', category: 'content', impact: 'high' },
      { title: 'Expand content depth', description: 'Word count is below 300.', implementation: 'Add at least 800 words of helpful content. Cover key topics in depth. Include structured sections.', priority: 'high', category: 'content', impact: 'high' },
      { title: 'Add meta description', description: 'No meta description detected.', implementation: 'Write a concise 155-char meta description.', priority: 'medium', category: 'seo', impact: 'medium' },
      { title: 'Add FAQ schema', description: 'No FAQ schema found on the page.', implementation: 'Add JSON-LD FAQ schema. Include at least 3 question-answer pairs. Make questions natural.', priority: 'medium', category: 'schema', impact: 'medium' },
      { title: 'Use question-style H2s', description: 'Heading structure does not use questions.', implementation: 'Rewrite H2 headings as natural language questions users would ask.', priority: 'low', category: 'content', impact: 'medium' },
    ],
    content_analysis: { word_count: 180, has_proper_h1: false, has_meta_description: false },
    technical_signals: { https_enabled: true, response_time_ms: 800, has_canonical: false, has_robots_txt: true },
    category_grades: [
      { category: 'content', label: 'Content Quality', grade: 'D', score: 30 },
      { category: 'schema', label: 'Schema Markup', grade: 'F', score: 15 },
      { category: 'technical', label: 'Technical SEO', grade: 'B', score: 70 },
    ],
    ...overrides,
  } as unknown as AnalysisResponse;
}

describe('textSummaryGenerator', () => {
  describe('minimal depth (observer)', () => {
    it('returns exactly 2 findings', () => {
      const summary = generateTextSummary(makeResult(), 'minimal');
      expect(summary.findings).toHaveLength(2);
    });

    it('findings have empty fix strings', () => {
      const summary = generateTextSummary(makeResult(), 'minimal');
      for (const f of summary.findings) {
        expect(f.fix).toBe('');
      }
    });

    it('sets depth to minimal', () => {
      const summary = generateTextSummary(makeResult(), 'minimal');
      expect(summary.depth).toBe('minimal');
    });

    it('closing nudges upgrade', () => {
      const summary = generateTextSummary(makeResult(), 'minimal');
      expect(summary.closing.toLowerCase()).toContain('upgrade');
    });

    it('intro mentions the domain', () => {
      const summary = generateTextSummary(makeResult(), 'minimal');
      expect(summary.intro).toContain('example.com');
    });

    it('priority order matches finding count', () => {
      const summary = generateTextSummary(makeResult(), 'minimal');
      expect(summary.priority_order).toHaveLength(2);
    });
  });

  describe('standard depth (alignment)', () => {
    it('returns all findings', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      expect(summary.findings).toHaveLength(5);
    });

    it('findings have non-empty fix strings', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      for (const f of summary.findings) {
        expect(f.fix.length).toBeGreaterThan(0);
      }
    });

    it('truncates long fixes to roughly 3 sentences', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      const faqFinding = summary.findings.find((f) => f.title === 'Add FAQ schema');
      expect(faqFinding).toBeDefined();
      // Implementation has 3 sentences, so truncated fix should end with a period
      if (faqFinding) {
        expect(faqFinding.fix).toMatch(/\.$/);
      }
    });

    it('sets depth to standard', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      expect(summary.depth).toBe('standard');
    });

    it('intro mentions technical strengths', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      expect(summary.intro).toContain('HTTPS');
    });

    it('intro mentions weak categories', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      // category_grades with score < 50 are content quality and schema markup
      expect(summary.intro.toLowerCase()).toContain('content');
    });

    it('closing does not mention upgrade', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      expect(summary.closing.toLowerCase()).not.toContain('upgrade');
    });

    it('priority order lists all findings', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      expect(summary.priority_order).toHaveLength(5);
    });
  });

  describe('full depth (signal/scorefix)', () => {
    it('returns all findings with full implementation', () => {
      const summary = generateTextSummary(makeResult(), 'full');
      expect(summary.findings).toHaveLength(5);
      const faqFinding = summary.findings.find((f) => f.title === 'Add FAQ schema');
      expect(faqFinding).toBeDefined();
      // Full depth keeps the entire implementation text
      if (faqFinding) {
        expect(faqFinding.fix).toContain('Make questions natural');
      }
    });

    it('sets depth to full', () => {
      const summary = generateTextSummary(makeResult(), 'full');
      expect(summary.depth).toBe('full');
    });
  });

  describe('score band text variations', () => {
    it('critical score mentions AI systems cannot trust', () => {
      const summary = generateTextSummary(makeResult({ visibility_score: 20 }), 'standard');
      expect(summary.intro.toLowerCase()).toContain('do not yet');
    });

    it('needs_improvement mentions gaps', () => {
      const summary = generateTextSummary(makeResult({ visibility_score: 45 }), 'standard');
      expect(summary.intro.toLowerCase()).toContain('gaps');
    });

    it('good score mentions solid fundamentals', () => {
      const summary = generateTextSummary(makeResult({ visibility_score: 65 }), 'standard');
      expect(summary.intro.toLowerCase()).toContain('solid');
    });

    it('excellent score acknowledges quality', () => {
      const summary = generateTextSummary(makeResult({ visibility_score: 90 }), 'standard');
      expect(summary.intro.toLowerCase()).toContain('excellent');
    });
  });

  describe('edge cases', () => {
    it('handles zero recommendations gracefully', () => {
      const summary = generateTextSummary(makeResult({ recommendations: [] }), 'full');
      expect(summary.findings).toHaveLength(0);
      expect(summary.priority_order).toHaveLength(0);
      expect(summary.intro.length).toBeGreaterThan(0);
      expect(summary.closing.length).toBeGreaterThan(0);
    });

    it('handles missing URL', () => {
      const summary = generateTextSummary(makeResult({ url: undefined as any }), 'standard');
      expect(summary.intro.length).toBeGreaterThan(0);
    });

    it('handles missing category_grades', () => {
      const summary = generateTextSummary(makeResult({ category_grades: undefined as any }), 'standard');
      expect(summary.intro.length).toBeGreaterThan(0);
    });

    it('findings sorted by priority (high first)', () => {
      const summary = generateTextSummary(makeResult(), 'standard');
      // First two should be the high-priority ones
      const highPriority = ['Add H1 heading', 'Expand content depth'];
      expect(highPriority).toContain(summary.findings[0].title);
      expect(highPriority).toContain(summary.findings[1].title);
    });

    it('returns a well-formed TextSummary shape for all depths', () => {
      for (const depth of ['minimal', 'standard', 'full'] as TextSummaryDepth[]) {
        const summary = generateTextSummary(makeResult(), depth);
        expect(summary).toHaveProperty('depth');
        expect(summary).toHaveProperty('intro');
        expect(summary).toHaveProperty('findings');
        expect(summary).toHaveProperty('priority_order');
        expect(summary).toHaveProperty('closing');
        expect(typeof summary.intro).toBe('string');
        expect(typeof summary.closing).toBe('string');
        expect(Array.isArray(summary.findings)).toBe(true);
        expect(Array.isArray(summary.priority_order)).toBe(true);
      }
    });
  });
});
