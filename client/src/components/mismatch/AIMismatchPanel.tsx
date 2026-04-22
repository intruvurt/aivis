import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { EvidenceLedgerEntry } from '../../../../shared/types';

export type MismatchStatus = 'correct' | 'missing' | 'distorted' | 'weak';

export interface SourceChunk {
  id: string;
  heading: string;
  text: string;
  detectedEntities: string[];
}

export interface AIChunk {
  id: string;
  interpretedText: string;
  confidenceScore: number;
  inferredMeaning: string;
  entities: string[];
}

export interface MismatchEntity {
  name: string;
  sourceMentions: string[];
  aiMentions: string[];
  status: MismatchStatus;
  similarity: number;
  impactScore: number;
  confidence: number;
  evidenceLinks: string[];
}

export interface MismatchTimelineStage {
  key: string;
  label: string;
  timestampLabel: string;
}

export interface MismatchData {
  url: string;
  scannedAt: string;
  mismatchScore: number;
  sourceChunks: SourceChunk[];
  aiChunks: AIChunk[];
  entities: MismatchEntity[];
  timeline: MismatchTimelineStage[];
  ledgerEntries?: EvidenceLedgerEntry[];
}

interface AIMismatchPanelProps {
  data: MismatchData;
}

const STATUS_STYLES: Record<
  MismatchStatus,
  { label: string; chip: string; line: string; icon: string }
> = {
  correct: {
    label: 'Correct',
    chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    line: 'bg-emerald-400/70',
    icon: '✔',
  },
  weak: {
    label: 'Weak',
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    line: 'bg-amber-300/50',
    icon: '!',
  },
  missing: {
    label: 'Missing',
    chip: 'border-red-400/35 bg-red-400/10 text-red-300',
    line: 'bg-red-400/70',
    icon: '✖',
  },
  distorted: {
    label: 'Distorted',
    chip: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
    line: 'bg-violet-400/70',
    icon: '~',
  },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.valueOf())) return ts;
  return d.toLocaleString();
}

function statusCount(entities: MismatchEntity[], status: MismatchStatus): number {
  return entities.filter((entity) => entity.status === status).length;
}

function impactWidthClass(impactScore: number): string {
  if (impactScore >= 80) return 'w-full';
  if (impactScore >= 60) return 'w-4/5';
  if (impactScore >= 40) return 'w-3/5';
  if (impactScore >= 20) return 'w-2/5';
  return 'w-1/5';
}

export function AIMismatchPanel({ data }: AIMismatchPanelProps) {
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [lockedEntity, setLockedEntity] = useState<string | null>(null);
  const [timelineIndex, setTimelineIndex] = useState(data.timeline.length - 1);

  useEffect(() => {
    setTimelineIndex(data.timeline.length - 1);
  }, [data.timeline.length]);

  const activeEntityName = lockedEntity ?? hoveredEntity;

  const activeEntity = useMemo(
    () => data.entities.find((entity) => entity.name === activeEntityName) ?? null,
    [activeEntityName, data.entities]
  );

  const summary = useMemo(
    () => ({
      correct: statusCount(data.entities, 'correct'),
      weak: statusCount(data.entities, 'weak'),
      missing: statusCount(data.entities, 'missing'),
      distorted: statusCount(data.entities, 'distorted'),
    }),
    [data.entities]
  );

  const totalEntities = Math.max(data.entities.length, 1);

  return (
    <section className="py-20 bg-[#05070d] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-200 text-xs font-semibold uppercase tracking-widest mb-4">
            Machine interpretation debugger
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">AI Mismatch Surface</h2>
          <p className="text-white/55 text-base max-w-2xl mx-auto">
            Left is source truth, right is AI interpretation, center is distortion. Hover an entity
            to trace where meaning diverges.
          </p>
        </div>

        <MismatchHeader data={data} />

        <MismatchSummaryBar
          summary={summary}
          totalEntities={totalEntities}
          mismatchScore={data.mismatchScore}
        />

        <MismatchSplitView
          data={data}
          activeEntityName={activeEntityName}
          onHover={setHoveredEntity}
          onLock={setLockedEntity}
        />

        <MismatchTimeline
          stages={data.timeline}
          timelineIndex={timelineIndex}
          onReplay={() => {
            if (data.timeline.length < 2) return;
            let idx = 0;
            setTimelineIndex(0);
            const interval = window.setInterval(() => {
              idx += 1;
              setTimelineIndex((current) => {
                if (idx >= data.timeline.length - 1) {
                  window.clearInterval(interval);
                }
                return Math.min(data.timeline.length - 1, current + 1);
              });
            }, 380);
          }}
          onScrub={(next) => setTimelineIndex(next)}
        />

        {activeEntity && (
          <EntityDetailDrawer
            entity={activeEntity}
            onClose={() => setLockedEntity(null)}
            ledgerEntries={(data.ledgerEntries || []).filter(
              (entry) =>
                entry.entityName === activeEntity.name || entry.entityId === activeEntity.name
            )}
            sourceChunk={
              data.sourceChunks.find((chunk) =>
                chunk.detectedEntities.includes(activeEntity.name)
              ) ?? null
            }
            aiChunk={
              data.aiChunks.find((chunk) => chunk.entities.includes(activeEntity.name)) ?? null
            }
          />
        )}
      </div>
    </section>
  );
}

function MismatchHeader({ data }: { data: MismatchData }) {
  return (
    <div className="sticky top-3 z-20 rounded-2xl border border-white/12 bg-[#0b1020]/90 backdrop-blur p-4 sm:p-5 mb-5">
      <div className="grid gap-3 sm:grid-cols-3 text-left">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/35">URL scanned</p>
          <p className="text-xs sm:text-sm text-white/80 break-all">{data.url}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/35">Scan timestamp</p>
          <p className="text-xs sm:text-sm text-white/80">{formatTimestamp(data.scannedAt)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/35">Mismatch score</p>
          <p className="text-lg font-black text-red-300 tabular-nums">{data.mismatchScore}/100</p>
        </div>
      </div>
    </div>
  );
}

function MismatchSummaryBar({
  summary,
  totalEntities,
  mismatchScore,
}: {
  summary: { correct: number; weak: number; missing: number; distorted: number };
  totalEntities: number;
  mismatchScore: number;
}) {
  const segments: Array<{ key: MismatchStatus; value: number; color: string; label: string }> = [
    { key: 'correct', value: summary.correct, color: 'bg-emerald-400', label: 'Correct' },
    { key: 'weak', value: summary.weak, color: 'bg-amber-400', label: 'Weak' },
    { key: 'missing', value: summary.missing, color: 'bg-red-400', label: 'Missing' },
    { key: 'distorted', value: summary.distorted, color: 'bg-violet-400', label: 'Distorted' },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1022] p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-white/40">Interpretation status</p>
        <p className="text-xs text-white/45">Higher mismatch score means larger meaning loss</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
            title={`${segment.label}: ${segment.value}`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${segment.color}`} />
              <p className="text-[10px] uppercase tracking-wider text-white/45">{segment.label}</p>
            </div>
            <p className="mt-1 text-sm font-bold text-white">{segment.value}</p>
            <p className="text-[10px] text-white/40">
              {Math.round((segment.value / totalEntities) * 100)}% of entities
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
          >
            <p className="text-[10px] uppercase tracking-wider text-white/45">{segment.label}</p>
            <p className="text-sm font-bold text-white">{segment.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-white/45">Overall mismatch score: {mismatchScore}/100</div>
    </div>
  );
}

function MismatchSplitView({
  data,
  activeEntityName,
  onHover,
  onLock,
}: {
  data: MismatchData;
  activeEntityName: string | null;
  onHover: (entity: string | null) => void;
  onLock: (entity: string | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#070d1b] p-4 sm:p-5 mb-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_260px_1fr]">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-cyan-200/75 mb-3">Reality</p>
          <SourcePanel chunks={data.sourceChunks} activeEntityName={activeEntityName} />
        </div>

        <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-violet-200/75 mb-3">
            Distortion layer
          </p>
          <MismatchOverlay
            entities={data.entities}
            activeEntityName={activeEntityName}
            onHover={onHover}
            onLock={onLock}
          />
        </div>

        <div className="rounded-xl border border-amber-300/20 bg-amber-500/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-200/75 mb-3">
            AI interpretation
          </p>
          <AIInterpretationPanel chunks={data.aiChunks} activeEntityName={activeEntityName} />
        </div>
      </div>
    </div>
  );
}

function SourcePanel({
  chunks,
  activeEntityName,
}: {
  chunks: SourceChunk[];
  activeEntityName: string | null;
}) {
  return (
    <div className="space-y-3">
      {chunks.map((chunk) => {
        const isHighlighted = activeEntityName
          ? chunk.detectedEntities.includes(activeEntityName)
          : false;
        return (
          <div
            key={chunk.id}
            className={`rounded-lg border p-3 transition-colors ${
              isHighlighted
                ? 'border-cyan-300/50 bg-cyan-300/10'
                : 'border-white/10 bg-[#0b1327]/75'
            }`}
          >
            <p className="text-[10px] uppercase tracking-wider text-cyan-200/70 mb-1">
              {chunk.heading}
            </p>
            <p className="text-xs text-white/75 leading-relaxed">{chunk.text}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chunk.detectedEntities.map((entity) => (
                <span
                  key={entity}
                  className="px-1.5 py-0.5 rounded border border-white/10 text-[10px] text-white/60"
                >
                  {entity}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AIInterpretationPanel({
  chunks,
  activeEntityName,
}: {
  chunks: AIChunk[];
  activeEntityName: string | null;
}) {
  return (
    <div className="space-y-3">
      {chunks.map((chunk) => {
        const isHighlighted = activeEntityName ? chunk.entities.includes(activeEntityName) : false;
        return (
          <div
            key={chunk.id}
            className={`rounded-lg border p-3 transition-colors ${
              isHighlighted
                ? 'border-amber-300/45 bg-amber-300/10'
                : 'border-white/10 bg-[#17132a]/65'
            }`}
          >
            <p className="text-xs text-white/75 leading-relaxed">{chunk.interpretedText}</p>
            <p className="text-[10px] text-white/50 mt-2">{chunk.inferredMeaning}</p>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {chunk.entities.map((entity) => (
                  <span
                    key={entity}
                    className="px-1.5 py-0.5 rounded border border-white/10 text-[10px] text-white/60"
                  >
                    {entity}
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-mono text-amber-200/75">
                conf {Math.round(chunk.confidenceScore * 100)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MismatchOverlay({
  entities,
  activeEntityName,
  onHover,
  onLock,
}: {
  entities: MismatchEntity[];
  activeEntityName: string | null;
  onHover: (entity: string | null) => void;
  onLock: (entity: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      {entities.map((entity) => (
        <EntityRow
          key={entity.name}
          entity={entity}
          isActive={entity.name === activeEntityName}
          onHover={onHover}
          onLock={onLock}
        />
      ))}
    </div>
  );
}

function EntityRow({
  entity,
  isActive,
  onHover,
  onLock,
}: {
  entity: MismatchEntity;
  isActive: boolean;
  onHover: (entity: string | null) => void;
  onLock: (entity: string | null) => void;
}) {
  const statusStyle = STATUS_STYLES[entity.status];

  return (
    <motion.button
      type="button"
      onMouseEnter={() => onHover(entity.name)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onLock(entity.name)}
      whileTap={{ scale: 0.995 }}
      className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
        isActive
          ? 'border-white/35 bg-white/10'
          : 'border-white/10 bg-[#0d1021]/65 hover:border-white/20'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-white truncate">{entity.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusStyle.chip}`}>
          {statusStyle.icon} {statusStyle.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
        <div className={`h-full ${statusStyle.line} ${impactWidthClass(entity.impactScore)}`} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-[10px] text-white/50">
        <span>src {entity.sourceMentions.length}</span>
        <span>ai {entity.aiMentions.length}</span>
        <span className="text-right">impact {entity.impactScore}</span>
      </div>
    </motion.button>
  );
}

function EntityDetailDrawer({
  entity,
  onClose,
  ledgerEntries,
  sourceChunk,
  aiChunk,
}: {
  entity: MismatchEntity;
  onClose: () => void;
  ledgerEntries: EvidenceLedgerEntry[];
  sourceChunk: SourceChunk | null;
  aiChunk: AIChunk | null;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-[#0b1224] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-white">Entity detail: {entity.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] uppercase tracking-widest text-white/45 hover:text-white/70"
        >
          clear lock
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-cyan-200/75 mb-2">
            Source excerpts
          </p>
          <p className="text-xs text-white/75">
            {sourceChunk?.text ?? 'No direct source excerpt captured.'}
          </p>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-200/75 mb-2">
            AI excerpts
          </p>
          <p className="text-xs text-white/75">
            {aiChunk?.interpretedText ?? 'No direct interpretation excerpt captured.'}
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-4 gap-2 mt-3">
        <DetailPill label="Similarity" value={`${Math.round(entity.similarity * 100)}%`} />
        <DetailPill label="Confidence" value={`${Math.round(entity.confidence * 100)}%`} />
        <DetailPill label="Impact" value={`${entity.impactScore}/100`} />
        <DetailPill label="Citation signals" value={String(entity.evidenceLinks.length)} />
      </div>
      <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
        <p className="text-[10px] uppercase tracking-widest text-violet-200/75 mb-1">
          Ledger-backed interpretation
        </p>
        {ledgerEntries.length === 0 ? (
          <p className="text-xs text-white/70">
            No projected ledger entries are attached to this entity yet.
          </p>
        ) : (
          <div className="space-y-2">
            {ledgerEntries.slice(0, 4).map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{entry.claimType}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                      entry.result.status === 'pass'
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                        : entry.result.status === 'partial'
                          ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                          : 'border-red-400/30 bg-red-400/10 text-red-200'
                    }`}
                  >
                    {entry.result.status}
                  </span>
                </div>
                <p className="mt-2 text-white/80">{entry.claim}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <DetailPill label="Confidence" value={`${Math.round(entry.confidence * 100)}%`} />
                  <DetailPill
                    label="Similarity"
                    value={
                      typeof entry.computation.similarityScore === 'number'
                        ? `${Math.round(entry.computation.similarityScore * 100)}%`
                        : 'n/a'
                    }
                  />
                  <DetailPill label="Impact" value={`${entry.result.impactScore}`} />
                </div>
                {entry.evidenceRefs.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {entry.evidenceRefs.slice(0, 2).map((ref) => (
                      <div
                        key={ref.id}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-white/45">
                          <span>{ref.type}</span>
                          <span>{ref.location}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-white/70">{ref.excerpt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function MismatchTimeline({
  stages,
  timelineIndex,
  onReplay,
  onScrub,
}: {
  stages: MismatchTimelineStage[];
  timelineIndex: number;
  onReplay: () => void;
  onScrub: (next: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1020] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs uppercase tracking-widest text-white/40">Mismatch timeline</p>
        <button
          type="button"
          onClick={onReplay}
          className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border border-white/20 text-white/70 hover:border-white/35"
        >
          Replay scan
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {stages.map((stage, index) => (
          <div
            key={stage.key}
            className={`rounded-lg border p-2 ${
              index <= timelineIndex
                ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
                : 'border-white/10 bg-white/[0.02] text-white/45'
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest">{stage.label}</p>
            <p className="text-[10px] mt-1 opacity-80">{stage.timestampLabel}</p>
          </div>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, stages.length - 1)}
        value={Math.min(timelineIndex, Math.max(0, stages.length - 1))}
        onChange={(event) => onScrub(Number(event.target.value))}
        className="w-full accent-cyan-400"
        aria-label="Scrub mismatch timeline"
      />
    </div>
  );
}
