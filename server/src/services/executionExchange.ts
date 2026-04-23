import crypto from 'crypto';

export type CapabilityPool = 'scorefix.run_pipeline' | 'audit.run' | 'citation.run';

export type ExecutionState = 'queued' | 'processing' | 'complete' | 'failed';

export type AgentExecutionProfile = {
    agentId: string;
    tenantId: string;
    successRate: number;
    avgPipelineQuality: number;
    retryFrequency: number;
    requestStability: number;
    resourceEfficiency: number;
    updatedAtMs: number;
};

export type ExecutionRequest = {
    requestId: string;
    agentId: string;
    tenantId: string;
    pool: CapabilityPool;
    urgencyWeight: number;
    createdAtMs: number;
    estimatedCost: number;
    payloadHash: string;
};

export type LatentPriorityInput = {
    request: ExecutionRequest;
    profile: AgentExecutionProfile;
    nowMs: number;
    fairnessBoost: number;
    jitterSeed?: string;
};

export type ExchangeConfig = {
    reputationHalfLifeHours: number;
    maxQueueJitterMs: number;
    fairnessMinBoost: number;
    fairnessMaxBoost: number;
};

export const DEFAULT_EXCHANGE_CONFIG: ExchangeConfig = {
    reputationHalfLifeHours: 24,
    maxQueueJitterMs: 700,
    fairnessMinBoost: 0.85,
    fairnessMaxBoost: 1.15,
};

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number(value || 0)));
}

function hashToUnitInterval(input: string): number {
    const hex = crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
    const asInt = parseInt(hex, 16);
    const max = 0xffffffffffff;
    return asInt / max;
}

export function exponentialDecayFactor(nowMs: number, updatedAtMs: number, halfLifeHours: number): number {
    const halfLifeMs = Math.max(1, halfLifeHours) * 60 * 60 * 1000;
    const elapsed = Math.max(0, nowMs - updatedAtMs);
    return Math.pow(0.5, elapsed / halfLifeMs);
}

export function decayProfile(profile: AgentExecutionProfile, nowMs: number, config = DEFAULT_EXCHANGE_CONFIG): AgentExecutionProfile {
    const decay = exponentialDecayFactor(nowMs, profile.updatedAtMs, config.reputationHalfLifeHours);

    const neutral = {
        successRate: 0.5,
        avgPipelineQuality: 0.5,
        retryFrequency: 0.5,
        requestStability: 0.5,
        resourceEfficiency: 0.5,
    };

    return {
        ...profile,
        successRate: clamp01((profile.successRate * decay) + (neutral.successRate * (1 - decay))),
        avgPipelineQuality: clamp01((profile.avgPipelineQuality * decay) + (neutral.avgPipelineQuality * (1 - decay))),
        retryFrequency: clamp01((profile.retryFrequency * decay) + (neutral.retryFrequency * (1 - decay))),
        requestStability: clamp01((profile.requestStability * decay) + (neutral.requestStability * (1 - decay))),
        resourceEfficiency: clamp01((profile.resourceEfficiency * decay) + (neutral.resourceEfficiency * (1 - decay))),
    };
}

export function computeLatentPriority(input: LatentPriorityInput): number {
    const profile = decayProfile(input.profile, input.nowMs);
    const urgency = clamp01(input.request.urgencyWeight);
    const success = clamp01(profile.successRate);
    const stability = clamp01(profile.requestStability);
    const fairness = clamp01(input.fairnessBoost);

    // Lower retryFrequency is better, so invert it.
    const retryBonus = 1 - clamp01(profile.retryFrequency);
    const efficiency = clamp01(profile.resourceEfficiency);

    const base =
        (urgency * 0.4) +
        (success * 0.2) +
        (stability * 0.15) +
        (retryBonus * 0.1) +
        (efficiency * 0.05) +
        (fairness * 0.1);

    const jitterSeed = input.jitterSeed || `${input.request.requestId}:${input.request.pool}:${input.nowMs}`;
    const deterministicNoise = (hashToUnitInterval(jitterSeed) - 0.5) * 0.03;

    return Math.max(0, base + deterministicNoise);
}

export function computeQueueDelayMs(requestId: string, maxQueueJitterMs = DEFAULT_EXCHANGE_CONFIG.maxQueueJitterMs): number {
    const noise = hashToUnitInterval(`queue-jitter:${requestId}`);
    return Math.floor(noise * Math.max(0, maxQueueJitterMs));
}

export function buildPublicExecutionState(status: ExecutionState): { status: ExecutionState } {
    return { status };
}

export function normalizeFairnessBoost(raw: number, config = DEFAULT_EXCHANGE_CONFIG): number {
    return Math.max(config.fairnessMinBoost, Math.min(config.fairnessMaxBoost, Number(raw || 1)));
}
