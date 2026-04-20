import React from 'react';
import { motion } from 'framer-motion';
import {
  driftVariants,
  entitySnapVariants,
  inferenceToVariant,
  type InferenceState,
} from '../../lib/scanMotion';

// EntityRow represents a node in the reality map — a first-class entity, not a
// text row. Left border encodes system state. Score is secondary metadata.
// inferenceState drives the motion layer: drift for uncertainty, snap for resolution.

type EntityStatus = 'indexed' | 'partial' | 'missing';

type EntityRowProps = {
  name: string;
  type?: string;
  score?: number;
  status?: EntityStatus;
  inferenceState?: InferenceState;
  children?: React.ReactNode;
};

const statusBorderMap: Record<EntityStatus, string> = {
  indexed: 'border-brand-cyan',
  partial: 'border-brand-amber',
  missing: 'border-score-weak',
};

export function EntityRow({
  name,
  type,
  score,
  status = 'indexed',
  inferenceState = 'committed',
  children,
}: EntityRowProps) {
  const isDrifting = inferenceState === 'drifting';

  return (
    <motion.div
      className={[
        'flex items-center justify-between',
        'px-4 py-3 rounded-xl',
        'border-l-2',
        statusBorderMap[status],
        'bg-surface-base hover:bg-surface-hover',
        'transition-colors',
      ].join(' ')}
      variants={isDrifting ? driftVariants : entitySnapVariants}
      animate={
        isDrifting
          ? inferenceToVariant(inferenceState, 'drift')
          : inferenceToVariant(inferenceState, 'snap')
      }
    >
      <div className="flex flex-col gap-0.5">
        <div className="text-text font-medium leading-tight">{name}</div>
        {type && <div className="text-xs text-metal-dim tracking-wide">{type}</div>}
      </div>

      <div className="flex items-center gap-4">
        {score !== undefined && (
          <div className="font-mono text-sm text-metal-silver tabular-nums">{score}</div>
        )}
        {children}
      </div>
    </motion.div>
  );
}
