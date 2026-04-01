/**
 * ssfrVerificationService.ts — Verification pipeline for SSFR fixpacks.
 *
 * After a fixpack is applied (or a re-audit is run), this service
 * re-evaluates specific evidence and rules to determine if the
 * fixpack was successfully applied.
 */

import { Pool } from 'pg';
import type {
  SSFREvidenceItem,
  SSFRRuleResult,
  SSFRFixpack,
  SSFRVerificationStatus,
} from '../../../shared/types.js';
import { evaluateSSFRRules } from './ssfrRuleEngine.js';

// ─── Persistence helpers ────────────────────────────────────────────────────

export async function persistSSFRResults(
  pool: Pool,
  auditId: string,
  evidence: SSFREvidenceItem[],
  ruleResults: SSFRRuleResult[],
  fixpacks: SSFRFixpack[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Evidence rows ──
    if (evidence.length > 0) {
      const evValues: unknown[] = [];
      const evPlaceholders: string[] = [];
      let idx = 1;
      for (const e of evidence) {
        evPlaceholders.push(`(gen_random_uuid(), $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        evValues.push(auditId, auditId, e.family, e.family, e.evidence_key, e.evidence_key, JSON.stringify(e.value), e.source, e.status, e.confidence, e.notes ? JSON.stringify(e.notes) : null);
      }
      await client.query(
        `INSERT INTO audit_evidence (id, audit_run_id, audit_id, category, family, evidence_key, key, value, source, status, confidence, notes)
         VALUES ${evPlaceholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        evValues,
      );
    }

    // ── Rule results ──
    if (ruleResults.length > 0) {
      const rrValues: unknown[] = [];
      const rrPlaceholders: string[] = [];
      let idx = 1;
      for (const r of ruleResults) {
        rrPlaceholders.push(`(gen_random_uuid(), $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        rrValues.push(auditId, auditId, r.family, r.rule_id, r.title, r.passed, r.severity, r.is_hard_blocker, r.score_cap ?? null, JSON.stringify(r.evidence_ids), r.details ? JSON.stringify(r.details) : null);
      }
      await client.query(
        `INSERT INTO audit_rule_results (id, audit_run_id, audit_id, family, rule_id, title, passed, severity, is_hard_blocker, score_cap, evidence_ids, details)
         VALUES ${rrPlaceholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        rrValues,
      );
    }

    // ── Fixpacks ──
    if (fixpacks.length > 0) {
      const fpValues: unknown[] = [];
      const fpPlaceholders: string[] = [];
      let idx = 1;
      for (const f of fixpacks) {
        fpPlaceholders.push(`(gen_random_uuid(), $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        fpValues.push(auditId, auditId, f.type, f.title, f.summary, f.priority, JSON.stringify(f.assets), f.auto_generatable, f.verification_status, JSON.stringify(f.based_on_rule_ids));
      }
      await client.query(
        `INSERT INTO audit_fixpacks (id, audit_run_id, audit_id, type, title, summary, priority, assets, auto_generatable, verification_status, based_on_rule_ids)
         VALUES ${fpPlaceholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        fpValues,
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Load existing SSFR data ────────────────────────────────────────────────

export async function loadSSFRResults(
  pool: Pool,
  auditId: string,
): Promise<{ evidence: SSFREvidenceItem[]; ruleResults: SSFRRuleResult[]; fixpacks: SSFRFixpack[] } | null> {
  const evResult = await pool.query(
    `SELECT family, evidence_key, value, source, status, confidence, notes FROM audit_evidence WHERE audit_id = $1 ORDER BY created_at`,
    [auditId],
  );
  if (evResult.rowCount === 0) return null;

  const evidence: SSFREvidenceItem[] = evResult.rows.map(r => ({
    family: r.family,
    evidence_key: r.evidence_key,
    value: r.value,
    source: r.source,
    status: r.status,
    confidence: Number(r.confidence),
    notes: r.notes,
  }));

  const rrResult = await pool.query(
    `SELECT family, rule_id, title, passed, severity, is_hard_blocker, score_cap, evidence_ids, details FROM audit_rule_results WHERE audit_id = $1 ORDER BY created_at`,
    [auditId],
  );
  const ruleResults: SSFRRuleResult[] = rrResult.rows.map(r => ({
    family: r.family,
    rule_id: r.rule_id,
    title: r.title,
    passed: r.passed,
    severity: r.severity,
    is_hard_blocker: r.is_hard_blocker,
    score_cap: r.score_cap != null ? Number(r.score_cap) : undefined,
    evidence_ids: r.evidence_ids ?? [],
    details: r.details,
  }));

  const fpResult = await pool.query(
    `SELECT type, title, summary, priority, assets, auto_generatable, verification_status, based_on_rule_ids FROM audit_fixpacks WHERE audit_id = $1 ORDER BY created_at`,
    [auditId],
  );
  const fixpacks: SSFRFixpack[] = fpResult.rows.map(r => ({
    type: r.type,
    title: r.title,
    summary: r.summary,
    priority: r.priority,
    assets: r.assets ?? [],
    auto_generatable: r.auto_generatable,
    verification_status: r.verification_status,
    based_on_rule_ids: r.based_on_rule_ids ?? [],
  }));

  return { evidence, ruleResults, fixpacks };
}

// ─── Verify a single fixpack against new evidence ───────────────────────────

export async function verifyFixpack(
  pool: Pool,
  auditId: string,
  fixpackId: string,
  newEvidence: SSFREvidenceItem[],
): Promise<{ status: SSFRVerificationStatus; details: Record<string, unknown> }> {
  // Load the fixpack
  const fpResult = await pool.query(
    `SELECT id, based_on_rule_ids FROM audit_fixpacks WHERE id = $1 AND audit_id = $2`,
    [fixpackId, auditId],
  );
  if (fpResult.rowCount === 0) {
    return { status: 'failed', details: { error: 'Fixpack not found' } };
  }

  const fixpack = fpResult.rows[0];
  const ruleIds: string[] = fixpack.based_on_rule_ids ?? [];

  // Re-evaluate all rules against new evidence
  const newResults = evaluateSSFRRules(newEvidence);

  // Check if the specific rules this fixpack targets now pass
  const relevant = newResults.filter(r => ruleIds.includes(r.rule_id));
  const allPassed = relevant.length > 0 && relevant.every(r => r.passed);

  const status: SSFRVerificationStatus = allPassed ? 'verified' : 'failed';

  // Update fixpack status in DB
  await pool.query(
    `UPDATE audit_fixpacks SET verification_status = $1 WHERE id = $2`,
    [status, fixpackId],
  );

  return {
    status,
    details: {
      checked_rules: ruleIds,
      results: relevant.map(r => ({ rule_id: r.rule_id, passed: r.passed, title: r.title })),
    },
  };
}

// ─── Full re-verify for an audit ────────────────────────────────────────────

export async function reverifyAudit(
  pool: Pool,
  auditId: string,
  newEvidence: SSFREvidenceItem[],
): Promise<{ updated: number; results: Array<{ fixpack_id: string; old_status: string; new_status: SSFRVerificationStatus }> }> {
  const fpResult = await pool.query(
    `SELECT id, based_on_rule_ids, verification_status FROM audit_fixpacks WHERE audit_id = $1`,
    [auditId],
  );

  const newRuleResults = evaluateSSFRRules(newEvidence);
  const updates: Array<{ fixpack_id: string; old_status: string; new_status: SSFRVerificationStatus }> = [];

  for (const row of fpResult.rows) {
    const ruleIds: string[] = row.based_on_rule_ids ?? [];
    const relevant = newRuleResults.filter(r => ruleIds.includes(r.rule_id));
    const allPassed = relevant.length > 0 && relevant.every(r => r.passed);
    const newStatus: SSFRVerificationStatus = allPassed ? 'verified' : 'failed';

    if (row.verification_status !== newStatus) {
      await pool.query(
        `UPDATE audit_fixpacks SET verification_status = $1 WHERE id = $2`,
        [newStatus, row.id],
      );
      updates.push({ fixpack_id: row.id, old_status: row.verification_status, new_status: newStatus });
    }
  }

  return { updated: updates.length, results: updates };
}
