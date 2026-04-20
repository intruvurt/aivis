/**
 * AUDIT RESULT PAGE
 *
 * Displays the authenticated user's audit result using the evidence-first ReportCard.
 * Fetches from /api/audits/:id endpoint directly without transformation.
 *
 * URL: /result/:auditId
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Lock, RotateCcw, Download, Share2 } from 'lucide-react';
import type { AnalysisResponse, AuditResult } from '@shared/types';

import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import EvidenceFirstReportCard from '../components/EvidenceFirstReportCard';

interface AuditResponse {
  id: string;
  url: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  visibility_score?: number;
  result?: AnalysisResponse | AuditResult;
  error?: string;
  [key: string]: unknown;
}

export default function AuditResultPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Page meta for SEO
  const pageMeta = useMemo(() => {
    if (audit?.result) {
      const result = audit.result;
      let domain: string;
      try {
        const urlStr = 'url' in result ? result.url : result.url || 'Unknown';
        domain = new URL(urlStr).hostname;
      } catch {
        domain = audit.url || 'Audit';
      }
      const timestamp = new Date(audit.created_at).toLocaleDateString();
      return {
        title: `Audit Result: ${domain}`,
        description: `Evidence-first audit result for ${domain}. Analyzed ${timestamp}.`,
        path: `/result/${auditId}`,
      };
    }
    return {
      title: 'Audit Result',
      description: 'View your evidence-first AI visibility audit result.',
      path: `/result/${auditId}`,
    };
  }, [audit, auditId]);

  usePageMeta(pageMeta);

  // Fetch audit result
  useEffect(() => {
    if (!auditId) {
      setError('Missing audit ID');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const endpoint = `${API_URL || ''}/api/audits/${encodeURIComponent(auditId)}`;
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError('Please log in to view this audit');
            return;
          }
          if (response.status === 403) {
            setError('You do not have permission to view this audit');
            return;
          }
          if (response.status === 404) {
            setError('Audit not found');
            return;
          }
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || `Failed to load audit (HTTP ${response.status})`);
        }

        const data: AuditResponse = await response.json();
        setAudit(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load audit result';
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError('Request timeout. Please try again.');
        } else {
          setError(message);
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [auditId]);

  // Handle re-analyze
  const handleReanalyze = async () => {
    if (!audit?.url) return;

    try {
      setReanalyzing(true);

      // POST to /api/analyze with the URL
      const response = await fetch(`${API_URL || ''}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: audit.url,
          forceRefresh: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Re-analysis failed (HTTP ${response.status})`);
      }

      // Optionally: navigate to a pending state or refresh current page
      // For now, just show a toast/alert
      alert('Re-analysis started. Check back shortly for updated results.');

      // Refresh the current audit
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Re-analysis failed';
      alert(message);
    } finally {
      setReanalyzing(false);
    }
  };

  // Handle view evidence — navigate to evidence registry filtered by this audit
  const handleViewEvidence = () => {
    navigate(`/app/evidence?auditId=${auditId}`);
  };

  // Handle compare — navigate to analytics showing this audit's score in context
  const handleCompare = () => {
    navigate(`/app/analytics?highlight=${auditId}`);
  };

  // Render
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header/Breadcrumb */}
      <header className="border-b border-slate-700/30 sticky top-0 z-40 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Audit Result</h1>
            {audit?.status && <p className="text-xs text-slate-400">Status: {audit.status}</p>}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-4" />
            <p className="text-slate-300">Loading audit result...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300 mb-1">Error loading audit</p>
              <p className="text-sm text-rose-200">{error}</p>
              {error.includes('Please log in') && (
                <button
                  onClick={() => navigate('/login')}
                  className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors"
                >
                  Go to login
                </button>
              )}
            </div>
          </div>
        )}

        {/* Audit result - NOT YET COMPLETE state */}
        {audit && audit.status !== 'completed' && !loading && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 mb-1">Audit still processing</p>
              <p className="text-sm text-amber-200">
                {audit.status === 'pending' && 'Analysis is queued and will start shortly.'}
                {audit.status === 'processing' &&
                  'Analysis is running. Refresh the page to check for updates.'}
                {audit.status === 'failed' && `Analysis failed: ${audit.error || 'Unknown error'}`}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Refresh
              </button>
            </div>
          </div>
        )}

        {/* Audit result - COMPLETED */}
        {audit && audit.status === 'completed' && audit.result && (
          <>
            {/* Evidence-first report card */}
            <EvidenceFirstReportCard
              result={audit.result}
              auditId={audit.id}
              onReanalyze={handleReanalyze}
              onViewEvidence={handleViewEvidence}
              onCompare={handleCompare}
              className="mb-8"
              hideActions={reanalyzing}
            />

            {/* Additional actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                disabled={reanalyzing}
                onClick={handleReanalyze}
                className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Re-analyze
              </button>

              <button
                onClick={() => {
                  if (!audit) return;
                  const exportPayload = {
                    id: audit.id,
                    url: audit.url,
                    analyzed_at: audit.created_at,
                    visibility_score: audit.visibility_score,
                    result: audit.result,
                  };
                  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
                    type: 'application/json',
                  });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  const domain = (() => {
                    try {
                      return new URL(audit.url || '').hostname;
                    } catch {
                      return 'audit';
                    }
                  })();
                  link.download = `aivis-audit-${domain}-${audit.id.slice(0, 8)}.json`;
                  link.click();
                  URL.revokeObjectURL(link.href);
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Export
              </button>

              <button
                onClick={async () => {
                  // Generate a shareable link — use the public report path if one exists,
                  // otherwise fall back to copying the current URL
                  const base = window.location.origin;
                  const shareUrl = `${base}/report/${audit?.id ?? auditId}`;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    // Show transient feedback without a full alert
                    const btn = document.activeElement as HTMLButtonElement;
                    const orig = btn.textContent;
                    btn.textContent = '✓ Copied!';
                    setTimeout(() => {
                      if (btn.textContent === '✓ Copied!') btn.textContent = orig;
                    }, 1800);
                  } catch {
                    window.prompt('Copy this share link:', shareUrl);
                  }
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>

            {/* Metadata footer */}
            <div className="mt-8 pt-6 border-t border-slate-700/30 text-xs text-slate-500">
              <p>
                Audit ID: <span className="font-mono">{audit.id}</span>
              </p>
              <p>
                Created:{' '}
                {new Date(audit.created_at).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
