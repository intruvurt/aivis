import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';

export interface LiveFindings {
    total_audits: number;
    avg_score: number;
    pct_no_schema: number;
    pct_no_faq_schema: number;
    pct_missing_h1: number;
    pct_thin_content: number;
    pct_no_org_schema: number;
    pct_ai_crawler_blocked: number;
    sampled_at: string;
}

interface CacheEntry {
    data: LiveFindings;
    fetchedAt: number;
}

// Module-level cache so multiple mounts share one fetch within a page session
let moduleCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useLiveFindings() {
    const [findings, setFindings] = useState<LiveFindings | null>(
        moduleCache && Date.now() - moduleCache.fetchedAt < CACHE_TTL_MS
            ? moduleCache.data
            : null,
    );
    const [loading, setLoading] = useState(!findings);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // If already populated from module cache, nothing to do.
        if (findings) return;

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);

        const base = (API_URL || '').replace(/\/+$/, '');
        fetch(`${base}/api/public/insights`, { signal: ctrl.signal })
            .then((r) => r.json())
            .then((json) => {
                if (json?.success && json?.insights) {
                    moduleCache = { data: json.insights, fetchedAt: Date.now() };
                    setFindings(json.insights);
                } else {
                    setError('no data');
                }
            })
            .catch((e) => {
                if (e.name !== 'AbortError') setError(String(e));
            })
            .finally(() => {
                setLoading(false);
            });

        return () => ctrl.abort();
    }, [findings]);

    return { findings, loading, error };
}
