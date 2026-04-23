export type GuidePriority = 'critical' | 'high' | 'medium';

export interface GuideFlowStage {
    id: string;
    title: string;
    summary: string;
    eta: string;
    anchorId: string;
    ctaLabel: string;
    ctaTo?: string;
}

export interface GuideChecklistItem {
    id: string;
    title: string;
    detail: string;
    eta: string;
    priority: GuidePriority;
    anchorId: string;
    actionLabel?: string;
    actionTo?: string;
}
