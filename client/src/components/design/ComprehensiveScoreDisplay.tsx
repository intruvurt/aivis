import React from 'react';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/design/designSystem';

/**
 * ─────────────────────────────────────────────────────────────
 * 5-PART SCORE DISPLAY
 *
 * Shows: Verified Evidence | Gaps | Drift | Technical SEO | Registry
 * ─────────────────────────────────────────────────────────────
 */

interface ScoreMetric {
  label: string;
  current: number;
  max: number;
  color: string;
  status: 'pass' | 'warning' | 'review' | 'action';
  description?: string;
}

interface ComprehensiveScoreDisplayProps {
  overallScore: number;
  maxScore: number;
  metrics: ScoreMetric[];
  technicalSeoScore: number;
  technicalSeoStatus: 'pass' | 'fail';
  visibilityWithoutSeo?: number;
  roadmapScore?: number;
}

export function ComprehensiveScoreDisplay({
  overallScore,
  maxScore,
  metrics,
  technicalSeoScore,
  technicalSeoStatus,
  visibilityWithoutSeo,
  roadmapScore,
}: ComprehensiveScoreDisplayProps) {
  const percentage = Math.round((overallScore / maxScore) * 100);

  return (
    <div
      className="rounded-md border p-6"
      style={{
        borderColor: COLORS.border.default,
        backgroundColor: COLORS.bg.primary,
      }}
    >
      {/* Overall Score Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p
            style={{
              fontSize: TYPOGRAPHY.bodySmall.size,
              fontWeight: TYPOGRAPHY.bodySmall.weight,
              color: COLORS.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Citation Probability
          </p>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              color: COLORS.text.primary,
              marginTop: SPACING.xs,
            }}
          >
            {overallScore}/{maxScore}
          </h2>
        </div>
        <div className="text-right">
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: COLORS.text.primary,
            }}
          >
            {percentage}%
          </div>
          <div
            style={{
              width: '200px',
              height: '8px',
              backgroundColor: COLORS.bg.secondary,
              borderRadius: BORDER_RADIUS.xs,
              marginTop: SPACING.sm,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percentage}%`,
                backgroundColor: getScoreColor(percentage),
                transition: 'width 250ms ease-out',
              }}
            />
          </div>
        </div>
      </div>

      {/* Metric Breakdown */}
      <div className="space-y-4 mb-6">
        {metrics.map((metric) => (
          <ScoreMetricRow key={metric.label} metric={metric} />
        ))}
      </div>

      <hr style={{ borderColor: COLORS.border.default, marginBottom: SPACING.lg }} />

      {/* Technical SEO Separate Section */}
      <div
        className="rounded-sm border p-4"
        style={{
          borderColor: COLORS.border.default,
          backgroundColor: COLORS.bg.secondary,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <p
            style={{
              fontSize: TYPOGRAPHY.bodySmall.size,
              fontWeight: 600,
              color: COLORS.text.secondary,
            }}
          >
            Technical SEO (Mandatory SOP)
          </p>
          <span
            style={{
              fontSize: TYPOGRAPHY.bodySmall.size,
              fontWeight: 600,
              color: technicalSeoStatus === 'pass' ? COLORS.status.success : COLORS.status.danger,
            }}
          >
            {technicalSeoScore}/{15} {technicalSeoStatus === 'pass' ? '✓ PASS' : '✗ FAIL'}
          </span>
        </div>
        <p
          style={{
            fontSize: TYPOGRAPHY.bodyXs.size,
            color: COLORS.text.muted,
            marginTop: SPACING.xs,
          }}
        >
          • Schema.org structured data: {technicalSeoStatus === 'pass' ? '✓' : '✗'} Valid JSON-LD
          <br />• WCAG 2.1 AA compliance: {technicalSeoStatus === 'pass' ? '✓' : '✗'} PASS
          <br />• Mobile rendering: {technicalSeoStatus === 'pass' ? '✓' : '✗'} Responsive
          <br />• Crawlability: {technicalSeoStatus === 'pass' ? '✓' : '✗'} Accessible
        </p>
      </div>

      {/* Impact Summary */}
      {visibilityWithoutSeo !== undefined && roadmapScore !== undefined && (
        <div
          className="mt-6 rounded-sm border p-4"
          style={{
            borderColor: COLORS.border.default,
            backgroundColor: COLORS.bg.secondary,
          }}
        >
          <p
            style={{
              fontSize: TYPOGRAPHY.bodySmall.size,
              fontWeight: 600,
              color: COLORS.text.primary,
              marginBottom: SPACING.md,
            }}
          >
            Impact Summary
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: SPACING.lg,
            }}
          >
            <div>
              <p style={{ color: COLORS.text.muted, fontSize: TYPOGRAPHY.bodyXs.size }}>
                Best case (perfect SEO + citations)
              </p>
              <p
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: COLORS.text.primary,
                }}
              >
                {roadmapScore}
              </p>
            </div>
            <div>
              <p style={{ color: COLORS.text.muted, fontSize: TYPOGRAPHY.bodyXs.size }}>
                Current SEO loss
              </p>
              <p
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color:
                    technicalSeoStatus === 'pass' ? COLORS.status.success : COLORS.status.danger,
                }}
              >
                {technicalSeoStatus === 'pass' ? '0' : '-15'}
              </p>
            </div>
            <div>
              <p style={{ color: COLORS.text.muted, fontSize: TYPOGRAPHY.bodyXs.size }}>
                Current citation loss
              </p>
              <p
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: COLORS.status.warning,
                }}
              >
                -{maxScore - overallScore}
              </p>
            </div>
            <div>
              <p style={{ color: COLORS.text.muted, fontSize: TYPOGRAPHY.bodyXs.size }}>
                Your score now
              </p>
              <p
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: COLORS.text.primary,
                }}
              >
                {overallScore}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Metric Row
 */
function ScoreMetricRow({ metric }: { metric: ScoreMetric }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p
          style={{
            fontSize: TYPOGRAPHY.bodySmall.size,
            fontWeight: 600,
            color: COLORS.text.primary,
          }}
        >
          {metric.label}
        </p>
        <p
          style={{
            fontSize: TYPOGRAPHY.bodySmall.size,
            fontWeight: 600,
            color: metric.color,
          }}
        >
          {metric.current}/{metric.max}
        </p>
      </div>
      <div
        style={{
          height: '6px',
          backgroundColor: COLORS.bg.secondary,
          borderRadius: BORDER_RADIUS.xs,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(metric.current / metric.max) * 100}%`,
            backgroundColor: metric.color,
            transition: 'width 250ms ease-out',
          }}
        />
      </div>
      {metric.description && (
        <p
          style={{
            fontSize: TYPOGRAPHY.bodyXs.size,
            color: COLORS.text.muted,
            marginTop: SPACING.xs,
          }}
        >
          {metric.description}
        </p>
      )}
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────
 * PRIORITY BLOCKER CARD
 * ─────────────────────────────────────────────────────────────
 */

interface BlockerCardProps {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impactPoints: number;
  effortMinutes: number;
  status: 'not_started' | 'in_progress' | 'completed';
  tags?: string[];
  onViewDetails?: () => void;
  onFix?: () => void;
  registryInfo?: {
    patternCount: number;
    averageImpact: number;
  };
}

const SEVERITY_CONFIG = {
  critical: { color: COLORS.status.danger, label: 'CRITICAL', bg: '#7f1d1d' },
  high: { color: COLORS.status.warning, label: 'HIGH', bg: '#78350f' },
  medium: { color: COLORS.status.info, label: 'MEDIUM', bg: '#082f49' },
  low: { color: COLORS.status.success, label: 'LOW', bg: '#064e3b' },
};

export function BlockerCard({
  severity,
  title,
  description,
  impactPoints,
  effortMinutes,
  status,
  tags,
  onViewDetails,
  onFix,
  registryInfo,
}: BlockerCardProps) {
  const config = SEVERITY_CONFIG[severity];
  const statusText =
    status === 'completed' ? 'Fixed' : status === 'in_progress' ? 'In Progress' : 'Not Started';

  return (
    <div
      className="rounded-sm border p-4"
      style={{
        borderColor: COLORS.border.default,
        backgroundColor: COLORS.bg.primary,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div
            style={{
              display: 'inline-block',
              backgroundColor: config.bg,
              color: config.color,
              padding: `${SPACING.xs} ${SPACING.sm}`,
              borderRadius: BORDER_RADIUS.xs,
              fontSize: TYPOGRAPHY.bodyXs.size,
              fontWeight: 600,
              marginBottom: SPACING.sm,
            }}
          >
            [{config.label}]
          </div>
          <h4
            style={{
              fontSize: TYPOGRAPHY.h4.size,
              fontWeight: TYPOGRAPHY.h4.weight,
              color: COLORS.text.primary,
            }}
          >
            {title}
          </h4>
        </div>
        <span
          style={{
            fontSize: TYPOGRAPHY.bodyXs.size,
            fontWeight: 600,
            color: status === 'completed' ? COLORS.status.success : COLORS.text.muted,
          }}
        >
          {statusText}
        </span>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: TYPOGRAPHY.body.size,
          color: COLORS.text.secondary,
          marginBottom: SPACING.md,
        }}
      >
        {description}
      </p>

      {/* Metadata Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: SPACING.md,
          marginBottom: SPACING.md,
          paddingBottom: SPACING.md,
          borderBottom: `1px solid ${COLORS.border.default}`,
        }}
      >
        <div>
          <p style={{ fontSize: TYPOGRAPHY.bodyXs.size, color: COLORS.text.muted }}>Impact</p>
          <p
            style={{
              fontSize: TYPOGRAPHY.h4.size,
              fontWeight: 600,
              color: COLORS.action.primary,
            }}
          >
            +{impactPoints} pts
          </p>
        </div>
        <div>
          <p style={{ fontSize: TYPOGRAPHY.bodyXs.size, color: COLORS.text.muted }}>Effort</p>
          <p
            style={{
              fontSize: TYPOGRAPHY.h4.size,
              fontWeight: 600,
              color: COLORS.text.primary,
            }}
          >
            {effortMinutes} min
          </p>
        </div>
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: TYPOGRAPHY.bodyXs.size,
                color: COLORS.text.muted,
                border: `1px solid ${COLORS.border.default}`,
                padding: `${SPACING.xs} ${SPACING.sm}`,
                borderRadius: BORDER_RADIUS.xs,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Registry Info */}
      {registryInfo && (
        <div
          style={{
            backgroundColor: COLORS.bg.secondary,
            padding: SPACING.md,
            borderRadius: BORDER_RADIUS.xs,
            marginBottom: SPACING.md,
          }}
        >
          <p style={{ fontSize: TYPOGRAPHY.bodyXs.size, color: COLORS.text.muted }}>
            Registry: This pattern appears in {registryInfo.patternCount} similar audits
          </p>
          <p
            style={{
              fontSize: TYPOGRAPHY.bodyXs.size,
              color: COLORS.evidence.verified,
              marginTop: SPACING.xs,
            }}
          >
            Average impact: +{registryInfo.averageImpact} pts
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: SPACING.sm }}>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            style={{
              flex: 1,
              padding: `${SPACING.sm} ${SPACING.md}`,
              backgroundColor: 'transparent',
              color: COLORS.text.primary,
              border: `1px solid ${COLORS.border.default}`,
              borderRadius: BORDER_RADIUS.sm,
              fontSize: TYPOGRAPHY.bodySmall.size,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = COLORS.border.strong;
              e.currentTarget.style.backgroundColor = COLORS.bg.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS.border.default;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            View Details
          </button>
        )}
        {onFix && (
          <button
            onClick={onFix}
            style={{
              flex: 1,
              padding: `${SPACING.sm} ${SPACING.md}`,
              backgroundColor: COLORS.action.primary,
              color: '#0f172a',
              border: 'none',
              borderRadius: BORDER_RADIUS.sm,
              fontSize: TYPOGRAPHY.bodySmall.size,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.action.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.action.primary;
            }}
          >
            Fix This
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────
 * UTILITY FUNCTIONS
 * ─────────────────────────────────────────────────────────────
 */

function getScoreColor(percentage: number): string {
  if (percentage >= 85) return COLORS.status.success;
  if (percentage >= 70) return COLORS.status.warning;
  if (percentage >= 50) return COLORS.status.info;
  return COLORS.status.danger;
}
