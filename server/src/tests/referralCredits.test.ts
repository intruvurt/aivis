import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../services/postgresql.js', () => ({
  executeTransaction: vi.fn(async (callback: any) => callback({ query: queryMock })),
  getPool: vi.fn(),
}));

import { settleReferralCreditsIfEligible } from '../services/referralCredits.js';

function setupEligibilityQueries(args: {
  status?: string;
  tier?: string;
  audits?: number;
}) {
  const status = args.status ?? 'pending';
  const tier = args.tier ?? 'observer';
  const audits = args.audits ?? 0;

  queryMock
    .mockResolvedValueOnce({ rows: [{ id: 'attr_1', referrer_user_id: 'ref_1', referred_user_id: 'referred_1', status }] })
    .mockResolvedValueOnce({ rows: [{ tier }] })
    .mockResolvedValueOnce({ rows: [{ total: audits }] });
}

describe('settleReferralCreditsIfEligible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not grant credits before 5 audits for observer users', async () => {
    setupEligibilityQueries({ tier: 'observer', audits: 4 });

    const result = await settleReferralCreditsIfEligible('referred_1');

    expect(result.granted).toBe(false);
    expect(result.reason).toBe('eligibility_not_met');
    expect(result.auditCount).toBe(4);
    expect(result.requiredAudits).toBe(5);

    const creditInserts = queryMock.mock.calls.filter(
      ([sql]) => String(sql).includes('INSERT INTO scan_pack_credits')
    );
    expect(creditInserts).toHaveLength(0);
  });

  it('grants base reward once referred user reaches 5 audits', async () => {
    setupEligibilityQueries({ tier: 'observer', audits: 5 });
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'attr_1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'attr_1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await settleReferralCreditsIfEligible('referred_1');

    expect(result.granted).toBe(true);
    expect(result.multiplier).toBe(1);
    expect(result.referrerCreditsAdded).toBe(5);
    expect(result.referredCreditsAdded).toBe(5);

    const creditInserts = queryMock.mock.calls.filter(
      ([sql]) => String(sql).includes('INSERT INTO scan_pack_credits')
    );
    expect(creditInserts).toHaveLength(2);
    expect(creditInserts[0]?.[1]).toEqual(['ref_1', 5]);
    expect(creditInserts[1]?.[1]).toEqual(['referred_1', 5]);
  });

  it('grants triple reward when referred user is paid even below 5 audits', async () => {
    setupEligibilityQueries({ tier: 'signal', audits: 2 });
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'attr_1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'attr_1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await settleReferralCreditsIfEligible('referred_1');

    expect(result.granted).toBe(true);
    expect(result.multiplier).toBe(3);
    expect(result.referrerCreditsAdded).toBe(15);
    expect(result.referredCreditsAdded).toBe(15);

    const creditInserts = queryMock.mock.calls.filter(
      ([sql]) => String(sql).includes('INSERT INTO scan_pack_credits')
    );
    expect(creditInserts).toHaveLength(2);
    expect(creditInserts[0]?.[1]).toEqual(['ref_1', 15]);
    expect(creditInserts[1]?.[1]).toEqual(['referred_1', 15]);
  });
});
