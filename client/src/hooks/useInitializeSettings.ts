// client/src/hooks/useInitializeSettings.ts
// Applies persisted visual settings (theme, font, animations, compact mode)
// on first render. Mount once in App or main.tsx via <SettingsInitializer />.

import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/** Resolve system preference */
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Apply all visual settings to DOM */
function applySettingsToDOM(state: ReturnType<typeof useSettingsStore.getState>) {
  const root = document.documentElement;

  // --- Theme ---
  const effective = state.theme === 'system' ? getSystemTheme() : state.theme;
  root.classList.remove('light', 'dark');
  root.classList.add(effective);

  // --- Font size ---
  root.classList.remove('text-sm', 'text-base', 'text-lg');
  const sizeClass =
    state.fontSize === 'small' ? 'text-sm' :
    state.fontSize === 'large' ? 'text-lg' :
    'text-base';
  root.classList.add(sizeClass);

  // --- Animations ---
  root.classList.toggle('no-animations', !state.showAnimations);
  root.classList.toggle('reduce-motion', !state.showAnimations);

  // --- Compact mode ---
  root.classList.toggle('compact', state.compactMode);
}

/**
 * Hook: call once in a top-level component to initialise settings on app boot.
 * Also listens for system dark-mode changes when theme === 'system'.
 */
export function useInitializeSettings() {
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const showAnimations = useSettingsStore((s) => s.showAnimations);
  const compactMode = useSettingsStore((s) => s.compactMode);

  // Apply on mount + whenever any visual preference changes
  useEffect(() => {
    applySettingsToDOM(useSettingsStore.getState());
  }, [theme, fontSize, showAnimations, compactMode]);

  // System dark-mode media query listener
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (useSettingsStore.getState().theme === 'system') {
        const effective = mql.matches ? 'dark' : 'light';
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(effective);
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Migrate old localStorage key on first mount
  useEffect(() => {
    const old = localStorage.getItem('user-settings');
    if (old) {
      try {
        const parsed = JSON.parse(old);
        const store = useSettingsStore.getState();
        // Merge old settings into new store
        if (parsed.theme) store.setTheme(parsed.theme);
        if (parsed.fontSize) store.setFontSize(parsed.fontSize);
        if (parsed.compactMode !== undefined) store.setCompactMode(parsed.compactMode);
        if (parsed.showAnimations !== undefined) store.setShowAnimations(parsed.showAnimations);
        if (parsed.defaultAnalysisDepth) store.setDefaultAnalysisDepth(parsed.defaultAnalysisDepth);
        if (parsed.autoSaveResults !== undefined) store.setAutoSaveResults(parsed.autoSaveResults);
        if (parsed.showAdvancedMetrics !== undefined) store.setShowAdvancedMetrics(parsed.showAdvancedMetrics);
        if (parsed.emailNotifications !== undefined) store.setEmailNotifications(parsed.emailNotifications);
        if (parsed.browserNotifications !== undefined) store.setBrowserNotifications(parsed.browserNotifications);
        if (parsed.notificationFrequency) store.setNotificationFrequency(parsed.notificationFrequency);
        if (parsed.defaultView) store.setDefaultView(parsed.defaultView);
        if (parsed.itemsPerPage) store.setItemsPerPage(parsed.itemsPerPage);
        if (parsed.showQuickStats !== undefined) store.setShowQuickStats(parsed.showQuickStats);
        if (parsed.shareAnalytics !== undefined) store.setShareAnalytics(parsed.shareAnalytics);
        if (parsed.saveHistory !== undefined) store.setSaveHistory(parsed.saveHistory);
        if (parsed.historyRetentionDays) store.setHistoryRetentionDays(parsed.historyRetentionDays);
        if (parsed.profile) store.updateProfile(parsed.profile);
        // Remove old key
        localStorage.removeItem('user-settings');
      } catch { /* ignore corrupt data */ }
    }
  }, []);
}

/**
 * Eagerly apply settings before React even mounts (prevents flash).
 * Call this synchronously in main.tsx BEFORE createRoot.
 */
export function applySettingsEagerly() {
  try {
    // Try the new persist key first
    let raw = localStorage.getItem('user-settings-v1');
    let parsed: any = null;

    if (raw) {
      const outer = JSON.parse(raw);
      parsed = outer?.state ?? outer;
    } else {
      // Fall back to old key
      raw = localStorage.getItem('user-settings');
      if (raw) parsed = JSON.parse(raw);
    }

    if (parsed) {
      const root = document.documentElement;

      // Theme
      const theme = parsed.theme || 'dark';
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      }

      // Font size
      root.classList.remove('text-sm', 'text-base', 'text-lg');
      const size = parsed.fontSize || 'medium';
      if (size === 'small') root.classList.add('text-sm');
      else if (size === 'large') root.classList.add('text-lg');
      else root.classList.add('text-base');

      // Animations
      if (parsed.showAnimations === false) {
        root.classList.add('no-animations', 'reduce-motion');
      }

      // Compact
      if (parsed.compactMode) {
        root.classList.add('compact');
      }
    } else {
      // No settings at all → default to dark
      document.documentElement.classList.add('dark');
    }
  } catch {
    // Fallback: default to dark
    document.documentElement.classList.add('dark');
  }
}
