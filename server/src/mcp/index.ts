#!/usr/bin/env node

/**
 * AiVIS MCP Server — Clean Standalone Implementation
 *
 * Runs as a standalone Node process exposing AiVIS tools via Model Context Protocol.
 * Uses McpServer + registerTool() pattern with Zod input schemas and stable
 * response envelopes ({ok, data, meta, error}).
 *
 * Usage:
 *   AIVIS_API_KEY=avis_xxx npm run mcp
 *   AIVIS_API_KEY=avis_xxx AIVIS_BASE_URL=http://localhost:3001 npm run mcp:dev
 *
 * Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "aivis": {
 *         "command": "node",
 *         "args": ["mcp.js"],
 *         "env": {
 *           "AIVIS_API_KEY": "avis_xxx",
 *           "AIVIS_BASE_URL": "https://api.aivis.biz"
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ── Config ───────────────────────────────────────────────────────────────────

const API_KEY = process.env.AIVIS_API_KEY;
const BASE_URL = process.env.AIVIS_BASE_URL || 'https://api.aivis.biz';
const SERVER_VERSION = '2.0.0';

if (!API_KEY) {
  console.error('ERROR: AIVIS_API_KEY environment variable is required');
  process.exit(1);
}

// ── Envelope helpers ─────────────────────────────────────────────────────────

interface Envelope<T = unknown> {
  ok: boolean;
  data: T | null;
  meta: Record<string, unknown>;
  error: string | null;
}

function ok<T>(data: T, meta: Record<string, unknown> = {}): Envelope<T> {
  return { ok: true, data, meta: { ts: new Date().toISOString(), ...meta }, error: null };
}

function fail(error: string, meta: Record<string, unknown> = {}): Envelope<null> {
  return { ok: false, data: null, meta: { ts: new Date().toISOString(), ...meta }, error };
}

// ── API Client ───────────────────────────────────────────────────────────────

class AivisApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.apiKey}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async scanUrl(params: { url: string; goal?: string; bypass_cache?: boolean; platform_focus?: string[] }): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/scan-url`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    return res.json() as Promise<Envelope>;
  }

  async getAuditReport(auditId: string): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/audits/${encodeURIComponent(auditId)}`, {
      headers: this.headers(false),
    });
    return res.json() as Promise<Envelope>;
  }

  async getAuditStatus(auditId: string): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/async/${encodeURIComponent(auditId)}/status`, {
      headers: this.headers(false),
    });
    return res.json() as Promise<Envelope>;
  }

  async exportReport(params: { audit_id: string; format: string }): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/export-report`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    return res.json() as Promise<Envelope>;
  }

  async reanalyzeUrl(params: { url: string; goal?: string }): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/scan-url`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ...params, bypass_cache: true }),
    });
    return res.json() as Promise<Envelope>;
  }

  async getVisibilityHistory(params: { url: string; days?: number }): Promise<Envelope> {
    const qs = new URLSearchParams({ url: params.url });
    if (params.days) qs.set('days', String(params.days));
    const res = await fetch(`${this.baseUrl}/api/mcp/history?${qs.toString()}`, {
      headers: this.headers(false),
    });
    return res.json() as Promise<Envelope>;
  }

  async compareCompetitors(params: { urls: string[] }): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/compare`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    return res.json() as Promise<Envelope>;
  }

  async runCitationTest(params: { url: string; queries: string[]; platforms?: string[] }): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/citation-test`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    return res.json() as Promise<Envelope>;
  }

  async createRemediationPlan(params: { audit_id: string; focus_categories?: string[] }): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/remediation-plan`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    return res.json() as Promise<Envelope>;
  }

  async getMethodology(): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/methodology`, {
      headers: this.headers(false),
    });
    return res.json() as Promise<Envelope>;
  }

  async getUsage(): Promise<Envelope> {
    const res = await fetch(`${this.baseUrl}/api/mcp/usage`, {
      headers: this.headers(false),
    });
    return res.json() as Promise<Envelope>;
  }
}

// ── Tool result helper ───────────────────────────────────────────────────────

function toolResult(envelope: Envelope) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(fail(message), null, 2) }],
    isError: true as const,
  };
}

// ── Server Setup ─────────────────────────────────────────────────────────────

const api = new AivisApiClient(BASE_URL, API_KEY);

const server = new McpServer({
  name: 'aivis',
  version: SERVER_VERSION,
});

// ── Phase 1 Tools ────────────────────────────────────────────────────────────

server.tool(
  'scan_url',
  'Queue an AI visibility audit for a public URL. Returns audit_id for polling. Idempotent within cache window unless bypass_cache is true.',
  {
    url: z.string().url().describe('Public URL to audit'),
    goal: z.string().max(200).optional().describe('Analysis goal or context'),
    bypass_cache: z.boolean().optional().describe('Force fresh scan, skip cache'),
    platform_focus: z.array(z.enum(['chatgpt', 'claude', 'gemini', 'perplexity'])).optional().describe('AI platforms to emphasize'),
  },
  async (params) => {
    try {
      const envelope = await api.scanUrl(params);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'scan_url failed');
    }
  },
);

server.tool(
  'get_audit_report',
  'Retrieve a completed audit report by ID. Includes visibility score, category scores, findings with machine codes, and recommendations.',
  {
    audit_id: z.string().uuid().describe('UUID of the audit to retrieve'),
  },
  async (params) => {
    try {
      const envelope = await api.getAuditReport(params.audit_id);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'get_audit_report failed');
    }
  },
);

server.tool(
  'get_audit_status',
  'Poll the status of a queued or in-progress audit. Returns status, progress_percent, and estimated_completion_seconds.',
  {
    audit_id: z.string().uuid().describe('UUID of the audit to poll'),
  },
  async (params) => {
    try {
      const envelope = await api.getAuditStatus(params.audit_id);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'get_audit_status failed');
    }
  },
);

server.tool(
  'export_report',
  'Generate a short-lived signed download URL for an audit report in JSON or PDF format.',
  {
    audit_id: z.string().uuid().describe('UUID of the audit to export'),
    format: z.enum(['json', 'pdf']).describe('Export format'),
  },
  async (params) => {
    try {
      const envelope = await api.exportReport(params);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'export_report failed');
    }
  },
);

// ── Phase 2 Tools ────────────────────────────────────────────────────────────

server.tool(
  'reanalyze_url',
  'Force a fresh audit for a URL, bypassing cache. Equivalent to scan_url with bypass_cache=true.',
  {
    url: z.string().url().describe('Public URL to re-audit'),
    goal: z.string().max(200).optional().describe('Analysis goal or context'),
  },
  async (params) => {
    try {
      const envelope = await api.reanalyzeUrl(params);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'reanalyze_url failed');
    }
  },
);

server.tool(
  'get_visibility_history',
  'Get score history for a URL over a time window. Returns timestamped scores for trend analysis.',
  {
    url: z.string().url().describe('URL to get history for'),
    days: z.number().int().min(1).max(365).optional().describe('Lookback window in days (default 90)'),
  },
  async (params) => {
    try {
      const envelope = await api.getVisibilityHistory(params);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'get_visibility_history failed');
    }
  },
);

server.tool(
  'compare_competitors',
  'Run side-by-side visibility comparison across 2-10 URLs. Returns scores, category breakdowns, and relative rankings.',
  {
    urls: z.array(z.string().url()).min(2).max(10).describe('URLs to compare'),
  },
  async (params) => {
    try {
      const envelope = await api.compareCompetitors(params);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'compare_competitors failed');
    }
  },
);

// ── Phase 3 Tools ────────────────────────────────────────────────────────────

server.tool(
  'run_citation_test',
  'Test how well a URL is cited in AI platform answers for given queries. Requires Signal tier or higher.',
  {
    url: z.string().url().describe('URL to test for citations'),
    queries: z.array(z.string()).min(1).max(10).describe('Search queries to test'),
    platforms: z.array(z.enum(['chatgpt', 'claude', 'gemini', 'perplexity'])).optional().describe('Platforms to test (default: all)'),
  },
  async (params) => {
    try {
      const envelope = await api.runCitationTest(params);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'run_citation_test failed');
    }
  },
);

server.tool(
  'create_remediation_plan',
  'Generate an implementation-ready remediation plan from audit findings. Maps recommendations to finding codes.',
  {
    audit_id: z.string().uuid().describe('UUID of the audit'),
    focus_categories: z.array(z.enum(['schema', 'content', 'technical', 'performance', 'trust'])).optional().describe('Categories to prioritize'),
  },
  async (params) => {
    try {
      const envelope = await api.createRemediationPlan(params);
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'create_remediation_plan failed');
    }
  },
);

server.tool(
  'get_methodology',
  'Get the AiVIS scoring methodology including category weights and evaluation criteria.',
  {},
  async () => {
    try {
      const envelope = await api.getMethodology();
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'get_methodology failed');
    }
  },
);

server.tool(
  'get_usage',
  'Get current-month API usage and remaining scan allowance for this key.',
  {},
  async () => {
    try {
      const envelope = await api.getUsage();
      return toolResult(envelope);
    } catch (err: any) {
      return toolError(err.message || 'get_usage failed');
    }
  },
);

// ── Startup ──────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`AiVIS MCP Server v${SERVER_VERSION} running (stdio)`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
