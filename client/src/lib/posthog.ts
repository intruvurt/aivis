import posthog from 'posthog-js';

const POSTHOG_KEY =
    (import.meta.env.VITE_POSTHOG_PUBLIC_KEY as string | undefined) || '';

const POSTHOG_HOST =
    (import.meta.env.VITE_POSTHOG_API_HOST as string | undefined) ||
    'https://us.i.posthog.com';

let initialized = false;

function shouldDisablePostHog(): boolean {
    if (typeof window === 'undefined') return true;

    const explicitlyDisabled =
        (import.meta.env.VITE_POSTHOG_ENABLED as string | undefined) === 'false'
        || (import.meta.env.VITE_BROWSER_RUN_MODE as string | undefined) === 'true';
    if (explicitlyDisabled) return true;

    const path = window.location.pathname || '';
    const isAppOrAuthRoute =
        path === '/auth'
        || path.startsWith('/auth/')
        || path === '/app'
        || path.startsWith('/app/');
    if (isAppOrAuthRoute) return true;

    const ua = String(window.navigator?.userAgent || '');
    const isSyntheticRun =
        !!(window.navigator as Navigator & { webdriver?: boolean })?.webdriver
        || /HeadlessChrome|Lighthouse|GTmetrix|Pingdom|UptimeRobot|crawler|spider|bot/i.test(ua);

    return isSyntheticRun;
}

export function initPostHog(): void {
    if (initialized || !POSTHOG_KEY || typeof window === 'undefined' || shouldDisablePostHog()) return;

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        defaults: '2026-01-30',
        person_profiles: 'identified_only',
        capture_pageview: true,
        persistence: 'localStorage',
    });

    // Keep compatibility with existing analytics helpers that read window.posthog.
    (window as any).posthog = posthog;
    initialized = true;
}

export { posthog };
