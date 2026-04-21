import type { CanonicalTier } from '../../../shared/types.js';

export const SYSTEM_CONFIG = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

    bix: {
        enabled: process.env.BIX_ENABLED !== 'false',
        defaultIntervalMs: 3_600_000,
        adaptiveScheduling: true,
        maxConcurrentScans: 5,
    },

    citation: {
        engines: ['ddg', 'bing', 'instant', 'wikipedia'] as const,
        requireMultiEngineAgreement: true,
        minConfidenceThreshold: 0.72,
    },

    ai: {
        timeoutMs: 25_000,
        fallbackEnabled: true,
        maxRetries: 2,
        enforceJsonOutput: true,
        strictTimeout: true,
        maxTokenBudget: {
            ai1: 5_000,
            ai2: 600,
            ai3: 400,
        },
    },

    ledger: {
        immutableWrites: true,
        hashLock: true,
    },

    streaming: {
        sseEnabled: true,
        batchIntervalMs: 500,
    },
} as const;

export const FEATURES = {
    AGENCY_DASHBOARD: true,
    BULK_FIX: true,
    BIX_SCHEDULER: true,
    REALTIME_HEATMAP: true,
    CITATION_LEDGER_V2: true,
    AUTO_PR_FIX: true,
} as const;

export const OBSERVABILITY = {
    logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),
    trackBixEvents: true,
    trackCitationFailures: true,
    trackAIProviderLatency: true,
} as const;

export const CITATION_POLICY = {
    minEnginesRequired: 2,
    requireURLMatch: true,
    rejectSingleSourceClaims: true,
    enforceLedgerWrite: true,
} as const;

export const SCHEDULER_CONFIG = {
    adaptiveBix: true,
    tiers: {
        observer: 86_400_000,
        starter: 86_400_000,
        alignment: 43_200_000,
        signal: 3_600_000,
        scorefix: 3_600_000,
        agency: 1_800_000,
    } satisfies Record<CanonicalTier, number>,
    jitterMs: 120_000,
} as const;

export const ENV = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    BIX_ENABLED: process.env.BIX_ENABLED === 'true' || process.env.BIX_ENABLED == null,
    QUEUE_MODE: process.env.QUEUE_MODE || 'redis',
    AI_STRICT_MODE: process.env.AI_STRICT_MODE !== 'false',
} as const;

export type FeatureFlag = keyof typeof FEATURES;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
    return FEATURES[flag] === true;
}
