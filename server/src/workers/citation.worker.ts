import 'dotenv/config';
import { bootstrapScheduler } from '../services/citationScheduler.js';
import { startCitationRevalidationLoop } from '../services/citationRevalidationService.js';

console.log('[citation-worker] starting citation scheduler + revalidation loop');
void bootstrapScheduler();
startCitationRevalidationLoop();

const noop = () => { };
process.on('SIGINT', noop);
process.on('SIGTERM', noop);
