import * as cheerio from "cheerio";
import { buildEvidence } from "./evidence.js";

/**
 * Stage 4: Extraction - Extract all relevant signals from HTML
 */
export const extractContent = (html: string, url: string) => {
  const evidence = [];
  const extractedData = {
    metaTags: {},
    title: null,
    headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
    jsonLd: [],
    links: { canonical: null, alternate: [], internal: 0, external: 0 },
    bodyText: null,
    wordCount: 0
  };

  try {
    const $ = cheerio.load(html);

    // Extract title
    extractedData.title = $("title").text().trim();
    if (extractedData.title) {
      evidence.push(buildEvidence({
        proof: `Title: "${extractedData.title}"`,
        source: url,
        verifiedBy: "HTML Parser",
        description: "Page title extracted"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No title tag found"
      }));
    }

    // Extract meta tags
    $("meta").each((i, elem) => {
      const name = $(elem).attr("name") || $(elem).attr("property");
      const content = $(elem).attr("content");
      if (name && content) {
        extractedData.metaTags[name] = content;
      }
    });

    if (Object.keys(extractedData.metaTags).length > 0) {
      evidence.push(buildEvidence({
        proof: `${Object.keys(extractedData.metaTags).length} meta tags found`,
        source: url,
        verifiedBy: "HTML Parser",
        description: `Meta tags: ${Object.keys(extractedData.metaTags).join(", ")}`
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No meta tags found"
      }));
    }

    // Extract headings
    ["h1", "h2", "h3", "h4", "h5", "h6"].forEach(tag => {
      $(tag).each((i, elem) => {
        const text = $(elem).text().trim();
        if (text) {
          extractedData.headings[tag].push(text);
        }
      });
    });

    const totalHeadings = Object.values(extractedData.headings).reduce((sum, arr) => sum + arr.length, 0);
    if (totalHeadings > 0) {
      evidence.push(buildEvidence({
        proof: `${totalHeadings} headings found (H1: ${extractedData.headings.h1.length}, H2: ${extractedData.headings.h2.length}, H3: ${extractedData.headings.h3.length})`,
        source: url,
        verifiedBy: "HTML Parser",
        description: "Heading structure extracted"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No headings found"
      }));
    }

    // Extract JSON-LD
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const jsonLd = JSON.parse($(elem).html());
        extractedData.jsonLd.push(jsonLd);
      } catch (e) {
        // Invalid JSON-LD, skip
      }
    });

    if (extractedData.jsonLd.length > 0) {
      evidence.push(buildEvidence({
        proof: `${extractedData.jsonLd.length} JSON-LD block(s) found`,
        source: url,
        verifiedBy: "JSON Parser",
        description: `Schema types: ${extractedData.jsonLd.map(ld => ld["@type"] || "Unknown").join(", ")}`
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No JSON-LD structured data found"
      }));
    }

    // Extract canonical link
    const canonical = $('link[rel="canonical"]').attr("href");
    if (canonical) {
      extractedData.links.canonical = canonical;
      evidence.push(buildEvidence({
        proof: `Canonical URL: ${canonical}`,
        source: url,
        verifiedBy: "HTML Parser",
        description: "Canonical link tag found"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No canonical link tag found"
      }));
    }

    // Extract alternate links
    $('link[rel="alternate"]').each((i, elem) => {
      const href = $(elem).attr("href");
      const hreflang = $(elem).attr("hreflang");
      if (href) {
        extractedData.links.alternate.push({ href, hreflang });
      }
    });

    if (extractedData.links.alternate.length > 0) {
      evidence.push(buildEvidence({
        proof: `${extractedData.links.alternate.length} alternate link(s) found`,
        source: url,
        verifiedBy: "HTML Parser",
        description: "Alternate/hreflang links present"
      }));
    }

    // Count links
    $("a[href]").each((i, elem) => {
      const href = $(elem).attr("href");
      if (href) {
        if (href.startsWith("http://") || href.startsWith("https://")) {
          if (href.includes(new URL(url).hostname)) {
            extractedData.links.internal++;
          } else {
            extractedData.links.external++;
          }
        } else if (href.startsWith("/")) {
          extractedData.links.internal++;
        }
      }
    });

    evidence.push(buildEvidence({
      proof: `Links: ${extractedData.links.internal} internal, ${extractedData.links.external} external`,
      source: url,
      verifiedBy: "HTML Parser",
      description: "Link structure analyzed"
    }));

    // Extract body text
    $("script, style, noscript").remove();
    extractedData.bodyText = $("body").text().replace(/\s+/g, " ").trim();
    extractedData.wordCount = extractedData.bodyText.split(/\s+/).length;

    evidence.push(buildEvidence({
      proof: `${extractedData.wordCount} words extracted from body`,
      source: url,
      verifiedBy: "Text Extractor",
      description: "Body text content extracted"
    }));

  } catch (error) {
    evidence.push(buildEvidence({
      proof: null,
      source: url,
      description: `Content extraction error: ${error.message}`
    }));
  }

  return { evidence, extractedData };
};
