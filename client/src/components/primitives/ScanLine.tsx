import React from "react";
import { motion } from "framer-motion";
import { scanSweepVariants, type InferenceState } from "../../lib/scanMotion";

// ScanLine is the system's alive signal — not decoration.
// "system is analyzing" → should appear only on active panels or hovered entity
// clusters. Motion is constant linear velocity; it never eases or accelerates.

type ScanLineProps = {
  active?: boolean;
  state?: InferenceState;
};

export function ScanLine({ active = true, state = "scanning" }: ScanLineProps) {
  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className={[
          "absolute left-0 w-full h-20",
          "bg-gradient-to-b from-transparent via-brand-cyan/10 to-transparent",
          "blur-sm",
        ].join(" ")}
        variants={scanSweepVariants}
        initial="idle"
        animate={state === "scanning" ? "scanning" : "idle"}
      />
    </div>
  );
}
