import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import {
  ArrowLeft,
  FlaskConical,
  Layers,
  Ghost,
  GitCompareArrows,
  Activity,
  Loader2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Target,
  Zap,
  AlertCircle,
  Copy,
  Check,
  CheckCheck,
  Download,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  GripVertical,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Wand2,
  Brain,
  FileText,
  Workflow,
  Gauge,
  CircleAlert,
  BarChart3,
  Link2,
} from "lucide-react";
import toast from "react-hot-toast";

import { API_URL } from "../config";
import UpgradeWall from "../components/UpgradeWall";
import { meetsMinimumTier } from "@shared/types";
import { usePageMeta } from "../hooks/usePageMeta";
import { AnswerDecompilerIcon, ContentBlueprintIcon, AuditEngineIcon } from "../components/icons";

const CLIENT_TIMEOUT_MS = 60_000;

async function apiPost<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = useAuthStore.getState().token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await res.text();
    let parsed: any = null;

    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      throw new Error(parsed?.error || parsed?.message || `Request failed (${res.status})`);
    }

    if (!parsed?.success) {
      throw new Error(parsed?.error || parsed?.message || "Request failed");
    }

    return parsed.data as T;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. The AI models are busy, please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

type Tool = "decompile" | "ghost" | "model-diff" | "simulate" | "rewrite";

type SectionConfig = {
  key: string;
  title: string;
  data: unknown;
  defaultOpen?: boolean;
  whyItMatters?: string;
};

type SummaryCard = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
  icon: React.ElementType;
};

type InsightPill = {
  label: string;
  tone?: "neutral" | "good" | "warn";
};

type PriorityAction = {
  title: string;
  detail?: string;
  impact?: "high" | "medium" | "low";
};

type SavedReverseEngineerReport = {
  id: string;
  tool: Tool;
  input: string;
  secondaryInput?: string;
  createdAt: string;
  result: unknown;
};

const TOOL_EXAMPLES: Record<Tool, { input: string; secondary?: string }> = {
  decompile: {
    input:
      "Top CRM tools for SMB include HubSpot, Pipedrive, and Zoho. Choose based on onboarding speed, integrations, and reporting depth.",
  },
  ghost: {
    input: "best AI visibility software for local service businesses",
  },
  "model-diff": {
    input: "how to improve AI citation rate",
    secondary:
      "We provide technical audits, schema recommendations, and visibility tracking across AI platforms.",
  },
  simulate: {
    input: "https://aivis.biz",
    secondary: "ai visibility tools for agencies",
  },
  rewrite: {
    input: "We help businesses improve their online presence. Our team of experts works to optimize your website for better performance. Contact us to learn more about our services and how we can help you grow.",
    secondary: "authoritative",
  },
};

const TOOLS: {
  id: Tool;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  description: string;
  placeholder: string;
  inputLabel: string;
  inputType: "textarea" | "text";
  businessValue: string;
}[] = [
  {
    id: "decompile",
    label: "Answer Decompiler",
    subtitle: "Why AI picked this structure",
    icon: AnswerDecompilerIcon,
    description:
      "Paste an AI-generated answer to reverse-engineer which content structures the model preferred, what source styles it leaned on, and how to reconstruct the same answer shape on your own site.",
    placeholder: "Paste a full AI-generated answer here…",
    inputLabel: "AI Answer",
    inputType: "textarea",
    businessValue: "Find the shape of answers models already trust.",
  },
  {
    id: "ghost",
    label: "Competitor Ghost",
    subtitle: "Build the page AI wants to quote",
    icon: ContentBlueprintIcon,
    description:
      "Enter a search query to generate an AI-optimized page blueprint with section hierarchy, entity graph, schema guidance, trust layers, and internal-link patterns.",
    placeholder: "e.g. best CRM software for small business",
    inputLabel: "Search Query",
    inputType: "text",
    businessValue: "Turn a query into a buildable, citation-ready page plan.",
  },
  {
    id: "model-diff",
    label: "Model Preference Diff",
    subtitle: "How models disagree",
    icon: GitCompareArrows,
    description:
      "Enter a query to see how different AI models answer it differently, where your content fits poorly, and what changes improve cross-model alignment.",
    placeholder: "e.g. how to reduce website bounce rate",
    inputLabel: "Search Query",
    inputType: "text",
    businessValue: "See blind spots before your content loses the room.",
  },
  {
    id: "simulate",
    label: "Visibility Simulator",
    subtitle: "Probabilistic impact before you ship",
    icon: AuditEngineIcon,
    description:
      "Enter a URL to simulate how structure, proof, schema, and content changes could influence AI inclusion probability and implementation priorities.",
    placeholder: "https://example.com/your-page",
    inputLabel: "Page URL",
    inputType: "text",
    businessValue: "Estimate probabilistic upside before spending time on the wrong fix.",
  },
  {
    id: "rewrite",
    label: "Brand Voice Rewrite",
    subtitle: "Rewrite content for AI citation patterns",
    icon: Wand2,
    description:
      "Paste existing content and choose a voice preset. The tool rewrites it to match the structural patterns AI models prefer when generating cited answers.",
    placeholder: "Paste your existing content here…",
    inputLabel: "Content to Rewrite",
    inputType: "textarea",
    businessValue: "Turn generic copy into AI-citation-ready content in seconds.",
  },
];

const SECTION_PRIORITY: Record<Tool, string[]> = {
  decompile: ["answer-shape", "structural-patterns", "semantic-clusters", "citation-vectors", "source-types"],
  ghost: [
    "ideal-blueprint",
    "schema-recommendations",
    "entity-graph",
    "trust-signals",
    "internal-link-pattern",
    "content-bands",
    "answer-density-map",
  ],
  "model-diff": ["recommendations", "alignment-matrix", "model-analyses", "visualization-data"],
  simulate: ["implementation-plan", "simulated-changes", "model-breakdown"],
  rewrite: ["rewritten", "changes"],
};

function getSectionOrderStorageKey(tool: Tool): string {
  return `aivis.reverseEngineer.sectionOrder.${tool}`;
}

function areOrderedKeysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function normalizeOrder(candidate: unknown, availableKeys: string[]): string[] {
  const source = Array.isArray(candidate) ? candidate : [];
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const entry of source) {
    if (typeof entry !== "string") continue;
    if (!availableKeys.includes(entry)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    ordered.push(entry);
  }

  for (const key of availableKeys) {
    if (!seen.has(key)) ordered.push(key);
  }

  return ordered;
}

function toTitle(input: string): string {
  return input
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function getVerdictFromProbability(probability?: number | null): { label: string; tone: "good" | "warn" | "neutral" } {
  if (typeof probability !== "number") return { label: "Mixed", tone: "neutral" };
  const pct = clampPercent(probability);
  if (pct >= 80) return { label: "Strong", tone: "good" };
  if (pct >= 60) return { label: "Promising", tone: "neutral" };
  if (pct >= 40) return { label: "At Risk", tone: "warn" };
  return { label: "Weak", tone: "warn" };
}

function getImpactTone(impact?: string) {
  if (impact === "high") return "text-amber-200 border-amber-400/20 bg-amber-400/10";
  if (impact === "medium") return "text-sky-200 border-sky-400/20 bg-sky-400/10";
  return "text-white/75 border-white/10 bg-charcoal-deep";
}

function collectStrings(input: unknown, max = 6): string[] {
  if (!input) return [];
  const out: string[] = [];

  const walk = (value: unknown) => {
    if (out.length >= max) return;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out.push(trimmed);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  };

  walk(input);
  return out.slice(0, max);
}

function summarizeResult(tool: Tool, result: any): {
  cards: SummaryCard[];
  insights: InsightPill[];
  verdict: { label: string; tone: "good" | "warn" | "neutral" };
  actions: PriorityAction[];
} {
  const actions: PriorityAction[] = [];
  const insights: InsightPill[] = [];
  const cards: SummaryCard[] = [];
  let verdict: { label: string; tone: "good" | "warn" | "neutral" } = { label: "Mixed", tone: "neutral" };

  if (!result || typeof result !== "object") {
    return { cards, insights, verdict, actions };
  }

  if (tool === "simulate") {
    const current = typeof result.currentProbability === "number" ? result.currentProbability : null;
    const projected = typeof result.projectedProbability === "number" ? result.projectedProbability : null;
    const uplift = typeof current === "number" && typeof projected === "number" ? projected - current : null;

    verdict = getVerdictFromProbability(projected ?? current);

    cards.push(
      { label: "Verdict", value: verdict.label, tone: verdict.tone, icon: ShieldCheck },
      { label: "Current", value: current !== null ? `${clampPercent(current)}%` : "—", icon: Gauge },
      { label: "Projected", value: projected !== null ? `${clampPercent(projected)}%` : "—", tone: projected && projected >= 0.7 ? "good" : "neutral", icon: TrendingUp },
      {
        label: "Uplift",
        value: uplift !== null ? `${uplift >= 0 ? "+" : ""}${Math.round(uplift * 100)}%` : "—",
        tone: uplift !== null && uplift > 0.15 ? "good" : uplift !== null && uplift < 0.05 ? "warn" : "neutral",
        icon: Sparkles,
      },
    );

    insights.push(
      { label: typeof uplift === "number" && uplift > 0.15 ? "High upside" : "Moderate upside", tone: uplift && uplift > 0.15 ? "good" : "neutral" },
      { label: result.modelBreakdown ? "Model-level detail available" : "Model breakdown limited", tone: result.modelBreakdown ? "good" : "warn" },
      { label: result.implementationPlan ? "Implementation path present" : "Needs implementation plan", tone: result.implementationPlan ? "good" : "warn" },
    );

    collectStrings(result.implementationPlan, 3).forEach((item) => {
      actions.push({ title: item, impact: "high" });
    });
    collectStrings(result.simulatedChanges, 2).forEach((item) => {
      actions.push({ title: item, impact: "medium" });
    });
  }

  if (tool === "ghost") {
    const probability = typeof result.estimatedInclusionProbability === "number" ? result.estimatedInclusionProbability : null;
    verdict = getVerdictFromProbability(probability);

    cards.push(
      { label: "Verdict", value: verdict.label, tone: verdict.tone, icon: ShieldCheck },
      { label: "Inclusion", value: probability !== null ? `${clampPercent(probability)}%` : "—", icon: Gauge },
      { label: "Schema", value: result.schemaRecommendations ? `${collectStrings(result.schemaRecommendations, 8).length} signals` : "—", icon: Link2 },
      { label: "Trust", value: result.trustSignals ? `${collectStrings(result.trustSignals, 8).length} layers` : "—", icon: Brain },
    );

    insights.push(
      { label: result.idealBlueprint ? "Blueprint ready" : "Blueprint thin", tone: result.idealBlueprint ? "good" : "warn" },
      { label: result.entityGraph ? "Entity graph mapped" : "Entity clarity weak", tone: result.entityGraph ? "good" : "warn" },
      { label: result.internalLinkPattern ? "Internal reinforcement present" : "Needs internal link logic", tone: result.internalLinkPattern ? "good" : "warn" },
    );

    collectStrings(result.idealBlueprint, 3).forEach((item) => {
      actions.push({ title: item, impact: "high" });
    });
    collectStrings(result.schemaRecommendations, 3).forEach((item) => {
      actions.push({ title: item, impact: "medium" });
    });
  }

  if (tool === "decompile") {
    const structureCount = collectStrings(result.structuralPatterns, 10).length;
    const clusterCount = collectStrings(result.semanticClusters, 10).length;
    const citationCount = collectStrings(result.citationVectors, 10).length;

    cards.push(
      { label: "Patterns", value: String(structureCount || 0), icon: Layers },
      { label: "Clusters", value: String(clusterCount || 0), icon: Brain },
      { label: "Citation cues", value: String(citationCount || 0), icon: FileText },
      { label: "Blueprint", value: result.reconstructionBlueprint ? "Ready" : "Partial", tone: result.reconstructionBlueprint ? "good" : "warn", icon: Wand2 },
    );

    verdict = { label: result.reconstructionBlueprint ? "Actionable" : "Mixed", tone: result.reconstructionBlueprint ? "good" : "neutral" };

    insights.push(
      { label: result.answerShape ? "Answer shape detected" : "Weak answer shape", tone: result.answerShape ? "good" : "warn" },
      { label: structureCount >= 3 ? "Reusable structure found" : "Thin structure signals", tone: structureCount >= 3 ? "good" : "warn" },
      { label: citationCount >= 2 ? "Citation vectors visible" : "Citation patterns unclear", tone: citationCount >= 2 ? "good" : "warn" },
    );

    collectStrings(result.reconstructionBlueprint, 3).forEach((item) => {
      actions.push({ title: item, impact: "high" });
    });
    collectStrings(result.structuralPatterns, 3).forEach((item) => {
      actions.push({ title: item, impact: "medium" });
    });
  }

  if (tool === "model-diff") {
    const models = Array.isArray(result.modelAnalyses) ? result.modelAnalyses.length : 0;
    const recommendations = collectStrings(result.recommendations, 8).length;
    const matrixSignals = collectStrings(result.alignmentMatrix, 12).length;

    cards.push(
      { label: "Models", value: String(models), icon: Brain },
      { label: "Alignment signals", value: String(matrixSignals), icon: Workflow },
      { label: "Recommendations", value: String(recommendations), icon: Wand2 },
      { label: "Consensus path", value: recommendations >= 3 ? "Strong" : "Partial", tone: recommendations >= 3 ? "good" : "warn", icon: ShieldCheck },
    );

    verdict = { label: recommendations >= 3 ? "Strategic" : "Mixed", tone: (recommendations >= 3 ? "good" : "neutral") as "good" | "warn" | "neutral" };

    insights.push(
      { label: models >= 2 ? "Cross-model view present" : "Limited model spread", tone: models >= 2 ? "good" : "warn" },
      { label: result.alignmentMatrix ? "Alignment matrix available" : "No alignment matrix", tone: result.alignmentMatrix ? "good" : "warn" },
      { label: recommendations >= 3 ? "Usable optimization path" : "Needs stronger recommendations", tone: recommendations >= 3 ? "good" : "warn" },
    );

    collectStrings(result.recommendations, 4).forEach((item) => {
      actions.push({ title: item, impact: "high" });
    });
    collectStrings(result.modelAnalyses, 2).forEach((item) => {
      actions.push({ title: item, impact: "medium" });
    });
  }

  return { cards: cards.slice(0, 4), insights: insights.slice(0, 4), verdict, actions: actions.slice(0, 6) };
}

function downloadTextFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugifyLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function persistReverseEngineerReport(payload: SavedReverseEngineerReport) {
  const storageKey = "aivis.reverseEngineerSavedReports";
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const next = [payload, ...list.filter((item) => item?.id !== payload.id)].slice(0, 50);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // no-op
  }
}

function buildClientReportMarkdown(tool: Tool, input: string, secondaryInput: string, result: any): string {
  const summary = summarizeResult(tool, result);
  const now = new Date().toISOString();
  const actions = summary.actions.length
    ? summary.actions.map((action, i) => `- [ ] ${i + 1}. ${action.title}${action.impact ? ` (${action.impact})` : ""}`).join("\n")
    : "- No action ladder was generated.";

  return [
    `# Reverse Engineer Client Report`,
    "",
    `- Generated: ${now}`,
    `- Tool: ${tool}`,
    `- Input: ${input}`,
    secondaryInput ? `- Secondary Input: ${secondaryInput}` : "",
    "",
    `## Verdict`,
    `- ${summary.verdict.label}`,
    "",
    `## Key Cards`,
    ...summary.cards.map((card) => `- ${card.label}: ${card.value}`),
    "",
    `## Insights`,
    ...(summary.insights.length ? summary.insights.map((pill) => `- ${pill.label}`) : ["- No insight pills generated."]),
    "",
    `## Priority Actions`,
    actions,
    "",
    `## Raw JSON`,
    "```json",
    JSON.stringify(result, null, 2),
    "```",
    "",
  ].filter(Boolean).join("\n");
}

function buildSchemaPackage(tool: Tool, input: string, result: any) {
  const schemaRecommendations = collectStrings(result?.schemaRecommendations, 10);
  const faqSeed = collectStrings(result?.answerDensityMap || result?.recommendations, 6);

  const faqEntities = faqSeed.slice(0, 4).map((text, i) => ({
    "@type": "Question",
    name: `Question ${i + 1}`,
    acceptedAnswer: {
      "@type": "Answer",
      text,
    },
  }));

  return {
    generatedAt: new Date().toISOString(),
    sourceTool: tool,
    sourceInput: input,
    recommendedTypes: schemaRecommendations,
    jsonLdTemplate: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          name: input.slice(0, 120),
          description: "Replace with page-specific description aligned with visible content.",
        },
        {
          "@type": "Service",
          name: "Replace with service name",
          serviceType: "Replace with specific service type",
          description: "Replace with verifiable service description.",
        },
        ...(faqEntities.length
          ? [
              {
                "@type": "FAQPage",
                mainEntity: faqEntities,
              },
            ]
          : []),
      ],
    },
    notes: "Validate all JSON-LD values against visible page content before publishing.",
  };
}

function buildChecklistMarkdown(tool: Tool, result: any): string {
  const summary = summarizeResult(tool, result);
  const generated = new Date().toISOString();
  const actions = summary.actions.length
    ? summary.actions
    : collectStrings(result, 6).map((item) => ({ title: item, impact: "medium" as const }));

  return [
    `# Reverse Engineer Checklist`,
    "",
    `- Generated: ${generated}`,
    `- Tool: ${tool}`,
    `- Verdict: ${summary.verdict.label}`,
    "",
    `## Checklist`,
    ...(actions.length
      ? actions.map((action, i) => `- [ ] ${i + 1}. ${action.title}${action.impact ? ` (${action.impact})` : ""}`)
      : ["- [ ] No checklist items generated."]),
    "",
  ].join("\n");
}

function buildImplementationBrief(tool: Tool, input: string, secondaryInput: string, result: any): string {
  const summary = summarizeResult(tool, result);
  const now = new Date().toISOString();
  const topActions = summary.actions.slice(0, 5);

  return [
    `# Implementation Brief`,
    "",
    `- Date: ${now}`,
    `- Workflow: Reverse Engineer (${tool})`,
    `- Primary Input: ${input}`,
    secondaryInput ? `- Secondary Input: ${secondaryInput}` : "",
    "",
    `## Executive Verdict`,
    `${summary.verdict.label}`,
    "",
    `## Why this matters now`,
    ...(summary.insights.length ? summary.insights.map((pill) => `- ${pill.label}`) : ["- Validate result quality and extract concrete implementation tasks."]),
    "",
    `## First 5 implementation moves`,
    ...(topActions.length
      ? topActions.map((action, i) => `1.${i + 1}. ${action.title}${action.impact ? ` [${action.impact}]` : ""}`)
      : ["1.1. No explicit action list returned; convert top findings into tasks."]),
    "",
    `## Raw result excerpt`,
    "```json",
    JSON.stringify(result, null, 2),
    "```",
    "",
  ].filter(Boolean).join("\n");
}

function HeaderActionBar({
  activeTool,
  result,
  onClientReport,
  onCreateSchema,
  onBuildChecklist,
}: {
  activeTool: Tool;
  result: any;
  onClientReport: () => void;
  onCreateSchema: () => void;
  onBuildChecklist: () => void;
}) {
  const planQuery = activeTool === "simulate" ? "score-fix" : "alignment";
  const canGenerateFixPack = Boolean(result);
  const lockedTitle = "Run an analysis above first to unlock this action";

  const actionBtnCls = (enabled: boolean) =>
    `inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${
      enabled
        ? "border-white/15 bg-charcoal-deep text-white/85 hover:bg-white/8 hover:border-white/25 hover:text-white active:scale-95"
        : "border-white/8 bg-charcoal-deep/50 text-white/35 cursor-not-allowed select-none"
    }`;

  return (
    <div className="rounded-2xl border border-white/10 bg-charcoal p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Turn output into action</h3>
          <p className="mt-1 text-xs leading-6 text-white/60">
            Move from analysis into implementation, export, or remediation without leaving the workflow cold.
            {!canGenerateFixPack && (
              <span className="ml-2 text-orange-400/70 font-medium">↑ Run a query first</span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            to={`/pricing?intent=${planQuery}&source=reverse-engineer`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-charcoal-deep px-3 py-2 text-xs text-white/85 transition-all hover:bg-white/8 hover:border-white/25 hover:text-white active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
            Get Fix Pack
          </Link>
          <button
            type="button"
            disabled={!canGenerateFixPack}
            onClick={canGenerateFixPack ? onClientReport : undefined}
            title={canGenerateFixPack ? "Download a formatted client-ready report" : lockedTitle}
            aria-disabled={!canGenerateFixPack}
            className={actionBtnCls(canGenerateFixPack)}
          >
            <FileText className="h-3.5 w-3.5" />
            Client Report
          </button>
          <button
            type="button"
            disabled={!canGenerateFixPack}
            onClick={canGenerateFixPack ? onCreateSchema : undefined}
            title={canGenerateFixPack ? "Export a JSON-LD schema package" : lockedTitle}
            aria-disabled={!canGenerateFixPack}
            className={actionBtnCls(canGenerateFixPack)}
          >
            <Link2 className="h-3.5 w-3.5" />
            Create Schema
          </button>
          <button
            type="button"
            disabled={!canGenerateFixPack}
            onClick={canGenerateFixPack ? onBuildChecklist : undefined}
            title={canGenerateFixPack ? "Download a prioritized checklist" : lockedTitle}
            aria-disabled={!canGenerateFixPack}
            className={actionBtnCls(canGenerateFixPack)}
          >
            <Workflow className="h-3.5 w-3.5" />
            Build Checklist
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultSection({ title, data, defaultOpen = true, whyItMatters }: SectionConfig) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy section JSON");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-charcoal">
      <div className="flex items-start justify-between gap-3 px-5 py-4 bg-charcoal-deep">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-start justify-between gap-3 text-left"
        >
          <div>
            <div className="text-sm font-semibold text-white/85">{title}</div>
            {whyItMatters && <p className="mt-1 text-xs leading-6 text-white/55">Why it matters: {whyItMatters}</p>}
          </div>
          {open ? <ChevronDown className="mt-0.5 h-4 w-4 text-white/60" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-white/60" />}
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md p-1.5 hover:bg-charcoal transition-colors"
          title="Copy JSON"
        >
          {copied ? <CheckCheck className="h-3.5 w-3.5 text-white/80" /> : <Copy className="h-3.5 w-3.5 text-white/60" />}
        </button>
      </div>

      {open && (
        <div className="overflow-x-auto px-5 py-4 bg-charcoal">
          {Array.isArray(data) ? (
            <div className="space-y-3">
              {data.map((item, i) => (
                <RenderItem key={i} item={item} />
              ))}
            </div>
          ) : typeof data === "object" && data !== null ? (
            <RenderObject obj={data as Record<string, unknown>} />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-white/75">{String(data)}</p>
          )}
        </div>
      )}
    </div>
  );
}

function RenderObject({ obj }: { obj: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(obj).map(([key, val]) => (
        <div key={key}>
          <span className="text-xs font-medium uppercase tracking-wide text-white/85">{toTitle(key)}</span>
          {typeof val === "string" || typeof val === "number" || typeof val === "boolean" ? (
            <p className="mt-0.5 text-sm text-white/75">{String(val)}</p>
          ) : Array.isArray(val) ? (
            <div className="mt-1 space-y-1.5">
              {val.map((v, i) =>
                typeof v === "string" ? (
                  <span
                    key={i}
                    className="mr-1.5 mb-1 inline-block rounded-full border border-white/10 bg-charcoal-deep px-2 py-0.5 text-xs text-white/75"
                  >
                    {v}
                  </span>
                ) : typeof v === "object" && v !== null ? (
                  <div key={i} className="rounded-lg border border-white/10 bg-charcoal-deep p-3">
                    <RenderObject obj={v as Record<string, unknown>} />
                  </div>
                ) : (
                  <span key={i} className="block text-sm text-white/75">
                    {String(v)}
                  </span>
                )
              )}
            </div>
          ) : typeof val === "object" && val !== null ? (
            <div className="mt-1 border-l-2 border-white/10 pl-3">
              <RenderObject obj={val as Record<string, unknown>} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RenderItem({ item }: { item: unknown }) {
  if (typeof item === "string") return <p className="text-sm text-white/75">{item}</p>;
  if (typeof item === "object" && item !== null) {
    return (
      <div className="rounded-lg border border-white/10 bg-charcoal-deep p-3">
        <RenderObject obj={item as Record<string, unknown>} />
      </div>
    );
  }
  return <p className="text-sm text-white/75">{String(item)}</p>;
}

function ResultSectionsOrganizer({ tool, sections }: { tool: Tool; sections: SectionConfig[] }) {
  const availableSections = React.useMemo(
    () =>
      sections.filter((section) => {
        if (!section.data) return false;
        if (Array.isArray(section.data) && section.data.length === 0) return false;
        return true;
      }),
    [sections]
  );

  const availableKeys = React.useMemo(() => availableSections.map((section) => section.key), [availableSections]);

  const buildDefaultOrder = React.useCallback(() => {
    const preferred = SECTION_PRIORITY[tool] || [];
    return normalizeOrder(preferred, availableKeys);
  }, [tool, availableKeys]);

  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => buildDefaultOrder());
  const [draggedSectionKey, setDraggedSectionKey] = useState<string | null>(null);

  React.useEffect(() => {
    const storageKey = getSectionOrderStorageKey(tool);
    const fallback = buildDefaultOrder();

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setOrderedKeys((prev) => (areOrderedKeysEqual(prev, fallback) ? prev : fallback));
        return;
      }
      const parsed = JSON.parse(raw);
      const next = normalizeOrder(parsed, availableKeys);
      setOrderedKeys((prev) => (areOrderedKeysEqual(prev, next) ? prev : next));
    } catch {
      setOrderedKeys((prev) => (areOrderedKeysEqual(prev, fallback) ? prev : fallback));
    }
  }, [tool, availableKeys, buildDefaultOrder]);

  const persistOrder = (nextOrder: string[]) => {
    const storageKey = getSectionOrderStorageKey(tool);
    const normalized = normalizeOrder(nextOrder, availableKeys);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(normalized));
    } catch {
      // no-op
    }
  };

  const moveSection = (key: string, direction: "up" | "down") => {
    setOrderedKeys((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      persistOrder(next);
      return next;
    });
  };

  const dragSection = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setOrderedKeys((prev) => {
      const fromIndex = prev.indexOf(fromKey);
      const toIndex = prev.indexOf(toKey);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persistOrder(next);
      return next;
    });
  };

  const resetOrder = () => {
    const next = buildDefaultOrder();
    setOrderedKeys(next);
    persistOrder(next);
  };

  const autoArrange = () => {
    const next = buildDefaultOrder();
    setOrderedKeys(next);
    persistOrder(next);
    toast.success("Sections auto-arranged");
  };

  const sectionByKey = new Map(availableSections.map((section) => [section.key, section] as const));
  const orderedSections = orderedKeys.map((key) => sectionByKey.get(key)).filter((section): section is SectionConfig => Boolean(section));

  if (!orderedSections.length) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-charcoal p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-white/70">Section Organization</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={autoArrange}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-charcoal-deep px-2.5 py-1.5 text-[11px] text-white/80"
            >
              <Zap className="h-3 w-3" />
              Auto Arrange
            </button>
            <button
              type="button"
              onClick={resetOrder}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-charcoal-deep px-2.5 py-1.5 text-[11px] text-white/80"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {orderedSections.map((section, index) => (
          <div
            key={section.key}
            className={`space-y-2 rounded-lg transition-colors ${draggedSectionKey === section.key ? "border border-cyan-500/25 bg-cyan-500/5 p-1.5" : ""}`}
            draggable
            onDragStart={() => setDraggedSectionKey(section.key)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!draggedSectionKey) return;
              dragSection(draggedSectionKey, section.key);
              setDraggedSectionKey(null);
            }}
            onDragEnd={() => setDraggedSectionKey(null)}
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/55">
                <GripVertical className="h-3.5 w-3.5 text-white/35" />
                {section.title}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(section.key, "up")}
                  disabled={index === 0}
                  className="rounded border border-white/10 bg-charcoal-deep p-1.5 text-white/70 disabled:opacity-40"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(section.key, "down")}
                  disabled={index === orderedSections.length - 1}
                  className="rounded border border-white/10 bg-charcoal-deep p-1.5 text-white/70 disabled:opacity-40"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <ResultSection {...section} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveSummary({ tool, input, result }: { tool: Tool; input: string; result: any }) {
  const summary = useMemo(() => summarizeResult(tool, result), [tool, result]);

  if (!result) return null;

  const toolMeta = TOOLS.find((t) => t.id === tool);
  const toolLabel = toolMeta?.label ?? tool;

  // Build a single-sentence, tool-aware interpretation
  const interpretation = (() => {
    if (tool === "decompile") {
      const bp = result?.reconstructionBlueprint;
      return bp
        ? `The AI answer you pasted follows a predictable structure. Below is the blueprint to replicate that structure on your own content — plus the specific patterns, clusters, and citation cues the model leaned on.`
        : `The answer was decomposed into its structural building blocks. Scroll down to see which patterns, topic clusters, and citation cues the model preferred.`;
    }
    if (tool === "ghost") {
      const prob = typeof result?.estimatedInclusionProbability === "number" ? Math.round(result.estimatedInclusionProbability * 100) : null;
      return prob !== null
        ? `A page built to this blueprint has an estimated ${prob}% probability of being cited in AI answers. The blueprint below gives you the exact section hierarchy, schema targets, and trust signals to build it.`
        : `The blueprint below shows you the exact page structure, heading hierarchy, entity graph, and schema targets needed for this query.`;
    }
    if (tool === "model-diff") {
      const modelCount = Array.isArray(result?.modelAnalyses) ? result.modelAnalyses.length : 0;
      return modelCount > 1
        ? `${modelCount} models were compared on the same query. Below you'll see where they agree, where they diverge, and what to change so your content performs across all of them.`
        : `Model preferences have been analyzed. See below for alignment gaps and specific recommendations.`;
    }
    if (tool === "simulate") {
      const current = typeof result?.currentProbability === "number" ? Math.round(result.currentProbability * 100) : null;
      const projected = typeof result?.projectedProbability === "number" ? Math.round(result.projectedProbability * 100) : null;
      if (current !== null && projected !== null) {
        const diff = projected - current;
        return diff > 0
          ? `Your page currently has a ${current}% inclusion probability. By implementing the changes below, you could reach ${projected}% — a ${diff}-point improvement. Start with the highest-impact change.`
          : `Your page sits at ${current}% inclusion probability. The simulation suggests limited uplift — review the specific changes to find the highest-leverage moves.`;
      }
      return `The simulation analyzed your page and projected changes that could shift AI inclusion probability. See the detailed breakdown below.`;
    }
    return "";
  })();

  return (
    <div className="space-y-4">
      {/* Main interpretation card */}
      <div className="rounded-2xl border border-white/10 bg-charcoal p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
                <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                What This Means
              </div>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  summary.verdict.tone === "good"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : summary.verdict.tone === "warn"
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                    : "border-white/10 bg-charcoal-deep text-white/75"
                }`}
              >
                {summary.verdict.label}
              </div>
            </div>
            <p className="text-sm leading-7 text-white/80">{interpretation}</p>
          </div>
        </div>

        {/* Stat cards — keep them compact */}
        {summary.cards.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg border border-white/10 bg-charcoal p-1.5">
                      <Icon className="h-3.5 w-3.5 text-white/60" />
                    </div>
                    <span className="text-xs text-white/50">{card.label}</span>
                  </div>
                  <div
                    className={`mt-2 text-xl font-bold ${
                      card.tone === "good" ? "text-emerald-200" : card.tone === "warn" ? "text-amber-200" : "text-white/85"
                    }`}
                  >
                    {card.value}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick start guide — top 3 actions only */}
      {summary.actions.length > 0 && (
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-emerald-300" />
            <h4 className="text-sm font-semibold text-emerald-100">Start Here — Your Top {Math.min(3, summary.actions.length)} Moves</h4>
          </div>
          <div className="space-y-3">
            {summary.actions.slice(0, 3).map((action, index) => (
              <div key={`${action.title}-${index}`} className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-xs font-bold text-emerald-200">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/90">{action.title}</p>
                  {action.detail && <p className="mt-0.5 text-xs text-white/55">{action.detail}</p>}
                </div>
                {action.impact && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${getImpactTone(action.impact)}`}>
                    {action.impact}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GhostRichResults({ data }: { data: any }) {
  if (!data) return null;

  const blueprint = collectStrings(data.idealBlueprint, 6);
  const schema = collectStrings(data.schemaRecommendations, 6);
  const trust = collectStrings(data.trustSignals, 6);
  const links = collectStrings(data.internalLinkPattern, 6);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-charcoal p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-white/80" />
          <h4 className="text-sm font-semibold text-white">Blueprint preview</h4>
        </div>
        <div className="mt-4 space-y-3">
          {blueprint.length ? (
            blueprint.map((item, idx) => (
              <div key={`${item}-${idx}`} className="rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75">
                {item}
              </div>
            ))
          ) : (
            <p className="text-sm text-white/55">No ideal blueprint preview available yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-charcoal p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-white/80" />
              <h4 className="text-sm font-semibold text-white">Schema targets</h4>
            </div>
            <div className="mt-3 space-y-2">
              {schema.length ? schema.map((item, idx) => <div key={`${item}-${idx}`} className="text-xs leading-6 text-white/70">• {item}</div>) : <div className="text-xs text-white/50">No schema targets returned.</div>}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-white/80" />
              <h4 className="text-sm font-semibold text-white">Trust layers</h4>
            </div>
            <div className="mt-3 space-y-2">
              {trust.length ? trust.map((item, idx) => <div key={`${item}-${idx}`} className="text-xs leading-6 text-white/70">• {item}</div>) : <div className="text-xs text-white/50">No trust layers returned.</div>}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-charcoal-deep p-4">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Internal reinforcement</h4>
          </div>
          <div className="mt-3 space-y-2">
            {links.length ? links.map((item, idx) => <div key={`${item}-${idx}`} className="text-xs leading-6 text-white/70">• {item}</div>) : <div className="text-xs text-white/50">No internal link guidance returned.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulateRichResults({ data }: { data: any }) {
  if (!data) return null;
  const current = typeof data.currentProbability === "number" ? data.currentProbability : null;
  const projected = typeof data.projectedProbability === "number" ? data.projectedProbability : null;
  const uplift = typeof current === "number" && typeof projected === "number" ? projected - current : null;
  const plan = collectStrings(data.implementationPlan, 5);
  const changes = collectStrings(data.simulatedChanges, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-charcoal p-4 text-center">
          <p className="mb-1 text-xs uppercase tracking-wide text-white/50">Current</p>
          <p className="text-3xl font-bold text-white/80">{current !== null ? `${clampPercent(current)}%` : "—"}</p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-center">
          <p className="mb-1 text-xs uppercase tracking-wide text-emerald-200/80">Projected</p>
          <p className="text-3xl font-bold text-emerald-200">{projected !== null ? `${clampPercent(projected)}%` : "—"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-charcoal p-4 text-center">
          <p className="mb-1 text-xs uppercase tracking-wide text-white/50">Uplift</p>
          <p className="text-3xl font-bold text-white/80">{uplift !== null ? `${uplift >= 0 ? "+" : ""}${Math.round(uplift * 100)}%` : "—"}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-charcoal p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Quick-win changes</h4>
          </div>
          <div className="mt-4 space-y-3">
            {changes.length ? changes.map((item, idx) => <div key={`${item}-${idx}`} className="rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75">{item}</div>) : <p className="text-sm text-white/55">No simulated changes returned.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-charcoal p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Implementation ladder</h4>
          </div>
          <div className="mt-4 space-y-3">
            {plan.length ? plan.map((item, idx) => <div key={`${item}-${idx}`} className="rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75">{item}</div>) : <p className="text-sm text-white/55">No implementation path returned.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DecompileResult({ data }: { data: any }) {
  if (!data) return null;

  const patterns: any[] = Array.isArray(data.structuralPatterns) ? data.structuralPatterns : [];
  const clusters: any[] = Array.isArray(data.semanticClusters) ? data.semanticClusters : [];
  const citations: any[] = Array.isArray(data.citationVectors) ? data.citationVectors : [];
  const sources: any[] = Array.isArray(data.sourceTypes) ? data.sourceTypes : [];
  const shape = data.answerShape && typeof data.answerShape === "object" ? data.answerShape : null;
  const blueprint = typeof data.reconstructionBlueprint === "string" ? data.reconstructionBlueprint.trim() : "";

  const patternLabel = (p: string) =>
    p?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? p;

  return (
    <div className="space-y-5">
      {/* ── Step 1: Reconstruction Blueprint — the single most actionable output ── */}
      {blueprint && (
        <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/5 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="h-5 w-5 text-emerald-300" />
            <h3 className="text-base font-semibold text-emerald-100">Reconstruction Blueprint</h3>
          </div>
          <p className="text-xs text-white/50 mb-4">This is your build guide. Follow this to replicate the answer structure on your own content.</p>
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <p className="text-sm leading-7 text-white/85 whitespace-pre-line">{blueprint}</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Answer Shape — the structural fingerprint ── */}
      {shape && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Answer Shape</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">The structural fingerprint of this answer — how the model organized density, facts, and trust signals.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {typeof shape.entityDensity === "number" && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-xs text-white/50">Entity Density</p>
                <p className="mt-1 text-lg font-bold text-white/85">{(shape.entityDensity * 100).toFixed(0)}%</p>
                <p className="mt-1 text-[11px] text-white/45">How entity-packed the answer is</p>
              </div>
            )}
            {typeof shape.factDensity === "number" && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-xs text-white/50">Fact Density</p>
                <p className="mt-1 text-lg font-bold text-white/85">{(shape.factDensity * 100).toFixed(0)}%</p>
                <p className="mt-1 text-[11px] text-white/45">Percentage that is verifiable claims</p>
              </div>
            )}
            {typeof shape.listRatio === "number" && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-xs text-white/50">List Ratio</p>
                <p className="mt-1 text-lg font-bold text-white/85">{(shape.listRatio * 100).toFixed(0)}%</p>
                <p className="mt-1 text-[11px] text-white/45">Content in list/bullet format</p>
              </div>
            )}
            {typeof shape.averageSentenceComplexity === "number" && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-xs text-white/50">Sentence Complexity</p>
                <p className="mt-1 text-lg font-bold text-white/85">{shape.averageSentenceComplexity.toFixed(1)}</p>
                <p className="mt-1 text-[11px] text-white/45">Higher = more complex sentences</p>
              </div>
            )}
          </div>
          {shape.skeleton && typeof shape.skeleton === "string" && (
            <div className="mt-4 rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <p className="text-xs font-medium text-white/60 mb-2">Answer Skeleton</p>
              <p className="text-sm leading-7 text-white/75 whitespace-pre-line">{shape.skeleton}</p>
            </div>
          )}
          {Array.isArray(shape.trustSignalPlacement) && shape.trustSignalPlacement.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-white/50 self-center mr-1">Trust signals found at:</span>
              {shape.trustSignalPlacement.map((s: string, i: number) => (
                <span key={i} className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] text-cyan-200">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Structural Patterns — what format the model preferred ── */}
      {patterns.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Structural Patterns</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">The answer formats the model relied on. Replicate these patterns in your own content.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {patterns.map((p, i) => {
              const name = typeof p === "string" ? p : (p?.pattern ?? p?.name ?? `Pattern ${i + 1}`);
              const weight = typeof p?.weight === "number" ? p.weight : null;
              const freq = typeof p?.frequency === "number" ? p.frequency : null;
              const position = p?.positionBias;
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-sm font-medium text-white/90">{patternLabel(name)}</h5>
                    {weight !== null && (
                      <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/60">
                        Weight: {(weight * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {freq !== null && (
                      <span className="text-xs text-white/55">Used {freq}× in the answer</span>
                    )}
                    {position && (
                      <span className="inline-flex rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">
                        Position: {position}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 4: Semantic Clusters — topic groupings ── */}
      {clusters.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Semantic Clusters</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Topic groups the model bundled together. Your content should cover these clusters to be citation-worthy.</p>
          <div className="space-y-3">
            {clusters.map((c, i) => {
              const topic = typeof c === "string" ? c : (c?.topic ?? `Cluster ${i + 1}`);
              const entities: string[] = Array.isArray(c?.entities) ? c.entities : [];
              const relationships: string[] = Array.isArray(c?.relationships) ? c.relationships : [];
              const density = typeof c?.density === "number" ? c.density : null;
              const contribution = typeof c?.answerContribution === "number" ? c.answerContribution : null;
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-sm font-medium text-white/90">{topic}</h5>
                    <div className="flex gap-2">
                      {density !== null && (
                        <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">
                          Density: {(density * 100).toFixed(0)}%
                        </span>
                      )}
                      {contribution !== null && (
                        <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200/80">
                          {(contribution * 100).toFixed(0)}% of answer
                        </span>
                      )}
                    </div>
                  </div>
                  {entities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entities.map((e, j) => (
                        <span key={j} className="rounded-md border border-white/10 bg-charcoal px-2 py-0.5 text-[11px] text-white/70">{e}</span>
                      ))}
                    </div>
                  )}
                  {relationships.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] text-white/40 uppercase tracking-wide">Relationships: </span>
                      <span className="text-xs text-white/60">{relationships.join(" → ")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 5: Citation Vectors — what makes content quotable ── */}
      {citations.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Citation Vectors</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">What makes content quotable by AI. The "missing" items are gaps you should fill on your site.</p>
          <div className="space-y-3">
            {citations.map((cv, i) => {
              const contentType = typeof cv === "string" ? cv : (cv?.contentType ?? `Vector ${i + 1}`);
              const probability = typeof cv?.probability === "number" ? cv.probability : null;
              const required: string[] = Array.isArray(cv?.requiredSignals) ? cv.requiredSignals : [];
              const missing: string[] = Array.isArray(cv?.missingFromYourContent) ? cv.missingFromYourContent : [];
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h5 className="text-sm font-medium text-white/90">{patternLabel(contentType)}</h5>
                    {probability !== null && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        probability >= 0.7 ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                        : probability >= 0.4 ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                        : "border-white/10 bg-charcoal text-white/60"
                      }`}>
                        {Math.round(probability * 100)}% citation probability
                      </span>
                    )}
                  </div>
                  {required.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] text-white/40 uppercase tracking-wide">Required signals: </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {required.map((r, j) => (
                          <span key={j} className="rounded-md border border-emerald-400/15 bg-emerald-400/5 px-2 py-0.5 text-[11px] text-emerald-200/80">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {missing.length > 0 && (
                    <div>
                      <span className="text-[10px] text-red-300/60 uppercase tracking-wide">Missing from your content: </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {missing.map((m, j) => (
                          <span key={j} className="rounded-md border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-200/80">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 6: Source Types — what kind of source the model leaned on ── */}
      {sources.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Source Types Detected</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">The kinds of sources the AI drew from. Match these archetypes to increase your citation rate.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {sources.map((s, i) => {
              const type = typeof s === "string" ? s : (s?.type ?? `Source ${i + 1}`);
              const confidence = typeof s?.confidence === "number" ? s.confidence : null;
              const indicators: string[] = Array.isArray(s?.indicators) ? s.indicators : [];
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-sm font-medium text-white/90">{patternLabel(type)}</h5>
                    {confidence !== null && (
                      <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  {indicators.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {indicators.map((ind, j) => (
                        <span key={j} className="text-xs text-white/55">• {ind}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GhostResult({ data }: { data: any }) {
  if (!data) return null;

  const bp = data.idealBlueprint;
  const entities: any[] = Array.isArray(data.entityGraph) ? data.entityGraph : [];
  const densityMap: any[] = Array.isArray(data.answerDensityMap) ? data.answerDensityMap : [];
  const trust: any[] = Array.isArray(data.trustSignals) ? data.trustSignals : [];
  const contentBands: any[] = Array.isArray(data.contentBands) ? data.contentBands : [];
  const schemas: any[] = Array.isArray(data.schemaRecommendations) ? data.schemaRecommendations : [];
  const linkPattern = data.internalLinkPattern;
  const prob = typeof data.estimatedInclusionProbability === "number" ? data.estimatedInclusionProbability : null;

  const priorityColor = (p: string) => {
    if (p === "critical" || p === "required") return "border-red-400/20 bg-red-400/10 text-red-200";
    if (p === "important" || p === "recommended") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    return "border-white/10 bg-charcoal text-white/60";
  };

  const renderSections = (sections: any[], depth = 0): React.ReactNode =>
    sections.map((s: any, i: number) => (
      <div key={i} className={`${depth > 0 ? "ml-4 border-l-2 border-white/10 pl-4" : ""}`}>
        <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4 mb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/30">H{s.level || (depth + 1)}</span>
              <h5 className="text-sm font-medium text-white/90">{s.heading || `Section ${i + 1}`}</h5>
            </div>
            <div className="flex gap-2">
              {s.purpose && (
                <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">{s.purpose}</span>
              )}
              {typeof s.targetWordCount === "number" && (
                <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">~{s.targetWordCount} words</span>
              )}
            </div>
          </div>
          {s.contentGuidance && (
            <p className="mt-2 text-xs leading-6 text-white/60">{s.contentGuidance}</p>
          )}
          {Array.isArray(s.requiredEntities) && s.requiredEntities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-white/40 self-center">Must mention:</span>
              {s.requiredEntities.map((e: string, j: number) => (
                <span key={j} className="rounded-md border border-cyan-400/15 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200/80">{e}</span>
              ))}
            </div>
          )}
        </div>
        {Array.isArray(s.children) && s.children.length > 0 && renderSections(s.children, depth + 1)}
      </div>
    ));

  return (
    <div className="space-y-5">
      {/* ── Inclusion probability hero ── */}
      {prob !== null && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/10 bg-charcoal-deep">
              <span className={`text-3xl font-bold ${prob >= 0.7 ? "text-emerald-200" : prob >= 0.4 ? "text-amber-200" : "text-white/70"}`}>
                {Math.round(prob * 100)}%
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Estimated AI Inclusion Probability</h3>
            <p className="mt-1 text-sm text-white/60">
              {prob >= 0.7
                ? "Strong probability. A page built to this blueprint would likely be cited by AI models."
                : prob >= 0.4
                ? "Moderate probability. The blueprint below will show you how to close the gap."
                : "Low probability. Follow the blueprint carefully — every section matters."}
            </p>
          </div>
        </div>
      )}

      {/* ── Page Blueprint — the core deliverable ── */}
      {bp && typeof bp === "object" && (
        <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/5 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="h-5 w-5 text-emerald-300" />
            <h3 className="text-base font-semibold text-emerald-100">Page Blueprint</h3>
          </div>
          <p className="text-xs text-white/50 mb-5">Build this page exactly as described below. Each section has a purpose, word count target, and required entities.</p>

          {/* Meta block */}
          <div className="grid gap-3 sm:grid-cols-2 mb-5">
            {bp.title && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Title Tag</p>
                <p className="mt-1 text-sm font-medium text-white/85">{bp.title}</p>
              </div>
            )}
            {bp.metaDescription && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Meta Description</p>
                <p className="mt-1 text-sm text-white/75">{bp.metaDescription}</p>
              </div>
            )}
            {bp.h1 && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">H1 Heading</p>
                <p className="mt-1 text-sm font-semibold text-white/85">{bp.h1}</p>
              </div>
            )}
            {bp.wordCountTarget && (
              <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Word Count Target</p>
                <p className="mt-1 text-sm text-white/85">
                  {bp.wordCountTarget.optimal || bp.wordCountTarget.min}
                  {bp.wordCountTarget.max ? `–${bp.wordCountTarget.max}` : ""} words
                </p>
              </div>
            )}
          </div>

          {/* Opening paragraph */}
          {bp.openingParagraph && (
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4 mb-4">
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">Opening Paragraph Guidance</p>
              <p className="text-sm leading-7 text-white/75">{bp.openingParagraph}</p>
            </div>
          )}

          {/* Section hierarchy */}
          {Array.isArray(bp.sectionHierarchy) && bp.sectionHierarchy.length > 0 && (
            <div>
              <p className="text-xs font-medium text-white/60 mb-3">Section Hierarchy</p>
              {renderSections(bp.sectionHierarchy)}
            </div>
          )}

          {/* Closing CTA */}
          {bp.closingCTA && (
            <div className="mt-4 rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">Closing CTA</p>
              <p className="text-sm leading-7 text-white/75">{bp.closingCTA}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Entity Graph ── */}
      {entities.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Entity Graph</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Entities and relationships your page must make explicit for AI models to extract cleanly.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {entities.map((e, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-medium text-white/90">{e.entity || `Entity ${i + 1}`}</h5>
                  <div className="flex gap-2">
                    {e.type && <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">{e.type}</span>}
                    {typeof e.importance === "number" && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        e.importance >= 0.8 ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                        : e.importance >= 0.5 ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                        : "border-white/10 bg-charcoal text-white/55"
                      }`}>
                        Importance: {Math.round(e.importance * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                {Array.isArray(e.relationships) && e.relationships.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {e.relationships.map((r: any, j: number) => (
                      <p key={j} className="text-xs text-white/55">
                        → {typeof r === "string" ? r : `${r.relationship || "relates to"} ${r.target || ""}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Schema Recommendations ── */}
      {schemas.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Schema Recommendations</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Add these JSON-LD schema types to make your page machine-readable.</p>
          <div className="space-y-3">
            {schemas.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h5 className="text-sm font-medium text-white/90">{s.schemaType || `Schema ${i + 1}`}</h5>
                  <div className="flex gap-2">
                    {s.priority && <span className={`rounded-full border px-2 py-0.5 text-[10px] ${priorityColor(s.priority)}`}>{s.priority}</span>}
                    {typeof s.inclusionImpact === "number" && (
                      <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">
                        +{Math.round(s.inclusionImpact * 100)}% inclusion
                      </span>
                    )}
                  </div>
                </div>
                {s.properties && typeof s.properties === "object" && Object.keys(s.properties).length > 0 && (
                  <div className="mt-2 grid gap-1">
                    {Object.entries(s.properties).map(([key, val]) => (
                      <div key={key} className="flex gap-2 text-xs">
                        <span className="text-white/40 font-mono">{key}:</span>
                        <span className="text-white/65">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Trust Signals ── */}
      {trust.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Trust Signals</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Proof elements that increase AI confidence in your content.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trust.map((t, i) => {
              const signal = typeof t === "string" ? t : (t?.signal ?? `Signal ${i + 1}`);
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5">
                  <h5 className="text-sm font-medium text-white/85">{typeof signal === "string" ? signal.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : signal}</h5>
                  {t?.placement && <p className="mt-1 text-xs text-white/50">Place in: {t.placement}</p>}
                  {typeof t?.impact === "number" && (
                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${Math.round(t.impact * 100)}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Content Bands ── */}
      {contentBands.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Content Bands</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Word count zones for each section. Stay within optimal ranges.</p>
          <div className="space-y-2">
            {contentBands.map((b, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h5 className="text-sm font-medium text-white/85">{b.section || `Band ${i + 1}`}</h5>
                  {b.reasoning && <p className="text-xs text-white/50 mt-0.5">{b.reasoning}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white/85">{b.optimalWords || b.minWords}–{b.maxWords} words</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Internal Link Pattern ── */}
      {linkPattern && typeof linkPattern === "object" && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Workflow className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Internal Link Pattern</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">How to reinforce this page with your site's internal link structure.</p>
          {linkPattern.hubStructure && (
            <div className="mb-3">
              <span className="text-xs text-white/40">Recommended structure: </span>
              <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] text-cyan-200/80">
                {String(linkPattern.hubStructure).replace(/_/g, " ")}
              </span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.isArray(linkPattern.internalLinks) && linkPattern.internalLinks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-white/60 mb-2">Internal Links</p>
                <div className="space-y-2">
                  {linkPattern.internalLinks.map((link: any, i: number) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-charcoal-deep p-3 text-xs">
                      <span className="font-medium text-white/80">{link.anchor || "Link"}</span>
                      {link.targetType && <span className="text-white/45"> → {link.targetType}</span>}
                      {link.placement && <span className="text-white/35"> ({link.placement})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(linkPattern.externalAuthority) && linkPattern.externalAuthority.length > 0 && (
              <div>
                <p className="text-xs font-medium text-white/60 mb-2">External Authority Links</p>
                <div className="space-y-2">
                  {linkPattern.externalAuthority.map((link: any, i: number) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-charcoal-deep p-3 text-xs">
                      <span className="font-medium text-white/80">{link.domain || "Domain"}</span>
                      {link.purpose && <span className="text-white/45"> — {link.purpose}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Answer Density Map ── */}
      {densityMap.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Answer Density Map</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Subtopics that must be covered and their priority.</p>
          <div className="space-y-2">
            {densityMap.map((d, i) => {
              const coverage = typeof d.requiredCoverage === "number" ? d.requiredCoverage : null;
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-3.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/85">{d.subtopic || `Topic ${i + 1}`}</span>
                    {d.priority && <span className={`rounded-full border px-2 py-0.5 text-[10px] ${priorityColor(d.priority)}`}>{d.priority}</span>}
                  </div>
                  {coverage !== null && (
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-400/60" style={{ width: `${Math.round(coverage * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-white/50">{Math.round(coverage * 100)}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelDiffResult({ data }: { data: any }) {
  const analyses: any[] = Array.isArray(data?.modelAnalyses) ? data.modelAnalyses : [];
  const matrix: any[] = Array.isArray(data?.alignmentMatrix) ? data.alignmentMatrix : [];
  const recs: any[] = Array.isArray(data?.recommendations) ? data.recommendations : [];

  const effortColor = (e: string) => {
    const low = /low|easy|quick/i.test(String(e));
    const high = /high|hard|complex/i.test(String(e));
    return low ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : high ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-amber-400/20 bg-amber-400/10 text-amber-200";
  };

  return (
    <div className="space-y-5">
      {/* ── Recommendations hero — actionable first ── */}
      {recs.length > 0 && (
        <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/5 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="h-5 w-5 text-emerald-300" />
            <h3 className="text-base font-semibold text-emerald-100">What To Do Differently</h3>
          </div>
          <p className="text-xs text-white/50 mb-4">Actionable changes based on how each model disagrees about your content.</p>
          <div className="space-y-3">
            {recs.map((r: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 text-xs font-bold text-emerald-200">{i + 1}</span>
                    <h5 className="text-sm font-medium text-white/90">{r.action || `Action ${i + 1}`}</h5>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {r.model && <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">{r.model}</span>}
                    {r.effort && <span className={`rounded-full border px-2 py-0.5 text-[10px] ${effortColor(r.effort)}`}>{r.effort} effort</span>}
                    {r.impact && <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200/80">{r.impact} impact</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Model-by-Model Analysis ── */}
      {analyses.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <GitCompareArrows className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Model-by-Model Breakdown</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">How each AI model approaches the same query differently.</p>
          <div className="space-y-4">
            {analyses.map((entry: any, idx: number) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-charcoal-deep p-5">
                <h5 className="text-sm font-semibold text-white/90 mb-4">{entry.model || `Model ${idx + 1}`}</h5>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Emphasis */}
                  {Array.isArray(entry.emphasis) && entry.emphasis.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">Emphasizes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.emphasis.map((e: string, i: number) => (
                          <span key={i} className="rounded-md border border-emerald-400/15 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200/80">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ignored */}
                  {Array.isArray(entry.ignored) && entry.ignored.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">Ignores / De-prioritizes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.ignored.map((e: string, i: number) => (
                          <span key={i} className="rounded-md border border-red-400/15 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-200/80">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Bias */}
                  {Array.isArray(entry.sourceBias) && entry.sourceBias.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">Source Preferences</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.sourceBias.map((e: string, i: number) => (
                          <span key={i} className="rounded-md border border-white/10 bg-charcoal px-2 py-0.5 text-[11px] text-white/60">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structural Preference */}
                  {Array.isArray(entry.structuralPreference) && entry.structuralPreference.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">Structural Preferences</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.structuralPreference.map((e: string, i: number) => (
                          <span key={i} className="rounded-md border border-white/10 bg-charcoal px-2 py-0.5 text-[11px] text-white/60">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Answer style & citation behavior */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {entry.answerStyle && (
                    <div className="rounded-lg border border-white/10 bg-charcoal p-3">
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Answer Style</p>
                      <p className="text-xs text-white/70">{entry.answerStyle}</p>
                    </div>
                  )}
                  {entry.citationBehavior && (
                    <div className="rounded-lg border border-white/10 bg-charcoal p-3">
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Citation Behavior</p>
                      <p className="text-xs text-white/70">{entry.citationBehavior}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alignment Matrix ── */}
      {matrix.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">How Your Content Aligns</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Per-model alignment score with gaps and strengths.</p>
          <div className="space-y-4">
            {matrix.map((m: any, i: number) => {
              const score = typeof m.yourContentScore === "number" ? m.yourContentScore : null;
              const gaps: string[] = Array.isArray(m.gaps) ? m.gaps : [];
              const strengths: string[] = Array.isArray(m.strengths) ? m.strengths : [];
              const invisible: string[] = Array.isArray(m.invisibilityReasons) ? m.invisibilityReasons : [];
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-5">
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <h5 className="text-sm font-semibold text-white/90">{m.model || `Model ${i + 1}`}</h5>
                    {score !== null && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full rounded-full ${
                            score >= 0.7 ? "bg-emerald-400/70" : score >= 0.4 ? "bg-amber-400/70" : "bg-red-400/70"
                          }`} style={{ width: `${Math.round(score * 100)}%` }} />
                        </div>
                        <span className="text-sm font-bold text-white/80">{Math.round(score * 100)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {strengths.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-emerald-300/60 mb-2">Strengths</p>
                        <div className="space-y-1">
                          {strengths.map((s, j) => (
                            <p key={j} className="text-xs text-white/70 flex items-start gap-1.5">
                              <span className="text-emerald-300 mt-0.5">✓</span> {s}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {gaps.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-red-300/60 mb-2">Gaps</p>
                        <div className="space-y-1">
                          {gaps.map((g, j) => (
                            <p key={j} className="text-xs text-white/70 flex items-start gap-1.5">
                              <span className="text-red-300 mt-0.5">✗</span> {g}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {invisible.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-wide text-amber-300/60 mb-2">Why You're Invisible</p>
                      <div className="space-y-1">
                        {invisible.map((r, j) => (
                          <p key={j} className="text-xs text-white/60 flex items-start gap-1.5">
                            <CircleAlert className="h-3 w-3 text-amber-300 mt-0.5 flex-shrink-0" /> {r}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SimulateResult({ data }: { data: any }) {
  const changes: any[] = Array.isArray(data?.simulatedChanges) ? data.simulatedChanges : [];
  const breakdown: any[] = Array.isArray(data?.modelBreakdown) ? data.modelBreakdown : [];
  const plan: any[] = Array.isArray(data?.implementationPlan) ? data.implementationPlan : [];
  const current = typeof data?.currentProbability === "number" ? data.currentProbability : null;
  const projected = typeof data?.projectedProbability === "number" ? data.projectedProbability : null;
  const ci = data?.confidenceInterval;
  const delta = current !== null && projected !== null ? projected - current : null;

  const probBar = (val: number, accent: string) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.round(val * 100)}%` }} />
      </div>
      <span className="text-sm font-bold text-white/85 min-w-[3rem] text-right">{Math.round(val * 100)}%</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Probability summary hero ── */}
      {(current !== null || projected !== null) && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white mb-5">Visibility Probability</h3>
          <div className="space-y-4">
            {current !== null && (
              <div>
                <p className="text-xs text-white/50 mb-1.5">Current</p>
                {probBar(current, "bg-white/30")}
              </div>
            )}
            {projected !== null && (
              <div>
                <p className="text-xs text-white/50 mb-1.5">Projected (after changes)</p>
                {probBar(projected, delta !== null && delta > 0 ? "bg-emerald-400/70" : "bg-amber-400/70")}
              </div>
            )}
          </div>
          {delta !== null && (
            <div className={`mt-4 flex items-center gap-2 rounded-xl border p-3 ${
              delta > 0 ? "border-emerald-400/15 bg-emerald-400/5" : delta < 0 ? "border-red-400/15 bg-red-400/5" : "border-white/10 bg-charcoal-deep"
            }`}>
              {delta > 0 ? <TrendingUp className="h-4 w-4 text-emerald-300" /> : delta < 0 ? <ArrowDown className="h-4 w-4 text-red-300" /> : <Activity className="h-4 w-4 text-white/50" />}
              <span className={`text-sm font-semibold ${delta > 0 ? "text-emerald-200" : delta < 0 ? "text-red-200" : "text-white/60"}`}>
                {delta > 0 ? "+" : ""}{Math.round(delta * 100)} percentage points
              </span>
              {ci && typeof ci.low === "number" && typeof ci.high === "number" && (
                <span className="text-xs text-white/40 ml-auto">Confidence: {Math.round(ci.low * 100)}–{Math.round(ci.high * 100)}%</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Implementation Plan hero ── */}
      {plan.length > 0 && (
        <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/5 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="h-5 w-5 text-emerald-300" />
            <h3 className="text-base font-semibold text-emerald-100">Implementation Plan</h3>
          </div>
          <p className="text-xs text-white/50 mb-4">Execute in this order for the best cumulative impact.</p>
          <div className="space-y-3">
            {plan.map((step: any, i: number) => {
              const cumProb = typeof step.cumulativeProbability === "number" ? step.cumulativeProbability : null;
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-xs font-bold text-emerald-200 flex-shrink-0 mt-0.5">
                      {step.order || i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h5 className="text-sm font-medium text-white/90">{step.action || `Step ${i + 1}`}</h5>
                        {step.timeEstimate && (
                          <span className="rounded-full border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/55">{step.timeEstimate}</span>
                        )}
                      </div>
                      {step.element && <p className="text-xs text-white/50 mt-0.5">Element: {step.element}</p>}
                      {cumProb !== null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-400/50" style={{ width: `${Math.round(cumProb * 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-white/50">{Math.round(cumProb * 100)}% cumulative</span>
                        </div>
                      )}
                      {Array.isArray(step.technicalRequirements) && step.technicalRequirements.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {step.technicalRequirements.map((req: string, j: number) => (
                            <span key={j} className="rounded-md border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/50">{req}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Simulated Changes ── */}
      {changes.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Simulated Changes</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Each change and its estimated impact on visibility probability.</p>
          <div className="space-y-3">
            {changes.map((c: any, i: number) => {
              const d = typeof c.probabilityDelta === "number" ? c.probabilityDelta : null;
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <h5 className="text-sm font-medium text-white/90">{c.element || `Change ${i + 1}`}</h5>
                    <div className="flex gap-2">
                      {d !== null && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          d > 0 ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : d < 0 ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-white/10 bg-charcoal text-white/55"
                        }`}>
                          {d > 0 ? "+" : ""}{Math.round(d * 100)}%
                        </span>
                      )}
                      {c.effort && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          /low|easy/i.test(c.effort) ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : /high|hard/i.test(c.effort) ? "border-red-400/20 bg-red-400/10 text-red-200"
                          : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                        }`}>{c.effort}</span>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {c.currentState && (
                      <div className="rounded-lg border border-white/10 bg-charcoal p-2.5">
                        <p className="text-[10px] text-white/40 mb-0.5">Current</p>
                        <p className="text-xs text-white/65">{c.currentState}</p>
                      </div>
                    )}
                    {c.proposedState && (
                      <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/5 p-2.5">
                        <p className="text-[10px] text-emerald-300/60 mb-0.5">Proposed</p>
                        <p className="text-xs text-white/70">{c.proposedState}</p>
                      </div>
                    )}
                  </div>
                  {Array.isArray(c.dependencies) && c.dependencies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-white/40 self-center">Depends on:</span>
                      {c.dependencies.map((dep: string, j: number) => (
                        <span key={j} className="rounded-md border border-white/10 bg-charcoal px-2 py-0.5 text-[10px] text-white/50">{dep}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Model Breakdown ── */}
      {breakdown.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Model Breakdown</h4>
          </div>
          <p className="text-xs text-white/50 mb-4">Before and after visibility per AI model.</p>
          <div className="space-y-2">
            {breakdown.map((m: any, i: number) => {
              const before = typeof m.before === "number" ? m.before : null;
              const after = typeof m.after === "number" ? m.after : null;
              const change = before !== null && after !== null ? after - before : null;
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-charcoal-deep p-4 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-medium text-white/85">{m.model || `Model ${i + 1}`}</span>
                  <div className="flex items-center gap-4 text-xs">
                    {before !== null && <span className="text-white/55">{Math.round(before * 100)}%</span>}
                    {before !== null && after !== null && <span className="text-white/30">→</span>}
                    {after !== null && <span className="text-white/80 font-medium">{Math.round(after * 100)}%</span>}
                    {change !== null && (
                      <span className={`font-bold ${change > 0 ? "text-emerald-300" : change < 0 ? "text-red-300" : "text-white/40"}`}>
                        ({change > 0 ? "+" : ""}{Math.round(change * 100)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RewriteResult({ data }: { data: any }) {
  const [copied, setCopied] = useState(false);
  if (!data?.rewritten) return null;
  const changes: string[] = Array.isArray(data.changes) ? data.changes : [];
  const preset: string = data.preset || "authoritative";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.rewritten);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Wand2 className="h-5 w-5 shrink-0 text-emerald-300" />
            <h3 className="text-sm sm:text-base font-semibold text-emerald-100 truncate">Rewritten Content</h3>
            <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] text-cyan-200">
              {preset.replace(/_/g, " ")}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-md p-2 hover:bg-charcoal-deep transition-colors"
            title="Copy rewritten content"
          >
            {copied ? (
              <CheckCheck className="h-4 w-4 text-white/80" />
            ) : (
              <Copy className="h-4 w-4 text-white/60" />
            )}
          </button>
        </div>
        <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
          <p className="text-sm leading-7 text-white/85 whitespace-pre-wrap">{data.rewritten}</p>
        </div>
      </div>

      {changes.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">What Changed</h4>
          </div>
          <div className="space-y-2">
            {changes.map((change, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400/70" />
                {change}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReverseEngineerPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: "Reverse Engineer",
    description: "Deconstruct how AI models build answers. Decompile, blueprint, diff, and simulate tools for AI content engineering.",
    path: "/reverse-engineer",
  });

  const hasAccess = meetsMinimumTier(user?.tier || "observer", "alignment");
  const isSignalTier = user?.tier === "signal" || user?.tier === "scorefix";

  const [activeTool, setActiveTool] = useState<Tool>("decompile");
  const [input, setInput] = useState("");
  const [secondaryInput, setSecondaryInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentInputs, setRecentInputs] = useState<Array<{ tool: Tool; input: string; secondary?: string }>>([]);

  const exportBasename = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    const toolSlug = slugifyLabel(activeTool);
    return `reverse-engineer-${toolSlug}-${stamp}`;
  }, [activeTool]);

  const normalizeLikelyUrl = (raw: string): string | null => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return null;
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      if (!parsed.hostname || !parsed.hostname.includes(".")) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const primaryInput = input.trim();
  const simulateUrlError =
    activeTool === "simulate" && primaryInput && !normalizeLikelyUrl(primaryInput)
      ? "Enter a valid URL or domain (example.com or https://example.com/page)."
      : null;
  const canRun = !loading && !!primaryInput && !simulateUrlError;

  React.useEffect(() => {
    if (!isAuthenticated) navigate("/auth?mode=signin");
  }, [isAuthenticated, navigate]);

  const currentTool = TOOLS.find((t) => t.id === activeTool)!;

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem("aivis.reverseEngineerRecent");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setRecentInputs(parsed.slice(0, 6));
    } catch {
      // no-op
    }
  }, []);

  const handleRun = async () => {
    if (!input.trim()) {
      toast.error("Please provide input");
      return;
    }

    if (activeTool === "simulate" && !normalizeLikelyUrl(input)) {
      toast.error("Please enter a valid URL or domain for simulation");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let data: any;

      switch (activeTool) {
        case "decompile":
          data = await apiPost("/api/reverse-engineer/decompile", {
            answer: input.trim(),
          });
          break;
        case "ghost":
          data = await apiPost("/api/reverse-engineer/ghost", {
            query: input.trim(),
          });
          break;
        case "model-diff":
          data = await apiPost("/api/reverse-engineer/model-diff", {
            query: input.trim(),
            contentSummary: secondaryInput.trim() || undefined,
          });
          break;
        case "simulate": {
          const normalizedUrl = normalizeLikelyUrl(input.trim());
          if (!normalizedUrl) throw new Error("Invalid URL for simulation");
          data = await apiPost("/api/reverse-engineer/simulate", {
            url: normalizedUrl,
            targetQuery: secondaryInput.trim() || undefined,
          });
          break;
        }
        case "rewrite": {
          const VALID_PRESETS = ["authoritative", "conversational", "data_driven", "how_to", "faq"];
          const preset = VALID_PRESETS.includes(secondaryInput.trim()) ? secondaryInput.trim() : "authoritative";
          data = await apiPost("/api/reverse-engineer/rewrite", {
            content: input.trim(),
            voicePreset: preset,
          });
          break;
        }
      }

      setResult(data);
      setRecentInputs((prev) => {
        const normalizedSecondary = secondaryInput.trim() || undefined;
        const next = [
          { tool: activeTool, input: input.trim(), secondary: normalizedSecondary },
          ...prev.filter(
            (entry) => !(entry.tool === activeTool && entry.input === input.trim() && entry.secondary === normalizedSecondary)
          ),
        ].slice(0, 6);
        try {
          window.localStorage.setItem("aivis.reverseEngineerRecent", JSON.stringify(next));
        } catch {
          // no-op
        }
        return next;
      });
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (tool: Tool) => {
    setActiveTool(tool);
    setInput("");
    setSecondaryInput(tool === "rewrite" ? "authoritative" : "");
    setResult(null);
    setError(null);

    if (tool === "simulate" && latestResult?.url) setInput(latestResult.url);
  };

  const applyExample = () => {
    const template = TOOL_EXAMPLES[activeTool];
    if (!template) return;
    setInput(template.input);
    setSecondaryInput(template.secondary || "");
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        toast.error("Clipboard is empty");
        return;
      }
      setInput(text.trim());
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Clipboard paste unavailable on this device/browser");
    }
  };

  const copyResultJson = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      toast.success("Result JSON copied");
    } catch {
      toast.error("Could not copy result JSON");
    }
  };

  const downloadResultJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reverse-engineer-${activeTool}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClientReport = () => {
    if (!result) return;
    const report = buildClientReportMarkdown(activeTool, primaryInput, secondaryInput.trim(), result);
    downloadTextFile(`${exportBasename}-client-report.md`, report, "text/markdown");
    toast.success("Client report generated");
  };

  const handleCreateSchema = () => {
    if (!result) return;
    const schemaPack = buildSchemaPackage(activeTool, primaryInput, result);
    downloadTextFile(`${exportBasename}-schema-pack.json`, JSON.stringify(schemaPack, null, 2), "application/json");
    toast.success("Schema package exported");
  };

  const handleBuildChecklist = () => {
    if (!result) return;
    const checklist = buildChecklistMarkdown(activeTool, result);
    downloadTextFile(`${exportBasename}-checklist.md`, checklist, "text/markdown");
    toast.success("Checklist generated");
  };

  const handleSaveToReports = () => {
    if (!result) return;
    const item: SavedReverseEngineerReport = {
      id: `${activeTool}-${Date.now()}`,
      tool: activeTool,
      input: primaryInput,
      secondaryInput: secondaryInput.trim() || undefined,
      createdAt: new Date().toISOString(),
      result,
    };
    persistReverseEngineerReport(item);
    toast.success("Saved to reverse-engineer reports");
  };

  const handleImplementationBrief = () => {
    if (!result) return;
    const brief = buildImplementationBrief(activeTool, primaryInput, secondaryInput.trim(), result);
    downloadTextFile(`${exportBasename}-implementation-brief.md`, brief, "text/markdown");
    toast.success("Implementation brief generated");
  };

  return (
    <div className="space-y-6">

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
          <FlaskConical className="h-5 w-5 text-slate-400" />
          Reverse Engineer
        </h1>
        <p className="mt-1 text-sm text-slate-400">Deconstruct AI answers, generate page blueprints, compare models, and simulate probabilistic visibility impact.</p>
      </div>

      <div className="space-y-6">
        {!hasAccess ? (
          <UpgradeWall
            feature="Reverse Engineer Tools"
            description="Decompile AI answers, generate content blueprints, compare model preferences, and simulate visibility changes."
            requiredTier="alignment"
            icon={<FlaskConical className="h-12 w-12 text-white/80" />}
            featurePreview={[
              "Decompose how any AI answer is structured to replicate it",
              "Generate competitor content blueprints from live URLs",
              "Simulate what content changes would do to your citation probability",
            ]}
          />
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-white/10 bg-charcoal p-5 sm:p-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  Intelligence Workbench
                </div>
                <h2 className="mt-3 text-2xl brand-title">Stop reading outputs like logs. Read them like leverage.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                  This page is designed to turn model behavior into decisions. Run a query, extract the signal, then route the result into blueprinting, remediation, or execution.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-charcoal p-5 sm:p-6">
                <div className="text-xs uppercase tracking-wide text-white/45">Access</div>
                <div className="mt-2 text-sm font-semibold text-white/85">
                  {isSignalTier ? (user?.tier === "scorefix" ? "Score Fix advanced workflows" : "Signal advanced workflows") : "Alignment tier access"}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                    <div className="text-xs uppercase tracking-wide text-white/45">Tools</div>
                    <div className="mt-2 text-xl font-bold text-white/85">4</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
                    <div className="text-xs uppercase tracking-wide text-white/45">Recent memory</div>
                    <div className="mt-2 text-xl font-bold text-white/85">{recentInputs.length}</div>
                  </div>
                </div>
              </div>
            </div>

            <HeaderActionBar
              activeTool={activeTool}
              result={result}
              onClientReport={handleClientReport}
              onCreateSchema={handleCreateSchema}
              onBuildChecklist={handleBuildChecklist}
            />

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activeTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleTabSwitch(tool.id)}
                      className={`min-h-[54px] rounded-xl border px-4 py-3 text-left transition-all ${
                        isActive
                          ? "border-white/15 bg-charcoal text-white shadow-lg shadow-white/10"
                          : "border-white/10 bg-charcoal text-white/55 hover:bg-charcoal-light hover:text-white/75"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        <span>{tool.label}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-white/50">{tool.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-charcoal p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm leading-relaxed text-white/60">{currentTool.description}</p>
                  <div className="mt-2 inline-flex items-center rounded-full border border-white/10 bg-charcoal-deep px-2.5 py-1 text-[11px] text-white/70">
                    Value: {currentTool.businessValue}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={applyExample} className="rounded-md border border-white/10 bg-charcoal-deep px-2.5 py-1.5 text-xs text-white/80">
                    Use Example Input
                  </button>
                  {activeTool === "simulate" && latestResult?.url && (
                    <button
                      type="button"
                      onClick={() => setInput(latestResult.url || "")}
                      className="rounded-md border border-white/10 bg-charcoal-deep px-2.5 py-1.5 text-xs text-white/80"
                    >
                      Use Latest Audited URL
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setInput("");
                      setSecondaryInput("");
                      setError(null);
                    }}
                    className="rounded-md border border-white/10 bg-charcoal-deep px-2.5 py-1.5 text-xs text-white/70"
                  >
                    Clear Inputs
                  </button>
                </div>
              </div>

              {recentInputs.filter((entry) => entry.tool === activeTool).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recentInputs
                    .filter((entry) => entry.tool === activeTool)
                    .slice(0, 3)
                    .map((entry, idx) => (
                      <button
                        key={`${entry.tool}-${idx}`}
                        type="button"
                        onClick={() => {
                          setInput(entry.input);
                          setSecondaryInput(entry.secondary || "");
                        }}
                        className="max-w-[320px] truncate rounded-md border border-white/10 bg-charcoal-deep px-2.5 py-1.5 text-xs text-white/70"
                        title={entry.input}
                      >
                        Recent: {entry.input}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-charcoal p-4 sm:p-5">
              <label className="block text-sm font-medium text-white/75">{currentTool.inputLabel}</label>

              {currentTool.inputType === "textarea" ? (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentTool.placeholder}
                  rows={6}
                  className="w-full resize-y rounded-xl border border-white/10 px-4 py-3 text-sm text-white/85 placeholder-white/50 focus:border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canRun) handleRun();
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentTool.placeholder}
                  className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/85 placeholder-white/50 focus:border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canRun) handleRun();
                  }}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/55">
                <span>{currentTool.inputType === "textarea" ? "Tip: Press Ctrl/Cmd + Enter to run quickly." : "Tip: Press Enter to run quickly."}</span>
                <span>{primaryInput.length} chars</span>
              </div>

              {simulateUrlError && <p className="text-xs text-red-300/90">{simulateUrlError}</p>}

              {activeTool === "rewrite" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/55">Voice Preset</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: "authoritative", label: "Authoritative", desc: "Confident, declarative, fact-forward" },
                      { id: "conversational", label: "Conversational", desc: "Natural, direct, short sentences" },
                      { id: "data_driven", label: "Data-Driven", desc: "Metrics and numbers for every claim" },
                      { id: "how_to", label: "How-To", desc: "Numbered steps, verb-first" },
                      { id: "faq", label: "FAQ", desc: "Q&A pairs, user-typed questions" },
                    ] as const).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSecondaryInput(preset.id)}
                        className={`rounded-xl border px-3 py-2 text-sm transition-all ${
                          secondaryInput === preset.id
                            ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                            : "border-white/10 bg-charcoal-deep text-white/60 hover:border-white/20 hover:text-white/80"
                        }`}
                      >
                        <span className="block font-medium">{preset.label}</span>
                        <span className="block text-[11px] text-white/40 mt-0.5">{preset.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(activeTool === "model-diff" || activeTool === "simulate") && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/55">
                    {activeTool === "model-diff" ? "Your Content Summary (optional)" : "Target Query (optional)"}
                  </label>
                  <input
                    type="text"
                    value={secondaryInput}
                    onChange={(e) => setSecondaryInput(e.target.value)}
                    placeholder={
                      activeTool === "model-diff"
                        ? "Brief summary of your page content for gap analysis…"
                        : "Specific query you want to rank for…"
                    }
                    className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/85 placeholder-white/50 focus:border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={pasteFromClipboard}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-charcoal-deep px-4 py-2.5 text-sm text-white/75"
                >
                  <Copy className="h-4 w-4" />
                  Paste
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!canRun}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:bg-charcoal disabled:text-white/60 sm:w-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Run Analysis
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-white/80">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                    <FlaskConical className="h-5 w-5 text-white/80" />
                    Results
                  </h3>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={copyResultJson}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-xs text-white/80 sm:flex-none"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy JSON
                    </button>
                    <button
                      type="button"
                      onClick={downloadResultJson}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-xs text-white/80 sm:flex-none"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>

                <ExecutiveSummary tool={activeTool} input={primaryInput} result={result} />

                {activeTool === "decompile" && <DecompileResult data={result} />}
                {activeTool === "ghost" && <GhostResult data={result} />}
                {activeTool === "model-diff" && <ModelDiffResult data={result} />}
                {activeTool === "simulate" && <SimulateResult data={result} />}
                {activeTool === "rewrite" && <RewriteResult data={result?.data ?? result} />}

                <div className="rounded-2xl border border-white/10 bg-charcoal p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-white/80" />
                    <h4 className="text-sm font-semibold text-white">Next-best route</h4>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Link to="/app/score-fix" className="rounded-xl border border-white/10 bg-charcoal-deep p-4 text-sm text-white/75 transition-colors hover:text-white">
                      Turn this into a Score Fix path
                    </Link>
                    <Link to="/pricing?source=reverse-engineer" className="rounded-xl border border-white/10 bg-charcoal-deep p-4 text-sm text-white/75 transition-colors hover:text-white">
                      Compare audit and remediation tiers
                    </Link>
                    <button
                      type="button"
                      onClick={handleSaveToReports}
                      className="rounded-xl border border-white/10 bg-charcoal-deep p-4 text-left text-sm text-white/75 transition-colors hover:text-white"
                    >
                      Save result to reports
                    </button>
                    <button
                      type="button"
                      onClick={handleImplementationBrief}
                      className="rounded-xl border border-white/10 bg-charcoal-deep p-4 text-left text-sm text-white/75 transition-colors hover:text-white"
                    >
                      Generate implementation brief
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
