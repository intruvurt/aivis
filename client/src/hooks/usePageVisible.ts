import { useEffect, useSyncExternalStore } from 'react';

/** Lightweight shared visibility tracker — avoids duplicate listeners across hooks. */
let visible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return visible;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible';
    listeners.forEach((cb) => cb());
  });
}

/** Returns `true` when the current tab/document is visible. */
export default function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
