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
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        }
      },
      animation: {
        "scan": "scan-line 3s linear infinite",
        "shimmer": "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;