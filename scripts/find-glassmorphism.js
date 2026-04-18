#!/usr/bin/env node

/**
 * Find and report glassmorphic artifacts
 * 
 * Run: npm exec -- node scripts/find-glassmorphism.js
 * 
 * This scans all TSX/TS files for:
 * - bg-white/[...] (glassmorphism)
 * - backdrop-blur (blur effects)
 * - mix-blend-mode (blend modes)
 * - Excessive transparency with shadows
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const srcDir = path.join(projectRoot, "client", "src");

const patterns = [
  {
    name: "Glassmorphism (bg-white/)",
    regex: /bg-white\/\[.*?\]/g,
    severity: "critical",
    replacement: "Use solid colors from COLORS.bg instead",
  },
  {
    name: "Blur effects (backdrop-blur)",
    regex: /backdrop-blur-\w+/g,
    severity: "critical",
    replacement: "Remove blur, use solid backgrounds",
  },
  {
    name: "Glassmorphism (bg-black/)",
    regex: /bg-black\/\[.*?\]/g,
    severity: "high",
    replacement: "Use COLORS.bg.primary or bg-slate-950",
  },
  {
    name: "Blend modes",
    regex: /mix-blend-mode/g,
    severity: "high",
    replacement: "Remove blend modes, use solid rendering",
  },
  {
    name: "CSS blur filter",
    regex: /filter:.*blur\(/g,
    severity: "critical",
    replacement: "Remove blur filter",
  },
  {
    name: "Opacity on colored surfaces",
    regex: /bg-\w+-\d+\/\d+/g,
    severity: "medium",
    replacement: "May need review - ensure sufficient contrast",
  },
];

/** @type {Array<{file: string, line: number, pattern: string, match: string, severity: string}>} */
const findings = [];

function scanDirectory(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    // Skip node_modules, dist, build directories
    if (["node_modules", "dist", ".next", "build", ".turbo"].includes(item)) {
      continue;
    }

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (item.endsWith(".tsx") || item.endsWith(".ts")) {
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, lineNumber) => {
    patterns.forEach((pattern) => {
      const matches = line.matchAll(pattern.regex);

      for (const match of matches) {
        findings.push({
          file: path.relative(projectRoot, filePath),
          line: lineNumber + 1,
          pattern: pattern.name,
          match: match[0],
          severity: pattern.severity,
        });
      }
    });
  });
}

// Severity order for sorting
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

console.log("\n🔍 GLASSMORPHISM SCAN");
console.log("=".repeat(80));

scanDirectory(srcDir);

if (findings.length === 0) {
  console.log("\n✅ No glassmorphic artifacts found!\n");
} else {
  // Sort by severity, then by file
  findings.sort((a, b) => {
    const aSeverity = severityOrder[a.severity] || 999;
    const bSeverity = severityOrder[b.severity] || 999;
    const severityDiff = aSeverity - bSeverity;
    if (severityDiff !== 0) return severityDiff;
    return a.file.localeCompare(b.file);
  });

  // Group by file
  const byFile: Record<string, Finding[]> = {};
  findings.forEach((f) => {
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push(f);
  });

  const severityColors = {
    critical: "\x1b[41m",
    high: "\x1b[43m",
    medium: "\x1b[44m",
    low: "\x1b[46m",
  };
  const resetColor = "\x1b[0m";

  Object.entries(byFile).forEach(([file, fileFinding]) => {
    console.log(`\n📄 ${file}`);
    console.log("-".repeat(80));

    fileFinding.forEach((f) => {
      const severityColor = severityColors[f.severity] || resetColor;
      console.log(
        `  ${severityColor}${f.severity.toUpperCase()}${resetColor} (Line ${f.line})`
      );
      console.log(`  • Pattern: ${f.pattern}`);
      console.log(`  • Match: ${f.match}`);
      console.log(`  • Action: ${patterns.find((p) => p.name === f.pattern)?.replacement}`);
      console.log();
    });
  });

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log(`SUMMARY: Found ${findings.length} issues\n`);

  const bySeverity = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  if (bySeverity.critical > 0)
    console.log(`  🔴 CRITICAL: ${bySeverity.critical}`);
  if (bySeverity.high > 0)
    console.log(`  🟠 HIGH: ${bySeverity.high}`);
  if (bySeverity.medium > 0)
    console.log(`  🟡 MEDIUM: ${bySeverity.medium}`);
  if (bySeverity.low > 0)
    console.log(`  🟢 LOW: ${bySeverity.low}`);

  console.log("\n⚠️  ACTION REQUIRED:");
  console.log(
    "1. Review each finding above and replace glassmorphic artifacts"
  );
  console.log(
    "2. Use solid colors from client/src/lib/design/designSystem.ts"
  );
  console.log("3. Run this script again to verify cleanup\n");

  process.exit(bySeverity.critical > 0 ? 1 : 0);
}
