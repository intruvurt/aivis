import { getPool } from './postgresql.js';
import { IS_PRODUCTION } from '../config/runtime.js';
import { TIER_LIMITS, uiTierFromCanonical } from '../../../shared/types.js';
import { getBranding } from './brandingService.js';
import { consumePackCredits, getAvailablePackCredits } from './scanPackCredits.js';
import { generateAuditPdfBuffer } from './reportPdfService.js';
import { sendAuditReportDeliveryEmail } from './emailService.js';
import { createOrRefreshPublicReportLink } from './publicReportLinks.js';

export type ReportDeliveryProvider = 'email' | 'generic' | 'slack' | 'discord' | 'zapier' | 'notion' | 'teams' | 'google_chat';

export interface ReportDeliveryTarget {
  id: string;
  user_id: string;
  workspace_id: string;
  provider: ReportDeliveryProvider;
  display_name: string | null;
  target: string;
  branded: boolean;
  include_pdf: boolean;
  include_share_link: boolean;
  enabled: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = String(hostname || '').toLowerCase();
  if (!lower) return true;
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) return true;
  if (lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function validateEmailAddress(target: string): void {
  const normalized = String(target || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Invalid email address');
  }
}

function validateWebhookTarget(provider: ReportDeliveryProvider, target: string): void {
  const normalized = String(target || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Invalid destination URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Destination URL must be HTTP or HTTPS');
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error('Private and localhost delivery URLs are not allowed');
  }
  if (IS_PRODUCTION && parsed.protocol !== 'https:') {
    throw new Error('HTTPS delivery URL is required in production');
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  if (provider === 'slack' && !(host === 'hooks.slack.com' && pathname.startsWith('/services/'))) {
    throw new Error('Slack URL must match https://hooks.slack.com/services/...');
  }
  if (provider === 'discord' && !((host === 'discord.com' || host === 'discordapp.com') && pathname.startsWith('/api/webhooks/'))) {
    throw new Error('Discord URL must match https://discord.com/api/webhooks/...');
  }
  if (provider === 'zapier' && !(host === 'hooks.zapier.com' && pathname.includes('/hooks/catch/'))) {
    throw new Error('Zapier URL must match https://hooks.zapier.com/hooks/catch/...');
  }
  if (provider === 'teams') {
    const validTeams = host.endsWith('.webhook.office.com') || (host.endsWith('.logic.azure.com') && pathname.includes('/workflows/'));
    if (!validTeams) {
      throw new Error('Microsoft Teams webhook URL must be from *.webhook.office.com or *.logic.azure.com/workflows/...');
    }
  }
  if (provider === 'google_chat' && !(host === 'chat.googleapis.com' && pathname.startsWith('/v1/spaces/'))) {
    throw new Error('Google Chat webhook URL must match https://chat.googleapis.com/v1/spaces/...');
  }
  if (provider === 'notion') {
    const validNotion = host === 'api.notion.com' || host.endsWith('.notion.site');
    if (!validNotion) {
      throw new Error('Notion webhook URL must be from api.notion.com or *.notion.site');
    }
  }
}

export async function listReportDeliveries(userId: string, workspaceId: string): Promise<ReportDeliveryTarget[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT *
     FROM report_delivery_targets
     WHERE user_id = $1 AND workspace_id = $2
     ORDER BY created_at DESC`,
    [userId, workspaceId]
  );
  return rows;
}

export async function createReportDelivery(
  userId: string,
  workspaceId: string,
  input: {
    provider: ReportDeliveryProvider;
    target: string;
    displayName?: string;
    branded?: boolean;
    includePdf?: boolean;
    includeShareLink?: boolean;
  },
  userTier: string = 'observer'
): Promise<ReportDeliveryTarget> {
  const pool = getPool();
  const provider = String(input.provider || '').trim().toLowerCase() as ReportDeliveryProvider;
  const target = String(input.target || '').trim();
  const displayName = String(input.displayName || '').trim().slice(0, 120) || null;
  const branded = input.branded !== false;
  const includePdf = input.includePdf !== false;
  const includeShareLink = input.includeShareLink !== false;

  if (!['email', 'generic', 'slack', 'discord', 'zapier'].includes(provider)) {
    throw new Error('Invalid delivery provider');
  }
  if (!target) {
    throw new Error('Target is required');
  }
  if (provider === 'email') validateEmailAddress(target);
  else validateWebhookTarget(provider, target);

  const tier = uiTierFromCanonical((userTier || 'observer') as any);
  const maxDeliveries = TIER_LIMITS[tier].maxReportDeliveries;
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM report_delivery_targets WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  if (Number(countRows[0]?.cnt || 0) >= maxDeliveries) {
    throw new Error(`Maximum ${maxDeliveries} delivery targets on your plan`);
  }

  const { rows } = await pool.query(
    `INSERT INTO report_delivery_targets (
      user_id, workspace_id, provider, display_name, target, branded, include_pdf, include_share_link
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, workspaceId, provider, displayName, target, branded, includePdf, includeShareLink]
  );
  return rows[0];
}

export async function updateReportDelivery(
  id: string,
  userId: string,
  workspaceId: string,
  updates: {
    displayName?: string;
    target?: string;
    branded?: boolean;
    includePdf?: boolean;
    includeShareLink?: boolean;
    enabled?: boolean;
  }
): Promise<ReportDeliveryTarget | null> {
  const pool = getPool();
  const { rows: existingRows } = await pool.query(
    `SELECT * FROM report_delivery_targets WHERE id = $1 AND user_id = $2 AND workspace_id = $3 LIMIT 1`,
    [id, userId, workspaceId]
  );
  const existing = existingRows[0] as ReportDeliveryTarget | undefined;
  if (!existing) return null;

  const nextTarget = typeof updates.target === 'string' ? updates.target.trim() : existing.target;
  const nextDisplayName = typeof updates.displayName === 'string'
    ? String(updates.displayName).trim().slice(0, 120) || null
    : existing.display_name;
  const nextBranded = typeof updates.branded === 'boolean' ? updates.branded : existing.branded;
  const nextIncludePdf = typeof updates.includePdf === 'boolean' ? updates.includePdf : existing.include_pdf;
  const nextIncludeShareLink = typeof updates.includeShareLink === 'boolean' ? updates.includeShareLink : existing.include_share_link;
  const nextEnabled = typeof updates.enabled === 'boolean' ? updates.enabled : existing.enabled;

  if (existing.provider === 'email') validateEmailAddress(nextTarget);
  else validateWebhookTarget(existing.provider, nextTarget);

  const { rows } = await pool.query(
    `UPDATE report_delivery_targets
     SET display_name = $4,
         target = $5,
         branded = $6,
         include_pdf = $7,
         include_share_link = $8,
         enabled = $9,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND workspace_id = $3
     RETURNING *`,
    [id, userId, workspaceId, nextDisplayName, nextTarget, nextBranded, nextIncludePdf, nextIncludeShareLink, nextEnabled]
  );
  return rows[0] || null;
}

export async function deleteReportDelivery(id: string, userId: string, workspaceId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM report_delivery_targets WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId]
  );
  return (rowCount || 0) > 0;
}

function buildFilename(url: string, branded: boolean): string {
  const domain = (() => {
    try { return new URL(url).hostname; } catch { return 'report'; }
  })();
  const date = new Date().toISOString().slice(0, 10);
  const suffix = branded ? '-branded' : '';
  return `aivis-report-${domain}-${date}${suffix}.pdf`;
}

async function postJson(target: string, payload: Record<string, any>) {
  const response = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-AiVIS-Event': 'audit.report.ready' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Delivery target returned ${response.status}`);
  }
}

function buildAiVisibilityShareMessage(url: string, score: number): string {
  return `AiVIS audited "${url}" and returned a "${score}/100" AI Visibility score.\nSee how ChatGPT and Perplexity likely interpret the site, what they may miss, and where the biggest visibility gaps are:`;
}

async function deliverWebhookTarget(args: {
  target: ReportDeliveryTarget;
  payload: {
    audit_id: string;
    url: string;
    visibility_score: number;
    analyzed_at?: string;
    public_report_url?: string | null;
    branded: boolean;
    pdf?: Buffer | null;
    result: any;
    brandingApplied: boolean;
  };
}) {
  const { target, payload } = args;
  const baseData = {
    event: 'audit.report.ready',
    audit_id: payload.audit_id,
    url: payload.url,
    visibility_score: payload.visibility_score,
    analyzed_at: payload.analyzed_at,
    public_report_url: payload.public_report_url || null,
    branded: payload.branded,
    branding_applied: payload.brandingApplied,
    summary: payload.result?.summary || null,
    top_recommendations: Array.isArray(payload.result?.recommendations)
      ? payload.result.recommendations.slice(0, 3).map((rec: any) => ({
          title: rec?.title,
          priority: rec?.priority,
          category: rec?.category,
        }))
      : [],
    failed_gates: Array.isArray(payload.result?.strict_rubric?.gates)
      ? (payload.result.strict_rubric.gates as Array<Record<string, unknown>>)
          .filter((g) => g.status === 'fail')
          .map((g) => ({ gate_id: g.id, label: g.label, score: g.score_0_100, threshold: g.threshold_pass }))
      : [],
    required_fixpacks: Array.isArray(payload.result?.strict_rubric?.required_fixpacks)
      ? (payload.result.strict_rubric.required_fixpacks as Array<Record<string, unknown>>).map((fp) => ({
          id: fp.id,
          label: fp.label,
          estimated_lift: `${fp.estimated_score_lift_min}–${fp.estimated_score_lift_max}`,
        }))
      : [],
    reliability_index: (payload.result?.strict_rubric as Record<string, unknown> | undefined)?.reliability_index_0_100 ?? null,
  };
  const shareMessage = buildAiVisibilityShareMessage(payload.url, payload.visibility_score);

  if (target.provider === 'slack') {
    const linkSuffix = payload.public_report_url ? `\n${payload.public_report_url}` : '';
    return postJson(target.target, {
      text: `${shareMessage}${linkSuffix}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'AiVIS audit report ready', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${shareMessage}\n\n*Summary:* ${payload.result?.summary || 'Evidence-backed audit completed.'}`,
          },
        },
        ...(payload.public_report_url
          ? [{ type: 'section', text: { type: 'mrkdwn', text: `<${payload.public_report_url}|Open public report>` } }]
          : []),
      ],
      aivis: baseData,
    });
  }

  if (target.provider === 'discord') {
    const linkSuffix = payload.public_report_url ? `\n${payload.public_report_url}` : '';
    return postJson(target.target, {
      content: `${shareMessage}${linkSuffix}`,
      embeds: [
        {
          title: 'AiVIS audit report ready',
          description: payload.result?.summary || 'Evidence-backed audit completed.',
          fields: [
            { name: 'URL', value: payload.url },
            { name: 'Score', value: `${payload.visibility_score}/100`, inline: true },
            { name: 'Branding', value: payload.brandingApplied ? 'Branded PDF' : 'Standard PDF', inline: true },
            ...(payload.public_report_url ? [{ name: 'Report', value: payload.public_report_url }] : []),
          ],
          timestamp: payload.analyzed_at || new Date().toISOString(),
        },
      ],
      aivis: baseData,
    });
  }

  const pdfInline = payload.pdf && payload.pdf.length <= 1_500_000
    ? payload.pdf.toString('base64')
    : null;

  return postJson(target.target, {
    ...baseData,
    share_message: shareMessage,
    pdf_filename: payload.pdf ? buildFilename(payload.url, payload.brandingApplied) : null,
    pdf_base64: pdfInline,
    pdf_included: Boolean(pdfInline),
    pdf_omitted_reason: payload.pdf && !pdfInline ? 'PDF exceeded inline delivery size limit' : null,
  });
}

async function markDeliverySuccess(id: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE report_delivery_targets
     SET last_triggered_at = NOW(), failure_count = 0, updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

async function markDeliveryFailure(id: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE report_delivery_targets
     SET failure_count = failure_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

export async function dispatchAuditReportDeliveries(args: {
  userId: string;
  workspaceId: string;
  auditId: string;
  url: string;
  result: any;
  ownerTier?: string;
}): Promise<void> {
  const { userId, workspaceId, auditId, url, result } = args;
  const tier = uiTierFromCanonical((args.ownerTier as any) || 'observer');
  const targets = await listReportDeliveries(userId, workspaceId);
  const enabledTargets = targets.filter((target) => target.enabled);
  if (!enabledTargets.length) return;

  const shareLink = enabledTargets.some((target) => target.include_share_link)
    ? (await createOrRefreshPublicReportLink({ auditId, userId, workspaceId, targetUrl: url })).publicUrl
    : null;
  const wantsBrandedPdf = enabledTargets.some((target) => target.include_pdf && target.branded);
  const wantsPlainPdf = enabledTargets.some((target) => target.include_pdf && !target.branded);

  let brandingApplied = false;
  let branding: Awaited<ReturnType<typeof getBranding>> = null;
  if (wantsBrandedPdf && TIER_LIMITS[tier].hasWhiteLabel) {
    branding = await getBranding(userId, workspaceId);
    if (branding) {
      const availableCredits = await getAvailablePackCredits(userId);
      if (availableCredits >= 1) {
        const charge = await consumePackCredits(userId, 1, 'auto_report_delivery_branded_pdf', {
          workspaceId,
          auditId,
        });
        brandingApplied = Boolean(charge.consumed);
      }
    }
  }

  let brandedPdf: Buffer | null = null;
  let plainPdf: Buffer | null = null;

  if (brandingApplied) {
    const generated = await generateAuditPdfBuffer({
      auditId,
      url,
      result,
      branding,
      branded: true,
      publicReportUrl: shareLink,
    });
    brandedPdf = generated.pdf;
  }

  if (wantsPlainPdf || (wantsBrandedPdf && !brandingApplied)) {
    const generated = await generateAuditPdfBuffer({
      auditId,
      url,
      result,
      branded: false,
      publicReportUrl: shareLink,
    });
    plainPdf = generated.pdf;
  }

  for (const target of enabledTargets) {
    try {
      const pdf = target.include_pdf ? (target.branded && brandingApplied ? brandedPdf : plainPdf) : null;
      const deliveryPayload = {
        audit_id: auditId,
        url,
        visibility_score: Number(result?.visibility_score || 0),
        analyzed_at: String(result?.analyzed_at || ''),
        public_report_url: target.include_share_link ? shareLink : null,
        branded: Boolean(target.branded),
        pdf,
        result,
        brandingApplied: Boolean(target.branded && brandingApplied),
      };

      if (target.provider === 'email') {
        await sendAuditReportDeliveryEmail({
          to: target.target,
          auditId,
          targetUrl: url,
          result,
          publicReportUrl: target.include_share_link ? shareLink : null,
          pdfBuffer: pdf,
          pdfFilename: pdf ? buildFilename(url, Boolean(target.branded && brandingApplied)) : null,
          branded: Boolean(target.branded && brandingApplied),
          brandName: brandingApplied && branding?.company_name ? branding.company_name : null,
        });
      } else {
        await deliverWebhookTarget({ target, payload: deliveryPayload });
      }

      await markDeliverySuccess(target.id);
    } catch (error: any) {
      console.warn('[Report Delivery] Delivery failed:', target.provider, error?.message || error);
      await markDeliveryFailure(target.id);
    }
  }
}
