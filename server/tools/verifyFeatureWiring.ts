import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TIER_LIMITS } from '../../shared/types.js';

type CheckResult = { name: string; ok: boolean; details?: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

async function readRepoFile(...parts: string[]) {
  return readFile(path.join(repoRoot, ...parts), 'utf8');
}

function checkTierLimits(): CheckResult[] {
  const expected = {
    observer: { scansPerMonth: 3, hasApiAccess: false, hasScheduledRescans: false },
    alignment: { scansPerMonth: 60, hasApiAccess: false, hasScheduledRescans: true },
    signal: { scansPerMonth: 110, hasApiAccess: true, hasScheduledRescans: true },
    scorefix: { scansPerMonth: 250, hasApiAccess: true, hasScheduledRescans: true },
  } as const;

  return Object.entries(expected).map(([tier, exp]) => {
    const actual = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];
    const ok =
      actual.scansPerMonth === exp.scansPerMonth &&
      actual.hasApiAccess === exp.hasApiAccess &&
      actual.hasScheduledRescans === exp.hasScheduledRescans;

    return {
      name: `tier:${tier}`,
      ok,
      details: ok
        ? undefined
        : `expected scans=${exp.scansPerMonth}, api=${exp.hasApiAccess}, rescans=${exp.hasScheduledRescans}; got scans=${actual.scansPerMonth}, api=${actual.hasApiAccess}, rescans=${actual.hasScheduledRescans}`,
    };
  });
}

function hasPattern(source: string, pattern: RegExp): boolean {
  return pattern.test(source);
}

async function checkRouteWiring(): Promise<CheckResult[]> {
  const serverTs = await readRepoFile('server', 'src', 'server.ts');
  const competitors = await readRepoFile('server', 'src', 'routes', 'competitors.ts');
  const citations = await readRepoFile('server', 'src', 'routes', 'citations.ts');
  const reverseEngineer = await readRepoFile('server', 'src', 'routes', 'reverseEngineerApi.ts');
  const featureRoutes = await readRepoFile('server', 'src', 'routes', 'featureRoutes.ts');

  return [
    {
      name: 'route:/api/analyze middleware chain',
      ok: hasPattern(
        serverTs,
        /app\.post\('\/api\/analyze',\s*authRequired,\s*workspaceRequired,\s*heavyActionLimiter,\s*usageGate,\s*incrementUsage,/
      ),
    },
    {
      name: 'route:/api/analyze/upload middleware chain',
      ok: hasPattern(
        serverTs,
        /app\.post\('\/api\/analyze\/upload',\s*authRequired,\s*workspaceRequired,\s*heavyActionLimiter,\s*usageGate,\s*incrementUsage,/
      ),
    },
    {
      name: 'route:/api/analyze/intelligence middleware chain',
      ok: hasPattern(
        serverTs,
        /app\.post\('\/api\/analyze\/intelligence',\s*authRequired,\s*workspaceRequired,\s*heavyActionLimiter,\s*usageGate,\s*incrementUsage,/
      ),
    },
    {
      name: 'competitors gated alignment+',
      ok: hasPattern(competitors, /meetsMinimumTier\(userTier,\s*'alignment'\)/),
    },
    {
      name: 'citations gated alignment+',
      ok:
        hasPattern(citations, /meetsMinimumTier\(userTier,\s*'alignment'\)/) &&
        hasPattern(citations, /meetsMinimumTier\(userTier,\s*'signal'\)/),
    },
    {
      name: 'reverse engineer gated alignment+',
      ok: hasPattern(reverseEngineer, /meetsMinimumTier\(userTier,\s*'alignment'\)/),
    },
    {
      name: 'feature routes gated by enforceFeature(api/rescan/webhook/whiteLabel/nicheDiscovery)',
      ok:
        hasPattern(featureRoutes, /enforceFeature\('rescan'\)/) &&
        hasPattern(featureRoutes, /enforceFeature\('api'\)/) &&
        hasPattern(featureRoutes, /enforceFeature\('webhook'\)/) &&
        hasPattern(featureRoutes, /enforceFeature\('whiteLabel'\)/) &&
        hasPattern(featureRoutes, /enforceFeature\('nicheDiscovery'\)/),
    },
  ];
}

async function main() {
  const checks: CheckResult[] = [...checkTierLimits(), ...(await checkRouteWiring())];
  const failed = checks.filter((c) => !c.ok);

  for (const check of checks) {
    if (check.ok) {
      console.log(`✅ ${check.name}`);
    } else {
      console.error(`❌ ${check.name}${check.details ? ` - ${check.details}` : ''}`);
    }
  }

  if (failed.length > 0) {
    console.error(`\nFeature wiring verification failed (${failed.length}/${checks.length} checks failed).`);
    process.exit(1);
  }

  console.log(`\nFeature wiring verification passed (${checks.length} checks).`);
}

await main();