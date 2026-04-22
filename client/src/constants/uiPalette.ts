export const CHART_PALETTE = {
  orange: '#ff8a3d',
  orangeDeep: '#ef6a1b',
  orangeSoft: 'rgba(255,138,61,0.22)',
  cyan: '#56c3b6',
  cyanDeep: '#2d8f84',
  cyanSoft: 'rgba(86,195,182,0.16)',
  amber: '#f4b860',
  amberDeep: '#db9f42',
  amberSoft: 'rgba(244,184,96,0.18)',
  indigo: '#d17f7a',
  indigoDeep: '#b96460',
  indigoSoft: 'rgba(209,127,122,0.16)',
  rose: '#ff6f61',
  emerald: '#52c98f',
  /* chart utility */
  lineStroke: 'rgba(249,115,22,0.18)',
  lineStrokeAlt: 'rgba(34,211,238,0.18)',
  tick: 'rgba(255,255,255,0.78)',
  tickMuted: 'rgba(255,255,255,0.50)',
  tooltipBg: 'rgba(24,18,15,0.96)',
  tooltipBorder: 'rgba(255,138,61,0.32)',
  tooltipBorderAlt: 'rgba(86,195,182,0.24)',
  tooltipShadow: '0 20px 40px rgba(255,138,61,0.12), 0 8px 20px rgba(0,0,0,0.48)',
  bandExcellent: 'rgba(52,211,153,0.06)',
  bandGood: 'rgba(34,211,238,0.05)',
  bandFair: 'rgba(251,191,36,0.05)',
  bandPoor: 'rgba(249,115,22,0.06)',
  bandCritical: 'rgba(251,113,133,0.06)',
  /* legacy aliases kept for existing charts */
  violet: '#d17f7a',
  violetDeep: '#b96460',
} as const;

export const PLATFORM_PALETTE = {
  chatgpt: {
    fill: '#63ccb2',
    fillSoft: 'rgba(99,204,178,0.16)',
    border: 'rgba(99,204,178,0.34)',
    gradient: 'from-teal-300 via-emerald-300 to-teal-500',
  },
  perplexity: {
    fill: '#d17f7a',
    fillSoft: 'rgba(209,127,122,0.16)',
    border: 'rgba(209,127,122,0.34)',
    gradient: 'from-rose-300 via-orange-300 to-rose-500',
  },
  google_ai: {
    fill: '#f5b942',
    fillSoft: 'rgba(245,185,66,0.16)',
    border: 'rgba(245,185,66,0.36)',
    gradient: 'from-amber-300 via-orange-300 to-yellow-400',
  },
  claude: {
    fill: '#ff6f61',
    fillSoft: 'rgba(255,111,97,0.16)',
    border: 'rgba(255,111,97,0.34)',
    gradient: 'from-orange-300 via-rose-300 to-red-400',
  },
  /* Score-band colors */
  excellent: { fill: '#34d399', fillSoft: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.35)', gradient: 'from-emerald-300 via-teal-300 to-emerald-500' },
  good: { fill: '#56c3b6', fillSoft: 'rgba(86,195,182,0.15)', border: 'rgba(86,195,182,0.35)', gradient: 'from-teal-300 via-emerald-300 to-teal-500' },
  fair: { fill: '#fbbf24', fillSoft: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.35)', gradient: 'from-amber-300 via-yellow-300 to-amber-500' },
  poor: { fill: '#f97316', fillSoft: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', gradient: 'from-orange-300 via-amber-300 to-orange-500' },
  critical: { fill: '#fb7185', fillSoft: 'rgba(251,113,133,0.15)', border: 'rgba(251,113,133,0.35)', gradient: 'from-rose-400 via-red-300 to-pink-500' },
} as const;

export const TIER_BRAND_PALETTE = {
  observer: {
    gradient: 'from-stone-300 via-amber-300 to-orange-300',
    border: 'border-amber-300/35',
    glow: 'shadow-amber-500/25',
  },
  starter: {
    gradient: 'from-emerald-300 via-teal-300 to-emerald-500',
    border: 'border-teal-300/40',
    glow: 'shadow-teal-500/25',
  },
  alignment: {
    gradient: 'from-amber-300 via-orange-300 to-rose-300',
    border: 'border-orange-300/40',
    glow: 'shadow-orange-500/25',
  },
  signal: {
    gradient: 'from-orange-400 via-rose-400 to-red-400',
    border: 'border-rose-300/45',
    glow: 'shadow-rose-500/30',
  },
  scorefix: {
    gradient: 'from-amber-400 via-orange-400 to-rose-400',
    border: 'border-amber-300/45',
    glow: 'shadow-amber-500/30',
  },
} as const;
