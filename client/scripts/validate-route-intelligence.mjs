import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const appPath = path.join(root, "src", "App.tsx");
const routeMapPath = path.join(root, "src", "config", "routeIntelligence.ts");

const appSource = fs.readFileSync(appPath, "utf8");
const routeMapSource = fs.readFileSync(routeMapPath, "utf8");

function collectGuideRules(source, arrayName) {
  const arrayStart = source.indexOf(`const ${arrayName}`);
  if (arrayStart === -1) return [];

  const segment = source.slice(arrayStart);
  const arrayEnd = segment.indexOf("];\n\nexport function");
  const slice = arrayEnd === -1 ? segment : segment.slice(0, arrayEnd);

  const rules = [];
  const regex = /match:\s*"(exact|prefix)"[\s\S]*?path:\s*"([^"]+)"/g;
  let m;
  while ((m = regex.exec(slice)) !== null) {
    rules.push({ match: m[1], path: m[2] });
  }
  return rules;
}

function sectionBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start === -1) return "";
  const rest = source.slice(start);
  const end = rest.indexOf(endToken);
  return end === -1 ? rest : rest.slice(0, end);
}

function collectRoutePaths(section, basePath, includeIndex = false) {
  const paths = new Set();

  if (includeIndex) {
    const hasIndex = /<Route\s+index\s+element=/.test(section);
    if (hasIndex) paths.add(basePath);
  }

  const regex = /<Route\s+path="([^"]+)"/g;
  let m;
  while ((m = regex.exec(section)) !== null) {
    const raw = m[1];
    if (raw === "*") continue;
    if (raw.startsWith("/")) {
      paths.add(raw);
    } else {
      const full = `${basePath}/${raw}`.replace(/\/+/g, "/");
      paths.add(full);
    }
  }

  return [...paths];
}

function hasGuideCoverage(pathname, rules) {
  for (const rule of rules) {
    if (rule.match === "exact" && rule.path === pathname) return true;
    if (rule.match === "prefix" && pathname.startsWith(rule.path)) return true;
  }
  return false;
}

const appRules = collectGuideRules(routeMapSource, "ROUTE_GUIDES");

const toolsSection = sectionBetween(
  appSource,
  "/* ═══ Free Tools (no auth required — server rate-limits) ═══ */",
  "/* ═══ Authenticated App Shell ═══ */",
);
const appSection = sectionBetween(
  appSource,
  "/* ═══ Authenticated App Shell ═══ */",
  "/* ═══ Legacy redirects: old paths → /app/* ═══ */",
);

const toolsPaths = collectRoutePaths(toolsSection, "/tools");
const appPaths = collectRoutePaths(appSection, "/app", true);

// Routes intentionally excluded from guide enforcement.
const excludedPaths = new Set([
  "/tools", // parent container route only
  "/app/audits/:id", // covered by /app/audits/ prefix guide
  "/audit/:id", // legacy redirect route
]);

const requiredPaths = [...new Set([...toolsPaths, ...appPaths])].filter((p) => !excludedPaths.has(p));

const missing = requiredPaths.filter((p) => !hasGuideCoverage(p, appRules));

if (missing.length > 0) {
  console.error("\n[route-intelligence] Missing guide coverage for:");
  for (const item of missing) {
    console.error(`  - ${item}`);
  }
  console.error("\nAdd exact/prefix rules in src/config/routeIntelligence.ts before building.\n");
  process.exit(1);
}

console.log(`[route-intelligence] Coverage OK for ${requiredPaths.length} app/tools routes.`);
