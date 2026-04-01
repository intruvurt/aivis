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

        // ── Sanguine / warm accent static aliases ──
        sanguine:       "#B05146",   // muted terracotta — primary actions
        "sanguine-dk":  "#8F3D34",   // deep sanguine — hover
        olivo:          "#82AF28",   // olive-lime — positive / feature accent
        "olivo-dk":     "#6A911E",   // deep olive — hover
        "coral-warm":   "#E16E55",   // warm coral — secondary accent
        "amber-warm":   "#CC9B2A",   // amber-honey — warning / highlight
        // ── Panel / surface tokens ──
        linen:          "#F9F7F4",   // base off-white
        "linen-2":      "#F3F0EC",   // slightly warmer
        "linen-3":      "#E8E2DA",   // warm grey
        "warm-border":  "#B4A494",   // warm stone border
        "warm-shadow":  "rgba(80,55,35,0.08)",
        // ── Legacy static palette (keep for backward compat) ──
        logo:           "#7d8bb1",
        contentGray:    "#babdc2",
      },
      boxShadow: {
        app:    "var(--shadow)",
        warm:   "0 4px 12px rgba(80,55,35,0.07), 0 1px 3px rgba(80,55,35,0.05)",
        "warm-md": "0 8px 24px rgba(80,55,35,0.10), 0 2px 6px rgba(80,55,35,0.06)",
        "warm-lg": "0 16px 48px rgba(80,55,35,0.13), 0 4px 12px rgba(80,55,35,0.07)",
      },
      borderRadius: {
        xl: "var(--r-xl)",
        lg: "var(--r-lg)",
        md: "var(--r-md)",
      },
      fontFamily: {
        sans: ["DM Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        corporate: ["Inter", "DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        fancy: ["Space Grotesk", "DM Sans", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;