import { useEffect, useRef } from "react";

/**
 * Attaches an IntersectionObserver to all `.reveal` children inside `ref`.
 * Adds `.revealed` when an element scrolls into view (once).
 * Zero-dependency, GPU-only (opacity + transform).
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Respect reduced motion preference
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            el.querySelectorAll(".reveal").forEach((n) => n.classList.add("revealed"));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("revealed");
                        observer.unobserve(entry.target);
                    }
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
        );

        const targets = el.querySelectorAll(".reveal");
        targets.forEach((t) => observer.observe(t));

        return () => observer.disconnect();
    }, []);

    return ref;
}
