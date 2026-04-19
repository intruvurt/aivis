// Server-side analytics - fire-and-forget event tracking
// Supports PostHog if POSTHOG_API_KEY env var is set

let posthog: any = null;
let initialized = false;
let enabled = false;

export function initAnalytics() {
  if (initialized) return;
  initialized = true;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    console.log('[Analytics] POSTHOG_API_KEY not set - analytics disabled');
    enabled = false;
    return;
  }

  try {
    // Dynamic import of posthog-node
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PostHog = require('posthog-node');
    posthog = new PostHog.PostHog(apiKey, {
      host: 'https://us.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
    enabled = true;
    console.log('[Analytics] PostHog initialized');
  } catch (err: unknown) {
    console.warn(
      `[Analytics] Failed to initialize PostHog: ${err instanceof Error ? err.message : String(err)}`,
    );
    enabled = false;
  }
}

export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown> & { userId?: string },
) {
  if (!enabled || !posthog) {
    return; // Silent no-op in production if PostHog unavailable
  }

  try {
    const distinctId = eventData?.userId || 'anonymous';
    const properties = { ...eventData };
    delete properties.userId;

    posthog.capture({
      distinctId,
      event: eventName,
      properties,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.warn(
      `[Analytics] Failed to track event: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// Ensure events are flushed on shutdown
export async function flushAnalytics(): Promise<void> {
  if (!enabled || !posthog) return;
  try {
    await posthog.shutdown();
  } catch (err: unknown) {
    console.warn(`[Analytics] Failed to flush: ${err instanceof Error ? err.message : String(err)}`);
  }
}