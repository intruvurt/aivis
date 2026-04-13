import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { buildBearerHeader } from './authToken';
import { getWorkspaceHeader } from '../stores/workspaceStore';

const DEFAULT_TIMEOUT_MS = 60_000;

interface ApiFetchOptions extends RequestInit {
  retries?: number;
  timeoutMs?: number;
}

function resolveSameOriginFallback(input: RequestInfo): string | null {
  if (typeof window === 'undefined' || typeof input !== 'string') return null;
  if (!/^https?:\/\//i.test(input)) return null;

  try {
    const target = new URL(input);
    const configured = new URL(API_URL);
    if (target.origin !== configured.origin) return null;
    const localOrigin = window.location.origin.replace(/\/$/, '');
    if (target.origin === localOrigin) return null;
    return `${localOrigin}${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export async function apiFetch(input: RequestInfo, init: ApiFetchOptions = {}) {
  // Resolve relative paths (e.g. "/api/audits/share-link") against the configured
  // API_URL so requests reach the backend in production where the frontend and API
  // are on different origins.
  if (typeof input === 'string' && input.startsWith('/') && API_URL) {
    const base = API_URL.replace(/\/+$/, '');
    input = `${base}${input}`;
  }

  const state = useAuthStore.getState();
  const token = state.token;
  const setToken = state.setToken;
  const refreshUser = state.refreshUser;

  const headers = new Headers(init.headers || {});
  const authHeader = buildBearerHeader(token);
  if (authHeader) {
    headers.set('Authorization', authHeader);
  } else if (token && typeof setToken === 'function') {
    setToken(null);
  }

  // Inject workspace header so server-side workspaceRequired resolves correctly
  const wsHeaders = getWorkspaceHeader();
  for (const [k, v] of Object.entries(wsHeaders)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const credentials = init.credentials ?? 'include';
  // Merge caller's signal with our timeout
  if (init.signal) {
    init.signal.addEventListener('abort', () => controller.abort(init.signal!.reason));
  }
  const timer = setTimeout(() => controller.abort('Request timeout'), timeoutMs);

  try {
    let requestInput = input;
    let response: Response;
    try {
      response = await fetch(requestInput, { ...init, headers, credentials, signal: controller.signal });
    } catch (error) {
      const fallback = resolveSameOriginFallback(input);
      if (!fallback) throw error;
      console.warn('[apiFetch] Primary API host unreachable, retrying same-origin', { from: String(input), to: fallback });
      requestInput = fallback;
      response = await fetch(requestInput, { ...init, headers, credentials, signal: controller.signal });
      // If the fallback returns HTML (e.g. the React SPA index.html), the API is unreachable.
      // Throw immediately so callers get a clear network error instead of a JSON parse failure.
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        const err = new Error('Could not reach the API server. Check your connection and try again.') as any;
        err.status = 503;
        err.code = 'API_UNREACHABLE';
        throw err;
      }
    }

    // If the token expired, try refreshing once and retry
    if (response.status === 401 && (authHeader || state.isAuthenticated)) {
      if (typeof refreshUser === 'function') {
        const ok = await refreshUser();
        if (ok) {
          const newToken = useAuthStore.getState().token;
          const nextAuthHeader = buildBearerHeader(newToken);
          if (nextAuthHeader) {
            headers.set('Authorization', nextAuthHeader);
          }
          response = await fetch(requestInput, { ...init, headers, credentials, signal: controller.signal });
        }
      }
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}

export default apiFetch;
