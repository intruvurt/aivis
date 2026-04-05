// client/src/stores/settingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AnalysisDepth = 'quick' | 'standard' | 'comprehensive';
export type NotificationFrequency = 'all' | 'important' | 'none';
export type NotificationCategory = 'scan_results' | 'billing' | 'account' | 'platform';
export type DefaultView = 'grid' | 'list';
export type FontSize = 'small' | 'medium' | 'large';

interface UserProfile {
  displayName: string;
  avatarUrl: string | null;
  orgLogoUrl: string | null;
  orgFaviconUrl: string | null;
  bio: string;
  company: string;
  website: string;
  timezone: string;
  language: string;
}

interface UserPreferences {
  // Display Settings
  theme: ThemeMode;
  compactMode: boolean;
  showAnimations: boolean;
  fontSize: FontSize;
  
  // Analysis Settings
  defaultAnalysisDepth: AnalysisDepth;
  autoSaveResults: boolean;
  showAdvancedMetrics: boolean;
  
  // Notification Settings
  emailNotifications: boolean;
  browserNotifications: boolean;
  notificationFrequency: NotificationFrequency;
  inAppEnabled: boolean;
  soundEnabled: boolean;
  mutedCategories: NotificationCategory[];
  
  // Dashboard Settings
  defaultView: DefaultView;
  itemsPerPage: number;
  showQuickStats: boolean;
  
  // Privacy Settings
  shareAnalytics: boolean;
  saveHistory: boolean;
  historyRetentionDays: number;
  /** 0 = never expire, otherwise days until link expires. Default 30. */
  shareLinkExpirationDays: number;
}

interface SettingsState extends UserPreferences {
  // Profile Details (local cache)
  profile: UserProfile;
  
  // Metadata
  lastSyncedAt: string | null;
  version: number;
  
  // Actions
  setTheme: (theme: ThemeMode) => void;
  setCompactMode: (enabled: boolean) => void;
  setShowAnimations: (enabled: boolean) => void;
  setFontSize: (size: FontSize) => void;
  setDefaultAnalysisDepth: (depth: AnalysisDepth) => void;
  setAutoSaveResults: (enabled: boolean) => void;
  setShowAdvancedMetrics: (enabled: boolean) => void;
  setEmailNotifications: (enabled: boolean) => void;
  setBrowserNotifications: (enabled: boolean) => void;
  setNotificationFrequency: (frequency: NotificationFrequency) => void;
  setInAppEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setMutedCategories: (categories: NotificationCategory[]) => void;
  setDefaultView: (view: DefaultView) => void;
  setItemsPerPage: (count: number) => void;
  setShowQuickStats: (enabled: boolean) => void;
  setShareAnalytics: (enabled: boolean) => void;
  setSaveHistory: (enabled: boolean) => void;
  setHistoryRetentionDays: (days: number) => void;
  setShareLinkExpirationDays: (days: number) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  resetSettings: () => void;
  updateLastSynced: () => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

const defaultPreferences: UserPreferences = {
  // Display
  theme: 'system',
  compactMode: false,
  showAnimations: true,
  fontSize: 'medium',
  
  // Analysis
  defaultAnalysisDepth: 'standard',
  autoSaveResults: true,
  showAdvancedMetrics: false,
  
  // Notifications
  emailNotifications: true,
  browserNotifications: false,
  notificationFrequency: 'important',
  inAppEnabled: true,
  soundEnabled: true,
  mutedCategories: [],
  
  // Dashboard
  defaultView: 'list',
  itemsPerPage: 10,
  showQuickStats: true,
  
  // Privacy
  shareAnalytics: false,
  saveHistory: true,
  historyRetentionDays: 30,
  shareLinkExpirationDays: 30,
};

const defaultProfile: UserProfile = {
  displayName: '',
  avatarUrl: null,
  orgLogoUrl: null,
  orgFaviconUrl: null,
  bio: '',
  company: '',
  website: '',
  timezone: typeof Intl !== 'undefined' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : 'UTC',
  language: typeof navigator !== 'undefined' 
    ? navigator.language || 'en-US' 
    : 'en-US',
};

// Helper to detect system theme preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultPreferences,
      profile: defaultProfile,
      lastSyncedAt: null,
      version: 1,
      
      // Display Actions
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        if (typeof document !== 'undefined') {
          const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(effectiveTheme);
        }
      },
      
      setCompactMode: (compactMode) => set({ compactMode }),
      
      setShowAnimations: (showAnimations) => {
        set({ showAnimations });
        // Apply to document
        if (typeof document !== 'undefined') {
          if (showAnimations) {
            document.documentElement.classList.remove('no-animations');
          } else {
            document.documentElement.classList.add('no-animations');
          }
        }
      },
      
      setFontSize: (fontSize) => {
        set({ fontSize });
        // Apply font size to document
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg');
          const sizeClass = 
            fontSize === 'small' ? 'text-sm' : 
            fontSize === 'large' ? 'text-lg' : 
            'text-base';
          document.documentElement.classList.add(sizeClass);
        }
      },
      
      // Analysis Actions
      setDefaultAnalysisDepth: (defaultAnalysisDepth) => set({ defaultAnalysisDepth }),
      setAutoSaveResults: (autoSaveResults) => set({ autoSaveResults }),
      setShowAdvancedMetrics: (showAdvancedMetrics) => set({ showAdvancedMetrics }),
      
      // Notification Actions
      setEmailNotifications: (emailNotifications) => set({ emailNotifications }),
      
      setBrowserNotifications: (browserNotifications) => {
        set({ browserNotifications });
        // Request permission if enabling
        if (browserNotifications && typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission().catch(console.error);
        }
      },
      
      setNotificationFrequency: (notificationFrequency) => set({ notificationFrequency }),
      
      setInAppEnabled: (inAppEnabled) => set({ inAppEnabled }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setMutedCategories: (mutedCategories) => set({ mutedCategories }),
      
      // Dashboard Actions
      setDefaultView: (defaultView) => set({ defaultView }),
      
      setItemsPerPage: (itemsPerPage) => {
        // Validate range
        const validCount = Math.max(5, Math.min(50, itemsPerPage));
        set({ itemsPerPage: validCount });
      },
      
      setShowQuickStats: (showQuickStats) => set({ showQuickStats }),
      
      // Privacy Actions
      setShareAnalytics: (shareAnalytics) => set({ shareAnalytics }),
      setSaveHistory: (saveHistory) => set({ saveHistory }),
      
      setHistoryRetentionDays: (historyRetentionDays) => {
        // Validate range (7-365 days)
        const validDays = Math.max(7, Math.min(365, historyRetentionDays));
        set({ historyRetentionDays: validDays });
      },
      
      setShareLinkExpirationDays: (shareLinkExpirationDays) => {
        // Valid values: 0 (never), 7, 14, 30, 90
        set({ shareLinkExpirationDays });
      },
      
      // Profile Actions
      updateProfile: (profileUpdate) => {
        set((state) => ({
          profile: { ...state.profile, ...profileUpdate },
          lastSyncedAt: new Date().toISOString(),
        }));
      },
      
      // Utility Actions
      resetSettings: () => {
        set({
          ...defaultPreferences,
          profile: defaultProfile,
          lastSyncedAt: null,
        });
        
        // Reset document classes
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove(
            'light', 'dark', 'no-animations', 
            'text-sm', 'text-base', 'text-lg'
          );
          const effectiveTheme = getSystemTheme();
          document.documentElement.classList.add(effectiveTheme, 'text-base');
        }
      },
      
      updateLastSynced: () => {
        set({ lastSyncedAt: new Date().toISOString() });
      },
      
      getEffectiveTheme: () => {
        const state = get();
        return state.theme === 'system' ? getSystemTheme() : state.theme;
      },
    }),
    {
      name: 'user-settings-v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        // Only persist user preferences and profile, not methods
        theme: state.theme,
        compactMode: state.compactMode,
        showAnimations: state.showAnimations,
        fontSize: state.fontSize,
        defaultAnalysisDepth: state.defaultAnalysisDepth,
        autoSaveResults: state.autoSaveResults,
        showAdvancedMetrics: state.showAdvancedMetrics,
        emailNotifications: state.emailNotifications,
        browserNotifications: state.browserNotifications,
        notificationFrequency: state.notificationFrequency,
        inAppEnabled: state.inAppEnabled,
        soundEnabled: state.soundEnabled,
        mutedCategories: state.mutedCategories,
        defaultView: state.defaultView,
        itemsPerPage: state.itemsPerPage,
        showQuickStats: state.showQuickStats,
        shareAnalytics: state.shareAnalytics,
        saveHistory: state.saveHistory,
        historyRetentionDays: state.historyRetentionDays,
        shareLinkExpirationDays: state.shareLinkExpirationDays,
        profile: state.profile,
        lastSyncedAt: state.lastSyncedAt,
        version: state.version,
      }),
      migrate: (persistedState: any, version: number) => {
        // Handle migrations if schema changes
        if (version === 0) {
          // Migration from v0 to v1
          return {
            ...defaultPreferences,
            ...persistedState,
            profile: {
              ...defaultProfile,
              ...persistedState.profile,
            },
            version: 1,
          };
        }
        return persistedState as SettingsState;
      },
    }
  )
);

// Selectors for common use cases
export const useTheme = () => useSettingsStore((state) => state.theme);
export const useEffectiveTheme = () => useSettingsStore((state) => state.getEffectiveTheme());
export const useProfile = () => useSettingsStore((state) => state.profile);
export const useNotificationSettings = () => useSettingsStore((state) => ({
  email: state.emailNotifications,
  browser: state.browserNotifications,
  frequency: state.notificationFrequency,
  inAppEnabled: state.inAppEnabled,
  soundEnabled: state.soundEnabled,
  mutedCategories: state.mutedCategories,
}));
export const useDashboardSettings = () => useSettingsStore((state) => ({
  view: state.defaultView,
  itemsPerPage: state.itemsPerPage,
  showQuickStats: state.showQuickStats,
}));

// Type exports
export type { UserProfile, UserPreferences };