import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../../config';

type TraceStatus = 'pass' | 'warn' | 'fail';

interface TraceEvent {
  timestamp: string;
  name: string;
  detail: string;
  status: TraceStatus;
}

interface AuditTraceSession {
  sessionId: string;
  targetUrl: string;
  executionId: string;
  executionTimeMs: number;
  finalScoreVector: {
    comprehension: number;
    verificationConfidence: number;
    citationConfidence: number;
  };
  events: TraceEvent[];
}

type PublicSessionRow = {
  id: string;
  target_url: string;
  execution_time_ms: number | null;
  final_score_vector: Record<string, unknown> | null;
};

type PublicEventRow = {
  id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  sequence_index: number;
  created_at: string;
};

type ReplayFrame = {
  event_id: string;
  sequence_index: number;
  timestamp: string;
  replay_ms: number;
  event_type: string;
  event_payload: Record<string, unknown>;
};

type LatestSessionResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  session?: PublicSessionRow;
  events?: PublicEventRow[];
};

type ReplayResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  replay?: {
    session: PublicSessionRow;
    duration_ms: number;
    at_ms: number;
    frames: ReplayFrame[];
  };
};

const TRACE_SESSION: AuditTraceSession = {
  sessionId: 'sess_homepage_20260422_165042',
  targetUrl: 'https://aivis.biz/',
  executionId: 'scan_7fa2b4f1f40c',
  executionTimeMs: 4938,
  finalScoreVector: {
    comprehension: 0.86,
    verificationConfidence: 0.64,
    citationConfidence: 0.62,
  },
  events: [
    {
      timestamp: '16:50:42.011Z',
      name: 'crawl.started',
      detail: 'target=https://aivis.biz/',
      status: 'pass',
    },
    {
      timestamp: '16:50:42.318Z',
      name: 'dom.structure.extract',
      detail: 'nodes=142, headings=19, jsonld=3',
      status: 'pass',
    },
    {
      timestamp: '16:50:42.781Z',
      name: 'entity.resolve',
      detail: 'entities=27, canonicalized=22, ambiguous=1',
      status: 'warn',
    },
    {
      timestamp: '16:50:43.106Z',
      name: 'schema.validate',
      detail: 'graphs=3, overlap=WebPage+HowTo',
      status: 'warn',
    },
    {
      timestamp: '16:50:44.709Z',
      name: 'citation.simulation.run',
      detail: 'engines=chatgpt,claude,perplexity; confidence=0.62',
      status: 'fail',
    },
    {
      timestamp: '16:50:45.927Z',
      name: 'failure.scan.completed',
      detail: 'failure_points=3, threshold_breaches=1',
      status: 'warn',
    },
    {
      timestamp: '16:50:46.949Z',
      name: 'audit.finalized',
      detail: 'score_vector=comprehension:0.86,verification:0.64,citation:0.62',
      status: 'pass',
    },
  ],
};

const REPLAY_WINDOW_MS = 4000;
const SCRUB_DEBOUNCE_MS = 48;

function asNumber(input: unknown, fallback: number): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const n = Number(input);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function vectorFromUnknown(input: unknown, fallback: AuditTraceSession['finalScoreVector']) {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    comprehension: asNumber(raw.comprehension, fallback.comprehension),
    verificationConfidence: asNumber(raw.verificationConfidence, fallback.verificationConfidence),
    citationConfidence: asNumber(raw.citationConfidence, fallback.citationConfidence),
  };
}

function deriveStatus(eventType: string, payload: Record<string, unknown>): TraceStatus {
  const payloadStatus = String(payload.status ?? '').toLowerCase();
  if (payloadStatus === 'pass' || payloadStatus === 'ok' || payloadStatus === 'success')
    return 'pass';
  if (payloadStatus === 'warn' || payloadStatus === 'warning') return 'warn';
  if (payloadStatus === 'fail' || payloadStatus === 'error' || payloadStatus === 'failed')
    return 'fail';

  const normalizedType = eventType.toLowerCase();
  if (/(fail|error|uncited|missing)/.test(normalizedType)) return 'fail';
  if (/(warn|degrad|fallback|partial)/.test(normalizedType)) return 'warn';
  return 'pass';
}

function payloadDetail(payload: Record<string, unknown>): string {
  const detail = payload.detail ?? payload.message ?? payload.summary ?? payload.reason;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  const compact = JSON.stringify(payload);
  return compact && compact !== '{}' ? compact : 'event payload recorded';
}

function formatUtcTime(input: string): string {
  const ms = Date.parse(input);
  if (!Number.isFinite(ms)) return input;
  return new Date(ms).toISOString().slice(11);
}

function toTraceEventFromRow(event: PublicEventRow): TraceEvent {
  return {
    timestamp: formatUtcTime(event.created_at),
    name: event.event_type,
    detail: payloadDetail(event.event_payload || {}),
    status: deriveStatus(event.event_type, event.event_payload || {}),
  };
}

function toTraceEventFromFrame(frame: ReplayFrame): TraceEvent {
  return {
    timestamp: formatUtcTime(frame.timestamp),
    name: frame.event_type,
    detail: payloadDetail(frame.event_payload || {}),
    status: deriveStatus(frame.event_type, frame.event_payload || {}),
  };
}

function durationFromRows(events: PublicEventRow[]): number {
  if (events.length < 2) return 0;
  const first = Date.parse(events[0].created_at);
  const last = Date.parse(events[events.length - 1].created_at);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
  return Math.max(0, last - first);
}

function statusGlyph(status: TraceStatus): string {
  if (status === 'pass') return '✓';
  if (status === 'warn') return '⚠';
  return '✗';
}

function statusClass(status: TraceStatus): string {
  if (status === 'pass') return 'text-emerald-300';
  if (status === 'warn') return 'text-amber-300';
  return 'text-red-300';
}

export const AuditTraceStream: React.FC = () => {
  const [trace, setTrace] = useState<AuditTraceSession>(TRACE_SESSION);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number>(TRACE_SESSION.executionTimeMs);
  const [scrubMs, setScrubMs] = useState<number>(TRACE_SESSION.executionTimeMs);
  const [loading, setLoading] = useState<boolean>(true);
  const [scrubbing, setScrubbing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const replayAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    const loadLatest = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const latestRes = await fetch(`${API_URL}/api/public/audit/session/latest`);
        const latest = (await latestRes.json().catch(() => null)) as LatestSessionResponse | null;

        if (!latestRes.ok || !latest?.ok || !latest.session) {
          if (active) {
            setLoadError(latest?.message || latest?.code || 'Live trace unavailable');
          }
          return;
        }

        const events = Array.isArray(latest.events) ? latest.events : [];
        const computedDuration = Math.max(
          0,
          latest.session.execution_time_ms || 0,
          durationFromRows(events)
        );

        const vector = vectorFromUnknown(
          latest.session.final_score_vector,
          TRACE_SESSION.finalScoreVector
        );

        if (!active) return;

        setTrace({
          sessionId: latest.session.id,
          executionId: latest.session.id,
          targetUrl: latest.session.target_url || TRACE_SESSION.targetUrl,
          executionTimeMs: computedDuration,
          finalScoreVector: vector,
          events: events.length > 0 ? events.map(toTraceEventFromRow) : TRACE_SESSION.events,
        });

        setDurationMs(computedDuration);
        setScrubMs(computedDuration);
        setSessionId(latest.session.id);
      } catch {
        if (active) {
          setLoadError('Live trace unavailable');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadLatest();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      debounceRef.current = window.setTimeout(async () => {
        replayAbortRef.current?.abort();
        const controller = new AbortController();
        replayAbortRef.current = controller;

        setScrubbing(true);
        try {
          const replayRes = await fetch(
            `${API_URL}/api/public/audit/session/${encodeURIComponent(sessionId)}/replay?at_ms=${Math.floor(scrubMs)}&window_ms=${REPLAY_WINDOW_MS}`,
            { signal: controller.signal }
          );
          const replayJson = (await replayRes.json().catch(() => null)) as ReplayResponse | null;

          if (!replayRes.ok || !replayJson?.ok || !replayJson.replay) {
            return;
          }

          const replay = replayJson.replay;
          const vector = vectorFromUnknown(
            replay.session.final_score_vector,
            TRACE_SESSION.finalScoreVector
          );

          setDurationMs(Math.max(0, replay.duration_ms));
          setTrace((prev) => ({
            ...prev,
            sessionId: replay.session.id,
            executionId: replay.session.id,
            targetUrl: replay.session.target_url || prev.targetUrl,
            executionTimeMs: Math.max(0, replay.session.execution_time_ms || replay.duration_ms),
            finalScoreVector: vector,
            events: replay.frames.map(toTraceEventFromFrame),
          }));
        } catch {
          // Keep prior frames rendered if replay polling fails.
        } finally {
          setScrubbing(false);
        }
      }, SCRUB_DEBOUNCE_MS);
    });

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [scrubMs, sessionId]);

  useEffect(() => {
    return () => {
      replayAbortRef.current?.abort();
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const scrubLabel = useMemo(() => {
    const seconds = scrubMs / 1000;
    return `${seconds.toFixed(2)}s`;
  }, [scrubMs]);

  return (
    <div className="w-full max-w-2xl mx-auto text-left">
      <header className="mb-5 pb-4 border-b border-white/10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
          Audit trace stream
        </h1>
        <p className="text-sm text-white/60">
          Immutable execution log. Each event is timestamped, bound to an execution ID, and rendered
          as recorded system output.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-xs font-mono">
        <div className="border border-white/10 rounded-md px-3 py-2 bg-white/[0.02]">
          <span className="text-white/40">session_id</span>
          <p className="text-cyan-300 break-all">{trace.sessionId}</p>
        </div>
        <div className="border border-white/10 rounded-md px-3 py-2 bg-white/[0.02]">
          <span className="text-white/40">execution_id</span>
          <p className="text-cyan-300 break-all">{trace.executionId}</p>
        </div>
        <div className="border border-white/10 rounded-md px-3 py-2 bg-white/[0.02] sm:col-span-2">
          <span className="text-white/40">target_url</span>
          <p className="text-white/80 break-all">{trace.targetUrl}</p>
        </div>
      </div>

      <div className="mb-5 border border-white/10 rounded-lg bg-black/20 px-4 py-3">
        <div className="flex items-center justify-between text-xs font-mono text-white/60 mb-2">
          <span>replay_cursor_ms={Math.floor(scrubMs)}</span>
          <span>{scrubLabel}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, durationMs)}
          step={50}
          value={Math.min(scrubMs, Math.max(1, durationMs))}
          onChange={(event) => setScrubMs(Number(event.target.value))}
          className="w-full accent-cyan-300"
          aria-label="Trace replay time cursor"
        />
        <p className="text-[11px] text-white/45 mt-2 font-mono">
          window_ms={REPLAY_WINDOW_MS} ·{' '}
          {loading
            ? 'loading latest session...'
            : scrubbing
              ? 'syncing replay...'
              : 'replay synced'}
          {loadError ? ` · ${loadError}` : ''}
        </p>
      </div>

      <div className="border border-white/10 rounded-lg bg-black/20 overflow-hidden mb-5">
        <div className="px-4 py-2 border-b border-white/10 text-xs font-mono text-white/50">
          event_stream[]
        </div>
        <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-2 font-mono text-xs">
          {trace.events.map((event) => (
            <div
              key={`${event.timestamp}:${event.name}`}
              className="grid grid-cols-[96px_1fr] gap-3"
            >
              <span className="text-white/40">{event.timestamp}</span>
              <div>
                <p className={statusClass(event.status)}>
                  {statusGlyph(event.status)} {event.name}
                </p>
                <p className="text-white/50 pl-4">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 text-xs sm:text-sm">
        <p className="text-white/75">
          Final score vector: comprehension=
          {trace.finalScoreVector.comprehension.toFixed(2)}, verification=
          {trace.finalScoreVector.verificationConfidence.toFixed(2)}, citation=
          {trace.finalScoreVector.citationConfidence.toFixed(2)}
        </p>
        <p className="text-white/45 mt-1">
          execution_time_ms={trace.executionTimeMs} · deterministic replay required for the same
          input.
        </p>
      </div>
    </div>
  );
};

// Backward-compat export while Landing is migrated.
export const LiveAuditNarrative = AuditTraceStream;
