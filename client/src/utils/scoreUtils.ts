/**
 * Canonical score band system for the entire AiVIS platform.
 *
 * 5-band thresholds matching the Methodology page (A–F):
 *   80+ Excellent | 60-79 Good | 40-59 Fair | 20-39 Poor | 0-19 Critical
 *
 * EVERY component that maps a numeric score to a label, color, or CSS class
 * MUST import from this file instead of defining its own thresholds.
 */

// ── Band types ──────────────────────────────────────────────────────

export type ScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface ScoreBandInfo {
    band: ScoreBand;
    label: string;
    grade: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    badgeClass: string;
    chipClass: string;
    accentClass: string;
    barColor: string;
    hex: string;
    fillSoft: string;
}

// ── Canonical thresholds ────────────────────────────────────────────

const BANDS: readonly { min: number; info: ScoreBandInfo }[] = [
    {
        min: 80,
        info: {
            band: 'excellent',
            label: 'Excellent',
            grade: 'A',
            textColor: 'text-emerald-300',
            bgColor: 'bg-emerald-400',
            borderColor: 'border-emerald-400/20',
            badgeClass: 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20',
            chipClass: 'score-chip-excellent',
            accentClass: 'section-accent-emerald',
            barColor: 'bg-emerald-400',
            hex: '#34d399',
            fillSoft: 'rgba(52,211,153,0.06)',
        },
    },
    {
        min: 60,
        info: {
            band: 'good',
            label: 'Good',
            grade: 'B',
            textColor: 'text-green-300',
            bgColor: 'bg-green-400',
            borderColor: 'border-green-400/20',
            badgeClass: 'bg-green-400/10 text-green-300 border border-green-400/20',
            chipClass: 'score-chip-good',
            accentClass: 'section-accent-cyan',
            barColor: 'bg-cyan-400',
            hex: '#22d3ee',
            fillSoft: 'rgba(34,211,238,0.05)',
        },
    },
    {
        min: 40,
        info: {
            band: 'fair',
            label: 'Fair',
            grade: 'C',
            textColor: 'text-amber-300',
            bgColor: 'bg-amber-400',
            borderColor: 'border-amber-400/20',
            badgeClass: 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
            chipClass: 'score-chip-fair',
            accentClass: 'section-accent-amber',
            barColor: 'bg-amber-400',
            hex: '#fbbf24',
            fillSoft: 'rgba(251,191,36,0.05)',
        },
    },
    {
        min: 20,
        info: {
            band: 'poor',
            label: 'Poor',
            grade: 'D',
            textColor: 'text-orange-300',
            bgColor: 'bg-orange-400',
            borderColor: 'border-orange-400/20',
            badgeClass: 'bg-orange-400/10 text-orange-300 border border-orange-400/20',
            chipClass: 'score-chip-weak',
            accentClass: 'section-accent-orange',
            barColor: 'bg-orange-400',
            hex: '#f97316',
            fillSoft: 'rgba(249,115,22,0.06)',
        },
    },
    {
        min: 0,
        info: {
            band: 'critical',
            label: 'Critical',
            grade: 'F',
            textColor: 'text-red-300',
            bgColor: 'bg-red-400',
            borderColor: 'border-red-400/20',
            badgeClass: 'bg-red-400/10 text-red-300 border border-red-400/20',
            chipClass: 'score-chip-critical',
            accentClass: 'section-accent-rose',
            barColor: 'bg-rose-400',
            hex: '#fb7185',
            fillSoft: 'rgba(251,113,133,0.06)',
        },
    },
] as const;

// ── Public API ──────────────────────────────────────────────────────

/** Get the full band info for a numeric score (0-100). */
export function getScoreBand(score: number): ScoreBandInfo {
    const clamped = Math.max(0, Math.min(100, score));
    for (const b of BANDS) {
        if (clamped >= b.min) return b.info;
    }
    return BANDS[BANDS.length - 1].info;
}

/** Short label: "Excellent" | "Good" | "Fair" | "Poor" | "Critical" */
export function getScoreLabel(score: number): string {
    return getScoreBand(score).label;
}

/** Letter grade: "A" | "B" | "C" | "D" | "F" */
export function getScoreGrade(score: number): string {
    return getScoreBand(score).grade;
}

/** Tailwind text color class for the score. */
export function getScoreColor(score: number): string {
    return getScoreBand(score).textColor;
}

/** Tailwind chip CSS class for the score. */
export function getScoreChipClass(score: number): string {
    return getScoreBand(score).chipClass;
}

/** Section accent CSS class for the score. */
export function getScoreAccentClass(score: number): string {
    return getScoreBand(score).accentClass;
}

/** Badge CSS class string for the score. */
export function getScoreBadgeClass(score: number): string {
    return getScoreBand(score).badgeClass;
}

/** Bar color CSS class for the score. */
export function getScoreBarColor(score: number): string {
    return getScoreBand(score).barColor;
}

/** Hex color string for chart use. */
export function getScoreHex(score: number): string {
    return getScoreBand(score).hex;
}

/** Soft fill for chart backgrounds. */
export function getScoreFillSoft(score: number): string {
    return getScoreBand(score).fillSoft;
}

// ── CITE LEDGER verdict (used in Dashboard, ComprehensiveAnalysis) ──

export function getCitationVerdict(score: number): { label: string; color: string } {
    if (score >= 80) return { label: 'Citation-ready with minor gaps', color: 'text-emerald-300' };
    if (score >= 65) return { label: 'Readable, but still missing trust signals', color: 'text-amber-300' };
    if (score >= 40) return { label: 'Not citation-ready yet', color: 'text-rose-300' };
    return { label: 'Critical visibility blockers detected', color: 'text-rose-400' };
}

// ── Execution class badges ──────────────────────────────────────────

export function getExecutionBadge(cls: string): { label: string; cn: string } {
    if (cls === 'LIVE') return { label: 'CITE LEDGER — Live Pipeline', cn: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300' };
    if (cls === 'DETERMINISTIC_FALLBACK') return { label: 'CITE LEDGER — Evidence Scoring', cn: 'border-amber-500/35 bg-amber-500/10 text-amber-300' };
    if (cls === 'SCRAPE_ONLY') return { label: 'SCRAPE-ONLY', cn: 'border-red-500/35 bg-red-500/10 text-red-300' };
    return { label: 'UPLOAD', cn: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300' };
}
