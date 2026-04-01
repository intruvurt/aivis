import axios from "axios";
import * as cheerio from "cheerio";

const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

function isValidIPv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

function isPrivateIPv4(host) {
  if (!isValidIPv4(host)) return false;
  const [a, b] = host.split(".").map(Number);

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isDisallowedIPv6(host) {
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local fc00::/7
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true; // link-local fe80::/10
  return false;
}

function normalizeCandidateUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("URL is required");

  const candidate = URL_SCHEME_RE.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Local addresses are not allowed");
  }
  if (host.includes(":") && isDisallowedIPv6(host)) {
    throw new Error("Local addresses are not allowed");
  }
  if (isPrivateIPv4(host)) {
    throw new Error("Private IP ranges are not allowed");
  }

  return url;
}

function safeText(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function safeLink(href) {
  const h = String(href ?? "").trim().toLowerCase();
  if (!h) return false;
  return !(h.startsWith("javascript:") || h.startsWith("data:"));
}

function extractSchemaTypes(jsonLdScripts) {
  const types = new Set();

  for (const schema of jsonLdScripts) {
    if (Array.isArray(schema)) {
      for (const s of schema) {
        if (s && typeof s === "object" && typeof s["@type"] === "string") types.add(s["@type"]);
      }
    } else if (schema && typeof schema === "object" && typeof schema["@type"] === "string") {
      types.add(schema["@type"]);
    }
  }

  return Array.from(types);
}

function hasSchemaType(jsonLdScripts, type) {
  return jsonLdScripts.some((schema) => {
    if (Array.isArray(schema)) {
      return schema.some((s) => s && typeof s === "object" && s["@type"] === type);
    }
    return schema && typeof schema === "object" && schema["@type"] === type;
  });
}

function countFaqLikeSections($) {
  // Heuristic: FAQ headings or FAQPage schema already handled elsewhere.
  const text = safeText($("body").text()).toLowerCase();
  const matches = text.match(/\bfaq\b/g);
  return matches ? Math.min(matches.length, 50) : 0;
}

/**
 * Scrapes a website and extracts SEO-relevant data (server-side only)
 * @param {string} inputUrl
 * @returns {Promise<{success:true,data:any} | {success:false,error:string,details?:string}>}
 */
export async function scrapeWebsite(inputUrl) {
  let urlObj;
  try {
    urlObj = normalizeCandidateUrl(inputUrl);
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return { success: false, error: "Invalid URL", details };
  }

  const url = urlObj.toString();
  const started = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      responseType: "text",
      transformResponse: [(d) => d],
      maxContentLength: 2 * 1024 * 1024,
      maxBodyLength: 2 * 1024 * 1024,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const responseTimeMs = Date.now() - started;

    const html = response.data ?? "";
    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        success: false,
        error: "URL does not return HTML content",
        details: `Content-Type: ${contentType || "unknown"}`,
      };
    }

    const $ = cheerio.load(html);

    // Meta tags
    const metaTags = {};
    $("meta").each((_, el) => {
      const name = $(el).attr("name") || $(el).attr("property");
      const content = $(el).attr("content");
      if (name && content) metaTags[name] = content;
    });

    // Canonical / robots / viewport
    const canonical = safeText($("link[rel='canonical']").attr("href")) || safeText(metaTags["og:url"]) || "";
    const robots = safeText(metaTags["robots"]) || "";
    const viewport = safeText(metaTags["viewport"]) || "";

    // Language
    const language = safeText($("html").attr("lang")) || safeText(metaTags["og:locale"]) || "";

    // JSON-LD
    const jsonLdScripts = [];
    $("script[type='application/ld+json']").each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      try {
        jsonLdScripts.push(JSON.parse(raw));
      } catch {
        // ignore malformed
      }
    });

    const schemaTypes = extractSchemaTypes(jsonLdScripts);

    // Headings
    const headings = { h1: [], h2: [], h3: [], counts: { h1: 0, h2: 0, h3: 0 } };
    $("h1").each((_, el) => headings.h1.push(safeText($(el).text())));
    $("h2").each((_, el) => headings.h2.push(safeText($(el).text())));
    $("h3").each((_, el) => headings.h3.push(safeText($(el).text())));
    headings.counts = { h1: headings.h1.length, h2: headings.h2.length, h3: headings.h3.length };

    const hasProperH1 = headings.h1.length === 1 && headings.h1[0].length > 0;

    // Text + word count
    const bodyText = safeText($("body").text());
    const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

    // Title / description
    const title = safeText($("title").text()) || safeText(metaTags["og:title"]) || safeText(metaTags["twitter:title"]) || "";
    const description =
      safeText(metaTags["description"]) || safeText(metaTags["og:description"]) || safeText(metaTags["twitter:description"]) || "";

    // OpenGraph
    const openGraph = {
      title: safeText(metaTags["og:title"]),
      description: safeText(metaTags["og:description"]),
      image: safeText(metaTags["og:image"]),
      url: safeText(metaTags["og:url"]),
      type: safeText(metaTags["og:type"]),
      site_name: safeText(metaTags["og:site_name"]),
    };

    // Twitter card
    const twitterCard = {
      card: safeText(metaTags["twitter:card"]),
      title: safeText(metaTags["twitter:title"]),
      description: safeText(metaTags["twitter:description"]),
      image: safeText(metaTags["twitter:image"]),
    };

    // Links / images
    let linkCount = 0;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href && safeLink(href)) linkCount += 1;
    });

    const imageCount = $("img").length;

    const structuredData = {
      json_ld_count: jsonLdScripts.length,
      has_faq_schema: hasSchemaType(jsonLdScripts, "FAQPage"),
      has_organization_schema: hasSchemaType(jsonLdScripts, "Organization"),
      schema_types: schemaTypes,
      schemas: jsonLdScripts,
    };

    const faqCount = structuredData.has_faq_schema ? 1 : countFaqLikeSections($);

    const data = {
      url,
      title,
      description,
      canonical,
      robots,
      language,
      viewport,
      word_count: wordCount,
      headings,
      meta_tags: metaTags,
      open_graph: openGraph,
      twitter_card: twitterCard,
      structured_data: structuredData,
      faq_count: faqCount,
      image_count: imageCount,
      link_count: linkCount,
      has_proper_h1: hasProperH1,
      response_time_ms: responseTimeMs,
      content_length: Buffer.byteLength(html, "utf8"),
      status_code: response.status,
    };

    return { success: true, data };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return { success: false, error: "Failed to fetch or parse website", details };
  }
}
