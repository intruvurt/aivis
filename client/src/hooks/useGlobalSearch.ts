import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { filterEntries, type BlogEntry } from '../content/blogs';

/* ─── result types ─────────────────────────────────────────────────── */

export type SearchResultKind = 'page' | 'blog' | 'audit';

export interface SearchResult {
    kind: SearchResultKind;
    label: string;
    description?: string;
    path: string;
    /** for audits: the visibility score */
    score?: number;
}

/* ─── static app pages ─────────────────────────────────────────────── */

const APP_PAGES: { label: string; path: string; keywords: string[] }[] = [
    { label: 'Dashboard', path: '/app', keywords: ['home', 'overview', 'dashboard'] },
    { label: 'Run Audit', path: '/app/analyze', keywords: ['audit', 'scan', 'analyze', 'visibility'] },
    { label: 'Reports', path: '/app/reports', keywords: ['report', 'history', 'audits'] },
    { label: 'Score Fix', path: '/app/score-fix', keywords: ['fix', 'pr', 'autofix', 'remediation'] },
    { label: 'Analytics', path: '/app/analytics', keywords: ['analytics', 'trends', 'chart'] },
    { label: 'Citations', path: '/app/citations', keywords: ['citation', 'test', 'verify'] },
    { label: 'Competitors', path: '/app/competitors', keywords: ['competitor', 'comparison', 'rival'] },
    { label: 'Benchmarks', path: '/app/benchmarks', keywords: ['benchmark', 'industry', 'score'] },
    { label: 'Keywords', path: '/app/keywords', keywords: ['keyword', 'intelligence', 'terms'] },
    { label: 'Prompt Intelligence', path: '/app/prompt-intelligence', keywords: ['prompt', 'query', 'gap'] },
    { label: 'Answer Presence', path: '/app/answer-presence', keywords: ['answer', 'presence', 'engine'] },
    { label: 'Reverse Engineer', path: '/app/reverse-engineer', keywords: ['reverse', 'decompile', 'ghost', 'diff'] },
    { label: 'Brand Integrity', path: '/app/brand-integrity', keywords: ['brand', 'integrity', 'mention'] },
    { label: 'Niche Discovery', path: '/app/niche-discovery', keywords: ['niche', 'discovery', 'opportunity'] },
    { label: 'Site Crawl', path: '/app/site-crawl', keywords: ['crawl', 'multi', 'page'] },
    { label: 'Pipeline', path: '/app/pipeline', keywords: ['pipeline', 'stage', 'evidence'] },
    { label: 'Domain Rating', path: '/app/domain-rating', keywords: ['domain', 'rating', 'authority'] },
    { label: 'MCP Console', path: '/app/mcp', keywords: ['mcp', 'console', 'protocol'] },
    { label: 'Dataset Studio', path: '/app/dataset', keywords: ['dataset', 'studio', 'export'] },
    { label: 'API Docs', path: '/app/api-docs', keywords: ['api', 'docs', 'openapi'] },
    { label: 'Integrations', path: '/app/integrations', keywords: ['integration', 'webhook', 'zapier'] },
    { label: 'Badge', path: '/app/badge', keywords: ['badge', 'embed', 'widget'] },
    { label: 'Billing', path: '/app/billing', keywords: ['billing', 'subscription', 'payment'] },
    { label: 'Settings', path: '/app/settings', keywords: ['settings', 'preferences', 'profile'] },
    { label: 'Team', path: '/app/team', keywords: ['team', 'workspace', 'member'] },
    { label: 'Agency', path: '/app/agency', keywords: ['agency', 'client', 'multi'] },
    /* ── Taxonomy: About ── */
    { label: 'About AiVIS', path: '/about-aivis', keywords: ['about', 'identity', 'entity', 'aivis', 'definition'] },
    { label: 'What Is AiVIS', path: '/what-is-aivis', keywords: ['what', 'aivis', 'definition', 'system'] },
    { label: 'Why AiVIS Exists', path: '/why-aivis-exists', keywords: ['why', 'problem', 'hallucination', 'entity merging'] },
    /* ── Taxonomy: Methodology ── */
    { label: 'Cite Ledger', path: '/methodology/cite-ledger', keywords: ['cite', 'ledger', 'evidence', 'chain', 'traceability', 'attribution'] },
    { label: 'What Is CITE LEDGER', path: '/what-is-cite-ledger', keywords: ['cite', 'ledger', 'attribution', 'definition', 'what is'] },
    { label: 'Triple-Check Protocol', path: '/methodology/triple-check-protocol', keywords: ['triple', 'check', 'protocol', 'verification', 'multi-model'] },
    { label: 'BRAG Evidence Trails', path: '/methodology/brag-evidence-trails', keywords: ['brag', 'evidence', 'trail', 'finding', 'id'] },
    { label: 'Entity Resolution', path: '/methodology/entity-resolution-model', keywords: ['entity', 'resolution', 'identity', 'merge', 'canonical'] },
    /* ── Taxonomy: Evidence ── */
    { label: 'Ledger Index', path: '/evidence/ledger-index', keywords: ['ledger', 'index', 'entry', 'pipeline', 'stage'] },
    { label: 'Citation Reports', path: '/evidence/citation-reports', keywords: ['citation', 'report', 'cited', 'missing', 'merged'] },
    { label: 'Drift Analysis', path: '/evidence/drift-analysis', keywords: ['drift', 'attribution', 'decay', 'stability'] },
    { label: 'Query Results Log', path: '/evidence/query-results-log', keywords: ['query', 'results', 'log', 'serp', 'raw'] },
];

/* ─── hook ─────────────────────────────────────────────────────────── */

interface AuditSummary {
    id: string;
    url: string;
    name?: string;
    score?: number;
}

interface UseGlobalSearchOpts {
    /** Recent audits loaded by the consuming component or parent */
    audits?: AuditSummary[];
}

const MAX_RESULTS_PER_SECTION = 5;
const DEBOUNCE_MS = 150;

export default function useGlobalSearch(opts: UseGlobalSearchOpts = {}) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        timerRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
        return () => clearTimeout(timerRef.current);
    }, [query]);

    const results = useMemo<SearchResult[]>(() => {
        const q = debouncedQuery.trim().toLowerCase();
        if (q.length < 2) return [];

        const out: SearchResult[] = [];

        // 1. App pages
        for (const p of APP_PAGES) {
            if (
                p.label.toLowerCase().includes(q) ||
                p.keywords.some((k) => k.includes(q))
            ) {
                out.push({ kind: 'page', label: p.label, path: p.path });
            }
            if (out.filter((r) => r.kind === 'page').length >= MAX_RESULTS_PER_SECTION) break;
        }

        // 2. Blog posts
        const blogMatches: BlogEntry[] = filterEntries({ searchQuery: q });
        for (const b of blogMatches.slice(0, MAX_RESULTS_PER_SECTION)) {
            out.push({
                kind: 'blog',
                label: b.title,
                description: b.description,
                path: b.path,
            });
        }

        // 3. Audits (client-side filter on preloaded list)
        if (opts.audits) {
            let auditCount = 0;
            for (const a of opts.audits) {
                const haystack = `${a.url} ${a.name ?? ''}`.toLowerCase();
                if (haystack.includes(q)) {
                    out.push({
                        kind: 'audit',
                        label: a.name ?? a.url,
                        description: a.url,
                        path: `/app/audits/${a.id}`,
                        score: a.score,
                    });
                    auditCount++;
                    if (auditCount >= MAX_RESULTS_PER_SECTION) break;
                }
            }
        }

        return out;
    }, [debouncedQuery, opts.audits]);

    const clear = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
    }, []);

    return { query, setQuery, results, clear, isOpen: debouncedQuery.trim().length >= 2 };
}
