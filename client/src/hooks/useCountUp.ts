import { useEffect, useState } from "react";

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Uses requestAnimationFrame for smooth rendering.
 */
export function useCountUp(target: number, duration = 800): number {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (target <= 0) { setValue(0); return; }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setValue(target);
            return;
        }

        let start: number | null = null;
        let raf: number;

        const step = (ts: number) => {
            if (start === null) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);

    return value;
}
