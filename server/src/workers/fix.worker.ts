import 'dotenv/config';
import { pathToFileURL } from 'url';
import { startFixWorker } from './fixWorker.js';

const isMainModule = (() => {
    const entry = process.argv[1];
    return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
})();

if (isMainModule) {
    console.log('[fix-worker] starting fix queue worker');
    startFixWorker();

    process.on('SIGINT', () => { console.log('[fix-worker] SIGINT — exiting'); process.exit(0); });
    process.on('SIGTERM', () => { console.log('[fix-worker] SIGTERM — exiting'); process.exit(0); });
}
