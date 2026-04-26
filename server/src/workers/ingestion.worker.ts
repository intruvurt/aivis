import 'dotenv/config';
import { pathToFileURL } from 'url';
import { startRawDocumentWorker } from './rawDocument.worker.js';

const isMainModule = (() => {
    const entry = process.argv[1];
    return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
})();

if (isMainModule) {
    console.log('[ingestion-worker] starting raw-document processing worker');
    startRawDocumentWorker();

    process.on('SIGINT', () => { console.log('[ingestion-worker] SIGINT — exiting'); process.exit(0); });
    process.on('SIGTERM', () => { console.log('[ingestion-worker] SIGTERM — exiting'); process.exit(0); });
}
