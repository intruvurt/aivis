// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useFeatureStatus from './useFeatureStatus';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../utils/api';

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  apiFetch: vi.fn(),
  default: vi.fn(),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedApiFetch = vi.mocked(apiFetch);

function setAuthState(state: { isAuthenticated: boolean; token: string | null }) {
  mockedUseAuthStore.mockImplementation((selector: any) => selector(state));
}

describe('useFeatureStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads status and formats updatedAtLabel from server generatedAt', async () => {
    setAuthState({ isAuthenticated: true, token: 'tok_123' });

    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          generatedAt: '2026-03-08T15:45:00.000Z',
          tier: 'signal',
          features: {
            scheduledRescans: { available: true, count: 3 },
            apiAccess: { available: true, keyCount: 2 },
          },
        },
      }),
    } as any);

    const { result } = renderHook(() => useFeatureStatus());

    await waitFor(() => {
      expect(result.current.status?.tier).toBe('signal');
    });

    expect(result.current.status?.features?.scheduledRescans?.count).toBe(3);
    expect(result.current.status?.features?.apiAccess?.keyCount).toBe(2);
    expect(result.current.updatedAtLabel).toBeTruthy();
    expect(result.current.error).toBeNull();
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  it('resets status for unauthenticated users and does not fetch', async () => {
    setAuthState({ isAuthenticated: false, token: null });

    const { result } = renderHook(() => useFeatureStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.status).toBeNull();
    expect(result.current.updatedAtLabel).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });
});
