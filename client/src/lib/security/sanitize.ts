import DOMPurify from 'dompurify';

const RICH_HTML_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'style'],
  ALLOW_DATA_ATTR: false,
};

const MARKDOWN_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { html: true },
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li',
    'a', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img', 'span',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Sanitize rich HTML content for safe rendering.
 * Strips scripts, iframes, inline event handlers, and dangerous attributes.
 */
export function sanitizeRichHtml(input: string): string {
  return DOMPurify.sanitize(input, { ...RICH_HTML_CONFIG, RETURN_TRUSTED_TYPE: false } as any) as unknown as string;
}

/**
 * Sanitize markdown-rendered HTML for safe rendering.
 * Allows structural tags used in rendered markdown output.
 */
export function sanitizeMarkdown(input: string): string {
  return DOMPurify.sanitize(input, { ...MARKDOWN_CONFIG, RETURN_TRUSTED_TYPE: false } as any) as unknown as string;
}

/**
 * Check whether a URL uses a safe protocol (http, https, mailto).
 * Returns false for javascript:, data:, vbscript:, and other risky schemes.
 */
export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return SAFE_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}
