export type AnalyzeInputSource = 'domain' | 'url' | 'keyword';
export type AnalyzeMode = 'visibility' | 'content' | 'audit';
export type AnalyzeDepth = 'light' | 'deep' | 'recursive';

export type AnalyzeState =
    | 'SCAN_INIT'
    | 'ENTITY_MAPPING'
    | 'VISIBILITY_GAP_ANALYSIS'
    | 'PAGE_SPEC_GENERATION'
    | 'CONTENT_COMPILATION'
    | 'SCHEMA_BINDING'
    | 'GRAPH_LINKING'
    | 'READY'
    | 'PUBLISHED'
    | 'FAILED';

export type AnalyzeStageCommand =
    | 'scan'
    | 'entities'
    | 'gaps'
    | 'pagespec'
    | 'compile'
    | 'schema'
    | 'graph';

export interface AnalyzeCompilerRequest {
    input: string;
    source?: AnalyzeInputSource;
    mode?: AnalyzeMode;
    depth?: AnalyzeDepth;
    idempotencyKey?: string;
}

export interface EntityNode {
    entityKey: string;
    name: string;
    entityType: 'person' | 'product' | 'concept' | 'company' | 'tool';
    confidence: number;
}

export interface EntityGap {
    entityKey: string;
    status: 'represented' | 'underrepresented' | 'uncited';
    opportunityScore: number;
    citationPresence: boolean;
    missingPageTypes: string[];
}

export interface PageSpec {
    entityKey: string;
    intent: 'define' | 'compare' | 'explain' | 'prove' | 'demonstrate';
    title: string;
    slug: string;
    targetQueryCluster: string[];
    requiredSections: string[];
    schemaType: string;
    priority: number;
    internalLinks: string[];
}

export interface CompiledSection {
    heading: string;
    content: string;
    entities: string[];
}

export interface CompiledPage {
    pageSpecId: string;
    title: string;
    slug: string;
    sections: CompiledSection[];
    claims: string[];
    internalLinks: string[];
}
