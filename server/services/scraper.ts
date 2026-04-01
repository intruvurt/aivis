import axios, { AxiosError } from "axios";
import * as cheerio from "cheerio";

export type JsonLd = unknown;

export type ScrapedData = {
  url: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  language: string;
  viewport: string;
  word_count: number;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    counts: { h1: number; h2: number; h3: number };
  };
  meta_tags: Record<string, string>;
  open_graph: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    site_name: string;
  };
  twitter_card: {
    card: string;
    title: string;
    description: string;
    image: string;
  };
  structured_data: {
    json_ld_count: number;
    has_faq_schema: boolean;
    has_organization_schema: boolean;
    schema_types: string[];
    schemas: JsonLd[];
  };
  faq_count: number;
  image_count: number;
  link_count: number;
  has_proper_h1: boolean;
  response_time_ms: number;
  content_length: number;
  status_code: number;
};

export type ScrapeResult =
  | { success: true; data: ScrapedData }
  | { success: false; error: string; details?: string; code?: string };

// Configuration constants
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB (increased from 2MB)
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

// Validation helpers
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

function isPrivateIPv4(host: string): boolean {
  if (!isValidIPv4(host)) return false;
  const [a, b] = host.split(".").map(Number);

  // Private ranges per RFC 1918 + special use
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 0) return true; // 0.0.0.0/8 (current network)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a >= 224 && a <= 239) return true; // 224.0.0.0/4 (multicast)
  if (a >= 240) return true; // 240.0.0.0/4 (reserved)

  return false;
}

function isDisallowedIPv6(host: string): boolean {
  const h = host.toLowerCase();
  
  // Loopback and unspecified
  if (h === "::1" || h === "::") return true;
  
  // Unique local addresses fc00::/7
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  
  // Link-local fe80::/10
  if (h.startsWith("fe8") || h.startsWith("fe9") || 
      h.startsWith("fea") || h.startsWith("feb")) return true;
  
  // Multicast ff00::/8
  if (h.startsWith("ff")) return true;
  
  return false;
}

/**
 * Normalizes and validates URL, ensuring it's safe to fetch
 * @throws Error with descriptive message if URL is invalid
 */
function normalizeCandidateUrl(input: string): URL {
  const raw = (input ?? "").trim();
  
  if (!raw) {
    throw new Error("URL is required");
  }

  if (raw.length > 2048) {
    throw new Error("URL is too long (max 2048 characters)");
  }

  // Add https:// if no scheme provided
  const candidate = URL_SCHEME_RE.test(raw) ? raw : `https://${raw}`;
  
  let url: URL;
  try {
    url = new URL(candidate);
  } catch (error) {
    throw new Error("Malformed URL");
  }

  // Only allow HTTP/HTTPS
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https protocols are allowed");
  }

  const host = url.hostname.toLowerCase();

  // Block localhost variants
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Local addresses are not allowed");
  }

  // Block private IPv4 ranges
  if (isPrivateIPv4(host)) {
    throw new Error("Private IP addresses are not allowed");
  }

  // Block disallowed IPv6 ranges
  if (host.includes(":") && isDisallowedIPv6(host)) {
    throw new Error("Private or reserved IPv6 addresses are not allowed");
  }

  // Block common metadata endpoints
  const blockedPaths = [
    "/169.254.169.254", // AWS metadata
    "metadata.google.internal", // GCP metadata
  ];
  
  const urlStr = url.toString().toLowerCase();
  for (const blocked of blockedPaths) {
    if (urlStr.includes(blocked)) {
      throw new Error("Metadata endpoints are not allowed");
    }
  }

  return url;
}

/**
 * Converts relative URL to absolute
 */
function absUrl(base: string, maybeRelative: string): string {
  if (!maybeRelative) return "";
  
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

/**
 * Checks if a link is safe (not javascript: or data:)
 */
function safeLink(href: string): boolean {
  if (!href) return false;
  
  const h = href.trim().toLowerCase();
  if (!h) return false;
  
  // Block dangerous schemes
  const dangerousSchemes = ["javascript:", "data:", "vbscript:", "file:"];
  return !dangerousSchemes.some(scheme => h.startsWith(scheme));
}

/**
 * Extracts all @type values from JSON-LD schemas
 */
function extractSchemaTypes(schemas: JsonLd[]): string[] {
  const types = new Set<string>();

  const addType = (t: unknown) => {
    if (typeof t === "string") {
      types.add(t);
    } else if (Array.isArray(t)) {
      for (const x of t) {
        if (typeof x === "string") types.add(x);
      }
    }
  };

  const walk = (node: unknown, depth = 0) => {
    // Prevent infinite recursion
    if (depth > 10) return;
    if (!node) return;

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, depth + 1);
      }
      return;
    }

    if (isRecord(node)) {
      addType(node["@type"]);
      
      // Common schema.org graph properties
      if (node["@graph"]) walk(node["@graph"], depth + 1);
      if (node["mainEntity"]) walk(node["mainEntity"], depth + 1);
      if (node["about"]) walk(node["about"], depth + 1);
      if (node["author"]) walk(node["author"], depth + 1);
      if (node["publisher"]) walk(node["publisher"], depth + 1);
    }
  };

  for (const schema of schemas) {
    walk(schema);
  }

  return Array.from(types).sort();
}

/**
 * Checks if schemas contain a specific type
 */
function hasSchemaType(schemas: JsonLd[], type: string): boolean {
  return extractSchemaTypes(schemas).includes(type);
}

/**
 * Counts FAQ questions in schema.org FAQPage structured data
 */
function countFaqQuestions(schemas: JsonLd[]): number {
  let count = 0;

  const walk = (node: unknown, depth = 0) => {
    if (depth > 10) return; // Prevent infinite recursion
    if (!node) return;

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, depth + 1);
      }
      return;
    }

    if (isRecord(node)) {
      const t = node["@type"];
      const types = Array.isArray(t) ? t : typeof t === "string" ? [t] : [];
      
      if (types.includes("FAQPage")) {
        const main = node["mainEntity"];
        if (Array.isArray(main)) {
          count += main.length;
        }
      }
      
      // Recurse into common properties
      if (node["@graph"]) walk(node["@graph"], depth + 1);
      if (node["mainEntity"]) walk(node["mainEntity"], depth + 1);
    }
  };

  for (const schema of schemas) {
    walk(schema);
  }
  
  return count;
}

/**
 * Safely extracts text content with size limits
 */
function safeTextExtract($: cheerio.CheerioAPI, selector: string, maxLength = 10000): string {
  try {
    const text = $(selector).text().replace(/\s+/g, " ").trim();
    return text.length > maxLength ? text.substring(0, maxLength) : text;
  } catch {
    return "";
  }
}

/**
 * Determines error code based on error type
 */
function categorizeError(error: unknown): { code: string; message: string } {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    if (axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT") {
      return { code: "TIMEOUT", message: "Request timed out" };
    }
    
    if (axiosError.code === "ENOTFOUND" || axiosError.code === "EAI_AGAIN") {
      return { code: "DNS_ERROR", message: "Could not resolve hostname" };
    }
    
    if (axiosError.code === "ECONNREFUSED") {
      return { code: "CONNECTION_REFUSED", message: "Connection refused" };
    }
    
    if (axiosError.code === "ERR_BAD_REQUEST") {
      return { code: "BAD_REQUEST", message: "Invalid request" };
    }

    if (axiosError.message?.includes("maxContentLength")) {
      return { code: "CONTENT_TOO_LARGE", message: "Response content exceeds size limit" };
    }

    if (axiosError.message?.includes("Network Error")) {
      return { code: "NETWORK_ERROR", message: "Network error occurred" };
    }
  }

  if (error instanceof Error) {
    return { code: "UNKNOWN_ERROR", message: error.message };
  }

  return { code: "UNKNOWN_ERROR", message: String(error) };
}

/**
 * Scrapes a website and extracts SEO/AI-visibility relevant data
 * Server-side only - uses axios and cheerio
 * 
 * @param inputUrl - URL to scrape (with or without protocol)
 * @returns ScrapeResult with success/failure and data/error
 */
export async function scrapeWebsite(inputUrl: string): Promise<ScrapeResult> {
  // Validate and normalize URL
  let urlObj: URL;
  try {
    urlObj = normalizeCandidateUrl(inputUrl);
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return { 
      success: false, 
      error: "Invalid URL", 
      details,
      code: "INVALID_URL" 
    };
  }

  const requestedUrl = urlObj.toString();
  const started = Date.now();

  try {
    // Make HTTP request with security settings
    const response = await axios.get<string>(requestedUrl, {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      responseType: "text",
      transformResponse: [(data) => data], // Prevent auto-parsing
      maxContentLength: MAX_CONTENT_SIZE,
      maxBodyLength: MAX_CONTENT_SIZE,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
      validateStatus: () => true, // Handle all status codes manually
      decompress: true, // Automatically decompress
    });

    const response_time_ms = Date.now() - started;
    const status_code = response.status;
    const html = response.data ?? "";
    const content_length = Buffer.byteLength(html, "utf8");

    // Validate content type
    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    if (!contentType.includes("text/html") && 
        !contentType.includes("application/xhtml") &&
        !contentType.includes("text/plain")) {
      return {
        success: false,
        error: "URL does not return HTML content",
        details: `Status: ${status_code}. Content-Type: ${contentType || "unknown"}`,
        code: "INVALID_CONTENT_TYPE",
      };
    }

    // Check HTTP status
    if (status_code < 200 || status_code >= 300) {
      return { 
        success: false, 
        error: "Non-OK HTTP status", 
        details: `Status: ${status_code}`,
        code: "HTTP_ERROR",
      };
    }

    // Check for empty response
    if (!html || html.trim().length === 0) {
      return {
        success: false,
        error: "Empty response received",
        code: "EMPTY_RESPONSE",
      };
    }

    // Determine final URL after redirects
    const finalUrl =
      (response.request as any)?.res?.responseUrl ||
      (response.request as any)?.responseUrl ||
      requestedUrl;

    // Parse HTML with cheerio
    let $: cheerio.CheerioAPI;
    try {
      $ = cheerio.load(html, {
        xml: false,
      });
    } catch (parseError) {
      return {
        success: false,
        error: "Failed to parse HTML",
        details: parseError instanceof Error ? parseError.message : "Unknown parse error",
        code: "PARSE_ERROR",
      };
    }

    // Extract basic metadata
    const language = String($("html").attr("lang") || "").trim();
    const viewport = String($('meta[name="viewport"]').attr("content") || "").trim();

    // Robots directives
    const robotsMeta = String($('meta[name="robots"]').attr("content") || "").trim();
    const robotsHeader = String(response.headers["x-robots-tag"] || "").trim();
    const robots = robotsMeta || robotsHeader || "";

    // Canonical URL
    const canonicalRaw = String($('link[rel="canonical"]').attr("href") || "").trim();
    const canonical = canonicalRaw ? absUrl(finalUrl, canonicalRaw) : "";

    // Extract all meta tags
    const meta_tags: Record<string, string> = {};
    $("meta").each((_, el) => {
      const $el = $(el);
      const name = ($el.attr("name") || $el.attr("property") || "").trim();
      const content = ($el.attr("content") || "").trim();
      if (name && content) {
        meta_tags[name] = content;
      }
    });

    // Extract JSON-LD structured data
    const schemas: JsonLd[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text().trim();
      if (!raw) return;
      
      try {
        const parsed = JSON.parse(raw);
        schemas.push(parsed as JsonLd);
      } catch (jsonError) {
        // Ignore malformed JSON-LD
        console.warn("Malformed JSON-LD detected:", jsonError);
      }
    });

    const schema_types = extractSchemaTypes(schemas);
    const has_faq_schema = hasSchemaType(schemas, "FAQPage");
    const has_organization_schema = hasSchemaType(schemas, "Organization");

    // Extract headings
    const h1: string[] = [];
    const h2: string[] = [];
    const h3: string[] = [];

    $("h1").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text && text.length <= 500) { // Reasonable heading length
        h1.push(text);
      }
    });

    $("h2").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text && text.length <= 500) {
        h2.push(text);
      }
    });

    $("h3").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text && text.length <= 500) {
        h3.push(text);
      }
    });

    const headings = {
      h1: h1.slice(0, 10), // Limit to first 10
      h2: h2.slice(0, 20),
      h3: h3.slice(0, 30),
      counts: { h1: h1.length, h2: h2.length, h3: h3.length },
    };

    const has_proper_h1 = h1.length === 1 && h1[0].length > 0;

    // Count images with src attribute
    const image_count = $("img").filter((_, el) => {
      const src = String($(el).attr("src") || "").trim();
      return !!src && safeLink(src);
    }).length;

    // Count valid links
    const link_count = $("a").filter((_, el) => {
      const href = String($(el).attr("href") || "");
      return safeLink(href);
    }).length;

    // Count FAQ questions from structured data
    const faq_count = Math.max(countFaqQuestions(schemas), 0);

    // Extract body text and calculate word count
    const bodyText = safeTextExtract($, "body", 100000); // Max 100k chars
    const word_count = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

    // Extract title with fallbacks
    const title = $("title").text().trim() || 
                  meta_tags["og:title"] || 
                  meta_tags["twitter:title"] || 
                  "";

    // Extract description with fallbacks
    const description = meta_tags["description"] || 
                        meta_tags["og:description"] || 
                        meta_tags["twitter:description"] || 
                        "";

    // Open Graph metadata
    const open_graph = {
      title: meta_tags["og:title"] || title || "",
      description: meta_tags["og:description"] || description || "",
      image: meta_tags["og:image"] ? absUrl(finalUrl, meta_tags["og:image"]) : "",
      url: meta_tags["og:url"] ? absUrl(finalUrl, meta_tags["og:url"]) : finalUrl,
      type: meta_tags["og:type"] || "",
      site_name: meta_tags["og:site_name"] || "",
    };

    // Twitter Card metadata
    const twitter_card = {
      card: meta_tags["twitter:card"] || "",
      title: meta_tags["twitter:title"] || title || "",
      description: meta_tags["twitter:description"] || description || "",
      image: meta_tags["twitter:image"] ? absUrl(finalUrl, meta_tags["twitter:image"]) : "",
    };

    // Assemble final data object
    const data: ScrapedData = {
      url: finalUrl,
      title,
      description,
      canonical,
      robots,
      language,
      viewport,
      word_count,
      headings,
      meta_tags,
      open_graph,
      twitter_card,
      structured_data: {
        json_ld_count: schemas.length,
        has_faq_schema,
        has_organization_schema,
        schema_types,
        schemas,
      },
      faq_count,
      image_count,
      link_count,
      has_proper_h1,
      response_time_ms,
      content_length,
      status_code,
    };

    return { success: true, data };

  } catch (error: unknown) {
    const { code, message } = categorizeError(error);
    const details = error instanceof Error ? error.message : String(error);

    console.error(`Scrape error [${code}]:`, details);

    return { 
      success: false, 
      error: message,
      details,
      code,
    };
  }
}