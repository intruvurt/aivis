/**
 * HOMEPAGE VALIDATION ENGINE — drift detection
 *
 * Validates internal consistency of the homepage contract and cross-checks
 * that schema output and meta output agree with the contract.
 *
 * Returns an array of error strings. Empty array = valid.
 * Used by:
 *   1. Vite buildStart plugin (hard build stop)
 *   2. HomepageGuard dev-time component
 */

import {
    BRAND,
    CITE_LEDGER_DEFINITION,
    BRAG,
    PLATFORM_TARGETS,
    SCORING_CATEGORIES,
    META,
    OG,
    TWITTER,
    HERO,
    getTierSnapshot,
} from './homepage.contract';
import { generateHomepageMeta } from './homepage.meta';

export interface ValidationError {
    code: string;
    message: string;
}

export function validateHomepageContract(): ValidationError[] {
    const errors: ValidationError[] = [];

    /* ── 1. Scoring weights must sum to exactly 100 ───────────────────────── */
    const weightSum = SCORING_CATEGORIES.reduce((s, c) => s + c.weight, 0);
    if (weightSum !== 100) {
        errors.push({
            code: 'WEIGHT_SUM',
            message: `Scoring category weights sum to ${weightSum}, expected 100`,
        });
    }

    /* ── 2. CITE LEDGER definition must appear in meta description ────────── */
    if (!META.description.includes(CITE_LEDGER_DEFINITION)) {
        errors.push({
            code: 'META_CITE_LEDGER',
            message: 'Meta description does not contain the canonical CITE LEDGER definition',
        });
    }

    /* ── 3. BRAG expansion must appear in meta description ────────────────── */
    if (!META.description.includes(BRAG.expansion)) {
        errors.push({
            code: 'META_BRAG',
            message: `Meta description does not contain BRAG expansion (${BRAG.expansion})`,
        });
    }

    /* ── 4. Platform targets must appear in OG description ────────────────── */
    for (const target of PLATFORM_TARGETS) {
        if (!OG.description.includes(target)) {
            errors.push({
                code: 'OG_PLATFORM_TARGET',
                message: `OG description missing platform target: ${target}`,
            });
        }
    }

    /* ── 5. OG title must match meta title ────────────────────────────────── */
    if (OG.title !== META.title) {
        errors.push({
            code: 'OG_TITLE_DRIFT',
            message: `OG title "${OG.title}" does not match meta title "${META.title}"`,
        });
    }

    /* ── 6. Twitter description must match OG description ─────────────────── */
    if (TWITTER.description !== OG.description) {
        errors.push({
            code: 'TWITTER_OG_DESC_DRIFT',
            message: 'Twitter description does not match OG description',
        });
    }

    /* ── 7. Brand name must appear in CITE LEDGER definition ──────────────── */
    if (!CITE_LEDGER_DEFINITION.includes('AiVIS')) {
        errors.push({
            code: 'CITE_LEDGER_BRAND',
            message: 'CITE LEDGER definition does not mention AiVIS',
        });
    }

    /* ── 8. Hero headline must contain brand + product ────────────────────── */
    const heroContainsBrand = HERO.headline.some((line) =>
        String(line).toLowerCase().includes(BRAND.name.toLowerCase()),
    );
    if (!heroContainsBrand) {
        errors.push({
            code: 'HERO_BRAND',
            message: `Hero headline missing brand name: ${BRAND.name}`,
        });
    }
    const heroContainsProduct = HERO.headline.some((line) =>
        String(line).toLowerCase().includes(BRAND.product.toLowerCase()),
    );
    if (!heroContainsProduct) {
        errors.push({
            code: 'HERO_PRODUCT',
            message: `Hero headline missing product name: ${BRAND.product}`,
        });
    }

    /* ── 9. Pricing must resolve without errors ───────────────────────────── */
    try {
        const tiers = getTierSnapshot();
        if (tiers.observer.price !== 0) {
            errors.push({
                code: 'OBSERVER_NOT_FREE',
                message: `Observer tier price is ${tiers.observer.price}, expected 0`,
            });
        }
        if (tiers.scorefix.price <= 0) {
            errors.push({
                code: 'SCOREFIX_PRICE',
                message: `Score Fix price is ${tiers.scorefix.price}, expected > 0`,
            });
        }
    } catch (e) {
        errors.push({
            code: 'PRICING_RESOLVE',
            message: `Failed to resolve tier pricing: ${e instanceof Error ? e.message : String(e)}`,
        });
    }

    /* ── 10. Meta generator must produce contract-consistent output ────────── */
    const meta = generateHomepageMeta();
    if (meta.title !== META.title) {
        errors.push({
            code: 'META_GEN_TITLE',
            message: `Meta generator title drift: "${meta.title}" vs contract "${META.title}"`,
        });
    }
    if (meta.og.title !== OG.title) {
        errors.push({
            code: 'META_GEN_OG_TITLE',
            message: `Meta generator OG title drift`,
        });
    }
    if (meta.twitter.title !== TWITTER.title) {
        errors.push({
            code: 'META_GEN_TWITTER_TITLE',
            message: `Meta generator Twitter title drift`,
        });
    }

    /* ── 11. OG image dimensions must be valid ────────────────────────────── */
    if (OG.image.width < 200 || OG.image.height < 200) {
        errors.push({
            code: 'OG_IMAGE_SIZE',
            message: `OG image dimensions ${OG.image.width}x${OG.image.height} too small (min 200x200)`,
        });
    }

    /* ── 12. Canonical URL must use HTTPS ─────────────────────────────────── */
    if (!META.canonical.startsWith('https://')) {
        errors.push({
            code: 'CANONICAL_HTTPS',
            message: `Canonical URL must use HTTPS: ${META.canonical}`,
        });
    }

    return errors;
}
