import { useRef, useEffect, type RefObject } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Lightweight horizontal swipe detection using pointer events.
 * Attaches to a container ref — triggers onSwipeLeft/onSwipeRight
 * when the user swipes > threshold px horizontally.
 *
 * Does NOT block vertical scrolling (passive listeners).
 * Does NOT introduce any npm dependency.
 */
export function useSwipeGesture<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  handlers: SwipeHandlers,
  threshold = 50,
): void {
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      startX.current = e.clientX;
      startY.current = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      // Only trigger if horizontal movement dominates vertical
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) handlers.onSwipeLeft?.();
        else handlers.onSwipeRight?.();
      }
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
    };
  }, [ref, handlers, threshold]);
}
