/**
 * cognition/types.ts
 *
 * Data model powering the live-reasoning debugger UI.
 * Every visual element maps to one of these structures — no decorative data.
 */

export type NodeType = 'entity' | 'category' | 'issue' | 'claim' | 'keyword' | 'query' | 'gap';
export type NodeStatus = 'confirmed' | 'uncertain' | 'conflict' | 'pending';
export type CommitType =
    | 'scan'      // pipeline scan step
    | 'extract'   // signal extraction
    | 'add'       // new entity/citation added
    | 'link'      // edge formed
    | 'score'     // category scored
    | 'conflict'  // contradiction detected
    | 'resolve'   // conflict resolved
    | 'finalize'  // final output committed
    | 'query'     // answer-presence query test result
    | 'gap';      // detected visibility gap

export interface CognitionNode {
    id: string;
    label: string;
    type: NodeType;
    /** 0–1 confidence from AI or deterministic scoring */
    confidence: number;
    status: NodeStatus;
    /** Number of corroborating sources */
    sources?: number;
    /** Visual radius in logical px */
    radius: number;
    /** The commit stepIndex at which this node first appears */
    revealedAtStep: number;
}

export interface CognitionEdge {
    source: string;
    target: string;
    /** 0-1 spring strength */
    strength: number;
    revealedAtStep: number;
}

export interface CognitionCommit {
    id: string;
    stepIndex: number;
    type: CommitType;
    /** Short human-readable label for the left rail */
    label: string;
    /** Which sub-agent produced this step */
    agent: string;
    confidence?: number;
    /** Evidence strings shown in inspector */
    evidence?: string[];
    /** Change descriptions shown in inspector */
    changes?: string[];
    /** Node IDs that this commit affected */
    relatedNodeIds?: string[];
    /** Branches when conflicting agents diverge */
    isBranch?: boolean;
    /** For 'query' commits: the raw evidence entry */
    queryEvidence?: {
        query: string;
        intent: string;
        source: string;
        mentioned: boolean;
        position?: number;
        snippet?: string;
        citation_strength: number;
    };
    /** For 'gap' commits: the gap item */
    gapItem?: {
        type: 'content' | 'citation' | 'authority' | 'entity_clarity';
        description: string;
        query?: string;
        dominant_sources?: string[];
        action: string;
    };
}

export interface CognitionData {
    nodes: CognitionNode[];
    edges: CognitionEdge[];
    commits: CognitionCommit[];
    url: string;
    score: number;
    analyzedAt: string;
}

/** Sim node extends CognitionNode with mutable physics state */
export interface SimNode extends CognitionNode {
    x: number;
    y: number;
    vx: number;
    vy: number;
}
