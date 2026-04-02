import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Globe, FileText, Code2, Brain, Shield, CheckCircle2,
  BarChart3, Sparkles, Loader2, Lock, Cpu, Database, Eye,
  Server, Zap, Activity, Radio, Minimize2
} from "lucide-react";
import { API_URL } from "../config";
import { CANONICAL_MODELS } from "../constants/marketingClaims";

// ─── Audit Step Configuration ───────────────────────────────────────────────

interface AuditStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  gated?: "signal"; // tier-locked indicator
}

function makeBaseSteps(tier: string): AuditStep[] {
  const ai1Model = (tier === "signal" || tier === "scorefix")
    ? CANONICAL_MODELS.signalPrimary
    : tier === "alignment"
      ? CANONICAL_MODELS.alignmentPrimary
      : CANONICAL_MODELS.observerPrimary;
  return [
    { id: "dns",       label: "DNS Resolution",           description: "Resolving domain and verifying SSL certificate chain",     icon: Globe    },
    { id: "crawl",     label: "Page Crawl & Fetch",       description: "Fetching HTML, CSS, and JavaScript resources",             icon: Server   },
    { id: "extract",   label: "Content Extraction",       description: "Parsing headings, meta tags, body content, and links",     icon: FileText },
    { id: "schema",    label: "Schema & Structured Data", description: "Analyzing JSON-LD, Open Graph, and Twitter Card markup",   icon: Code2    },
    { id: "technical", label: "Technical Foundation Scan", description: "Evaluating speed, HTTPS, canonicals, crawlability, and answer-engine access", icon: Cpu },
    { id: "security",  label: "Security & Threat Scan",   description: "URLhaus + Google Safe Browsing + crypto signals",          icon: Shield   },
    { id: "ai1",       label: "AI Primary Analysis",      description: `Deep visibility scoring with ${ai1Model}`,                icon: Brain    },
  ];
}

const TRIPLE_CHECK_STEPS: AuditStep[] = [
  { id: "ai2", label: "AI Peer Critique",   description: `Cross-checking findings with ${CANONICAL_MODELS.signalCritique}`,   icon: Eye,    gated: "signal" },
  { id: "ai3", label: "AI Validation Gate",  description: `Final validation pass with ${CANONICAL_MODELS.signalValidation}`, icon: Shield, gated: "signal" },
];

const CLOSING_STEPS: AuditStep[] = [
  { id: "compile",  label: "Score Compilation",  description: "Aggregating scores across all AI platforms",         icon: BarChart3 },
  { id: "finalize", label: "Report Generation",  description: "Building actionable recommendations & audit report", icon: Sparkles  },
];

function buildSteps(tripleCheck: boolean, tier: string = ""): AuditStep[] {
  const base = makeBaseSteps(tier);
  return tripleCheck
    ? [...base, ...TRIPLE_CHECK_STEPS, ...CLOSING_STEPS]
    : [...base, ...CLOSING_STEPS];
}

/** Step order the server may emit — used to fast-forward past intermediate steps */
const SSE_STEP_ORDER = [
  "initializing", "dns", "crawl", "extract", "schema", "technical", "security",
  "ai1", "ai2", "ai3", "compile", "finalize", "complete",
];

// ─── Gauge Arc Component ────────────────────────────────────────────────────

function GaugeArc({ percent, size = 200 }: { percent: number; size?: number }) {
  const sw = 8;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75; // 270° sweep
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = arcLen - (arcLen * clamped) / 100;

  const dotAngleDeg = 135 + (clamped / 100) * 270;
  const dotRad = (dotAngleDeg * Math.PI) / 180;
  const dotX = cx + r * Math.cos(dotRad);
  const dotY = cy + r * Math.sin(dotRad);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl">
      <defs>
        <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="45%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#e9a634" />
        </linearGradient>
        <filter id="gauge-glow">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="dot-glow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background arc */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${arcLen} ${circ}`} transform={`rotate(135 ${cx} ${cy})`} />

      {/* Progress arc */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gauge-grad)" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${arcLen} ${circ}`} strokeDashoffset={offset}
        transform={`rotate(135 ${cx} ${cy})`} filter="url(#gauge-glow)"
        className="transition-all duration-700 ease-out" />

      {/* Tick marks */}
      {Array.from({ length: 28 }).map((_, i) => {
        const angle = 135 + (i / 27) * 270;
        const rad = (angle * Math.PI) / 180;
        const isMajor = i % 9 === 0;
        const len = isMajor ? 8 : 4;
        const inner = r - sw / 2 - 4;
        return (
          <line key={i}
            x1={cx + (inner - len) * Math.cos(rad)} y1={cy + (inner - len) * Math.sin(rad)}
            x2={cx + inner * Math.cos(rad)} y2={cy + inner * Math.sin(rad)}
            stroke={`rgba(255,255,255,${isMajor ? 0.2 : 0.08})`} strokeWidth={isMajor ? 1.5 : 0.8} />
        );
      })}

      {/* Glowing endpoint dot */}
      {clamped > 0.5 && (
        <>
          <circle cx={dotX} cy={dotY} r={8} fill="white" opacity={0.15} filter="url(#dot-glow)" />
          <circle cx={dotX} cy={dotY} r={4} fill="white" filter="url(#dot-glow)" className="animate-pulse" />
        </>
      )}

      {/* Center text */}
      <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="central"
        fill="white" fontWeight="700" style={{ fontSize: "38px", fontFamily: "ui-monospace, monospace" }}>
        {Math.round(clamped)}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.5)" style={{ fontSize: "11px", fontFamily: "system-ui", letterSpacing: "0.12em" }}>
        PERCENT
      </text>
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface AuditProgressOverlayProps {
  isActive: boolean;
  url: string;
  onComplete?: () => void;
  onMinimize?: () => void;
  onPercentChange?: (pct: number) => void;
  apiFinished: boolean;
  tripleCheck?: boolean;
  tier?: string;
  scanCount?: number;
  isRetryScan?: boolean;
  /** Server request ID — overlay opens its own SSE stream for real-time progress */
  requestId?: string | null;
  authToken?: string | null;
}

export default function AuditProgressOverlay({
  isActive, url, onComplete, onMinimize, onPercentChange, apiFinished, tripleCheck = false,
  tier = "", scanCount = 0, isRetryScan = false, requestId, authToken,
}: AuditProgressOverlayProps) {
  const steps = useMemo(() => buildSteps(tripleCheck, tier), [tripleCheck, tier]);
  const stepIds = useMemo(() => steps.map((s) => s.id), [steps]);
  const modelCount = tripleCheck ? 3 : 1;

  // ── SSE-driven state ──
  const [sseStep, setSseStep] = useState<string>("initializing");
  const [ssePercent, setSsePercent] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  // ── Visual state ──
  const [startTime, setStartTime] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [displayPercent, setDisplayPercent] = useState(0);
  const [connectionNonce, setConnectionNonce] = useState(0);
  const finishCalledRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const stalledTimerRef = useRef<number | null>(null);
  const lastSseUpdateAtRef = useRef<number>(Date.now());

  // Particle data (stable across renders)
  const [particles] = useState(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 0.8 + Math.random() * 2, dur: 3 + Math.random() * 5, delay: Math.random() * 6,
    }))
  );
  const [dataStreams] = useState(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i, x: 8 + Math.random() * 84, dur: 4 + Math.random() * 4, delay: Math.random() * 3,
    }))
  );

  // ── Helpers ──
  const completeAll = useCallback(() => {
    setCompletedSteps(new Set(stepIds));
    setSsePercent(100);
    setActiveStepId(null);
  }, [stepIds]);

  const triggerFinish = useCallback(() => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;
    completeAll();
    setFinishing(true);
    setTimeout(() => onComplete?.(), 1000);
  }, [completeAll, onComplete]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearStalledTimer = useCallback(() => {
    if (stalledTimerRef.current) {
      window.clearInterval(stalledTimerRef.current);
      stalledTimerRef.current = null;
    }
  }, []);

  // ── Open SSE stream ──
  useEffect(() => {
    if (!isActive || !requestId) return;

    clearReconnectTimer();

    // Close stale
    try { esRef.current?.close(); } catch {}

    const tokenQuery = authToken ? `?token=${encodeURIComponent(authToken)}` : "";
    const sseUrl = `${API_URL}/api/audit/progress/${encodeURIComponent(requestId)}${tokenQuery}`;
    const es = new EventSource(sseUrl);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (typeof data?.step !== "string" || typeof data?.percent !== "number") return;
        setSseConnected(true);
        lastSseUpdateAtRef.current = Date.now();
        const step = data.step as string;
        const pct = Math.max(0, Math.min(100, Math.round(data.percent)));

        setSseStep(step);
        setSsePercent((prev) => Math.max(prev, pct));

        // Mark all steps before current as completed
        const idx = SSE_STEP_ORDER.indexOf(step);
        if (idx >= 0) {
          setCompletedSteps((prev) => {
            const next = new Set(prev);
            for (let i = 0; i < idx; i++) {
              const sid = SSE_STEP_ORDER[i];
              if (stepIds.includes(sid)) next.add(sid);
            }
            return next;
          });
          if (step === "complete") {
            setCompletedSteps(new Set(stepIds));
            setActiveStepId(null);
          } else if (stepIds.includes(step)) {
            setActiveStepId(step);
          }
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setSseConnected(false);
      try { es.close(); } catch {}
      esRef.current = null;
      if (!isActive || finishCalledRef.current) return;
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        setConnectionNonce((n) => n + 1);
      }, 1500);
    };

    return () => {
      clearReconnectTimer();
      try { es.close(); } catch {}
      esRef.current = null;
    };
  }, [isActive, requestId, stepIds, connectionNonce, clearReconnectTimer, authToken]);

  // ── Safety-net: auto-dismiss after 90s ──
  useEffect(() => {
    if (!isActive) return;
    lastSseUpdateAtRef.current = Date.now();
    const t = setTimeout(() => triggerFinish(), 90_000);
    return () => clearTimeout(t);
  }, [isActive, triggerFinish]);

  // ── Handle apiFinished ──
  useEffect(() => {
    if (!apiFinished || !isActive || finishCalledRef.current) return;
    // Close SSE stream
    clearReconnectTimer();
    try { esRef.current?.close(); } catch {}
    triggerFinish();
  }, [apiFinished, isActive, triggerFinish, clearReconnectTimer]);

  // ── Fallback progress when SSE stalls ──
  useEffect(() => {
    if (!isActive || apiFinished) return;
    clearStalledTimer();

    stalledTimerRef.current = window.setInterval(() => {
      const msSinceUpdate = Date.now() - lastSseUpdateAtRef.current;
      if (msSinceUpdate < 4000) return;

      setSsePercent((prev) => {
        if (prev >= 95) return prev;
        const elapsedMs = Date.now() - startTime;
        const elapsedFloor = Math.min(92, Math.floor((elapsedMs / 90000) * 100));
        const fallbackTarget = Math.max(prev + 1, elapsedFloor);
        const nextPct = Math.max(prev, Math.min(95, fallbackTarget));

        // If SSE is stalled, still advance visible steps from percent mapping.
        const usableSteps = stepIds.filter((id) => id !== "complete" && id !== "initializing");
        const maxIdx = Math.max(0, usableSteps.length - 1);
        const idx = Math.min(maxIdx, Math.floor((nextPct / 100) * usableSteps.length));
        const current = usableSteps[idx] || null;

        setActiveStepId(current);
        setCompletedSteps((existing) => {
          const next = new Set(existing);
          for (let i = 0; i < idx; i++) {
            const sid = usableSteps[i];
            if (sid) next.add(sid);
          }
          return next;
        });

        return nextPct;
      });
    }, 1200);

    return () => clearStalledTimer();
  }, [isActive, apiFinished, startTime, clearStalledTimer, stepIds]);

  // ── Smooth display percent ──
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => {
      setDisplayPercent((prev) => {
        if (prev >= ssePercent) return ssePercent;
        const diff = ssePercent - prev;
        return Math.min(ssePercent, prev + Math.max(0.15, diff * 0.08));
      });
    }, 30);
    return () => clearInterval(iv);
  }, [isActive, ssePercent]);

  // ── Report percent to parent (for minimized banner) ──
  useEffect(() => {
    onPercentChange?.(displayPercent);
  }, [displayPercent, onPercentChange]);

  // ── Elapsed clock ──
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => setElapsedMs(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [isActive, startTime]);

  // ── Reset on activation ──
  useEffect(() => {
    if (isActive) {
      clearReconnectTimer();
      clearStalledTimer();
      setStartTime(Date.now());
      setSseStep("initializing");
      setSsePercent(0);
      setDisplayPercent(0);
      setCompletedSteps(new Set());
      setActiveStepId(null);
      setFinishing(false);
      setSseConnected(false);
      setConnectionNonce(0);
      lastSseUpdateAtRef.current = Date.now();
      finishCalledRef.current = false;
    }
    return () => {
      clearReconnectTimer();
      clearStalledTimer();
    };
  }, [isActive, clearReconnectTimer, clearStalledTimer]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  if (!isActive) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-700 ${finishing ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div key={p.id} className="absolute rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`,
              background: `rgba(255,255,255,${0.08 + Math.random() * 0.12})`,
              animation: `apo-float ${p.dur}s ease-in-out infinite`, animationDelay: `${p.delay}s` }} />
        ))}
      </div>

      {/* Data stream lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {dataStreams.map((ds) => (
          <div key={ds.id} className="absolute w-px" style={{ left: `${ds.x}%`, top: 0, height: "100%",
            background: "linear-gradient(180deg, transparent 0%, rgba(139,92,246,0.12) 40%, rgba(6,182,212,0.12) 60%, transparent 100%)",
            animation: `apo-stream ${ds.dur}s ease-in-out infinite`, animationDelay: `${ds.delay}s` }} />
        ))}
      </div>

      {/* Scan line */}
      <div className="absolute left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.3), transparent)",
          animation: "apo-scan 4s linear infinite" }} />

      {/* ── Main card ── */}
      <div className="relative z-10 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin">
        {/* Outer glow ring */}
        <div className="absolute -inset-2 rounded-[28px] blur-2xl opacity-40 animate-pulse"
          style={{ background: "conic-gradient(from 0deg, #06b6d4, #8b5cf6, #e9a634, #06b6d4)", animationDuration: "4s" }} />

        <div className="relative bg-[#1a1f2e] border border-white/[0.08] rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
          {/* Inner corner accents */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-violet-500/5 rounded-full blur-3xl" />

          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/80 text-xs font-semibold tracking-widest uppercase mb-3">
              <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              {tripleCheck ? "Triple-Check AI Audit" : "AI Audit in Progress"}
            </div>

            {/* Status badges */}
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[10px]">
              <span className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/60 uppercase tracking-wider">
                Audit #{Math.max(1, scanCount)}
              </span>
              {isRetryScan && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400/80 uppercase tracking-wider">
                  Retry
                </span>
              )}
              <span className={`px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                apiFinished
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80"
                  : sseConnected
                    ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400/80"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-300/80"
              }`}>
                {apiFinished ? "Response Received" : sseConnected ? "Live SSE Stream" : "Fallback Progress"}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400/80 uppercase tracking-wider">
                {tier === "scorefix" ? "Score Fix" : tier === "signal" ? "Signal" : tier === "alignment" ? "Alignment" : "Observer"}
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-white mb-1.5">Deep Audit Running</h2>
            <p className="text-white/45 text-sm truncate max-w-md mx-auto font-mono">{url}</p>
          </div>

          {/* Gauge + Steps layout */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Left: Gauge */}
            <div className="flex flex-col items-center flex-shrink-0 mx-auto md:mx-0">
              <div className="relative">
                {/* Radar ping rings */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="absolute rounded-full border border-white/[0.04]"
                      style={{ width: `${140 + i * 50}px`, height: `${140 + i * 50}px`,
                        animation: `apo-radar ${3 + i}s ease-out infinite`, animationDelay: `${i * 0.8}s` }} />
                  ))}
                </div>
                <GaugeArc percent={displayPercent} size={200} />
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-white/50">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-violet-400/70" />
                  {modelCount} Model{modelCount > 1 ? "s" : ""}
                </span>
                <span className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-400/70" />
                  {formatTime(elapsedMs)}
                </span>
              </div>
            </div>

            {/* Right: Steps timeline */}
            <div className="flex-1 min-w-0 w-full">
              <div className="space-y-0.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                {steps.map((step, idx) => {
                  const isCompleted = completedSteps.has(step.id);
                  const isCurrent = step.id === activeStepId;
                  const isLocked = !!step.gated && tier !== "signal" && tier !== "scorefix";
                  const Icon = step.icon;

                  return (
                    <div key={step.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-500 ${
                        isCurrent
                          ? "bg-white/[0.06] border border-white/[0.1] shadow-lg shadow-white/[0.02] scale-[1.01]"
                          : isCompleted
                          ? "bg-transparent border border-transparent"
                          : "border border-transparent opacity-40"
                      }`}>
                      {/* Step icon */}
                      <div className="relative flex-shrink-0">
                        {idx < steps.length - 1 && (
                          <div className={`absolute left-1/2 top-full w-px h-2 -translate-x-1/2 transition-colors duration-500 ${
                            isCompleted ? "bg-white/15" : "bg-white/[0.04]"}`} />
                        )}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${
                          isCurrent ? "bg-gradient-to-br from-cyan-500/20 to-violet-500/20 ring-1 ring-white/10"
                          : isCompleted ? "bg-emerald-500/10" : "bg-white/[0.04]"
                        }`}>
                          {isLocked ? <Lock className="w-3.5 h-3.5 text-white/30" />
                            : isCompleted ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80" />
                            : isCurrent ? <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                            : <Icon className="w-3.5 h-3.5 text-white/30" />}
                        </div>
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium transition-colors duration-300 ${
                            isCurrent ? "text-white" : isCompleted ? "text-white/65" : "text-white/40"
                          }`}>{step.label}</span>
                          {isLocked && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400/60 uppercase tracking-wider">
                              Signal+
                            </span>
                          )}
                          {isCurrent && (
                            <span className="ml-auto text-[9px] font-mono text-cyan-400/80 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/15">
                              active
                            </span>
                          )}
                        </div>
                        {(isCurrent || isCompleted) && (
                          <p className="text-[11px] text-white/40 truncate mt-0.5">{step.description}</p>
                        )}
                      </div>

                      {isCompleted && (
                        <span className="text-[9px] text-emerald-400/60 font-mono flex-shrink-0">done</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/45">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400/70" />
                {completedSteps.size}/{steps.length} steps
              </span>
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400/70" />
                <span className="font-mono">{formatTime(elapsedMs)}</span>
              </span>
            </div>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-violet-400/70" />
              BRAG Evidence Pipeline — No data leaves our secure infrastructure
            </span>
          </div>

          {/* Minimize to banner */}
          {onMinimize && !finishing && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={onMinimize}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-medium text-white/60 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white/80 hover:border-white/[0.15] transition-all"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Continue browsing — minimize to banner
              </button>
            </div>
          )}

          {/* Trust strip */}
          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-[0.18em]">
              <Database className="w-3 h-3" />
              {tripleCheck
                ? "Triple-check methodology · 3 independent AI models"
                : `${modelCount} AI model${modelCount > 1 ? "s" : ""} · Evidence-backed scoring`}
            </span>
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes apo-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.15; }
          50% { transform: translateY(-18px) scale(1.3); opacity: 0.35; }
        }
        @keyframes apo-stream {
          0%, 100% { opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; }
        }
        @keyframes apo-scan {
          0% { top: -2%; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 102%; opacity: 0; }
        }
        @keyframes apo-radar {
          0% { transform: scale(0.85); opacity: 0.3; }
          100% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
