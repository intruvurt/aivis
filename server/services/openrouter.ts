import type { AnalysisResponse } from "../src/types";
import type { ScrapedData } from "./scraper";
import { callAIProvider } from "./aiProviders";

function buildPrompt(url: string, scraped: ScrapedData): string {
  return `You are an AI visibility analyst.\nReturn strictly valid JSON for an AnalysisResponse object.\n\nURL: ${url}\n\nScraped data:\n${JSON.stringify(scraped ?? {}, null, 2)}`;
}

export async function geminiFreeViaOpenRouter(
  prompt: string,
  apiKey: string,
  opts: { timeoutMs?: number; maxAttempts?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 25000;
  const maxAttempts = opts.maxAttempts ?? 2;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = await callAIProvider({
        provider: "openrouter",
        model: "google/gemma-4-31b-it:free",
        prompt,
        apiKey,
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        timeoutMs,
      });

      if (typeof output === "string" && output.trim()) {
        return output;
      }
      throw new Error("OpenRouter returned empty content");
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  const lastErrorMessage =
    lastError instanceof Error
      ? lastError.message
      : typeof lastError === 'string'
        ? lastError
        : 'unknown';
  throw new Error(`OpenRouter request failed: ${lastErrorMessage}`);
}

export async function analyzeUrlWithOpenRouter(
  url: string,
  scraped: ScrapedData,
  apiKey: string,
): Promise<AnalysisResponse> {
  const raw = await geminiFreeViaOpenRouter(buildPrompt(url, scraped), apiKey, {
    maxAttempts: 2,
    timeoutMs: 22000,
  });

  const parsed = JSON.parse(raw) as AnalysisResponse;
  return parsed;
}

export async function analyzeUrlWithPipeline(
  url: string,
  scraped: ScrapedData,
  apiKey: string,
): Promise<AnalysisResponse> {
  return analyzeUrlWithOpenRouter(url, scraped, apiKey);
}
