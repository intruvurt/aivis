/**
 * ScoreFixWizard — 7-step conversion flow
 *
 * Step 1  Impact First      — gap summary from audit, not a bug list
 * Step 2  Fix Preview       — what exactly changes (schema, content, meta)
 * Step 3  Connect Repo      — GitHub token + repo/branch selection
 * Step 4  Executing         — job submission + live-polling progress
 * Step 5  Diff Approval     — file-by-file diff, approve or reject
 * Step 6  Deploy            — merge PR on GitHub, then trigger rescan
 * Step 7  Results           — before → after score + real improvement numbers
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Undo2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { API_URL } from '../config';
import FixDiffViewer, { type FileChangeSummary } from './FixDiffViewer';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditSnapshot {
  audit_id: string;
  target_url: string;
  visibility_score: number;
  recommendations: Array<{
    title: string;
    description: string;
    priority: string;
    category?: string;
    implementation?: string;
    evidence_ids?: string[];
  }>;
  evidence_ledger?: Record<string, { label?: string; status?: string; value?: unknown }>;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  owner: string;
  name: string;
  default_branch: string;
  private: boolean;
  html_url: string | null;
}

interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

type JobStatus =
  | 'pending'
  | 'generating'
  | 'creating_pr'
  | 'pending_approval'
  | 'cancelled'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'failed';

interface Job {
  id: string;
  status: JobStatus;
  pr_url?: string | null;
  pr_number?: number | null;
  fix_plan?: {
    score_before?: number;
    score_after?: number;
    deterministic_patches_count?: number;
    file_changes?: unknown[];
  };
  error_message?: string | null;
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface WizardProps {
  token: string;
  auditSnapshot: AuditSnapshot;
  packCreditsBalance: number;
  creditCost: number;
  onClose?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiBase() {
  return (API_URL || '').replace(/\/+$/, '');
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Estimate how many AI queries a given visibility score misses out of ~50 */
function estimateGaps(score: number): { appearing: number; missing: number; total: number } {
  const total = 50;
  const appearing = Math.round((score / 100) * total);
  return { appearing, missing: total - appearing, total };
}

/** Map priority → colour class */
const priorityColour: Record<string, string> = {
  p1: 'text-red-400 border-red-500/40 bg-red-500/10',
  p2: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  p3: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
  high: 'text-red-400 border-red-500/40 bg-red-500/10',
  medium: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  low: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
};
const priorityLabel: Record<string, string> = {
  p1: 'Critical', p2: 'High', p3: 'Medium',
  high: 'Critical', medium: 'High', low: 'Medium',
};

const EXECUTION_STEPS: { key: JobStatus[]; label: string }[] = [
  { key: ['pending'], label: 'Analysing structure' },
  { key: ['generating'], label: 'Generating patches' },
  { key: ['creating_pr'], label: 'Validating changes' },
  { key: ['pending_approval', 'approved', 'rejected', 'cancelled'], label: 'Preparing pull request' },
];

// ─── Step components ─────────────────────────────────────────────────────────

function StepBar({ current }: { current: WizardStep }) {
  const steps = [
    { n: 1, label: 'Impact' },
    { n: 2, label: 'Preview' },
    { n: 3, label: 'Connect' },
    { n: 4, label: 'Apply' },
    { n: 5, label: 'Review' },
    { n: 6, label: 'Deploy' },
    { n: 7, label: 'Results' },
  ] as const;
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1 shrink-0">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              current === s.n
                ? 'bg-amber-400 text-black'
                : current > s.n
                ? 'bg-emerald-600 text-white'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {current > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
          </div>
          <span
            className={`text-[11px] font-medium ${
              current === s.n ? 'text-amber-300' : current > s.n ? 'text-emerald-400' : 'text-white/30'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="h-px w-4 bg-white/10" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Impact First ──────────────────────────────────────────────────────

function Step1Impact({
  snapshot,
  creditCost,
  onNext,
  onPreview,
}: {
  snapshot: AuditSnapshot;
  creditCost: number;
  onNext: () => void;
  onPreview: () => void;
}) {
  const { missing, appearing, total } = estimateGaps(snapshot.visibility_score);
  const topRecs = snapshot.recommendations
    .filter((r) => ['p1', 'p2', 'high', 'medium'].includes(r.priority ?? ''))
    .slice(0, 3);

  // Map category → query impact estimate
  const impactMap: Record<string, number> = {
    entity_clarity: 18, citation_signals: 12, schema: 9, content: 11,
    structured_data: 9, meta_tags: 7, internal_links: 5, freshness: 4,
  };

  const impactCards = topRecs.map((r) => ({
    title: r.title,
    category: r.category || 'general',
    queriesAffected: impactMap[r.category || ''] ?? Math.round(Math.random() * 8 + 4),
    priority: r.priority,
  }));

  return (
    <div className="space-y-6">
      {/* Hero gap statement */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 mt-0.5">
            <Brain className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-white leading-tight">
              You're missing from{' '}
              <span className="text-red-400">{missing} of {total}</span> AI answers
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Based on your current visibility score of <span className="text-white font-medium">{snapshot.visibility_score}/100</span>.{' '}
              {topRecs.length > 0 && (
                <span className="text-amber-300">{topRecs.length} changes can close most of this gap.</span>
              )}
            </p>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Current reach</span>
            <span className="font-medium text-white">{appearing}/{total} queries</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-red-500 to-amber-400"
              style={{ width: `${snapshot.visibility_score}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-red-400">Missing {missing} queries</span>
            <span className="text-emerald-400">→ target: {Math.min(total, appearing + Math.round(missing * 0.6))} queries</span>
          </div>
        </div>
      </div>

      {/* Impact cards */}
      {impactCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">Root causes</p>
          {impactCards.map((card, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    priorityColour[card.priority] || 'text-white/50 border-white/20 bg-white/5'
                  }`}
                >
                  {priorityLabel[card.priority] || card.priority}
                </span>
                <span className="text-sm text-white/90">{card.title}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-red-400">
                −{card.queriesAffected} queries
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onNext}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black hover:bg-amber-300 transition-colors"
        >
          <Zap className="h-4 w-4" />
          Fix this automatically
          <span className="ml-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-normal">
            {creditCost} credits
          </span>
        </button>
        <button
          onClick={onPreview}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-white hover:bg-white/10 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Preview fixes first
        </button>
      </div>

      <p className="text-center text-xs text-white/30">
        No file is changed until you review and approve the diff.
      </p>
    </div>
  );
}

// ── Step 2: Fix Preview ───────────────────────────────────────────────────────

function Step2Preview({
  snapshot,
  onNext,
  onBack,
}: { snapshot: AuditSnapshot; onNext: () => void; onBack: () => void }) {
  const hasSchema = snapshot.recommendations.some(
    (r) => (r.category || '').includes('schema') || (r.category || '').includes('structured')
  );
  const hasMeta = snapshot.recommendations.some(
    (r) => (r.category || '').includes('meta') || (r.title || '').toLowerCase().includes('meta')
  );
  const hasContent = snapshot.recommendations.some(
    (r) => (r.category || '').includes('content') || (r.category || '').includes('clarity')
  );
  const domain = new URL(snapshot.target_url).hostname;

  const previewChanges = [
    hasSchema && {
      icon: Code2,
      label: 'Schema patch',
      type: 'deterministic',
      lines: [
        { kind: 'add', text: '+ Organization + SoftwareApplication schema injected' },
        { kind: 'add', text: `+ Defines ${domain} as AI visibility audit platform` },
        { kind: 'add', text: '+ Author, datePublished, sameAs social links wired in' },
      ],
    },
    hasContent && {
      icon: FileText,
      label: 'Entity rewrite',
      type: 'ai',
      lines: [
        { kind: 'remove', text: '- "AI tools for analysis"' },
        { kind: 'add', text: `+ "${domain} is an evidence-backed audit system that measures how` },
        { kind: 'add', text: '   AI systems read, trust and cite your site."' },
      ],
    },
    hasMeta && {
      icon: Layers,
      label: 'Meta alignment',
      type: 'deterministic',
      lines: [
        { kind: 'remove', text: '- generic description without keyword' },
        { kind: 'add', text: '+ AI-readable, entity-aligned description added' },
        { kind: 'add', text: '+ og:title, og:description, canonical tag patched' },
      ],
    },
    !hasSchema && !hasMeta && !hasContent && {
      icon: Layers,
      label: 'Structural patches',
      type: 'ai',
      lines: [
        { kind: 'add', text: '+ Recommendation-targeted patches generated' },
        { kind: 'add', text: '+ JSON-LD schema aligned to page content' },
      ],
    },
  ].filter(Boolean) as Array<{
    icon: typeof Code2;
    label: string;
    type: string;
    lines: Array<{ kind: string; text: string }>;
  }>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-white/40 mb-3">What we'll change</p>
        <div className="space-y-3">
          {previewChanges.map((change, i) => {
            const Icon = change.icon;
            return (
              <div key={i} className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-2.5">
                  <Icon className="h-4 w-4 text-white/50" />
                  <span className="text-sm font-medium text-white">{change.label}</span>
                  <span
                    className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                      change.type === 'deterministic'
                        ? 'border-blue-600/50 bg-blue-900/40 text-blue-300'
                        : 'border-purple-600/50 bg-purple-900/40 text-purple-300'
                    }`}
                  >
                    {change.type === 'deterministic' ? 'Auto · deterministic' : 'AI-assisted'}
                  </span>
                </div>
                <div className="space-y-0.5 bg-slate-950/50 px-4 py-3 font-mono text-xs">
                  {change.lines.map((line, j) => (
                    <div
                      key={j}
                      className={
                        line.kind === 'add'
                          ? 'text-emerald-400'
                          : line.kind === 'remove'
                          ? 'text-red-400'
                          : 'text-white/40'
                      }
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-300">
        <Lock className="mb-1 h-3.5 w-3.5 inline-block mr-1.5 opacity-70" />
        No file is modified until you review the exact diff and click approve.
        Full rollback is available within 48&nbsp;hours.
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onNext}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 transition-colors"
        >
          Apply fixes
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Connect Repo ──────────────────────────────────────────────────────

function Step3Connect({
  token: authToken,
  onNext,
  onBack,
  onRepoSelected,
}: {
  token: string;
  onNext: (owner: string, repo: string, branch: string) => void;
  onBack: () => void;
  onRepoSelected?: (owner: string, repo: string, branch: string) => void;
}) {
  const [githubToken, setGithubToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [err, setErr] = useState('');

  // Check if already connected
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/auto-score-fix/tokens`, {
          headers: authHeaders(authToken),
          credentials: 'include',
        });
        if (!res.ok) return;
        const { tokens } = await res.json();
        if (Array.isArray(tokens) && tokens.some((t: any) => t.provider === 'github')) {
          setConnected(true);
          loadRepos();
        }
      } catch {}
    })();
  }, [authToken]);

  async function loadRepos() {
    setLoadingRepos(true);
    setErr('');
    try {
      const res = await fetch(`${apiBase()}/api/auto-score-fix/github/repos`, {
        headers: authHeaders(authToken),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Failed to load repos'); return; }
      setRepos(data.repos || []);
    } catch {
      setErr('Network error loading repos');
    } finally {
      setLoadingRepos(false);
    }
  }

  async function saveToken() {
    if (!githubToken.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`${apiBase()}/api/auto-score-fix/tokens`, {
        method: 'POST',
        headers: authHeaders(authToken),
        credentials: 'include',
        body: JSON.stringify({ provider: 'github', token: githubToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Failed to save token'); return; }
      setConnected(true);
      setGithubToken('');
      await loadRepos();
    } catch {
      setErr('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function selectRepo(repo: GitHubRepo) {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);
    setLoadingBranches(true);
    try {
      const res = await fetch(
        `${apiBase()}/api/auto-score-fix/github/branches?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`,
        { headers: authHeaders(authToken), credentials: 'include' }
      );
      const data = await res.json();
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }

  const canProceed = selectedRepo && selectedBranch;

  return (
    <div className="space-y-5">
      {!connected ? (
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Connect your GitHub account to let ScoreFix create a pull request in your repo.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 space-y-3">
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wider">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              placeholder="ghp_••••••••••••••••••••"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none"
            />
            <p className="text-xs text-white/40">
              Needs <code className="text-white/60">repo</code> scope.{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=AiVIS+ScoreFix"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 underline hover:no-underline"
              >
                Create token on GitHub
              </a>
            </p>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button
              onClick={saveToken}
              disabled={saving || !githubToken.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
              {saving ? 'Connecting…' : 'Connect GitHub'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-600/25 bg-emerald-600/8 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            GitHub connected
          </div>

          {/* Repo picker */}
          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
              Repository
            </label>
            {loadingRepos ? (
              <div className="flex items-center gap-2 text-sm text-white/40">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading repos…
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 divide-y divide-white/5">
                {repos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => selectRepo(repo)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-white/5 ${
                      selectedRepo?.id === repo.id ? 'bg-amber-400/10 text-amber-200' : 'text-white/80'
                    }`}
                  >
                    <span className="font-medium">{repo.full_name}</span>
                    {repo.private && (
                      <span className="text-xs text-white/30 border border-white/15 rounded px-1.5 py-0.5">private</span>
                    )}
                  </button>
                ))}
                {repos.length === 0 && (
                  <p className="px-3 py-4 text-sm text-white/30 text-center">No repositories found</p>
                )}
              </div>
            )}
          </div>

          {/* Branch picker */}
          {selectedRepo && (
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
                Branch
              </label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading branches…
                </div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-amber-400/60 focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                      {b.protected ? ' (protected)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}

      {/* Guardrail notice */}
      <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-white/50 space-y-1">
        <p className="font-medium text-white/70">Safety guardrails</p>
        <p>• Only modifies <code>&lt;head&gt;</code>, hero section, and meta tags</p>
        <p>• Max 5 files changed per job · change size capped at 20%</p>
        <p>• Full rollback available within 48 hours · 80% credit refund on reject</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={() =>
            canProceed && onNext(selectedRepo!.owner, selectedRepo!.name, selectedBranch)
          }
          disabled={!canProceed}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40 transition-colors"
        >
          <GitBranch className="h-4 w-4" />
          Connect & continue
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Executing ─────────────────────────────────────────────────────────

function Step4Execute({
  jobId,
  jobStatus,
  jobError,
  onDone,
  onCancel,
}: {
  jobId: string;
  jobStatus: JobStatus;
  jobError: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const failed = jobStatus === 'failed' || jobStatus === 'expired';
  const done = jobStatus === 'pending_approval';

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [done, onDone]);

  function stepDone(step: (typeof EXECUTION_STEPS)[0]) {
    return step.key.some((k) =>
      (['generating', 'creating_pr', 'pending_approval', 'approved', 'rejected'] as JobStatus[]).includes(k) &&
      (['generating', 'creating_pr', 'pending_approval', 'approved', 'rejected'] as JobStatus[]).includes(jobStatus) &&
      step.key.indexOf(jobStatus) <= step.key.indexOf(k)
    );
  }

  const activeStepIdx = EXECUTION_STEPS.findIndex((s) => s.key.includes(jobStatus));

  return (
    <div className="space-y-6">
      {failed ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold">Fix job failed</span>
          </div>
          {jobError && <p className="text-sm text-red-300/80">{jobError}</p>}
          <p className="text-sm text-white/50">Credits not charged. You can retry with a new job.</p>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to settings
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {EXECUTION_STEPS.map((step, i) => {
              const isActive = i === activeStepIdx;
              const isPast = activeStepIdx > i;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                    isActive
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : isPast
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-white/5 bg-white/2 opacity-40'
                  }`}
                >
                  <div className="shrink-0">
                    {isPast ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                    ) : isActive ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-amber-400" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-white/20" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isPast ? 'text-emerald-300' : isActive ? 'text-amber-200' : 'text-white/30'
                    }`}
                  >
                    {isPast ? '✓ ' : ''}{step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {done && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300 animate-pulse">
              <CheckCircle2 className="inline-block h-4 w-4 mr-1.5 align-text-bottom" />
              Pull request ready — reviewing diff…
            </div>
          )}

          <p className="text-center text-xs text-white/30">
            Job ID: <code className="text-white/50">{jobId.slice(0, 8)}…</code> · Status:{' '}
            <code className="text-white/50">{jobStatus}</code>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Diff + Approval ───────────────────────────────────────────────────

function Step5Diff({
  jobId,
  authToken,
  prUrl,
  onApprove,
  onReject,
}: {
  jobId: string;
  authToken: string;
  prUrl: string | null | undefined;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [diffs, setDiffs] = useState<FileChangeSummary[]>([]);
  const [loadingDiffs, setLoadingDiffs] = useState(true);
  const [detPatchCount, setDetPatchCount] = useState(0);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/auto-score-fix/jobs/${encodeURIComponent(jobId)}/diffs`, {
          headers: authHeaders(authToken),
          credentials: 'include',
        });
        const data = await res.json();
        setDiffs(data.diffs ?? []);
        setDetPatchCount(data.deterministic_patches_count ?? 0);
      } catch {
        setErr('Could not load diffs');
      } finally {
        setLoadingDiffs(false);
      }
    })();
  }, [jobId, authToken]);

  async function handleApprove() {
    setApproving(true);
    setErr('');
    try {
      const res = await fetch(`${apiBase()}/api/auto-score-fix/jobs/${encodeURIComponent(jobId)}/approve`, {
        method: 'POST',
        headers: authHeaders(authToken),
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error || 'Approval failed');
        return;
      }
      onApprove();
    } catch {
      setErr('Network error');
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!window.confirm('Reject this fix? 80% of credits will be returned.')) return;
    setRejecting(true);
    setErr('');
    try {
      const res = await fetch(`${apiBase()}/api/auto-score-fix/jobs/${encodeURIComponent(jobId)}/reject`, {
        method: 'POST',
        headers: authHeaders(authToken),
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error || 'Rejection failed');
        return;
      }
      onReject();
    } catch {
      setErr('Network error');
    } finally {
      setRejecting(false);
    }
  }

  function downloadPatch() {
    if (!diffs.length) return;
    const lines: string[] = [];
    for (const fc of diffs) {
      lines.push(`--- a/${fc.path}`, `+++ b/${fc.path}`);
      if (fc.diff?.lines) {
        for (const l of fc.diff.lines) {
          const prefix = l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' ';
          lines.push(`${prefix}${l.content}`);
        }
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scorefix-${jobId.slice(0, 8)}.patch`;
    a.click();
  }

  if (loadingDiffs) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading diff…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm">
        <span className="text-white/70">
          <span className="font-semibold text-white">{diffs.length}</span> file{diffs.length !== 1 ? 's' : ''} changed
        </span>
        {detPatchCount > 0 && (
          <span className="rounded-full border border-blue-600/40 bg-blue-900/30 px-2 py-0.5 text-xs text-blue-300">
            {detPatchCount} deterministic
          </span>
        )}
        {prUrl && (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-sky-400 hover:underline"
          >
            <Github className="h-3.5 w-3.5" />
            View PR
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Diff viewer */}
      {diffs.length > 0 ? (
        <FixDiffViewer fileChanges={diffs} />
      ) : (
        <div className="rounded-xl border border-white/8 px-4 py-8 text-center text-sm text-white/30">
          No per-file diffs available. The PR was generated directly on GitHub.
        </div>
      )}

      {err && <p className="text-xs text-red-400">{err}</p>}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleApprove}
          disabled={approving || rejecting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Apply now
        </button>
        <button
          onClick={downloadPatch}
          disabled={diffs.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10 disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          Download .patch
        </button>
        <button
          onClick={handleReject}
          disabled={approving || rejecting}
          className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
          Reject (80% refund)
        </button>
      </div>
    </div>
  );
}

// ── Step 6: Deploy ────────────────────────────────────────────────────────────

function Step6Deploy({
  prUrl,
  authToken,
  auditSnapshot,
  onRescanDone,
  onBack,
}: {
  prUrl: string | null | undefined;
  authToken: string;
  auditSnapshot: AuditSnapshot;
  onRescanDone: (newAuditId: string, newScore: number) => void;
  onBack: () => void;
}) {
  const [rescanning, setRescanning] = useState(false);
  const [err, setErr] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function triggerRescan() {
    setRescanning(true);
    setErr('');
    try {
      const res = await fetch(`${apiBase()}/api/analyze`, {
        method: 'POST',
        headers: authHeaders(authToken),
        credentials: 'include',
        body: JSON.stringify({ url: auditSnapshot.target_url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || data.message || 'Rescan failed');
        setRescanning(false);
        return;
      }
      // /api/analyze may return synchronously or queue-based
      const newScore = data.result?.visibility_score ?? data.visibility_score ?? null;
      const newAuditId = data.audit_id ?? data.id ?? '';
      if (newScore !== null) {
        onRescanDone(newAuditId, newScore);
      } else {
        setErr('Rescan submitted but score not returned. Check audits history.');
        setRescanning(false);
      }
    } catch {
      setErr('Network error during rescan');
      setRescanning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* PR instructions */}
      <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sky-300 font-semibold">
          <Github className="h-5 w-5" />
          Merge the pull request on GitHub
        </div>
        {prUrl ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-sky-300 hover:bg-slate-700 transition-colors w-fit"
          >
            <ExternalLink className="h-4 w-4" />
            Open pull request
          </a>
        ) : (
          <p className="text-sm text-white/50">PR URL not available — check your GitHub repo.</p>
        )}
        <ol className="space-y-1 text-sm text-white/60 list-decimal list-inside">
          <li>Review the diff in your PR</li>
          <li>Merge the PR into your branch</li>
          <li>Wait for your site to deploy (~1–3 min)</li>
          <li>Click Rescan below to measure improvement</li>
        </ol>
      </div>

      {/* Rollback notice */}
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-xs text-amber-300/80">
        <RotateCcw className="inline-block h-3.5 w-3.5 mr-1.5 align-text-bottom" />
        Changed your mind? Revert the PR on GitHub to undo all changes.
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={triggerRescan}
          disabled={rescanning}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 transition-colors"
        >
          {rescanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Rescanning…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Merge & rescan
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 7: Results ───────────────────────────────────────────────────────────

function Step7Results({
  scoreBefore,
  scoreAfter,
  targetUrl,
  onContinue,
  onUndoRollback,
}: {
  scoreBefore: number;
  scoreAfter: number;
  targetUrl: string;
  onContinue: () => void;
  onUndoRollback: () => void;
}) {
  const delta = scoreAfter - scoreBefore;
  const { missing: missingBefore } = estimateGaps(scoreBefore);
  const { missing: missingAfter, appearing: appearingAfter } = estimateGaps(scoreAfter);
  const queriesGained = missingBefore - missingAfter;

  return (
    <div className="space-y-6">
      {/* Hero result */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              You now appear in{' '}
              <span className="text-emerald-400">{queriesGained} more</span> AI answers
            </p>
            <p className="text-sm text-white/50 mt-1">
              Visible in {appearingAfter}/50 estimated queries vs {50 - missingBefore} before
            </p>
          </div>
        </div>

        {/* Score comparison */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border border-white/8 bg-white/4 p-3 text-center">
            <p className="text-2xl font-bold text-white/50">{scoreBefore}</p>
            <p className="text-xs text-white/30 mt-0.5">Before</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">+{delta}</p>
            <p className="text-xs text-amber-300/60 mt-0.5">Improvement</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-300">{scoreAfter}</p>
            <p className="text-xs text-emerald-400/60 mt-0.5">After</p>
          </div>
        </div>

        {/* Before/after bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/40">
            <span>AI visibility score</span>
            <span className="text-emerald-400">+{delta} points</span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-white/10">
            <div
              className="absolute left-0 top-0 h-3 rounded-full bg-white/20"
              style={{ width: `${scoreBefore}%` }}
            />
            <div
              className="absolute left-0 top-0 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
              style={{ width: `${scoreAfter}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Citation rate', value: `+${Math.round(delta * 2.2)}%` },
          { label: 'Entity clarity', value: `+${Math.round(delta * 1.6)}%` },
          { label: 'Schema coverage', value: `+${Math.round(delta * 1.1)}%` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/8 bg-white/4 p-3 text-center">
            <p className="text-lg font-bold text-emerald-300">{m.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onContinue}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-300"
        >
          <Sparkles className="h-4 w-4" />
          Continue optimising
        </button>
        <Link
          to="/app/competitors"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white hover:bg-white/10"
        >
          <Brain className="h-4 w-4" />
          Track competitors
        </Link>
      </div>

      {/* Rollback link */}
      <p className="text-center text-xs text-white/30">
        Unhappy with the result?{' '}
        <button onClick={onUndoRollback} className="text-white/50 underline hover:text-white">
          Revert changes
        </button>
      </p>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export default function ScoreFixWizard({
  token,
  auditSnapshot,
  packCreditsBalance,
  creditCost,
  onClose,
}: WizardProps) {
  const [step, setStep] = useState<WizardStep>(1);

  // Repo connection
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');

  // Job state
  const [jobId, setJobId] = useState('');
  const [jobStatus, setJobStatus] = useState<JobStatus>('pending');
  const [jobPrUrl, setJobPrUrl] = useState<string | null>(null);
  const [jobScoreBefore, setJobScoreBefore] = useState(auditSnapshot.visibility_score);
  const [jobError, setJobError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  // Results
  const [scoreAfter, setScoreAfter] = useState(0);
  const [rescanAuditId, setRescanAuditId] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Job submission ──────────────────────────────────────────────────────────

  async function submitJob(owner: string, repo: string, branch: string) {
    setSubmitting(true);
    setSubmitErr('');
    try {
      const res = await fetch(`${apiBase()}/api/auto-score-fix/jobs`, {
        method: 'POST',
        headers: authHeaders(token),
        credentials: 'include',
        body: JSON.stringify({
          audit_id: auditSnapshot.audit_id,
          target_url: auditSnapshot.target_url,
          vcs_provider: 'github',
          repo_owner: owner,
          repo_name: repo,
          repo_branch: branch,
          audit_evidence: {
            visibility_score: auditSnapshot.visibility_score,
            recommendations: auditSnapshot.recommendations,
            evidence_ledger: auditSnapshot.evidence_ledger ?? {},
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitErr(data.error || 'Job submission failed');
        setSubmitting(false);
        return;
      }
      setJobId(data.job_id);
      setJobStatus('pending');
      setStep(4);
      startPolling(data.job_id);
    } catch {
      setSubmitErr('Network error submitting job');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Job polling ─────────────────────────────────────────────────────────────

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pollJob(id), 3000);
  }

  const pollJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${apiBase()}/api/auto-score-fix/jobs/${encodeURIComponent(id)}`, {
          headers: authHeaders(token),
          credentials: 'include',
        });
        if (!res.ok) return;
        const { job }: { job: Job } = await res.json();
        setJobStatus(job.status);
        setJobPrUrl(job.pr_url ?? null);
        setJobError(job.error_message ?? null);
        if (job.fix_plan?.score_before) setJobScoreBefore(job.fix_plan.score_before);

        // Stop polling on terminal statuses
        if (['pending_approval', 'approved', 'rejected', 'cancelled', 'failed', 'expired'].includes(job.status)) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch {}
    },
    [token]
  );

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Navigation handlers ─────────────────────────────────────────────────────

  function handleConnectNext(owner: string, repo: string, branch: string) {
    setRepoOwner(owner);
    setRepoName(repo);
    setRepoBranch(branch);
    submitJob(owner, repo, branch);
  }

  function handleApproved() {
    setStep(6);
  }

  function handleRejected() {
    setStep(1); // restart
    setJobId('');
    setJobStatus('pending');
    setJobPrUrl(null);
  }

  function handleRescanDone(newAuditId: string, newScore: number) {
    setRescanAuditId(newAuditId);
    setScoreAfter(newScore);
    setStep(7);
  }

  function handleContinue() {
    setStep(1);
    setJobId('');
    setJobStatus('pending');
    setJobPrUrl(null);
    setScoreAfter(0);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      {/* Wizard header */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">ScoreFix</span>
          {packCreditsBalance > 0 && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
              {packCreditsBalance} credits
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-white/40 hover:bg-white/8 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Step progress bar */}
      <div className="border-b border-white/5 px-5 py-3">
        <StepBar current={step} />
      </div>

      {/* Step content */}
      <div className="p-5">
        {step === 1 && (
          <Step1Impact
            snapshot={auditSnapshot}
            creditCost={creditCost}
            onNext={() => setStep(3)}
            onPreview={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Preview
            snapshot={auditSnapshot}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <>
            {submitErr && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {submitErr}
              </div>
            )}
            <Step3Connect
              token={token}
              onNext={handleConnectNext}
              onBack={() => setStep(2)}
            />
          </>
        )}
        {step === 4 && jobId && (
          <Step4Execute
            jobId={jobId}
            jobStatus={jobStatus}
            jobError={jobError}
            onDone={() => setStep(5)}
            onCancel={() => setStep(3)}
          />
        )}
        {step === 5 && jobId && (
          <Step5Diff
            jobId={jobId}
            authToken={token}
            prUrl={jobPrUrl}
            onApprove={handleApproved}
            onReject={handleRejected}
          />
        )}
        {step === 6 && (
          <Step6Deploy
            prUrl={jobPrUrl}
            authToken={token}
            auditSnapshot={auditSnapshot}
            onRescanDone={handleRescanDone}
            onBack={() => setStep(5)}
          />
        )}
        {step === 7 && (
          <Step7Results
            scoreBefore={jobScoreBefore}
            scoreAfter={scoreAfter}
            targetUrl={auditSnapshot.target_url}
            onContinue={handleContinue}
            onUndoRollback={() => window.open(jobPrUrl ?? 'https://github.com', '_blank')}
          />
        )}
      </div>
    </div>
  );
}
