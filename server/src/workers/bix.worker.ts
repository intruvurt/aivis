import 'dotenv/config';
import { pathToFileURL } from 'url';
import { startScheduler } from '../services/scheduler.js';
import { startAuditWorkerLoop } from './auditWorker.js';

const isMainModule = (() => {
    const entry = process.argv[1];
    return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
})();

if (isMainModule) {
    console.log('[bix-worker] starting BIX scheduler + audit worker loop');
    startScheduler();
    startAuditWorkerLoop();

    process.on('SIGINT', () => { console.log('[bix-worker] SIGINT — exiting'); process.exit(0); });
    process.on('SIGTERM', () => { console.log('[bix-worker] SIGTERM — exiting'); process.exit(0); });
}
