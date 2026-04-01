import fs from 'node:fs';
import path from 'node:path';

const serverRoot = process.cwd();
const repoRoot = path.resolve(serverRoot, '..');
const clientDist = path.resolve(repoRoot, 'client', 'dist');
const serverClientDist = path.resolve(serverRoot, 'dist', 'client');

if (!fs.existsSync(clientDist)) {
  console.error(`[stage-client-dist] Missing client build output at ${clientDist}`);
  process.exit(1);
}

fs.rmSync(serverClientDist, { recursive: true, force: true });
fs.mkdirSync(serverClientDist, { recursive: true });
fs.cpSync(clientDist, serverClientDist, { recursive: true });

const requiredRouteFiles = [
  path.join(serverClientDist, 'index.html'),
  path.join(serverClientDist, 'pricing', 'index.html'),
  path.join(serverClientDist, 'methodology', 'index.html'),
];

for (const filePath of requiredRouteFiles) {
  if (!fs.existsSync(filePath)) {
    console.error(`[stage-client-dist] Expected prerender output missing: ${filePath}`);
    process.exit(1);
  }
}

console.log(`[stage-client-dist] Copied client dist -> ${serverClientDist}`);
