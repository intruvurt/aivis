# visibility-worker (Cloudflare Worker)

This worker consumes `PUBLISHED` events from an input Redis stream, probes OpenRouter, computes visibility score, and emits `FEEDBACK_TRIGGERED` events into a dedicated output stream.

## Runtime model

- Cloudflare Worker with:
  - `scheduled` trigger (every minute)
  - manual HTTP trigger (`POST /run`)
  - health check (`GET /health`)
- Redis access uses Upstash REST API (Cloudflare Workers cannot connect to `redis://redis:6379` private Docker hosts).
- Cursor state is stored in Cloudflare KV binding `VISIBILITY_STATE`.
- First run starts at cursor `0` (drains backlog), then resumes from persisted cursor.

## Required secrets

Set these in Cloudflare Worker settings (or via Wrangler):

- `OPEN_ROUTER_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Optional vars

Configured in `wrangler.jsonc` and can be overridden:

- `STREAM_KEY` (default `aivis_stream`)
- `OUTPUT_STREAM_KEY` (default `aivis_feedback_stream`)
- `STREAM_BATCH_SIZE` (default `10`, max `100`)
- `OPEN_ROUTER_MODEL` (default `openai/gpt-4o-mini`)
- `OPEN_ROUTER_BASE_URL` (default `https://openrouter.ai/api/v1/chat/completions`)

## One-time setup in Cloudflare dashboard

1. Create Worker named `visibility-worker`.
2. Create KV namespace for cursor state.
3. Bind KV namespace as `VISIBILITY_STATE`.
4. Add secrets listed above.
5. Add cron trigger: `*/1 * * * *`.
6. Deploy this repo code (replace Hello World code).

## Local/dev commands (Windows-safe)

From repository root:

```powershell
npm.cmd --prefix workers/visibility-worker install
npm.cmd --prefix workers/visibility-worker run dev
npm.cmd --prefix workers/visibility-worker run deploy
```

## Manual run

After deployment:

```bash
curl -X POST https://<your-worker-subdomain>/run
```

## Event contract consumed

Input event in stream `data` field:

```json
{
  "type": "PUBLISHED",
  "job_id": "job_123",
  "payload": { "url": "https://aivis.biz/page" },
  "ts": 1710000000000
}
```

Output event appended to output stream:

```json
{
  "type": "FEEDBACK_TRIGGERED",
  "job_id": "job_123",
  "payload": { "entity": "https://aivis.biz/page", "score": 0.5 },
  "ts": 1710000000000
}
```
