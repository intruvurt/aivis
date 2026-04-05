// fix-autofix-pr.mjs - Fix broken find-and-replace: AutoFix PR → scorefix/ScoreFix
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const root = process.cwd();
const extensions = new Set(['.ts', '.tsx', '.json', '.md', '.html']);
const excludeDirs = new Set(['node_modules', 'dist', '.git', 'coverage', '.next']);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (excludeDirs.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else {
      const ext = '.' + entry.split('.').pop();
      if (extensions.has(ext)) results.push(full);
    }
  }
  return results;
}

const replacements = [
  // 1. Doubled compound patterns (AutoScoreFix became AutoAutoFix PR)
  ['_AUTOAutoFix PR', '_AUTOSCOREFIX'],
  ['AutoAutoFix PR', 'AutoScoreFix'],
  ['autoAutoFix PR', 'autoScoreFix'],
  // 2. Component/function names (ScoreFix became AutoFix PR)
  ['AutoFix PRIcon', 'ScoreFixIcon'],
  ['AutoFix PRPage', 'ScoreFixPage'],
  ['AutoFix PRFaq', 'scoreFixFaq'],
  ['AutoFix PRJsonLd', 'scoreFixJsonLd'],
  ['AutoFix PRSeo', 'scoreFixSeo'],
  ['AutoFix PRPercent', 'scorefixPercent'],
  // 3. Constant/env var patterns
  ['STRIPE_AutoFix PR_', 'STRIPE_SCOREFIX_'],
  ['STRIPE_AutoFix PR', 'STRIPE_SCOREFIX'],
  ['AutoFix PR_AI', 'SCOREFIX_AI'],
  ['AutoFix PR_mode', 'scorefix_mode'],
  ['AutoFix PR_monthly', 'scorefix_monthly'],
  ['AutoFix PR_scans', 'scorefix_scans'],
  // 4. Catch-all: remaining AutoFix PR → scorefix
  ['AutoFix PR', 'scorefix'],
];

let fixCount = 0;
for (const file of walk(root)) {
  let content = readFileSync(file, 'utf8');
  if (!content.includes('AutoFix PR')) continue;
  
  const original = content;
  for (const [from, to] of replacements) {
    while (content.includes(from)) {
      content = content.replace(from, to);
    }
  }
  
  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    fixCount++;
    console.log('Fixed:', relative(root, file));
  }
}
console.log(`\n=== Fixed ${fixCount} files ===`);
