/**
 * usePageMetadata Hook
 *
 * Sets page title, meta tags, canonical URL, and cite-ledger block.
 * Runs on mount and updates document HEAD.
 *
 * Note: Uses direct DOM manipulation instead of external library (react-helmet)
 * for fine-grained control over cite-ledger injection order and script placement.
 */

import { useEffect } from 'react';
import type { FullPageMetadata } from './metadataBuilder';
import type { CiteLedgerMeta } from './citeLedgerMeta';

export interface UsePageMetadataOptions {
    metadata: FullPageMetadata;
    citeLedger?: CiteLedgerMeta;
}

/**
 * Inject metadata and cite-ledger into the document HEAD
 */
export function usePageMetadata({ metadata, citeLedger }: UsePageMetadataOptions) {
    useEffect(() => {
        // Update document title
        document.title = metadata.title;

        // Remove and replace meta tags (to ensure fresh state)
        const removeExistingMeta = (name: string, property?: string) => {
            if (property) {
                document.querySelectorAll(`meta[property="${property}"]`).forEach((el) => el.remove());
            } else {
                document.querySelectorAll(`meta[name="${name}"]`).forEach((el) => el.remove());
            }
        };

        // Set description
        removeExistingMeta('description');
        const descMeta = document.createElement('meta');
        descMeta.name = 'description';
        descMeta.content = metadata.description;
        document.head.appendChild(descMeta);

        // Set canonical
        let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.rel = 'canonical';
            document.head.appendChild(canonicalLink);
        }
        canonicalLink.href = metadata.canonical;

        // Set Open Graph tags
        const ogTags = [
            { property: 'og:title', content: metadata.og_title || metadata.title },
            { property: 'og:description', content: metadata.og_description || metadata.description },
            { property: 'og:url', content: metadata.og_url || metadata.canonical },
            { property: 'og:type', content: metadata.og_type || 'website' },
        ];

        if (metadata.og_image) {
            ogTags.push({ property: 'og:image', content: metadata.og_image });
        }

        ogTags.forEach(({ property, content }) => {
            removeExistingMeta(property, property);
            const meta = document.createElement('meta');
            meta.setAttribute('property', property);
            meta.content = content;
            document.head.appendChild(meta);
        });

        // Set Twitter Card tags
        const twitterTags = [
            { name: 'twitter:card', content: metadata.twitter_card || 'summary_large_image' },
            { name: 'twitter:title', content: metadata.twitter_title || metadata.title },
            { name: 'twitter:description', content: metadata.twitter_description || metadata.description },
        ];

        if (metadata.twitter_image) {
            twitterTags.push({ name: 'twitter:image', content: metadata.twitter_image });
        }

        twitterTags.forEach(({ name, content }) => {
            removeExistingMeta(name);
            const meta = document.createElement('meta');
            meta.name = name;
            meta.content = content;
            document.head.appendChild(meta);
        });

        // Inject cite-ledger script block (if provided)
        if (citeLedger) {
            // Remove existing cite-ledger block
            const existingCiteLedger = document.getElementById('cite-ledger');
            if (existingCiteLedger) {
                existingCiteLedger.remove();
            }

            // Create and inject new cite-ledger block
            const citeLedgerScript = document.createElement('script');
            citeLedgerScript.id = 'cite-ledger';
            citeLedgerScript.type = 'application/json';
            citeLedgerScript.textContent = JSON.stringify(citeLedger, null, 2);
            document.head.appendChild(citeLedgerScript);
        }

        // Cleanup on unmount (optional — can keep meta tags for SEO bots)
        return () => {
            // Note: Not removing meta tags on unmount keeps them for crawlers
            // Comment this out to preserve SEO between page transitions
        };
    }, [metadata, citeLedger]);
}

/**
 * Convenience hook for homepage
 */
export function useHomepageMetadata(citeLedger?: CiteLedgerMeta) {
    const { buildHomepageMetadata } = require('./metadataBuilder');
    usePageMetadata({
        metadata: buildHomepageMetadata(),
        citeLedger,
    });
}

/**
 * Convenience hook for query pages
 */
export function useQueryPageMetadata(
    slug: string,
    title: string,
    description: string,
    image?: string,
    citeLedger?: CiteLedgerMeta
) {
    const { buildQueryPageMetadata } = require('./metadataBuilder');
    usePageMetadata({
        metadata: buildQueryPageMetadata({ slug, title, description, image }),
        citeLedger,
    });
}
