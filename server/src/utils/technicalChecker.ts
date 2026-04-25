import { buildEvidence } from "./evidence.js";

/**
 * Stage 5: Technical Checks - Evaluate technical SEO signals
 */
type TechnicalData = {
  canonical: { present: boolean; correct: boolean };
  redirects: { hasRedirects: boolean; count: number };
  https: { enforced: boolean };
  compression: { enabled: boolean };
  caching: { configured: boolean };
  viewport: { present: boolean };
  hreflang: { present: boolean; count: number };
  openGraph: { present: boolean; tags: string[] };
  twitterCards: { present: boolean; tags: string[] };
  schema: { present: boolean; types: string[] };
};

export const performTechnicalChecks = (crawlData: any, extractedData: any, url: string) => {
  const evidence: unknown[] = [];
  const technicalData: TechnicalData = {
    canonical: { present: false, correct: false },
    redirects: { hasRedirects: false, count: 0 },
    https: { enforced: false },
    compression: { enabled: false },
    caching: { configured: false },
    viewport: { present: false },
    hreflang: { present: false, count: 0 },
    openGraph: { present: false, tags: [] },
    twitterCards: { present: false, tags: [] },
    schema: { present: false, types: [] }
  };

  try {
    // Check canonical correctness
    if (extractedData.links.canonical) {
      technicalData.canonical.present = true;
      const parsedUrl = new URL(url);
      const parsedCanonical = new URL(extractedData.links.canonical, url);
      
      if (parsedCanonical.href === parsedUrl.href) {
        technicalData.canonical.correct = true;
        evidence.push(buildEvidence({
          proof: `Canonical URL matches current URL: ${extractedData.links.canonical}`,
          source: url,
          verifiedBy: "Canonical Validator",
          description: "Canonical link is correctly self-referencing"
        }));
      } else {
        evidence.push(buildEvidence({
          proof: `Canonical URL differs: ${extractedData.links.canonical}`,
          source: url,
          verifiedBy: "Canonical Validator",
          description: "Canonical link points to different URL"
        }));
      }
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No canonical link tag present"
      }));
    }

    // Check redirect consistency
    if (crawlData.redirectChain && crawlData.redirectChain.length > 0) {
      technicalData.redirects.hasRedirects = true;
      technicalData.redirects.count = crawlData.redirectChain[0].count;
      evidence.push(buildEvidence({
        proof: `${technicalData.redirects.count} redirect(s) in chain`,
        source: url,
        verifiedBy: "HTTP Client",
        description: `Final URL: ${crawlData.redirectChain[0].finalUrl}`
      }));
    } else {
      evidence.push(buildEvidence({
        proof: "No redirects detected",
        source: url,
        verifiedBy: "HTTP Client",
        description: "Page loads directly without redirects"
      }));
    }

    // Check HTTPS enforcement
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === "https:") {
      technicalData.https.enforced = true;
      evidence.push(buildEvidence({
        proof: "HTTPS protocol in use",
        source: url,
        verifiedBy: "Protocol Checker",
        description: "Site uses secure HTTPS connection"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "Site not using HTTPS"
      }));
    }

    // Check compression
    if (crawlData.headers["content-encoding"]) {
      technicalData.compression.enabled = true;
      evidence.push(buildEvidence({
        proof: `Compression enabled: ${crawlData.headers["content-encoding"]}`,
        source: url,
        verifiedBy: "HTTP Headers",
        description: "Content compression is active"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No content-encoding header found"
      }));
    }

    // Check cache headers
    if (crawlData.headers["cache-control"] || crawlData.headers["expires"]) {
      technicalData.caching.configured = true;
      evidence.push(buildEvidence({
        proof: `Cache headers present: ${crawlData.headers["cache-control"] || crawlData.headers["expires"]}`,
        source: url,
        verifiedBy: "HTTP Headers",
        description: "Caching directives configured"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No cache-control or expires headers found"
      }));
    }

    // Check viewport meta
    if (extractedData.metaTags["viewport"]) {
      technicalData.viewport.present = true;
      evidence.push(buildEvidence({
        proof: `Viewport meta: ${extractedData.metaTags["viewport"]}`,
        source: url,
        verifiedBy: "Meta Tag Parser",
        description: "Mobile viewport configured"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No viewport meta tag found"
      }));
    }

    // Check hreflang
    if (extractedData.links.alternate.length > 0) {
      technicalData.hreflang.present = true;
      technicalData.hreflang.count = extractedData.links.alternate.length;
      evidence.push(buildEvidence({
        proof: `${technicalData.hreflang.count} hreflang alternate(s) found`,
        source: url,
        verifiedBy: "Link Parser",
        description: "International/alternate versions declared"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No hreflang alternate links found"
      }));
    }

    // Check Open Graph tags
    const ogTags = Object.keys(extractedData.metaTags).filter(key => key.startsWith("og:"));
    if (ogTags.length > 0) {
      technicalData.openGraph.present = true;
      technicalData.openGraph.tags = ogTags;
      evidence.push(buildEvidence({
        proof: `${ogTags.length} Open Graph tag(s): ${ogTags.join(", ")}`,
        source: url,
        verifiedBy: "Meta Tag Parser",
        description: "Open Graph metadata present for social sharing"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No Open Graph tags found"
      }));
    }

    // Check Twitter Cards
    const twitterTags = Object.keys(extractedData.metaTags).filter(key => key.startsWith("twitter:"));
    if (twitterTags.length > 0) {
      technicalData.twitterCards.present = true;
      technicalData.twitterCards.tags = twitterTags;
      evidence.push(buildEvidence({
        proof: `${twitterTags.length} Twitter Card tag(s): ${twitterTags.join(", ")}`,
        source: url,
        verifiedBy: "Meta Tag Parser",
        description: "Twitter Card metadata present"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No Twitter Card tags found"
      }));
    }

    // Check Schema/JSON-LD
    if (extractedData.jsonLd.length > 0) {
      technicalData.schema.present = true;
      technicalData.schema.types = extractedData.jsonLd.map((ld: Record<string, unknown>) => String(ld["@type"] || "Unknown"));
      evidence.push(buildEvidence({
        proof: `${extractedData.jsonLd.length} schema block(s): ${technicalData.schema.types.join(", ")}`,
        source: url,
        verifiedBy: "JSON-LD Parser",
        description: "Structured data present"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "No structured data (JSON-LD) found"
      }));
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    evidence.push(buildEvidence({
      proof: null,
      source: url,
      description: `Technical checks error: ${message}`
    }));
  }

  return { evidence, technicalData };
};
