type WorkerKVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
};

type Env = {
  OPEN_ROUTER_API_KEY: string;
  OPEN_ROUTER_MODEL?: string;
  OPEN_ROUTER_BASE_URL?: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  STREAM_KEY?: string;
  OUTPUT_STREAM_KEY?: string;
  STREAM_BATCH_SIZE?: string;
  VISIBILITY_STATE: WorkerKVNamespace;
};

type PipelineEvent = {
  type: string;
  job_id?: string;
  payload?: {
    url?: string;
    [key: string]: unknown;
  };
  ts?: number;
  [key: string]: unknown;
};

const DEFAULT_STREAM_KEY = "aivis_stream";
const DEFAULT_OUTPUT_STREAM_KEY = "aivis_feedback_stream";
const DEFAULT_BATCH_SIZE = 10;
const CURSOR_KV_KEY = "visibility_worker:last_stream_id";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function streamKey(env: Env): string {
  return env.STREAM_KEY?.trim() || DEFAULT_STREAM_KEY;
}

function outputStreamKey(env: Env): string {
  return env.OUTPUT_STREAM_KEY?.trim() || DEFAULT_OUTPUT_STREAM_KEY;
}

function batchSize(env: Env): number {
  const parsed = Number.parseInt(env.STREAM_BATCH_SIZE || "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(parsed, 100);
}

function sanitizeEntity(raw: string): string {
  return raw.replace(/[\r\n\t]+/g, " ").slice(0, 250);
}

function isVisibilityHit(text: string, entity: string): boolean {
  const t = text.toLowerCase();
  const domain = entity.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  return t.includes("aivis") || t.includes("aivis.biz") || (domain.length > 0 && t.includes(domain));
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseEvent(raw: string): PipelineEvent | null {
  try {
    const parsed = JSON.parse(raw) as PipelineEvent;
    if (!parsed || typeof parsed.type !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function responseTextFromOpenRouter(payload: unknown): string {
  const root = toRecord(payload);
  const choices = root.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const message = toRecord(toRecord(choices[0]).message);
  return typeof message.content === "string" ? message.content : "";
}

async function probe(query: string, env: Env): Promise<string | null> {
  const url = env.OPEN_ROUTER_BASE_URL?.trim() || OPENROUTER_URL;
  const model = env.OPEN_ROUTER_MODEL?.trim() || "openai/gpt-4o-mini";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPEN_ROUTER_API_KEY}`,
        "HTTP-Referer": "https://aivis.biz",
        "X-Title": "AiVIS Visibility Worker"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: query }]
      })
    });

    if (!res.ok) {
      console.error(`[probe] ${res.status}:`, await res.text());
      return null;
    }

    const payload = (await res.json()) as unknown;
    return responseTextFromOpenRouter(payload);
  } catch (err) {
    console.error("[probe] fetch error:", err);
    return null;
  }
}

function eventFieldValue(fields: unknown[], fieldName: string): string | null {
  for (let i = 0; i < fields.length - 1; i += 2) {
    if (fields[i] === fieldName && typeof fields[i + 1] === "string") {
      return fields[i + 1] as string;
    }
  }
  return null;
}

async function upstashCommand(env: Env, args: string[]): Promise<unknown> {
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`
    },
    body: JSON.stringify([[...args]])
  });

  if (!res.ok) {
    throw new Error(`Upstash request failed (${res.status}): ${await res.text()}`);
  }

  const payload = (await res.json()) as unknown;
  const arr = Array.isArray(payload) ? payload : [];
  const first = toRecord(arr[0]);

  if (typeof first.error === "string" && first.error.length > 0) {
    throw new Error(`Upstash command error: ${first.error}`);
  }

  return first.result;
}

async function readStream(
  env: Env,
  cursor: string,
  limit: number
): Promise<Array<{ id: string; event: PipelineEvent }>> {
  const result = await upstashCommand(env, [
    "XREAD",
    "COUNT",
    String(limit),
    "STREAMS",
    streamKey(env),
    cursor
  ]);

  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  const streamTuple = result[0] as unknown[];
  if (!Array.isArray(streamTuple) || streamTuple.length < 2 || !Array.isArray(streamTuple[1])) {
    return [];
  }

  const messages = streamTuple[1] as unknown[];
  const out: Array<{ id: string; event: PipelineEvent }> = [];

  for (const msg of messages) {
    const tuple = msg as unknown[];
    if (!Array.isArray(tuple) || tuple.length < 2 || typeof tuple[0] !== "string") {
      continue;
    }

    const id = tuple[0];
    const fields = Array.isArray(tuple[1]) ? (tuple[1] as unknown[]) : [];
    const data = eventFieldValue(fields, "data");
    if (!data) {
      continue;
    }

    const event = parseEvent(data);
    if (!event) {
      continue;
    }

    out.push({ id, event });
  }

  return out;
}

async function publishFeedback(
  env: Env,
  jobId: string | undefined,
  entity: string,
  score: number | null,
  hits: number,
  validResponses: number,
  totalQueries: number
): Promise<void> {
  const event = {
    type: "FEEDBACK_TRIGGERED",
    job_id: jobId,
    payload: {
      entity,
      score,
      hits,
      total: totalQueries,
      valid_responses: validResponses
    },
    ts: Date.now()
  };

  await upstashCommand(env, ["XADD", outputStreamKey(env), "*", "data", JSON.stringify(event)]);
}

async function processPublishedEvent(event: PipelineEvent, env: Env): Promise<void> {
  const rawEntity = typeof event.payload?.url === "string" ? event.payload.url : "";
  if (!rawEntity) {
    return;
  }

  const entity = sanitizeEntity(rawEntity);
  const queries = [`What is ${entity}?`, `How does ${entity} work?`, `What does ${entity} do?`];

  let hits = 0;
  let validResponses = 0;

  for (const q of queries) {
    const response = await probe(q, env);
    if (response === null) {
      continue;
    }

    validResponses += 1;
    if (isVisibilityHit(response, entity)) {
      hits += 1;
    }
  }

  const score = validResponses > 0 ? hits / validResponses : null;
  await publishFeedback(env, event.job_id, entity, score, hits, validResponses, queries.length);
}

async function runCycle(env: Env): Promise<{ processed: number; cursor: string; input_stream: string; output_stream: string }> {
  const inputStream = streamKey(env);
  const lastCursor = (await env.VISIBILITY_STATE.get(CURSOR_KV_KEY)) || "0";
  const records = await readStream(env, lastCursor, batchSize(env));

  let cursor = lastCursor;
  let processed = 0;

  for (const record of records) {
    cursor = record.id;
    if (record.event.type !== "PUBLISHED") {
      continue;
    }

    try {
      await processPublishedEvent(record.event, env);
      processed += 1;
    } catch (err) {
      console.error(`[cycle] failed processing ${record.id}:`, err);
    }
  }

  if (cursor !== lastCursor) {
    await env.VISIBILITY_STATE.put(CURSOR_KV_KEY, cursor);
  }

  return {
    processed,
    cursor,
    input_stream: inputStream,
    output_stream: outputStreamKey(env)
  };
}

function requireEnv(env: Env): void {
  const required = ["OPEN_ROUTER_API_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
  for (const key of required) {
    const val = env[key as keyof Env];
    if (typeof val !== "string" || val.trim().length === 0) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      requireEnv(env);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid worker configuration";
      return Response.json({ ok: false, error: message }, { status: 500 });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        worker: "visibility-worker",
        input_stream: streamKey(env),
        output_stream: outputStreamKey(env)
      });
    }

    if (request.method === "POST" && url.pathname === "/run") {
      try {
        return Response.json({ ok: true, ...(await runCycle(env)) });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return Response.json({ ok: false, error: message }, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(
    _controller: WorkerScheduledController,
    env: Env,
    ctx: WorkerExecutionContext
  ): Promise<void> {
    try {
      requireEnv(env);
      ctx.waitUntil(runCycle(env));
    } catch (err) {
      console.error("visibility-worker scheduled run skipped", err);
    }
  }
};