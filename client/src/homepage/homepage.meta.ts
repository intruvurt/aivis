/**
 * HOMEPAGE META GENERATOR — locked to homepage.contract.ts
 *
 * Produces meta/OG/Twitter tag values from the contract.
 * Used by Landing.tsx via usePageMeta and by the build-time validator
 * to check index.html alignment.
 */

import { META, OG, TWITTER } from './homepage.contract';

export interface HomepageMetaTags {
    title: string;
    description: string;
    keywords: string;
    author: string;
    canonical: string;
    og: {
        type: string;
        siteName: string;
        title: string;
        description: string;
        url: string;
        locale: string;
        imageUrl: string;
        imageType: string;
        imageWidth: number;
        imageHeight: number;
        imageAlt: string;
    };
    twitter: {
        card: string;
        site: string;
        creator: string;
        title: string;
        description: string;
        image: string;
        imageAlt: string;
    };
}

export function generateHomepageMeta(): HomepageMetaTags {
    return {
        title: META.title,
        description: META.description,
        keywords: META.keywords,
        author: META.author,
        canonical: META.canonical,
        og: {
            type: OG.type,
            siteName: OG.siteName,
            title: OG.title,
            description: OG.description,
            url: OG.url,
            locale: OG.locale,
            imageUrl: OG.image.url,
            imageType: OG.image.type,
            imageWidth: OG.image.width,
            imageHeight: OG.image.height,
            imageAlt: OG.image.alt,
        },
        twitter: {
            card: TWITTER.card,
            site: TWITTER.site,
            creator: TWITTER.creator,
            title: TWITTER.title,
            description: TWITTER.description,
            image: TWITTER.image,
            imageAlt: TWITTER.imageAlt,
        },
    };
}
