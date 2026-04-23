type JsonRecord = Record<string, unknown>;

type RequestOpts = {
    method?: 'GET' | 'POST';
    body?: JsonRecord;
    token: string;
    workspaceId?: string;
};

const BASE_URL = String(process.env.AIVIS_SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = String(process.env.AIVIS_SMOKE_TOKEN || '').trim();
const WORKSPACE_ID = String(process.env.AIVIS_SMOKE_WORKSPACE_ID || '').trim() || undefined;
const INPUT = String(process.env.AIVIS_SMOKE_INPUT || 'https://example.com').trim();
const TIMEOUT_MS = Math.max(30_000, Number(process.env.AIVIS_SMOKE_TIMEOUT_MS || 180_000));
const POLL_MS = Math.max(500, Number(process.env.AIVIS_SMOKE_POLL_MS || 2_000));

const REQUIRED_EVENTS = [
    'SCAN_CREATED',
    'ENTITIES_RESOLVED',
    'GAP_ANALYZED',
    'PAGE_SPEC_CREATED',
    'PAGE_COMPILED',
    'PAGE_PUBLISHED',
    'RESCAN_COMPLETED',
] as const;

function assertCondition(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function request(path: string, opts: RequestOpts): Promise<{ status: number; data: JsonRecord }> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.token}`,
        'Content-Type': 'application/json',
    };
    if (opts.workspaceId) headers['x-workspace-id'] = opts.workspaceId;

    const response = await fetch(`${BASE_URL}${path}`, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const data = (await response.json().catch(() => ({}))) as JsonRecord;
    return { status: response.status, data };
}

async function waitForReady(jobId: string): Promise<JsonRecord> {
    const started = Date.now();
    while (Date.now() - started < TIMEOUT_MS) {
        const resp = await request(`/api/analyze/compiler/${jobId}`, {
            token: TOKEN,
            workspaceId: WORKSPACE_ID,
        });

        assertCondition(resp.status === 200, `GET job failed with ${resp.status}`);
        const state = String(resp.data.state || '');

        if (state === 'READY' || state === 'PUBLISHED') return resp.data;
        if (state === 'FAILED') {
            throw new Error(`Job entered FAILED state: ${String(resp.data.failure_reason || 'unknown')}`);
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    throw new Error(`Timed out waiting for READY state after ${TIMEOUT_MS}ms`);
}

function assertLedgerContinuity(events: Array<Record<string, unknown>>): void {
    assertCondition(events.length > 0, 'No ledger events found');

    for (let i = 0; i < events.length; i += 1) {
        const seq = Number(events[i].sequence);
        assertCondition(Number.isInteger(seq), `Invalid sequence at index ${i}`);
        assertCondition(seq === i, `Ledger sequence discontinuity at index ${i}; got ${seq}`);

        const eventHash = String(events[i].event_hash || '');
        assertCondition(eventHash.length > 0, `Missing event_hash at seq ${seq}`);

        if (i === 0) {
            const parentHash = events[i].parent_hash;
            assertCondition(parentHash === null || String(parentHash) === '', `First event parent_hash must be null/empty; got ${String(parentHash)}`);
        } else {
            const expectedParent = String(events[i - 1].event_hash || '');
            const actualParent = String(events[i].parent_hash || '');
            assertCondition(actualParent === expectedParent, `Parent hash mismatch at seq ${seq}`);
        }
    }
}

function assertPersistedArtifacts(job: JsonRecord): void {
    const specs = Array.isArray(job.page_specs) ? job.page_specs : [];
    const pages = Array.isArray(job.pages) ? job.pages : [];
    const links = Array.isArray(job.links) ? job.links : [];
    const artifacts = Array.isArray(job.artifacts) ? job.artifacts : [];

    assertCondition(specs.length > 0, 'No persisted page_specs found');
    assertCondition(pages.length > 0, 'No persisted pages found');
    assertCondition(links.length >= 0, 'Links array missing');
    assertCondition(artifacts.length > 0, 'No persisted publish artifacts found');
}

function assertRequiredEvents(events: Array<Record<string, unknown>>): void {
    const types = new Set(events.map((event) => String(event.event_type || '')));
    for (const required of REQUIRED_EVENTS) {
        assertCondition(types.has(required), `Missing required event_type '${required}'`);
    }
}

async function run(): Promise<void> {
    assertCondition(TOKEN.length > 0, 'AIVIS_SMOKE_TOKEN is required');

    const analyze = await request('/api/analyze/compiler', {
        method: 'POST',
        token: TOKEN,
        workspaceId: WORKSPACE_ID,
        body: {
            input: INPUT,
            mode: 'content',
            depth: 'deep',
            idempotencyKey: `smoke-${Date.now()}`,
        },
    });

    assertCondition(analyze.status === 202 || analyze.status === 200, `Analyze request failed with ${analyze.status}`);
    const jobId = String(analyze.data.job_id || '');
    assertCondition(jobId.length > 0, 'Analyze response missing job_id');

    await waitForReady(jobId);

    const publish = await request(`/api/analyze/compiler/${jobId}/publish`, {
        method: 'POST',
        token: TOKEN,
        workspaceId: WORKSPACE_ID,
    });
    assertCondition(publish.status === 200, `Publish request failed with ${publish.status}`);

    const rescan = await request(`/api/analyze/compiler/${jobId}/rescan`, {
        method: 'POST',
        token: TOKEN,
        workspaceId: WORKSPACE_ID,
    });
    assertCondition(rescan.status === 200, `Rescan request failed with ${rescan.status}`);

    const finalJob = await request(`/api/analyze/compiler/${jobId}`, {
        token: TOKEN,
        workspaceId: WORKSPACE_ID,
    });
    assertCondition(finalJob.status === 200, `Final job fetch failed with ${finalJob.status}`);

    const events = (Array.isArray(finalJob.data.events) ? finalJob.data.events : []) as Array<Record<string, unknown>>;
    assertCondition(events.length > 0, 'No events returned in final job payload');

    assertLedgerContinuity(events);
    assertRequiredEvents(events);
    assertPersistedArtifacts(finalJob.data);

    console.log('[smoke] analyze->publish->rescan passed');
    console.log(JSON.stringify({
        jobId,
        state: finalJob.data.state,
        eventCount: events.length,
        pageSpecs: Array.isArray(finalJob.data.page_specs) ? finalJob.data.page_specs.length : 0,
        pages: Array.isArray(finalJob.data.pages) ? finalJob.data.pages.length : 0,
        artifacts: Array.isArray(finalJob.data.artifacts) ? finalJob.data.artifacts.length : 0,
    }, null, 2));
}

run().catch((err: unknown) => {
    console.error('[smoke] failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
