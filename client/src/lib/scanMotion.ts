/**
 * scanMotion.ts — Framer Motion preset library for the scan-driven inference UI.
 *
 * Every animated component must declare:
 *   state: idle | scanning | locking | drifting | committed
 *   intensity: low | medium | high
 *   scope: local | entity | system
 *
 * If these are not defined, motion becomes decorative noise.
 */

import type { Variants } from "framer-motion";

// ── Inference States ──────────────────────────────────────────────────────────

export type InferenceState = "idle" | "scanning" | "locking" | "drifting" | "committed";
export type MotionIntensity = "low" | "medium" | "high";
export type MotionScope = "local" | "entity" | "system";

// ── Temporal Hierarchy ────────────────────────────────────────────────────────
// micro  = reflex   (80–200ms)
// meso   = thought  (300–900ms)
// macro  = perception (1200–3000ms)

export const TIMING = {
  micro: { fast: 80, normal: 150, slow: 200 },
  meso: { fast: 300, normal: 600, slow: 900 },
  macro: { fast: 1200, normal: 2000, slow: 3000 },
} as const;

// ── Semantic Easing Curves ────────────────────────────────────────────────────

export const EASING = {
  /** Fast in, controlled out — certainty forming (verified state) */
  confidence: [0.22, 1, 0.36, 1] as const,
  /** Asymmetric, slightly irregular — instability being computed */
  uncertainty: [0.45, 0.05, 0.55, 0.95] as const,
  /** Smooth but slightly delayed — moving through known space */
  systemGlide: [0.4, 0, 0.2, 1] as const,
} as const;

// ── 2.1 Scan Sweep — continuous inference traversal ──────────────────────────
// "The system is reading reality."
// Direction: top → bottom, constant linear velocity, never eases.

export const scanSweepVariants: Variants = {
  idle: {
    opacity: 0,
    y: "-100%",
  },
  scanning: {
    opacity: [0, 0.12, 0.12, 0],
    y: ["-100%", "0%", "60%", "200%"],
    transition: {
      duration: 3,
      ease: "linear",
      repeat: Infinity,
      times: [0, 0.04, 0.90, 1],
    },
  },
};

// ── 2.2 Pulse Lock — confidence convergence ──────────────────────────────────
// "This entity is now stable in the model."
// Single-cycle: sharp in, soft out. Used for: score upgrades, citation confirmation.

export const pulseLockVariants: Variants = {
  idle: {
    scale: 1,
    opacity: 0.85,
  },
  locked: {
    scale: [1, 1.03, 1.01, 1],
    opacity: [0.85, 1, 1, 1],
    transition: {
      duration: 0.55,
      ease: EASING.confidence,
      times: [0, 0.40, 0.65, 1],
    },
  },
};

// ── 2.3 Drift Oscillation — uncertainty field ─────────────────────────────────
// "The system cannot agree yet."
// Must never feel smooth — slight discomfort is the intent.

export const driftVariants: Variants = {
  stable: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
  },
  drifting: {
    x: [-3, 4, -2, 3, -1, 0],
    opacity: [1, 0.88, 0.93, 0.85, 0.91, 0.94],
    filter: [
      "blur(0px)",
      "blur(0.5px)",
      "blur(0px)",
      "blur(0.7px)",
      "blur(0.2px)",
      "blur(0px)",
    ],
    transition: {
      duration: 2.6,
      ease: EASING.uncertainty,
      repeat: Infinity,
      times: [0, 0.18, 0.42, 0.63, 0.82, 1],
    },
  },
};

// ── 2.4 Entity Snap — resolution moment ──────────────────────────────────────
// "Truth collapsed into structure."
// Used when: ranking stabilizes, entity resolves from multiple sources.

export const entitySnapVariants: Variants = {
  unresolved: {
    x: 6,
    opacity: 0.7,
    filter: "blur(1px)",
    scale: 0.98,
  },
  resolved: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 900,
      damping: 30,
      mass: 0.4,
    },
  },
};

// ── 2.5 Field Bloom — system-wide activation ─────────────────────────────────
// "The system just woke up."
// Used for: initial page load, batch reindex, global refresh.

export const fieldBloomVariants: Variants = {
  dormant: {
    opacity: 0,
    scale: 0.96,
  },
  blooming: {
    opacity: 1,
    scale: [0.96, 1.01, 1],
    transition: {
      duration: 1.4,
      ease: EASING.systemGlide,
      times: [0, 0.6, 1],
    },
  },
};

// ── Idle system signature — living inference engine baseline ──────────────────
// Ultra-slow background pulse, barely visible, fires every ~15s.

export const idleSystemVariants: Variants = {
  alive: {
    opacity: [0.03, 0.07, 0.04, 0.03],
    transition: {
      duration: 15,
      ease: "easeInOut",
      repeat: Infinity,
      times: [0, 0.35, 0.7, 1],
    },
  },
};

// ── Panel state variants ──────────────────────────────────────────────────────

export const panelVariants: Variants = {
  idle: { opacity: 1 },
  active: { opacity: 1 },
  analyzing: { opacity: 1 },
  resolved: {
    opacity: [0.82, 1],
    transition: {
      duration: 0.6,
      ease: EASING.confidence,
    },
  },
};

// ── Score motion variants (rising / falling / critical) ──────────────────────

export const scoreVariants: Variants = {
  stable: { y: 0, opacity: 1 },
  rising: {
    y: [0, -3, 0],
    opacity: [1, 1, 1],
    transition: { duration: 0.4, ease: EASING.confidence },
  },
  falling: {
    y: [0, 2, 0],
    opacity: [1, 0.75, 0.85],
    transition: { duration: 0.5, ease: EASING.uncertainty },
  },
  critical: {
    opacity: [1, 0.6, 1],
    transition: { duration: 2.2, ease: "easeInOut", repeat: Infinity },
  },
};

// ── InferenceState → variant key mapper ──────────────────────────────────────

type VariantScope = "sweep" | "lock" | "drift" | "snap" | "bloom";

export function inferenceToVariant(state: InferenceState, scope: VariantScope): string {
  const matrix: Record<VariantScope, Record<InferenceState, string>> = {
    sweep: {
      idle: "idle",
      scanning: "scanning",
      locking: "idle",
      drifting: "idle",
      committed: "idle",
    },
    lock: {
      idle: "idle",
      scanning: "idle",
      locking: "locked",
      drifting: "idle",
      committed: "locked",
    },
    drift: {
      idle: "stable",
      scanning: "stable",
      locking: "stable",
      drifting: "drifting",
      committed: "stable",
    },
    snap: {
      idle: "unresolved",
      scanning: "unresolved",
      locking: "unresolved",
      drifting: "unresolved",
      committed: "resolved",
    },
    bloom: {
      idle: "dormant",
      scanning: "blooming",
      locking: "dormant",
      drifting: "dormant",
      committed: "dormant",
    },
  };
  return matrix[scope][state];
}

// ── useInferenceMotion hook ───────────────────────────────────────────────────
//
// Returns ready-to-spread variant bindings for each motion primitive,
// adjusted by intensity (scales timing factor, not implemented inside
// variants themselves — caller applies duration override if needed).

export function useInferenceMotion(
  state: InferenceState,
  intensity: MotionIntensity = "medium",
) {
  const durationFactor = intensity === "low" ? 1.4 : intensity === "high" ? 0.65 : 1;

  return {
    sweep: {
      variants: scanSweepVariants,
      animate: inferenceToVariant(state, "sweep"),
    },
    lock: {
      variants: pulseLockVariants,
      animate: inferenceToVariant(state, "lock"),
    },
    drift: {
      variants: driftVariants,
      animate: inferenceToVariant(state, "drift"),
    },
    snap: {
      variants: entitySnapVariants,
      animate: inferenceToVariant(state, "snap"),
    },
    bloom: {
      variants: fieldBloomVariants,
      animate: inferenceToVariant(state, "bloom"),
    },
    durationFactor,
    state,
    intensity,
  };
}

// ── §8 Implementation contract ────────────────────────────────────────────────
// Every animated component must declare state, intensity, and scope.
// If these are not defined, motion becomes decorative noise.

export interface MotionContract {
  state: InferenceState;
  intensity: MotionIntensity;
  scope: MotionScope;
}

// ── §5 Dual-direction conflict drift ─────────────────────────────────────────
// "conflicting" entity state — two sources disagreeing simultaneously.
// Rarer than standard drift, but more important. Both axes move out of phase.

export const conflictDriftVariants: Variants = {
  stable: {
    x: 0,
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
  },
  conflicting: {
    x: [-4, 5, -3, 4, -2, 3, 0],
    y: [0, -2, 1, -1, 2, -1, 0],
    opacity: [1, 0.82, 0.90, 0.78, 0.88, 0.84, 0.90],
    filter: [
      "blur(0px)",
      "blur(0.8px)",
      "blur(0.2px)",
      "blur(1px)",
      "blur(0.3px)",
      "blur(0.5px)",
      "blur(0px)",
    ],
    transition: {
      duration: 3.2,
      ease: EASING.uncertainty,
      repeat: Infinity,
      times: [0, 0.15, 0.32, 0.51, 0.68, 0.85, 1],
    },
  },
};

// ── §5 Entity state variants ──────────────────────────────────────────────────
// Covers the full entity lifecycle:
//   indexed → subtle glow, static
//   scanning → scan line passes through (sweep overlay handles line; this dims slightly)
//   partial → single-axis drift oscillation
//   verified → pulse lock + stable glow
//   conflicting → dual-axis drift (uses conflictDriftVariants values inlined)

export const entityStateVariants: Variants = {
  indexed: {
    opacity: 1,
    x: 0,
    y: 0,
    filter: "blur(0px)",
    boxShadow: "0 0 6px 1px rgba(34,211,238,0.12)",
  },
  scanning: {
    opacity: [1, 0.88, 1],
    transition: {
      duration: 1.8,
      ease: "linear",
      repeat: Infinity,
      times: [0, 0.5, 1],
    },
  },
  partial: {
    x: [-2, 3, -1, 2, 0],
    opacity: [0.9, 0.75, 0.85, 0.78, 0.82],
    filter: ["blur(0px)", "blur(0.6px)", "blur(0.2px)", "blur(0.4px)", "blur(0px)"],
    transition: {
      duration: 2.2,
      ease: EASING.uncertainty,
      repeat: Infinity,
      times: [0, 0.25, 0.5, 0.75, 1],
    },
  },
  verified: {
    opacity: 1,
    x: 0,
    y: 0,
    filter: "blur(0px)",
    boxShadow: "0 0 10px 2px rgba(34,211,238,0.22)",
    transition: { duration: 0.5, ease: EASING.confidence },
  },
  conflicting: {
    x: [-4, 5, -3, 4, 0],
    y: [0, -2, 1, -1, 0],
    opacity: [1, 0.80, 0.88, 0.76, 0.86],
    filter: ["blur(0px)", "blur(0.8px)", "blur(0.2px)", "blur(0.9px)", "blur(0px)"],
    transition: {
      duration: 3.2,
      ease: EASING.uncertainty,
      repeat: Infinity,
      times: [0, 0.22, 0.48, 0.74, 1],
    },
  },
};

// ── §5 Analyzing panel — layered shimmer + micro flicker ──────────────────────
// Separate from panelVariants so it can be stacked as an overlay layer.

export const analyzingVariants: Variants = {
  idle: { opacity: 1 },
  analyzing: {
    opacity: [1, 0.94, 0.97, 0.91, 0.96, 0.93, 1],
    transition: {
      duration: 1.8,
      ease: "linear",
      repeat: Infinity,
      times: [0, 0.15, 0.32, 0.5, 0.65, 0.82, 1],
    },
  },
};

// ── §6 Data gravity model ─────────────────────────────────────────────────────
// Motion is inversely proportional to certainty.
//   High confidence (≥75) → anchored, low motion
//   Mid confidence (40–74) → medium entropy
//   Low confidence (<40) → high entropy, maximum motion

export function dataGravity(confidenceScore: number): MotionIntensity {
  if (confidenceScore >= 75) return "low";
  if (confidenceScore >= 40) return "medium";
  return "high";
}

/**
 * Returns a spatial entropy weight in [0, 1].
 * 0 = fully anchored (100% confidence), 1 = maximum drift (0% confidence).
 * Use to scale motion amplitude proportionally to uncertainty.
 */
export function spatialEntropy(confidenceScore: number): number {
  return Math.max(0, Math.min(1, (100 - confidenceScore) / 100));
}

// ── SCAN_MOTION namespace (convenience export) ────────────────────────────────

export const SCAN_MOTION = {
  variants: {
    sweep: scanSweepVariants,
    lock: pulseLockVariants,
    drift: driftVariants,
    conflictDrift: conflictDriftVariants,
    snap: entitySnapVariants,
    bloom: fieldBloomVariants,
    panel: panelVariants,
    analyzing: analyzingVariants,
    entityState: entityStateVariants,
    score: scoreVariants,
    idle: idleSystemVariants,
  },
  timing: TIMING,
  easing: EASING,
  dataGravity,
  spatialEntropy,
  inferenceToVariant,
  useInferenceMotion,
} as const;
