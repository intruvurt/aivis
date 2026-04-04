import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Users, Plus, Mail, Shield, UserMinus, ChevronDown, Building2, Clock, Check, X, Edit2, Crown, Eye, Lock, Zap, Link, GitBranch, BarChart2, Activity, ExternalLink, Settings, Send, Target } from "lucide-react";
import { useWorkspaceStore, Workspace, WorkspaceMember, WorkspaceRole } from "../stores/workspaceStore";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../utils/api";
import { API_URL } from "../config";
import toast from "react-hot-toast";
import { TIER_LIMITS, uiTierFromCanonical } from "../../../shared/types";

/** Build headers with workspace context + JSON content type */
function wsHeaders(wsId: string | null, json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (wsId) h["X-Workspace-Id"] = wsId;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

/* ── Role helpers ──────────────────────────────── */
const ROLE_BADGE: Record<WorkspaceRole, { label: string; color: string }> = {
  owner: { label: "Owner", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  admin: { label: "Admin", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  member: { label: "Member", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  viewer: { label: "Viewer", color: "bg-white/10 text-white/60 border-white/15" },
};

function RoleBadge({ role }: { role: WorkspaceRole }) {
  const b = ROLE_BADGE[role] || ROLE_BADGE.member;
  return <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded border ${b.color}`}>{b.label}</span>;
}

/* ── Invite row type ───────────────────────────── */
interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

/* ── Team audit row ────────────────────────────── */
interface TeamAudit {
  id: string;
  url: string;
  visibility_score: number | null;
  created_at: string;
  author_email: string;
  author_name: string | null;
}

interface WorkspaceActivityEntry {
  id: string;
  type: string;
  metadata: Record<string, any>;
  created_at: string;
  actor: {
    user_id: string;
    email: string;
    name: string | null;
    role: WorkspaceRole;
  } | null;
}

function activityLabel(entry: WorkspaceActivityEntry): string {
  switch (entry.type) {
    case 'audit.completed':
      return `Completed audit on ${entry.metadata?.url || 'tracked URL'}`;
    case 'workspace.member_added':
      return `Added ${entry.metadata?.targetEmail || 'a member'} to the workspace`;
    case 'workspace.member_role_updated':
      return `Updated member role to ${entry.metadata?.role || 'member'}`;
    case 'workspace.member_removed':
      return 'Removed a member from the workspace';
    case 'workspace.invite_created':
      return `Sent invite to ${entry.metadata?.email || 'a teammate'}`;
    case 'workspace.invite_revoked':
      return 'Revoked a pending invite';
    case 'workspace.renamed':
      return `Renamed workspace to ${entry.metadata?.name || 'new name'}`;
    case 'integration.github.connected':
      return `Connected GitHub App${entry.metadata?.accountLogin ? ` for ${entry.metadata.accountLogin}` : ''}`;
    case 'integration.github.disconnected':
      return 'Disconnected GitHub App';
    default:
      return entry.type.replace(/[._]/g, ' ');
  }
}

/* ── Main page ─────────────────────────────────── */
export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const { workspaces, activeWorkspaceId, fetchWorkspaces, createWorkspace, canManageMembers, activeWorkspace, activeRole } = useWorkspaceStore();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [teamAudits, setTeamAudits] = useState<TeamAudit[]>([]);
  const [activity, setActivity] = useState<WorkspaceActivityEntry[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Create workspace form
  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [wsName, setWsName] = useState("");
  const [creating, setCreating] = useState(false);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);

  // Rename workspace
  const [renamingWs, setRenamingWs] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renamingSaving, setRenamingSaving] = useState(false);

  const ws = activeWorkspace();
  const role = activeRole();
  const canManage = canManageMembers();

  const uiTier = uiTierFromCanonical((user?.tier || 'observer') as any);
  const tierLimits = TIER_LIMITS[uiTier];
  const maxSeats = tierLimits.maxTeamMembers;
  const hasTeamAccess = tierLimits.hasTeamWorkspaces;
  const hasInviteManagement = tierLimits.hasInviteManagement;

  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  // Team stats derived from loaded data
  const teamStats = useMemo(() => {
    const scores = teamAudits.filter((a) => a.visibility_score != null).map((a) => a.visibility_score as number);
    const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeMemberEmails = new Set(
      teamAudits.filter((a) => new Date(a.created_at) >= cutoff).map((a) => a.author_email)
    );
    return { total: teamAudits.length, avgScore, activeThisWeek: activeMemberEmails.size };
  }, [teamAudits]);

  // Per-member audit count map
  const memberAuditCounts = useMemo(() => {
    const map: Record<string, number> = {};
    teamAudits.forEach((a) => { map[a.author_email] = (map[a.author_email] || 0) + 1; });
    return map;
  }, [teamAudits]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const loadMembers = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoadingMembers(true);
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/members`, { headers: wsHeaders(activeWorkspaceId) });
      if (resp.ok) { const j = await resp.json(); setMembers(j.data || []); }
    } catch { /* ignore */ }
    setLoadingMembers(false);
  }, [activeWorkspaceId]);

  const loadInvites = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/invites`, { headers: wsHeaders(activeWorkspaceId) });
      if (resp.ok) { const j = await resp.json(); setInvites(j.data || []); }
    } catch { /* ignore */ }
  }, [activeWorkspaceId]);

  const loadTeamAudits = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoadingAudits(true);
    try {
      const resp = await apiFetch(`${API_URL}/api/audits?team=true&limit=20`, { headers: wsHeaders(activeWorkspaceId) });
      if (resp.ok) { const j = await resp.json(); setTeamAudits(j.data || j.audits || []); }
    } catch { /* ignore */ }
    setLoadingAudits(false);
  }, [activeWorkspaceId]);

  const loadActivity = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoadingActivity(true);
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/activity?limit=20`, { headers: wsHeaders(activeWorkspaceId) });
      if (resp.ok) {
        const j = await resp.json();
        setActivity(j.data || []);
      }
    } catch {
      // ignore
    }
    setLoadingActivity(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadMembers();
    loadInvites();
    loadTeamAudits();
    loadActivity();
  }, [loadMembers, loadInvites, loadTeamAudits, loadActivity]);

  /* ── Actions ────────────────────────────── */
  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || !wsName.trim()) return;
    setCreating(true);
    try {
      await createWorkspace(orgName.trim(), wsName.trim());
      toast.success("Workspace created");
      setShowCreate(false);
      setOrgName("");
      setWsName("");
      fetchWorkspaces();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create workspace");
    }
    setCreating(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspaceId) return;
    setInviting(true);
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/invites`, {
        method: "POST",
        headers: wsHeaders(activeWorkspaceId, true),
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const j = await resp.json().catch(() => ({} as any));
      if (resp.ok && j.success !== false) {
        toast.success(`Invite sent to ${inviteEmail}`);
        setInviteEmail("");
        setShowInvite(false);
        loadInvites();
      } else {
        const errorMsg = j.detail ? `${j.error}: ${j.detail}` : (j.error || "Failed to send invite");
        toast.error(errorMsg);
      }
    } catch {
      toast.error("Failed to send invite");
    }
    setInviting(false);
  }

  async function handleUpdateRole(targetUserId: string, newRole: "admin" | "member" | "viewer") {
    if (!activeWorkspaceId) return;
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/members/${targetUserId}`, {
        method: "PATCH",
        headers: wsHeaders(activeWorkspaceId, true),
        body: JSON.stringify({ role: newRole }),
      });
      const j = await resp.json().catch(() => ({} as any));
      if (resp.ok && j.success !== false) {
        toast.success("Role updated");
        loadMembers();
      } else {
        toast.error(j.error || "Failed to update role");
      }
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function handleRemoveMember(targetUserId: string, email: string) {
    if (!activeWorkspaceId) return;
    if (!window.confirm(`Remove ${email} from this workspace?`)) return;
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/members/${targetUserId}`, {
        method: "DELETE",
        headers: wsHeaders(activeWorkspaceId),
      });
      const j = await resp.json().catch(() => ({} as any));
      if (resp.ok && j.success !== false) {
        toast.success("Member removed");
        loadMembers();
      } else {
        toast.error(j.error || "Failed to remove member");
      }
    } catch {
      toast.error("Failed to remove member");
    }
  }

  async function handleRevokeInvite(inviteId: string, email: string) {
    if (!activeWorkspaceId) return;
    if (!window.confirm(`Revoke invite for ${email}?`)) return;
    setRevokingInviteId(inviteId);
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/invites/${inviteId}`, {
        method: "DELETE",
        headers: wsHeaders(activeWorkspaceId),
      });
      const j = await resp.json().catch(() => ({} as any));
      if (resp.ok && j.success !== false) {
        toast.success(`Invite for ${email} revoked`);
        loadInvites();
      } else {
        toast.error(j.error || "Failed to revoke invite");
      }
    } catch {
      toast.error("Failed to revoke invite");
    }
    setRevokingInviteId(null);
  }

  async function handleRenameWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId || !renameValue.trim()) return;
    setRenamingSaving(true);
    try {
      const resp = await apiFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/rename`, {
        method: "PATCH",
        headers: wsHeaders(activeWorkspaceId, true),
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const j = await resp.json().catch(() => ({} as any));
      if (resp.ok && j.success !== false) {
        toast.success("Workspace renamed");
        setRenamingWs(false);
        fetchWorkspaces();
      } else {
        toast.error(j.error || "Failed to rename workspace");
      }
    } catch {
      toast.error("Failed to rename workspace");
    }
    setRenamingSaving(false);
  }

  /* ── Render ─────────────────────────────── */

  // Observer tier gate — personal workspace only
  if (!hasTeamAccess) {
    return (
      <div className="px-4 py-8">
        <div className="flex items-center gap-2.5 mb-8">
          <Users className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Team &amp; Workspaces</h1>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-8 text-center">
          <Lock className="w-10 h-10 text-violet-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-white mb-2">Team workspaces start with Alignment</h2>
          <p className="text-sm text-white/50 max-w-md mx-auto mb-5">
            Upgrade to Alignment [$49/mo] for up to 3 team seats, or Signal [$149/mo] for up to 10 seats with invite management and shared audit feeds.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-semibold hover:from-violet-600 hover:to-cyan-600 transition-all shadow-lg shadow-violet-500/20"
          >
            <Zap className="w-4 h-4" /> View Upgrade Options
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-cyan-400" />
            Team &amp; Workspaces
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Manage team members, invite collaborators, and view shared audit activity.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/30 hover:to-violet-500/30 transition-all"
        >
          <Plus className="w-4 h-4" /> New Workspace
        </button>
      </div>

      {/* Create workspace form */}
      {showCreate && (
        <form onSubmit={handleCreateWorkspace} className="p-4 rounded-xl border border-white/10 bg-charcoal-light/40 space-y-3">
          <p className="text-sm font-semibold text-white/80">Create a new team workspace</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Organization name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="px-3 py-2 rounded-lg bg-charcoal-deep/60 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
              maxLength={120}
            />
            <input
              type="text"
              placeholder="Workspace name"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              className="px-3 py-2 rounded-lg bg-charcoal-deep/60 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
              maxLength={120}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50 transition-all">
              {creating ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Workspace switcher cards */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-3">Your Workspaces</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workspaces.map((w) => (
            <button
              key={w.workspaceId}
              onClick={() => useWorkspaceStore.getState().setActiveWorkspaceId(w.workspaceId)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                w.workspaceId === activeWorkspaceId
                  ? "border-cyan-500/40 bg-cyan-500/10 shadow-lg shadow-cyan-500/5"
                  : "border-white/8 bg-charcoal-light/30 hover:border-white/15 hover:bg-charcoal-light/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white truncate">{w.workspaceName}</span>
                {w.workspaceId === activeWorkspaceId && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{w.organizationName}</span>
                <span className="text-white/20">•</span>
                <RoleBadge role={w.role} />
              </div>
              {w.isDefaultWorkspace && <span className="text-[10px] text-white/25 mt-1 block">Personal workspace</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Active workspace details */}
      {ws && (
        <>
          {/* Getting started — team purpose & onboarding */}
          {members.length <= 1 && (
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-violet-500/5 p-6">
              <h2 className="text-base font-semibold text-white mb-1">Get started with your team workspace</h2>
              <p className="text-sm text-white/55 mb-5">
                Team workspaces let everyone run audits, track competitors, and monitor AI visibility from one shared space. Here's how to set up:
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-white/8 bg-charcoal-light/30">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium text-white/90">Invite your team</p>
                    <p className="text-xs text-white/45 mt-0.5">Add colleagues below — owners, admins, members, or viewers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-white/8 bg-charcoal-light/30">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/20 text-violet-300 text-sm font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium text-white/90">Run audits together</p>
                    <p className="text-xs text-white/45 mt-0.5">Every audit your team runs appears in the shared feed below.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-white/8 bg-charcoal-light/30">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium text-white/90">Track progress</p>
                    <p className="text-xs text-white/45 mt-0.5">Watch team stats, average scores, and active members update in real time.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/8 bg-charcoal-light/30 p-4 flex flex-col gap-1">
              <span className="text-[11px] text-white/40 uppercase tracking-wider">Team Audits</span>
              <span className="text-2xl font-bold text-white">{teamStats.total}</span>
              <span className="text-[11px] text-white/30">across all members</span>
            </div>
            <div className="rounded-xl border border-white/8 bg-charcoal-light/30 p-4 flex flex-col gap-1">
              <span className="text-[11px] text-white/40 uppercase tracking-wider">Avg Score</span>
              <span className={`text-2xl font-bold ${teamStats.avgScore == null ? 'text-white/30' : teamStats.avgScore >= 70 ? 'text-emerald-300' : teamStats.avgScore >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
                {teamStats.avgScore != null ? teamStats.avgScore : '—'}
              </span>
              <span className="text-[11px] text-white/30">visibility score</span>
            </div>
            <div className="rounded-xl border border-white/8 bg-charcoal-light/30 p-4 flex flex-col gap-1">
              <span className="text-[11px] text-white/40 uppercase tracking-wider">Active This Week</span>
              <span className="text-2xl font-bold text-cyan-300">{teamStats.activeThisWeek}</span>
              <span className="text-[11px] text-white/30">member{teamStats.activeThisWeek !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Quick-launch panel */}
          <div className="rounded-xl border border-white/8 bg-charcoal-light/20 p-4">
            <p className="text-[11px] text-white/35 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              <a href="/analyze" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/12 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20 transition-all">
                <Target className="w-3.5 h-3.5" /> Run Audit
              </a>
              <a href="/integrations" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/7 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/10 transition-all">
                <Link className="w-3.5 h-3.5" /> Integrations
              </a>
              {tierLimits.hasCitationTesting && (
                <a href="/citations" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/7 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/10 transition-all">
                  <Activity className="w-3.5 h-3.5" /> Citations
                </a>
              )}
              {tierLimits.hasCompetitorTracking && (
                <a href="/competitors" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/7 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/10 transition-all">
                  <BarChart2 className="w-3.5 h-3.5" /> Competitors
                </a>
              )}
              <a href="/analytics" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/7 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/10 transition-all">
                <BarChart2 className="w-3.5 h-3.5" /> Analytics
              </a>
              {(role === 'owner') && (
                <button
                  onClick={() => { setRenamingWs(true); setRenameValue(ws.workspaceName); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/7 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/10 transition-all"
                >
                  <Settings className="w-3.5 h-3.5" /> Rename Workspace
                </button>
              )}
            </div>
            {renamingWs && (
              <form onSubmit={handleRenameWorkspace} className="mt-3 flex gap-2 items-center">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={80}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-charcoal-deep/60 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                  placeholder="New workspace name"
                />
                <button type="submit" disabled={renamingSaving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50 transition-all">
                  {renamingSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setRenamingWs(false)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/7 border border-white/10 text-white/50 hover:text-white/70 transition-all">
                  Cancel
                </button>
              </form>
            )}
          </div>

          {/* Member management */}
          <div className="rounded-xl border border-white/10 bg-charcoal-light/30 overflow-hidden">
            <div className="p-4 border-b border-white/8 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-400" /> Members — {ws.workspaceName}
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {members.length}
                  {maxSeats !== -1 ? `/${maxSeats}` : ""} seat{members.length !== 1 ? "s" : ""} used
                  {maxSeats !== -1 && members.length >= maxSeats && (
                    <span className="ml-2 text-amber-400 font-medium">· Seat limit reached</span>
                  )}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => setShowInvite(!showInvite)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition-all"
                >
                  <Mail className="w-3.5 h-3.5" /> Invite
                </button>
              )}
            </div>

            {/* Invite form */}
            {showInvite && canManage && (
              <form onSubmit={handleInvite} className="p-4 border-b border-white/8 bg-violet-500/5">
                <div className="flex flex-wrap gap-2 items-end">
                  <input
                    type="email"
                    placeholder="team@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    enterKeyHint="send"
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-charcoal-deep/60 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
                    className="px-3 py-2 rounded-lg bg-charcoal-deep/60 border border-white/10 text-sm text-white focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="submit" disabled={inviting} className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition-all">
                    {inviting ? "Sending…" : "Send Invite"}
                  </button>
                </div>
              </form>
            )}

            {/* Member list */}
            {loadingMembers ? (
              <div className="p-6 text-center text-white/30 text-sm">Loading members…</div>
            ) : (
              <div className="divide-y divide-white/5">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center text-[10px] font-bold text-white/70 flex-shrink-0">
                        {(m.name || m.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{m.name || m.email}</p>
                        {m.name && <p className="text-xs text-white/35 truncate">{m.email}</p>}
                        {memberAuditCounts[m.email] != null && (
                          <p className="text-[10px] text-white/25 mt-0.5">{memberAuditCounts[m.email]} audit{memberAuditCounts[m.email] !== 1 ? 's' : ''} run</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <RoleBadge role={m.role} />
                      {canManage && m.role !== "owner" && m.user_id !== user?.id && (
                        <div className="flex items-center gap-1 ml-2">
                          <select
                            value={m.role}
                            onChange={(e) => handleUpdateRole(m.user_id, e.target.value as "admin" | "member" | "viewer")}
                            className="px-1.5 py-0.5 rounded bg-charcoal-deep/80 border border-white/10 text-[11px] text-white/60 focus:outline-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(m.user_id, m.email)}
                            className="p-1 rounded hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors"
                            title="Remove member"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-400/60 ml-2" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-charcoal-light/30 overflow-hidden">
              <div className="p-4 border-b border-white/8">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Pending Invites
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {invites.filter((i) => !i.accepted_at).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-4 h-4 text-white/30 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 truncate">{inv.email}</p>
                        <p className="text-[11px] text-white/30">
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RoleBadge role={inv.role as WorkspaceRole} />
                      {(canManage && hasInviteManagement) && (
                        <button
                          onClick={() => handleRevokeInvite(inv.id, inv.email)}
                          disabled={revokingInviteId === inv.id}
                          className="p-1 rounded hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Revoke invite"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-charcoal-light/30 overflow-hidden">
            <div className="p-4 border-b border-white/8">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> Workspace Activity Ledger
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                Shared action history across invites, audits, role changes, and integrations.
              </p>
            </div>
            {loadingActivity ? (
              <div className="p-6 text-center text-white/30 text-sm">Loading activity…</div>
            ) : activity.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/40">No shared activity yet</p>
                <p className="text-xs text-white/25 mt-1">Audits, invites, role changes, and integrations will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/85">{activityLabel(entry)}</p>
                      <p className="text-[11px] text-white/35 mt-0.5">
                        {entry.actor?.name || entry.actor?.email || 'System'} · {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                    {entry.type === 'audit.completed' && typeof entry.metadata?.visibilityScore === 'number' && (
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                        entry.metadata.visibilityScore >= 70
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : entry.metadata.visibilityScore >= 40
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-red-500/15 text-red-300'
                      }`}>
                        {Math.round(entry.metadata.visibilityScore)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team audit feed */}
          <div className="rounded-xl border border-white/10 bg-charcoal-light/30 overflow-hidden">
            <div className="p-4 border-b border-white/8">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" /> Team Audit Activity
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                Recent audits across all workspace members
              </p>
            </div>
            {loadingAudits ? (
              <div className="p-6 text-center text-white/30 text-sm">Loading audits…</div>
            ) : teamAudits.length === 0 ? (
              <div className="p-8 text-center">
                <Eye className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/40">No team audits yet</p>
                <p className="text-xs text-white/25 mt-1">Audits run by workspace members will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {teamAudits.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{a.url}</p>
                      <p className="text-[11px] text-white/35 mt-0.5">
                        by {a.author_name || a.author_email || "—"} · {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {a.visibility_score != null && (
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                        a.visibility_score >= 70
                          ? "bg-emerald-500/15 text-emerald-300"
                          : a.visibility_score >= 40
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-red-500/15 text-red-300"
                      }`}>
                        {Math.round(a.visibility_score)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Integrations panel */}
      <div className="rounded-xl border border-white/10 bg-charcoal-light/30 overflow-hidden">
        <div className="p-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Link className="w-4 h-4 text-cyan-400" /> Integrations
          </h2>
          <p className="text-xs text-white/40 mt-0.5">Connect third-party tools to your workspace</p>
        </div>
        <div className="divide-y divide-white/5">
          {/* GitHub */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">GitHub</p>
                <p className="text-[11px] text-white/40">Automated PR generation via Score Fix</p>
              </div>
            </div>
            {tierLimits.hasAutoPR ? (
              <a
                href="/integrations"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/8 border border-white/12 text-white/70 hover:bg-white/12 transition-all"
              >
                Configure
              </a>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/30 rounded-lg bg-white/5 border border-white/8">
                <Lock className="w-3 h-3" /> Score Fix only
              </div>
            )}
          </div>

          {/* Slack */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Slack Notifications</p>
                <p className="text-[11px] text-white/40">Get audit alerts in your team Slack channel</p>
              </div>
            </div>
            {hasInviteManagement ? (
              <a
                href="/integrations"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/8 border border-white/12 text-white/70 hover:bg-white/12 transition-all"
              >
                Configure
              </a>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/30 rounded-lg bg-white/5 border border-white/8">
                <Lock className="w-3 h-3" /> Signal+ required
              </div>
            )}
          </div>

          {/* Zapier */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center">
                <Zap className="w-4 h-4 text-orange-400/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Zapier</p>
                <p className="text-[11px] text-white/40">Trigger workflows on audit completion</p>
              </div>
            </div>
            {hasInviteManagement ? (
              <a
                href="/integrations"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/8 border border-white/12 text-white/70 hover:bg-white/12 transition-all"
              >
                Configure
              </a>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/30 rounded-lg bg-white/5 border border-white/8">
                <Lock className="w-3 h-3" /> Signal+ required
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
