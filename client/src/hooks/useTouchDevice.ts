import { useEffect, useState } from 'react';

/**
 * Detects whether the current device has a coarse (touch) pointer.
 * Uses `pointer: coarse` media query - the most reliable method.
 * Returns `false` during SSR / prerender.
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    setIsTouch(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isTouch;
}
