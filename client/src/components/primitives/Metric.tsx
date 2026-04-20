import React from 'react';
import { motion } from 'framer-motion';
import { pulseLockVariants, scoreVariants } from '../../lib/scanMotion';

// Metric is the scalar truth display unit.
// Numbers are truth objects — color encodes system state, monospace signals
// machine-readability.

type ScoreMotion = 'stable' | 'rising' | 'falling' | 'critical';

type MetricProps = {
  label: string;
  value: string | number;
  state?: 'excellent' | 'good' | 'moderate' | 'weak';
  hint?: string;
  /** Trigger pulse-lock animation (confidence convergence event) */
  locked?: boolean;
  /** Continuous score motion state */
  scoreMotion?: ScoreMotion;
};

const stateColorMap = {
  excellent: 'text-score-excellent',
  good: 'text-score-good',
  moderate: 'text-score-moderate',
  weak: 'text-score-weak',
} as const;

export function Metric({
  label,
  value,
  state = 'good',
  hint,
  locked = false,
  scoreMotion = 'stable',
}: MetricProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-metal-dim text-xs uppercase tracking-wider select-none">{label}</div>

      <motion.div
        className={`text-2xl font-mono font-semibold ${stateColorMap[state]}`}
        variants={locked ? pulseLockVariants : scoreVariants}
        animate={locked ? 'locked' : scoreMotion}
      >
        {value}
      </motion.div>

      {hint && <div className="text-xs text-metal-dim leading-snug">{hint}</div>}
    </div>
  );
}
