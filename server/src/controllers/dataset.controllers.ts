/**
 * Dataset Pipeline Controller
 *
 * Handles HTTP requests for the audit-verified dataset pipeline.
 * All routes require auth + Signal tier or higher.
 */

import type { Request, Response } from 'express';
import { DATASET_VERTICALS, type DatasetVertical, type DatasetEntryStage, type DatasetEntryOrigin } from '../../../shared/types.js';
import {
    ingestEntry,
    annotateEntry,
    synthesizeEntries,
    auditEntry,
    batchAuditEntries,
    markHumanReviewed,
    getEntries,
    getVerticalSummary,
    getAllVerticalSummaries,
    deleteEntry,
    getAuditProof,
} from '../services/datasetPipeline.js';

const VALID_VERTICALS = new Set<string>(Object.keys(DATASET_VERTICALS));
const VALID_STAGES = new Set<string>(['ingested', 'annotated', 'synthesized', 'audited']);
const VALID_ORIGINS = new Set<string>(['real', 'synthetic']);

/* ── GET /api/dataset/verticals ───────────────────────────── */
export async function getVerticals(_req: Request, res: Response) {
    return res.json({ success: true, verticals: DATASET_VERTICALS });
}

/* ── GET /api/dataset/summary ─────────────────────────────── */
export async function getSummary(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const vertical = String(req.query.vertical || '').trim();
        if (vertical && !VALID_VERTICALS.has(vertical)) {
            return res.status(400).json({ error: 'Invalid vertical' });
        }

        if (vertical) {
            const summary = await getVerticalSummary(userId, vertical as DatasetVertical);
            return res.json({ success: true, summary });
        }

        const summaries = await getAllVerticalSummaries(userId);
        return res.json({ success: true, summaries });
    } catch (err: any) {
        console.error('[DatasetController] getSummary error:', err?.message);
        return res.status(500).json({ error: 'Failed to fetch dataset summary' });
    }
}

/* ── GET /api/dataset/entries ─────────────────────────────── */
export async function listEntries(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const vertical = String(req.query.vertical || '').trim() || undefined;
        const stage = String(req.query.stage || '').trim() || undefined;
        const origin = String(req.query.origin || '').trim() || undefined;
        const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50), 200);
        const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

        if (vertical && !VALID_VERTICALS.has(vertical)) {
            return res.status(400).json({ error: 'Invalid vertical' });
        }
        if (stage && !VALID_STAGES.has(stage)) {
            return res.status(400).json({ error: 'Invalid stage filter' });
        }
        if (origin && !VALID_ORIGINS.has(origin)) {
            return res.status(400).json({ error: 'Invalid origin filter' });
        }

        const result = await getEntries(userId, {
            vertical: vertical as DatasetVertical,
            stage: stage as DatasetEntryStage,
            origin: origin as DatasetEntryOrigin,
            limit,
            offset,
        });

        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error('[DatasetController] listEntries error:', err?.message);
        return res.status(500).json({ error: 'Failed to list dataset entries' });
    }
}

/* ── POST /api/dataset/ingest ─────────────────────────────── */
export async function ingest(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { vertical, source_url, title, content } = req.body || {};

        if (!vertical || !VALID_VERTICALS.has(vertical)) {
            return res.status(400).json({ error: 'vertical is required and must be one of: ai_governance, incident_response, agentic_interaction' });
        }
        if (!source_url || typeof source_url !== 'string' || source_url.trim().length < 5) {
            return res.status(400).json({ error: 'source_url is required (min 5 characters)' });
        }

        const cleanUrl = source_url.trim().slice(0, 2000);
        const cleanTitle = (title || '').trim().slice(0, 500) || cleanUrl;
        const cleanContent = (content || '').trim().slice(0, 50000);

        const entry = await ingestEntry(userId, vertical, cleanUrl, cleanTitle, cleanContent);
        return res.status(201).json({ success: true, entry });
    } catch (err: any) {
        console.error('[DatasetController] ingest error:', err?.message);
        return res.status(500).json({ error: 'Ingestion failed' });
    }
}

/* ── POST /api/dataset/annotate/:id ──────────────────────── */
export async function annotate(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const entryId = req.params.id as string;
        if (!entryId) return res.status(400).json({ error: 'Entry ID required' });

        const entry = await annotateEntry(entryId, userId);
        return res.json({ success: true, entry });
    } catch (err: any) {
        console.error('[DatasetController] annotate error:', err?.message);
        if (err.message === 'Entry not found') return res.status(404).json({ error: 'Entry not found' });
        return res.status(500).json({ error: 'Annotation failed' });
    }
}

/* ── POST /api/dataset/synthesize ────────────────────────── */
export async function synthesize(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { vertical, count, seed_entry_ids } = req.body || {};

        if (!vertical || !VALID_VERTICALS.has(vertical)) {
            return res.status(400).json({ error: 'vertical is required' });
        }
        const entryCount = Math.min(Math.max(1, parseInt(String(count || '10'), 10) || 10), 50);
        const seeds = Array.isArray(seed_entry_ids)
            ? seed_entry_ids.filter((id): id is string => typeof id === 'string').slice(0, 5)
            : undefined;

        const entries = await synthesizeEntries(userId, vertical, entryCount, seeds);
        return res.status(201).json({ success: true, entries, generated: entries.length });
    } catch (err: any) {
        console.error('[DatasetController] synthesize error:', err?.message);
        return res.status(500).json({ error: 'Synthesis failed' });
    }
}

/* ── POST /api/dataset/audit/:id ─────────────────────────── */
export async function audit(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const entryId = req.params.id as string;
        if (!entryId) return res.status(400).json({ error: 'Entry ID required' });

        const proof = await auditEntry(entryId, userId);
        return res.json({ success: true, proof });
    } catch (err: any) {
        console.error('[DatasetController] audit error:', err?.message);
        if (err.message === 'Entry not found') return res.status(404).json({ error: 'Entry not found' });
        return res.status(500).json({ error: 'Audit failed' });
    }
}

/* ── POST /api/dataset/audit/batch ───────────────────────── */
export async function auditBatch(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { entry_ids } = req.body || {};
        if (!Array.isArray(entry_ids) || entry_ids.length === 0) {
            return res.status(400).json({ error: 'entry_ids array is required' });
        }

        const ids = entry_ids.filter((id): id is string => typeof id === 'string').slice(0, 100);
        const proofs = await batchAuditEntries(ids, userId);
        return res.json({ success: true, proofs, audited: proofs.length });
    } catch (err: any) {
        console.error('[DatasetController] auditBatch error:', err?.message);
        return res.status(500).json({ error: 'Batch audit failed' });
    }
}

/* ── PATCH /api/dataset/review/:id ───────────────────────── */
export async function review(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const entryId = req.params.id as string;
        if (!entryId) return res.status(400).json({ error: 'Entry ID required' });

        const { ground_truth } = req.body || {};
        const gt = (typeof ground_truth === 'object' && ground_truth !== null) ? ground_truth : undefined;

        const entry = await markHumanReviewed(entryId, userId, gt);
        return res.json({ success: true, entry });
    } catch (err: any) {
        console.error('[DatasetController] review error:', err?.message);
        if (err.message === 'Entry not found') return res.status(404).json({ error: 'Entry not found' });
        return res.status(500).json({ error: 'Review failed' });
    }
}

/* ── GET /api/dataset/proof/:id ──────────────────────────── */
export async function getProof(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const entryId = req.params.id as string;
        if (!entryId) return res.status(400).json({ error: 'Entry ID required' });

        const proof = await getAuditProof(entryId, userId);
        if (!proof) return res.status(404).json({ error: 'Audit proof not found' });
        return res.json({ success: true, proof });
    } catch (err: any) {
        console.error('[DatasetController] getProof error:', err?.message);
        return res.status(500).json({ error: 'Failed to fetch proof' });
    }
}

/* ── DELETE /api/dataset/entries/:id ─────────────────────── */
export async function removeEntry(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const entryId = req.params.id as string;
        if (!entryId) return res.status(400).json({ error: 'Entry ID required' });

        const deleted = await deleteEntry(entryId, userId);
        if (!deleted) return res.status(404).json({ error: 'Entry not found' });
        return res.json({ success: true });
    } catch (err: any) {
        console.error('[DatasetController] removeEntry error:', err?.message);
        return res.status(500).json({ error: 'Delete failed' });
    }
}
