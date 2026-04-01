import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../services/postgresql.js', () => ({
  getPool: () => ({
    query: (...args: unknown[]) => mockQuery(...args),
  }),
}));

import { validateApiKey } from '../services/apiKeyService.js';

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid when key format is wrong', async () => {
    const result = await validateApiKey('not_an_api_key');

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns invalid when key hash lookup misses', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await validateApiKey('avis_missing_key');

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns tier_blocked when user tier has no API access', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'key_1',
          user_id: 'user_1',
          workspace_id: 'ws_1',
          scopes: ['read:audits'],
          expires_at: null,
          tier: 'observer',
        },
      ],
    });

    const result = await validateApiKey('avis_observer_key');

    expect(result).toEqual({ ok: false, reason: 'tier_blocked' });
  });

  it('returns expired when key expiry is in the past', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'key_1',
          user_id: 'user_1',
          workspace_id: 'ws_1',
          scopes: ['read:audits'],
          expires_at: '2000-01-01T00:00:00.000Z',
          tier: 'signal',
        },
      ],
    });

    const result = await validateApiKey('avis_expired_key');

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('returns ok result for active key and updates last_used_at', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'key_1',
            user_id: 'user_1',
            workspace_id: 'ws_1',
            scopes: ['read:audits', 'read:analytics'],
            expires_at: null,
            tier: 'signal',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await validateApiKey('avis_valid_key');

    expect(result).toEqual({
      ok: true,
      keyId: 'key_1',
      userId: 'user_1',
      workspaceId: 'ws_1',
      scopes: ['read:audits', 'read:analytics'],
    });
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
