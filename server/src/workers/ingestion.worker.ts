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

    const noop = () => { };
    process.on('SIGINT', noop);
    process.on('SIGTERM', noop);
}
