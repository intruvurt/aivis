import { createHash } from 'crypto';
import { scrapeWebsite } from './scraper.js';

type ChangeSnapshot = {
  pageTitle: string;
  metaDescription: string;
  h1Count: number;
  wordCount: number;
  headingCount: number;
  internalLinks: number;
  externalLinks: number;
  scriptCount: number;
  schemaCount: number;
  canonical: string;
  textDigest: string;
};

export type ChangeDetectionResult = {
  shouldAnalyze: boolean;
  fingerprint: string | null;
  snapshot: ChangeSnapshot | null;
  evidence: {
    substantial_change: boolean;
    reason: string;
    changed_signals: string[];
    checked_at: string;
  };
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(',')}}`;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function buildSnapshot(scraped: any): ChangeSnapshot {
  const title = normalizeText(scraped?.domain_intelligence?.page_title || scraped?.page_title || scraped?.title);
  const description = normalizeText(scraped?.domain_intelligence?.page_description || scraped?.meta_description);
  const headings = Array.isArray(scraped?.content_analysis?.headings) ? scraped.content_analysis.headings : [];
  const headingText = headings
    .slice(0, 20)
    .map((item: any) => normalizeText(item?.text || item))
    .filter(Boolean)
    .join(' | ');

  const bodyText = normalizeText(scraped?.content_analysis?.main_content || scraped?.content || scraped?.text || '');
  const digest = createHash('sha256').update(bodyText.slice(0, 12000)).digest('hex');

  return {
    pageTitle: title,
    metaDescription: description,
    h1Count: toNumber(scraped?.technical_signals?.h1_count),
    wordCount: toNumber(scraped?.content_analysis?.word_count),
    headingCount: headings.length,
    internalLinks: toNumber(scraped?.technical_signals?.internal_links),
    externalLinks: toNumber(scraped?.technical_signals?.external_links),
    scriptCount: toNumber(scraped?.technical_signals?.script_count),
    schemaCount: toNumber(scraped?.schema_markup?.json_ld_count) || toArrayLength(scraped?.schema_markup?.types),
    canonical: normalizeText(scraped?.technical_signals?.canonical_url),
    textDigest: createHash('sha256').update(`${digest}|${headingText}`).digest('hex'),
  };
}

function compareSnapshots(previous: ChangeSnapshot | null, next: ChangeSnapshot): string[] {
  if (!previous) {
    return ['initial_baseline'];
  }

  const changes: string[] = [];

  if (previous.pageTitle !== next.pageTitle) changes.push('title_changed');
  if (previous.metaDescription !== next.metaDescription) changes.push('meta_description_changed');
  if (previous.canonical !== next.canonical) changes.push('canonical_changed');
  if (previous.textDigest !== next.textDigest) changes.push('content_changed');
  if (Math.abs(previous.wordCount - next.wordCount) >= 120) changes.push('word_count_shift');
  if (Math.abs(previous.h1Count - next.h1Count) >= 1) changes.push('heading_structure_changed');
  if (Math.abs(previous.schemaCount - next.schemaCount) >= 1) changes.push('schema_changed');
  if (Math.abs(previous.scriptCount - next.scriptCount) >= 2) changes.push('script_bundle_changed');
  if (Math.abs(previous.internalLinks - next.internalLinks) >= 5 || Math.abs(previous.externalLinks - next.externalLinks) >= 3) {
    changes.push('link_graph_changed');
  }

  return changes;
}

export function buildScoreChangeReason(
  previousScore: number | null,
  nextScore: number | null,
  changedSignals: string[],
  source: 'scheduled_rescan' | 'competitor_autopilot'
) {
  if (previousScore === null || nextScore === null) return null;

  const delta = nextScore - previousScore;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const reasonBits = changedSignals.length ? changedSignals : ['no_material_change_detected'];

  return {
    source,
    previous_score: previousScore,
    new_score: nextScore,
    delta,
    direction,
    changed_signals: reasonBits,
    explanation:
      direction === 'flat'
        ? 'Score remained stable; no substantial content/structure shift detected.'
        : `Score moved ${direction} by ${Math.abs(delta)} point(s), likely influenced by: ${reasonBits.join(', ')}.`,
    prevention_guidance:
      direction === 'down'
        ? 'Lock critical templates (title/meta/schema/internal linking) and validate changes in staging before deploy.'
        : 'Maintain current structure and monitor future template/content edits for regressions.',
    generated_at: new Date().toISOString(),
  };
}

export async function detectSubstantialChange(
  url: string,
  previousFingerprint: string | null,
  previousSnapshot: ChangeSnapshot | null
): Promise<ChangeDetectionResult> {
  const checkedAt = new Date().toISOString();

  try {
    const scraped = await scrapeWebsite(url);
    if (!scraped) {
      return {
        shouldAnalyze: false,
        fingerprint: previousFingerprint,
        snapshot: previousSnapshot,
        evidence: {
          substantial_change: false,
          reason: 'scrape_unavailable',
          changed_signals: [],
          checked_at: checkedAt,
        },
      };
    }

    const snapshot = buildSnapshot(scraped);
    const fingerprint = createHash('sha256').update(stableStringify(snapshot)).digest('hex');

    const changedSignals = compareSnapshots(previousSnapshot, snapshot);
    const hasFingerprintChanged = !previousFingerprint || previousFingerprint !== fingerprint;
    const substantialChange = hasFingerprintChanged && changedSignals.length > 0;

    return {
      shouldAnalyze: substantialChange,
      fingerprint,
      snapshot,
      evidence: {
        substantial_change: substantialChange,
        reason: substantialChange ? 'material_content_or_structure_change' : 'no_material_change',
        changed_signals: changedSignals,
        checked_at: checkedAt,
      },
    };
  } catch {
    return {
      shouldAnalyze: true,
      fingerprint: previousFingerprint,
      snapshot: previousSnapshot,
      evidence: {
        substantial_change: true,
        reason: 'change_check_failed_fallback_to_analysis',
        changed_signals: ['change_detector_fallback'],
        checked_at: checkedAt,
      },
    };
  }
}
