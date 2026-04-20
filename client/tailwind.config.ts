import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Cyber-Metal Variable System ──
        bg: "rgb(var(--bg) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",

        // ── The "Matt Silver" & High-Contrast System ──
        "metal-silver": "#E2E8F0",    // The "Light Gray" for primary text/headers
        "metal-dim": "#94A3B8",       // Dimmer silver for secondary info
        "cyber-black": "#060607",     // Your base pitch-deck black
        
        // ── Surface System (Widened Contrast for Dashboard) ──
        "surface-base": "#060607",
        "surface-raised": "#0F1117",  // Dark shadow depth
        "surface-panel": "#14171F",   // Slightly lighter for card surfaces
        "surface-hover": "#1E222D",

        // ── Brand Accents (Vibrant but Professional) ──
        "brand-cyan": "#22D3EE",      // Neon cyan from your landing SVG
        "brand-violet": "#8B5CF6",    // Deep violet for "AI Layer" feel
        "brand-amber": "#FBBF24",     // For "Evidence" and "Score Fix"

        // ── Score Status ──
        "score-excellent": "#10B981",
        "score-good": "#22D3EE",
        "score-moderate": "#F59E0B",
        "score-weak": "#EF4444",
      },
      boxShadow: {
        // The "Dark Shadow" against Matt Silver look
        "cyber-raised": "0 10px 30px -10px rgba(0,0,0,0.7)",
        "silver-glow": "0 0 20px rgba(226, 232, 240, 0.05)",
        "cyan-glow": "0 0 15px rgba(34, 211, 238, 0.15)",
        "inner-metal": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)", 
      },
      fontFamily: {
        // Orbitron for that robotic/futuristic header feel
        cyber: ["Orbitron", "JetBrains Mono", "monospace"],
        sans: ["Inter", "DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)",
        "metal-shine": "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
      },
      keyframes: {
        "scan-line": {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
        // ── Motion language: inference states ────────────────────────────────
        // pulse-lock — confidence convergence (single cycle, sharp in/soft out)
        "pulse-lock": {
          "0%, 100%": { transform: "scale(1)",    opacity: "1"    },
          "40%":      { transform: "scale(1.03)", opacity: "0.92" },
          "65%":      { transform: "scale(1.01)", opacity: "1"    },
        },
        // drift — uncertainty field (must feel slightly uncomfortable)
        "drift": {
          "0%, 100%": { transform: "translateX(0px)",  opacity: "1"    },
          "18%":      { transform: "translateX(-3px)", opacity: "0.88" },
          "42%":      { transform: "translateX(4px)",  opacity: "0.93" },
          "63%":      { transform: "translateX(-2px)", opacity: "0.85" },
          "82%":      { transform: "translateX(3px)",  opacity: "0.92" },
        },
        // field-bloom — system activation / page load (radial-esque expansion)
        "field-bloom": {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "60%":  { opacity: "1", transform: "scale(1.01)" },
          "100%": { opacity: "1", transform: "scale(1)"    },
        },
        // scan-idle — barely-visible background pulse (living system signature)
        "scan-idle": {
          "0%, 100%": { opacity: "0.03" },
          "35%":      { opacity: "0.07" },
          "70%":      { opacity: "0.04" },
        },
      },
      animation: {
        "scan":        "scan-line 3s linear infinite",
        "shimmer":     "shimmer 2s infinite",
        "pulse-lock":  "pulse-lock 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "drift":       "drift 2.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite",
        "field-bloom": "field-bloom 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "scan-idle":   "scan-idle 15s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;