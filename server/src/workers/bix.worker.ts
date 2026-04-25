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

    const noop = () => { };
    process.on('SIGINT', noop);
    process.on('SIGTERM', noop);
}
