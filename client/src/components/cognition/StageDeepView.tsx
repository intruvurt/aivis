/**
 * StageDeepView — Contextual evidence panel for the active scan stage.
 *
 * Switches its content based on the selected stage, showing
 * the most relevant data from AnalysisResponse for that step.
 * Lives in the fl-deepview slot below the graph on desktop.
 *
 * Each sub-panel reads directly from AnalysisResponse — no derived
 * state, no AI interpretation. Evidence-bound output only.
 */

import React from 'react';
import type { AnalysisResponse, RagPipelineSourceCandidate, ScanEvent } from '@shared/types';
import type { ScanStage } from './ScanStageTimeline';

type TimelineEvent = {
  id: string;
  seq: number;
  timestamp: number;
  event: ScanEvent;
};

// ── Shared row primitive ──────────────────────────────────────────────────────

function Row({
  k,
  v,
  status,
}: {
  k: string;
  v: React.ReactNode;
  status?: 'pass' | 'warn' | 'fail';
}) {
  const valClass = status ? `fl-deepview__val fl-deepview__val--${status}` : 'fl-deepview__val';
  return (
    <div className="fl-deepview__row">
      <span className="fl-deepview__key">{k}</span>
      <span className={valClass}>{v ?? '–'}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="fl-deepview__section-label">{children}</div>;
}

function decisionBadgeClass(decision: string): string {
  if (decision === 'accept') return 'fl-deepview__badge fl-deepview__badge--accept';
  if (decision === 'partial') return 'fl-deepview__badge fl-deepview__badge--partial';
  return 'fl-deepview__badge fl-deepview__badge--reject';
}

function summarizeRejectionReasons(
  candidates: RagPipelineSourceCandidate[]
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.final_decision !== 'reject') continue;
    for (const flag of candidate.reason_flags ?? []) {
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

function formatTimelineLabel(entry: TimelineEvent): string {
  if (entry.event.type === 'PIPELINE_STAGE') {
    const progress =
      typeof entry.event.progress === 'number'
        ? ` · ${Math.round(entry.event.progress * 100)}%`
        : '';
    return `${entry.event.stage.replace(/_/g, ' ')}${progress}`;
  }
  if (entry.event.type === 'ERROR') {
    return `${entry.event.stage}: ${entry.event.message}`;
  }
  if (entry.event.type === 'SCAN_COMPLETED') {
    return `complete · score ${entry.event.summary.score}`;
  }
  return entry.event.type.toLowerCase().replace(/_/g, ' ');
}

// ── Per-stage sub-panels ──────────────────────────────────────────────────────

function ResolvePanel({ result }: { result: AnalysisResponse | null }) {
  if (!result) return <Row k="status" v="resolving domain…" />;
  const di = result.domain_intelligence;
  const ts = result.technical_signals;
  return (
    <>
      <SectionLabel>domain resolution</SectionLabel>
      <Row k="url" v={result.url} />
      <Row
        k="https"
        v={ts?.https_enabled ? 'enabled' : 'missing'}
        status={ts?.https_enabled ? 'pass' : 'fail'}
      />
      <Row
        k="status"
        v={ts?.status_code ?? '–'}
        status={ts?.status_code === 200 ? 'pass' : ts?.status_code ? 'warn' : undefined}
      />
      {di?.language && <Row k="lang" v={di.language} />}
      {di?.entity_clarity_score != null && (
        <Row
          k="entity clarity"
          v={`${di.entity_clarity_score}/100`}
          status={
            di.entity_clarity_score >= 60 ? 'pass' : di.entity_clarity_score >= 35 ? 'warn' : 'fail'
          }
        />
      )}
    </>
  );
}

function FetchPanel({ result }: { result: AnalysisResponse | null }) {
  if (!result) return <Row k="status" v="fetching page…" />;
  const ts = result.technical_signals;
  const si = result.scrape_info;
  return (
    <>
      <SectionLabel>page fetch</SectionLabel>
      {ts?.response_time_ms != null && (
        <Row
          k="response time"
          v={`${ts.response_time_ms}ms`}
          status={
            ts.response_time_ms < 2000 ? 'pass' : ts.response_time_ms < 5000 ? 'warn' : 'fail'
          }
        />
      )}
      {ts?.content_length != null && (
        <Row k="content size" v={`${Math.round(ts.content_length / 1024)}kb`} />
      )}
      {si?.method && <Row k="scrape method" v={si.method} />}
      {result.thin_content_warning && <Row k="warning" v="thin content detected" status="warn" />}
      {result.scrape_warning && (
        <Row k="scrape" v={result.scrape_warning.slice(0, 60)} status="warn" />
      )}
    </>
  );
}

function ExtractPanel({ result }: { result: AnalysisResponse | null }) {
  if (!result) return <Row k="status" v="extracting signals…" />;
  const entities = result.brand_entities ?? [];
  const keywords = (result.topical_keywords ?? []).slice(0, 5);
  const ca = result.content_analysis as Record<string, unknown> | undefined;
  const wordCount = (ca?.word_count ?? ca?.wordCount) as number | undefined;
  return (
    <>
      <SectionLabel>extraction</SectionLabel>
      <Row
        k="brand entities"
        v={entities.length > 0 ? entities.slice(0, 4).join(', ') : 'none detected'}
        status={entities.length > 0 ? 'pass' : 'warn'}
      />
      <Row k="keywords" v={keywords.length > 0 ? keywords.join(', ') : 'none'} />
      {wordCount != null && (
        <Row k="word count" v={wordCount} status={wordCount >= 300 ? 'pass' : 'warn'} />
      )}
    </>
  );
}

function SchemaPanel({ result }: { result: AnalysisResponse | null }) {
  if (!result) return <Row k="status" v="validating schema…" />;
  const sm = result.schema_markup;
  const rubricGates = result.strict_rubric?.gates ?? [];
  const schemaGates = rubricGates.filter((g) => /schema|json.?ld|org/i.test(g.id));
  return (
    <>
      <SectionLabel>schema & structured data</SectionLabel>
      {sm && (
        <>
          <Row
            k="json-ld blocks"
            v={sm.json_ld_count}
            status={sm.json_ld_count > 0 ? 'pass' : 'fail'}
          />
          <Row
            k="org schema"
            v={sm.has_organization_schema ? 'present' : 'missing'}
            status={sm.has_organization_schema ? 'pass' : 'fail'}
          />
          <Row
            k="faq schema"
            v={sm.has_faq_schema ? 'present' : 'missing'}
            status={sm.has_faq_schema ? 'pass' : undefined}
          />
          {sm.schema_types.length > 0 && (
            <Row k="types" v={sm.schema_types.slice(0, 4).join(', ')} />
          )}
          {(sm.validation_errors ?? []).length > 0 && (
            <Row k="errors" v={sm.validation_errors!.length} status="fail" />
          )}
        </>
      )}
      {schemaGates.map((g) => (
        <Row
          key={g.id}
          k={g.label}
          v={`${g.score_0_100}`}
          status={g.status === 'pass' ? 'pass' : g.status === 'warn' ? 'warn' : 'fail'}
        />
      ))}
    </>
  );
}

function TrustPanel({ result }: { result: AnalysisResponse | null }) {
  if (!result) return <Row k="status" v="evaluating trust signals…" />;
  const ts = result.technical_signals;
  const di = result.domain_intelligence;
  const rubricGates = result.strict_rubric?.gates ?? [];
  const trustGates = rubricGates.filter((g) => /trust|author|https|security|crawl/i.test(g.id));
  const trustSources = result.rag_pipeline?.trust_sources;
  const sourceCandidates = result.rag_pipeline?.source_candidates ?? [];
  const rejectionReasons = summarizeRejectionReasons(sourceCandidates);
  const visibleCandidates = [...sourceCandidates]
    .sort((left, right) => left.rank - right.rank)
    .slice(0, 6);
  return (
    <>
      <SectionLabel>trust & access</SectionLabel>
      <Row
        k="https"
        v={ts?.https_enabled ? 'enabled' : 'missing'}
        status={ts?.https_enabled ? 'pass' : 'fail'}
      />
      <Row
        k="mobile"
        v={ts?.mobile_friendly ? 'ready' : 'not detected'}
        status={ts?.mobile_friendly ? 'pass' : 'warn'}
      />
      {di?.citation_domains && di.citation_domains.length > 0 && (
        <Row k="citation domains" v={di.citation_domains.length} status="pass" />
      )}
      {trustGates.slice(0, 3).map((g) => (
        <Row
          key={g.id}
          k={g.label}
          v={`${g.score_0_100}`}
          status={g.status === 'pass' ? 'pass' : g.status === 'warn' ? 'warn' : 'fail'}
        />
      ))}
      {trustSources && (
        <>
          <SectionLabel>source trust summary</SectionLabel>
          <div className="fl-deepview__stat-grid">
            <div className="fl-deepview__stat-card">
              <span className="fl-deepview__stat-label">accepted</span>
              <span className="fl-deepview__stat-value fl-deepview__stat-value--accept">
                {trustSources.summary.accepted}
              </span>
            </div>
            <div className="fl-deepview__stat-card">
              <span className="fl-deepview__stat-label">partial</span>
              <span className="fl-deepview__stat-value fl-deepview__stat-value--partial">
                {trustSources.summary.partial}
              </span>
            </div>
            <div className="fl-deepview__stat-card">
              <span className="fl-deepview__stat-label">rejected</span>
              <span className="fl-deepview__stat-value fl-deepview__stat-value--reject">
                {trustSources.summary.rejected}
              </span>
            </div>
          </div>
        </>
      )}
      {rejectionReasons.length > 0 && (
        <>
          <SectionLabel>top rejection reasons</SectionLabel>
          <div className="fl-deepview__tag-list">
            {rejectionReasons.map(([reason, count]) => (
              <span key={reason} className="fl-deepview__tag fl-deepview__tag--reject">
                {reason.replace(/_/g, ' ')} · {count}
              </span>
            ))}
          </div>
        </>
      )}
      {visibleCandidates.length > 0 && (
        <>
          <SectionLabel>candidate decisions</SectionLabel>
          <div className="fl-deepview__candidate-list">
            {visibleCandidates.map((candidate) => (
              <div key={candidate.url} className="fl-deepview__candidate-card">
                <div className="fl-deepview__candidate-head">
                  <span className={decisionBadgeClass(candidate.final_decision)}>
                    {candidate.final_decision}
                  </span>
                  <span className="fl-deepview__candidate-rank">#{candidate.rank}</span>
                </div>
                <div
                  className="fl-deepview__candidate-title"
                  title={candidate.title || candidate.url}
                >
                  {candidate.title || candidate.url}
                </div>
                <div className="fl-deepview__candidate-meta">
                  <span>{Math.round(candidate.trust_score)}/100</span>
                  {candidate.format_used ? <span>{candidate.format_used}</span> : null}
                </div>
                {candidate.reason_flags.length > 0 && (
                  <div className="fl-deepview__tag-list">
                    {candidate.reason_flags.slice(0, 4).map((flag) => (
                      <span key={`${candidate.url}-${flag}`} className="fl-deepview__tag">
                        {flag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TimelinePanel({
  timelineEvents,
  timelineScanId,
  scanning,
}: {
  timelineEvents: TimelineEvent[];
  timelineScanId?: string | null;
  scanning: boolean;
}) {
  if (!timelineScanId && timelineEvents.length === 0) return null;

  return (
    <>
      <SectionLabel>server timeline</SectionLabel>
      {timelineScanId ? <Row k="scan id" v={timelineScanId} /> : null}
      {timelineEvents.length === 0 ? (
        <Row k="status" v={scanning ? 'waiting for timeline events…' : 'no timeline events'} />
      ) : (
        <div className="fl-deepview__timeline-list">
          {timelineEvents
            .slice(-5)
            .reverse()
            .map((entry) => (
              <div key={entry.id} className="fl-deepview__timeline-row">
                <span className="fl-deepview__timeline-seq">#{entry.seq}</span>
                <span className="fl-deepview__timeline-label">{formatTimelineLabel(entry)}</span>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

function ConflictPanel({
  result,
  graphConflicts,
}: {
  result: AnalysisResponse | null;
  graphConflicts: Array<{ id: string }>;
}) {
  const cr = result?.contradiction_report;
  const contradictions = (cr as Record<string, unknown> | undefined)?.contradictions as
    | Array<{ label?: string; description?: string }>
    | undefined;
  const total = (contradictions?.length ?? 0) + graphConflicts.length;

  if (total === 0) {
    return (
      <>
        <SectionLabel>conflicts</SectionLabel>
        <Row k="status" v="no conflicts detected" status="pass" />
      </>
    );
  }

  return (
    <>
      <SectionLabel>conflicts ({total})</SectionLabel>
      {(contradictions ?? []).slice(0, 4).map((c, i) => (
        <Row
          key={`contra-${i}`}
          k={`conflict ${i + 1}`}
          v={c.label ?? c.description ?? 'unknown'}
          status="fail"
        />
      ))}
      {graphConflicts.slice(0, 4).map((c, i) => (
        <Row key={`graph-${i}`} k={`graph conflict`} v={c.id} status="fail" />
      ))}
    </>
  );
}

function ScorePanel({ result }: { result: AnalysisResponse | null }) {
  if (!result) return <Row k="status" v="computing score…" />;

  const score = result.visibility_score;
  const scoreColor =
    score >= 65 ? 'var(--fl-truth)' : score >= 40 ? 'var(--fl-warning)' : 'var(--fl-conflict)';
  const scoreStatus: 'pass' | 'warn' | 'fail' =
    score >= 65 ? 'pass' : score >= 40 ? 'warn' : 'fail';

  const rubric = result.strict_rubric;
  const cats = result.category_grades ?? [];

  return (
    <>
      <SectionLabel>score verdict</SectionLabel>
      <div className="fl-verdict-ring">
        <div
          className="fl-verdict-ring__circle"
          style={{ color: scoreColor }}
          aria-label={`Visibility score: ${score}`}
        >
          {score}
        </div>
        <div className="fl-verdict-ring__meta">
          <Row k="score" v={score} status={scoreStatus} />
          {rubric?.reliability_index_0_100 != null && (
            <Row k="reliability" v={`${rubric.reliability_index_0_100}%`} />
          )}
          {result.analysis_integrity?.execution_class && (
            <Row k="mode" v={result.analysis_integrity.execution_class} />
          )}
        </div>
      </div>
      {cats.slice(0, 3).map((g) => (
        <Row
          key={g.label}
          k={g.label.toLowerCase()}
          v={`${g.score} — ${g.grade}`}
          status={g.grade === 'A' || g.grade === 'B' ? 'pass' : g.grade === 'C' ? 'warn' : 'fail'}
        />
      ))}
    </>
  );
}

function StrategicReplayPanel({
  result,
  replayCursorSeq,
  replayMaxSeq,
}: {
  result: AnalysisResponse | null;
  replayCursorSeq: number;
  replayMaxSeq: number;
}) {
  const strategic = result?.strategic_breakdown;
  if (!strategic) return null;
  const masterSystem = strategic.master_system;

  const max = Math.max(1, replayMaxSeq || 1);
  const clampedSeq = Math.max(0, Math.min(replayCursorSeq, max));
  const progress = clampedSeq / max;
  const progressPct = Math.round(progress * 100);

  const stageThresholds: Record<string, number> = {
    detect: 0.12,
    resolve: 0.3,
    act: 0.52,
    verify: 0.74,
    monitor: 0.9,
  };

  const activeStage =
    strategic.operating_model.find((s) => progress < (stageThresholds[s.stage] ?? 1))?.stage ??
    'monitor';

  return (
    <>
      <SectionLabel>strategic replay model</SectionLabel>
      <Row
        k="citation state"
        v={strategic.citation_state.overall}
        status={
          strategic.citation_state.overall === 'citable'
            ? 'pass'
            : strategic.citation_state.overall === 'emerging'
              ? 'warn'
              : 'fail'
        }
      />
      <Row k="replay progress" v={`${progressPct}% · seq ${clampedSeq}/${max}`} />
      <Row k="active stage" v={activeStage} />

      {masterSystem && (
        <>
          <SectionLabel>master system</SectionLabel>
          <Row k="version" v={`v${masterSystem.version}`} />
          <Row
            k="source policy"
            v={`${masterSystem.source_policy.active_sources}/${masterSystem.source_policy.minimum_sources_required}`}
            status={masterSystem.source_policy.requirement_met ? 'pass' : 'fail'}
          />
          <Row
            k="policy state"
            v={masterSystem.source_policy.requirement_met ? 'met' : 'unmet'}
            status={masterSystem.source_policy.requirement_met ? 'pass' : 'fail'}
          />

          <SectionLabel>weighted modules</SectionLabel>
          {masterSystem.module_scores.map((module) => (
            <Row
              key={module.key}
              k={`${module.label} (${module.weight}%)`}
              v={`${module.score} · ${module.status}`}
              status={
                module.status === 'healthy' ? 'pass' : module.status === 'watch' ? 'warn' : 'fail'
              }
            />
          ))}
        </>
      )}

      <div className="fl-deepview__timeline-list">
        {strategic.operating_model.map((s) => {
          const threshold = stageThresholds[s.stage] ?? 1;
          const reached = progress >= threshold;
          const stageState: 'pass' | 'warn' | 'fail' = reached
            ? s.status === 'healthy'
              ? 'pass'
              : s.status === 'watch'
                ? 'warn'
                : 'fail'
            : s.stage === activeStage
              ? 'warn'
              : 'fail';

          const statusLabel = reached
            ? s.status
            : s.stage === activeStage
              ? 'in-progress'
              : 'pending';

          return (
            <div key={s.stage} className="fl-deepview__timeline-row">
              <span className="fl-deepview__timeline-seq">{s.stage}</span>
              <span className={`fl-deepview__val fl-deepview__val--${stageState}`}>
                {statusLabel} · {s.rationale}
              </span>
            </div>
          );
        })}
      </div>

      {strategic.corrective_action_paths.length > 0 && (
        <>
          <SectionLabel>top action paths</SectionLabel>
          {strategic.corrective_action_paths.slice(0, 3).map((path, idx) => (
            <Row
              key={`${path.title}-${idx}`}
              k={`${idx + 1}. ${path.priority}`}
              v={`${path.title} (+${path.expected_citation_lift})`}
              status={
                path.priority === 'high' ? 'fail' : path.priority === 'medium' ? 'warn' : 'pass'
              }
            />
          ))}
        </>
      )}
    </>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export interface StageDeepViewProps {
  stage: ScanStage;
  result: AnalysisResponse | null;
  /** Conflicts from graph engine (CognitionReplay projected state) */
  graphConflicts: Array<{ id: string }>;
  timelineScanId?: string | null;
  timelineEvents: TimelineEvent[];
  scanStep: string;
  scanning: boolean;
  replayCursorSeq: number;
  replayMaxSeq: number;
}

export default function StageDeepView({
  stage,
  result,
  graphConflicts,
  timelineScanId,
  timelineEvents,
  scanning,
  replayCursorSeq,
  replayMaxSeq,
}: StageDeepViewProps) {
  return (
    <div className="fl-deepview" aria-label={`Stage details: ${stage}`}>
      {stage === 'resolve' && <ResolvePanel result={result} />}
      {stage === 'fetch' && <FetchPanel result={result} />}
      {stage === 'extract' && <ExtractPanel result={result} />}
      {stage === 'schema' && <SchemaPanel result={result} />}
      {stage === 'trust' && <TrustPanel result={result} />}
      {stage === 'conflict' && <ConflictPanel result={result} graphConflicts={graphConflicts} />}
      {stage === 'score' && <ScorePanel result={result} />}
      <TimelinePanel
        timelineEvents={timelineEvents}
        timelineScanId={timelineScanId}
        scanning={scanning}
      />
      <StrategicReplayPanel
        result={result}
        replayCursorSeq={replayCursorSeq}
        replayMaxSeq={replayMaxSeq}
      />
    </div>
  );
}
