import { randomUUID } from 'crypto';

type GapIssue = {
  id?: string;
  issue: string;
  severity?: 'low' | 'medium' | 'high';
  page?: string;
  evidenceId?: string;
};

type FixPlanInput = {
  domain: string;
  yourMentionRate?: number;
  competitorMentionRate?: number;
  visibilityScore?: number;
  issues: GapIssue[];
};

type PriorityBand = 'high' | 'medium' | 'low';

type DeployablePatch = {
  file: string;
  action: 'insert' | 'update' | 'create';
  location: string;
  content: string;
};

type PlannedFix = {
  id: string;
  issue: string;
  rootCauses: string[];
  fixType: 'schema' | 'content' | 'structure' | 'authority';
  priority: PriorityBand;
  expectedImpact: 'high' | 'medium' | 'low';
  page: string;
  implementation: string;
  patch: DeployablePatch;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeDomain(input: string): string {
  const text = String(input || '').trim();
  if (!text) return '';
  const urlLike = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    return new URL(urlLike).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function mapRootCause(issue: string): string[] {
  const key = String(issue || '').toLowerCase();
  if (key.includes('not mention') || key.includes('not cited') || key.includes('citation')) {
    return ['missing entity clarity', 'weak topical authority', 'unclear answer structure'];
  }
  if (key.includes('entity')) {
    return ['missing entity schema', 'inconsistent brand naming', 'weak organization signals'];
  }
  if (key.includes('schema') || key.includes('structured')) {
    return ['missing structured data', 'invalid JSON-LD relationships', 'insufficient page-level schema coverage'];
  }
  if (key.includes('title') || key.includes('h1') || key.includes('heading')) {
    return ['weak heading hierarchy', 'intent mismatch', 'poor answer extraction blocks'];
  }
  return ['unclear value proposition', 'weak extractability', 'insufficient trust signals'];
}

function makeFaqBlock(domain: string): string {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `What is ${domain}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `${domain} is a platform focused on AI visibility diagnostics, evidence-backed fixes, and verification loops.`,
          },
        },
      ],
    },
    null,
    2
  );
}

function buildPatch(issue: string, domain: string, page: string): DeployablePatch {
  const normalizedIssue = issue.toLowerCase();
  if (normalizedIssue.includes('schema') || normalizedIssue.includes('entity')) {
    return {
      file: 'public/schema/organization.json',
      action: 'update',
      location: 'head > application/ld+json',
      content: JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: domain,
          applicationCategory: 'SEOApplication',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
        null,
        2
      ),
    };
  }

  if (normalizedIssue.includes('not mention') || normalizedIssue.includes('citation')) {
    return {
      file: 'src/content/answer-blocks.md',
      action: 'insert',
      location: `${page} > first content block`,
      content: `## What this page answers\n\n${domain} helps teams diagnose why AI systems skip their pages, shows evidence, and prioritizes fixes that improve citation likelihood.`,
    };
  }

  return {
    file: 'src/content/faq.generated.json',
    action: 'create',
    location: `${page} > FAQ section`,
    content: makeFaqBlock(domain),
  };
}

function weightSeverity(severity?: string): number {
  if (severity === 'high') return 1;
  if (severity === 'medium') return 0.65;
  return 0.35;
}

export function buildFixPlan(input: FixPlanInput): {
  domain: string;
  visibilityGap: number;
  prioritizedFixes: PlannedFix[];
  nextBestAction: PlannedFix | null;
  faqBlock: string;
} {
  const domain = normalizeDomain(input.domain);
  if (!domain) throw new Error('Invalid domain');

  const yourMentionRate = clamp01(Number(input.yourMentionRate ?? 0));
  const competitorMentionRate = clamp01(Number(input.competitorMentionRate ?? 0.65));
  const visibilityGap = Math.max(0, competitorMentionRate - yourMentionRate);

  const fixes = input.issues.map((entry, index) => {
    const rootCauses = mapRootCause(entry.issue);
    const confidence = 0.78;
    const frequency = 1 - Math.min(0.7, index * 0.08);
    const severityWeight = weightSeverity(entry.severity);
    const impactScore = visibilityGap * confidence * frequency * severityWeight;

    const priority: PriorityBand = impactScore >= 0.42 ? 'high' : impactScore >= 0.2 ? 'medium' : 'low';
    const fixType: PlannedFix['fixType'] = rootCauses.some((c) => c.includes('schema'))
      ? 'schema'
      : rootCauses.some((c) => c.includes('structure'))
        ? 'structure'
        : rootCauses.some((c) => c.includes('authority'))
          ? 'authority'
          : 'content';

    return {
      id: entry.id || randomUUID(),
      issue: entry.issue,
      rootCauses,
      fixType,
      priority,
      expectedImpact: priority,
      page: entry.page || '/pricing',
      implementation: `Resolve ${entry.issue} by addressing ${rootCauses[0]} first, then re-audit to verify movement.`,
      patch: buildPatch(entry.issue, domain, entry.page || '/pricing'),
      _impact: impactScore,
    } as PlannedFix & { _impact: number };
  });

  const prioritizedFixes = fixes.sort((a, b) => b._impact - a._impact).map(({ _impact, ...rest }) => rest);

  return {
    domain,
    visibilityGap,
    prioritizedFixes,
    nextBestAction: prioritizedFixes[0] || null,
    faqBlock: makeFaqBlock(domain),
  };
}

export function verifyFixLoop(beforeScore: number, afterScore: number, changedEvidence = 0) {
  const before = Number(beforeScore || 0);
  const after = Number(afterScore || 0);
  const delta = Number((after - before).toFixed(2));
  return {
    before,
    after,
    delta,
    improved: delta > 0,
    visibilityChange: `${delta >= 0 ? '+' : ''}${delta}%`,
    summary: delta > 0
      ? `Score improved by ${delta} points after applying fixes.`
      : 'No measurable lift yet. Prioritize entity/schema fixes and rerun.',
    changedEvidence,
  };
}
