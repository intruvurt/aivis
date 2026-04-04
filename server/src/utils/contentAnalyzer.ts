import { buildEvidence } from "./evidence.js";

/**
 * Stage 6: Content Clarity - Assess content structure and clarity
 */
export const analyzeContentClarity = (extractedData: any, url: string) => {
  const evidence = [];
  const contentData = {
    wordCount: extractedData.wordCount,
    headingStructure: { h1Count: 0, h2Count: 0, h3Count: 0, totalHeadings: 0 },
    thinContent: false,
    hasAbout: false,
    hasPricing: false,
    hasContact: false,
    entitySignals: []
  };

  try {
    // Analyze heading structure
    contentData.headingStructure.h1Count = extractedData.headings.h1.length;
    contentData.headingStructure.h2Count = extractedData.headings.h2.length;
    contentData.headingStructure.h3Count = extractedData.headings.h3.length;
    contentData.headingStructure.totalHeadings = Object.values(extractedData.headings).reduce((sum, arr) => sum + arr.length, 0);

    if (contentData.headingStructure.totalHeadings > 0) {
      evidence.push(buildEvidence({
        proof: `Heading structure: ${contentData.headingStructure.h1Count} H1, ${contentData.headingStructure.h2Count} H2, ${contentData.headingStructure.h3Count} H3`,
        source: url,
        verifiedBy: "Content Analyzer",
        description: "Page has structured heading hierarchy"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No heading structure found"
      }));
    }

    // Check for thin content
    if (extractedData.wordCount < 300) {
      contentData.thinContent = true;
      evidence.push(buildEvidence({
        proof: `Low word count: ${extractedData.wordCount} words`,
        source: url,
        verifiedBy: "Content Analyzer",
        description: "Page may have thin content (< 300 words)"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: `Adequate word count: ${extractedData.wordCount} words`,
        source: url,
        verifiedBy: "Content Analyzer",
        description: "Page has substantial content"
      }));
    }

    // Check for About section
    const aboutKeywords = /about|who we are|our story|our mission/i;
    const hasAboutInHeadings = Object.values(extractedData.headings).flat().some(h => aboutKeywords.test(h));
    const hasAboutInText = aboutKeywords.test(extractedData.bodyText);
    
    if (hasAboutInHeadings || hasAboutInText) {
      contentData.hasAbout = true;
      evidence.push(buildEvidence({
        proof: "About/company information section detected",
        source: url,
        verifiedBy: "Content Analyzer",
        description: "Page contains about/company information"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No about/company information section detected"
      }));
    }

    // Check for Pricing section
    const pricingKeywords = /pricing|plans|cost|price|subscription|buy now|purchase/i;
    const hasPricingInHeadings = Object.values(extractedData.headings).flat().some(h => pricingKeywords.test(h));
    const hasPricingInText = pricingKeywords.test(extractedData.bodyText);
    
    if (hasPricingInHeadings || hasPricingInText) {
      contentData.hasPricing = true;
      evidence.push(buildEvidence({
        proof: "Pricing information detected",
        source: url,
        verifiedBy: "Content Analyzer",
        description: "Page contains pricing/cost information"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No pricing information detected"
      }));
    }

    // Check for Contact section
    const contactKeywords = /contact|email|phone|address|get in touch|reach us/i;
    const hasContactInHeadings = Object.values(extractedData.headings).flat().some(h => contactKeywords.test(h));
    const hasContactInText = contactKeywords.test(extractedData.bodyText);
    const hasContactInMeta = extractedData.metaTags["contact"] || extractedData.metaTags["email"];
    
    if (hasContactInHeadings || hasContactInText || hasContactInMeta) {
      contentData.hasContact = true;
      evidence.push(buildEvidence({
        proof: "Contact information detected",
        source: url,
        verifiedBy: "Content Analyzer",
        description: "Page contains contact information"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No contact information detected"
      }));
    }

    // Extract entity signals from JSON-LD
    if (extractedData.jsonLd.length > 0) {
      extractedData.jsonLd.forEach(ld => {
        if (ld["@type"]) {
          contentData.entitySignals.push(ld["@type"]);
        }
        if (ld.name) {
          contentData.entitySignals.push(`Name: ${ld.name}`);
        }
      });
      
      evidence.push(buildEvidence({
        proof: `Entity signals from structured data: ${contentData.entitySignals.join(", ")}`,
        source: url,
        verifiedBy: "Schema Parser",
        description: "Entity information found in structured data"
      }));
    }

  } catch (error) {
    evidence.push(buildEvidence({
      proof: null,
      source: url,
      description: `Content analysis error: ${error.message}`
    }));
  }

  return { evidence, contentData };
};
