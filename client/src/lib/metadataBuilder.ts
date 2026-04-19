/**
 * Unified Metadata Builder
 *
 * Single source of truth for all page metadata (title, description, canonical, OG, Twitter, JSON-LD).
 * Prevents duplication and ensures deterministic generation across all pages.
 *
 * Architecture:
 * - Base metadata for all pages
 * - Route-specific overrides
 * - Social media (OG/Twitter) helpers
 * - Canonical URL validation
 */

export const BASE_URL = 'https://aivis.biz';

export interface MetadataBase {
    title: string;
    description: string;
    image?: string;
    canonical: string;
}

export interface SocialMetadata {
    og_title?: string;
    og_description?: string;
    og_image?: string;
    og_url?: string;
    og_type?: 'website' | 'article';

    twitter_card?: 'summary' | 'summary_large_image';
    twitter_title?: string;
    twitter_description?: string;
    twitter_image?: string;
}

export interface FullPageMetadata extends MetadataBase, SocialMetadata {
    type: 'homepage' | 'query' | 'article' | 'page';
    route: string;
}

/**
 * Validate canonical URL format
 */
export function validateCanonical(canonical: string): boolean {
    try {
        const url = new URL(canonical);
        return (
            canonical.startsWith('https://aivis.biz/') &&
            !canonical.includes('?') &&
            !canonical.includes('#')
        );
    } catch {
        return false;
    }
}

/**
 * Builder for homepage metadata (single source of truth)
 */
export function buildHomepageMetadata(): FullPageMetadata {
    const base: MetadataBase = {
        title: 'AiVIS.biz | CITE LEDGER — BRAG Evidence-Linked Scores',
        description: 'Verify how ChatGPT, Perplexity, Google AI Overviews, and Claude interpret and cite your website. Evidence-linked audits powered by BRAG.',
        image: `${BASE_URL}/og-image.png`,
        canonical: BASE_URL + '/',
    };

    if (!validateCanonical(base.canonical)) {
        throw new Error(`Invalid canonical URL: ${base.canonical}`);
    }

    return {
        ...base,
        type: 'homepage',
        route: '/',
        og_title: base.title,
        og_description: base.description,
        og_image: base.image,
        og_type: 'website',
        og_url: base.canonical,
        twitter_card: 'summary_large_image',
        twitter_title: base.title,
        twitter_description: base.description,
        twitter_image: base.image,
    };
}

/**
 * Builder for query page metadata
 */
export function buildQueryPageMetadata(input: {
    slug: string;
    title: string;
    description: string;
    image?: string;
}): FullPageMetadata {
    const canonical = `${BASE_URL}/query/${input.slug}`;

    if (!validateCanonical(canonical)) {
        throw new Error(`Invalid query page canonical URL: ${canonical}`);
    }

    return {
        title: input.title,
        description: input.description,
        image: input.image || `${BASE_URL}/og-image.png`,
        canonical,
        type: 'query',
        route: `/query/${input.slug}`,

        og_title: input.title,
        og_description: input.description,
        og_image: input.image,
        og_url: canonical,
        og_type: 'website',

        twitter_card: 'summary_large_image',
        twitter_title: input.title,
        twitter_description: input.description,
        twitter_image: input.image,
    };
}

/**
 * Builder for article/blog page metadata
 */
export function buildArticlePageMetadata(input: {
    slug: string;
    title: string;
    description: string;
    image?: string;
    datePublished: string;
    dateModified?: string;
}): FullPageMetadata {
    const canonical = `${BASE_URL}/blog/${input.slug}`;

    if (!validateCanonical(canonical)) {
        throw new Error(`Invalid article page canonical URL: ${canonical}`);
    }

    return {
        title: input.title,
        description: input.description,
        image: input.image || `${BASE_URL}/og-image.png`,
        canonical,
        type: 'article',
        route: `/blog/${input.slug}`,

        og_title: input.title,
        og_description: input.description,
        og_image: input.image,
        og_url: canonical,
        og_type: 'article',

        twitter_card: 'summary_large_image',
        twitter_title: input.title,
        twitter_description: input.description,
        twitter_image: input.image,
    };
}

/**
 * Generate HTML meta tags from metadata object
 */
export function generateMetaTagsHtml(meta: FullPageMetadata): string {
    const tags: string[] = [
        `<meta charset="utf-8">`,
        `<meta name="viewport" content="width=device-width, initial-scale=1">`,
        `<title>${escapeHtml(meta.title)}</title>`,
        `<meta name="description" content="${escapeHtml(meta.description)}">`,
        `<link rel="canonical" href="${escapeHtml(meta.canonical)}">`,

        // Open Graph
        `<meta property="og:title" content="${escapeHtml(meta.og_title || meta.title)}">`,
        `<meta property="og:description" content="${escapeHtml(meta.og_description || meta.description)}">`,
        `<meta property="og:image" content="${escapeHtml(meta.og_image || meta.image || '')}">`,
        `<meta property="og:url" content="${escapeHtml(meta.og_url || meta.canonical)}">`,
        `<meta property="og:type" content="${meta.og_type || 'website'}">`,

        // Twitter Card
        `<meta name="twitter:card" content="${meta.twitter_card || 'summary_large_image'}">`,
        `<meta name="twitter:title" content="${escapeHtml(meta.twitter_title || meta.title)}">`,
        `<meta name="twitter:description" content="${escapeHtml(meta.twitter_description || meta.description)}">`,
        `<meta name="twitter:image" content="${escapeHtml(meta.twitter_image || meta.image || '')}">`,

        // Additional metadata
        `<meta name="theme-color" content="#000000">`,
        `<meta name="robots" content="index, follow">`,
    ];

    return tags.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Verify all canonicals in a metadata array are unique
 */
export function verifyCanonicalUniqueness(metadatas: FullPageMetadata[]): boolean {
    const canonicals = metadatas.map((m) => m.canonical);
    const uniqueCanonicals = new Set(canonicals);

    if (canonicals.length !== uniqueCanonicals.size) {
        const duplicates = canonicals.filter((c, i) => canonicals.indexOf(c) !== i);
        console.error(
            `[Metadata Dedup] Duplicate canonicals detected: ${Array.from(new Set(duplicates)).join(', ')}`
        );
        return false;
    }

    return true;
}
