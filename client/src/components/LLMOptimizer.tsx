// client/src/components/LLMOptimizer.tsx
/**
 * LLM Optimizer: Handles schema markup injection, metadata optimization,
 * and entity clarity for AI platform discoverability
 */

import { useEffect } from 'react';
import { generatePageSchemas, removeSchemaMarkup } from '../utils/schemaMarkup';

interface LLMOptimizerProps {
  /**
   * Page title for H1 and meta tags
   */
  title: string;

  /**
   * Concise page description (40-160 chars)
   */
  description: string;

  /**
   * Page URL for schema markup
   */
  url?: string;

  /**
   * Page type: 'Article' | 'WebPage' | 'About' | 'Guide'
   */
  pageType?: 'Article' | 'WebPage' | 'About' | 'Guide';

  /**
   * Breadcrumb navigation path
   */
  breadcrumbs?: Array<{
    name: string;
    url: string;
  }>;

  /**
   * Organization info for schema markup
   */
  organization?: {
    name: string;
    url: string;
    logo?: string;
    description?: string;
    founder?: {
      name: string;
      jobTitle: string;
      url?: string;
    };
    foundingDate?: string;
  };

  /**
   * Keywords for entity clarity
   */
  keywords?: string[];

  /**
   * Section topics for topical depth
   */
  topics?: string[];

  /**
   * Enable Open Graph metadata
   */
  enableOG?: boolean;
  ogImage?: string;
  ogType?: string;
}

export default function LLMOptimizer(props: LLMOptimizerProps) {
  useEffect(() => {
    if (!globalThis.document) return;

    // Update title tag
    document.title = `${props.title} | Intruvurt Labs - AiVIS`;

    // Update or create meta description
    let metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = props.description;

    // Add keywords meta tag
    if (props.keywords && props.keywords.length > 0) {
      let metaKeywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.name = 'keywords';
        document.head.appendChild(metaKeywords);
      }
      metaKeywords.content = props.keywords.join(', ');
    }

    // Add Open Graph metadata for social/AI sharing
    if (props.enableOG !== false) {
      const ogTags = [
        { property: 'og:title', content: props.title },
        { property: 'og:description', content: props.description },
        { property: 'og:type', content: props.ogType || 'website' },
        ...(props.url ? [{ property: 'og:url', content: props.url }] : []),
        ...(props.ogImage ? [{ property: 'og:image', content: props.ogImage }] : []),
      ];

      ogTags.forEach(({ property, content }) => {
        let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.content = content;
      });
    }

    // Add Twitter Card metadata
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: props.title },
      { name: 'twitter:description', content: props.description },
      ...(props.ogImage ? [{ name: 'twitter:image', content: props.ogImage }] : []),
    ];

    twitterTags.forEach(({ name, content }) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = name;
        document.head.appendChild(tag);
      }
      tag.content = content;
    });

    // Inject schema markup
    if (props.organization) {
      const schemas = generatePageSchemas({
        organization: props.organization,
        page: props.url
          ? {
              headline: props.title,
              url: props.url,
              description: props.description,
              type: props.pageType || 'WebPage',
            }
          : undefined,
        breadcrumbs: props.breadcrumbs,
      });

      schemas.forEach((schema, index) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = `schema-markup-${index}`;
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
      });

      return () => {
        // Cleanup on unmount
        schemas.forEach((_, index) => {
          removeSchemaMarkup(`schema-markup-${index}`);
        });
      };
    }
  }, [props]);

  // This component doesn't render anything visible
  return null;
}
