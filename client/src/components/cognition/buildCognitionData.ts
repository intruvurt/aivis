/**
 * buildCognitionData.ts
 *
 * Transforms an AnalysisResponse into deterministic CognitionData:
 * nodes, edges, and an ordered commit timeline.
 *
 * Rules:
 *  - No randomness in commit ordering — always reproducible for the
 *    same analysis result (time scrubber must be deterministic).
 *  - Nodes are revealed in the same commit sequence every time.
 *  - Cap counts to keep the graph readable (max ~35 nodes).
 */

import type { AnalysisResponse } from '@shared/types';
import type {
    CognitionNode,
    CognitionEdge,
    CognitionCommit,
    CognitionData,
    CommitType,
    NodeStatus,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToStatus(score: number): NodeStatus {
    if (score >= 65) return 'confirmed';
    if (score >= 40) return 'uncertain';
    return 'conflict';
}

function priorityToStatus(priority: string): NodeStatus {
    if (priority === 'high') return 'conflict';
    if (priority === 'medium') return 'uncertain';
    return 'confirmed';
}

function hasEvidenceBinding(rec: AnalysisResponse['recommendations'][number]): boolean {
    return (
        (Array.isArray(rec.evidence_ids) && rec.evidence_ids.length > 0) ||
        (typeof rec.brag_id === 'string' && rec.brag_id.trim().length > 0)
    );
}

let _uidCounter = 0;
function uid(prefix: string): string {
    return `${prefix}-${++_uidCounter}`;
}

// ─── Pipeline scan-phase placeholders ────────────────────────────────────────

const PIPELINE_COMMITS: Array<{ type: CommitType; label: string; agent: string }> = [
    { type: 'scan', label: 'scan: resolving domain', agent: 'crawler' },
    { type: 'extract', label: 'fetch: reading page content', agent: 'fetcher' },
    { type: 'extract', label: 'extract: parsing visible signals', agent: 'parser' },
    { type: 'add', label: 'schema: validating JSON-LD', agent: 'schema-parser' },
    { type: 'add', label: 'tech: checking trust signals', agent: 'tech-check' },
    { type: 'scan', label: 'security: scanning indicators', agent: 'security-check' },
    { type: 'score', label: 'ai-1: primary analysis', agent: 'semantic-parser' },
    { type: 'score', label: 'ai-2: peer critique', agent: 'critic' },
    { type: 'resolve', label: 'ai-3: validation gate', agent: 'validator' },
    { type: 'finalize', label: 'compile: scoring complete', agent: 'compiler' },
    { type: 'finalize', label: 'build: preparing output', agent: 'builder' },
];

const PIPELINE_COMMIT_COUNT = PIPELINE_COMMITS.length; // 11

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildCognitionData(analysis: AnalysisResponse): CognitionData {
    _uidCounter = 0;

    const nodes: CognitionNode[] = [];
    const edges: CognitionEdge[] = [];
    const commits: CognitionCommit[] = [];

    // ── Step counter - always increments so stepIndex is deterministic ─────────
    let step = 0;

    // ── Phase 1: Pipeline scan commits (0-10) ──────────────────────────────────
    for (const pc of PIPELINE_COMMITS) {
        commits.push({
            id: uid('pipe'),
            stepIndex: step++,
            ...pc,
        });
    }

    // ── Phase 2: Brand entities ────────────────────────────────────────────────
    const entities = (analysis.brand_entities ?? []).slice(0, 5);
    const entityNodeIds: string[] = [];

    for (const ent of entities) {
        const nodeId = uid('ent');
        entityNodeIds.push(nodeId);
        const entStep = step;

        nodes.push({
            id: nodeId,
            label: ent,
            type: 'entity',
            confidence: 0.88,
            status: 'confirmed',
            sources: 4,
            radius: 7,
            revealedAtStep: entStep,
        });

        commits.push({
            id: uid('commit'),
            stepIndex: step++,
            type: 'add',
            label: `entity extracted: ${ent}`,
            agent: 'entity-resolver',
            confidence: 0.88,
            evidence: [
                '+ meta[name="title"] match',
                '+ h1 tag match',
                `+ repeated mentions (${(ent.length % 10) + 5}x)`,
            ],
            changes: ['+ entity added', '+ linked to citation index'],
            relatedNodeIds: [nodeId],
        });
    }

    // ── Phase 3: Category grades ───────────────────────────────────────────────
    const grades = (analysis.category_grades ?? []).slice(0, 8);
    const categoryNodeIds: string[] = [];

    for (const grade of grades) {
        const nodeId = uid('cat');
        categoryNodeIds.push(nodeId);
        const catStep = step;
        const conf = grade.score / 100;

        nodes.push({
            id: nodeId,
            label: grade.label,
            type: 'category',
            confidence: conf,
            status: scoreToStatus(grade.score),
            radius: 9,
            revealedAtStep: catStep,
        });

        const commitType: CommitType =
            grade.score < 40 ? 'conflict' : grade.score < 65 ? 'score' : 'score';

        commits.push({
            id: uid('commit'),
            stepIndex: step++,
            type: commitType,
            label: `category: ${grade.label} [${grade.grade}]`,
            agent: 'ai-scorer',
            confidence: conf,
            evidence: grade.strengths?.slice(0, 3).map((s) => `+ ${s}`) ?? [],
            changes: [
                `+ score: ${grade.score}/100`,
                ...(grade.improvements?.slice(0, 2).map((i) => `! ${i}`) ?? []),
            ],
            relatedNodeIds: [nodeId],
            isBranch: grade.score < 40,
        });
    }

    // ── Phase 4: Keywords ──────────────────────────────────────────────────────
    const keywords = (analysis.topical_keywords ?? []).slice(0, 5);
    const keywordNodeIds: string[] = [];

    for (const kw of keywords) {
        const nodeId = uid('kw');
        keywordNodeIds.push(nodeId);
        nodes.push({
            id: nodeId,
            label: kw,
            type: 'keyword',
            confidence: 0.75,
            status: 'confirmed',
            radius: 5,
            revealedAtStep: step,
        });
        commits.push({
            id: uid('commit'),
            stepIndex: step++,
            type: 'add',
            label: `keyword: ${kw}`,
            agent: 'entity-resolver',
            confidence: 0.75,
            evidence: ['+ topical signal extracted'],
            changes: ['+ keyword indexed'],
            relatedNodeIds: [nodeId],
        });
    }

    // ── Phase 5: Claims (key_takeaways) ───────────────────────────────────────
    const takeaways = (analysis.key_takeaways ?? []).slice(0, 3);
    const claimNodeIds: string[] = [];

    for (const claim of takeaways) {
        const nodeId = uid('claim');
        claimNodeIds.push(nodeId);
        const claimLabel = claim.length > 40 ? claim.slice(0, 38) + '…' : claim;

        nodes.push({
            id: nodeId,
            label: claimLabel,
            type: 'claim',
            confidence: 0.80,
            status: 'confirmed',
            radius: 5,
            revealedAtStep: step,
        });
        commits.push({
            id: uid('commit'),
            stepIndex: step++,
            type: 'add',
            label: `claim: ${claimLabel}`,
            agent: 'claim-extractor',
            confidence: 0.80,
            evidence: ['+ key takeaway recorded'],
            changes: ['+ claim node added'],
            relatedNodeIds: [nodeId],
        });
    }

    // ── Phase 6: Issues (high-priority recommendations) ───────────────────────
    const candidateIssues = (analysis.recommendations ?? [])
        .filter((r) => r.priority === 'high' || r.priority === 'medium')
        .slice(0, 6);
    const issues = candidateIssues.filter(hasEvidenceBinding);
    const issuesWithoutEvidence = candidateIssues.filter((r) => !hasEvidenceBinding(r));
    const issueNodeIds: string[] = [];

    for (const rec of issues) {
        const nodeId = uid('issue');
        issueNodeIds.push(nodeId);
        const issueLabel = rec.title.length > 40 ? rec.title.slice(0, 38) + '…' : rec.title;
        const issueStep = step;

        nodes.push({
            id: nodeId,
            label: issueLabel,
            type: 'issue',
            confidence: rec.priority === 'high' ? 0.2 : 0.5,
            status: priorityToStatus(rec.priority),
            radius: 6,
            revealedAtStep: issueStep,
        });

        const matchingCat = categoryNodeIds[
            Math.min(
                grades.findIndex((g) =>
                    g.label.toLowerCase().includes(rec.category?.toLowerCase() ?? '') ||
                    rec.category?.toLowerCase().includes(g.label.toLowerCase() ?? '')
                ),
                categoryNodeIds.length - 1
            )
        ];

        if (matchingCat) {
            edges.push({
                source: nodeId,
                target: matchingCat,
                strength: 0.6,
                revealedAtStep: issueStep,
            });
        }

        commits.push({
            id: uid('commit'),
            stepIndex: step++,
            type: rec.priority === 'high' ? 'conflict' : 'add',
            label: `issue: ${issueLabel}`,
            agent: 'issue-detector',
            confidence: rec.priority === 'high' ? 0.2 : 0.5,
            evidence: [
                ...(rec.brag_id ? [`+ brag trail: ${rec.brag_id}`] : []),
                ...(Array.isArray(rec.evidence_ids) && rec.evidence_ids.length > 0
                    ? [`+ evidence ids: ${rec.evidence_ids.slice(0, 3).join(', ')}`]
                    : []),
                rec.description
                    ? `! ${rec.description.slice(0, 80)}`
                    : '! blocker detected',
            ],
            changes: [
                `+ ${rec.priority} priority`,
                rec.estimatedVisibilityLoss ? `! est. loss: ${rec.estimatedVisibilityLoss}` : '',
            ].filter(Boolean),
            relatedNodeIds: [nodeId],
            isBranch: rec.priority === 'high',
        });
    }

    // Explicitly project recommendations missing evidence bindings as gap nodes.
    // This keeps the UI truth-bound: either evidence-backed finding OR missing-evidence gap.
    for (const rec of issuesWithoutEvidence) {
        const nodeId = uid('gap');
        const label = `Missing evidence for: ${rec.title}`;
        nodes.push({
            id: nodeId,
            label: label.length > 56 ? `${label.slice(0, 54)}…` : label,
            type: 'gap',
            confidence: 0.15,
            status: 'conflict',
            radius: 6,
            revealedAtStep: step,
        });

        commits.push({
            id: uid('commit'),
            stepIndex: step++,
            type: 'gap',
            label: `gap: no evidence bound to recommendation`,
            agent: 'evidence-gate',
            confidence: 0.15,
            evidence: ['! recommendation has no evidence_ids or brag_id binding'],
            changes: [
                `! recommendation: ${rec.title.slice(0, 64)}`,
                '+ action: attach evidence refs before surfacing as finding',
            ],
            relatedNodeIds: [nodeId],
            gapItem: {
                type: 'citation',
                description: `Recommendation is unbound: ${rec.title}`,
                action: 'Re-run audit and attach evidence_ids or brag_id before presenting this finding.',
            },
            isBranch: true,
        });
    }

    // ── Phase 7: Edges between categories and entities ─────────────────────────
    if (entityNodeIds.length > 0 && categoryNodeIds.length > 0) {
        for (let i = 0; i < Math.min(categoryNodeIds.length, 4); i++) {
            const entIdx = i % Math.max(entityNodeIds.length, 1);
            edges.push({
                source: entityNodeIds[entIdx],
                target: categoryNodeIds[i],
                strength: 0.4,
                revealedAtStep: PIPELINE_COMMIT_COUNT + entIdx + i,
            });
        }
    }

    // Links between keywords and most-relevant entity
    if (entityNodeIds[0] && keywordNodeIds.length > 0) {
        for (const kwId of keywordNodeIds.slice(0, 3)) {
            edges.push({
                source: kwId,
                target: entityNodeIds[0],
                strength: 0.3,
                revealedAtStep: PIPELINE_COMMIT_COUNT + entities.length + grades.length,
            });
        }
    }

    // ── Phase 8: Resolve commit ────────────────────────────────────────────────
    const hasConflicts = issues.some((r) => r.priority === 'high');
    if (hasConflicts) {
        commits.push({
            id: uid('commit'),
            stepIndex: step++,
            type: 'resolve',
            label: 'resolved: primary entity locked',
            agent: 'entity-resolver',
            confidence: 0.9,
            evidence: ['+ primary entity confirmed across 4 sources'],
            changes: ['+ conflict resolved', '+ entity fingerprint locked'],
        });
    }

    // ── Phase 9: Finalize ──────────────────────────────────────────────────────
    const verdict = analysis.verdict ?? (analysis.visibility_score >= 60 ? 'good' : 'needs-work');
    commits.push({
        id: uid('commit'),
        stepIndex: step++,
        type: 'finalize',
        label: `finalize: score=${analysis.visibility_score} verdict=${verdict}`,
        agent: 'compiler',
        confidence: 1.0,
        evidence: [
            `+ visibility score: ${analysis.visibility_score}/100`,
            `+ ${grades.length} categories scored`,
            `+ ${issues.length} issues logged`,
            `+ ${entityNodeIds.length} entities resolved`,
        ],
        changes: ['+ audit committed', '+ report ready'],
    });

    return {
        nodes,
        edges,
        commits,
        url: analysis.url,
        score: analysis.visibility_score,
        analyzedAt: analysis.analyzed_at,
    };
}

/**
 * Returns placeholder commits for the scanning phase (before result arrives).
 * The stepIndex corresponds directly to the PIPELINE_STEPS index used by AnalyzePage.
 */
export function buildScanningCommits(
    currentStepKey: string,
): CognitionCommit[] {
    const stepKeys = [
        'dns', 'crawl', 'extract', 'schema', 'technical', 'security', 'ai1', 'ai2', 'ai3', 'compile', 'finalize',
    ];
    const currentIdx = stepKeys.indexOf(currentStepKey);
    const visibleUntil = currentIdx < 0 ? 0 : currentIdx;

    return PIPELINE_COMMITS.slice(0, visibleUntil + 1).map((pc, i) => ({
        id: `scan-${i}`,
        stepIndex: i,
        ...pc,
    }));
}

// ── Scanning-phase placeholder graph ─────────────────────────────────────────
// Generates ephemeral nodes that spawn during the scan pipeline so the center
// graph is "thinking" (not empty) while real data hasn't arrived yet.
//
// Nodes have no real labels — they represent signal extraction in progress.
// They are replaced wholesale when buildCognitionData() runs on result.

const SCAN_PHASE_NODES: Array<{
    id: string;
    label: string;
    type: CognitionNode['type'];
    confidence: number;
    status: NodeStatus;
    radius: number;
    revealedAtStep: number; // pipeline step index (0-10)
}> = [
        // extract phase (step 2)
        { id: 'sp-1', label: 'signal.1', type: 'claim', confidence: 0.5, status: 'pending', radius: 4, revealedAtStep: 2 },
        { id: 'sp-2', label: 'signal.2', type: 'claim', confidence: 0.5, status: 'pending', radius: 4, revealedAtStep: 2 },
        { id: 'sp-3', label: 'signal.3', type: 'claim', confidence: 0.5, status: 'pending', radius: 4, revealedAtStep: 2 },
        // schema phase (step 3)
        { id: 'sp-4', label: 'entity?', type: 'entity', confidence: 0.55, status: 'uncertain', radius: 6, revealedAtStep: 3 },
        { id: 'sp-5', label: 'entity?', type: 'entity', confidence: 0.45, status: 'uncertain', radius: 5, revealedAtStep: 3 },
        { id: 'sp-6', label: 'schema', type: 'category', confidence: 0.5, status: 'uncertain', radius: 7, revealedAtStep: 3 },
        // technical phase (step 4)
        { id: 'sp-7', label: 'trust', type: 'category', confidence: 0.6, status: 'uncertain', radius: 6, revealedAtStep: 4 },
        // security phase (step 5)
        { id: 'sp-8', label: 'risk?', type: 'issue', confidence: 0.4, status: 'conflict', radius: 5, revealedAtStep: 5 },
        // ai1 phase (step 6)
        { id: 'sp-9', label: 'claim.1', type: 'claim', confidence: 0.65, status: 'uncertain', radius: 5, revealedAtStep: 6 },
        { id: 'sp-10', label: 'claim.2', type: 'claim', confidence: 0.55, status: 'uncertain', radius: 4, revealedAtStep: 6 },
        { id: 'sp-11', label: 'entity', type: 'entity', confidence: 0.7, status: 'uncertain', radius: 7, revealedAtStep: 6 },
        // ai2 phase (step 7)
        { id: 'sp-12', label: 'critique', type: 'issue', confidence: 0.5, status: 'conflict', radius: 5, revealedAtStep: 7 },
        { id: 'sp-13', label: 'keyword', type: 'keyword', confidence: 0.7, status: 'uncertain', radius: 5, revealedAtStep: 7 },
        // ai3/compile phase (steps 8-9)
        { id: 'sp-14', label: 'resolved', type: 'entity', confidence: 0.82, status: 'confirmed', radius: 7, revealedAtStep: 8 },
        { id: 'sp-15', label: 'score', type: 'category', confidence: 0.78, status: 'confirmed', radius: 8, revealedAtStep: 9 },
    ];

const SCAN_PHASE_EDGES: Array<{
    source: string; target: string; strength: number; revealedAtStep: number;
}> = [
        { source: 'sp-4', target: 'sp-6', strength: 0.5, revealedAtStep: 3 },
        { source: 'sp-5', target: 'sp-6', strength: 0.4, revealedAtStep: 3 },
        { source: 'sp-6', target: 'sp-7', strength: 0.6, revealedAtStep: 4 },
        { source: 'sp-7', target: 'sp-8', strength: 0.3, revealedAtStep: 5 },
        { source: 'sp-11', target: 'sp-4', strength: 0.7, revealedAtStep: 6 },
        { source: 'sp-11', target: 'sp-5', strength: 0.6, revealedAtStep: 6 },
        { source: 'sp-9', target: 'sp-11', strength: 0.5, revealedAtStep: 6 },
        { source: 'sp-12', target: 'sp-8', strength: 0.4, revealedAtStep: 7 },
        { source: 'sp-13', target: 'sp-11', strength: 0.5, revealedAtStep: 7 },
        { source: 'sp-14', target: 'sp-11', strength: 0.8, revealedAtStep: 8 },
        { source: 'sp-15', target: 'sp-6', strength: 0.7, revealedAtStep: 9 },
        { source: 'sp-15', target: 'sp-14', strength: 0.9, revealedAtStep: 9 },
    ];

/**
 * Returns a minimal CognitionData for the scanning phase.
 * Nodes/edges are revealed up to the current pipeline step so the graph
 * appears to form organically while the real result is pending.
 */
export function buildScanningCognitionData(currentStepKey: string): CognitionData {
    const stepKeys = [
        'dns', 'crawl', 'extract', 'schema', 'technical', 'security', 'ai1', 'ai2', 'ai3', 'compile', 'finalize',
    ];
    const currentIdx = Math.max(0, stepKeys.indexOf(currentStepKey));
    const commits = buildScanningCommits(currentStepKey);

    return {
        url: '',
        score: 0,
        analyzedAt: '',
        nodes: SCAN_PHASE_NODES.filter((n) => n.revealedAtStep <= currentIdx) as CognitionNode[],
        edges: SCAN_PHASE_EDGES.filter((e) => e.revealedAtStep <= currentIdx) as CognitionEdge[],
        commits,
    };
}
