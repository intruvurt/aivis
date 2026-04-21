import 'dotenv/config';

const tierIntervals = {
  observer: 86_400_000,
  starter: 86_400_000,
  alignment: 43_200_000,
  signal: 3_600_000,
  scorefix: 3_600_000,
  agency: 1_800_000,
  enterprise: 900_000,
};

const rows = Object.entries(tierIntervals).map(([tier, intervalMs]) => ({
  tier,
  intervalMs,
  intervalMinutes: Math.round(intervalMs / 60000),
  scansPerDay: Math.round((24 * 60 * 60 * 1000) / intervalMs),
}));

console.table(rows);
