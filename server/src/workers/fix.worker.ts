import 'dotenv/config';
import { startFixWorker } from './fixWorker.js';

console.log('[fix-worker] starting fix queue worker');
startFixWorker();

const noop = () => { };
process.on('SIGINT', noop);
process.on('SIGTERM', noop);
