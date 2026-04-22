import 'dotenv/config';
import { runProductionHardChecks } from '../src/services/deterministicContractService.js';

async function main() {
    try {
        const report = await runProductionHardChecks();

        if (!report.ok) {
            console.error('[Determinism] FAIL');
            console.error(JSON.stringify(report.checks, null, 2));
            process.exit(1);
        }

        console.log('[Determinism] PASS');
        console.log(JSON.stringify(report.checks, null, 2));
    } catch (err: any) {
        console.error('[Determinism] ERROR');
        console.error(err?.message || err);
        process.exit(1);
    }
}

main();
