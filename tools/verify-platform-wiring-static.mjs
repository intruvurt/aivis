import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function run() {
  const appRoutes = read('client/src/App.tsx');
  const serverMain = read('server/src/server.ts');
  const mcpRoutes = read('server/src/routes/webMcp.ts');

  const clientChecks = [
    ['/pricing', 'client route pricing'],
    ['/methodology', 'client route methodology'],
    ['/privacy', 'client route privacy'],
    ['/terms', 'client route terms'],
    ['/integrations', 'client route integrations'],
    ['/prompt-intelligence', 'client route prompt intelligence'],
    ['/competitors', 'client route competitors'],
    ['/citations', 'client route citations'],
    ['/gsc', 'client route gsc intelligence'],
    ['/indexing', 'client route indexing/indexnow'],
    ['/mcp', 'client route mcp console'],
  ];

  const serverChecks = [
    ['/api/analyze', 'server analyze endpoint'],
    ['/api/pricing', 'server pricing endpoint'],
    ['/api/competitors', 'server competitors endpoint'],
    ['/api/citations', 'server citations endpoint'],
    ['/api/visibility', 'server realtime visibility endpoint'],
    ['/api/fix-engine', 'server auto visibility fix endpoint'],
    ['/api/self-healing', 'server self-healing endpoint'],
    ['/api/portfolio', 'server agency portfolio endpoint'],
    ['/api/growth', 'server growth engine endpoint'],
    ['/api/indexing', 'server indexnow/indexing endpoint'],
    ['/api/integrations/gsc', 'server gsc endpoint'],
    ['/api/mcp', 'server mcp endpoint'],
  ];

  const mcpChecks = [
    ["name: 'scan_url'", 'webMCP tool scan_url'],
    ["name: 'run_citation_test'", 'webMCP tool run_citation_test'],
    ["name: 'compare_competitors'", 'webMCP tool compare_competitors'],
  ];

  for (const [needle, label] of clientChecks) assertIncludes(appRoutes, needle, label);
  for (const [needle, label] of serverChecks) assertIncludes(serverMain, needle, label);
  for (const [needle, label] of mcpChecks) assertIncludes(mcpRoutes, needle, label);

  console.log('Static platform wiring smoke PASSED');
  console.log(`- checked ${clientChecks.length} client routes`);
  console.log(`- checked ${serverChecks.length} server endpoints`);
  console.log(`- checked ${mcpChecks.length} webMCP tools`);
}

try {
  run();
} catch (error) {
  console.error(`Static platform wiring smoke FAILED: ${error?.message || String(error)}`);
  process.exit(1);
}
