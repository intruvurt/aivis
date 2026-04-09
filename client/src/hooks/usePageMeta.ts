// client/src/hooks/usePageMeta.ts
// Lightweight per-page SEO hook - sets document.title, meta description,
// canonical URL, Open Graph tags, and optional JSON-LD structured data.
// No external dependency required (replaces react-helmet for our needs).

import { useEffect } from 'react';

interface PageMeta {
  /** Page title - will be suffixed with " | AI Visibility Intelligence Platform" */
  title: string;
  /** Meta description for search engines and AI crawlers */
  description: string;
  /** Canonical path (e.g. "/pricing") - will be prefixed with https://aivis.biz */
  path?: string;
  /** Optional JSON-LD structured data object(s) */
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  /** Override OG title (defaults to title) */
  ogTitle?: string;
  /** Override OG description (defaults to description) */
  ogDescription?: string;
  /** Override OG type (defaults to website) */
  ogType?: string;
  /** Full document.title override - bypasses the "SITE_NAME | title" format. Use for homepage where title length (30-60 chars) matters for scoring. */
  fullTitle?: string;
  /** Set true to add noindex,nofollow robots meta tag */
  noIndex?: boolean;
}

const SITE_NAME = 'AiVIS - AI Visibility Intelligence Platform';
const BASE_URL = 'https://aivis.biz';
const DEFAULT_SHARE_IMAGE = `${BASE_URL}/og-image2.png`;

function setMeta(name: string, content: string, property = false): void {
  const attr = property ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string): void {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

const STRUCTURED_DATA_ID = 'page-structured-data';

function readSchemaTypes(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const rawType = (value as Record<string, unknown>)['@type'];
  if (Array.isArray(rawType)) {
    return rawType.map((item) => String(item).toLowerCase()).filter(Boolean);
  }
  if (rawType) {
    return [String(rawType).toLowerCase()];
  }
  return [];
}

function readSchemaIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const id = (value as Record<string, unknown>)['@id'];
  if (!id) return [];
  return [String(id)];
}

function readScriptSchemaTypes(script: HTMLScriptElement): string[] {
  try {
    const parsed = JSON.parse(script.textContent || 'null');
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item) => readSchemaTypes(item));
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed['@graph'])) {
      return parsed['@graph'].flatMap((item: unknown) => readSchemaTypes(item));
    }
    return readSchemaTypes(parsed);
  } catch {
    return [];
  }
}

function readScriptSchemaIds(script: HTMLScriptElement): string[] {
  try {
    const parsed = JSON.parse(script.textContent || 'null');
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item) => readSchemaIds(item));
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed['@graph'])) {
      return parsed['@graph'].flatMap((item: unknown) => readSchemaIds(item));
    }
    return readSchemaIds(parsed);
  } catch {
    return [];
  }
}

function isValidStructuredDataItem(item: Record<string, unknown>): boolean {
  const rawType = item['@type'];
  const schemaTypes = Array.isArray(rawType)
    ? rawType.map((value) => String(value).toLowerCase())
    : [String(rawType || '').toLowerCase()];

  const requiresItemListElement =
    schemaTypes.includes('itemlist') || schemaTypes.includes('breadcrumblist');

  if (requiresItemListElement) {
    const itemListElement = item.itemListElement;
    if (!Array.isArray(itemListElement) || itemListElement.length === 0) {
      return false;
    }
  }

  return true;
}

function setStructuredData(data: Record<string, unknown> | Record<string, unknown>[] | undefined): void {
  // Remove previous page-level structured data
  document.querySelectorAll(`script[data-page-schema]`).forEach((el) => el.remove());

  if (!data) return;

  const rawItems = Array.isArray(data) ? data : [data];
  const items = rawItems.filter(isValidStructuredDataItem);
  if (items.length === 0) return;

  const incomingTypes = new Set(items.flatMap((item) => readSchemaTypes(item)));
  const incomingIds = new Set(items.flatMap((item) => readSchemaIds(item)));

  if (incomingTypes.size > 0 || incomingIds.size > 0) {
    document
      .querySelectorAll('script[type="application/ld+json"]:not([data-page-schema])')
      .forEach((scriptEl) => {
        const script = scriptEl as HTMLScriptElement;
        const existingTypes = readScriptSchemaTypes(script);
        const existingIds = readScriptSchemaIds(script);
        const hasTypeCollision = existingTypes.some((type) => incomingTypes.has(type));
        const hasIdCollision = existingIds.some((id) => incomingIds.has(id));
        if (hasTypeCollision || hasIdCollision) {
          script.remove();
        }
      });
  }

  items.forEach((item) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-page-schema', 'true');
    script.textContent = JSON.stringify(item).replace(/</g, '\\u003c');
    document.head.appendChild(script);
  });
}

/**
 * Sets per-page SEO metadata. Call at the top of every public page component.
 *
 * @example
 * usePageMeta({
 *   title: 'AI Visibility Audit Pricing Plans',
 *   description: 'Compare AiVIS pricing tiers...',
 *   path: '/pricing',
 * });
 */
export function usePageMeta({ title, description, path, structuredData, ogTitle, ogDescription, ogType, fullTitle, noIndex }: PageMeta): void {
  useEffect(() => {
    // Document title - use fullTitle if provided (for homepage with strict 30-60 char requirement)
    document.title = fullTitle || `${SITE_NAME} | ${title}`;

    // Meta description
    setMeta('description', description);

    // Robots (noindex support)
    if (noIndex) {
      setMeta('robots', 'noindex,nofollow');
    } else {
      setMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    }

    // Canonical URL
    const canonicalUrl = !path || path === '/' ? BASE_URL : `${BASE_URL}${path}`;
    setCanonical(canonicalUrl);

    // Open Graph
    setMeta('og:type', ogType || 'website', true);
    setMeta('og:site_name', 'AiVIS', true);
    setMeta('og:title', ogTitle || title, true);
    setMeta('og:description', ogDescription || description, true);
    setMeta('og:url', canonicalUrl, true);
    setMeta('og:locale', 'en_US', true);
    setMeta('og:image', DEFAULT_SHARE_IMAGE, true);
    setMeta('og:image:secure_url', DEFAULT_SHARE_IMAGE, true);
    setMeta('og:image:type', 'image/png', true);
    setMeta('og:image:width', '1200', true);
    setMeta('og:image:height', '630', true);
    setMeta('og:image:alt', 'AiVIS – AI Visibility Intelligence Platform', true);

    // Twitter
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:site', '@dobleduche');
    setMeta('twitter:creator', '@dobleduche');
    setMeta('twitter:title', ogTitle || title);
    setMeta('twitter:description', ogDescription || description);
    setMeta('twitter:image', DEFAULT_SHARE_IMAGE);
    setMeta('twitter:image:alt', 'AiVIS – AI Visibility Intelligence Platform');

    // Per-page structured data
    setStructuredData(structuredData);

    // Cleanup on unmount - restore defaults
    return () => {
      document.title = `${SITE_NAME}: AI visibility intelligence platform | See How AI Sees Your Website`;
      setMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
      setStructuredData(undefined);
    };
  }, [title, description, path, ogTitle, ogDescription, ogType, structuredData, fullTitle, noIndex]);
}
