import React from "react";
import { motion } from "framer-motion";
import { fieldBloomVariants } from "../../lib/scanMotion";

// Card is the base containment field.
// glow is semantic emphasis, not decoration.
// elevation is binary: raised (shadow-cyber-raised) vs embedded (shadow-inner-metal).

type CardProps = {
  children: React.ReactNode;
  className?: string;
  glow?: "cyan" | "silver" | "none";
  elevated?: boolean;
  /** Trigger field-bloom enter animation on mount */
  bloom?: boolean;
};

const glowMap = {
  cyan:   "shadow-cyan-glow",
  silver: "shadow-silver-glow",
  none:   "",
} as const;

export function Card({
  children,
  className = "",
  glow = "none",
  elevated = false,
  bloom = false,
}: CardProps) {
  return (
    <motion.div
      className={[
        "relative rounded-2xl border border-border",
        "bg-surface-panel text-text",
        elevated ? "shadow-cyber-raised" : "shadow-inner-metal",
        glowMap[glow],
        "overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      variants={fieldBloomVariants}
      initial={bloom ? "dormant" : false}
      animate={bloom ? "blooming" : undefined}
    >
      {children}
    </motion.div>
  );
}
