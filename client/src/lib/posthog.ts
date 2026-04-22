import posthog from 'posthog-js';

const POSTHOG_KEY =
    (import.meta.env.VITE_POSTHOG_PUBLIC_KEY as string | undefined) || '';

const POSTHOG_HOST =
    (import.meta.env.VITE_POSTHOG_API_HOST as string | undefined) ||
    'https://us.i.posthog.com';

let initialized = false;

export function initPostHog(): void {
    if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return;

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
