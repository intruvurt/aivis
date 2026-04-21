import 'dotenv/config';
import { startScheduler } from '../services/scheduler.js';
import { startAuditWorkerLoop } from './auditWorker.js';

console.log('[bix-worker] starting BIX scheduler + audit worker loop');
startScheduler();
startAuditWorkerLoop();

const noop = () => { };
process.on('SIGINT', noop);
process.on('SIGTERM', noop);
