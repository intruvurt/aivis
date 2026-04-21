import 'dotenv/config';
import { startRawDocumentWorker } from './rawDocument.worker.js';

console.log('[ingestion-worker] starting raw-document processing worker');
startRawDocumentWorker();

const noop = () => { };
process.on('SIGINT', noop);
process.on('SIGTERM', noop);
