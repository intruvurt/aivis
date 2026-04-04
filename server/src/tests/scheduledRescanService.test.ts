import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const mockHasFeatureAccess = vi.fn();
const mockDetectSubstantialChange = vi.fn();
const mockBuildScoreChangeReason = vi.fn();

vi.mock('../services/postgresql.js', () => ({
  getPool: vi.fn(() => ({ query: queryMock })),
}));

vi.mock('../middleware/featureGate.js', () => ({
  hasFeatureAccess: (...args: unknown[]) => mockHasFeatureAccess(...args),
}));

vi.mock('../models/User.js', () => ({
  getUserById: vi.fn(),
}));

vi.mock('../services/changeDetectionService.js', () => ({
  detectSubstantialChange: (...args: unknown[]) => mockDetectSubstantialChange(...args),
  buildScoreChangeReason: (...args: unknown[]) => mockBuildScoreChangeReason(...args),
}));

import { createScheduledRescan, processDueRescans } from '../services/scheduledRescanService.js';

describe('scheduledRescanService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasFeatureAccess.mockReturnValue(true);
    mockBuildScoreChangeReason.mockReturnValue(null);
  });

  it('normalizes bare domains when creating a scheduled rescan', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'rescan_1' }] });

    await createScheduledRescan('user_1', 'ws_1', 'otterly.ai', 'weekly');

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scheduled_rescans'),
      ['user_1', 'ws_1', 'https://otterly.ai/', 'weekly', expect.any(String)]
    );
  });

  it('treats a null internal audit result as a failure and schedules a retry', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'sched_1',
            user_id: 'user_1',
            workspace_id: 'ws_1',
            url: 'aivis.biz',
            frequency: 'once',
            last_audit_id: null,
            last_change_fingerprint: null,
            last_change_snapshot: null,
            tier: 'signal',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    mockDetectSubstantialChange.mockResolvedValue({
      shouldAnalyze: true,
      fingerprint: 'fingerprint_1',
      snapshot: { title: 'snapshot' },
      evidence: { changed_signals: [] },
    });

    const analyzeInternally = vi.fn().mockResolvedValue(null);
    const onFailed = vi.fn();

    const processed = await processDueRescans(analyzeInternally, { onFailed });

    expect(processed).toBe(0);
    expect(analyzeInternally).toHaveBeenCalledWith('user_1', 'ws_1', 'https://aivis.biz/');
    expect(onFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        workspaceId: 'ws_1',
        scheduleId: 'sched_1',
        reason: 'Internal scheduled rescan did not produce an audit record',
      })
    );

    const retryUpdate = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE scheduled_rescans SET next_run_at = $1, updated_at = NOW() WHERE id = $2')
    );

    expect(retryUpdate).toBeDefined();
    expect(retryUpdate?.[1]?.[0]).toEqual(expect.any(String));
    expect(retryUpdate?.[1]?.[1]).toBe('sched_1');
  });
});
