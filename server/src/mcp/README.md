# AiVIS MCP Server

Production-ready Model Context Protocol server for AiVIS.

## What is MCP?

Model Context Protocol is an open-source standard for AI agents (like Claude) to access tools and data. This server exposes AiVIS audit, analytics, and competitor analysis tools to Claude Desktop, Cursor, and other MCP-compatible clients.

## Features

- **12 tools** for auditing, analytics, competitor tracking, citation testing
- **5 resources** for methodology, tier limits, and historical data
- **Async audits** with polling (audits run in 30-60s, results cached)
- **Scoped API keys** with fine-grained permissions
- **Tier-based access control** (Alignment+ required)

## Installation

### From NPM (Recommended)

```bash
npm install -g @aivis.biz/mcp-server
```

### From Source

```bash
git clone https://github.com/aivis.biz/aivis.git
cd aivis/server
npm install
npm run mcp
```

## Configuration

Set these environment variables:

| Variable | Required | Example | Default |
| --- | --- | --- | --- |
| `AIVIS_API_KEY` | Yes | `avis_sk_live_abc123` | — |
| `AIVIS_BASE_URL` | No | `https://api.aivis.biz` | `https://api.aivis.biz` |
| `AIVIS_LOG_LEVEL` | No | `debug` | `info` |

## Usage

### Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "aivis": {
      "command": "node",
      "args": ["/path/to/aivis-mcp.ts"],
      "env": {
        "AIVIS_API_KEY": "avis_sk_live_...",
        "AIVIS_BASE_URL": "https://api.aivis.biz"
      }
    }
  }
}
```

Restart Claude. AiVIS tools should appear.

### Via HTTP (For Custom Integrations)

The native MCP server also exposes HTTP endpoints for broader client support:

```bash
curl -X POST \
  -H "Authorization: Bearer avis_sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "run_audit", "arguments": {"url": "https://example.com"}}' \
  http://localhost:3001/api/mcp/call
```

## Available Tools

**Read-Only (Alignment+):**
- `list_audits` — List your audit history
- `get_audit` — Fetch a completed audit by ID
- `get_audit_status` — Poll audit progress
- `get_analytics` — Score trends over time
- `get_evidence` — Extract evidence from audit
- `run_page_validation` — Quick technical check
- `list_competitors` — Track competitor scores
- `get_usage` — Check remaining scans

**Write (Alignment+):**
- `run_audit` — Queue new audit

**Premium (Signal+):**
- `run_citation_test` — Test AI platform citations
- `compare_competitors` — Side-by-side comparison

**Enterprise (Score Fix+):**
- `get_scorefix_tasks` — Implementation code & tasks
- `get_remediation_template` — Playbooks for fixes

## Available Resources

- `aivis://audit/{id}` — Full audit snapshot
- `aivis://domain/{host}/history` — Domain audit history
- `aivis://methodology/weights` — Scoring formula
- `aivis://tier-limits` — Feature matrix

## Development

### Run locally

```bash
AIVIS_API_KEY=avis_sk_live_... npm run mcp:dev
```

### TypeScript compilation

```bash
npm run mcp:build
```

### Tests

```bash
npm run mcp:test
```

## Architecture

The server:

1. Authenticates via `AIVIS_API_KEY` environment variable
2. Makes HTTP requests to the AiVIS backend (`AIVIS_BASE_URL`)
3. Exposes tools via MCP protocol (stdio transport)
4. Streams results back to the client

No database access, no shared state. Stateless and scalable.

## Logging

Set `AIVIS_LOG_LEVEL=debug` for verbose output:

```bash
AIVIS_API_KEY=avis_... AIVIS_LOG_LEVEL=debug npm run mcp
```

## API Rate Limits

Per-minute limits by tier (per API key):

| Tier | Limit | Concurrent |
| --- | --- | --- |
| Alignment | 60 req/min | 2 |
| Signal | 120 req/min | 5 |
| Score Fix | 300 req/min | 10 |

Monthly scan limits are enforced separately (see tier limits).

## Troubleshooting

### MCP Server not connecting

1. Verify `AIVIS_API_KEY` is set and valid
2. Test the key directly:
   ```bash
   curl -H "Authorization: Bearer avis_sk_live_..." \
   https://api.aivis.biz/api/mcp
   ```
3. Check Claude logs: **Settings → Developer**

### Authentication fails

- API key might be expired or revoked
- Generate a new key at aivis.biz/app/settings/api-keys

### Audits timing out

- Audits can take 30-60 seconds. Use polling. Don't set timeout < 90s.
- For faster results, run during off-peak hours

## Support

- **Docs:** https://aivis.biz/docs/mcp
- **Issues:** support@aivis.biz
- **Status:** https://status.aivis.biz
