import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_URL } from "../config";
import { useAuthStore } from "./authStore";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface Workspace {
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  role: WorkspaceRole;
  isDefaultWorkspace: boolean;
}

export interface WorkspaceMember {
  user_id: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joined_at: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;

  // Derived
  activeWorkspace: () => Workspace | null;
  activeRole: () => WorkspaceRole | null;
  canManageMembers: () => boolean;

  // Actions
  setActiveWorkspaceId: (id: string | null) => void;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (orgName: string, wsName: string) => Promise<Workspace>;
  reset: () => void;
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const hdrs: Record<string, string> = { "Content-Type": "application/json" };
  if (token) hdrs["Authorization"] = `Bearer ${token}`;
  return hdrs;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      loading: false,

      activeWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get();
        return workspaces.find((w) => w.workspaceId === activeWorkspaceId) ?? workspaces[0] ?? null;
      },

      activeRole: () => get().activeWorkspace()?.role ?? null,

      canManageMembers: () => {
        const role = get().activeRole();
        return role === "owner" || role === "admin";
      },

      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

      fetchWorkspaces: async () => {
        set({ loading: true });
        try {
          const res = await fetch(`${API_URL}/api/workspaces`, { headers: authHeaders() });
          if (!res.ok) throw new Error("Failed to load workspaces");
          const json = await res.json();
          const data: Workspace[] = (json.data || []).map((r: any) => ({
            workspaceId: String(r.workspaceId),
            workspaceName: String(r.workspaceName || "Workspace"),
            organizationId: String(r.organizationId),
            organizationName: String(r.organizationName || "Organization"),
            role: r.role || "member",
            isDefaultWorkspace: r.isDefaultWorkspace === true,
          }));
          set({ workspaces: data });
          // Auto-select first workspace if none active
          const { activeWorkspaceId } = get();
          if (!activeWorkspaceId && data.length > 0) {
            set({ activeWorkspaceId: data[0].workspaceId });
          }
          // Also store resolved workspace header
          const resolved = res.headers.get("x-workspace-id");
          if (resolved && !activeWorkspaceId) {
            set({ activeWorkspaceId: resolved });
          }
        } catch {
          // keep existing
        } finally {
          set({ loading: false });
        }
      },

      createWorkspace: async (orgName, wsName) => {
        const res = await fetch(`${API_URL}/api/workspaces`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ organizationName: orgName, workspaceName: wsName }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create workspace");
        }
        const json = await res.json();
        const ws: Workspace = {
          workspaceId: json.data.workspaceId,
          workspaceName: json.data.workspaceName,
          organizationId: json.data.organizationId,
          organizationName: json.data.organizationName,
          role: json.data.membershipRole || "owner",
          isDefaultWorkspace: json.data.isDefaultWorkspace === true,
        };
        set((s) => ({ workspaces: [...s.workspaces, ws], activeWorkspaceId: ws.workspaceId }));
        return ws;
      },

      reset: () => set({ workspaces: [], activeWorkspaceId: null, loading: false }),
    }),
    {
      name: "aivis-workspace",
      partialize: (s) => ({ activeWorkspaceId: s.activeWorkspaceId }),
    }
  )
);

/** Returns the X-Workspace-Id header object for API calls */
export function getWorkspaceHeader(): Record<string, string> {
  const id = useWorkspaceStore.getState().activeWorkspaceId;
  return id ? { "X-Workspace-Id": id } : {};
}
