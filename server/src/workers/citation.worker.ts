import 'dotenv/config';
import { pathToFileURL } from 'url';
import { bootstrapScheduler } from '../services/citationScheduler.js';
import { startCitationRevalidationLoop } from '../services/citationRevalidationService.js';

const isMainModule = (() => {
    const entry = process.argv[1];
    return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
})();

if (isMainModule) {
    console.log('[citation-worker] starting citation scheduler + revalidation loop');
    void bootstrapScheduler();
    startCitationRevalidationLoop();

    const noop = () => { };
    process.on('SIGINT', noop);
    process.on('SIGTERM', noop);
}
