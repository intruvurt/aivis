export const CHART_PALETTE = {
  /* Core brand — now warm-aligned to match logo:
     Deep navy bg + White text + Warm orange/amber primary + Cyan secondary + Indigo accent */
  orange: '#f97316',
  orangeDeep: '#ea6305',
  orangeSoft: 'rgba(249,115,22,0.22)',
  cyan: '#22d3ee',
  cyanDeep: '#0891b2',
  cyanSoft: 'rgba(34,211,238,0.18)',
  amber: '#fbbf24',
  amberDeep: '#f59e0b',
  amberSoft: 'rgba(251,191,36,0.20)',
  indigo: '#818cf8',
  indigoDeep: '#6366f1',
  indigoSoft: 'rgba(129,140,248,0.20)',
  rose: '#fb7185',
  emerald: '#34d399',
  /* chart utility */
  lineStroke: 'rgba(249,115,22,0.18)',
  lineStrokeAlt: 'rgba(34,211,238,0.18)',
  tick: 'rgba(255,255,255,0.78)',
  tickMuted: 'rgba(255,255,255,0.50)',
  tooltipBg: 'rgba(10,14,28,0.95)',
  tooltipBorder: 'rgba(249,115,22,0.35)',
  tooltipBorderAlt: 'rgba(34,211,238,0.30)',
  tooltipShadow: '0 20px 40px rgba(249,115,22,0.14), 0 8px 20px rgba(10,14,28,0.60)',
  bandExcellent: 'rgba(52,211,153,0.06)',
  bandGood: 'rgba(34,211,238,0.05)',
  bandFair: 'rgba(251,191,36,0.05)',
  bandPoor: 'rgba(249,115,22,0.06)',
  bandCritical: 'rgba(251,113,133,0.06)',
  /* legacy aliases kept for existing charts */
  violet: '#818cf8',
  violetDeep: '#6366f1',
} as const;

export const PLATFORM_PALETTE = {
  chatgpt: {
    fill: '#5eead4',
    fillSoft: 'rgba(94,234,212,0.16)',
    border: 'rgba(94,234,212,0.36)',
    gradient: 'from-cyan-300 via-emerald-300 to-cyan-500',
  },
  perplexity: {
    fill: '#a78bfa',
    fillSoft: 'rgba(167,139,250,0.16)',
    border: 'rgba(167,139,250,0.36)',
    gradient: 'from-violet-300 via-fuchsia-300 to-violet-500',
  },
  google_ai: {
    fill: '#f5b942',
    fillSoft: 'rgba(245,185,66,0.16)',
    border: 'rgba(245,185,66,0.36)',
    gradient: 'from-amber-300 via-orange-300 to-yellow-400',
  },
  claude: {
    fill: '#fb7185',
    fillSoft: 'rgba(251,113,133,0.16)',
    border: 'rgba(251,113,133,0.36)',
    gradient: 'from-rose-300 via-orange-300 to-pink-400',
  },
  /* Score-band colors */
  excellent: { fill: '#34d399', fillSoft: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.35)', gradient: 'from-emerald-300 via-teal-300 to-emerald-500' },
  good:      { fill: '#22d3ee', fillSoft: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.35)', gradient: 'from-cyan-300 via-sky-300 to-cyan-500' },
  fair:      { fill: '#fbbf24', fillSoft: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  gradient: 'from-amber-300 via-yellow-300 to-amber-500' },
  poor:      { fill: '#f97316', fillSoft: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', gradient: 'from-orange-300 via-amber-300 to-orange-500' },
  critical:  { fill: '#fb7185', fillSoft: 'rgba(251,113,133,0.15)', border: 'rgba(251,113,133,0.35)', gradient: 'from-rose-400 via-red-300 to-pink-500' },
} as const;

export const TIER_BRAND_PALETTE = {
  observer: {
    gradient: 'from-slate-400 via-cyan-400 to-blue-400',
    border: 'border-cyan-300/35',
    glow: 'shadow-cyan-500/25',
  },
  alignment: {
    gradient: 'from-cyan-400 via-sky-400 to-indigo-400',
    border: 'border-sky-300/40',
    glow: 'shadow-sky-500/25',
  },
  signal: {
    gradient: 'from-blue-500 via-violet-500 to-fuchsia-500',
    border: 'border-violet-300/45',
    glow: 'shadow-violet-500/30',
  },
  scorefix: {
    gradient: 'from-amber-400 via-orange-400 to-rose-400',
    border: 'border-amber-300/45',
    glow: 'shadow-amber-500/30',
  },
} as const;
