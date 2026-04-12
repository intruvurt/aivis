import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ReferenceLine,
  Radar,
  RadarChart,
  PolarGrid,
  PolarRadiusAxis,
} from "recharts";
import {
  BarChart3, RefreshCw, ArrowLeft, Activity, Zap, Target,
  TrendingUp, TrendingDown, Globe, AlertCircle, LayoutList,
  Filter, Download, Flame, Award, Calendar, Layers, Gauge,
  Cpu, Minus, ArrowUpRight, ArrowDownRight, CheckCircle2,
  XCircle, AlertTriangle, Users, Shield, ShieldAlert, Crosshair, Brain, Lightbulb,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import apiFetch from "../utils/api";
import UpgradeWall from "../components/UpgradeWall";
import { meetsMinimumTier } from "@shared/types";
import { usePageMeta } from "../hooks/usePageMeta";
import FeatureInstruction, { InfoTip } from "../components/FeatureInstruction";
import {
  EMPTY_ANALYTICS_DATA,
  EMPTY_PLATFORM_METRICS,
  mapAnalyticsApiResponse,
  mapPlatformMetricsResponse,
  type AnalyticsData,
  type PlatformMetricsData,
  type PlatformTimeframeMetric,
  type DeterministicPipeline,
  type RulePassRate,
} from "../utils/analyticsUtils";
import { CHART_PALETTE, PLATFORM_PALETTE } from "../constants/uiPalette";
/* ── helpers ─────────────────────────────────────────────────────────────── */

type RangeKey = "7d" | "30d" | "90d" | "all";
type PlatformRangeKey = PlatformTimeframeMetric['key'];
type TrendMetric = "avgScore" | "count";
type DomainSort = "count" | "latest" | "avg";
type MainTab = "overview" | "trends" | "domains" | "seo" | "insights";

type ComplianceStatusPayload = {
  organization?: {
    name?: string;
    registration_status?: string;
  };
  compliance?: {
    soc2_type1?: {
      status?: string;
      last_audit?: string;
      valid_until?: string;
    };
    vanta?: {
      enabled?: boolean;
      monitoring_status?: string;
    };
    drata?: {
      enabled?: boolean;
      evidence_collection?: string;
      audit_ready?: boolean;
    };
  };
  timestamp?: string;
};

const DOMAIN_DISPLAY_LIMIT = 100;
const P = CHART_PALETTE;

const CHECK_LABELS: Record<string, string> = {
  title: "Title",
  meta_description: "Meta Description",
  h1: "H1",
  schema: "Schema",
  canonical: "Canonical",
  https: "HTTPS",
  robots: "Robots",
  indexability: "Indexability",
  internal_link_health: "Internal Links",
  content_uniqueness: "Content Uniqueness",
  performance_hint: "Performance",
  image_alt_coverage: "Image Alt Coverage",
  semantic_landmarks: "Semantic Landmarks",
  form_accessibility: "Form Accessibility",
  entity_clarity: "Entity Clarity",
};

function checkFocusHint(check: string): string {
  const hints: Record<string, string> = {
    entity_clarity: "Clarify who you are, what you do and who it's for in the first screen.",
    h1: "Use one explicit H1 with clear topic intent on each page.",
    h2: "Use one or more explicit H2 with clear subtitle/hook intent on each page.",
    schema: "Add/repair JSON-LD for Organization, FAQ and page specific entities.",
    meta_description: "Tighten title/meta for intent match and answer ready wording. (155 chars max.)",
    title: "Tighten title/meta for immediate intent match and answer ready wording. (60 chars max.)",
    internal_link_health: "Improve internal linking between related intent pages.",
  };
  return hints[check] ?? "Prioritize this check in your next optimization sprint.";
}

function scoreBand(score: number): { label: string; color: string; fill: string } {
  if (score >= 80) return { label: "Excellent", color: "#34d399", fill: P.bandExcellent ?? "#34d39920" };
  if (score >= 60) return { label: "Good",      color: "#22d3ee", fill: P.bandGood ?? "#22d3ee20" };
  if (score >= 40) return { label: "Fair",      color: "#fbbf24", fill: P.bandFair ?? "#fbbf2420" };
  if (score >= 20) return { label: "Poor",      color: "#f97316", fill: P.bandPoor ?? "#f9731620" };
  return             { label: "Critical",  color: "#fb7185", fill: P.bandCritical ?? "#fb718520" };
}

function platformFill(platform: string): string {
  const palette = PLATFORM_PALETTE[platform as keyof typeof PLATFORM_PALETTE] as { fill?: string } | undefined;
  return palette?.fill || P.orange;
}

/* ── Custom Tooltip ──────────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const formatValue = (entry: any): string => {
    const value = entry?.value;
    if (typeof value !== "number") return String(value ?? "");
    const name = String(entry?.name || "").toLowerCase();
    const key = String(entry?.dataKey || "").toLowerCase();
    const isPercent =
      name.includes("%") ||
      name.includes("score") ||
      key.includes("score") ||
      key.includes("pct") ||
      key.includes("rate");
    return isPercent ? `${value}%` : String(value);
  };

  return (
    <div className="rounded-xl border px-4 py-3 text-sm shadow-xl"
      style={{ background: P.tooltipBg, borderColor: P.tooltipBorder, boxShadow: P.tooltipShadow, minWidth: 150 }}>
      <p className="text-white/60 text-xs mb-2 font-medium">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-white/80">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color ?? entry.fill }} />
            {entry.name}
          </span>
          <span className="font-bold text-white">{formatValue(entry)}</span>
        </div>
      ))}
    </div>
  );
};

function ChartExplainer({ text, tone = "cyan" }: { text: string; tone?: "cyan" | "amber" | "rose" | "indigo" | "emerald" | "orange" }) {
  const toneClass: Record<string, string> = {
    cyan: "text-cyan-300/90",
    amber: "text-amber-300/90",
    rose: "text-rose-300/90",
    indigo: "text-indigo-300/90",
    emerald: "text-emerald-300/90",
    orange: "text-orange-300/90",
  };
  return <p className={`mt-1 text-xs ${toneClass[tone] || toneClass.cyan}`}>{text}</p>;
}

/* ── SectionTitle - labelled divider with color accent stripe ─────────── */
const SECTION_COLORS: Record<string, { border: string; dot: string; text: string }> = {
  orange:  { border: 'rgba(249,115,22,0.35)', dot: 'bg-orange-400',  text: 'text-orange-300' },
  cyan:    { border: 'rgba(34,211,238,0.35)',  dot: 'bg-cyan-400',    text: 'text-cyan-300' },
  indigo:  { border: 'rgba(129,140,248,0.35)', dot: 'bg-indigo-400',  text: 'text-indigo-300' },
  amber:   { border: 'rgba(251,191,36,0.35)',  dot: 'bg-amber-400',   text: 'text-amber-300' },
  emerald: { border: 'rgba(52,211,153,0.35)',  dot: 'bg-emerald-400', text: 'text-emerald-300' },
  rose:    { border: 'rgba(251,113,133,0.35)', dot: 'bg-rose-400',    text: 'text-rose-300' },
};
function SectionTitle({ title, tone = "orange", sub }: { title: string; tone?: keyof typeof SECTION_COLORS; sub?: string }) {
  const c = SECTION_COLORS[tone] || SECTION_COLORS.orange;
  return (
    <div className="flex items-center gap-3 mb-4 pb-2" style={{ borderBottom: `2px solid ${c.border}` }}>
      <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} aria-hidden="true" />
      <div>
        <h3 className={`text-sm font-bold tracking-wide uppercase ${c.text}`}>{title}</h3>
        {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── StatCard ────────────────────────────────────────────────────────────── */
function StatCard({
  icon: Icon, label, value, sub, accent = P.orange, trend,
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; accent?: string; trend?: 'up' | 'down' | 'flat';
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#fb7185' : 'rgba(255,255,255,0.4)';
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 flex items-center gap-4 group"
      style={{ background: 'rgba(10,14,28,0.75)', border: `1px solid ${accent}28` }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none"
        style={{ background: `radial-gradient(400px at 0% 0%, ${accent}08, transparent 70%)` }} />
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-white/50 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-end gap-2">
          <p className="text-xl font-bold text-white leading-none">{String(value)}</p>
          {trend && <TrendIcon className="w-4 h-4 mb-0.5" style={{ color: trendColor }} />}
        </div>
        {sub && <p className="text-xs mt-1" style={{ color: accent + 'cc' }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Activity Heatmap ────────────────────────────────────────────────────── */
function ActivityHeatmap({ data }: { data: Array<{ date: string; count: number }> }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  if (!data.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Calendar className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-semibold text-white">30-Day Activity</span>
        <span className="text-xs text-white/40 ml-auto">1 cell = 1 day</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.map(({ date, count }) => {
          const intensity = count === 0 ? 0 : Math.max(0.15, count / maxCount);
          const bg = count === 0 ? 'rgba(255,255,255,0.05)' : `rgba(249,115,22,${(intensity * 0.75).toFixed(2)})`;
          return (
            <div key={date} title={`${date}: ${count} scan${count !== 1 ? 's' : ''}`}
              className="w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold cursor-default transition-all hover:scale-110"
              style={{ background: bg, border: `1px solid rgba(249,115,22,${(intensity * 0.4).toFixed(2)})`,
                color: count > 0 ? 'rgba(255,255,255,0.9)' : 'transparent' }}>
              {count > 0 ? count : ''}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
        <span>Less</span>
        {[0, 0.15, 0.35, 0.6, 0.9].map((v) => (
          <div key={v} className="w-4 h-4 rounded" style={{ background: v === 0 ? 'rgba(255,255,255,0.05)' : `rgba(249,115,22,${v})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/* ── Score Distribution ───────────────────────────────────────────────────── */
function ScoreDistributionChart({ data }: { data: AnalyticsData['scoreDistribution'] }) {
  const colors = ['#fb7185', '#f97316', '#fbbf24', '#22d3ee', '#34d399'];
  if (!data?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        <Gauge className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-white">Score Distribution</span>
      </div>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={item.bucket} className="flex items-center gap-3">
            <span className="text-xs text-white/60 w-16 text-right">{item.bucket}</span>
            <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-lg transition-all duration-700"
                style={{ width: `${item.pct}%`, background: colors[i], opacity: 0.85 }} />
            </div>
            <div className="flex items-center gap-1.5 w-16">
              <span className="text-xs font-bold text-white">{item.count}</span>
              <span className="text-xs text-white/40">({item.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Improvement Leaderboard ──────────────────────────────────────────────── */
function ImprovementLeaderboard({ items }: { items: AnalyticsData['improvementDeltas'] }) {
  const sorted = [...(items ?? [])].sort((a, b) => (b.delta ?? -9999) - (a.delta ?? -9999)).slice(0, 8);
  if (!sorted.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Award className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Score Improvement Leaderboard</span>
      </div>
      <div className="space-y-2">
        {sorted.map((item, i) => {
          const delta = item.delta ?? 0;
          const isImproved = delta > 0;
          const isRegressed = delta < 0;
          return (
            <div key={item.domain + i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-xs text-white/30 w-4 text-center font-bold">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.domain}</p>
                <p className="text-xs text-white/40">
                  {item.firstScore ?? '–'}% → {item.latestScore ?? '–'}%
                  <span className="mx-1">·</span>{item.audits} scan{item.audits !== 1 ? 's' : ''}
                </p>
              </div>
              <span className={`text-sm font-bold flex items-center gap-1 ${isImproved ? 'text-emerald-400' : isRegressed ? 'text-rose-400' : 'text-white/40'}`}>
                {isImproved ? <ArrowUpRight className="w-4 h-4" /> : isRegressed ? <ArrowDownRight className="w-4 h-4" /> : <Minus className="w-3 h-3" />}
                {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── SEO Health Radial ────────────────────────────────────────────────────── */
function SeoHealthRadial({ passes, warns, fails }: { passes: number; warns: number; fails: number }) {
  const total = passes + warns + fails;
  if (!total) return null;
  const healthPct = Math.round((passes / total) * 100);
  const radialData = [
    { name: 'Pass', value: passes, fill: '#34d399' },
    { name: 'Warn', value: warns, fill: '#fbbf24' },
    { name: 'Fail', value: fails, fill: '#fb7185' },
  ];
  const band = scoreBand(healthPct);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <ResponsiveContainer width={180} height={180}>
          <RadialBarChart cx="50%" cy="50%" innerRadius={54} outerRadius={82} data={radialData} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, total]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.05)' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold" style={{ color: band.color }}>{healthPct}%</span>
          <span className="text-xs text-white/50">Health</span>
        </div>
      </div>
      <div className="flex gap-3 text-xs">
        {radialData.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
            <span className="text-white/70">{d.name} {d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Visibility Rubric Radar ──────────────────────────────────────────────── */

const FAMILY_LABELS: Record<string, string> = {
  crawlability: 'Crawlability',
  indexability: 'Indexability',
  renderability: 'Renderability',
  metadata: 'Metadata',
  schema: 'Schema',
  entity: 'Entity',
  content: 'Content',
  citation: 'Citation',
  trust: 'Trust',
};

const FAMILY_ORDER = ['crawlability', 'indexability', 'renderability', 'metadata', 'schema', 'entity', 'content', 'citation', 'trust'];

function familyColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#22d3ee';
  if (score >= 40) return '#fbbf24';
  return '#fb7185';
}

function VisibilityRubricRadar({ familyScores }: { familyScores: Record<string, number> }) {
  const radarData = FAMILY_ORDER.map((key) => ({
    family: FAMILY_LABELS[key] || key,
    score: familyScores[key] ?? 0,
    fullMark: 100,
  }));

  const avgScore = FAMILY_ORDER.reduce((sum, k) => sum + (familyScores[k] ?? 0), 0) / FAMILY_ORDER.length;
  const weakest = FAMILY_ORDER
    .filter((k) => (familyScores[k] ?? 0) > 0)
    .sort((a, b) => (familyScores[a] ?? 0) - (familyScores[b] ?? 0))[0];
  const strongest = FAMILY_ORDER
    .filter((k) => (familyScores[k] ?? 0) > 0)
    .sort((a, b) => (familyScores[b] ?? 0) - (familyScores[a] ?? 0))[0];

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Brain className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-white">AI Visibility Rubric</span>
        <span className="ml-auto text-xs text-white/40">{FAMILY_ORDER.length} dimensions</span>
      </div>
      <div className="flex flex-col lg:flex-row items-center gap-6">
        <ResponsiveContainer width="100%" height={280} className="max-w-sm">
          <RadarChart data={radarData} outerRadius="75%">
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="family" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Score" dataKey="score" stroke={P.cyan} fill={P.cyan} fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="flex-1 w-full space-y-2">
          {FAMILY_ORDER.map((key) => {
            const score = familyScores[key] ?? 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-white/60 w-24 text-right">{FAMILY_LABELS[key]}</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: familyColor(score) }} />
                </div>
                <span className="text-xs font-bold w-10 text-right" style={{ color: familyColor(score) }}>{score}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-4 text-xs text-white/50 mt-3 pt-3 border-t border-white/10">
            <span>Avg: <strong className="text-white/80">{avgScore.toFixed(1)}</strong></span>
            {weakest && <span>Weakest: <strong style={{ color: familyColor(familyScores[weakest] ?? 0) }}>{FAMILY_LABELS[weakest]}</strong></span>}
            {strongest && <span>Strongest: <strong style={{ color: familyColor(familyScores[strongest] ?? 0) }}>{FAMILY_LABELS[strongest]}</strong></span>}
          </div>
        </div>
      </div>
      <ChartExplainer tone="indigo" text="The radar maps 9 deterministic rubric dimensions that drive your overall visibility score - address the flattest axis first." />
    </div>
  );
}

/* ── Hard Blocker Alert ───────────────────────────────────────────────────── */
function HardBlockerAlert({ stats }: { stats: DeterministicPipeline['hardBlockerStats'] }) {
  if (stats.totalAudits === 0 || stats.auditsWithBlockers === 0) return null;
  const pct = Math.round((stats.auditsWithBlockers / stats.totalAudits) * 100);
  return (
    <div className="rounded-2xl px-5 py-4 flex items-start gap-4"
      style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.20)' }}>
      <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-rose-200">
          Hard blockers found in {stats.auditsWithBlockers} of {stats.totalAudits} audits ({pct}%)
        </p>
        <p className="text-xs text-white/55 mt-1">
          Averaging {stats.avgBlockersPerAudit} blocker{stats.avgBlockersPerAudit !== 1 ? 's' : ''} per audit. Hard blockers prevent AI
          models from extracting or citing your content - they should be resolved before optimizing other dimensions.
        </p>
      </div>
    </div>
  );
}

/* ── Rule Pass Rates Panel ────────────────────────────────────────────────── */
function RulePassRatesPanel({ rules }: { rules: RulePassRate[] }) {
  if (!rules.length) return null;

  const familyGroups = new Map<string, RulePassRate[]>();
  for (const r of rules) {
    const group = familyGroups.get(r.family) || [];
    group.push(r);
    familyGroups.set(r.family, group);
  }

  const hardBlockers = rules.filter((r) => r.hardBlocker && r.failCount > 0);
  const topFailing = [...rules]
    .filter((r) => r.failCount > 0)
    .sort((a, b) => b.failCount - a.failCount)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {hardBlockers.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-semibold text-rose-200">Hard Blockers Failing</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full text-rose-300"
              style={{ background: 'rgba(251,113,133,0.18)', border: '1px solid rgba(251,113,133,0.25)' }}>
              {hardBlockers.length} rule{hardBlockers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {hardBlockers.map((r) => (
              <div key={r.ruleId} className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.14)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.title}</p>
                  <p className="text-xs text-white/45">{FAMILY_LABELS[r.family] || r.family} · {r.severity}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-rose-400">{r.failCount} fail{r.failCount !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-white/40">{r.passRate}% pass rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topFailing.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Crosshair className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Top Failing Rules</span>
          </div>
          <div className="space-y-2">
            {topFailing.map((r) => {
              const barColor = r.passRate >= 80 ? '#34d399' : r.passRate >= 50 ? '#fbbf24' : '#fb7185';
              return (
                <div key={r.ruleId} className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm text-white/90 truncate">{r.title}</p>
                      <p className="text-xs text-white/40">{FAMILY_LABELS[r.family] || r.family} · {r.severity}{r.hardBlocker ? ' · ⛔ blocker' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      <span className="text-emerald-300">{r.passCount}✓</span>
                      <span className="text-rose-300">{r.failCount}✗</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-l-full" style={{ width: `${r.passRate}%`, background: barColor }} />
                  </div>
                  <p className="text-xs text-white/40 mt-1">{r.passRate}% pass rate across {r.total} check{r.total !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Array.from(familyGroups.entries()).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Rules by Family</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(familyGroups.entries())
              .sort(([, a], [, b]) => {
                const aFails = a.reduce((s, r) => s + r.failCount, 0);
                const bFails = b.reduce((s, r) => s + r.failCount, 0);
                return bFails - aFails;
              })
              .map(([family, familyRules]) => {
                const totalFails = familyRules.reduce((s, r) => s + r.failCount, 0);
                const totalChecks = familyRules.reduce((s, r) => s + r.total, 0);
                const totalPasses = familyRules.reduce((s, r) => s + r.passCount, 0);
                const pRate = totalChecks > 0 ? Math.round((totalPasses / totalChecks) * 100) : 0;
                return (
                  <div key={family} className="rounded-xl p-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs uppercase tracking-wider text-white/60">{FAMILY_LABELS[family] || family}</p>
                      <span className="text-xs font-bold" style={{ color: familyColor(pRate) }}>{pRate}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pRate}%`, background: familyColor(pRate) }} />
                    </div>
                    <p className="text-xs text-white/40 mt-1.5">
                      {familyRules.length} rule{familyRules.length !== 1 ? 's' : ''} · {totalFails} fail{totalFails !== 1 ? 's' : ''} / {totalChecks} checks
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Actionable Insights ──────────────────────────────────────────────────── */
function ActionableInsights({ data, pipeline }: { data: AnalyticsData; pipeline: DeterministicPipeline | null }) {
  const insights: Array<{ text: string; icon: React.ReactNode; tone: string }> = [];

  if (data.averageScore > 0 && data.averageScore < 50) {
    insights.push({ text: `Average score is ${data.averageScore.toFixed(0)}% - most audits are in the weak band. Focus on hard blockers first.`, icon: <AlertTriangle className="w-4 h-4" />, tone: 'rose' });
  }
  if (data.averageScore >= 70) {
    insights.push({ text: `Average score of ${data.averageScore.toFixed(0)}% puts you in the strong range. Optimize individual low-performing pages.`, icon: <CheckCircle2 className="w-4 h-4" />, tone: 'emerald' });
  }

  if (pipeline) {
    const weak = FAMILY_ORDER
      .filter((k) => (pipeline.avgFamilyScores[k] ?? 0) > 0 && (pipeline.avgFamilyScores[k] ?? 0) < 50)
      .map((k) => FAMILY_LABELS[k]);
    if (weak.length > 0) {
      insights.push({ text: `Weak rubric dimensions: ${weak.join(', ')}. These drag your overall visibility score.`, icon: <Crosshair className="w-4 h-4" />, tone: 'amber' });
    }

    const blockerPct = pipeline.hardBlockerStats.totalAudits > 0
      ? (pipeline.hardBlockerStats.auditsWithBlockers / pipeline.hardBlockerStats.totalAudits) * 100
      : 0;
    if (blockerPct > 30) {
      insights.push({ text: `${blockerPct.toFixed(0)}% of audits have hard blockers - these prevent AI citation entirely.`, icon: <ShieldAlert className="w-4 h-4" />, tone: 'rose' });
    }
  }

  const worstDelta = data.improvementDeltas.find((d) => (d.delta ?? 0) < -10);
  if (worstDelta) {
    insights.push({ text: `${worstDelta.domain} regressed by ${Math.abs(worstDelta.delta ?? 0).toFixed(0)} points - investigate recent changes.`, icon: <TrendingDown className="w-4 h-4" />, tone: 'amber' });
  }

  if (data.streakDays >= 7) {
    insights.push({ text: `${data.streakDays}-day audit streak! Consistent scanning helps catch regressions early.`, icon: <Flame className="w-4 h-4" />, tone: 'emerald' });
  }

  if (!insights.length) return null;

  const toneStyles: Record<string, { bg: string; border: string; text: string }> = {
    emerald: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.20)', text: 'text-emerald-200' },
    amber: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.20)', text: 'text-amber-200' },
    rose: { bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.20)', text: 'text-rose-200' },
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(249,115,22,0.15)' }}>
      <div className="space-y-2">
        {insights.map((insight, i) => {
          const s = toneStyles[insight.tone] || toneStyles.amber;
          return (
            <div key={i} className={`rounded-xl px-4 py-3 flex items-start gap-3 text-sm ${s.text}`}
              style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <span className="flex-shrink-0 mt-0.5">{insight.icon}</span>
              <span>{insight.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── component ───────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();

  usePageMeta({
    title: 'Analytics',
    description: 'Track your AI visibility score trends, real score distribution, real/actual improvement turns, real platform performance, and real daily activity.',
    path: '/analytics',
  });

  const hasAccess = meetsMinimumTier(user?.tier || 'observer', 'alignment');

  const [data, setData] = useState(EMPTY_ANALYTICS_DATA);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetricsData>(EMPTY_PLATFORM_METRICS);
  const [range, setRange] = useState<RangeKey>("all");
  const [platformRange, setPlatformRange] = useState<PlatformRangeKey>("24h");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("avgScore");
  const [domainSearch, setDomainSearch] = useState("");
  const [domainSort, setDomainSort] = useState<DomainSort>("count");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatusPayload | null>(null);
  const [communityBenchmarks, setCommunityBenchmarks] = useState<{
    total_audits: number;
    avg_score: number;
    median_score: number;
    min_score: number;
    max_score: number;
    distribution: Record<string, number>;
    category_averages: Array<{ label: string; avg_score: number; sample_count: number }>;
  } | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, platformRes] = await Promise.all([
        apiFetch(`${API_URL}/api/analytics?range=${range}`, { headers: {} }),
        apiFetch(`${API_URL}/api/analytics/platform-metrics`, { headers: {} }),
      ]);

      if (analyticsRes.status === 401) { setError('Session expired — please sign in again.'); setLoading(false); return; }
      if (!analyticsRes.ok) throw new Error("Failed to load analytics");
      setData(mapAnalyticsApiResponse(await analyticsRes.json()));

      if (platformRes.ok) {
        setPlatformMetrics(mapPlatformMetricsResponse(await platformRes.json()));
      } else {
        setPlatformMetrics(EMPTY_PLATFORM_METRICS);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (token) fetchAnalytics();
    else setLoading(false);
  }, [token, range, fetchAnalytics]);

  useEffect(() => {
    const fetchCompliance = async () => {
      if (!token || !hasAccess) return;
      try {
        const res = await fetch(`${API_URL}/api/compliance/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = res.ok ? (await res.json() as ComplianceStatusPayload) : null;
        setComplianceStatus(payload || null);
      } catch {
        setComplianceStatus(null);
      }
    };
    void fetchCompliance();
  }, [token, hasAccess]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/benchmarks`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) setCommunityBenchmarks(json.benchmarks);
        }
      } catch { /* silent - community stats are non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const visibleTopDomains = useMemo(() => {
    const q = domainSearch.trim().toLowerCase();
    const filtered = data.topDomains.filter((d) => !q || d.domain.toLowerCase().includes(q));
    return [...filtered].sort((a, b) => {
      if (domainSort === "latest") return (b.latestScore ?? -1) - (a.latestScore ?? -1);
      if (domainSort === "avg") return (b.avgScore ?? -1) - (a.avgScore ?? -1);
      return b.count - a.count;
    }).slice(0, DOMAIN_DISPLAY_LIMIT);
  }, [data.topDomains, domainSearch, domainSort]);

  const diagnosticRanking = useMemo(() => {
    return Object.entries(data.seoDiagnosticsSummary || {}).map(([check, counts]) => {
      const total = counts.pass + counts.warn + counts.fail;
      return {
        check, label: CHECK_LABELS[check] || check.replace(/_/g, " "),
        ...counts, total,
        failRate: total > 0 ? (counts.fail / total) * 100 : 0,
        warnRate: total > 0 ? (counts.warn / total) * 100 : 0,
      };
    }).sort((a, b) => {
      if (b.fail !== a.fail) return b.fail - a.fail;
      return b.failRate - a.failRate;
    });
  }, [data.seoDiagnosticsSummary]);

  const topFailedFindings = diagnosticRanking.slice(0, 5);
  const isScoreFocus = trendMetric === "avgScore";

  const trendDir = useMemo(() => {
    if (data.recentTrend.length < 2) return 'flat' as const;
    const first = data.recentTrend[0].avgScore;
    const last = data.recentTrend[data.recentTrend.length - 1].avgScore;
    return last > first ? 'up' as const : last < first ? 'down' as const : 'flat' as const;
  }, [data.recentTrend]);

  const exportDomainsCsv = async () => {
    try {
      setExportingCsv(true);
      const response = await apiFetch(`${API_URL}/api/analytics/domains.csv?range=${range}`, { headers: {} });
      if (!response.ok) throw new Error("Failed to export CSV");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `aivis-analytics-${range}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "CSV export failed");
    } finally {
      setExportingCsv(false);
    }
  };

  const exportTrendsCsv = () => {
    if (!data.recentTrend.length) return;
    const rows = [["Date", "Avg Score", "Analyses"].join(",")];
    data.recentTrend.forEach((p: any) => {
      rows.push([p.date, p.avgScore ?? "", p.count ?? ""].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aivis-trends-${range}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const exportSeoChecksCsv = () => {
    const entries = Object.entries(data.seoDiagnosticsSummary || {});
    if (!entries.length) return;
    const rows = [['Check', 'Pass', 'Warn', 'Fail', 'Total', 'Pass Rate %'].join(',')];
    entries.forEach(([key, counts]) => {
      const total = (counts.pass || 0) + (counts.warn || 0) + (counts.fail || 0);
      const rate = total > 0 ? ((counts.pass || 0) / total * 100).toFixed(1) : '0';
      const name = key.replace(/,/g, ' ');
      rows.push([name, counts.pass || 0, counts.warn || 0, counts.fail || 0, total, rate].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `aivis-seo-health-${range}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const TABS: Array<{ key: MainTab; label: string; icon: React.ElementType }> = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'trends',   label: 'Trends',   icon: TrendingUp },
    { key: 'domains',  label: 'Domains',  icon: Globe },
    { key: 'seo',      label: 'SEO Health', icon: Target },
    { key: 'insights', label: 'Insights', icon: Zap },
  ];

  const hasData = data.totalAnalyses > 0;
  const selectedPlatformMetrics = useMemo(() => {
    return platformMetrics.timeframeMetrics.find((item) => item.key === platformRange) || null;
  }, [platformMetrics.timeframeMetrics, platformRange]);

  const miniMultiSeries = useMemo(() => {
    if (!data.recentTrend.length) return [] as Array<{ date: string; score: number; volume: number }>;
    return data.recentTrend.slice(-12).map((point) => ({
      date: point.date,
      score: point.avgScore,
      volume: point.count,
    }));
  }, [data.recentTrend]);

  /* ── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Page heading + controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            Analytics
            {hasData && (
              <span className="ml-1 text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-300">
                {data.totalAnalyses} scans
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-400">AI visibility insights across your audit history</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl p-1 gap-0.5 bg-white/[0.05] border border-white/[0.08]">
            {(["7d", "30d", "90d", "all"] as RangeKey[]).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  range === r
                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400'
                    : 'text-slate-500 hover:text-white'
                }`}>
                {r === "all" ? "All time" : `Last ${r}`}
              </button>
            ))}
          </div>
          <button onClick={fetchAnalytics} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 hover:bg-white/10 bg-white/[0.06] border border-white/10">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <FeatureInstruction
        headline="How to use Analytics"
        steps={[
          "Run 2+ audits on the same domain to start building trend data.",
          "Use the time range buttons (7d / 30d / 90d / All) to zoom into the period you care about.",
          "Check the SEO tab for per-check pass rates and use the focus hints to prioritize fixes.",
          "Switch to Domains view to compare visibility across multiple sites you've audited.",
        ]}
        benefit="Track exactly how your visibility score and category grades move over time — proof that your fixes are working."
        accentClass="text-cyan-400 border-cyan-500/30 bg-cyan-500/[0.06]"
        defaultCollapsed
      />

      <div>

        {/* ── Auth guard ────────────────────────────────────────────────── */}
        {!token && (
          <div className="text-center py-20 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-4" />
            <p className="text-white/70 mb-4">Sign in to view your analytics.</p>
            <button onClick={() => navigate("/auth?mode=signin")}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'rgba(249,115,22,0.22)', border: '1px solid rgba(249,115,22,0.35)' }}>
              Sign In
            </button>
          </div>
        )}

        {token && !hasAccess && (
          <UpgradeWall feature="Analytics Dashboard"
            description="View detailed analytics across all your analyses, including score trends, distribution, improvement deltas, and activity insights."
            requiredTier="alignment"
            icon={<BarChart3 className="w-12 h-12 text-orange-400" />}
            featurePreview={[
              "Full score history chart across all your audits",
              "Category-level grade trends (schema, content, trust)",
              "See which specific fixes actually moved your score",
            ]}
          />
        )}

        {token && hasAccess && loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-white/50">
            <RefreshCw className="w-5 h-5 animate-spin text-orange-400" /> Loading analytics…
          </div>
        )}

        {token && hasAccess && error && (
          <div className="text-center py-20 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-4" />
            <p className="text-white/80 mb-4">{error}</p>
            <button onClick={fetchAnalytics}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'rgba(249,115,22,0.22)', border: '1px solid rgba(249,115,22,0.35)' }}>
              Retry
            </button>
          </div>
        )}

        {token && hasAccess && !loading && !error && (
          <>
            {/* ── Key Metric Cards ───────────────────────────────────────── */}
            <SectionTitle title="Key Metrics" tone="orange" sub="Your personal audit performance at a glance" />
            <div className="text-xs text-white/40 -mt-4 mb-4 ml-1 flex items-center gap-1">
              <InfoTip text="Metrics are calculated from all your completed audits in the selected time range. Run more audits to improve accuracy." />
              <span>Hover the ⓘ icons for explanations</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard icon={Activity} label="Total Scans"   value={data.totalAnalyses} accent={P.orange} />
              <StatCard icon={Target}   label="Avg Score"     value={data.averageScore ? `${data.averageScore.toFixed(1)}%` : "–"} accent={P.cyan} trend={trendDir} />
              <StatCard icon={Globe}    label="Sites Tracked" value={data.urlsAudited} accent={P.indigo} />
              <StatCard icon={Award}    label="Best Score"    value={data.bestScore ? `${data.bestScore}%` : "–"} accent={P.amber} />
              <StatCard icon={Flame}    label="Streak"        value={data.streakDays > 0 ? `${data.streakDays}d` : "-"} sub={data.streakDays > 0 ? "consecutive days" : "No streak yet"} accent={P.orange} />
              <StatCard icon={TrendingUp} label="Latest Score" value={data.latestScore ? `${data.latestScore}%` : "–"}
                accent={data.latestScore >= 70 ? '#34d399' : data.latestScore >= 50 ? P.cyan : P.orange} />
            </div>


            {/* Platform metrics - admin only */}
            {String(user?.role || "").toLowerCase() === "admin" && platformMetrics.timeframeMetrics.length > 0 && (
              <div className="rounded-2xl mb-6 p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <SectionTitle title="Platform Metrics" tone="cyan" sub={`${platformMetrics.membershipTotals.realMembers} real · ${platformMetrics.membershipTotals.testMembers} test · ${platformMetrics.membershipTotals.totalMembers} total · ${platformMetrics.membershipTotals.stripePaidMembers} stripe paid`} />
                  </div>
                  <div className="flex rounded-xl p-1 gap-0.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {(["1h", "24h", "7d", "30d", "90d", "180d", "365d"] as PlatformRangeKey[]).map((key) => (
                      <button key={key} onClick={() => setPlatformRange(key)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={platformRange === key
                          ? { background: 'rgba(34,211,238,0.18)', border: '1px solid rgba(34,211,238,0.35)', color: '#67e8f9' }
                          : { color: 'rgba(255,255,255,0.55)' }}>
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPlatformMetrics && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      <StatCard icon={Activity} label="Analyses" value={selectedPlatformMetrics.analysesRan} sub="in window" accent={P.orange} />
                      <StatCard icon={Users} label="Active Members" value={selectedPlatformMetrics.activeMembers} sub="ran ≥1 audit" accent={P.cyan} />
                      <StatCard icon={Users} label="Total Members" value={platformMetrics.membershipTotals.totalMembers} sub="registered" accent={P.indigo} />
                      <StatCard icon={Globe} label="Traffic Proxy" value={selectedPlatformMetrics.sessionTraffic} sub="new login sessions" accent={P.indigo} />
                      <StatCard icon={Layers} label="Free Analyses" value={selectedPlatformMetrics.freeMemberAnalyses} sub="observer tier" accent={P.amber} />
                      <StatCard icon={Zap} label="Paid Analyses" value={selectedPlatformMetrics.paidMemberAnalyses} sub="stripe-verified" accent="#a78bfa" />
                      <StatCard icon={Gauge} label="Avg Visibility" value={`${selectedPlatformMetrics.avgVisibilityScore.toFixed(1)}%`} accent={P.cyan} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)' }}>
                        <span className="text-xs text-white/50">Real Users</span>
                        <span className="text-sm font-bold text-emerald-300">{platformMetrics.membershipTotals.realMembers.toLocaleString()}</span>
                      </div>
                      <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)' }}>
                        <span className="text-xs text-white/50">Test Accounts</span>
                        <span className="text-sm font-bold text-rose-300">{platformMetrics.membershipTotals.testMembers.toLocaleString()}</span>
                      </div>
                      <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="text-xs text-white/50">Free (Observer)</span>
                        <span className="text-sm font-bold text-amber-300">{platformMetrics.membershipTotals.freeMembers.toLocaleString()}</span>
                      </div>
                      <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="text-xs text-white/50">Elevated Tier</span>
                        <span className="text-sm font-bold text-violet-300">{platformMetrics.membershipTotals.elevatedMembers.toLocaleString()}</span>
                      </div>
                      <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="text-xs text-white/50">Stripe Paid</span>
                        <span className="text-sm font-bold text-cyan-300">{platformMetrics.membershipTotals.stripePaidMembers.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Community Benchmarks - visible to all authenticated users ── */}
            {communityBenchmarks && communityBenchmarks.total_audits > 0 && (
              <div className="rounded-2xl mb-6 p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(129,140,248,0.18)' }}>
                <SectionTitle title="Community Benchmarks" tone="indigo" sub={`Aggregate stats across all ${communityBenchmarks.total_audits.toLocaleString()} platform audits - no individual data exposed`} />

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                  <StatCard icon={Activity} label="Total Audits" value={communityBenchmarks.total_audits.toLocaleString()} accent={P.indigo} />
                  <StatCard icon={Target} label="Avg Score" value={`${communityBenchmarks.avg_score}%`} accent={P.cyan} />
                  <StatCard icon={Gauge} label="Median Score" value={`${communityBenchmarks.median_score}%`} accent={P.amber} />
                  <StatCard icon={TrendingDown} label="Min Score" value={`${communityBenchmarks.min_score}%`} accent="#f87171" />
                  <StatCard icon={TrendingUp} label="Max Score" value={`${communityBenchmarks.max_score}%`} accent="#34d399" />
                </div>

                {/* Score distribution mini bar chart */}
                {communityBenchmarks.distribution && (() => {
                  const buckets = [
                    { label: '0–29', key: '0-29', color: '#fb7185' },
                    { label: '30–49', key: '30-49', color: '#f97316' },
                    { label: '50–69', key: '50-69', color: '#fbbf24' },
                    { label: '70+', key: '70+', color: '#34d399' },
                  ];
                  const distData = buckets.map(b => ({
                    label: b.label,
                    count: (communityBenchmarks.distribution as Record<string, number>)[b.key] || 0,
                    color: b.color,
                  }));
                  const maxCount = Math.max(...distData.map(d => d.count), 1);
                  const BAR_MAX_H = 48;
                  return (
                    <div className="mb-4">
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Score Distribution</p>
                      <div className="flex gap-3 items-end" style={{ height: `${BAR_MAX_H + 40}px` }}>
                        {distData.map(({ label, count, color }) => {
                          const barH = Math.max(4, Math.round((count / maxCount) * BAR_MAX_H));
                          return (
                            <div key={label} className="flex-1 flex flex-col items-center justify-end gap-1">
                              <span className="text-[11px] leading-none mb-1" style={{ color }}>{count.toLocaleString()}</span>
                              <div className="w-full rounded-t" style={{ height: barH, background: color + '55', border: `1px solid ${color}60` }} />
                              <span className="text-[10px] text-white/40 mt-1.5">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {communityBenchmarks.category_averages.length > 0 && (() => {
                  const sorted = [...communityBenchmarks.category_averages];
                  const best = sorted[sorted.length - 1];
                  const worst = sorted[0];
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {best && (
                        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)' }}>
                          <Award className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-emerald-400/80 font-medium">Strongest Category</p>
                            <p className="text-sm text-white font-semibold truncate">{best.label}</p>
                            <p className="text-xs text-white/50">{best.avg_score}% avg across {best.sample_count.toLocaleString()} audits</p>
                          </div>
                        </div>
                      )}
                      {worst && (
                        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)' }}>
                          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-rose-400/80 font-medium">Weakest Category</p>
                            <p className="text-sm text-white font-semibold truncate">{worst.label}</p>
                            <p className="text-xs text-white/50">{worst.avg_score}% avg across {worst.sample_count.toLocaleString()} audits</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SEO totals bar */}
            {(data.totalPasses > 0 || data.totalFails > 0) && (
              <>
              <SectionTitle title="SEO Health Summary" tone="emerald" sub="Pass / Warning / Fail totals across all audited checks" />
              <div className="rounded-2xl mb-6 px-5 py-4 flex flex-wrap items-center gap-6"
                style={{ background: 'rgba(10,14,28,0.70)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-white/70">Passes</span>
                  <span className="text-lg font-bold text-emerald-400">{data.totalPasses}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-white/70">Warnings</span>
                  <span className="text-lg font-bold text-amber-400">{data.totalWarns}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-sm text-white/70">Fails</span>
                  <span className="text-lg font-bold text-rose-400">{data.totalFails}</span>
                </div>
                <span className="ml-auto text-xs text-white/35 flex items-center gap-1.5">
                  <Minus className="w-3 h-3" />
                  {range === 'all' ? 'All time' : `Last ${range}`}
                </span>
              </div>
              </>
            )}

            {/* ── Hard Blocker Alert ─────────────────────────────────── */}
            {data.deterministicPipeline?.hardBlockerStats && (
              <HardBlockerAlert stats={data.deterministicPipeline.hardBlockerStats} />
            )}

            {/* ── Tab Nav ────────────────────────────────────────────────── */}
            {hasData && (
              <div className="flex gap-1 mb-6 rounded-xl p-1"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 justify-center"
                    style={activeTab === key
                      ? { background: 'rgba(249,115,22,0.20)', border: '1px solid rgba(249,115,22,0.30)', color: '#fb923c' }
                      : { color: 'rgba(255,255,255,0.50)' }}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>
            )}

            {/* ══════════════════ OVERVIEW TAB ══════════════════════════════ */}
            {(activeTab === 'overview' || !hasData) && (
              <div className="space-y-6">
                {hasData && (
                  <>
                  <SectionTitle title="Audit Overview" tone="cyan" sub="Score distribution, activity cadence & SEO health at a glance" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <ScoreDistributionChart data={data.scoreDistribution ?? []} />
                      <ChartExplainer tone="amber" text="Distribution shows where your audits cluster, so you can move volume from weak bands into stable and strong ranges." />
                    </div>
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <ActivityHeatmap data={data.dailyActivity ?? []} />
                      <ChartExplainer tone="indigo" text="Activity tracks operational cadence; consistent audit frequency usually precedes stable score gains." />
                    </div>
                    <div className="rounded-2xl p-5 flex flex-col items-center justify-center" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <SeoHealthRadial passes={data.totalPasses} warns={data.totalWarns} fails={data.totalFails} />
                      <ChartExplainer tone="emerald" text="SEO health summarizes pass/warn/fail pressure so teams can prioritize fixes with the highest structural impact." />
                    </div>
                  </div>
                  </>
                )}

                {/* ── Visibility Rubric Radar ──────────────────────────── */}
                {hasData && Object.keys(data.deterministicPipeline?.avgFamilyScores ?? {}).length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(129,140,248,0.15)' }}>
                    <VisibilityRubricRadar familyScores={data.deterministicPipeline!.avgFamilyScores} />
                    <ChartExplainer tone="indigo" text="Rubric radar maps your average score across the 9 visibility dimensions so you can spot structural weaknesses at a glance." />
                  </div>
                )}

                {(data.improvementDeltas?.length > 0) && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <ImprovementLeaderboard items={data.improvementDeltas} />
                  </div>
                )}

                <SectionTitle title="Score Summary" tone="orange" sub="Best, average, latest & worst visibility scores" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Best Score',    value: data.bestScore,    color: '#34d399' },
                    { label: 'Average Score', value: data.averageScore, color: '#22d3ee' },
                    { label: 'Latest Score',  value: data.latestScore,  color: '#f97316' },
                    { label: 'Worst Score',   value: data.worstScore,   color: '#fb7185' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-4 text-center"
                      style={{ background: 'rgba(10,14,28,0.70)', border: `1px solid ${color}22` }}>
                      <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-3xl font-black" style={{ color }}>{value || '–'}{value ? '%' : ''}</p>
                      {value > 0 && (
                        <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── Actionable Insights ──────────────────────────────── */}
                {hasData && (
                  <>
                    <SectionTitle title="Actionable Insights" tone="amber" sub="AI-generated recommendations based on your audit data" />
                    <ActionableInsights data={data} pipeline={data.deterministicPipeline} />
                  </>
                )}

                {!hasData && (
                  <div className="text-center py-16">
                    <Zap className="w-10 h-10 text-orange-400/60 mx-auto mb-4" />
                    <p className="text-white/50 mb-4">No analyses yet. Run your first analysis to populate data here.</p>
                    <button onClick={() => navigate("/app/analyze")}
                      className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
                      style={{ background: 'rgba(249,115,22,0.22)', border: '1px solid rgba(249,115,22,0.35)' }}>
                      Analyze a URL
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ TRENDS TAB ════════════════════════════════ */}
            {activeTab === 'trends' && (
              <div className="space-y-6">
                <SectionTitle title="Score & Volume Trends" tone="amber" sub="Track how your visibility scores and audit cadence evolve over time" />

                {data.recentTrend.length > 0 && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(249,115,22,0.15)' }}>
                    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                      <h2 className="text-base brand-title-muted flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-orange-400" /> Score Trend
                      </h2>
                      <div className="flex items-center gap-2">
                      <button onClick={exportTrendsCsv}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/70 hover:text-white transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                        <Download className="w-3.5 h-3.5" /> Export CSV
                      </button>
                      <div className="inline-flex rounded-xl p-1"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {(['avgScore', 'count'] as TrendMetric[]).map((m) => (
                          <button key={m} onClick={() => setTrendMetric(m)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={trendMetric === m
                              ? { background: 'rgba(249,115,22,0.22)', border: '1px solid rgba(249,115,22,0.30)', color: '#fb923c' }
                              : { color: 'rgba(255,255,255,0.50)' }}>
                            {m === 'avgScore' ? 'Score' : 'Volume'}
                          </button>
                        ))}
                      </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart key={trendMetric} data={data.recentTrend}>
                        <defs>
                          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.orange} stopOpacity={0.35} />
                            <stop offset="55%" stopColor={P.cyan} stopOpacity={0.12} />
                            <stop offset="100%" stopColor={P.amber} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={P.orange} />
                            <stop offset="50%" stopColor={P.amber} />
                            <stop offset="100%" stopColor={P.cyan} />
                          </linearGradient>
                          <linearGradient id="volBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.indigo} stopOpacity={0.80} />
                            <stop offset="100%" stopColor={P.indigoDeep ?? P.indigo} stopOpacity={0.25} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={P.lineStroke} />
                        <XAxis dataKey="date" tick={{ fill: P.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                        {isScoreFocus ? (
                          <>
                            <YAxis yAxisId="score" tick={{ fill: P.tick, fontSize: 12 }} domain={[0, 100]} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <ReferenceLine yAxisId="score" y={data.averageScore}
                              stroke={P.amber} strokeDasharray="5 4" strokeOpacity={0.5}
                              label={{ value: `avg ${data.averageScore}%`, fill: P.amberDeep ?? P.amber, fontSize: 10 }} />
                            <Area yAxisId="score" type="monotone" dataKey="avgScore"
                              stroke="url(#trendLine)" fill="url(#trendArea)" strokeWidth={3} name="Avg Score" legendType="none" />
                            <Line yAxisId="score" type="monotone" dataKey="avgScore"
                              stroke="url(#trendLine)" strokeWidth={3} dot={false} name="Avg Score" />
                          </>
                        ) : (
                          <>
                            <YAxis yAxisId="count" tick={{ fill: P.tick, fontSize: 12 }} allowDecimals={false} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar yAxisId="count" dataKey="count" fill="url(#volBar)" radius={[6, 6, 0, 0]} name="Audit Count" />
                          </>
                        )}
                        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.70)', fontSize: 12 }} />
                        <Brush dataKey="date" height={22} stroke="rgba(249,115,22,0.30)"
                          travellerWidth={8} fill="rgba(10,14,28,0.80)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <ChartExplainer tone="amber" text="Trend view isolates whether score quality or audit volume is moving, so you can distinguish quality gains from activity spikes." />
                  </div>
                )}

                {(data.platformTrends?.length > 0) && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(34,211,238,0.15)' }}>
                    <h2 className="text-base brand-title-muted flex items-center gap-2 mb-5">
                      <Cpu className="w-5 h-5 text-cyan-400" /> Platform Score Trends
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={data.platformTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke={P.lineStroke} />
                        <XAxis dataKey="date" tick={{ fill: P.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: P.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.70)', fontSize: 12 }} />
                        <Line type="monotone" dataKey="chatgpt"    stroke={PLATFORM_PALETTE.chatgpt?.fill    ?? P.cyan}   strokeWidth={2.5} dot={false} name="ChatGPT"    connectNulls />
                        <Line type="monotone" dataKey="perplexity" stroke={PLATFORM_PALETTE.perplexity?.fill ?? P.indigo} strokeWidth={2.5} dot={false} name="Perplexity" connectNulls />
                        <Line type="monotone" dataKey="google_ai"  stroke={PLATFORM_PALETTE.google_ai?.fill  ?? P.amber}  strokeWidth={2.5} dot={false} name="Google AI"  connectNulls />
                        <Line type="monotone" dataKey="claude"     stroke={PLATFORM_PALETTE.claude?.fill     ?? P.rose}   strokeWidth={2.5} dot={false} name="Claude"     connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <ChartExplainer tone="cyan" text="Platform lines reveal where model-specific visibility lags, so optimization can be targeted per AI surface." />
                  </div>
                )}

                {data.categoryAverages.length > 0 && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(251,191,36,0.12)' }}>
                    <h2 className="text-base brand-title-muted flex items-center gap-2 mb-5">
                      <BarChart3 className="w-5 h-5 text-amber-400" /> Category Performance
                    </h2>
                    <ResponsiveContainer width="100%" height={Math.max(260, data.categoryAverages.length * 38)}>
                      <ComposedChart data={data.categoryAverages} layout="vertical">
                        <defs>
                          <linearGradient id="catBar" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%"   stopColor={P.orange} stopOpacity={0.90} />
                            <stop offset="50%"  stopColor={P.amber}  stopOpacity={0.80} />
                            <stop offset="100%" stopColor={P.cyan}   stopOpacity={0.75} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={P.lineStroke} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: P.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="category" width={210} tick={{ fill: P.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="avgScore" fill="url(#catBar)" radius={[0, 7, 7, 0]} name="Avg Score" />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <ChartExplainer tone="amber" text="Category bars show which scoring dimensions are dragging overall visibility and need focused remediation." />
                  </div>
                )}

                {Object.keys(data.platformAverages).length > 0 && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(129,140,248,0.14)' }}>
                    <h2 className="text-base brand-title-muted flex items-center gap-2 mb-5">
                      <Globe className="w-5 h-5 text-indigo-400" /> Platform Averages
                    </h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={Object.entries(data.platformAverages).map(([platform, score]) => ({ platform, score }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={P.lineStroke} />
                        <XAxis dataKey="platform" tick={{ fill: P.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: P.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="score"
                          radius={[7, 7, 0, 0]}
                          name="Avg Score"
                          shape={(props: any) => {
                            const { x, y, width, height, payload } = props;
                            const fill = platformFill(payload?.platform || "");
                            return (
                              <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height}
                                rx={7}
                                ry={7}
                                fill={fill}
                              />
                            );
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <ChartExplainer tone="indigo" text="Platform averages benchmark your baseline authority per engine to guide channel-specific improvements." />
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ DOMAINS TAB ═══════════════════════════════ */}
            {activeTab === 'domains' && (
              <div className="space-y-4">
                <SectionTitle title="Domain Performance" tone="orange" sub="Per-domain audit history, scores & improvement deltas" />
                {data.improvementDeltas?.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <ImprovementLeaderboard items={data.improvementDeltas} />
                  </div>
                )}

                {visibleTopDomains.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                      <h2 className="text-base brand-title-muted flex items-center gap-2">
                        <LayoutList className="w-4 h-4 text-orange-400" /> Top Domains
                        <span className="text-xs text-white/40 font-normal">({visibleTopDomains.length} of {data.topDomainsTotal})</span>
                      </h2>
                      <button onClick={exportDomainsCsv} disabled={exportingCsv}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/70 hover:text-white disabled:opacity-50 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                        <Download className="w-3.5 h-3.5" />
                        {exportingCsv ? "Exporting…" : "Export CSV"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                      <div className="relative md:col-span-2">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input value={domainSearch} onChange={(e) => setDomainSearch(e.target.value)}
                          placeholder="Filter domains…"
                          className="field-vivid w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white/80 placeholder:text-white/35 outline-none"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                      </div>
                      <select value={domainSort} onChange={(e) => setDomainSort(e.target.value as DomainSort)}
                        className="field-vivid px-3 py-2 rounded-xl text-sm text-white/80 outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <option value="count">Sort: Audit Count</option>
                        <option value="latest">Sort: Latest Score</option>
                        <option value="avg">Sort: Avg Score</option>
                      </select>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(280, visibleTopDomains.length * 34)}>
                      <ComposedChart data={visibleTopDomains} layout="vertical">
                        <defs>
                          <linearGradient id="domBarGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={P.indigo} stopOpacity={0.85} />
                            <stop offset="100%" stopColor={P.indigoDeep ?? P.indigo} stopOpacity={0.30} />
                          </linearGradient>
                          <linearGradient id="domLineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={P.orange} />
                            <stop offset="100%" stopColor={P.cyan} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={P.lineStroke} />
                        <XAxis type="number" tick={{ fill: P.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="domain" type="category" width={180} tick={{ fill: P.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.70)', fontSize: 12 }} />
                        <Bar dataKey="count" fill="url(#domBarGrad)" radius={[0, 6, 6, 0]} name="Audit Count" />
                        <Line dataKey="latestScore" stroke="url(#domLineGrad)" strokeWidth={2.5} dot={false} name="Latest Score %" connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <ChartExplainer tone="rose" text="Bars are raw audit counts per domain (not percent); line is latest score percentage for each URL." />
                  </div>
                )}
                {data.topDomains.length > 0 && visibleTopDomains.length === 0 && (
                  <div className="rounded-2xl p-5 text-sm text-white/50" style={{ background: 'rgba(10,14,28,0.70)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    No domains match your filter.
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ SEO HEALTH TAB ════════════════════════════ */}
            {activeTab === 'seo' && (
              <div className="space-y-6">
                <SectionTitle title="SEO Diagnostic Checks" tone="emerald" sub="Pass/warn/fail breakdown, compliance posture & rule-level analytics" />
                {Object.keys(data.seoDiagnosticsSummary || {}).length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl p-5 flex flex-col items-center gap-4"
                        style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(52,211,153,0.14)' }}>
                        <h2 className="text-sm brand-title-muted w-full flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-emerald-400" /> Overall SEO Health
                        </h2>
                        <SeoHealthRadial passes={data.totalPasses} warns={data.totalWarns} fails={data.totalFails} />
                        <div className="w-full grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: 'Passes', value: data.totalPasses, color: '#34d399' },
                            { label: 'Warnings', value: data.totalWarns, color: '#fbbf24' },
                            { label: 'Fails', value: data.totalFails, color: '#fb7185' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="rounded-xl p-2" style={{ background: `${color}10`, border: `1px solid ${color}22` }}>
                              <p className="text-xs text-white/50">{label}</p>
                              <p className="text-xl font-bold" style={{ color }}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(251,113,133,0.14)' }}>
                        <h2 className="text-sm brand-title-muted mb-3 flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-rose-400" /> Top Failed Checks
                        </h2>
                        <div className="space-y-2">
                          {topFailedFindings.map((f) => (
                            <div key={f.check} className="rounded-xl p-3"
                              style={{ background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.14)' }}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-white">{f.label}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full text-rose-300"
                                  style={{ background: 'rgba(251,113,133,0.18)', border: '1px solid rgba(251,113,133,0.25)' }}>
                                  Fail {f.fail}
                                </span>
                              </div>
                              <p className="text-xs text-white/55">{checkFocusHint(f.check)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(34,211,238,0.16)' }}>
                      <h2 className="text-sm brand-title-muted mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-400" /> Compliance Audit Status
                      </h2>
                      {complianceStatus ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p className="text-xs text-white/50">Organization</p>
                            <p className="text-white/85 font-medium mt-1">{complianceStatus.organization?.name || '-'}</p>
                            <p className="text-xs text-white/55 mt-1">{complianceStatus.organization?.registration_status || 'Status unavailable'}</p>
                          </div>
                          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p className="text-xs text-white/50">SOC2 Type 1</p>
                            <p className="text-white/85 font-medium mt-1 capitalize">{complianceStatus.compliance?.soc2_type1?.status || 'unknown'}</p>
                            <p className="text-xs text-white/55 mt-1">Last audit: {complianceStatus.compliance?.soc2_type1?.last_audit || '-'}</p>
                          </div>
                          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p className="text-xs text-white/50">VANTA</p>
                            <p className="text-white/85 font-medium mt-1">{complianceStatus.compliance?.vanta?.enabled ? 'Enabled' : 'Disabled'}</p>
                            <p className="text-xs text-white/55 mt-1 capitalize">{complianceStatus.compliance?.vanta?.monitoring_status || 'unknown'}</p>
                          </div>
                          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p className="text-xs text-white/50">DRATA</p>
                            <p className="text-white/85 font-medium mt-1">{complianceStatus.compliance?.drata?.enabled ? 'Enabled' : 'Disabled'}</p>
                            <p className="text-xs text-white/55 mt-1">Audit ready: {complianceStatus.compliance?.drata?.audit_ready ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-white/60">No live compliance payload available from the backend endpoint.</p>
                      )}
                      <ChartExplainer tone="cyan" text="Compliance panel reflects backend-reported security posture and attestation state for executive review." />
                    </div>

                    <div className="rounded-2xl p-5" style={{ background: 'rgba(10,14,28,0.75)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <h2 className="text-sm brand-title-muted flex items-center gap-2">
                          <Layers className="w-4 h-4 text-white/60" /> All SEO Checks
                        </h2>
                        <button onClick={exportSeoChecksCsv}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/70 hover:text-white transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                          <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {diagnosticRanking.map(({ check, label, pass, warn, fail, total, failRate }) => (
                          <div key={check} className="rounded-xl p-3"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs uppercase tracking-wider text-white/60">{label}</p>
                              {failRate > 50 && <span className="text-xs text-rose-400"> high fail</span>}
                            </div>
                            <div className="h-2 rounded-full overflow-hidden flex mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full" style={{ width: `${total ? (pass / total) * 100 : 0}%`, background: '#34d399' }} />
                              <div className="h-full" style={{ width: `${total ? (warn / total) * 100 : 0}%`, background: '#fbbf24' }} />
                              <div className="h-full" style={{ width: `${total ? (fail / total) * 100 : 0}%`, background: '#fb7185' }} />
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="px-1.5 py-0.5 rounded text-emerald-300" style={{ background: 'rgba(52,211,153,0.12)' }}> {pass}</span>
                              <span className="px-1.5 py-0.5 rounded text-amber-300"   style={{ background: 'rgba(251,191,36,0.12)' }}> {warn}</span>
                              <span className="px-1.5 py-0.5 rounded text-rose-300"   style={{ background: 'rgba(251,113,133,0.12)' }}> {fail}</span>
                              <span className="ml-auto text-white/35">{total} total</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Rule Pass Rates Panel ────────────────────────── */}
                    {data.deterministicPipeline?.rulePassRates && data.deterministicPipeline.rulePassRates.length > 0 && (
                      <RulePassRatesPanel rules={data.deterministicPipeline.rulePassRates} />
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-white/40">
                    <Target className="w-8 h-8 mx-auto mb-3" />
                    <p>Run more analyses to see SEO check data.</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ INSIGHTS TAB ══════════════════════════════ */}
            {activeTab === 'insights' && (
              <div className="space-y-6">
                <SectionTitle title="Deep Insights" tone="rose" sub="Recommendations, schema adoption, content signals & score volatility" />
                {/* Recommendation Insights */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                    <Zap className="w-4 h-4 text-amber-400" /> Recommendation Insights
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-2xl font-bold text-white">{data.recommendationInsights.total}</p>
                      <p className="text-[11px] text-white/50">Total Recommendations</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-2xl font-bold text-cyan-400">{data.recommendationInsights.avgPerAudit}</p>
                      <p className="text-[11px] text-white/50">Avg per Audit</p>
                    </div>
                  </div>
                  {data.recommendationInsights.topCategories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-white/40 font-medium">Top Recommendation Categories</p>
                      {data.recommendationInsights.topCategories.map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                          <span className="text-xs text-white/70 capitalize">{cat.category}</span>
                          <span className="text-xs font-bold text-cyan-400">{cat.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Schema Markup Adoption */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                    <Layers className="w-4 h-4 text-violet-400" /> Schema Markup Adoption
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-2xl font-bold text-white">{data.schemaInsights.coveragePct}%</p>
                      <p className="text-[11px] text-white/50">Sites with Schema</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-2xl font-bold text-violet-400">{data.schemaInsights.avgJsonLd}</p>
                      <p className="text-[11px] text-white/50">Avg JSON-LD Blocks</p>
                    </div>
                  </div>
                  {data.schemaInsights.topTypes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-white/40 font-medium">Detected Schema Types</p>
                      {data.schemaInsights.topTypes.map((t) => (
                        <div key={t.type} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                          <span className="text-xs text-white/70">{t.type}</span>
                          <span className="text-xs font-bold text-violet-400">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Content & Technical Signals */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                    <BarChart3 className="w-4 h-4 text-emerald-400" /> Content &amp; Technical Signals
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-lg font-bold text-white">{data.contentAndTech.avgWordCount.toLocaleString()}</p>
                      <p className="text-[10px] text-white/50">Avg Words</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-lg font-bold text-emerald-400">{data.contentAndTech.httpsPct}%</p>
                      <p className="text-[10px] text-white/50">HTTPS</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-lg font-bold text-cyan-400">{data.contentAndTech.avgResponseTimeMs}ms</p>
                      <p className="text-[10px] text-white/50">Avg Response</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-lg font-bold text-amber-400">{data.contentAndTech.slowestResponseMs}ms</p>
                      <p className="text-[10px] text-white/50">Slowest</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-sm text-white/60">Word Count Range</p>
                      <p className="text-xs text-white/40">{data.contentAndTech.minWordCount.toLocaleString()} - {data.contentAndTech.maxWordCount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <p className="text-sm text-white/60">Fastest Response</p>
                      <p className="text-xs text-white/40">{data.contentAndTech.fastestResponseMs}ms</p>
                    </div>
                  </div>
                </div>

                {/* Score Volatility */}
                {data.scoreVolatility.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                      <Activity className="w-4 h-4 text-rose-400" /> Score Volatility
                    </h3>
                    <p className="text-xs text-white/40 mb-3">Domains with 2+ audits, ranked by score standard deviation.</p>
                    <div className="space-y-2">
                      {data.scoreVolatility.map((v) => (
                        <div key={v.domain} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-white/70 truncate">{v.domain}</span>
                            <span className="text-[10px] text-white/30">{v.audits} audits</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono text-white/60">σ {v.stddev}</span>
                            <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                              v.label === 'stable' ? 'bg-emerald-500/20 text-emerald-300' :
                              v.label === 'moderate' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-rose-500/20 text-rose-300'
                            }`}>{v.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasData && (
                  <div className="text-center py-12 text-white/40">
                    <Zap className="w-8 h-8 mx-auto mb-3" />
                    <p>Run more analyses to unlock deeper insights.</p>
                  </div>
                )}
              </div>
            )}

          </>
        )}

      </div>
    </div>
  );
}