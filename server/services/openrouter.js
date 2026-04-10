/**
 * analyzeUrlWithOpenRouter (JS)
 * Server-side only. Do not expose your OpenRouter key in the browser.
 */

/* If youre on Node < 18, uncomment:
// import fetch from "node-fetch";
*/

function stripJsonFences(s) {
  if (!s) return s;
  return String(s)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    visibility_score: { type: "integer", minimum: 0, maximum: 100 },
    ai_platform_scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        chatgpt: { type: "integer", minimum: 0, maximum: 100 },
        perplexity: { type: "integer", minimum: 0, maximum: 100 },
        google_ai: { type: "integer", minimum: 0, maximum: 100 },
        claude: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: ["chatgpt", "perplexity", "google_ai", "claude"],
    },
    recommendations: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
          category: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          impact: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          implementation: { type: "string" },
        },
        required: ["priority", "category", "title", "description", "impact", "difficulty", "implementation"],
      },
    },
    schema_markup: {
      type: "object",
      additionalProperties: false,
      properties: {
        json_ld_count: { type: "integer", minimum: 0 },
        has_organization_schema: { type: "boolean" },
        has_faq_schema: { type: "boolean" },
        schema_types: { type: "array", items: { type: "string" } },
      },
      required: ["json_ld_count", "has_organization_schema", "has_faq_schema", "schema_types"],
    },
    content_analysis: {
      type: "object",
      additionalProperties: false,
      properties: {
        word_count: { type: "integer", minimum: 0 },
        headings: {
          type: "object",
          additionalProperties: false,
          properties: {
            h1: { type: "integer", minimum: 0 },
            h2: { type: "integer", minimum: 0 },
            h3: { type: "integer", minimum: 0 },
          },
          required: ["h1", "h2", "h3"],
        },
        has_proper_h1: { type: "boolean" },
        faq_count: { type: "integer", minimum: 0 },
      },
      required: ["word_count", "headings", "has_proper_h1", "faq_count"],
    },
  },
  required: ["visibility_score", "ai_platform_scores", "recommendations", "schema_markup", "content_analysis"],
};

function buildAnalysisPrompt(url, scrapedData) {
  return `
You are an expert AI Visibility and LLM SEO consultant. Analyze the following REAL website data and provide actionable recommendations.

URL: ${url}
Title: ${scrapedData?.title ?? ""}
Description: ${scrapedData?.description ?? ""}
Language: ${scrapedData?.language ?? ""}
Word Count: ${scrapedData?.word_count ?? 0}

HEADING STRUCTURE:
H1 tags: ${scrapedData?.headings?.counts?.h1 ?? 0} (${(scrapedData?.headings?.h1 ?? []).slice(0, 3).join(", ")})
H2 tags: ${scrapedData?.headings?.counts?.h2 ?? 0}
H3 tags: ${scrapedData?.headings?.counts?.h3 ?? 0}
Proper H1: ${scrapedData?.has_proper_h1 ? "Yes" : "No"}

META TAGS:
Canonical: ${scrapedData?.canonical || "Not set"}
Robots: ${scrapedData?.robots || "Not set"}
Viewport: ${scrapedData?.viewport || "Not set"}

OPENGRAPH:
og:title: ${scrapedData?.open_graph?.title || "Missing"}
og:description: ${scrapedData?.open_graph?.description || "Missing"}
og:image: ${scrapedData?.open_graph?.image || "Missing"}
og:url: ${scrapedData?.open_graph?.url || "Missing"}
og:type: ${scrapedData?.open_graph?.type || "Missing"}

STRUCTURED DATA:
JSON-LD Count: ${scrapedData?.structured_data?.json_ld_count ?? 0}
Schema Types: ${(scrapedData?.structured_data?.schema_types ?? []).join(", ") || "None"}
FAQ Schema: ${scrapedData?.structured_data?.has_faq_schema ? "Present" : "Missing"}
Organization Schema: ${scrapedData?.structured_data?.has_organization_schema ? "Present" : "Missing"}

CONTENT STATS:
FAQ Count: ${scrapedData?.faq_count ?? 0}
Images: ${scrapedData?.image_count ?? 0}
Links: ${scrapedData?.link_count ?? 0}

Return strict JSON matching the schema. Be critical and honest.
`.trim();
}

async function handleApiResponse(res) {
  if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
    return { shouldRetry: true };
  }

  if (!res.ok) {
    let errPayload = null;
    try {
      errPayload = await res.json();
    } catch {}
    const msg = errPayload?.error?.message || errPayload?.message || `HTTP ${res.status}`;
    throw new Error(`OpenRouter API error: ${msg}`);
  }

  const payload = await res.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response content from OpenRouter API");

  const cleaned = stripJsonFences(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Model returned non-JSON output (failed to parse).");
  }

  return { shouldRetry: false, data: { ...parsed, analyzed_at: new Date().toISOString() } };
}

function shouldRetryError(error, attempt, maxAttempts) {
  if (attempt >= maxAttempts) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("AbortError") || msg.toLowerCase().includes("timeout");
}

function handleError(error) {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.toLowerCase().includes("api key")) {
    throw new Error("Invalid or missing OpenRouter API key. Check server env.");
  }
  if (msg.includes("quota") || msg.includes("429")) {
    throw new Error("API quota exceeded / rate limited. Try again later or add credits.");
  }
  throw new Error(`OpenRouter API error: ${msg || "Unknown error occurred"}`);
}

/**
 * @param {string} url
 * @param {string} apiKey
 * @param {Object} scrapedData
 * @returns {Promise<any>} AnalysisResponse
 */
export async function analyzeUrlWithOpenRouter(url, apiKey, scrapedData) {
  if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") {
    throw new Error("Valid OpenRouter API key is required. Set OPEN_ROUTER_API_KEY on the server.");
  }

  const analysisPrompt = buildAnalysisPrompt(url, scrapedData);
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://intruvurt.space",
            "X-Title": "AI Visible Engine",
          },
          body: JSON.stringify({
            model: "google/gemma-4-31b-it:free",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.3,
            max_tokens: 1200,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "AnalysisResult",
                strict: true,
                schema: RESPONSE_SCHEMA,
              },
            },
          }),
        },
        25_000
      );

      const result = await handleApiResponse(res);
      if (result.shouldRetry && attempt < maxAttempts) {
        await sleep(600 * attempt);
        continue;
      }

      if (result.data) return result.data;
    } catch (error) {
      if (shouldRetryError(error, attempt, maxAttempts)) {
        await sleep(600 * attempt);
        continue;
      }
      handleError(error);
    }
  }

  throw new Error("OpenRouter request failed after retries.");
}