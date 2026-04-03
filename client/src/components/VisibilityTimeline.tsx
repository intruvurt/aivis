/**
 * VisibilityTimeline — recharts line chart showing audit score over time.
 * Fix-event overlays are rendered as custom dots on the chart.
 *
 * Props:
 *   url        — the URL to show the timeline for (required)
 *   days       — look-back window (default 30)
 *   className  — optional Tailwind class override
 */

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from "recharts";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import { buildBearerHeader } from "../utils/authToken";

// ── Types ────────────────────────────────────────────────────────────────────

interface TimelinePoint {
  date: string;
  score: number;
  delta: number | null;
  event?: {
    type: string;
    label: string | null;
    auditId: string | null;
    fixId: string | null;
  };
}

interface TimelineData {
  points: TimelinePoint[];
  minScore: number;
  maxScore: number;
  latestScore: number | null;
  trend: "up" | "down" | "stable";
}

interface Props {
  url: string;
  days?: number;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function eventColor(type: string): string {
  switch (type) {
    case "fix_merged": return "#22c55e";
    case "deploy_hook": return "#f97316";
    case "self_healing": return "#a855f7";
    case "competitor_shift": return "#ef4444";
    case "scheduled_rescan": return "#3b82f6";
    default: return "#6366f1";
  }
}

function trendLabel(trend: "up" | "down" | "stable"): { text: string; cls: string } {
  if (trend === "up") return { text: "↑ Trending up", cls: "text-green-400" };
  if (trend === "down") return { text: "↓ Trending down", cls: "text-red-400" };
  return { text: "→ Stable", cls: "text-slate-400" };
}

// ── Custom event dot ─────────────────────────────────────────────────────────

function EventDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.event) return null;
  const color = eventColor(payload.event.type);
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={color} stroke="#0f172a" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill="#fff" />
    </g>
  );
}

// ── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TimelinePoint;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-300 font-medium">{formatDate(d.date)}</p>
      <p className="text-indigo-300 font-bold text-base">{d.score} / 100</p>
      {d.delta !== null && (
        <p className={d.delta >= 0 ? "text-green-400" : "text-red-400"}>
          {d.delta >= 0 ? "+" : ""}{d.delta.toFixed(1)} vs previous
        </p>
      )}
      {d.event && (
        <p className="text-slate-400 mt-1 max-w-[200px] truncate">
          <span style={{ color: eventColor(d.event.type) }}>●</span>{" "}
          {d.event.label || d.event.type}
        </p>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function VisibilityTimeline({ url, days = 30, className = "" }: Props) {
  const { token } = useAuthStore();
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(days);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ url, days: String(selectedDays) });
    fetch(`${(API_URL || "").replace(/\/+$/, "")}/api/self-healing/timeline?${params}`, {
      headers: buildBearerHeader(token),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTimeline(data.timeline);
        else setError(data.error || "Failed to load timeline");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [url, selectedDays, token]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <span className="text-slate-400 animate-pulse">Loading timeline…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <span className="text-red-400 text-sm">{error}</span>
      </div>
    );
  }

  if (!timeline || timeline.points.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-48 gap-2 ${className}`}>
        <span className="text-slate-400 text-sm">No timeline data yet.</span>
        <span className="text-slate-500 text-xs">Run an audit to start tracking your score over time.</span>
      </div>
    );
  }

  const { text: trendText, cls: trendCls } = trendLabel(timeline.trend);
  const chartData = timeline.points.map((p) => ({
    ...p,
    dateLabel: formatDate(p.date),
  }));

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 className="text-white font-semibold text-base">Visibility Score Timeline</h3>
          <p className={`text-sm mt-0.5 ${trendCls}`}>{trendText}</p>
        </div>

        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDays(d)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedDays === d
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="dateLabel" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
          <YAxis
            domain={[Math.max(0, (timeline.minScore ?? 0) - 5), Math.min(100, (timeline.maxScore ?? 100) + 5)]}
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="#334155" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={<EventDot />}
            activeDot={{ r: 5, fill: "#818cf8", stroke: "#0f172a", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Event legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { type: "fix_merged", label: "Fix merged" },
          { type: "scheduled_rescan", label: "Rescan" },
          { type: "deploy_hook", label: "Deploy" },
          { type: "self_healing", label: "Self-heal" },
        ].map(({ type, label }) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span style={{ color: eventColor(type) }}>●</span> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default VisibilityTimeline;
