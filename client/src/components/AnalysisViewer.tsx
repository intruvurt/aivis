/**
 * AnalysisViewer Component
 * Live projection of ingestion pipeline
 * Streams stages, entities, citations, scores as they emerge
 *
 * THIS IS THE NEW UI MODEL:
 * - Not a dashboard showing final results
 * - A state machine showing execution emergence
 * - Visual encoding of pipeline stages + partial data
 */

import React, { useEffect, useState } from 'react';
import useAnalysis from '../hooks/useAnalysis';
import { fetchCloudflareSignal } from '../services/cloudflareSignalsService';
import {
  ScanLine,
  EntityHighlight,
  ScoreMeter,
  CitationGraph,
  TimelineScrubber,
  StageIndicator,
} from './PipelineVisuals';

interface AnalysisViewerProps {
  /** Analysis run ID from database */
  runId: string;

  /** User's subscription tier (controls: snapshot only vs live stream) */
  userTier?: 'observer' | 'starter' | 'alignment' | 'signal';

  /** Show timeline replay controls (requires 'alignment' or higher) */
  showTimeline?: boolean;

  /** Auto-replay timeline when complete (pro feature) */
  autoReplay?: boolean;

  /** Optional target URL to pull Cloudflare traffic physics signals */
  targetUrl?: string;
}

export const AnalysisViewer: React.FC<AnalysisViewerProps> = ({
  runId,
  userTier = 'observer',
  showTimeline = false,
  autoReplay = false,
  targetUrl,
}) => {
  const {
    state,
    timeline,
    stages,
    entities,
    citations,
    scores,
    isAnalyzing,
    isComplete,
    isError,
    error,
  } = useAnalysis({
    runId,
    userTier,
    autoReplay,
    onError: (err) => console.error('[Analysis]', err),
  });

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [cloudflareSignal, setCloudflareSignal] = useState<any | null>(null);
  const [cloudflareError, setCloudflareError] = useState<string>('');

  /**
   * Animation frame loop for smooth stage progression visualization
   */
  useEffect(() => {
    if (!isAnalyzing) return;

    const animationFrame = setInterval(() => {
      setCurrentTime(Date.now());
    }, 16); // ~60fps

    return () => clearInterval(animationFrame);
  }, [isAnalyzing]);

  useEffect(() => {
    let cancelled = false;
    if (!targetUrl || userTier === 'observer') return;

    const run = async () => {
      const signalResponse = await fetchCloudflareSignal(targetUrl);
      if (cancelled) return;
      if (signalResponse.success) {
        setCloudflareSignal(signalResponse.signal || null);
        setCloudflareError('');
      } else {
        setCloudflareSignal(null);
        setCloudflareError(signalResponse.error || 'Unable to load Cloudflare signals');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [targetUrl, userTier, runId]);

  /**
   * Free tier: show cached snapshot only
   */
  if (userTier === 'observer') {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          📊 Upgrade to see live analysis streaming. Free tier shows cached results only.
        </p>
        <StageIndicator stages={stages} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '2rem',
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
      }}
    >
      {/* Header: status + URL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {isAnalyzing ? (
              <span style={{ display: 'inline-block', animation: 'pulse 2s infinite' }}>●</span>
            ) : isComplete ? (
              <span style={{ color: '#10b981' }}>✓</span>
            ) : isError ? (
              <span style={{ color: '#ef4444' }}>✕</span>
            ) : null}
            Analyzing
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            Run ID: {runId}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            fontSize: '0.875rem',
          }}
        >
          <div>
            <span style={{ color: '#6b7280' }}>Status:</span>
            <span
              style={{
                marginLeft: '0.5rem',
                fontWeight: 600,
                color:
                  state.status === 'complete'
                    ? '#10b981'
                    : state.status === 'error'
                      ? '#ef4444'
                      : '#3b82f6',
                textTransform: 'capitalize',
              }}
            >
              {state.status}
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline stages visualization */}
      <section>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
          Pipeline Stages
        </h3>
        <StageIndicator stages={stages} />
      </section>

      {(cloudflareSignal || cloudflareError) && (
        <section>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
            Traffic Physics Signals
          </h3>

          {cloudflareError && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #fecaca',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                fontSize: '0.875rem',
              }}
            >
              {cloudflareError}
            </div>
          )}

          {cloudflareSignal && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
              }}
            >
              <div
                style={{
                  padding: '0.5rem',
                  background: '#fff',
                  borderRadius: '0.375rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Scan Intensity</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                  {cloudflareSignal.derived.scanIntensity}/100
                </div>
              </div>
              <div
                style={{
                  padding: '0.5rem',
                  background: '#fff',
                  borderRadius: '0.375rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Cache Stability</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                  {cloudflareSignal.derived.cacheStability}%
                </div>
              </div>
              <div
                style={{
                  padding: '0.5rem',
                  background: '#fff',
                  borderRadius: '0.375rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>AI Visibility Gate</div>
                <div
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color:
                      cloudflareSignal.derived.aiVisibilityGate === 'open' ? '#047857' : '#b91c1c',
                    textTransform: 'uppercase',
                  }}
                >
                  {cloudflareSignal.derived.aiVisibilityGate}
                </div>
              </div>
              <div
                style={{
                  padding: '0.5rem',
                  background: '#fff',
                  borderRadius: '0.375rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Traffic Physics Score</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                  {cloudflareSignal.derived.trafficPhysicsScore}/100
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1', paddingTop: '0.25rem' }}>
                {Array.isArray(cloudflareSignal.explanation) &&
                  cloudflareSignal.explanation.slice(0, 3).map((line: string, i: number) => (
                    <div
                      key={i}
                      style={{ fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.25rem' }}
                    >
                      {line}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Fetch stage detail with scan line */}
      <section>
        <h3
          style={{
            margin: '0 0 0.75rem 0',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#6b7280',
          }}
        >
          Fetching
        </h3>
        <div
          style={{
            position: 'relative',
            height: '40px',
            backgroundColor: '#f3f4f6',
            borderRadius: '0.375rem',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
          }}
        >
          <ScanLine stage={stages.fetch} currentTime={currentTime} />
          <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
            {stages.fetch.duration}ms
          </div>
        </div>
      </section>

      {/* Extracted entities */}
      {entities.length > 0 && (
        <section>
          <h3
            style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b7280',
            }}
          >
            Entities Extracted ({entities.length})
          </h3>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
              minHeight: '2.5rem',
            }}
          >
            {entities.map((entity) => (
              <EntityHighlight
                key={entity.id}
                entity={entity}
                currentTime={currentTime}
                onClick={() => setSelectedEntity(entity.id)}
              />
            ))}
          </div>

          {/* Selected entity detail */}
          {selectedEntity && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: '#eff6ff',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>
                {entities.find((e) => e.id === selectedEntity)?.value}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.75rem' }}>
                Confidence:{' '}
                {((entities.find((e) => e.id === selectedEntity)?.confidence || 0) * 100).toFixed(
                  0
                )}
                %
              </p>
            </div>
          )}
        </section>
      )}

      {/* Citations */}
      {citations.length > 0 && (
        <section>
          <h3
            style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b7280',
            }}
          >
            Citations Detected ({citations.length})
          </h3>
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
            }}
          >
            <CitationGraph citations={citations} currentTime={currentTime} />
          </div>
        </section>
      )}

      {/* Scores */}
      {Object.values(scores).some((v) => v !== undefined) && (
        <section>
          <h3
            style={{
              margin: '0 0 1rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b7280',
            }}
          >
            Visibility Scores
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
            }}
          >
            {scores.visibility !== undefined && (
              <ScoreMeter label="Visibility" value={scores.visibility} max={100} trend="up" />
            )}
            {scores.authority !== undefined && (
              <ScoreMeter label="Authority" value={scores.authority} max={100} />
            )}
            {scores.clarity !== undefined && (
              <ScoreMeter label="Clarity" value={scores.clarity} max={100} />
            )}
            {scores.coverage !== undefined && (
              <ScoreMeter label="Coverage" value={scores.coverage} max={100} />
            )}
          </div>
        </section>
      )}

      {/* Timeline replay (paid tiers only) */}
      {showTimeline && timeline.events.length > 0 && (
        <section>
          <h3
            style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b7280',
            }}
          >
            Timeline Replay
          </h3>
          <TimelineScrubber
            events={timeline.events}
            currentFrame={timeline.currentFrame}
            onScrub={timeline.scrubToFrame}
            isReplaying={timeline.isReplaying}
          />
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            Total events recorded: {timeline.events.length}
          </p>
        </section>
      )}

      {/* Error state */}
      {isError && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            borderRadius: '0.375rem',
            border: '1px solid #fecaca',
          }}
        >
          <p style={{ margin: 0, color: '#991b1b', fontWeight: 600 }}>Error</p>
          <p style={{ margin: '0.5rem 0 0 0', color: '#7f1d1d', fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {/* Tier upsell for premium features */}
      {userTier === 'starter' && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fef3c7',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            color: '#92400e',
          }}
        >
          Upgrade to alignment to unlock timeline replay and multi-run diff view.
        </div>
      )}
    </div>
  );
};

export default AnalysisViewer;
