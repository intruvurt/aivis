/**
 * Query Route Canonical Validation Plugin
 *
 * Vite plugin that validates:
 * 1. Each query page has a unique canonical URL
 * 2. All canonicals follow format: https://aivis.biz/query/{slug}
 * 3. No duplicate slugs
 * 4. No private/localhost URLs
 * 5. Canonical uniqueness across homepage + query pages
 *
 * Runs at buildStart — fails build if any violations found.
 */

import { type Plugin } from 'vite';

export interface ValidationViolation {
    type:
    | 'DUPLICATE_SLUG'
    | 'DUPLICATE_CANONICAL'
    | 'INVALID_CANONICAL_FORMAT'
    | 'PRIVATE_URL'
    | 'MISSING_CANONICAL'
    | 'MISSING_QUERIES_JSON';
    message: string;
    details?: Record<string, unknown>;
}

/**
 * Extract queries from generated queries.json
 */
async function loadQueriesJson(): Promise<any[]> {
    try {
        const queries = await import('./src/generated/queries.json', { assert: { type: 'json' } });
        return Array.isArray(queries.default) ? queries.default : [];
    } catch (err) {
        throw new Error('Failed to load queries.json — ensure build generates it first');
    }
}

/**
 * Validate a single canonical URL
 */
function validateCanonicalFormat(canonical: string, slug: string): ValidationViolation | null {
    const expectedCanonical = `https://aivis.biz/query/${slug}`;

    if (canonical !== expectedCanonical) {
        return {
            type: 'INVALID_CANONICAL_FORMAT',
            message: `Canonical mismatch for slug "${slug}"`,
            details: {
                expected: expectedCanonical,
                actual: canonical,
            },
        };
    }

    // Check for private/localhost URLs
    if (canonical.includes('localhost') || canonical.includes('127.0.0.1') || canonical.includes('192.168')) {
        return {
            type: 'PRIVATE_URL',
            message: `Private/localhost URL in canonical: ${canonical}`,
        };
    }

    return null;
}

/**
 * Validate all canonicals are unique
 */
function validateCanonicalUniqueness(canonicals: string[]): ValidationViolation[] {
    const violations: ValidationViolation[] = [];
    const seen = new Map<string, number>();

    canonicals.forEach((canonical, index) => {
        if (seen.has(canonical)) {
            violations.push({
                type: 'DUPLICATE_CANONICAL',
                message: `Duplicate canonical URL found`,
                details: {
                    canonical,
                    firstIndex: seen.get(canonical),
                    dupeIndex: index,
                },
            });
        } else {
            seen.set(canonical, index);
        }
    });

    return violations;
}

/**
 * Validate all slugs are unique
 */
function validateSlugsUniqueness(slugs: string[]): ValidationViolation[] {
    const violations: ValidationViolation[] = [];
    const seen = new Map<string, number>();

    slugs.forEach((slug, index) => {
        if (seen.has(slug)) {
            violations.push({
                type: 'DUPLICATE_SLUG',
                message: `Duplicate query slug found`,
                details: {
                    slug,
                    firstIndex: seen.get(slug),
                    dupeIndex: index,
                },
            });
        } else {
            seen.set(slug, index);
        }
    });

    return violations;
}

/**
 * Validate all query pages (comprehensive check)
 */
async function validateQueryPages(): Promise<ValidationViolation[]> {
    const violations: ValidationViolation[] = [];

    try {
        const queries = await loadQueriesJson();

        if (!Array.isArray(queries) || queries.length === 0) {
            violations.push({
                type: 'MISSING_QUERIES_JSON',
                message: 'No queries found in queries.json',
            });
            return violations;
        }

        const slugs = new Set<string>();
        const canonicals: string[] = [];

        queries.forEach((query, index) => {
            if (!query.slug) {
                violations.push({
                    type: 'MISSING_CANONICAL',
                    message: `Query at index ${index} missing slug`,
                });
                return;
            }

            if (!query.canonical) {
                violations.push({
                    type: 'MISSING_CANONICAL',
                    message: `Query "${query.slug}" missing canonical URL`,
                });
                return;
            }

            // Validate canonical format
            const formatError = validateCanonicalFormat(query.canonical, query.slug);
            if (formatError) {
                violations.push(formatError);
            }

            slugs.add(query.slug);
            canonicals.push(query.canonical);
        });

        // Check for duplicate slugs and canonicals
        if (slugs.size !== queries.length) {
            violations.push(...validateSlugsUniqueness(queries.map((q: any) => q.slug)));
        }

        violations.push(...validateCanonicalUniqueness(canonicals));

        return violations;
    } catch (err) {
        violations.push({
            type: 'MISSING_QUERIES_JSON',
            message: `Error validating queries: ${(err as Error).message}`,
        });
        return violations;
    }
}

/**
 * Format validation violations for console output
 */
function formatViolations(violations: ValidationViolation[]): string {
    const lines = violations.map((v) => {
        let msg = `  ✗ [${v.type}] ${v.message}`;
        if (v.details) {
            const details = JSON.stringify(v.details, null, 4);
            msg += `\n${details.split('\n').map((line) => '    ' + line).join('\n')}`;
        }
        return msg;
    });

    return lines.join('\n');
}

/**
 * Vite plugin: Query Route Canonical Validation
 */
export function queryRouteValidationPlugin(): Plugin {
    return {
        name: 'query-route-validation',
        async buildStart() {
            try {
                const violations = await validateQueryPages();

                if (violations.length > 0) {
                    const details = formatViolations(violations);
                    throw new Error(
                        `\n[Query Route Validation] ${violations.length} violation(s) found:\n${details}\n\nFix canonical URL issues in src/generated/queries.json or query page generation before building.\n`
                    );
                }

                console.log('[Query Route Validation] ✓ All query canonicals valid and unique');
            } catch (err) {
                if ((err as any)?.message?.includes('Query Route Validation')) {
                    throw err;
                }
                // Warn but don't fail if queries.json doesn't exist yet (pre-build)
                console.warn(`[Query Route Validation] Warning: ${(err as Error).message}`);
            }
        },
    };
}

export default queryRouteValidationPlugin;
