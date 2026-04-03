import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bot, ArrowLeft, Copy, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Terminal, Wrench, Shield, Zap, ExternalLink, ChevronDown, ChevronUp,
  Play, RefreshCw, BookOpen, Key, Globe, BarChart3, FileSearch, Users,
  Activity, Server, Lock, Cpu,
} from "lucide-react";
import toast from "react-hot-toast";
import { usePageMeta } from "../hooks/usePageMeta";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier, type CanonicalTier } from "@shared/types";
import UpgradeWall from "../components/UpgradeWall";
import apiFetch from "../utils/api";
import { API_URL } from "../config";

/* ── Types ─────────────────────────────────────────────────────── */

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredScope?: string;
}

interface MCPServerInfo {
  name: string;
  version: string;
  protocol: string;
  tools_count: number;
  auth_methods: string[];
}

type ConnectionStatus = "idle" | "testing" | "connected" | "failed";

/* ── Tool icon map ─────────────────────────────────────────────── */

const TOOL_ICONS: Record<string, React.ReactNode> = {
  run_audit: <Zap className="h-4 w-4 text-cyan-400" />,
  get_audit: <FileSearch className="h-4 w-4 text-blue-400" />,
  list_audits: <BarChart3 className="h-4 w-4 text-emerald-400" />,
  get_analytics: <Activity className="h-4 w-4 text-violet-400" />,
  get_evidence: <BookOpen className="h-4 w-4 text-amber-400" />,
  run_page_validation: <Shield className="h-4 w-4 text-orange-400" />,
  list_competitors: <Users className="h-4 w-4 text-pink-400" />,
  get_usage: <Globe className="h-4 w-4 text-teal-400" />,
  run_citation_test: <Terminal className="h-4 w-4 text-indigo-400" />,
};

const TOOL_TIERS: Record<string, string> = {
  run_audit: "Alignment+",
  get_audit: "Alignment+",
  list_audits: "Alignment+",
  get_analytics: "Alignment+",
  get_evidence: "Alignment+",
  run_page_validation: "Alignment+",
  list_competitors: "Signal+",
  get_usage: "Alignment+",
  run_citation_test: "Signal+",
};

/* ── Setup configs ─────────────────────────────────────────────── */

function buildClaudeConfig(apiKey: string) {
  return JSON.stringify({
    mcpServers: {
      aivis: {
        transport: "http",
        url: "https://aivis.biz/api/mcp",
        headers: {
          Authorization: `Bearer ${apiKey || "avis_YOUR_API_KEY"}`,
        },
      },
    },
  }, null, 2);
}

function buildCursorConfig(apiKey: string) {
  return JSON.stringify({
    mcpServers: {
      aivis: {
        url: "https://aivis.biz/api/mcp",
        transport: "http",
        headers: {
          Authorization: `Bearer ${apiKey || "avis_YOUR_API_KEY"}`,
        },
      },
    },
  }, null, 2);
}

function buildCurlExample() {
  return `# List available tools
curl -H "Authorization: Bearer avis_YOUR_API_KEY" \\
  https://aivis.biz/api/mcp/tools

# Run an audit
curl -X POST \\
  -H "Authorization: Bearer avis_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"run_audit","arguments":{"url":"https://example.com"}}' \\
  https://aivis.biz/api/mcp/call`;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function McpConsolePage() {
  usePageMeta({
    title: "MCP Server Console | AiVIS",
    description: "Connect AI agents to AiVIS via Model Context Protocol. Browse tools, test connections, and configure Claude, Cursor, and other MCP clients.",
    path: "/mcp",
  });

  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier || "observer") as CanonicalTier;
  const hasAccess = meetsMinimumTier(tier, "alignment");

  /* ── State ─────────────────────────────────────── */
  const [serverInfo, setServerInfo] = useState<MCPServerInfo | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionNote, setConnectionNote] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [setupTab, setSetupTab] = useState<"claude" | "cursor" | "curl">("claude");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [toolCallResult, setToolCallResult] = useState<Record<string, unknown> | null>(null);
  const [toolCallLoading, setToolCallLoading] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const [quickAuditUrl, setQuickAuditUrl] = useState("");

  /* ── Fetch server info + tools on mount ─────────── */
  const fetchServerData = useCallback(async () => {
    if (!hasAccess) return;
    setConnectionStatus("testing");
    setConnectionNote("");

    try {
      const [infoRes, toolsRes] = await Promise.all([
        apiFetch(`${API_URL}/api/mcp`),
        apiFetch(`${API_URL}/api/mcp/tools`),
      ]);

      if (infoRes.ok) {
        const data = await infoRes.json();
        setServerInfo(data.server || data);
      }

      if (toolsRes.ok) {
        const data = await toolsRes.json();
        setTools(Array.isArray(data) ? data : data.tools || []);
        setConnectionStatus("connected");
        setConnectionNote(`Server reachable · ${(Array.isArray(data) ? data : data.tools || []).length} tools available`);
      } else if (toolsRes.status === 401 || toolsRes.status === 403) {
        setConnectionStatus("failed");
        setConnectionNote("Authentication required — add your API key to connect");
      } else {
        setConnectionStatus("failed");
        setConnectionNote(`Server returned ${toolsRes.status}`);
      }
    } catch {
      setConnectionStatus("failed");
      setConnectionNote("Cannot reach MCP server — check network or API URL");
    }
  }, [hasAccess]);

  useEffect(() => { fetchServerData(); }, [fetchServerData]);

  /* ── Try a tool ─────────────────────────────────── */
  const handleToolCall = useCallback(async (toolName: string, args: Record<string, unknown>) => {
    setToolCallLoading(true);
    setToolCallResult(null);
    setActiveToolCall(toolName);

    try {
      const res = await apiFetch(`${API_URL}/api/mcp/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: toolName, arguments: args }),
      });
      const data = await res.json();
      setToolCallResult(data);
    } catch {
      setToolCallResult({ error: "Network error — could not reach MCP server" });
    } finally {
      setToolCallLoading(false);
    }
  }, []);

  /* ── Copy helper ────────────────────────────────── */
  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  /* ── Group tools by category ────────────────────── */
  const TOOL_CATEGORIES: Record<string, { label: string; icon: React.ReactNode; tools: string[] }> = useMemo(() => ({
    audits: {
      label: "Audit Tools",
      icon: <Zap className="h-4 w-4 text-cyan-400" />,
      tools: ["run_audit", "get_audit", "list_audits", "run_page_validation"],
    },
    analytics: {
      label: "Analytics & Evidence",
      icon: <Activity className="h-4 w-4 text-emerald-400" />,
      tools: ["get_analytics", "get_evidence", "get_usage"],
    },
    advanced: {
      label: "Advanced Tools",
      icon: <Users className="h-4 w-4 text-pink-400" />,
      tools: ["list_competitors", "run_citation_test"],
    },
  }), []);

  const groupedTools = useMemo(() => {
    const groups: Array<{ key: string; label: string; icon: React.ReactNode; items: MCPTool[] }> = [];
    const toolsByName = Object.fromEntries(tools.map(t => [t.name, t]));
    for (const [key, cat] of Object.entries(TOOL_CATEGORIES)) {
      const items = cat.tools.map(n => toolsByName[n]).filter(Boolean);
      if (items.length > 0) groups.push({ key, label: cat.label, icon: cat.icon, items });
    }
    // catch any tools not in a known category
    const known = new Set(Object.values(TOOL_CATEGORIES).flatMap(c => c.tools));
    const uncategorized = tools.filter(t => !known.has(t.name));
    if (uncategorized.length > 0) groups.push({ key: "other", label: "Other Tools", icon: <Wrench className="h-4 w-4 text-white/40" />, items: uncategorized });
    return groups;
  }, [tools, TOOL_CATEGORIES]);

  /* ── Tier gate ──────────────────────────────────── */
  if (!hasAccess) {
    return (
      <div className="text-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <UpgradeWall
            feature="MCP Server Console"
            description="Connect AI agents like Claude and Cursor to AiVIS via Model Context Protocol. Run audits, query analytics, and pull reports — all from your agent's toolbox."
            requiredTier="alignment"
            icon={<Bot className="h-6 w-6" />}
          />
        </div>
      </div>
    );
  }

  const statusColor = connectionStatus === "connected" ? "emerald" : connectionStatus === "failed" ? "red" : connectionStatus === "testing" ? "amber" : "white";

  return (
    <div className="text-white">
      <div className="max-w-6xl">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
            <Bot className="h-7 w-7 text-violet-400" />
            MCP Server Console
          </h1>
          <p className="mt-1.5 text-sm text-white/50 max-w-2xl">
            Connect AI agents to AiVIS via Model Context Protocol. Run audits, query analytics,
            access evidence — all through your agent's native tool interface.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copyText(buildClaudeConfig(apiKeyInput))}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20 transition"
          >
            <Copy className="h-3 w-3" /> Copy Config
          </button>
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
            Alignment+
          </span>
        </div>
      </div>

      {/* ── What is MCP? explainer ─────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/8 to-cyan-500/5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
          <Bot className="h-5 w-5 text-violet-400" /> What is MCP?
        </h2>
        <p className="text-sm text-white/55 mb-4 max-w-3xl leading-relaxed">
          <strong className="text-white/80">Model Context Protocol (MCP)</strong> lets AI coding agents — like Claude Desktop, Cursor, and Windsurf — call AiVIS tools directly.
          Instead of switching between your IDE and the AiVIS dashboard, your agent can run audits, pull scores, and query analytics on your behalf.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/8 bg-charcoal-light/30 p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold text-white/90">In your IDE</span>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Ask your agent: <em className="text-cyan-300/80">"Run an AiVIS audit on example.com"</em> — it handles the rest.
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-charcoal-light/30 p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white/90">Automated workflows</span>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Build scripts that monitor scores, compare competitors, and track citation presence over time.
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-charcoal-light/30 p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-white/90">Secure & scoped</span>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed">
              All calls use your API key with configurable scopes — your agent only sees what you allow.
            </p>
          </div>
        </div>
      </div>

      {/* ── Connection Status Bar ─────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
              connectionStatus === "connected"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : connectionStatus === "failed"
                ? "bg-red-500/10 border-red-500/20"
                : "bg-white/5 border-white/10"
            }`}>
              {connectionStatus === "testing" ? (
                <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
              ) : connectionStatus === "connected" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : connectionStatus === "failed" ? (
                <XCircle className="h-5 w-5 text-red-400" />
              ) : (
                <Server className="h-5 w-5 text-white/40" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {connectionStatus === "connected" ? "Connected" : connectionStatus === "testing" ? "Testing Connection…" : connectionStatus === "failed" ? "Connection Failed" : "Not Connected"}
                </span>
                <span className={`h-2 w-2 rounded-full ${
                  connectionStatus === "connected" ? "bg-emerald-400 animate-pulse" : connectionStatus === "failed" ? "bg-red-400" : "bg-white/20"
                }`} />
              </div>
              {connectionNote && <p className="text-xs text-white/40 mt-0.5">{connectionNote}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchServerData}
              disabled={connectionStatus === "testing"}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${connectionStatus === "testing" ? "animate-spin" : ""}`} />
              Test Connection
            </button>
            {serverInfo && (
              <span className="text-[11px] text-white/30 hidden sm:inline">
                v{serverInfo.version} · {serverInfo.protocol}
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        {connectionStatus === "connected" && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-lg font-bold text-white tabular-nums">{tools.length}</div>
              <div className="text-[11px] text-white/40">Tools Available</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-lg font-bold text-violet-300">MCP 1.0</div>
              <div className="text-[11px] text-white/40">Protocol</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-lg font-bold text-emerald-300">HTTP</div>
              <div className="text-[11px] text-white/40">Transport</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-lg font-bold text-cyan-300 capitalize">{tier}</div>
              <div className="text-[11px] text-white/40">Your Tier</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Setup Guide ───────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 overflow-hidden">
        <button
          onClick={() => setShowSetup(!showSetup)}
          className="w-full flex items-center justify-between p-5 sm:p-6 hover:bg-white/[0.02] transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Wrench className="h-4.5 w-4.5 text-violet-400" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-semibold text-white">Quick Setup</h2>
              <p className="text-xs text-white/40">Add AiVIS tools to Claude Desktop, Cursor, or any MCP-compatible client</p>
            </div>
          </div>
          {showSetup ? <ChevronUp className="h-5 w-5 text-white/30" /> : <ChevronDown className="h-5 w-5 text-white/30" />}
        </button>

        {showSetup && (
          <div className="border-t border-white/5 p-5 sm:p-6">
            {/* API key input */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Your API Key <span className="text-white/30">(paste to auto-fill configs below)</span>
              </label>
              <div className="relative max-w-lg">
                <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="avis_xxxxxxxxxxxx"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white font-mono placeholder:text-white/25 focus:border-violet-500/30 focus:outline-none focus:ring-1 focus:ring-violet-500/15"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-white/30">
                Generate API keys in <Link to="/app/settings?section=api-keys" className="text-violet-400 hover:text-violet-300 underline">Settings → API Keys</Link>
              </p>
            </div>

            {/* Tab selector */}
            <div className="flex gap-1 mb-4 p-1 rounded-xl bg-white/5 w-fit">
              {(["claude", "cursor", "curl"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSetupTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                    setupTab === tab
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/20"
                      : "text-white/50 hover:text-white/70 border border-transparent"
                  }`}
                >
                  {tab === "claude" ? "Claude Desktop" : tab === "cursor" ? "Cursor" : "cURL"}
                </button>
              ))}
            </div>

            {/* Config display */}
            <div className="relative rounded-xl border border-white/10 bg-[#0a0e1a] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                <span className="text-[11px] text-white/40 font-mono">
                  {setupTab === "claude" ? "claude_desktop_config.json" : setupTab === "cursor" ? ".cursor/mcp.json" : "terminal"}
                </span>
                <button
                  onClick={() => copyText(
                    setupTab === "claude" ? buildClaudeConfig(apiKeyInput)
                    : setupTab === "cursor" ? buildCursorConfig(apiKeyInput)
                    : buildCurlExample()
                  )}
                  className="inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <pre className="p-4 text-xs text-violet-200/80 overflow-x-auto font-mono leading-relaxed whitespace-pre">
                {setupTab === "claude" ? buildClaudeConfig(apiKeyInput)
                 : setupTab === "cursor" ? buildCursorConfig(apiKeyInput)
                 : buildCurlExample()}
              </pre>
            </div>

            {/* Instructions */}
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full bg-violet-500/15 text-violet-300 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span className="text-xs font-semibold text-white">Generate API Key</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Go to Settings → API Keys and create a key with <code className="text-violet-300 bg-violet-500/10 px-1 rounded">read:audits</code> and <code className="text-violet-300 bg-violet-500/10 px-1 rounded">write:audits</code> scopes.
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full bg-violet-500/15 text-violet-300 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span className="text-xs font-semibold text-white">Add to Config</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Copy the config above and paste it into your MCP client's configuration file. Restart the client.
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full bg-violet-500/15 text-violet-300 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span className="text-xs font-semibold text-white">Start Using Tools</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Ask your agent to "run an AiVIS audit on example.com" — it will auto-discover and invoke the right tool.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Run Audit ─────────────────────────────────────── */}
      {connectionStatus === "connected" && (
        <div className="mb-6 rounded-2xl border border-cyan-500/15 bg-gradient-to-r from-cyan-500/5 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Quick: Run Audit via MCP</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (quickAuditUrl.trim()) {
                let u = quickAuditUrl.trim();
                if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
                handleToolCall("run_audit", { url: u });
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={quickAuditUrl}
              onChange={(e) => setQuickAuditUrl(e.target.value)}
              placeholder="example.com"
              enterKeyHint="go"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/15"
            />
            <button
              type="submit"
              disabled={toolCallLoading || !quickAuditUrl.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/15 border border-cyan-500/20 px-4 py-2.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 transition disabled:opacity-40"
            >
              {toolCallLoading && activeToolCall === "run_audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run Audit
            </button>
          </form>
          {toolCallResult && activeToolCall === "run_audit" && (
            <div className="mt-3 rounded-xl border border-white/10 bg-[#0a0e1a] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
                <span className="text-[10px] text-white/40 font-mono">Audit Response</span>
                <button onClick={() => copyText(JSON.stringify(toolCallResult, null, 2))} className="text-[10px] text-white/30 hover:text-white/60 transition"><Copy className="h-3 w-3" /></button>
              </div>
              <pre className="p-3 text-[11px] text-emerald-200/70 overflow-x-auto font-mono max-h-48 overflow-y-auto">{JSON.stringify(toolCallResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── Tools Browser ─────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Cpu className="h-4.5 w-4.5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Available Tools</h2>
              <p className="text-xs text-white/40">{tools.length} tools · {tools.filter((t) => meetsMinimumTier(tier, TOOL_TIERS[t.name]?.includes("Signal") ? "signal" : "alignment")).length} at your tier</p>
            </div>
          </div>
        </div>

        {tools.length === 0 && connectionStatus !== "testing" && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
            <Bot className="h-8 w-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/40">No tools loaded yet. Test the connection above to discover available tools.</p>
          </div>
        )}

        {tools.length === 0 && connectionStatus === "testing" && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tools…
          </div>
        )}

        {groupedTools.map((group) => (
          <div key={group.key} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 mb-2 px-1">
              {group.icon}
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{group.label}</span>
            </div>
            <div className="space-y-2">
          {group.items.map((tool) => {
            const isExpanded = expandedTool === tool.name;
            const tierLabel = TOOL_TIERS[tool.name] || "Alignment+";
            const icon = TOOL_ICONS[tool.name] || <Wrench className="h-4 w-4 text-white/40" />;
            const schema = tool.inputSchema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };

            return (
              <div key={tool.name} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition"
                >
                  <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white font-mono">{tool.name}</span>
                      <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{tierLabel}</span>
                      {tool.requiredScope && (
                        <span className="text-[10px] text-white/25 hidden sm:inline">{tool.requiredScope}</span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 truncate">{tool.description}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-white/30 shrink-0" /> : <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-white/5 p-4 space-y-4">
                    {/* Input schema */}
                    {schema?.properties && (
                      <div>
                        <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">Parameters</div>
                        <div className="space-y-1.5">
                          {Object.entries(schema.properties).map(([key, val]) => (
                            <div key={key} className="flex items-start gap-2 text-xs">
                              <code className="text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono shrink-0">{key}</code>
                              <span className="text-white/25">{val.type || "string"}</span>
                              {schema.required?.includes(key) && (
                                <span className="text-amber-400 text-[10px]">required</span>
                              )}
                              {val.description && <span className="text-white/40">{val.description}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick invoke for get_usage (safe read-only tool) */}
                    {tool.name === "get_usage" && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToolCall("get_usage", {})}
                          disabled={toolCallLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-violet-500/15 border border-violet-500/20 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/25 transition disabled:opacity-40"
                        >
                          {toolCallLoading && activeToolCall === "get_usage" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Try it now
                        </button>
                        <span className="text-[11px] text-white/25">Read-only — shows your current usage</span>
                      </div>
                    )}

                    {tool.name === "list_audits" && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToolCall("list_audits", { limit: 5 })}
                          disabled={toolCallLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-violet-500/15 border border-violet-500/20 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/25 transition disabled:opacity-40"
                        >
                          {toolCallLoading && activeToolCall === "list_audits" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          List recent audits (5)
                        </button>
                      </div>
                    )}

                    {/* Tool call result */}
                    {toolCallResult && activeToolCall === tool.name && (
                      <div className="rounded-xl border border-white/10 bg-[#0a0e1a] overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
                          <span className="text-[10px] text-white/40 font-mono">Response</span>
                          <button
                            onClick={() => copyText(JSON.stringify(toolCallResult, null, 2))}
                            className="text-[10px] text-white/30 hover:text-white/60 transition"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <pre className="p-3 text-[11px] text-emerald-200/70 overflow-x-auto font-mono max-h-64 overflow-y-auto">
                          {JSON.stringify(toolCallResult, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* cURL example */}
                    <div className="rounded-xl border border-white/5 bg-[#0a0e1a] overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
                        <span className="text-[10px] text-white/40 font-mono">cURL</span>
                        <button
                          onClick={() => {
                            const requiredParams = (schema?.required || []).reduce((acc: Record<string, string>, key: string) => {
                              acc[key] = `<${key}>`;
                              return acc;
                            }, {});
                            const curl = `curl -X POST \\\n  -H "Authorization: Bearer ${apiKeyInput || "avis_YOUR_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ name: tool.name, arguments: requiredParams })}' \\\n  https://aivis.biz/api/mcp/call`;
                            copyText(curl);
                          }}
                          className="text-[10px] text-white/30 hover:text-white/60 transition flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                      <pre className="p-3 text-[11px] text-white/50 overflow-x-auto font-mono">
{`curl -X POST \\
  -H "Authorization: Bearer ${apiKeyInput || "avis_YOUR_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"${tool.name}","arguments":{${(schema?.required || []).map((k: string) => `"${k}":"<${k}>"`).join(",")}}}' \\
  https://aivis.biz/api/mcp/call`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tier Access Matrix ────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Lock className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Access by Plan</h2>
            <p className="text-xs text-white/40">Tool availability depends on your active tier</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/8 text-white/40">
                <th className="pb-3 font-medium pr-4">Feature</th>
                <th className="pb-3 font-medium text-center px-3">Observer</th>
                <th className="pb-3 font-medium text-center px-3">Alignment</th>
                <th className="pb-3 font-medium text-center px-3">Signal</th>
                <th className="pb-3 font-medium text-center px-3">Score Fix</th>
              </tr>
            </thead>
            <tbody className="text-white/60">
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4">MCP Server Access</td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4">run_audit / list_audits / get_audit</td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4">get_analytics / get_evidence</td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4">run_citation_test / list_competitors</td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Remediation tools (future)</td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" /></td>
                <td className="py-3 text-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resources & Links ─────────────────────────────────────── */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Link
          to="/app/gsc"
          className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 hover:border-emerald-500/20 hover:bg-white/[0.04] transition group"
        >
          <BarChart3 className="h-5 w-5 text-emerald-400 mb-3" />
          <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition">Search Console</h3>
          <p className="mt-1 text-xs text-white/40">Connect GSC for performance intelligence, decline detection, and evidence-backed recs.</p>
        </Link>

        <Link
          to="/api-docs"
          className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 hover:border-white/20 hover:bg-white/[0.04] transition group"
        >
          <BookOpen className="h-5 w-5 text-cyan-400 mb-3" />
          <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">API Documentation</h3>
          <p className="mt-1 text-xs text-white/40">Full REST API reference with authentication, endpoints, and response schemas.</p>
        </Link>

        <Link
          to="/app/settings?section=api-keys"
          className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 hover:border-white/20 hover:bg-white/[0.04] transition group"
        >
          <Key className="h-5 w-5 text-amber-400 mb-3" />
          <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition">Manage API Keys</h3>
          <p className="mt-1 text-xs text-white/40">Create, rotate, and revoke API keys with custom scopes for MCP access.</p>
        </Link>

        <Link
          to="/integrations"
          className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 hover:border-white/20 hover:bg-white/[0.04] transition group"
        >
          <Zap className="h-5 w-5 text-violet-400 mb-3" />
          <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition">Integrations Hub</h3>
          <p className="mt-1 text-xs text-white/40">Webhooks, OAuth, scheduled rescans, and all automation endpoints in one place.</p>
        </Link>
      </div>
      </div>
    </div>
  );
}
