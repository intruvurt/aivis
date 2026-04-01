// server/lib/llm.ts
type Role = "system" | "user" | "assistant";
export type ChatMessage = { role: Role; content: string };

type Provider = "openrouter" | "ollama";

type ChatOpts = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 45_000;

function withTimeout(ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(t) };
}

function baseUrlFor(provider: Provider): string {
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  const raw = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  return raw.replace(/\/$/, "") + "/v1";
}

function modelFor(provider: Provider): string {
  if (provider === "openrouter")
    return process.env.OPEN_ROUTER_MODEL || "openai/gpt-4o-mini";
  return process.env.OLLAMA_MODEL || "llama3.1:8b";
}

function headersFor(provider: Provider): Record<string, string> {
  if (provider === "openrouter") {
    const key = process.env.OPEN_ROUTER_API_KEY;
    if (!key) throw new Error("Missing OPEN_ROUTER_API_KEY");
    return {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // optional attribution headers
      ...(process.env.OPEN_ROUTER_SITE_URL
        ? { "HTTP-Referer": process.env.OPEN_ROUTER_SITE_URL }
        : {}),
      ...(process.env.OPEN_ROUTER_APP_NAME
        ? { "X-Title": process.env.OPEN_ROUTER_APP_NAME }
        : {}),
    };
  }

  // Ollama OpenAI-compat: api_key required by some SDKs but ignored by Ollama
  return {
    Authorization: "Bearer ollama",
    "Content-Type": "application/json",
  };
}

// Quick reachability check for auto mode (fast fail)
async function canReach(url: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const { controller, clear } = withTimeout(timeoutMs);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clear();
    return res.ok || res.status === 404; // ollama may 404 root but still be up
  } catch {
    return false;
  }
}

export async function pickProvider(): Promise<Provider> {
  const pref = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (pref === "openrouter") return "openrouter";
  if (pref === "ollama") return "ollama";

  // auto: try ollama, else openrouter
  const ollamaHealth = (
    process.env.OLLAMA_BASE_URL || "http://localhost:11434"
  ).replace(/\/$/, "");
  const ok = await canReach(ollamaHealth);
  return ok ? "ollama" : "openrouter";
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatOpts = {},
): Promise<string> {
  const provider = await pickProvider();
  const baseURL = baseUrlFor(provider);
  const model = opts.model || modelFor(provider);

  const payload = {
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.max_tokens ?? 1600,
    // Many models/providers support JSON mode; some ignore it.
    response_format: { type: "json_object" as const },
  };

  const { controller, clear } = withTimeout(
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: headersFor(provider),
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(clear);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const msg = txt
      ? `LLM error (${res.status}): ${txt.slice(0, 500)}`
      : `LLM error (${res.status})`;
    throw new Error(msg);
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");
  return String(content);
}

export function safeJsonFromModel(text: string): any {
  // best-effort: extract first JSON object if model adds prose
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start)
    throw new Error("Model did not return JSON");
  const slice = text.slice(start, end + 1);
  return JSON.parse(slice);
}
