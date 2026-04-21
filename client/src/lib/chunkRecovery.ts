const RECOVERY_FLAG = 'aivis:chunk-reload';
const RECOVERY_QUERY = '__aivisChunkReload';

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'Loading chunk',
  'Failed to load module script',
  'ChunkLoadError',
];

export function isRecoverableChunkError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function recoverFromChunkError(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const currentUrl = new URL(window.location.href);
  const alreadyRetried = sessionStorage.getItem(RECOVERY_FLAG) === '1';
  const alreadyMarked = currentUrl.searchParams.get(RECOVERY_QUERY) === '1';

  if (alreadyRetried || alreadyMarked) {
    return false;
  }

  sessionStorage.setItem(RECOVERY_FLAG, '1');
  currentUrl.searchParams.set(RECOVERY_QUERY, '1');
  currentUrl.searchParams.set('_v', Date.now().toString());
  window.location.replace(currentUrl.toString());
  return true;
}

export function markChunkBootSuccess(): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(RECOVERY_FLAG);

  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has(RECOVERY_QUERY) && !currentUrl.searchParams.has('_v')) {
    return;
  }

  currentUrl.searchParams.delete(RECOVERY_QUERY);
  currentUrl.searchParams.delete('_v');
  window.history.replaceState({}, document.title, currentUrl.toString());
}
