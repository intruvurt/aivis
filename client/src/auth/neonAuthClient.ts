// client/src/lib/auth.ts
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { TIER_LIMITS, meetsMinimumTier as _meetsMinimumTier } from "@shared/types";
import type { CanonicalTier } from "@shared/types";


// Storage keys
// SECURITY: Session tokens in localStorage are accessible to any JS on the page.
// Migrate to HttpOnly cookie for production hardening. CSP mitigates XSS risk.
const STORAGE_KEYS = {
  USER_PROFILE: 'aivis_user_profile',
  SESSION_TOKEN: 'aivis_session_token',
  LAST_SYNC: 'aivis_last_sync',
} as const;

// Cache duration in milliseconds
const PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL;

/**
 * Check if auth is configured
 */
export const isAuthConfigured = !!NEON_AUTH_URL;

/**
 * Singleton auth client instance - null if not configured
 */
export const authClient = NEON_AUTH_URL
  ? createAuthClient(NEON_AUTH_URL)
  : null;

/**
 * In-memory cache for user profile to avoid excessive localStorage reads
 */
let cachedProfile: UserProfile | null = null;
let cacheTimestamp: number | null = null;

/**
 * Validates that an object matches the UserProfile structure
 */
function isValidUserProfile(obj: unknown): obj is UserProfile {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const profile = obj as Record<string, unknown>;

  return (
    typeof profile.id === 'string' &&
    typeof profile.email === 'string' &&
    typeof profile.tier === 'string' &&
    profile.email.length > 0 &&
    profile.id.length > 0
  );
}

/**
 * Safely retrieves user profile from in-memory cache or sessionStorage
 * Falls back to localStorage for persistence across tabs
 */
function createUserProfile(): UserProfile | null {
  // Check in-memory cache first
  if (cachedProfile && cacheTimestamp) {
    const now = Date.now();
    if (now - cacheTimestamp < PROFILE_CACHE_DURATION) {
      return cachedProfile;
    }
  }

  try {
    // Try sessionStorage first (faster, cleared on tab close)
    let storedProfile = sessionStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    
    // Fallback to localStorage for persistence
    if (!storedProfile) {
      storedProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      
      // Sync to sessionStorage for faster access
      if (storedProfile) {
        sessionStorage.setItem(STORAGE_KEYS.USER_PROFILE, storedProfile);
      }
    }

    if (!storedProfile) {
      cachedProfile = null;
      cacheTimestamp = null;
      return null;
    }

    const parsed = JSON.parse(storedProfile);

    // Validate structure
    if (!isValidUserProfile(parsed)) {
      console.warn('[Auth] Invalid user profile structure in storage, clearing');
      clearUserProfile();
      return null;
    }

    // Update cache
    cachedProfile = parsed;
    cacheTimestamp = Date.now();

    return parsed;
  } catch (error) {
    console.error('[Auth] Failed to retrieve user profile:', error);
    // Clear corrupted data
    clearUserProfile();
    return null;
  }
}

/**
 * Initial user profile - loaded once on module initialization
 */
export const userProfile = createUserProfile();

/**
 * Gets current user profile (refreshes from storage if cache expired)
 */
export function getUserProfile(): UserProfile | null {
  return createUserProfile();
}

/**
 * Saves user profile to both storage mechanisms and updates cache
 */
export function saveUserProfile(profile: UserProfile): void {
  if (!profile || typeof profile !== 'object') {
    throw new Error('[Auth] Invalid profile: profile must be an object');
  }

  if (!isValidUserProfile(profile)) {
    throw new Error('[Auth] Invalid profile structure: missing required fields');
  }

  try {
    const serialized = JSON.stringify(profile);

    // Save to both storage mechanisms
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, serialized);
    sessionStorage.setItem(STORAGE_KEYS.USER_PROFILE, serialized);

    // Update in-memory cache
    cachedProfile = profile;
    cacheTimestamp = Date.now();

    // Track last sync time
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

    // Dispatch custom event for other tabs/components
    window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
      detail: profile 
    }));

    console.log('[Auth] User profile saved successfully');
  } catch (error) {
    console.error('[Auth] Failed to save user profile:', error);
    
    // Check if quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please clear browser data and try again.');
    }
    
    throw new Error('Failed to save user profile');
  }
}

/**
 * Clears user profile from all storage locations and cache
 */
export function clearUserProfile(): void {
  try {
    // Clear from storage
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    sessionStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);

    // Clear cache
    cachedProfile = null;
    cacheTimestamp = null;

    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('userProfileCleared'));

    console.log('[Auth] User profile cleared');
  } catch (error) {
    console.error('[Auth] Failed to clear user profile:', error);
  }
}

/**
 * Updates specific fields in the user profile without replacing entire object
 */
export function updateUserProfile(updates: Partial<UserProfile>): void {
  const currentProfile = getUserProfile();

  if (!currentProfile) {
    throw new Error('[Auth] No user profile exists to update');
  }

  const updatedProfile: UserProfile = {
    ...currentProfile,
    ...updates,
  };

  saveUserProfile(updatedProfile);
}

/**
 * Checks if user is authenticated (has valid profile)
 */
export function isAuthenticated(): boolean {
  const profile = getUserProfile();
  return profile !== null && typeof profile.id === 'string' && profile.id.length > 0;
}

/**
 * Gets session token from storage
 */
export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) || 
           localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
  } catch (error) {
    console.error('[Auth] Failed to get session token:', error);
    return null;
  }
}

/**
 * Saves session token to storage
 */
export function saveSessionToken(token: string): void {
  if (!token || typeof token !== 'string') {
    throw new Error('[Auth] Invalid token: must be a non-empty string');
  }

  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
    console.log('[Auth] Session token saved');
  } catch (error) {
    console.error('[Auth] Failed to save session token:', error);
    throw new Error('Failed to save session token');
  }
}

/**
 * Clears session token from storage
 */
export function clearSessionToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    // Also clear any legacy localStorage token
    localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    console.log('[Auth] Session token cleared');
  } catch (error) {
    console.error('[Auth] Failed to clear session token:', error);
  }
}

/**
 * Complete logout - clears all auth data
 */
export function logout(): void {
  clearUserProfile();
  clearSessionToken();
  
  console.log('[Auth] User logged out');
  
  // Optional: Call auth client logout if available
  if (authClient && typeof authClient.logout === 'function') {
    authClient.logout().catch((error: Error) => {
      console.error('[Auth] Auth client logout failed:', error);
    });
  }
}

/**
 * Sync profile across tabs using storage events
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEYS.USER_PROFILE) {
      // Another tab updated the profile
      if (event.newValue) {
        try {
          const profile = JSON.parse(event.newValue);
          if (isValidUserProfile(profile)) {
            cachedProfile = profile;
            cacheTimestamp = Date.now();
            sessionStorage.setItem(STORAGE_KEYS.USER_PROFILE, event.newValue);
            console.log('[Auth] Profile synced from another tab');
          }
        } catch (error) {
          console.error('[Auth] Failed to sync profile from storage event:', error);
        }
      } else {
        // Profile was cleared in another tab
        cachedProfile = null;
        cacheTimestamp = null;
        sessionStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
        console.log('[Auth] Profile cleared in another tab');
      }
    }

    if (event.key === STORAGE_KEYS.SESSION_TOKEN && !event.newValue) {
      // Session token was cleared in another tab - sync logout
      clearSessionToken();
      clearUserProfile();
    }
  });
}

/**
 * Type guard for checking if profile has specific tier.
 * Delegates to shared meetsMinimumTier to stay aligned with canonical hierarchy.
 */
export function hasMinimumTier(
  profile: UserProfile | null, 
  requiredTier: CanonicalTier
): boolean {
  if (!profile) return false;
  return _meetsMinimumTier(profile.tier as CanonicalTier, requiredTier);
}

/**
 * Gets time since last profile sync
 */
export function getTimeSinceLastSync(): number | null {
  try {
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    if (!lastSync) return null;

    const timestamp = parseInt(lastSync, 10);
    if (isNaN(timestamp)) return null;

    return Date.now() - timestamp;
  } catch (error) {
    console.error('[Auth] Failed to get last sync time:', error);
    return null;
  }
}

/**
 * Checks if profile cache is stale and needs refresh
 */
export function isProfileStale(): boolean {
  const timeSinceSync = getTimeSinceLastSync();
  if (timeSinceSync === null) return true;

  return timeSinceSync > PROFILE_CACHE_DURATION;
}

/**
 * Forces a profile refresh from server
 */
export async function refreshProfile(): Promise<UserProfile | null> {
  const token = getSessionToken();
  if (!token) {
    console.warn('[Auth] Cannot refresh profile: no session token');
    return null;
  }

  try {
    const { API_URL: apiUrl } = await import('../config');
    const response = await fetch(`${apiUrl}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired - logout
        logout();
        return null;
      }
      throw new Error(`Failed to refresh profile: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      const profile = data.data as UserProfile;
      saveUserProfile(profile);
      return profile;
    }

    return null;
  } catch (error) {
    console.error('[Auth] Failed to refresh profile:', error);
    return null;
  }
}

/**
 * Development helper to inspect current auth state
 */
export function debugAuthState(): void {
  if (import.meta.env.PROD) {
    console.warn('[Auth] debugAuthState is only available in development');
    return;
  }

  console.group(' Auth State Debug');
  console.log('Auth configured:', isAuthConfigured);
  console.log('Profile (cache):', cachedProfile);
  console.log('Cache timestamp:', cacheTimestamp ? new Date(cacheTimestamp).toISOString() : null);
  console.log('Is authenticated:', isAuthenticated());
  console.log('Has session token:', !!getSessionToken());
  console.log('Time since sync:', getTimeSinceLastSync(), 'ms');
  console.log('Profile stale:', isProfileStale());
  console.log('localStorage keys:', Object.keys(localStorage).filter(k => k.startsWith('aivis_')));
  console.log('sessionStorage keys:', Object.keys(sessionStorage).filter(k => k.startsWith('aivis_')));
  
  const profile = getUserProfile();
  if (profile) {
    console.log('Current tier:', profile.tier);
    console.log('Has minimum tier (alignment):', hasMinimumTier(profile, 'alignment'));
    console.log('Has minimum tier (signal):', hasMinimumTier(profile, 'signal'));
  }
  
  console.groupEnd();
}

// Expose debug function to window in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuthState;
  console.log('[Auth] Debug function available: window.debugAuth()');
}