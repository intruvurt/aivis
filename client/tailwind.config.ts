import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Variable-driven system (recommended)
        bg: "rgb(var(--bg) / <alpha-value>)",
        "bg-2": "rgb(var(--bg-2) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        "panel-2": "rgb(var(--panel-2) / <alpha-value>)",
        "panel-3": "rgb(var(--panel-3) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",

        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-foreground": "rgb(var(--accent-foreground) / <alpha-value>)",

        // ── Dashboard surface system ──
        "surface-base":    "#0b0f1a",
        "surface-raised":  "#111827",
        "surface-overlay":  "#1a2234",
        "surface-card":    "#141c2e",
        "surface-hover":   "#1e293b",
        "surface-active":  "#243044",
        // ── Score status colors ──
        "score-excellent": "#10b981",
        "score-good":      "#22d3ee",
        "score-moderate":  "#f59e0b",
        "score-weak":      "#ef4444",
        "score-critical":  "#dc2626",
        // ── Brand accents ──
        "brand-cyan":  "#06b6d4",
        "brand-teal":  "#14b8a6",
        "brand-emerald": "#10b981",
        // ── Sanguine / warm accent static aliases ──
        sanguine:       "#B05146",
        "sanguine-dk":  "#8F3D34",
        olivo:          "#82AF28",
        "olivo-dk":     "#6A911E",
        "coral-warm":   "#E16E55",
        "amber-warm":   "#CC9B2A",
        // ── Panel / surface tokens ──
        linen:          "#F9F7F4",
        "linen-2":      "#F3F0EC",
        "linen-3":      "#E8E2DA",
        "warm-border":  "#B4A494",
        "warm-shadow":  "rgba(80,55,35,0.08)",
        // ── Legacy static palette (keep for backward compat) ──
        logo:           "#7d8bb1",
        contentGray:    "#babdc2",
      },
      boxShadow: {
        app:       "var(--shadow)",
        "card":    "0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)",
        "card-lg": "0 4px 12px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.25)",
        "glow-cyan": "0 0 20px rgba(6,182,212,0.15), 0 0 60px rgba(6,182,212,0.05)",
        "glow-teal": "0 0 20px rgba(20,184,166,0.15), 0 0 60px rgba(20,184,166,0.05)",
        warm:      "0 4px 12px rgba(80,55,35,0.07), 0 1px 3px rgba(80,55,35,0.05)",
        "warm-md": "0 8px 24px rgba(80,55,35,0.10), 0 2px 6px rgba(80,55,35,0.06)",
        "warm-lg": "0 16px 48px rgba(80,55,35,0.13), 0 4px 12px rgba(80,55,35,0.07)",
      },
      borderRadius: {
        xl:  "var(--r-xl)",
        lg:  "var(--r-lg)",
        md:  "var(--r-md)",
      },
      fontFamily: {
        sans: ["DM Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        corporate: ["Inter", "DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        fancy: ["Space Grotesk", "DM Sans", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "score-ring": "conic-gradient(var(--ring-color) calc(var(--ring-pct) * 1%), transparent 0)",
      },
    },
  },
  plugins: [],
} satisfies Config;