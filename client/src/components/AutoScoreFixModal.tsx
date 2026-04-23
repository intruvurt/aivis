/**
 * AutoScoreFixModal - full-screen (max-width) modal for Auto Score Fix.
 *
 * Tabs:
 *  1. Connect   - choose VCS provider, save token, set repo details
 *  2. Submit    - review + submit job (deducts 10 credits)
 *  3. Jobs      - list jobs, approve / reject with refund info
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { buildBearerHeader } from '../utils/authToken';
import type { AnalysisResponse } from '@shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type VcsProvider = 'github' | 'gitlab' | 'bitbucket';

interface VcsTokenHint {
  provider: VcsProvider;
  hint: string;
  updated_at: string;
}

type JobStatus =
  | 'pending'
  | 'generating'
  | 'creating_pr'
  | 'pending_approval'
  | 'approved'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'failed';

interface AsfJob {
  id: string;
  target_url: string;
  vcs_provider: VcsProvider;
  repo_owner: string;
  repo_name: string;
  repo_branch: string;
  status: JobStatus;
  pr_number: number | null;
  pr_url: string | null;
  pr_title: string | null;
  credits_spent: number;
  expires_at: string;
  fix_plan: {
    summary?: string;
    score_before?: number;
    projected_score_lift?: number | string;
    file_changes?: Array<{
      file_path?: string;
      change_type?: string;
      description?: string;
      path?: string;
      operation?: string;
      justification?: string;
      content: string;
    }>;
  } | null;
  refund_credits: number | null;
  created_at: string;
}

type AuditSnapshot = Pick<
  AnalysisResponse,
  'url' | 'visibility_score' | 'audit_id' | 'recommendations'
>;

interface GitHubRepo {
  id: number;
  full_name: string;
  owner: string;
  name: string;
  default_branch: string;
  private: boolean;
}

interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface GitHubAppInfo {
  name: string;
  slug: string;
  appUrl: string;
  installUrl: string;
  permissions: Array<{ name: string; access: 'read' | 'write' }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  auditResult: AuditSnapshot;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROVIDERS: { id: VcsProvider; label: string; icon: string }[] = [
  { id: 'github', label: 'GitHub', icon: '🐙' },
  { id: 'gitlab', label: 'GitLab', icon: '🦊' },
  { id: 'bitbucket', label: 'Bitbucket', icon: '🪣' },
];

const STATUS_LABELS: Record<JobStatus, { label: string; color: string }> = {
  pending: { label: 'Queued', color: 'text-yellow-300' },
  generating: { label: 'Generating…', color: 'text-yellow-400' },
  creating_pr: { label: 'Creating PR…', color: 'text-indigo-300' },
  pending_approval: { label: 'Awaiting Approval', color: 'text-blue-400' },
  approved: { label: 'Approved', color: 'text-emerald-400' },
  cancelled: { label: 'Cancelled (refunded)', color: 'text-slate-300' },
  rejected: { label: 'Rejected', color: 'text-red-400' },
  expired: { label: 'Expired (refunded 80%)', color: 'text-slate-400' },
  failed: { label: 'Failed', color: 'text-red-500' },
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function apiUrl(path: string) {
  const base = (API_URL || '').replace(/\/+$/, '');
  return `${base}/api/auto-score-fix${path}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AutoScoreFixModal: React.FC<Props> = ({ open, onClose, auditResult }) => {
  const { token } = useAuthStore();

  const [tab, setTab] = useState<'connect' | 'submit' | 'jobs'>('connect');

  // GitHub App state
  const [githubAppInstalled, setGithubAppInstalled] = useState(false);
  const [githubAppLogin, setGithubAppLogin] = useState('');
  const [githubAppInstallUrl, setGithubAppInstallUrl] = useState<string | null>(null);
  const [githubAppInfo, setGithubAppInfo] = useState<GitHubAppInfo | null>(null);

  // Connect tab state
  const [provider, setProvider] = useState<VcsProvider>('github');
  const [rawToken, setRawToken] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [connectedTokens, setConnectedTokens] = useState<VcsTokenHint[]>([]);
  const [savingToken, setSavingToken] = useState(false);
  const [tokenMsg, setTokenMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);

  // Submit tab state
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [repoTree, setRepoTree] = useState<string[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  // Jobs tab state
  const [jobs, setJobs] = useState<AsfJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const headers = useCallback(() => {
    const auth = buildBearerHeader(token || '');
    return {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    };
  }, [token]);

  // ─── Load connected tokens and jobs when modal opens ───────────────────────
  useEffect(() => {
    if (!open || !token) return;

    const current = new URL(window.location.href);
    if (current.searchParams.get('github_connected') === '1') {
      setTokenMsg({ ok: true, text: 'GitHub connected successfully. Repository access is ready.' });
      current.searchParams.delete('github_connected');
      window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
    }
    if (current.searchParams.get('github_app') === 'installed') {
      setTokenMsg({
        ok: true,
        text: 'GitHub App installed successfully! You can now submit auto score fixes.',
      });
      current.searchParams.delete('github_app');
      window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
    }

    fetchTokens();
    fetchJobs();
    fetchGitHubAppStatus();
  }, [open, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !token) return;
    const githubConnected =
      connectedTokens.some((t) => t.provider === 'github') || githubAppInstalled;
    if (!githubConnected || provider !== 'github') {
      setRepos([]);
      setBranches([]);
      return;
    }
    void fetchGitHubRepos();
  }, [open, token, connectedTokens, provider]);

  useEffect(() => {
    if (!open || !token || provider !== 'github') return;
    if (!repoOwner.trim() || !repoName.trim()) {
      setBranches([]);
      return;
    }
    void fetchGitHubBranches(repoOwner.trim(), repoName.trim());
  }, [open, token, provider, repoOwner, repoName]);

  // Fetch repo file tree when branch is selected (GitHub only)
  useEffect(() => {
    if (!open || !token || provider !== 'github') return;
    if (!repoOwner.trim() || !repoName.trim() || !repoBranch.trim()) {
      setRepoTree([]);
      return;
    }
    void fetchRepoTree(repoOwner.trim(), repoName.trim(), repoBranch.trim());
  }, [open, token, provider, repoOwner, repoName, repoBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  function fetchTokens() {
    fetch(apiUrl('/tokens'), { headers: headers() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setConnectedTokens(d.tokens || []))
      .catch(() => {});
  }

  function fetchJobs() {
    setLoadingJobs(true);
    fetch(apiUrl('/jobs?limit=20'), { headers: headers() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setJobs(d.jobs || []))
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }

  function fetchGitHubAppStatus() {
    const base = (API_URL || '').replace(/\/+$/, '');
    const hdrs = headers();
    Promise.all([
      fetch(`${base}/api/github-app/status`, { headers: hdrs }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${base}/api/github-app/install-url`, { headers: hdrs }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([s, u]) => {
        setGithubAppInstalled(!!s?.installed);
        setGithubAppLogin(s?.installation?.account_login || '');
        setGithubAppInfo((u?.app || s?.app || null) as GitHubAppInfo | null);
        setGithubAppInstallUrl(u?.url || u?.app?.installUrl || s?.app?.installUrl || null);
      })
      .catch(() => {});
  }

  async function fetchGitHubRepos() {
    setLoadingRepos(true);
    try {
      // Try the auto-score-fix endpoint first (uses OAuth token), then GitHub App endpoint
      let response = await fetch(apiUrl('/github/repos'), { headers: headers() });
      if (!response.ok && githubAppInstalled) {
        const base = (API_URL || '').replace(/\/+$/, '');
        response = await fetch(`${base}/api/github-app/repos`, { headers: headers() });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load repositories');

      const list = Array.isArray(payload?.repos) ? (payload.repos as GitHubRepo[]) : [];
      setRepos(list);

      if (list.length > 0) {
        const hasSelection = list.some(
          (repo) => repo.owner === repoOwner && repo.name === repoName
        );
        if (!hasSelection) {
          const first = list[0];
          setRepoOwner(first.owner);
          setRepoName(first.name);
          setRepoBranch(first.default_branch || 'main');
        }
      }
    } catch {
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }

  async function fetchGitHubBranches(owner: string, repo: string) {
    setLoadingBranches(true);
    try {
      let response = await fetch(
        apiUrl(
          `/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        ),
        {
          headers: headers(),
        }
      );
      if (!response.ok && githubAppInstalled) {
        const base = (API_URL || '').replace(/\/+$/, '');
        response = await fetch(
          `${base}/api/github-app/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
          {
            headers: headers(),
          }
        );
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load branches');

      const list = Array.isArray(payload?.branches) ? (payload.branches as GitHubBranch[]) : [];
      setBranches(list);
      if (list.length > 0 && !list.some((branch) => branch.name === repoBranch)) {
        setRepoBranch(list[0].name);
      }
    } catch {
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }

  async function fetchRepoTree(owner: string, repo: string, branch: string) {
    setLoadingTree(true);
    try {
      const r = await fetch(
        apiUrl(
          `/github/tree?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`
        ),
        {
          headers: headers(),
        }
      );
      if (r.ok) {
        const d = await r.json();
        setRepoTree(d.tree || []);
      } else {
        setRepoTree([]);
      }
    } catch {
      setRepoTree([]);
    } finally {
      setLoadingTree(false);
    }
  }

  function connectGitHubOAuth() {
    const returnPath = `${window.location.pathname}${window.location.search}` || '/score-fix';
    fetch(
      `${API_URL}/api/auth/github/connect?format=json&redirect=${encodeURIComponent(returnPath)}`,
      {
        headers: headers(),
      }
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || typeof payload?.authorization_url !== 'string') {
          throw new Error(payload?.error || 'Failed to start GitHub connection');
        }
        window.location.href = payload.authorization_url;
      })
      .catch((error: any) => {
        setTokenMsg({ ok: false, text: error?.message || 'Failed to start GitHub connection' });
      });
  }

  // ─── Token save ──────────────────────────────────────────────────────────────
  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault();
    if (!rawToken.trim()) return;
    setSavingToken(true);
    setTokenMsg(null);
    try {
      const r = await fetch(apiUrl('/tokens'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ provider, token: rawToken.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        setTokenMsg({ ok: true, text: `${provider} token saved (${d.hint})` });
        setRawToken('');
        fetchTokens();
      } else {
        setTokenMsg({ ok: false, text: d.error || 'Failed to save token' });
      }
    } catch {
      setTokenMsg({ ok: false, text: 'Network error' });
    } finally {
      setSavingToken(false);
    }
  }

  async function handleDeleteToken(p: VcsProvider) {
    await fetch(apiUrl(`/tokens/${p}`), { method: 'DELETE', headers: headers() });
    fetchTokens();
  }

  // ─── Job submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const r = await fetch(apiUrl('/jobs'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          audit_id: auditResult.audit_id,
          target_url: auditResult.url,
          vcs_provider: provider,
          repo_owner: repoOwner.trim(),
          repo_name: repoName.trim(),
          repo_branch: repoBranch.trim() || 'main',
          audit_evidence: auditResult,
        }),
      });
      const d = await r.json();
      if (r.ok || r.status === 202) {
        setSubmitMsg({
          ok: true,
          text: `Job submitted! PR will be ready in ~60–90s. 10 credits reserved. Job ID: ${d.job_id}`,
        });
        setLastJobId(d.job_id);
        fetchJobs();
        setTimeout(() => setTab('jobs'), 2000);
      } else {
        setSubmitMsg({ ok: false, text: d.error || 'Submission failed' });
      }
    } catch {
      setSubmitMsg({ ok: false, text: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Approve / Reject ────────────────────────────────────────────────────────
  async function handleApprove(jobId: string) {
    const r = await fetch(apiUrl(`/jobs/${jobId}/approve`), { method: 'POST', headers: headers() });
    const d = await r.json();
    setActionMsg((m) => ({ ...m, [jobId]: r.ok ? 'Approved!' : d.error || 'Error' }));
    fetchJobs();
  }

  async function handleReject(jobId: string) {
    const r = await fetch(apiUrl(`/jobs/${jobId}/reject`), { method: 'POST', headers: headers() });
    const d = await r.json();
    setActionMsg((m) => ({
      ...m,
      [jobId]: r.ok ? `Rejected - ${d.refund_credits} credits refunded` : d.error || 'Error',
    }));
    fetchJobs();
  }

  async function handleCancel(jobId: string) {
    const r = await fetch(apiUrl(`/jobs/${jobId}/cancel`), { method: 'POST', headers: headers() });
    const d = await r.json();
    setActionMsg((m) => ({
      ...m,
      [jobId]: r.ok ? `Cancelled - ${d.refund_credits} credits refunded` : d.error || 'Error',
    }));
    fetchJobs();
  }

  // ─── Close on Escape ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const hasConnectedProvider =
    connectedTokens.some((t) => t.provider === provider) ||
    (provider === 'github' && githubAppInstalled);
  const githubAppName = githubAppInfo?.name || 'AiVIS Auto Score Fix PR';

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,33,0.92))] shadow-[0_32px_90px_rgba(0,0,0,0.45)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">⚡ Auto Score Fix</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Convert evidence into repository changes, open a PR, and verify remediation with a
              real GitHub App or token-backed fallback.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors rounded-lg p-1.5 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6">
          {(['connect', 'submit', 'jobs'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'connect'
                ? '1. Connect Repo'
                : t === 'submit'
                  ? '2. Submit Fix'
                  : '3. View Jobs'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ─── CONNECT TAB ─────────────────────────────────────────────── */}
          {tab === 'connect' && (
            <div className="space-y-6">
              {/* Provider selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  VCS Provider
                </label>
                <div className="flex gap-2">
                  {PROVIDERS.map((p) => {
                    const connected = connectedTokens.some((t) => t.provider === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setProvider(p.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                          provider === p.id
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                        {connected && (
                          <span
                            className="ml-auto w-2 h-2 rounded-full bg-emerald-400"
                            title="Token saved"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Connected tokens list */}
              {connectedTokens.length > 0 && (
                <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/10">
                  {connectedTokens.map((ct) => (
                    <div key={ct.provider} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-white capitalize">
                          {ct.provider}
                        </span>
                        <span className="ml-2 text-xs text-slate-400 font-mono">{ct.hint}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteToken(ct.provider)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Token input form */}
              <form onSubmit={handleSaveToken} className="space-y-4">
                {provider === 'github' && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          GitHub App (recommended)
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {githubAppName} uses repo-scoped permissions for contents, pull requests,
                          and metadata. No personal access token required.
                        </p>
                      </div>
                      {githubAppInstalled && (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200/80">
                          Connected as {githubAppLogin}
                        </span>
                      )}
                    </div>
                    {githubAppInstalled ? (
                      <button
                        type="button"
                        onClick={() => setTab('submit')}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        ✓ GitHub App Installed - Continue to Submit
                      </button>
                    ) : githubAppInstallUrl ? (
                      <a
                        href={githubAppInstallUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-semibold text-center hover:opacity-90 transition-opacity"
                      >
                        Install {githubAppName} on GitHub
                      </a>
                    ) : null}
                    {!githubAppInstalled && githubAppInfo?.permissions?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {githubAppInfo.permissions.map((permission) => (
                          <span
                            key={`${permission.name}:${permission.access}`}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55"
                          >
                            {permission.name} {permission.access}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="relative flex items-center">
                      <div className="flex-grow border-t border-white/10" />
                      <span className="flex-shrink mx-3 text-[11px] text-slate-500">
                        or use tokens
                      </span>
                      <div className="flex-grow border-t border-white/10" />
                    </div>
                  </div>
                )}

                {provider === 'github' && (
                  <button
                    type="button"
                    onClick={connectGitHubOAuth}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 hover:opacity-90 text-white text-sm font-semibold transition-opacity"
                  >
                    Continue with GitHub OAuth fallback
                  </button>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {provider === 'github'
                      ? 'GitHub Personal Access Token (repo scope)'
                      : provider === 'gitlab'
                        ? 'GitLab Personal Access Token (api scope)'
                        : 'Bitbucket App Password (repository:write)'}
                  </label>
                  <input
                    type="password"
                    value={rawToken}
                    onChange={(e) => setRawToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 px-4 py-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Stored encrypted on-server (AES-256-GCM). Never logged or exposed.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingToken || !rawToken.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingToken
                    ? 'Saving…'
                    : `Save ${PROVIDERS.find((p2) => p2.id === provider)?.label} Token`}
                </button>

                {tokenMsg && (
                  <p className={`text-xs ${tokenMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tokenMsg.text}
                  </p>
                )}
              </form>

              {/* Continue CTA */}
              {hasConnectedProvider && (
                <button
                  onClick={() => setTab('submit')}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Continue to Submit Fix →
                </button>
              )}
            </div>
          )}

          {/* ─── SUBMIT TAB ──────────────────────────────────────────────── */}
          {tab === 'submit' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Audit summary */}
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Target URL</span>
                  <span className="text-sm text-white font-mono truncate max-w-[260px]">
                    {auditResult.url || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Visibility Score</span>
                  <span className="text-sm font-bold text-amber-400">
                    {auditResult.visibility_score ?? '-'}/100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Credit Cost</span>
                  <span className="text-sm text-white">10 credits (80% refundable within 48h)</span>
                </div>
              </div>

              {/* Recommendations that will be targeted */}
              {auditResult.recommendations && auditResult.recommendations.length > 0 && (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Issues to Fix (
                    {
                      auditResult.recommendations.filter(
                        (r) => r.priority === 'high' || r.priority === 'medium'
                      ).length
                    }{' '}
                    high/medium priority)
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {auditResult.recommendations
                      .filter((r) => r.priority === 'high' || r.priority === 'medium')
                      .slice(0, 8)
                      .map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded font-semibold ${
                              rec.priority === 'high'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {rec.priority}
                          </span>
                          <span className="text-slate-300">{rec.title}</span>
                        </div>
                      ))}
                    {auditResult.recommendations.filter((r) => r.priority === 'low').length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        + {auditResult.recommendations.filter((r) => r.priority === 'low').length}{' '}
                        low-priority items
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Provider (re-confirm) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Provider
                </label>
                <div className="flex gap-2">
                  {PROVIDERS.map((p) => {
                    const connected = connectedTokens.some((t) => t.provider === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={!connected}
                        onClick={() => setProvider(p.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm transition-all ${
                          provider === p.id
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : connected
                              ? 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                              : 'border-white/5 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        {p.icon} {p.label}
                        {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Repo fields */}
              {provider === 'github' && repos.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Repository
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={repoOwner && repoName ? `${repoOwner}/${repoName}` : ''}
                        onChange={(e) => {
                          const selected = repos.find((repo) => repo.full_name === e.target.value);
                          if (!selected) return;
                          setRepoOwner(selected.owner);
                          setRepoName(selected.name);
                          setRepoBranch(selected.default_branch || 'main');
                        }}
                        className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        {repos.map((repo) => (
                          <option key={repo.id} value={repo.full_name}>
                            {repo.full_name}
                            {repo.private ? ' (private)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => fetchGitHubRepos()}
                        className="px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-300 hover:text-white hover:border-white/20"
                      >
                        {loadingRepos ? '…' : 'Refresh'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Base branch
                    </label>
                    {branches.length > 0 ? (
                      <select
                        value={repoBranch}
                        onChange={(e) => setRepoBranch(e.target.value)}
                        className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        {branches.map((branch) => (
                          <option key={branch.sha || branch.name} value={branch.name}>
                            {branch.name}
                            {branch.protected ? ' (protected)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={repoBranch}
                        onChange={(e) => setRepoBranch(e.target.value)}
                        placeholder={loadingBranches ? 'Loading branches...' : 'main'}
                        className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {provider === 'bitbucket' ? 'Workspace' : 'Owner / Org'}
                      </label>
                      <input
                        required
                        value={repoOwner}
                        onChange={(e) => setRepoOwner(e.target.value)}
                        placeholder="my-org"
                        className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Repository name
                      </label>
                      <input
                        required
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="my-website"
                        className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Base branch
                    </label>
                    <input
                      value={repoBranch}
                      onChange={(e) => setRepoBranch(e.target.value)}
                      placeholder="main"
                      className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Repository file structure preview */}
              {loadingTree && (
                <p className="text-xs text-slate-500 animate-pulse">
                  Fetching repository structure…
                </p>
              )}
              {!loadingTree && repoTree.length > 0 && (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Repository Structure ({repoTree.length} files)
                  </h4>
                  <div className="max-h-32 overflow-y-auto scrollbar-thin">
                    <pre className="text-[11px] leading-relaxed text-slate-500 whitespace-pre-wrap break-all">
                      {repoTree.slice(0, 50).join('\n')}
                      {repoTree.length > 50 ? `\n… and ${repoTree.length - 50} more files` : ''}
                    </pre>
                  </div>
                </div>
              )}

              {submitMsg && (
                <p
                  className={`text-sm rounded-xl px-4 py-3 ${submitMsg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}
                >
                  {submitMsg.text}
                </p>
              )}

              {!hasConnectedProvider && (
                <p className="text-xs text-amber-400">
                  No {provider} connection found. Go to "Connect Repo" tab to install the GitHub App
                  or add a token.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !hasConnectedProvider}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Generating fix plan & PR…'
                  : '⚡ Submit Auto Score Fix (-10 credits)'}
              </button>

              <p className="text-xs text-center text-slate-500">
                The AI will analyze your audit evidence, generate targeted file changes, and open a
                PR on{' '}
                <strong className="text-slate-400">
                  {repoOwner || 'your-org'}/{repoName || 'your-repo'}
                </strong>
                . You have 48 hours to approve or reject it.
              </p>
            </form>
          )}

          {/* ─── JOBS TAB ────────────────────────────────────────────────── */}
          {tab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Recent Jobs</h3>
                <button
                  onClick={fetchJobs}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  {loadingJobs ? 'Loading…' : '↻ Refresh'}
                </button>
              </div>

              {jobs.length === 0 && !loadingJobs && (
                <p className="text-sm text-slate-500 text-center py-8">
                  No jobs yet. Submit your first fix from the "Submit Fix" tab.
                </p>
              )}

              {jobs.map((job) => {
                const s = STATUS_LABELS[job.status] || {
                  label: job.status,
                  color: 'text-slate-400',
                };
                const expanded = expandedJob === job.id;
                const fileChanges = job.fix_plan?.file_changes ?? [];
                return (
                  <div
                    key={job.id}
                    className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                  >
                    {/* Job header */}
                    <div
                      className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedJob(expanded ? null : job.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                          <span className="text-xs text-slate-500">
                            {job.vcs_provider} · {job.repo_owner}/{job.repo_name}@{job.repo_branch}
                          </span>
                        </div>
                        <p className="text-sm text-white mt-0.5 truncate">{job.target_url}</p>
                        {job.pr_title && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            PR: {job.pr_title}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span>{job.credits_spent} credits</span>
                          {job.status === 'pending_approval' && (
                            <span className="text-amber-400">
                              ⏳ Expires in {timeLeft(job.expires_at)}
                            </span>
                          )}
                          {job.pr_url && (
                            <a
                              href={job.pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-400 hover:text-indigo-300 underline"
                            >
                              View PR #{job.pr_number}
                            </a>
                          )}
                        </div>
                      </div>
                      <span className="text-slate-500 ml-2 text-xs">{expanded ? '▲' : '▼'}</span>
                    </div>

                    {/* Approve / Reject / Cancel actions */}
                    {job.status === 'pending_approval' && (
                      <div className="flex gap-2 px-4 pb-3">
                        <button
                          onClick={() => handleApprove(job.id)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                        >
                          ✔ Approve
                        </button>
                        <button
                          onClick={() => handleReject(job.id)}
                          className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                        >
                          ✕ Reject (80% refund)
                        </button>
                      </div>
                    )}

                    {(job.status === 'pending' ||
                      job.status === 'generating' ||
                      job.status === 'creating_pr') && (
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="w-full py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                        >
                          ✕ Cancel Job (100% refund)
                        </button>
                      </div>
                    )}

                    {/* Action feedback */}
                    {actionMsg[job.id] && (
                      <p className="text-xs text-center text-emerald-400 pb-3 px-4">
                        {actionMsg[job.id]}
                      </p>
                    )}

                    {/* Fix plan expand */}
                    {expanded && job.fix_plan && (
                      <div className="border-t border-white/10 px-4 py-4 space-y-3">
                        {job.fix_plan.summary && (
                          <p className="text-sm text-slate-300">{job.fix_plan.summary}</p>
                        )}
                        <div className="flex gap-4 text-xs text-slate-400">
                          {job.fix_plan.score_before !== undefined && (
                            <span>
                              Score before:{' '}
                              <strong className="text-amber-400">
                                {job.fix_plan.score_before}
                              </strong>
                            </span>
                          )}
                          {job.fix_plan.projected_score_lift !== undefined && (
                            <span>
                              Projected lift:{' '}
                              <strong className="text-emerald-400">
                                +{job.fix_plan.projected_score_lift}
                              </strong>
                            </span>
                          )}
                          {fileChanges.length > 0 && (
                            <span>
                              {fileChanges.length} file{fileChanges.length !== 1 ? 's' : ''} changed
                            </span>
                          )}
                        </div>

                        {fileChanges.slice(0, 5).map((fc, i) => {
                          const changeType = fc.change_type || fc.operation || 'update';
                          const filePath = fc.file_path || fc.path || '(unknown file)';
                          const description = fc.description || fc.justification;
                          return (
                            <details
                              key={i}
                              className="rounded-xl bg-black/20 border border-white/10"
                            >
                              <summary className="px-3 py-2 cursor-pointer text-xs text-slate-300 hover:text-white flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                    changeType === 'create'
                                      ? 'bg-emerald-900/60 text-emerald-300'
                                      : changeType === 'modify' || changeType === 'update'
                                        ? 'bg-blue-900/60 text-blue-300'
                                        : 'bg-amber-900/60 text-amber-300'
                                  }`}
                                >
                                  {changeType}
                                </span>
                                <span className="font-mono">{filePath}</span>
                              </summary>
                              {description && (
                                <p className="px-3 pt-1 pb-2 text-xs text-slate-400">
                                  {description}
                                </p>
                              )}
                              {fc.content && (
                                <pre className="px-3 pb-3 text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap max-h-60">
                                  {fc.content}
                                </pre>
                              )}
                            </details>
                          );
                        })}

                        {fileChanges.length > 5 && (
                          <p className="text-xs text-slate-500 text-center">
                            + {fileChanges.length - 5} more files in PR
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
          <span>
            Auto Score Fix · 10 credits/job · cancel during generation = 100% refund ·
            reject/pending approval = 80% refund
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoScoreFixModal;
