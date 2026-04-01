import { buildEvidence } from './evidenceUtils.js';

type HeadingsMap = Record<string, string[]>;

type ExtractedData = {
  wordCount: number;
  headings?: HeadingsMap | null;
  bodyText?: string | null;
  metaTags?: Record<string, any> | null;
  jsonLd?: any[] | null;
};

type ContentData = {
  wordCount: number;
  headingStructure: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    totalHeadings: number;
  };
  thinContent: boolean;
  hasAbout: boolean;
  hasPricing: boolean;
  hasContact: boolean;
  entitySignals: string[];
};

/**
 * Stage 6: Content Clarity - Assess content structure and clarity
 */
export const analyzeContentClarity = (extractedData: ExtractedData, url: string) => {
  const evidence: Array<ReturnType<typeof buildEvidence>> = [];

  const headings: HeadingsMap = (
    extractedData.headings && typeof extractedData.headings === 'object'
      ? extractedData.headings
      : {}
  ) as HeadingsMap;

  const bodyText = String(extractedData.bodyText ?? '');
  const metaTags = (
    extractedData.metaTags && typeof extractedData.metaTags === 'object'
      ? extractedData.metaTags
      : {}
  ) as Record<string, any>;

  const jsonLd = Array.isArray(extractedData.jsonLd) ? extractedData.jsonLd : [];

  const contentData: ContentData = {
    wordCount: Number(extractedData.wordCount ?? 0),
    headingStructure: { h1Count: 0, h2Count: 0, h3Count: 0, totalHeadings: 0 },
    thinContent: false,
    hasAbout: false,
    hasPricing: false,
    hasContact: false,
    entitySignals: [],
  };

  try {
    const h1 = Array.isArray(headings.h1) ? headings.h1 : [];
    const h2 = Array.isArray(headings.h2) ? headings.h2 : [];
    const h3 = Array.isArray(headings.h3) ? headings.h3 : [];

    contentData.headingStructure.h1Count = h1.length;
    contentData.headingStructure.h2Count = h2.length;
    contentData.headingStructure.h3Count = h3.length;

    const allHeadingArrays = Object.values(headings).filter(Array.isArray) as string[][];
    contentData.headingStructure.totalHeadings = allHeadingArrays.reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    if (contentData.headingStructure.totalHeadings > 0) {
      evidence.push(
        buildEvidence({
          proof: `Heading structure: ${contentData.headingStructure.h1Count} H1, ${contentData.headingStructure.h2Count} H2, ${contentData.headingStructure.h3Count} H3`,
          source: url,
          verifiedBy: 'Content Analyzer',
          description: 'Page has structured heading hierarchy',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No heading structure found',
        })
      );
    }

    if (contentData.wordCount < 300) {
      contentData.thinContent = true;
      evidence.push(
        buildEvidence({
          proof: `Low word count: ${contentData.wordCount} words`,
          source: url,
          verifiedBy: 'Content Analyzer',
          description: 'Page may have thin content (< 300 words)',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: `Adequate word count: ${contentData.wordCount} words`,
          source: url,
          verifiedBy: 'Content Analyzer',
          description: 'Page has substantial content',
        })
      );
    }

    const flatHeadings = allHeadingArrays.flat().map((h) => String(h));

    const aboutKeywords = /about|who we are|our story|our mission/i;
    const hasAboutInHeadings = flatHeadings.some((h) => aboutKeywords.test(h));
    const hasAboutInText = aboutKeywords.test(bodyText);

    if (hasAboutInHeadings || hasAboutInText) {
      contentData.hasAbout = true;
      evidence.push(
        buildEvidence({
          proof: 'About/company information section detected',
          source: url,
          verifiedBy: 'Content Analyzer',
          description: 'Page contains about/company information',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No about/company information section detected',
        })
      );
    }

    const pricingKeywords = /pricing|plans|cost|price|subscription|buy now|purchase/i;
    const hasPricingInHeadings = flatHeadings.some((h) => pricingKeywords.test(h));
    const hasPricingInText = pricingKeywords.test(bodyText);

    if (hasPricingInHeadings || hasPricingInText) {
      contentData.hasPricing = true;
      evidence.push(
        buildEvidence({
          proof: 'Pricing information detected',
          source: url,
          verifiedBy: 'Content Analyzer',
          description: 'Page contains pricing/cost information',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No pricing information detected',
        })
      );
    }

    const contactKeywords = /contact|email|phone|address|get in touch|reach us/i;
    const hasContactInHeadings = flatHeadings.some((h) => contactKeywords.test(h));
    const hasContactInText = contactKeywords.test(bodyText);
    const hasContactInMeta = Boolean(metaTags['contact'] || metaTags['email']);

    if (hasContactInHeadings || hasContactInText || hasContactInMeta) {
      contentData.hasContact = true;
      evidence.push(
        buildEvidence({
          proof: 'Contact information detected',
          source: url,
          verifiedBy: 'Content Analyzer',
          description: 'Page contains contact information',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'No contact information detected',
        })
      );
    }

    if (jsonLd.length > 0) {
      for (const ld of jsonLd) {
        if (ld && typeof ld === 'object') {
          if (ld['@type']) contentData.entitySignals.push(String(ld['@type']));
          if (ld.name) contentData.entitySignals.push(`Name: ${String(ld.name)}`);
        }
      }

      if (contentData.entitySignals.length > 0) {
        evidence.push(
          buildEvidence({
            proof: `Entity signals from structured data: ${contentData.entitySignals.join(', ')}`,
            source: url,
            verifiedBy: 'Schema Parser',
            description: 'Entity information found in structured data',
          })
        );
      }
    }
  } catch (error: any) {
    evidence.push(
      buildEvidence({
        proof: null,
        source: url,
        description: `Content analysis error: ${error?.message ?? String(error)}`,
      })
    );
  }

  return { evidence, contentData };
};
