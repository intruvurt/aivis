import * as cheerio from 'cheerio';
import { buildEvidence } from './evidenceUtils.js';

type EvidenceItem = ReturnType<typeof buildEvidence>;

type ExtractedData = {
  metaTags: Record<string, string>;
  title: string | null;
  headings: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', string[]>;
  jsonLd: any[];
  links: {
    canonical: string | null;
    alternate: Array<{ href: string; hreflang?: string }>;
    internal: number;
    external: number;
  };
  bodyText: string | null;
  wordCount: number;
};

/**
 * Stage 4: Extraction - Extract all relevant signals from HTML
 */
export const extractContent = (html: string, url: string) => {
  const evidence: EvidenceItem[] = [];

  const extractedData: ExtractedData = {
    metaTags: {},
    title: null,
    headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
    jsonLd: [],
    links: { canonical: null, alternate: [], internal: 0, external: 0 },
    bodyText: null,
    wordCount: 0,
  };

  try {
    const $ = cheerio.load(html);

    // Title
    extractedData.title = $('title').text().trim() || null;
    if (extractedData.title) {
      evidence.push(
        buildEvidence({
          proof: `Title: "${extractedData.title}"`,
          source: url,
          verifiedBy: 'HTML Parser',
          description: 'Page title extracted',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No title tag found',
        })
      );
    }

    // Meta tags
    $('meta').each((_i, elem) => {
      const name = ($(elem).attr('name') || $(elem).attr('property') || '').trim();
      const content = ($(elem).attr('content') || '').trim();
      if (name && content) extractedData.metaTags[name] = content;
    });

    const metaKeys = Object.keys(extractedData.metaTags);
    if (metaKeys.length > 0) {
      evidence.push(
        buildEvidence({
          proof: `${metaKeys.length} meta tags found`,
          source: url,
          verifiedBy: 'HTML Parser',
          description: `Meta tags: ${metaKeys.join(', ')}`,
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No meta tags found',
        })
      );
    }

    // Headings
    (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach((tag) => {
      $(tag).each((_i, elem) => {
        const text = $(elem).text().replace(/\s+/g, ' ').trim();
        if (text) extractedData.headings[tag].push(text);
      });
    });

    const headingArrays = Object.values(extractedData.headings);
    const totalHeadings = headingArrays.reduce((sum, arr) => sum + arr.length, 0);

    if (totalHeadings > 0) {
      evidence.push(
        buildEvidence({
          proof: `${totalHeadings} headings found (H1: ${extractedData.headings.h1.length}, H2: ${extractedData.headings.h2.length}, H3: ${extractedData.headings.h3.length})`,
          source: url,
          verifiedBy: 'HTML Parser',
          description: 'Heading structure extracted',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No headings found',
        })
      );
    }

    // JSON-LD
    $('script[type="application/ld+json"]').each((_i, elem) => {
      const raw = $(elem).html();
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);

        // Sometimes JSON-LD is an array, sometimes single object
        if (Array.isArray(parsed)) extractedData.jsonLd.push(...parsed);
        else extractedData.jsonLd.push(parsed);
      } catch {
        // skip invalid JSON-LD
      }
    });

    if (extractedData.jsonLd.length > 0) {
      const schemaTypes = extractedData.jsonLd
        .map((ld) => (ld && typeof ld === 'object' ? ld['@type'] : null))
        .map((t) => (t ? String(t) : 'Unknown'));

      evidence.push(
        buildEvidence({
          proof: `${extractedData.jsonLd.length} JSON-LD block(s) found`,
          source: url,
          verifiedBy: 'JSON Parser',
          description: `Schema types: ${schemaTypes.join(', ')}`,
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No JSON-LD structured data found',
        })
      );
    }

    // Canonical link
    const canonical = $('link[rel="canonical"]').attr('href')?.trim();
    if (canonical) {
      extractedData.links.canonical = canonical;
      evidence.push(
        buildEvidence({
          proof: `Canonical URL: ${canonical}`,
          source: url,
          verifiedBy: 'HTML Parser',
          description: 'Canonical link tag found',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No canonical link tag found',
        })
      );
    }

    // Alternate links
    $('link[rel="alternate"]').each((_i, elem) => {
      const href = $(elem).attr('href')?.trim();
      const hreflang = $(elem).attr('hreflang')?.trim();
      if (href) extractedData.links.alternate.push({ href, hreflang });
    });

    if (extractedData.links.alternate.length > 0) {
      evidence.push(
        buildEvidence({
          proof: `${extractedData.links.alternate.length} alternate link(s) found`,
          source: url,
          verifiedBy: 'HTML Parser',
          description: 'Alternate/hreflang links present',
        })
      );
    }

    // Link counts (internal/external)
    let baseHost = '';
    try {
      baseHost = new URL(url).hostname;
    } catch {
      baseHost = '';
    }

    $('a[href]').each((_i, elem) => {
      const href = $(elem).attr('href')?.trim();
      if (!href) return;

      if (href.startsWith('http://') || href.startsWith('https://')) {
        if (baseHost && href.includes(baseHost)) extractedData.links.internal++;
        else extractedData.links.external++;
        return;
      }

      if (href.startsWith('/')) {
        extractedData.links.internal++;
        return;
      }

      // ignore fragments/mailto/tel/javascript etc
    });

    evidence.push(
      buildEvidence({
        proof: `Links: ${extractedData.links.internal} internal, ${extractedData.links.external} external`,
        source: url,
        verifiedBy: 'HTML Parser',
        description: 'Link structure analyzed',
      })
    );

    // Body text + word count
    $('script, style, noscript').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    extractedData.bodyText = bodyText || null;

    extractedData.wordCount = extractedData.bodyText
      ? extractedData.bodyText.split(/\s+/).filter(Boolean).length
      : 0;

    evidence.push(
      buildEvidence({
        proof: `${extractedData.wordCount} words extracted from body`,
        source: url,
        verifiedBy: 'Text Extractor',
        description: 'Body text content extracted',
      })
    );
  } catch (error: any) {
    evidence.push(
      buildEvidence({
        proof: null,
        source: url,
        description: `Content extraction error: ${error?.message ?? String(error)}`,
      })
    );
  }

  return { evidence, extractedData };
};
