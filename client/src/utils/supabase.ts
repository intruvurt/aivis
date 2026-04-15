import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const _url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Support both naming conventions: standard ANON_KEY and legacy PUBLISHABLE_KEY
const _key = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
) as string | undefined;

/** True only when both required env vars are present. */
export const isSupabaseConfigured = Boolean(_url && _key);

let _client: SupabaseClient | null = null;

/**
 * Returns the singleton Supabase client.
 * Throws if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — fail fast
 * rather than silently passing `undefined` into createClient.
 */
export function getSupabaseClient(): SupabaseClient {
    if (!_url || !_key) {
        throw new Error(
            '[supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set before calling getSupabaseClient()',
        );
    }
    if (!_client) {
        _client = createClient(_url, _key);
    }
    return _client;
}

/**
 * Legacy default export kept for backwards compatibility.
 * Will be `null` when env vars are not configured — always check
 * `isSupabaseConfigured` before using this directly.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(_url!, _key!)
    : null;
