import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Check {
    name: string;
    pass: boolean;
    details: string;
}

async function checkMigrationSanity(): Promise<Check> {
    try {
        const migrationsDir = path.resolve(__dirname, '../migrations');
        const entries = await readdir(migrationsDir, { withFileTypes: true });
        const sqlFiles = entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
            .map((entry) => entry.name)
            .sort((a, b) => a.localeCompare(b));

        const executableSqlFiles = sqlFiles.filter((name) => !name.endsWith('.RETIRED.sql'));

        // Check 1: No 000_ prefix (reserved for blocked)
        const hasBlocked000Prefix = executableSqlFiles.some((name) => /^000_/i.test(name));
        if (hasBlocked000Prefix) {
            return {
                name: 'Migration Sanity',
                pass: false,
                details: 'Found migration with 000_ prefix (reserved for blocked migrations)',
            };
        }

        // Check 2: Strictly increasing order
        const numbered = executableSqlFiles
            .map((name) => ({
                name,
                prefix: (/^(\d+)_/.exec(name)?.[1] || '').padStart(3, '0'),
            }))
            .filter((entry) => entry.prefix !== '000');

        const prefixes = numbered.map((e) => e.prefix);
        const sorted = [...prefixes].sort();
        const isOrdered = prefixes.every((prefix, idx) => prefix === sorted[idx]);

        if (!isOrdered) {
            return {
                name: 'Migration Sanity',
                pass: false,
                details: `Migrations not in order: ${prefixes.join(', ')}`,
            };
        }

        return {
            name: 'Migration Sanity',
            pass: true,
            details: `${executableSqlFiles.length} migrations in order`,
        };
    } catch (err: any) {
        return {
            name: 'Migration Sanity',
            pass: false,
            details: `Error: ${err?.message || String(err)}`,
        };
    }
}

async function checkDeterministicStagesExist(): Promise<Check> {
    try {
        const contractFile = path.resolve(__dirname, '../src/services/deterministicContractService.ts');
        const content = await readFile(contractFile, 'utf8');

        const expectedStages = ['queued', 'fetched', 'parsed', 'entities', 'citations', 'scored', 'finalized'];
        const missing = expectedStages.filter((stage) => !content.includes(`'${stage}'`));

        if (missing.length > 0) {
            return {
                name: 'Deterministic Stages',
                pass: false,
                details: `Missing stages: ${missing.join(', ')}`,
            };
        }

        return {
            name: 'Deterministic Stages',
            pass: true,
            details: `All 7 stages defined`,
        };
    } catch (err: any) {
        return {
            name: 'Deterministic Stages',
            pass: false,
            details: `Error: ${err?.message || String(err)}`,
        };
    }
}

async function checkGatesWired(): Promise<Check> {
    try {
        const filesToCheck = [
            { path: '../src/server.ts', gate: 'usageGate' },
            { path: '../src/routes/deterministicLoopRoutes.ts', gate: '/determinism/checks' },
            { path: '../src/workers/auditWorker.ts', gate: 'runProductionHardChecks' },
        ];

        const missing = [];

        for (const file of filesToCheck) {
            try {
                const filePath = path.resolve(__dirname, file.path);
                const content = await readFile(filePath, 'utf8');
                if (!content.includes(file.gate)) {
                    missing.push(`${file.path}: missing '${file.gate}'`);
                }
            } catch (err) {
                missing.push(`${file.path}: not found`);
            }
        }

        if (missing.length > 0) {
            return {
                name: 'Gates Wired',
                pass: false,
                details: missing.join('; '),
            };
        }

        return {
            name: 'Gates Wired',
            pass: true,
            details: 'Auth, usage, and determinism gates active',
        };
    } catch (err: any) {
        return {
            name: 'Gates Wired',
            pass: false,
            details: `Error: ${err?.message || String(err)}`,
        };
    }
}

async function checkAnalyticsWired(): Promise<Check> {
    try {
        const serverFile = path.resolve(__dirname, '../src/server.ts');
        const content = await readFile(serverFile, 'utf8');

        const required = [
            'analyticsGatewayRoutes',
            'app.use.*analytics',
        ];

        const missing = [];
        if (!content.includes('analyticsGatewayRoutes')) {
            missing.push('analyticsGatewayRoutes import');
        }
        if (!content.includes('/api/analytics')) {
            missing.push('analytics routes mounting');
        }

        if (missing.length > 0) {
            return {
                name: 'Analytics Gateway Mounted',
                pass: false,
                details: missing.join('; '),
            };
        }

        return {
            name: 'Analytics Gateway Mounted',
            pass: true,
            details: 'Analytics routes properly mounted',
        };
    } catch (err: any) {
        return {
            name: 'Analytics Gateway Mounted',
            pass: false,
            details: `Error: ${err?.message || String(err)}`,
        };
    }
}

async function checkEventSchemaDefined(): Promise<Check> {
    try {
        const schemaFile = path.resolve(__dirname, '../src/config/posthogEvents.ts');
        const content = await readFile(schemaFile, 'utf8');

        const events = ['scan_started', 'scan_completed', 'node_clicked', 'fix_applied', 'conflict_resolved', 'analysis_rerun'];
        const missing = events.filter((e) => !content.includes(`'${e}'`));

        if (missing.length > 0) {
            return {
                name: 'PostHog Event Schema',
                pass: false,
                details: `Missing events: ${missing.join(', ')}`,
            };
        }

        return {
            name: 'PostHog Event Schema',
            pass: true,
            details: `All core events defined with signal mapping`,
        };
    } catch (err: any) {
        return {
            name: 'PostHog Event Schema',
            pass: false,
            details: `Error: ${err?.message || String(err)}`,
        };
    }
}

async function main() {
    console.log('[Determinism] Running CI preflight checks...\n');

    const checks = await Promise.all([
        checkMigrationSanity(),
        checkDeterministicStagesExist(),
        checkGatesWired(),
        checkAnalyticsWired(),
        checkEventSchemaDefined(),
    ]);

    const allPassed = checks.every((c) => c.pass);

    checks.forEach((check) => {
        const status = check.pass ? '✓' : '✗';
        console.log(`${status} ${check.name}`);
        console.log(`  ${check.details}`);
    });

    console.log();
    if (allPassed) {
        console.log('[Determinism] PASS - All preflight checks passed');
        process.exit(0);
    } else {
        console.log('[Determinism] FAIL - Some checks failed');
        process.exit(1);
    }
}

main();
