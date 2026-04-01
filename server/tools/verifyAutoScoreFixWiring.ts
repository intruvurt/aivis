import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type CheckResult = { name: string; ok: boolean; details?: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

async function readRepoFile(...parts: string[]) {
  return readFile(path.join(repoRoot, ...parts), 'utf8');
}

function hasPattern(source: string, pattern: RegExp): boolean {
  return pattern.test(source);
}

async function checkAutoScoreFixWiring(): Promise<CheckResult[]> {
  const serverTs = await readRepoFile('server', 'src', 'server.ts');
  const routes = await readRepoFile('server', 'src', 'routes', 'autoScoreFixRoutes.ts');
  const service = await readRepoFile('server', 'src', 'services', 'autoScoreFixService.ts');
  const modal = await readRepoFile('client', 'src', 'components', 'AutoScoreFixModal.tsx');
  const widget = await readRepoFile('client', 'src', 'components', 'AutoScoreFixWidget.tsx');

  return [
    {
      name: 'route mounted: /api/auto-score-fix',
      ok: hasPattern(serverTs, /app\.use\('\/api\/auto-score-fix',\s*autoScoreFixRoutes\)/),
    },
    {
      name: 'worker loop started on server boot',
      ok: hasPattern(serverTs, /startAutoScoreFixWorkerLoop\(\)/),
    },
    {
      name: 'expiry loop started on server boot',
      ok: hasPattern(serverTs, /startAutoScoreFixExpiryLoop\(\)/),
    },
    {
      name: 'job submit route uses workspaceRequired + credit gate',
      ok:
        hasPattern(routes, /router\.post\('\/jobs',\s*workspaceRequired,/) &&
        hasPattern(routes, /getAvailablePackCredits\(userId\)/) &&
        hasPattern(routes, /AUTO_SCORE_FIX_CREDIT_COST/),
    },
    {
      name: 'job get/approve/reject routes enforce workspaceRequired',
      ok:
        hasPattern(routes, /router\.get\('\/jobs\/:id',\s*workspaceRequired,/) &&
        hasPattern(routes, /router\.post\('\/jobs\/:id\/approve',\s*workspaceRequired,/) &&
        hasPattern(routes, /router\.post\('\/jobs\/:id\/reject',\s*workspaceRequired,/),
    },
    {
      name: 'service scopes job lookups by workspace id',
      ok:
        hasPattern(service, /getJobById\(jobId:\s*string,\s*userId:\s*string,\s*workspaceId\?:\s*string\)/) &&
        hasPattern(service, /workspace_id\s*=\s*\$3/) &&
        hasPattern(service, /approveJob\(jobId:\s*string,\s*userId:\s*string,\s*workspaceId\?:\s*string\)/) &&
        hasPattern(service, /rejectJob\(jobId:\s*string,\s*userId:\s*string,\s*workspaceId\?:\s*string\)/),
    },
    {
      name: 'service includes durable worker claim/process loop',
      ok:
        hasPattern(service, /claimNextAutoScoreFixJobId\(\)/) &&
        hasPattern(service, /FOR UPDATE SKIP LOCKED/) &&
        hasPattern(service, /processAutoScoreFixJob\(jobId\)/) &&
        hasPattern(service, /startAutoScoreFixWorkerLoop\(\)/),
    },
    {
      name: 'service performs failure refund with ledger path',
      ok:
        hasPattern(service, /refundFailureCredits\(/) &&
        hasPattern(service, /credit_usage_ledger/) &&
        hasPattern(service, /auto_score_fix_refund_failure/),
    },
    {
      name: 'client modal supports backend fix_plan field schema',
      ok:
        hasPattern(modal, /fc\.change_type\s*\|\|\s*fc\.operation/) &&
        hasPattern(modal, /fc\.file_path\s*\|\|\s*fc\.path/) &&
        hasPattern(modal, /fc\.description\s*\|\|\s*fc\.justification/),
    },
    {
      name: 'client widget uses server eligibility flags',
      ok:
        hasPattern(widget, /tierEligible:\s*Boolean\(data\.tier_eligible\)/) &&
        hasPattern(widget, /eligible:\s*Boolean\(data\.eligible\)/),
    },
  ];
}

async function main() {
  const checks = await checkAutoScoreFixWiring();
  const failed = checks.filter((c) => !c.ok);

  for (const check of checks) {
    if (check.ok) {
      console.log(`✅ ${check.name}`);
    } else {
      console.error(`❌ ${check.name}${check.details ? ` — ${check.details}` : ''}`);
    }
  }

  if (failed.length > 0) {
    console.error(`\nAuto Score Fix wiring verification failed (${failed.length}/${checks.length} checks failed).`);
    process.exit(1);
  }

  console.log(`\nAuto Score Fix wiring verification passed (${checks.length} checks).`);
}

await main();
