import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  FileText,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Activity,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiFetch from '../utils/api';
import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import toast from 'react-hot-toast';
import { getScoreColor } from '../utils/scoreUtils';

/* ─── Types ─────────────────────────────────────── */

type AuditLogRow = {
  id: string;
  action_type: 'scan_run' | 'consent_update';
  subject: string;
  detail_num: number | null;
  detail_text: string | null;
  created_at: string;
};

type ConsentRecord = {
  id: string;
  consent_type: 'analytics' | 'marketing' | 'terms' | 'privacy' | 'consumer_disclaimer';
  status: 'accepted' | 'declined' | 'revoked';
  policy_version: string;
  source: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type Tab = 'audit-log' | 'consent' | 'export';

/* ─── Helpers ────────────────────────────────────── */

const CONSENT_LABELS: Record<string, { label: string; desc: string }> = {
  analytics: {
    label: 'Analytics',
    desc: 'Allows usage analytics to improve the product experience.',
  },
  marketing: {
    label: 'Marketing',
    desc: 'Allows personalised marketing and promotional communications.',
  },
  terms: {
    label: 'Terms of Service',
    desc: 'Acceptance of the AiVIS.biz Terms of Service.',
  },
  privacy: {
    label: 'Privacy Policy',
    desc: 'Acknowledgment of the AiVIS.biz Privacy Policy.',
  },
  consumer_disclaimer: {
    label: 'Consumer Disclaimer',
    desc: 'Acknowledgment that AiVIS.biz provides technical diagnostics, not legal advice.',
  },
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  scan_run: <Search className="w-3.5 h-3.5 text-emerald-400" />,
  consent_update: <Shield className="w-3.5 h-3.5 text-amber-400" />,
};

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-white/50';
  return getScoreColor(score);
}

function statusBadge(status: ConsentRecord['status']) {
  if (status === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
        <CheckCircle2 className="w-3 h-3" /> Accepted
      </span>
    );
  }
  if (status === 'declined') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
        <XCircle className="w-3 h-3" /> Declined
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium">
      <Clock className="w-3 h-3" /> Revoked
    </span>
  );
}

/* ─── Sub-components ─────────────────────────────── */

function TabButton({
  id,
  active,
  icon: Icon,
  label,
  onClick,
}: {
  id: Tab;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: (t: Tab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={[
        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
          : 'border border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/* ─── Audit Log Tab ──────────────────────────────── */

function AuditLogTab() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'scan_run' | 'consent_update'>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/compliance/audit-logs?limit=200`);
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Failed to load audit logs');
      setRows(body.data as AuditLogRow[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.action_type === filter);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );

  if (error)
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm py-8">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {error}
        <button
          type="button"
          onClick={load}
          className="ml-2 underline text-white/60 hover:text-white"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div>
      {/* Filter + refresh bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['all', 'scan_run', 'consent_update'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              filter === f
                ? 'bg-white/10 border-white/20 text-white'
                : 'border-white/8 text-white/50 hover:text-white/70 hover:border-white/15',
            ].join(' ')}
          >
            {f === 'all' ? 'All events' : f === 'scan_run' ? 'Scans' : 'Consent changes'}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 text-white/50 hover:text-white/70 hover:border-white/15 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-white/40 text-sm py-8 text-center">No events found.</p>
      ) : (
        <>
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider w-8"></th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider hidden md:table-cell">
                    Detail
                  </th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={[
                      'border-b border-white/[0.05] transition-colors hover:bg-white/[0.02]',
                      i === pageRows.length - 1 ? 'border-b-0' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3">
                      {ACTION_ICONS[row.action_type] ?? (
                        <Activity className="w-3.5 h-3.5 text-white/30" />
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <p className="text-white/80 truncate text-xs font-mono" title={row.subject}>
                        {row.subject}
                      </p>
                      <p className="text-white/35 text-[10px] mt-0.5">
                        {row.action_type === 'scan_run' ? 'Scan run' : 'Consent update'}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {row.action_type === 'scan_run' ? (
                        row.detail_num !== null ? (
                          <span className={`font-semibold ${scoreColor(row.detail_num)}`}>
                            Score {row.detail_num}
                          </span>
                        ) : null
                      ) : (
                        <span className="text-white/55 text-xs">{row.detail_text}</span>
                      )}
                      {row.detail_text && row.action_type === 'scan_run' && (
                        <span className="ml-2 text-white/30 text-[10px]">{row.detail_text}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white/35 text-xs whitespace-nowrap">
                      {formatTs(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-white/35">
                {filtered.length} events · page {page + 1} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/8 text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/8 text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Consent Tracking Tab ───────────────────────── */

function ConsentTrackingTab() {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/compliance/consent`);
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Failed to load consent records');
      setRecords(body.data as ConsentRecord[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allTypes = Object.keys(CONSENT_LABELS) as ConsentRecord['consent_type'][];

  // Build a map of type → record (most recent per type)
  const recordMap: Record<string, ConsentRecord | undefined> = {};
  for (const r of records) {
    if (!recordMap[r.consent_type]) recordMap[r.consent_type] = r;
  }

  const updateConsent = async (
    consentType: ConsentRecord['consent_type'],
    newStatus: 'accepted' | 'declined' | 'revoked'
  ) => {
    setUpdating(consentType);
    try {
      const res = await apiFetch(`${API_URL}/api/compliance/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentType, status: newStatus, source: 'web' }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Update failed');
      toast.success(`${CONSENT_LABELS[consentType]?.label ?? consentType} consent updated.`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update consent');
    } finally {
      setUpdating(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );

  if (error)
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm py-8">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {error}
        <button
          type="button"
          onClick={load}
          className="ml-2 underline text-white/60 hover:text-white"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45 mb-5 leading-relaxed">
        These records reflect your current consent status for each data category. Changes take
        effect immediately. Revoking consent for analytics or marketing only affects future data
        collection — it does not delete previously collected data.
      </p>

      {allTypes.map((type) => {
        const info = CONSENT_LABELS[type];
        const rec = recordMap[type];
        const isAccepted = rec?.status === 'accepted';
        const isBusy = updating === type;
        const isLocked = type === 'terms' || type === 'privacy';

        return (
          <div
            key={type}
            className="flex items-start gap-4 p-4 rounded-xl border border-white/8 bg-white/[0.02] transition-colors hover:bg-white/[0.03]"
          >
            <div className="mt-0.5">
              {isAccepted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-white/25 flex-shrink-0" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">{info.label}</span>
                {rec && statusBadge(rec.status)}
                {isLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
                    <Lock className="w-2.5 h-2.5" /> Cannot be revoked
                  </span>
                )}
              </div>
              <p className="text-xs text-white/45 leading-relaxed">{info.desc}</p>
              {rec && (
                <p className="text-[10px] text-white/25 mt-1.5">
                  Last updated {formatTs(rec.updated_at)} · via {rec.source} · policy v
                  {rec.policy_version}
                </p>
              )}
              {!rec && (
                <p className="text-[10px] text-amber-400/60 mt-1.5">
                  No record — consent not yet captured.
                </p>
              )}
            </div>

            {!isLocked && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                ) : isAccepted ? (
                  <button
                    type="button"
                    onClick={() => updateConsent(type, 'revoked')}
                    title="Revoke consent"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
                  >
                    <ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> On
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateConsent(type, 'accepted')}
                    title="Accept consent"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
                  >
                    <ToggleLeft className="w-3.5 h-3.5 text-white/30" /> Off
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Consent history table */}
      {records.length > 0 && (
        <details className="mt-6 group">
          <summary className="flex items-center gap-2 cursor-pointer text-xs text-white/40 hover:text-white/60 select-none transition-colors list-none">
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            Full consent history ({records.length} records)
          </summary>
          <div className="mt-3 rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-2.5 text-white/35 font-medium uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-white/35 font-medium uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-2.5 text-white/35 font-medium uppercase tracking-wider hidden sm:table-cell">
                    Source
                  </th>
                  <th className="text-right px-4 py-2.5 text-white/35 font-medium uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr
                    key={r.id}
                    className={i < records.length - 1 ? 'border-b border-white/[0.05]' : ''}
                  >
                    <td className="px-4 py-2.5 text-white/60">
                      {CONSENT_LABELS[r.consent_type]?.label ?? r.consent_type}
                    </td>
                    <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                    <td className="px-4 py-2.5 text-white/35 hidden sm:table-cell">{r.source}</td>
                    <td className="px-4 py-2.5 text-white/35 text-right whitespace-nowrap">
                      {formatTs(r.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

/* ─── Export Tab ─────────────────────────────────── */

function ExportTab() {
  const [downloading, setDownloading] = useState(false);

  const triggerExport = async () => {
    setDownloading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/compliance/export`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? 'Export failed');
      }
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aivis-data-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded.');
    } catch (e: any) {
      toast.error(e.message ?? 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  const INCLUDED = [
    { icon: '👤', label: 'Profile', detail: 'Your account name, email, tier, and timestamps.' },
    {
      icon: '🔍',
      label: 'Scan history',
      detail: 'Up to 1,000 most recent audits: URL, score, tier, status, and created date.',
    },
    {
      icon: '✅',
      label: 'Consent records',
      detail: 'All accepted/declined/revoked entries with policy version and source.',
    },
    {
      icon: '💳',
      label: 'Payment records',
      detail: 'Payment IDs, amounts, currency, and status — no card numbers or PII.',
    },
  ];

  const EXCLUDED = [
    'Raw AI analysis payloads (available in Reports)',
    'Competitore tracking data',
    'Citation test results',
    'Workspace member data for other users',
  ];

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-white/65 leading-relaxed mb-6">
        Download a machine-readable JSON export of all personal data held against your account. This
        fulfils the Right of Access under GDPR Art. 15 and equivalent data portability rights.
      </p>

      {/* What's included */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
          Included in export
        </h3>
        <div className="space-y-2.5">
          {INCLUDED.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="text-base leading-none mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-white/80">{item.label}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What's excluded */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2">
          Not included
        </h3>
        <ul className="space-y-1">
          {EXCLUDED.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-white/35">
              <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        disabled={downloading}
        onClick={triggerExport}
        className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {downloading ? 'Preparing export…' : 'Download my data (JSON)'}
      </button>

      <p className="text-[11px] text-white/25 mt-4 leading-relaxed">
        For account deletion or manual GDPR requests, contact{' '}
        <a href="mailto:privacy@aivis.biz" className="underline text-white/40 hover:text-white/60">
          privacy@aivis.biz
        </a>
        . Requests are processed within 30 days per GDPR Art. 12.
      </p>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────── */

export default function ComplianceDashboardPage() {
  usePageMeta({
    title: 'Compliance Dashboard',
    description: 'Audit logs, consent tracking, and GDPR data export for your AiVIS.biz account.',
    path: '/app/compliance-dashboard',
  });

  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('audit-log');

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'audit-log', label: 'Audit Log', icon: Activity },
    { id: 'consent', label: 'Consent Tracking', icon: Shield },
    { id: 'export', label: 'Data Export', icon: Download },
  ];

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Compliance Dashboard</h1>
          <p className="text-sm text-white/50 mt-0.5">
            Audit logs, consent records, and GDPR data export for{' '}
            <span className="text-white/70">{user?.email ?? 'your account'}</span>
          </p>
        </div>
      </div>

      {/* Policy version pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/8 text-xs text-white/40">
        <FileText className="w-3.5 h-3.5" />
        Policy version: 2026-03-10 · Jurisdiction: Georgia, USA
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            id={t.id}
            active={activeTab === t.id}
            icon={t.icon}
            label={t.label}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-5">
        {activeTab === 'audit-log' && <AuditLogTab />}
        {activeTab === 'consent' && <ConsentTrackingTab />}
        {activeTab === 'export' && <ExportTab />}
      </div>
    </div>
  );
}
