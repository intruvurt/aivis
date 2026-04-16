import type { UserBranding } from './brandingService.js';

const DEFAULT_BRAND_NAME = 'AiVIS';
const DEFAULT_LOGO_URL = 'https://aivis.biz/aivis-logo.png';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value: unknown): string {
  const input = String(value || '').trim();
  if (!input) return 'N/A';
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function visibilityTone(score: number) {
  if (score >= 80) return { label: 'Strong', color: '#34d399' };
  if (score >= 60) return { label: 'Stable', color: '#22d3ee' };
  if (score >= 40) return { label: 'At Risk', color: '#fbbf24' };
  return { label: 'Weak', color: '#f87171' };
}

function normalizeItems<T>(input: unknown): T[] {
  return Array.isArray(input) ? (input as T[]) : [];
}

function getExecutionClass(result: any): 'LIVE' | 'SCRAPE_ONLY' | 'DETERMINISTIC_FALLBACK' | 'UPLOAD' {
  const mode = String(result?.analysis_integrity?.mode || '').trim().toLowerCase();
  const sourceType = String(result?.source_type || '').trim().toLowerCase();
  const fallbackMode = String(result?.fallback_mode || result?.analysis_integrity?.fallback_mode || '').trim();
  if (sourceType === 'upload' || mode === 'upload') return 'UPLOAD';
  if (mode === 'deterministic-fallback') return 'DETERMINISTIC_FALLBACK';
  if (mode === 'scrape-only') return 'SCRAPE_ONLY';
  if (fallbackMode.length > 0) return 'DETERMINISTIC_FALLBACK';
  return 'LIVE';
}

function getExecutionClassLabel(value: 'LIVE' | 'SCRAPE_ONLY' | 'DETERMINISTIC_FALLBACK' | 'UPLOAD'): string {
  if (value === 'LIVE') return 'Live pipeline';
  if (value === 'DETERMINISTIC_FALLBACK') return 'Deterministic fallback';
  if (value === 'SCRAPE_ONLY') return 'Scrape-only';
  return 'Upload analysis';
}

export function buildAuditReportHtml(args: {
  auditId: string;
  url: string;
  result: any;
  branding?: UserBranding | null;
  branded?: boolean;
  publicReportUrl?: string | null;
}): string {
  const { auditId, url, result, branding, branded = false, publicReportUrl } = args;
  const score = Number(result?.visibility_score || 0);
  const tone = visibilityTone(score);
  const brandName = branded ? String(branding?.company_name || DEFAULT_BRAND_NAME).trim() || DEFAULT_BRAND_NAME : DEFAULT_BRAND_NAME;
  const primary = branded ? String(branding?.primary_color || '#0ea5e9') : '#0ea5e9';
  const accent = branded ? String(branding?.accent_color || '#6366f1') : '#6366f1';
  const logo = branded ? String(branding?.logo_base64 || branding?.logo_url || DEFAULT_LOGO_URL) : DEFAULT_LOGO_URL;
  const footer = branded ? String(branding?.footer_text || 'Generated with AiVIS').trim() : 'Generated with AiVIS';

  const categoryGrades = normalizeItems<any>(result?.category_grades).slice(0, 6);
  const findings = normalizeItems<any>(result?.content_highlights).slice(0, 5);
  const recommendations = normalizeItems<any>(result?.recommendations);
  const platformScores = result?.ai_platform_scores && typeof result.ai_platform_scores === 'object'
    ? Object.entries(result.ai_platform_scores as Record<string, unknown>)
    : [];

  const riskLevel = String(result?.threat_intel?.risk_level || 'low');
  const integrity = result?.recommendation_evidence_summary;
  const strictRubric = result?.strict_rubric;
  const executionClass = getExecutionClass(result);
  const geoProfile = result?.geo_signal_profile;
  const contradictionReport = result?.contradiction_report;

  const categoryCards = categoryGrades.length
    ? categoryGrades
      .map(
        (grade) => `
            <div class="card compact">
              <div class="row between">
                <div class="label">${escapeHtml(grade.label)}</div>
                <div class="pill">${escapeHtml(grade.grade)}</div>
              </div>
              <div class="meta">Score ${escapeHtml(grade.score)}/100</div>
              <div class="body small">${escapeHtml(grade.summary)}</div>
            </div>`
      )
      .join('')
    : '<div class="empty">No category grades were returned for this audit.</div>';

  const findingCards = findings.length
    ? findings
      .map(
        (finding) => `
            <div class="card compact">
              <div class="row wrap gap-sm">
                <span class="tag">${escapeHtml(finding.area)}</span>
                <span class="tag muted">${escapeHtml(finding.status)}</span>
              </div>
              <div class="body title">${escapeHtml(finding.found)}</div>
              <div class="body small">${escapeHtml(finding.note)}</div>
            </div>`
      )
      .join('')
    : '<div class="empty">No evidence findings were returned for this audit.</div>';

  const recommendationCards = recommendations.length
    ? recommendations
      .map(
        (rec) => `
            <div class="card compact">
              <div class="row wrap gap-sm">
                <span class="tag">${escapeHtml(rec.priority || 'medium')}</span>
                <span class="tag muted">${escapeHtml(rec.category || 'General')}</span>
              </div>
              <div class="body title">${escapeHtml(rec.title)}</div>
              <div class="body small">${escapeHtml(rec.description)}</div>
            </div>`
      )
      .join('')
    : '<div class="empty">No recommendations were returned for this audit.</div>';

  const platformCards = platformScores.length
    ? platformScores
      .map(([name, value]) => `
          <div class="card compact">
            <div class="label">${escapeHtml(name.replace(/_/g, ' '))}</div>
            <div class="metric">${escapeHtml(value)}/100</div>
          </div>`)
      .join('')
    : '<div class="empty">No platform score breakdown available.</div>';

  const strictGateRows = Array.isArray(strictRubric?.gates)
    ? strictRubric.gates
      .map((gate: any) => `
          <tr>
            <td>${escapeHtml(gate?.label)}</td>
            <td>${escapeHtml(String(gate?.status || '').toUpperCase())}</td>
            <td>${escapeHtml(gate?.score_0_100)}/100</td>
            <td>${escapeHtml(gate?.threshold_pass)}</td>
          </tr>
        `)
      .join('')
    : '';

  const strictFixpacks = Array.isArray(strictRubric?.required_fixpacks)
    ? strictRubric.required_fixpacks
      .map((pack: any) => `
          <div class="card compact">
            <div class="row between">
              <div class="label">${escapeHtml(pack?.label)}</div>
              <div class="pill">+${escapeHtml(pack?.estimated_score_lift_min)} to +${escapeHtml(pack?.estimated_score_lift_max)}</div>
            </div>
            <div class="body small">Targets: ${escapeHtml(Array.isArray(pack?.target_gate_ids) ? pack.target_gate_ids.join(', ') : '')}</div>
          </div>
        `)
      .join('')
    : '';

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(brandName)} Audit Report</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        background: #0f172a;
        color: #e5e7eb;
        margin: 0;
        padding: 28px;
      }
      .shell {
        background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 28px;
      }
      .hero {
        border-radius: 20px;
        padding: 22px;
        background: linear-gradient(135deg, ${primary}22, ${accent}22);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .logo {
        height: 34px;
        width: auto;
        object-fit: contain;
      }
      .row { display: flex; align-items: center; }
      .between { justify-content: space-between; }
      .wrap { flex-wrap: wrap; }
      .gap { gap: 16px; }
      .gap-sm { gap: 8px; }
      .muted { color: #94a3b8; }
      .title-xl { font-size: 28px; font-weight: 700; margin: 0; }
      .title-lg { font-size: 18px; font-weight: 700; margin: 0 0 12px; }
      .title { font-size: 15px; font-weight: 700; margin-top: 10px; }
      .score {
        font-size: 46px;
        font-weight: 800;
        line-height: 1;
        margin: 0;
      }
      .score-sub { font-size: 13px; color: #cbd5e1; }
      .pill, .tag {
        display: inline-block;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.16);
        padding: 4px 10px;
        font-size: 11px;
      }
      .pill { color: ${tone.color}; border-color: ${tone.color}55; }
      .tag.muted { color: #cbd5e1; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .section { margin-top: 22px; }
      .card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 14px;
      }
      .card.compact { break-inside: avoid; }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
      .body { margin-top: 8px; line-height: 1.6; }
      .body.small { font-size: 12px; color: #cbd5e1; }
      .metric { font-size: 20px; font-weight: 700; margin-top: 8px; }
      .meta { margin-top: 6px; font-size: 12px; color: #94a3b8; }
      .empty { padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.03); color: #94a3b8; font-size: 12px; }
      .footer { margin-top: 22px; font-size: 11px; color: #94a3b8; text-align: center; }
      a { color: #7dd3fc; text-decoration: none; }
      @media print {
        body { padding: 0; background: #0f172a; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div class="row between gap">
          <div>
            <div class="row gap-sm">
              <img class="logo" src="${escapeHtml(logo)}" alt="${escapeHtml(brandName)}" />
              <div class="muted" style="font-size:12px;">AI Visibility Audit Report</div>
            </div>
            <h1 class="title-xl">${escapeHtml(brandName)} audit delivery</h1>
            <div class="body small">${escapeHtml(url)}</div>
            <div class="meta">Audit ${escapeHtml(auditId)} • ${escapeHtml(formatDate(result?.analyzed_at || result?.created_at))}</div>
          </div>
          <div style="text-align:right;">
            <div class="score" style="color:${tone.color};">${escapeHtml(score)}</div>
            <div class="score-sub">${escapeHtml(tone.label)} visibility</div>
          </div>
        </div>
      </div>

      <div class="section grid-3">
        <div class="card">
          <div class="label">Top line</div>
          <div class="metric">${escapeHtml(result?.summary || 'Evidence-backed AI visibility audit')}</div>
        </div>
        <div class="card">
          <div class="label">Threat posture</div>
          <div class="metric">${escapeHtml(riskLevel)}</div>
          <div class="meta">HTTPS ${result?.technical_signals?.https_enabled ? 'enabled' : 'disabled'}</div>
        </div>
        <div class="card">
          <div class="label">Evidence integrity</div>
          <div class="metric">${escapeHtml(Math.round(Number(integrity?.evidence_ref_integrity_percent || 0)))}%</div>
          <div class="meta">${escapeHtml(Number(integrity?.verified_recommendations || 0))} verified recommendations</div>
        </div>
        <div class="card">
          <div class="label">Execution class</div>
          <div class="metric">${escapeHtml(getExecutionClassLabel(executionClass))}</div>
          <div class="meta">${escapeHtml(executionClass)}</div>
        </div>
      </div>

      ${publicReportUrl ? `
      <div class="section">
        <div class="card">
          <div class="label">Public share link</div>
          <div class="body small"><a href="${escapeHtml(publicReportUrl)}">${escapeHtml(publicReportUrl)}</a></div>
        </div>
      </div>` : ''}

      <div class="section">
        <h2 class="title-lg">Evidence findings</h2>
        <div class="grid-2">${findingCards}</div>
      </div>

      <div class="section">
        <h2 class="title-lg">Recommended fixes</h2>
        <div class="grid-2">${recommendationCards}</div>
      </div>

      <div class="section">
        <h2 class="title-lg">Category grades</h2>
        <div class="grid-3">${categoryCards}</div>
      </div>

      <div class="section">
        <h2 class="title-lg">AI platform scores</h2>
        <div class="grid-3">${platformCards}</div>
      </div>

      ${(geoProfile || contradictionReport) ? `
      <div class="section">
        <h2 class="title-lg">GEO / SSFR truth layer</h2>
        <div class="grid-3">
          ${geoProfile ? `
          <div class="card compact">
            <div class="label">Source</div>
            <div class="metric">${geoProfile?.source_verified ? 'Verified' : 'Weak'}</div>
          </div>
          <div class="card compact">
            <div class="label">Signal</div>
            <div class="metric">${geoProfile?.signal_consistent ? 'Consistent' : 'Conflicted'}</div>
          </div>
          <div class="card compact">
            <div class="label">Information gain</div>
            <div class="metric">${escapeHtml(geoProfile?.information_gain || 'n/a')}</div>
          </div>
          ` : ''}
        </div>
        ${Array.isArray(contradictionReport?.issues) && contradictionReport.issues.length > 0 ? `
        <div class="card" style="margin-top: 12px;">
          <div class="label" style="margin-bottom: 8px;">Contradiction issues</div>
          <table style="width:100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Issue</th>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Severity</th>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Dimension</th>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Blocking</th>
              </tr>
            </thead>
            <tbody>
              ${contradictionReport.issues.map((issue: any) => `
                <tr>
                  <td style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(issue?.title)}</td>
                  <td style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(issue?.severity)}</td>
                  <td style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(issue?.dimension)}</td>
                  <td style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.06);">${issue?.blocking ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${strictRubric ? `
      <div class="section">
        <h2 class="title-lg">Strict rubric system</h2>
        <div class="grid-3">
          <div class="card compact">
            <div class="label">Reliability index</div>
            <div class="metric">${escapeHtml(strictRubric?.reliability_index_0_100)}/100</div>
          </div>
          <div class="card compact">
            <div class="label">Pass rate</div>
            <div class="metric">${escapeHtml(Math.round(Number(strictRubric?.pass_rate || 0) * 100))}%</div>
          </div>
          <div class="card compact">
            <div class="label">Cross-platform ready</div>
            <div class="metric">${strictRubric?.cross_platform_ready ? 'YES' : 'NO'}</div>
          </div>
        </div>
        <div class="card" style="margin-top: 12px;">
          <div class="label" style="margin-bottom: 8px;">Gate outcomes</div>
          <table style="width:100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Gate</th>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Status</th>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Score</th>
                <th style="text-align:left; padding:6px; border-bottom:1px solid rgba(255,255,255,0.12);">Threshold</th>
              </tr>
            </thead>
            <tbody>${strictGateRows}</tbody>
          </table>
        </div>
        ${strictFixpacks ? `<div class="grid-2" style="margin-top: 12px;">${strictFixpacks}</div>` : ''}
      </div>
      ` : ''}

      <div class="footer">${escapeHtml(footer)}</div>
    </div>
  </body>
</html>`;
}

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  let browser: any = null;
  try {
    const puppeteer = await import('puppeteer-core');
    let executablePath: string | undefined = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      try {
        const { default: chromium } = await import('@sparticuz/chromium');
        executablePath = await chromium.executablePath() || undefined;
      } catch { /* fallback */ }
    }
    browser = await puppeteer.default.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
    await browser.close();
    return Buffer.from(pdf);
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch { }
    }
    throw error;
  }
}

export async function generateAuditPdfBuffer(args: {
  auditId: string;
  url: string;
  result: any;
  branding?: UserBranding | null;
  branded?: boolean;
  publicReportUrl?: string | null;
}): Promise<{ html: string; pdf: Buffer }> {
  const html = buildAuditReportHtml(args);
  const pdf = await renderPdfFromHtml(html);
  return { html, pdf };
}
