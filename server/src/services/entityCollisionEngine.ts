import {
    searchUnifiedVectorSurface,
    updateEntityScores,
    upsertEntityCollision,
} from './entityService.js';

export type VectorPoint = {
    id: string;
    entity_id: string;
    type: 'entity' | 'variant' | 'evidence';
    embedding: number[];
    weight: number;
    metadata: Record<string, unknown>;
    similarity: number;
};

export type SemanticCluster = {
    id: string;
    points: VectorPoint[];
};

type CollisionAnalysisInput = {
    entityId: string;
    embedding: number[];
    radius?: number;
    maxPoints?: number;
    minClusterSize?: number;
};

function cosineDistance(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 1;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (!Number.isFinite(denom) || denom <= 1e-9) return 1;
    const similarity = Math.max(-1, Math.min(1, dot / denom));
    return 1 - similarity;
}

function neighborsWithin(points: VectorPoint[], pointIndex: number, eps: number): number[] {
    const base = points[pointIndex];
    const out: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
        if (i === pointIndex) continue;
        if (cosineDistance(base.embedding, points[i].embedding) <= eps) out.push(i);
    }
    return out;
}

// Density-based clustering (DBSCAN-style) for local neighborhoods.
function clusterPoints(points: VectorPoint[], eps: number, minPts: number): SemanticCluster[] {
    const visited = new Set<number>();
    const assigned = new Set<number>();
    const clusters: SemanticCluster[] = [];

    for (let i = 0; i < points.length; i += 1) {
        if (visited.has(i)) continue;
        visited.add(i);

        const seedNeighbors = neighborsWithin(points, i, eps);
        if (seedNeighbors.length + 1 < minPts) continue;

        const clusterIndices = new Set<number>([i]);
        const queue = [...seedNeighbors];

        while (queue.length > 0) {
            const idx = queue.shift() as number;
            if (!visited.has(idx)) {
                visited.add(idx);
                const n = neighborsWithin(points, idx, eps);
                if (n.length + 1 >= minPts) {
                    queue.push(...n.filter((value) => !queue.includes(value)));
                }
            }
            if (!assigned.has(idx)) {
                clusterIndices.add(idx);
            }
        }

        const clusterId = `cluster-${clusters.length + 1}`;
        const clusterPointsList = Array.from(clusterIndices).map((idx) => points[idx]);
        for (const idx of clusterIndices) assigned.add(idx);
        clusters.push({ id: clusterId, points: clusterPointsList });
    }

    return clusters;
}

function detectFragmentation(entityId: string, clusters: SemanticCluster[]) {
    const spread = clusters
        .filter((cluster) => cluster.points.some((point) => point.entity_id === entityId))
        .map((cluster) => cluster.id);
    return {
        fragmentation: spread.length > 1,
        cluster_spread: spread.length,
        cluster_ids: spread,
    };
}

function computeCollisionScore(entityId: string, clusters: SemanticCluster[]): number {
    const relatedClusters = clusters.filter((cluster) =>
        cluster.points.some((point) => point.entity_id === entityId),
    );

    if (relatedClusters.length === 0) return 0;

    const density = relatedClusters.length;
    const overlap = relatedClusters.reduce((acc, cluster) => {
        const entityWeight = cluster.points
            .filter((point) => point.entity_id === entityId)
            .reduce((sum, point) => sum + point.weight, 0);
        const clusterWeight = cluster.points.reduce((sum, point) => sum + point.weight, 0) || 1;
        return acc + (entityWeight / clusterWeight);
    }, 0);

    return Math.min(1, (density * 0.4 + overlap * 0.6) / Math.max(1, relatedClusters.length));
}

export async function runSemanticCollisionAnalysis(input: CollisionAnalysisInput): Promise<{
    points: VectorPoint[];
    clusters: SemanticCluster[];
    primary_cluster: string | null;
    conflicting_entities: string[];
    fragmentation: boolean;
    collision_score: number;
}> {
    const radius = Math.max(0.01, Math.min(input.radius ?? 0.22, 0.6));
    const maxPoints = Math.max(20, Math.min(input.maxPoints ?? 220, 600));
    const minClusterSize = Math.max(2, Math.min(input.minClusterSize ?? 3, 12));

    const points = await searchUnifiedVectorSurface(input.embedding, {
        limitEntities: Math.ceil(maxPoints * 0.25),
        limitVariants: Math.ceil(maxPoints * 0.4),
        limitEvidence: Math.ceil(maxPoints * 0.35),
        minSimilarity: Math.max(0, 1 - radius),
    });

    const anchoredPoints = points
        .filter((point) => point.embedding.length > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxPoints);

    const clusters = clusterPoints(anchoredPoints, radius, minClusterSize);
    const primaryCluster = clusters.find((cluster) => cluster.points.some((point) => point.entity_id === input.entityId)) || null;

    const conflictingEntities = primaryCluster
        ? Array.from(new Set(primaryCluster.points
            .map((point) => point.entity_id)
            .filter((entityId) => entityId !== input.entityId)))
        : [];

    const collisionScore = computeCollisionScore(input.entityId, clusters);
    const fragmentationState = detectFragmentation(input.entityId, clusters);

    for (const targetEntityId of conflictingEntities.slice(0, 8)) {
        await upsertEntityCollision(input.entityId, targetEntityId, {
            collision_type: 'semantic',
            severity: Math.max(0.05, Math.min(0.99, collisionScore)),
            shared_signals: {
                radius,
                primary_cluster: primaryCluster?.id || null,
                fragmentation: fragmentationState.fragmentation,
                cluster_spread: fragmentationState.cluster_spread,
            },
        });
    }

    await updateEntityScores(input.entityId, {
        collision_score: Math.round(collisionScore * 100),
    });

    return {
        points: anchoredPoints,
        clusters,
        primary_cluster: primaryCluster?.id || null,
        conflicting_entities: conflictingEntities,
        fragmentation: fragmentationState.fragmentation,
        collision_score: collisionScore,
    };
}
