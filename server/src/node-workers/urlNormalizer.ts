export function normalizeUrl(input: string): string {
    const value = (input || '').trim();
    if (!value) throw new Error('URL is required');

    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withScheme);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
    }

    parsed.hash = '';
    // Canonicalize trailing slash for stable doc identity.
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';

    return parsed.toString();
}
