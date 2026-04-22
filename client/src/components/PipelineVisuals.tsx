/**
 * Visual Primitives for Pipeline Rendering
 * Each component maps pipeline state to motion/emergence
 * Data-driven: confidence, frequency, delta directly control visuals
 */

import React, { useMemo } from 'react';
import { UIState } from '../hooks/useAnalysisState';
import { getStageAnimationProgress, getEntityEmergenceProgress } from '../hooks/useAnalysisState';

/**
 * ScanLine Component
 * Renders fetch stage as animated scan line
 * Status: pending → dim pulse, running → moving scan, complete → lock
 */
export interface ScanLineProps {
  stage: UIState['stages']['fetch'];
  currentTime: number;
}

export const ScanLine: React.FC<ScanLineProps> = ({ stage, currentTime }) => {
  const progress = getStageAnimationProgress(stage, currentTime, stage.duration);

  const scanLineStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: `${progress * 100}%`,
    width: '2px',
    height: '100%',
    background: stage.status === 'complete' ? '#10b981' : '#3b82f6',
    opacity: stage.status === 'pending' ? 0.3 : stage.status === 'running' ? 0.8 : 1,
    boxShadow: stage.status === 'running' ? '0 0 8px rgba(59, 130, 246, 0.8)' : 'none',
    transition: stage.status === 'complete' ? 'all 0.3s ease-out' : 'none',
  };

  return (
    <div style={scanLineStyle}>
      {stage.status === 'running' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1px',
            height: '100%',
            background: 'rgba(255,255,255,0.6)',
            animation: 'flicker 0.1s infinite',
          }}
        />
      )}
    </div>
  );
};

/**
 * EntityHighlight Component
 * Renders extracted entity with confidence-driven opacity
 * Animates in: scale 0.8 → 1, opacity 0 → confidence
 */
export interface EntityHighlightProps {
  entity: UIState['entities'][0];
  currentTime: number;
  onClick?: () => void;
}

export const EntityHighlight: React.FC<EntityHighlightProps> = ({
  entity,
  currentTime,
  onClick,
}) => {
  const emergenceProgress = getEntityEmergenceProgress(entity, currentTime);

  const currentOpacity = entity.opacity * emergenceProgress;
  const currentScale = 0.8 + emergenceProgress * 0.2; // scale from 0.8 to 1

  const containerStyle: React.CSSProperties = {
    display: 'inline-block',
    paddingX: '0.5rem',
    paddingY: '0.25rem',
    borderRadius: '0.375rem',
    backgroundColor: `rgba(59, 130, 246, ${currentOpacity * 0.15})`,
    border: `1px solid rgba(59, 130, 246, ${currentOpacity * 0.5})`,
    cursor: onClick ? 'pointer' : 'default',
    opacity: currentOpacity,
    transform: `scale(${currentScale})`,
    transformOrigin: 'center',
    transition: emergenceProgress === 1 ? 'none' : 'all 0.05s linear',
    marginRight: '0.25rem',
    whiteSpace: 'nowrap',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    marginLeft: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: `rgba(59, 130, 246, ${Math.min(currentOpacity, 1)})`,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <span style={containerStyle} onClick={onClick}>
      {entity.value}
      <span style={badgeStyle}>{entity.type}</span>
    </span>
  );
};

/**
 * ScoreMeter Component
 * Renders scores with animated upward/downward motion
 * Visual encoding: score value → bar height + color gradient
 */
export interface ScoreMeterProps {
  label: string;
  value?: number;
  max?: number;
  trend?: 'up' | 'down' | 'stable';
}

export const ScoreMeter: React.FC<ScoreMeterProps> = ({
  label,
  value = 0,
  max = 100,
  trend = 'stable',
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    minWidth: '120px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#6b7280',
  };

  const barContainerStyle: React.CSSProperties = {
    position: 'relative',
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
  };

  const barStyle: React.CSSProperties = {
    height: '100%',
    width: `${percentage}%`,
    background: percentage > 60 ? '#10b981' : percentage > 30 ? '#f59e0b' : '#ef4444',
    transition: 'width 0.4s ease-out',
    boxShadow: `0 0 ${percentage * 0.3}px rgba(16, 185, 129, 0.5)`,
  };

  const valueTextStyle: React.CSSProperties = {
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: percentage > 60 ? '#10b981' : percentage > 30 ? '#f59e0b' : '#ef4444',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={barContainerStyle}>
        <div style={barStyle} />
      </div>
      <div style={valueTextStyle}>
        {value.toFixed(0)} {trend === 'up' && '↑'} {trend === 'down' && '↓'}
      </div>
    </div>
  );
};

/**
 * CitationGraph Component (simplified)
 * Renders citations with frequency-driven thickness
 * Animated appearance: line draws in + text fades
 */
export interface CitationGraphProps {
  citations: UIState['citations'];
  currentTime: number;
}

export const CitationGraph: React.FC<CitationGraphProps> = ({ citations, currentTime }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {citations.map((citation, idx) => {
        const emergenceProgress = Math.min((currentTime - citation.appearedAt) / 300, 1);
        const thickness = citation.thickness;

        const linkStyle: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          opacity: emergenceProgress,
          transform: `translateX(${(1 - emergenceProgress) * -10}px)`,
          transition: emergenceProgress === 1 ? 'none' : 'all 0.05s ease-out',
        };

        const lineStyle: React.CSSProperties = {
          flex: 1,
          height: `${thickness}px`,
          backgroundColor: `rgba(59, 130, 246, ${0.3 + emergenceProgress * 0.5})`,
          borderRadius: '2px',
          transition: 'none',
        };

        const mentionStyle: React.CSSProperties = {
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#374151',
          opacity: emergenceProgress,
        };

        return (
          <div key={`${citation.source}:${citation.mention}:${idx}`} style={linkStyle}>
            <div style={lineStyle} />
            <span style={mentionStyle}>{citation.mention}</span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>(×{citation.frequency})</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * TimelineScrubber Component
 * Allows scrubbing through recorded pipeline events
 * Visual: frame-by-frame playback of the analysis
 */
export interface TimelineScrubberProps {
  events: UIState['timeline']['events'];
  currentFrame: number;
  onScrub: (frame: number) => void;
  isReplaying?: boolean;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  events,
  currentFrame,
  onScrub,
  isReplaying = false,
}) => {
  const maxFrame = Math.max(...events.map((e) => e.frame), 1);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
  };

  const sliderStyle: React.CSSProperties = {
    flex: 1,
    cursor: isReplaying ? 'default' : 'pointer',
    opacity: isReplaying ? 0.5 : 1,
  };

  const frameTextStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#6b7280',
    minWidth: '80px',
  };

  return (
    <div style={containerStyle}>
      <span style={frameTextStyle}>Frame {currentFrame}</span>
      <input
        type="range"
        min={0}
        max={maxFrame}
        value={currentFrame}
        onChange={(e) => onScrub(Number(e.target.value))}
        disabled={isReplaying}
        style={sliderStyle}
      />
      <span style={frameTextStyle}>{maxFrame}</span>
    </div>
  );
};

/**
 * StageIndicator Component
 * Shows all pipeline stages with status badges
 * Color coding: pending=gray, running=blue, complete=green, failed=red
 */
export interface StageIndicatorProps {
  stages: UIState['stages'];
}

export const StageIndicator: React.FC<StageIndicatorProps> = ({ stages }) => {
  const stageOrder = ['fetch', 'parse', 'entities', 'score', 'cache'] as const;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.5rem',
  };

  const stageBadgeStyle = (status: string): React.CSSProperties => ({
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'white',
    backgroundColor:
      status === 'complete'
        ? '#10b981'
        : status === 'running'
          ? '#3b82f6'
          : status === 'failed'
            ? '#ef4444'
            : '#d1d5db',
    transition: 'all 0.2s ease-out',
    textTransform: 'capitalize',
  });

  return (
    <div style={containerStyle}>
      {stageOrder.map((stageName) => {
        const stage = stages[stageName as keyof typeof stages];
        if (!stage) return null;

        return (
          <div key={stageName} style={stageBadgeStyle(stage.status)}>
            {stageName}
          </div>
        );
      })}
    </div>
  );
};
