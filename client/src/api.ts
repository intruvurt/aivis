// client/src/api.ts
import { API_URL } from "./config";
import { useAuthStore } from "./stores/authStore";
import { getWorkspaceHeader, useWorkspaceStore } from "./stores/workspaceStore";
import type { CitationIdentityResponse, ServerHeadersCheckResult, QueryPack } from "@shared/types";

type ApiError = Error & { status?: number; code?: string };

function safeJson(text: string): any {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    // If the server/proxy returned HTML or plain text, keep it readable
    return { error: text?.slice(0, 500) || "Invalid JSON response" };
  }
}

// Refresh: re-validates the current token and updates user info in the store.
// The server does not issue new JWTs on refresh - if the token is expired, this fails
// and the caller should clear auth state.
async function tryRefreshTokenOnce(): Promise<boolean> {
  try {
    const existing = useAuthStore.getState().token;
    if (!existing) return false;

    const res = await fetch(`${API_URL}/api/user/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${existing}`,
      },
    });

    if (!res.ok) return false;

    const payload = await res.json();
    if (!payload?.success || !payload?.user) {
      return false;
    }

    if (payload?.success && payload?.user) {
      // Update user info (tier, role, entitlements) without changing the token
      const store = useAuthStore.getState();
      if (store.user && store.setUser) {
        store.setUser({ ...store.user, ...payload.user });
      }
    }

    return true;
  } catch {
    return false;
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}, opts?: { includeCredentials?: boolean }): Promise<T> {
  const token = useAuthStore.getState().token;
  const wsHeaders = getWorkspaceHeader();
  const hadWorkspaceHeader = Object.keys(wsHeaders).length > 0;

  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  for (const [k, v] of Object.entries(wsHeaders)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: opts?.includeCredentials ? "include" : "omit",
  });

  const text = await res.text();
  const data = safeJson(text);

  if (res.status === 401) {
    console.error("[client/api] API unauthorized", { path, status: res.status, body: data });
    // One retry after attempting refresh (covers boot-time races)
    const refreshed = await tryRefreshTokenOnce();
    if (refreshed) {
      const token2 = useAuthStore.getState().token;
      const headers2 = new Headers(init.headers || {});
      if (!headers2.has("Content-Type") && init.body) headers2.set("Content-Type", "application/json");
      if (token2) headers2.set("Authorization", `Bearer ${token2}`);
      for (const [k, v] of Object.entries(wsHeaders)) {
        if (!headers2.has(k)) headers2.set(k, v);
      }

      const res2 = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: headers2,
        credentials: opts?.includeCredentials ? "include" : "omit",
      });

      const text2 = await res2.text();
      const data2 = safeJson(text2);

      if (res2.status === 401) {
        console.error("[client/api] API retry unauthorized", { path, status: res2.status, body: data2 });
        const err: ApiError = new Error("401_UNAUTHORIZED");
        err.status = 401;
        err.code = data2?.code;
        throw err;
      }
      if (!res2.ok) {
        console.error("[client/api] API retry failed", { path, status: res2.status, body: data2 });
        const err: ApiError = new Error(data2?.error || data2?.message || `Request failed (${res2.status})`);
        err.status = res2.status;
        err.code = data2?.code;
        throw err;
      }
      return data2 as T;
    }

    const err: ApiError = new Error("401_UNAUTHORIZED");
    err.status = 401;
    err.code = data?.code;
    throw err;
  }

  if (!res.ok) {
    let errorPayload = data;
    if (res.status === 403 && hadWorkspaceHeader) {
      const code = String(data?.code || "").toUpperCase();
      if (code === "WORKSPACE_ACCESS_DENIED") {
        try {
          useWorkspaceStore.getState().setActiveWorkspaceId(null);
        } catch {
          // Continue with original failure if workspace store update fails.
        }

        const retryHeaders = new Headers(init.headers || {});
        if (!retryHeaders.has("Content-Type") && init.body) retryHeaders.set("Content-Type", "application/json");
        const retryToken = useAuthStore.getState().token;
        if (retryToken) retryHeaders.set("Authorization", `Bearer ${retryToken}`);
        retryHeaders.delete("X-Workspace-Id");
        retryHeaders.delete("x-workspace-id");

        res = await fetch(`${API_URL}${path}`, {
          ...init,
          headers: retryHeaders,
          credentials: opts?.includeCredentials ? "include" : "omit",
        });

        if (res.ok) {
          const retryText = await res.text();
          const retryData = safeJson(retryText);
          return retryData as T;
        }

        const retryText = await res.text();
        errorPayload = safeJson(retryText);
      }
    }

    console.error("[client/api] API request failed", { path, status: res.status, body: errorPayload });
    const err: ApiError = new Error(errorPayload?.error || errorPayload?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = errorPayload?.code;
    throw err;
  }

  return data as T;
}

// Existing
export function analyzeSite(payload: { url: string;[k: string]: any }) {
  return apiFetch("/api/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Site Crawl API
export function startSiteCrawl(payload: { url: string; maxPages?: number; maxDepth?: number }) {
  return apiFetch<{ success: boolean; data: SiteCrawlResult }>("/api/seo/crawl", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listSiteCrawls() {
  return apiFetch<{ success: boolean; data: SiteCrawlSummary[] }>("/api/seo/crawls");
}

export function getSiteCrawl(id: string) {
  return apiFetch<{ success: boolean; data: SiteCrawlResult }>(`/api/seo/crawl/${encodeURIComponent(id)}`);
}

export interface SiteCrawlPage {
  url: string;
  depth: number;
  status: string;
  seo_diagnostics: Record<string, { status: string; label?: string; detail?: string }>;
  issues: string[];
  links_discovered: number;
  canonical_url?: string;
  word_count?: number;
  title?: string;
  error?: string;
}

export interface SiteCrawlResult {
  crawl_id: string;
  root_url: string;
  total_pages_crawled: number;
  max_pages: number;
  pages_with_errors: number;
  average_word_count: number;
  issue_counts: { pass: number; warn: number; fail: number };
  started_at: string;
  completed_at: string;
  pages: SiteCrawlPage[];
}

export interface SiteCrawlSummary {
  crawl_id: string;
  root_url: string;
  total_pages_crawled: number;
  max_pages: number;
  pages_with_errors: number;
  average_word_count: number;
  issue_counts: { pass: number; warn: number; fail: number };
  started_at: string;
  completed_at: string;
  created_at: string;
}

// NEW: citations API
export function generateCitationQueries(payload: { url: string }) {
  return apiFetch("/api/citations/generate-queries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startCitationTest(payload: { url: string; queries: string[] }) {
  return apiFetch("/api/citations/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCitationTest(id: string) {
  return apiFetch(`/api/citations/test/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export function listCitationTests() {
  return apiFetch("/api/citations/tests", {
    method: "GET",
  });
}

export function getCitationIdentity(url: string) {
  return apiFetch<{ success?: boolean; identity?: CitationIdentityResponse }>(`/api/citations/identity?url=${encodeURIComponent(url)}`, {
    method: "GET",
  });
}

export function authorityCheck(payload: { target: string; officialUrl?: string; platforms?: string[] }) {
  return apiFetch<{ success: boolean; report: import("../../shared/types").AuthorityCheckResponse }>("/api/citations/authority-check", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Query Pack API
// ────────────────────────────────────────────────────────────────────────────

export function createQueryPack(payload: {
  name: string;
  description?: string;
  queries: string[];
  tags?: string[];
  client_name?: string;
}) {
  return apiFetch<{ success?: boolean; pack: QueryPack }>("/api/citations/query-packs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listQueryPacks() {
  return apiFetch<{ success?: boolean; packs: QueryPack[] }>("/api/citations/query-packs", {
    method: "GET",
  });
}

export function getQueryPack(id: string) {
  return apiFetch(`/api/citations/query-packs/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export function updateQueryPack(id: string, payload: { name?: string; description?: string; queries?: string[]; tags?: string[] }) {
  return apiFetch(`/api/citations/query-packs/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteQueryPack(id: string) {
  return apiFetch(`/api/citations/query-packs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function executeQueryPack(id: string, payload: { url: string; platforms?: string[] }) {
  return apiFetch<{ success?: boolean; test_id: string }>(`/api/citations/query-packs/${encodeURIComponent(id)}/execute`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Citation Evidence API
// ────────────────────────────────────────────────────────────────────────────

export function getCitationEvidence(testId: string) {
  return apiFetch(`/api/citations/test/${encodeURIComponent(testId)}/evidence`, {
    method: "GET",
  });
}

export function curateEvidence(
  id: string,
  payload: { starred?: boolean; curated?: boolean; curation_note?: string }
) {
  return apiFetch(`/api/citations/evidence/${encodeURIComponent(id)}/curate`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getRevCiteSuggestions(id: string) {
  return apiFetch(`/api/citations/evidence/${encodeURIComponent(id)}/rev-cite`, {
    method: "GET",
  });
}

export function sendMeasurementProtocolEvent(payload: {
  eventName: string;
  eventParams?: Record<string, string | number | boolean>;
  clientId?: string;
}) {
  return apiFetch("/api/features/analytics/measurement-event", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCompliancePolicy() {
  return apiFetch("/api/compliance/policy", {
    method: "GET",
  });
}

export function getComplianceStatus() {
  return apiFetch("/api/compliance/status", {
    method: "GET",
  });
}

export function getConsentRecords() {
  return apiFetch("/api/compliance/consent", {
    method: "GET",
  });
}

export function upsertConsentRecord(payload: {
  consentType: "analytics" | "marketing" | "terms" | "privacy" | "consumer_disclaimer";
  status: "accepted" | "declined" | "revoked";
  policyVersion?: string;
  source?: "web" | "ios" | "android";
  metadata?: Record<string, unknown>;
}) {
  return apiFetch("/api/compliance/consent", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkServerHeaders(payload: { url: string }) {
  return apiFetch<{ success: boolean; result: ServerHeadersCheckResult }>("/api/tools/server-headers-check", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkSchemaMarkup(payload: { url: string }) {
  return apiFetch<{ success: boolean; result: any }>("/api/tools/schema-validator", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkRobotsAccess(payload: { url: string }) {
  return apiFetch<{ success: boolean; result: any }>("/api/tools/robots-checker", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkContentExtractability(payload: { url: string }) {
  return apiFetch<{ success: boolean; result: any }>("/api/tools/content-extractability", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkLanguage(payload: { url: string }) {
  return apiFetch<{ success: boolean; result: any }>("/api/tools/language-checker", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
