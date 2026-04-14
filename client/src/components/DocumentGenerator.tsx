// client/src/components/DocumentGenerator.tsx
import React, { useState, useEffect } from "react";
import { FileText, Download, FileSpreadsheet, Loader2, CheckCircle, Lock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getAnalysisExecutionClass, type AnalysisExecutionClass, type AnalysisResponse, TIER_LIMITS, type CanonicalTier } from "@shared/types";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import { apiFetch } from "../utils/api";

interface DocumentGeneratorProps {
  result: AnalysisResponse;
}

interface Branding {
  company_name?: string;
  logo_base64?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  footer_text?: string;
}

const DEFAULT_EXPORT_BRAND_NAME = 'AiVIS';
const DEFAULT_EXPORT_LOGO_URL = '/aivis-logo.png';
const ENTERPRISE_EXPORT_LOGO_URL = '/full-logo.png';
const BRANDED_EXPORT_CREDIT_COST = 1;

function getExecutionClassLabel(executionClass: AnalysisExecutionClass): string {
  if (executionClass === "LIVE") return "Live pipeline";
  if (executionClass === "DETERMINISTIC_FALLBACK") return "Deterministic fallback";
  if (executionClass === "SCRAPE_ONLY") return "Scrape-only";
  return "Upload analysis";
}

// Generate CSV content from analysis result
function generateCSV(result: AnalysisResponse): string {
  const rows: string[][] = [];

  // Header
  rows.push(["AI Visibility Analysis Report"]);
  rows.push(["Generated:", new Date().toISOString()]);
  rows.push(["URL:", result.url || "N/A"]);
  rows.push([""]);

  // Text Summary
  if (result.text_summary) {
    rows.push(["Executive Summary"]);
    rows.push(["Intro", result.text_summary.intro]);
    rows.push([""]);
    rows.push(["#", "Finding", "Explanation", "Fix"]);
    result.text_summary.findings.forEach((f, i) => {
      rows.push([`${i + 1}`, f.title, f.explanation, f.fix || ""]);
    });
    rows.push([""]);
    if (result.text_summary.priority_order.length > 0) {
      rows.push(["Recommended Fix Order"]);
      result.text_summary.priority_order.forEach((item, i) => {
        rows.push([`${i + 1}`, item]);
      });
      rows.push([""]);
    }
    rows.push(["Closing", result.text_summary.closing]);
    rows.push([""]);
  }

  // Overall Metrics
  rows.push(["Metric", "Value", "Status"]);
  rows.push(["Visibility Score", `${result.visibility_score}/100`, getScoreStatus(result.visibility_score)]);
  rows.push(["Execution Class", getExecutionClassLabel(getAnalysisExecutionClass(result)), "Runtime Mode"]);
  if (result.geo_signal_profile) {
    rows.push(["SSFR Source Verified", result.geo_signal_profile.source_verified ? "Yes" : "No"]);
    rows.push(["SSFR Signal Consistent", result.geo_signal_profile.signal_consistent ? "Yes" : "No"]);
    rows.push(["SSFR Information Gain", result.geo_signal_profile.information_gain]);
    rows.push(["SSFR Relationship Anchored", result.geo_signal_profile.relationship_anchored ? "Yes" : "No"]);
  }
  if (result.contradiction_report) {
    rows.push(["Contradiction Status", result.contradiction_report.status]);
    rows.push(["Contradiction Blockers", `${result.contradiction_report.blocker_count}`]);
    rows.push(["Contradiction Issues", `${result.contradiction_report.issue_count}`]);
  }
  rows.push(["Word Count", `${result.content_analysis?.word_count || 0}`, getWordCountStatus(result.content_analysis?.word_count || 0)]);
  rows.push(["Schema Types", `${result.schema_markup?.json_ld_count || 0}`, (result.schema_markup?.json_ld_count ?? 0) > 0 ? "Present" : "Missing"]);
  rows.push(["HTTPS Enabled", result.technical_signals?.https_enabled ? "Yes" : "No", result.technical_signals?.https_enabled ? "Secure" : "Critical"]);
  rows.push(["H1 Tag Present", result.content_analysis?.has_proper_h1 ? "Yes" : "No", result.content_analysis?.has_proper_h1 ? "Good" : "Critical"]);
  rows.push([""]);

  // Goal Alignment
  if (result.goal_alignment || (result.findability_goals && result.findability_goals.length > 0)) {
    rows.push(["Findability Goal Alignment"]);
    rows.push(["Goal Coverage", `${Math.round((result.goal_alignment?.coverage || 0) * 100)}%`]);
    rows.push(["Score Impact", `${(result.goal_alignment?.score_adjustment || 0) > 0 ? '+' : ''}${result.goal_alignment?.score_adjustment || 0}`]);
    if (result.findability_goals && result.findability_goals.length > 0) {
      rows.push(["Provided Goals", result.findability_goals.join(' | ')]);
    }
    if (result.goal_alignment?.matched_goals?.length) {
      rows.push(["Matched Goals", result.goal_alignment.matched_goals.join(' | ')]);
    }
    if (result.goal_alignment?.missing_goals?.length) {
      rows.push(["Missing Goals", result.goal_alignment.missing_goals.join(' | ')]);
    }
    rows.push([""]);
  }

  // AI Platform Scores
  if (result.ai_platform_scores) {
    rows.push(["AI Platform", "Score"]);
    rows.push(["ChatGPT", `${result.ai_platform_scores.chatgpt || 0}/100`]);
    rows.push(["Perplexity", `${result.ai_platform_scores.perplexity || 0}/100`]);
    rows.push(["Google AI", `${result.ai_platform_scores.google_ai || 0}/100`]);
    rows.push(["Claude", `${result.ai_platform_scores.claude || 0}/100`]);
    rows.push([""]);
  }

  if (result.ai_model_scores && result.ai_model_scores.length > 0) {
    rows.push(["Methodology Benchmark Model", "Score", "Used In Pipeline"]);
    result.ai_model_scores.forEach((model) => {
      rows.push([
        model.model_label,
        `${model.score}/100`,
        model.used_in_pipeline ? "Yes" : "No",
      ]);
    });
    rows.push([""]);
  }

  if (result.strict_rubric) {
    rows.push(["Strict Rubric System"]);
    rows.push(["Rubric Version", result.strict_rubric.version]);
    rows.push(["Reliability Index", `${result.strict_rubric.reliability_index_0_100}/100`]);
    rows.push(["Pass Rate", `${Math.round((result.strict_rubric.pass_rate || 0) * 100)}%`]);
    rows.push(["Cross Platform Ready", result.strict_rubric.cross_platform_ready ? "Yes" : "No"]);
    rows.push(["Expected Delta Band", `+${result.strict_rubric.guarantee_policy.expected_delta_band.min} to +${result.strict_rubric.guarantee_policy.expected_delta_band.max}`]);
    rows.push([""]);

    rows.push(["Rubric Gates", "Status", "Score", "Threshold"]);
    result.strict_rubric.gates.forEach((gate) => {
      rows.push([gate.label, gate.status.toUpperCase(), `${gate.score_0_100}/100`, `${gate.threshold_pass}`]);
    });
    rows.push([""]);

    if (result.strict_rubric.required_fixpacks.length > 0) {
      rows.push(["Required Fixpacks", "Target Gates", "Expected Lift", "Actions"]);
      result.strict_rubric.required_fixpacks.forEach((pack) => {
        rows.push([
          pack.label,
          pack.target_gate_ids.join(' | '),
          `+${pack.estimated_score_lift_min} to +${pack.estimated_score_lift_max}`,
          (pack.actions || []).join(' | '),
        ]);
      });
      rows.push([""]);
    }
  }

  // Recommendations
  if (result.recommendations && result.recommendations.length > 0) {
    rows.push(["Priority Recommendations"]);
    rows.push(["#", "Title", "Impact", "Description"]);
    result.recommendations.forEach((rec, idx) => {
      rows.push([
        `${idx + 1}`,
        rec.title,
        rec.impact || "Medium",
        rec.description || ""
      ]);
    });
    rows.push([""]);
  }

  // Topical Keywords
  if (result.topical_keywords && result.topical_keywords.length > 0) {
    rows.push(["Topical Keywords"]);
    result.topical_keywords.slice(0, 20).forEach((kw, idx) => {
      rows.push([`${idx + 1}. ${kw}`]);
    });
    rows.push([""]);
  }

  // Technical Details
  rows.push(["Technical SEO Details"]);
  rows.push(["Check", "Status"]);
  rows.push(["HTTPS Enforced", result.technical_signals?.https_enabled ? "Yes" : "No"]);
  rows.push(["Canonical Tag", result.technical_signals?.has_canonical ? "Present" : "Missing"]);
  rows.push(["Meta Description", result.content_analysis?.has_meta_description ? "Present" : "Missing"]);
  rows.push(["Robots.txt", result.technical_signals?.has_robots_txt ? "Present" : "Missing"]);

  // Convert to CSV format
  return rows.map(row =>
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma/newline
      const escaped = String(cell).replace(/"/g, '""');
      return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
    }).join(',')
  ).join('\n');
}

// Generate HTML report for PDF conversion
function generateHTMLReport(
  result: AnalysisResponse,
  branding?: Branding | null,
  options?: { includeEnterpriseAivisBranding?: boolean }
): string {
  const score = result.visibility_score;
  const executionClass = getAnalysisExecutionClass(result);
  const executionClassLabel = getExecutionClassLabel(executionClass);
  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#06b6d4' : score >= 40 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Improvement' : 'Critical';

  const brandPrimary = branding?.primary_color || scoreColor;
  const brandName = (branding?.company_name || DEFAULT_EXPORT_BRAND_NAME).trim();
  const brandLogo = branding?.logo_base64 || branding?.logo_url || DEFAULT_EXPORT_LOGO_URL;
  const brandFooter = branding?.footer_text || '';
  const includeEnterpriseAivisBranding = Boolean(options?.includeEnterpriseAivisBranding);

  const logoHTML = brandLogo
    ? `<img src="${brandLogo}" alt="${brandName}" style="height: 40px; margin-right: 16px; vertical-align: middle;" />`
    : '';

  const enterpriseLogoHeaderHTML = includeEnterpriseAivisBranding
    ? `<div style="margin-top: 12px;"><img src="${ENTERPRISE_EXPORT_LOGO_URL}" alt="AiVIS" style="height: 32px; width: auto;" /></div>`
    : '';

  const enterpriseLogoFooterHTML = includeEnterpriseAivisBranding
    ? `<div style="margin-bottom: 10px;"><img src="${ENTERPRISE_EXPORT_LOGO_URL}" alt="AiVIS" style="height: 28px; width: auto;" /></div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Visibility Analysis Report - ${result.url}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 40px;
      background: #ffffff;
    }
    .header {
      border-bottom: 3px solid ${brandPrimary};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      color: #111827;
      margin-bottom: 8px;
    }
    .header .meta {
      color: #6b7280;
      font-size: 14px;
    }
    .score-card {
      background: linear-gradient(135deg, ${scoreColor}15 0%, ${scoreColor}05 100%);
      border: 2px solid ${scoreColor};
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
    }
    .score-value {
      font-size: 48px;
      font-weight: bold;
      color: ${scoreColor};
      margin: 12px 0;
    }
    .score-label {
      font-size: 18px;
      color: #4b5563;
      font-weight: 600;
    }
    .section {
      margin: 32px 0;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
    }
    .metric-label {
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
    }
    .metric-status {
      font-size: 12px;
      margin-top: 4px;
      font-weight: 600;
    }
    .metric-status.good { color: #10b981; }
    .metric-status.warning { color: #f59e0b; }
    .metric-status.critical { color: #ef4444; }
    .recommendation {
      background: #ffffff;
      border-left: 4px solid #6366f1;
      padding: 16px;
      margin: 12px 0;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .recommendation-title {
      font-weight: 600;
      color: #111827;
      margin-bottom: 6px;
      font-size: 16px;
    }
    .recommendation-desc {
      color: #4b5563;
      font-size: 14px;
      line-height: 1.5;
    }
    .recommendation-impact {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 8px;
      text-transform: uppercase;
    }
    .keywords-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
    }
    .keyword-tag {
      background: #ede9fe;
      color: #5b21b6;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
    }
    .technical-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .technical-table th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #e5e7eb;
    }
    .technical-table td {
      padding: 12px;
      border: 1px solid #e5e7eb;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-badge.pass {
      background: #d1fae5;
      color: #065f46;
    }
    .status-badge.fail {
      background: #fee2e2;
      color: #991b1b;
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 13px;
    }
    @media print {
      body { padding: 20px; }
      .score-card { page-break-inside: avoid; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoHTML}<span style="font-size: 12px; color: #6b7280; vertical-align: middle;">${brandName !== DEFAULT_EXPORT_BRAND_NAME ? brandName : ''}</span>
    ${enterpriseLogoHeaderHTML}
    <h1>${brandName !== DEFAULT_EXPORT_BRAND_NAME ? brandName + ': ' : ''}Evidence-backed site analysis for AI answers Platform Analysis Report</h1>
    <div class="meta">
      <strong>URL:</strong> ${result.url || 'N/A'}<br>
      <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
      <strong>Analyzed:</strong> ${result.analyzed_at ? new Date(result.analyzed_at).toLocaleString() : 'Just now'}<br>
      <strong>Execution Class:</strong> ${executionClassLabel}
    </div>
  </div>

  <div class="score-card">
    <div class="score-label">Overall AI Visibility Score</div>
    <div class="score-value">${score}<span style="font-size: 24px; color: #6b7280;">/100</span></div>
    <div class="score-label">${scoreLabel}</div>
  </div>

  ${result.text_summary ? `
  <div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <p style="color: #374151; line-height: 1.7; margin-bottom: 20px;">${result.text_summary.intro}</p>

    ${result.text_summary.findings.map((f, i) => `
    <div class="recommendation">
      <div class="recommendation-title">${i + 1}. ${f.title}</div>
      <div class="recommendation-desc">${f.explanation}</div>
      ${f.fix ? `<div style="margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 6px; font-size: 13px; color: #166534;"><strong>How to fix it:</strong> ${f.fix}</div>` : ''}
    </div>
    `).join('')}

    ${result.text_summary.priority_order.length > 0 ? `
    <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <div style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Recommended Fix Order</div>
      <ol style="padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
        ${result.text_summary.priority_order.map((item) => `<li>${item}</li>`).join('')}
      </ol>
    </div>
    ` : ''}

    <p style="color: #6b7280; line-height: 1.7; margin-top: 20px; font-style: italic;">${result.text_summary.closing}</p>
  </div>
  ` : ''}

  ${(result.geo_signal_profile || result.contradiction_report) ? `
  <div class="section">
    <h2 class="section-title">GEO / SSFR Truth Layer</h2>
    <div class="metrics-grid">
      ${result.geo_signal_profile ? `
      <div class="metric-card">
        <div class="metric-label">Source</div>
        <div class="metric-value" style="font-size: 20px;">${result.geo_signal_profile.source_verified ? 'Verified' : 'Weak'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Signal</div>
        <div class="metric-value" style="font-size: 20px;">${result.geo_signal_profile.signal_consistent ? 'Consistent' : 'Conflicted'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Information Gain</div>
        <div class="metric-value" style="font-size: 20px;">${result.geo_signal_profile.information_gain}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Relationship</div>
        <div class="metric-value" style="font-size: 20px;">${result.geo_signal_profile.relationship_anchored ? 'Anchored' : 'Weak'}</div>
      </div>
      ` : ''}
    </div>

    ${result.contradiction_report && result.contradiction_report.issues.length > 0 ? `
      <table class="technical-table" style="margin-top:16px;">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Severity</th>
            <th>Dimension</th>
            <th>Blocking</th>
          </tr>
        </thead>
        <tbody>
          ${result.contradiction_report.issues.map((issue) => `
            <tr>
              <td>${issue.title}</td>
              <td>${issue.severity}</td>
              <td>${issue.dimension}</td>
              <td>${issue.blocking ? 'Yes' : 'No'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Key Metrics</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Content Depth</div>
        <div class="metric-value">${result.content_analysis?.word_count || 0}</div>
        <div class="metric-status ${(result.content_analysis?.word_count || 0) >= 800 ? 'good' : (result.content_analysis?.word_count || 0) >= 300 ? 'warning' : 'critical'}">
          ${(result.content_analysis?.word_count || 0) >= 800 ? 'Comprehensive' : (result.content_analysis?.word_count || 0) >= 300 ? 'Adequate' : 'Thin Content'}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Structured Data</div>
        <div class="metric-value">${result.schema_markup?.json_ld_count || 0}</div>
        <div class="metric-status ${(result.schema_markup?.json_ld_count ?? 0) > 0 ? 'good' : 'critical'}">
          ${(result.schema_markup?.json_ld_count ?? 0) > 0 ? 'Implemented' : 'Missing'}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">H1 Tag</div>
        <div class="metric-value">${result.content_analysis?.has_proper_h1 ? '' : ''}</div>
        <div class="metric-status ${result.content_analysis?.has_proper_h1 ? 'good' : 'critical'}">
          ${result.content_analysis?.has_proper_h1 ? 'Present' : 'Missing'}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">HTTPS</div>
        <div class="metric-value">${result.technical_signals?.https_enabled ? '' : ''}</div>
        <div class="metric-status ${result.technical_signals?.https_enabled ? 'good' : 'critical'}">
          ${result.technical_signals?.https_enabled ? 'Secure' : 'Not Secure'}
        </div>
      </div>
    </div>
  </div>

  ${result.ai_platform_scores ? `
  <div class="section">
    <h2 class="section-title">AI Platform Visibility Scores</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">ChatGPT</div>
        <div class="metric-value">${result.ai_platform_scores.chatgpt || 0}<span style="font-size: 14px; color: #6b7280;">/100</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Perplexity</div>
        <div class="metric-value">${result.ai_platform_scores.perplexity || 0}<span style="font-size: 14px; color: #6b7280;">/100</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Google AI</div>
        <div class="metric-value">${result.ai_platform_scores.google_ai || 0}<span style="font-size: 14px; color: #6b7280;">/100</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Claude</div>
        <div class="metric-value">${result.ai_platform_scores.claude || 0}<span style="font-size: 14px; color: #6b7280;">/100</span></div>
      </div>
    </div>
  </div>
  ` : ''}

  ${result.ai_model_scores && result.ai_model_scores.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Methodology Benchmark Model Scores</h2>
    <div class="metrics-grid">
      ${result.ai_model_scores.map((model) => `
      <div class="metric-card">
        <div class="metric-label">${model.model_label}</div>
        <div class="metric-value">${model.score}<span style="font-size: 14px; color: #6b7280;">/100</span></div>
        <div class="metric-status ${model.used_in_pipeline ? 'good' : 'warning'}">
          ${model.used_in_pipeline ? 'Used in this audit' : 'Methodology benchmark'}
        </div>
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${(result.goal_alignment || (result.findability_goals && result.findability_goals.length > 0)) ? `
  <div class="section">
    <h2 class="section-title">Findability Goal Alignment</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Goal Coverage</div>
        <div class="metric-value">${Math.round((result.goal_alignment?.coverage || 0) * 100)}<span style="font-size: 14px; color: #6b7280;">%</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Score Impact</div>
        <div class="metric-value">${(result.goal_alignment?.score_adjustment || 0) > 0 ? '+' : ''}${result.goal_alignment?.score_adjustment || 0}</div>
      </div>
    </div>

    ${result.findability_goals && result.findability_goals.length > 0 ? `
      <div style="margin-top: 16px;">
        <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Provided Goals</div>
        <div class="keywords-list">
          ${result.findability_goals.map((goal) => `<span class="keyword-tag">${goal}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    ${result.goal_alignment?.matched_goals && result.goal_alignment.matched_goals.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 13px; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Matched Goals</div>
        <ul style="padding-left: 18px; color: #111827;">
          ${result.goal_alignment.matched_goals.map((goal) => `<li style="margin-bottom: 4px;">${goal}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${result.goal_alignment?.missing_goals && result.goal_alignment.missing_goals.length > 0 ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Missing Goals</div>
        <ul style="padding-left: 18px; color: #111827;">
          ${result.goal_alignment.missing_goals.map((goal) => `<li style="margin-bottom: 4px;">${goal}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>
  ` : ''}

  ${result.strict_rubric ? `
  <div class="section">
    <h2 class="section-title">Strict Rubric System</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Reliability Index</div>
        <div class="metric-value">${result.strict_rubric.reliability_index_0_100}<span style="font-size: 14px; color: #6b7280;">/100</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pass Rate</div>
        <div class="metric-value">${Math.round((result.strict_rubric.pass_rate || 0) * 100)}<span style="font-size: 14px; color: #6b7280;">%</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Cross-Platform Ready</div>
        <div class="metric-value" style="font-size: 20px;">${result.strict_rubric.cross_platform_ready ? 'YES' : 'NO'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Directional Delta Band</div>
        <div class="metric-value" style="font-size: 20px;">+${result.strict_rubric.guarantee_policy.expected_delta_band.min} to +${result.strict_rubric.guarantee_policy.expected_delta_band.max}</div>
      </div>
    </div>

    <table class="technical-table" style="margin-top:16px;">
      <thead>
        <tr>
          <th>Gate</th>
          <th>Status</th>
          <th>Score</th>
          <th>Threshold</th>
        </tr>
      </thead>
      <tbody>
        ${result.strict_rubric.gates.map((gate) => `
          <tr>
            <td>${gate.label}</td>
            <td><span class="status-badge ${gate.status === 'pass' ? 'pass' : 'fail'}">${gate.status.toUpperCase()}</span></td>
            <td>${gate.score_0_100}/100</td>
            <td>${gate.threshold_pass}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${result.strict_rubric.required_fixpacks.length > 0 ? `
      <div style="margin-top: 16px;">
        <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Required Fixpacks</div>
        ${result.strict_rubric.required_fixpacks.map((pack, idx) => `
          <div class="recommendation">
            <div class="recommendation-title">${idx + 1}. ${pack.label}</div>
            <div class="recommendation-desc">Targets: ${pack.target_gate_ids.join(', ')}</div>
            <div class="recommendation-desc">Expected lift: +${pack.estimated_score_lift_min} to +${pack.estimated_score_lift_max}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  </div>
  ` : ''}

  ${result.recommendations && result.recommendations.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Priority Recommendations</h2>
    ${result.recommendations.map((rec, idx) => `
      <div class="recommendation">
        <div class="recommendation-title">${idx + 1}. ${rec.title}</div>
        <div class="recommendation-desc">${rec.description || 'No description available'}</div>
        ${rec.impact ? `<div class="recommendation-impact">${rec.impact}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${result.topical_keywords && result.topical_keywords.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Topical Keywords Detected</h2>
    <div class="keywords-list">
      ${result.topical_keywords.slice(0, 20).map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Technical SEO Checklist</h2>
    <table class="technical-table">
      <thead>
        <tr>
          <th>Check</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>HTTPS Encryption</td>
          <td><span class="status-badge ${result.technical_signals?.https_enabled ? 'pass' : 'fail'}">${result.technical_signals?.https_enabled ? 'PASS' : 'FAIL'}</span></td>
        </tr>
        <tr>
          <td>Canonical Tag</td>
          <td><span class="status-badge ${result.technical_signals?.has_canonical ? 'pass' : 'fail'}">${result.technical_signals?.has_canonical ? 'PASS' : 'FAIL'}</span></td>
        </tr>
        <tr>
          <td>Meta Description</td>
          <td><span class="status-badge ${result.content_analysis?.has_meta_description ? 'pass' : 'fail'}">${result.content_analysis?.has_meta_description ? 'PASS' : 'FAIL'}</span></td>
        </tr>
        <tr>
          <td>H1 Heading</td>
          <td><span class="status-badge ${result.content_analysis?.has_proper_h1 ? 'pass' : 'fail'}">${result.content_analysis?.has_proper_h1 ? 'PASS' : 'FAIL'}</span></td>
        </tr>
        <tr>
          <td>Schema.org Markup</td>
          <td><span class="status-badge ${(result.schema_markup?.json_ld_count ?? 0) > 0 ? 'pass' : 'fail'}">${(result.schema_markup?.json_ld_count ?? 0) > 0 ? 'PASS' : 'FAIL'}</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    ${enterpriseLogoFooterHTML}
    <p><strong>${brandName}</strong> - Professional SEO & AI Search Analysis</p>
    <p>${brandFooter || 'This report provides actionable insights for improving your visibility in AI-powered search engines.'}</p>
    ${brandName !== DEFAULT_EXPORT_BRAND_NAME ? '<p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">Powered by AiVIS</p>' : ''}
  </div>
</body>
</html>
  `.trim();
}

function getScoreStatus(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs Improvement";
  return "Critical";
}

function getWordCountStatus(count: number): string {
  if (count >= 800) return "Comprehensive";
  if (count >= 300) return "Adequate";
  return "Thin Content";
}

const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ result }) => {
  const [generating, setGenerating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  // Fetch branding for Signal+ users (Signal, Score Fix)
  useEffect(() => {
    const canUseBranding = TIER_LIMITS[(user?.tier as CanonicalTier) || 'observer']?.hasWhiteLabel === true;
    if (!canUseBranding || !token) return;
    apiFetch(`/api/features/branding`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.data) setBranding(d.data); })
      .catch(() => { console.warn("Branding fetch failed - export will be unbranded"); });
  }, [token, user?.tier]);

  const requestExportSession = async (branded: boolean) => {
    if (!token) {
      throw new Error("Sign in required before exporting reports");
    }

    const response = await apiFetch(`/api/features/exports/report-pdf-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ branded }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || "Export is not available on your current tier");
    }

    return payload?.data ?? {};
  };

  const downloadCSV = async () => {
    setGenerating("csv");
    setSuccess(null);

    try {
      await requestExportSession(false);

      const csv = generateCSV(result);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `ai-visibility-report-${result.url?.replace(/[^a-z0-9]/gi, '-') || 'analysis'}-${new Date().toISOString().split('T')[0]}.csv`;

      link.href = url;
      link.download = filename;
      link.click();

      URL.revokeObjectURL(url);
      setSuccess("CSV report downloaded successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("CSV generation error:", error);
      setSuccess(null);
      // Use toast if available, otherwise show inline (don't route through success state)
      const msg = error instanceof Error ? error.message : "CSV generation failed";
      if (typeof window !== 'undefined' && (window as any).__toast_error) (window as any).__toast_error(msg);
      else setSuccess(`⚠ ${msg}`);
    } finally {
      setGenerating(null);
    }
  };

  const downloadPDF = async () => {
    setGenerating("pdf");
    setSuccess(null);

    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const canUseBrandedExport = Boolean(
        branding && TIER_LIMITS[(user?.tier as CanonicalTier) || 'observer']?.hasWhiteLabel && token
      );
      let approvedBranding = branding;

      // Validate session (and deduct credit for branded) before generating
      const exportSession = await requestExportSession(canUseBrandedExport);
      if (canUseBrandedExport) {
        approvedBranding = exportSession?.branding || approvedBranding;
      }

      const html = generateHTMLReport(result, approvedBranding, {
        includeEnterpriseAivisBranding: canUseBrandedExport,
      });

      // POST to server - Puppeteer renders a real .pdf file
      const pdfRes = await fetch(`${base}/api/features/exports/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ html, branded: canUseBrandedExport }),
      });

      if (!pdfRes.ok) {
        const errPayload = await pdfRes.json().catch(() => ({}));
        throw new Error(errPayload?.error || "PDF generation failed");
      }

      // Stream the binary PDF to a real file download
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const domain = (() => { try { return new URL(result.url || "").hostname; } catch { return "report"; } })();
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `aivis-report-${domain}-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(
        canUseBrandedExport
          ? `Branded PDF downloaded - ${BRANDED_EXPORT_CREDIT_COST.toFixed(2)} credit used`
          : "PDF report downloaded"
      );
      setTimeout(() => setSuccess(null), 4000);
    } catch (error) {
      console.error("PDF generation error:", error);
      setSuccess(error instanceof Error ? error.message : "PDF generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const tierKey = (user?.tier as CanonicalTier) || 'observer';
  const hasExports = TIER_LIMITS[tierKey]?.hasExports !== false;

  if (!hasExports) {
    return (
      <div className="card-charcoal/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-6 h-6 text-white/50" />
          <h3 className="text-xl font-bold text-white/70">Export Report</h3>
        </div>
        <p className="text-white/55 mb-4 text-sm">
          PDF and CSV exports are available on paid plans. Upgrade to download full reports with detailed fix guidance.
        </p>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25"
        >
          View Plans
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="card-charcoal/50 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-6 h-6 text-white/80" />
        <h3 className="text-xl font-bold text-white">Export Report</h3>
      </div>

      <p className="text-white/55 mb-6 text-sm">
        Download your analysis report in your preferred format for compliance, documentation, or stakeholder sharing.
      </p>

      {branding && (user?.tier === "signal" || user?.tier === "scorefix") && (
        <p className="-mt-3 mb-6 text-xs text-amber-200/85">
          Branded PDF export uses your workspace white-label profile and deducts {BRANDED_EXPORT_CREDIT_COST.toFixed(2)} credit per export.
        </p>
      )}

      {success && (
        <div className="mb-4 p-3 card-charcoal/30 rounded-lg flex items-center gap-2 text-white/80">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={downloadPDF}
          disabled={!!generating}
          className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-white/22 to-white/14 text-white rounded-lg font-semibold hover:from-white/22 hover:to-white/14 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/20"
        >
          {generating === "pdf" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              {branding && (user?.tier === "signal" || user?.tier === "scorefix") ? `Export branded PDF • ${BRANDED_EXPORT_CREDIT_COST.toFixed(2)} credit` : "Export as PDF"}
            </>
          )}
        </button>

        <button
          onClick={downloadCSV}
          disabled={!!generating}
          className="flex items-center justify-center gap-3 px-6 py-4 bg-charcoal border-2 border-white/10 text-white/80 rounded-lg font-semibold hover:bg-charcoal-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating === "csv" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating CSV...
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-5 h-5" />
              Export as CSV
            </>
          )}
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-white/10">
        <h4 className="font-semibold text-white mb-3">What's Included:</h4>
        <ul className="space-y-2 text-sm text-white/55">
          <li className="flex items-start gap-2">
            <span className="text-white/80 font-bold">•</span>
            <span>Complete visibility score breakdown with AI platform-specific scores</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-white/80 font-bold">•</span>
            <span>Prioritized recommendations with impact assessments</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-white/80 font-bold">•</span>
            <span>Technical SEO checklist with pass/fail status</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-white/80 font-bold">•</span>
            <span>Topical keywords and content analysis details</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-white/80 font-bold">•</span>
            <span>Findability goal alignment, coverage, and score impact (when goals are provided)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-white/80 font-bold">•</span>
            <span>Strict rubric gate outcomes, reliability index, and required fixpacks</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default DocumentGenerator;
