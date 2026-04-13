/**
 * fixDiffService.ts - Unified diff generation for fix previews.
 *
 * Produces contextual line diffs (3 lines of context around changes)
 * without external packages. Uses an LCS-based algorithm suitable for
 * the small structured files we deal with (JSON-LD, robots.txt, HTML
 * snippets, llms.txt - all <200 lines).
 */

export interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    lineNo?: number;     // 1-based line number in the "before" file
    newLineNo?: number;  // 1-based line number in the "after" file
}

export interface FileDiff {
    before_lines: number;
    after_lines: number;
    lines: DiffLine[];
    has_changes: boolean;
    additions: number;
    removals: number;
}

// ─── LCS table (O(nm) time, O(nm) space) ─────────────────────────────────────

function buildLcsTable(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp;
}

interface RawOp {
    type: 'eq' | 'ins' | 'del';
    before?: string;
    bIdx?: number;   // 0-based index
    after?: string;
    aIdx?: number;   // 0-based index
}

function buildOps(a: string[], b: string[], dp: number[][]): RawOp[] {
    const ops: RawOp[] = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            ops.unshift({ type: 'eq', before: a[i - 1], bIdx: i - 1, after: b[j - 1], aIdx: j - 1 });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.unshift({ type: 'ins', after: b[j - 1], aIdx: j - 1 });
            j--;
        } else {
            ops.unshift({ type: 'del', before: a[i - 1], bIdx: i - 1 });
            i--;
        }
    }

    return ops;
}

// ─── Context trimming ─────────────────────────────────────────────────────────

const CONTEXT = 3; // unified diff context lines

/**
 * Trim context lines when they are far from any change.
 * Only context lines within CONTEXT lines of an add/remove are kept.
 */
function trimContext(ops: RawOp[]): RawOp[] {
    const changeAt: Set<number> = new Set();
    ops.forEach((op, idx) => {
        if (op.type !== 'eq') changeAt.add(idx);
    });

    if (changeAt.size === 0) return [];

    const keep: Set<number> = new Set();
    changeAt.forEach(idx => {
        for (let k = Math.max(0, idx - CONTEXT); k <= Math.min(ops.length - 1, idx + CONTEXT); k++) {
            keep.add(k);
        }
    });

    // Add "..." sentinel gaps
    const result: RawOp[] = [];
    let prevKept = -1;
    for (let i = 0; i < ops.length; i++) {
        if (!keep.has(i)) continue;
        if (prevKept !== -1 && i > prevKept + 1) {
            // gap marker - represented as a special context line
            result.push({ type: 'eq', before: '...', after: '...' });
        }
        result.push(ops[i]);
        prevKept = i;
    }
    return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a contextual line diff between two text strings.
 * Returns a FileDiff with before/after stats and per-line type markers.
 */
export function generateLineDiff(before: string, after: string): FileDiff {
    const beforeLines = before ? before.split('\n') : [];
    const afterLines = after ? after.split('\n') : [];

    if (!before && !after) {
        return { before_lines: 0, after_lines: 0, lines: [], has_changes: false, additions: 0, removals: 0 };
    }

    // Pure create: all additions
    if (!before) {
        const lines: DiffLine[] = afterLines.map((content, i) => ({
            type: 'add' as const,
            content,
            newLineNo: i + 1,
        }));
        return { before_lines: 0, after_lines: afterLines.length, lines, has_changes: true, additions: afterLines.length, removals: 0 };
    }

    // Pure delete (shouldn't happen in our flow but handle it)
    if (!after) {
        const lines: DiffLine[] = beforeLines.map((content, i) => ({
            type: 'remove' as const,
            content,
            lineNo: i + 1,
        }));
        return { before_lines: beforeLines.length, after_lines: 0, lines, has_changes: true, additions: 0, removals: beforeLines.length };
    }

    const dp = buildLcsTable(beforeLines, afterLines);
    const rawOps = buildOps(beforeLines, afterLines, dp);
    const trimmed = trimContext(rawOps);

    const lines: DiffLine[] = [];
    let additions = 0;
    let removals = 0;

    for (const op of trimmed) {
        if (op.type === 'eq') {
            lines.push({
                type: op.before === '...' ? 'context' : 'context',
                content: op.before ?? '',
                lineNo: op.bIdx !== undefined ? op.bIdx + 1 : undefined,
                newLineNo: op.aIdx !== undefined ? op.aIdx + 1 : undefined,
            });
        } else if (op.type === 'ins') {
            lines.push({ type: 'add', content: op.after ?? '', newLineNo: op.aIdx !== undefined ? op.aIdx + 1 : undefined });
            additions++;
        } else {
            lines.push({ type: 'remove', content: op.before ?? '', lineNo: op.bIdx !== undefined ? op.bIdx + 1 : undefined });
            removals++;
        }
    }

    return {
        before_lines: beforeLines.length,
        after_lines: afterLines.length,
        lines,
        has_changes: additions + removals > 0,
        additions,
        removals,
    };
}

/**
 * Generate a "create" diff — all lines are additions.
 * Used when we know the file doesn't exist yet (robots.txt, llms.txt, schema files).
 */
export function generateCreateDiff(content: string): FileDiff {
    return generateLineDiff('', content);
}

/**
 * Format a FileDiff as a unified diff string for storage / display.
 * @example
 * --- a/index.html
 * +++ b/index.html
 * @@ -1,5 +1,8 @@
 *  <html>
 * +<script ...>
 */
export function formatUnifiedDiff(diff: FileDiff, filePath: string): string {
    if (!diff.has_changes) return '';

    const hunk: string[] = [
        `--- a/${filePath}`,
        `+++ b/${filePath}`,
        `@@ -1,${diff.before_lines} +1,${diff.after_lines} @@`,
    ];

    for (const line of diff.lines) {
        const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
        hunk.push(`${prefix}${line.content}`);
    }

    return hunk.join('\n');
}
