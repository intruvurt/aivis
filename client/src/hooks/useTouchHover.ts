import { useCallback, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Converts a hover-reveal element into one that toggles on
 * tap (touchstart) for touch devices. Uses pointer events
 * so it works for both mouse and touch — no separate codepaths.
 *
 * Usage:
 *   const { ref, isRevealed, pointerHandlers } = useTouchHover<HTMLDivElement>();
 *   <div ref={ref} {...pointerHandlers} className={isRevealed ? 'opacity-100' : 'opacity-0'}>
 */
export function useTouchHover<T extends HTMLElement = HTMLElement>(): {
  ref: RefObject<T | null>;
  isRevealed: boolean;
  pointerHandlers: {
    onPointerEnter: (e: ReactPointerEvent) => void;
    onPointerLeave: (e: ReactPointerEvent) => void;
    onPointerDown: (e: ReactPointerEvent) => void;
  };
} {
  const ref = useRef<T | null>(null);
  const revealed = useRef(false);
  const [, setTick] = useState(0);

  const toggle = useCallback(() => {
    revealed.current = !revealed.current;
    setTick((t) => t + 1);
  }, []);

  return {
    ref,
    isRevealed: revealed.current,
    pointerHandlers: {
      onPointerEnter: (e: ReactPointerEvent) => {
        if (e.pointerType === 'mouse') {
          revealed.current = true;
          setTick((t) => t + 1);
        }
      },
      onPointerLeave: (e: ReactPointerEvent) => {
        if (e.pointerType === 'mouse') {
          revealed.current = false;
          setTick((t) => t + 1);
        }
      },
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.pointerType === 'touch') toggle();
      },
    },
  };
}
