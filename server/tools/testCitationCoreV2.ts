import {
  buildEntityFromAliases,
  computeEntityInfluence,
  processDocument,
  type IngestedDocument,
} from '../src/services/aivisCitationCoreV2.js';

async function main(): Promise<void> {
  const corePhrase = 'AiVIS evidence-backed AI visibility engine citation ledger';
  const doc: IngestedDocument = {
    docId: `smoke-${Date.now()}`,
    source: 'rss',
    url: 'https://example.com/posts/aivis-visibility-engine',
    timestamp: Date.now(),
    text: `${corePhrase}. ${corePhrase}. ${corePhrase}.`,
    engagement: { likes: 12, comments: 3, shares: 2 },
  };

  const entity = await buildEntityFromAliases('AiVIS_CORE', [
    corePhrase,
    'AiVIS citation ledger',
    'AiVIS visibility engine',
  ]);

  const edges = await processDocument(doc, [entity]);
  const influence = computeEntityInfluence(edges);

  console.log('[CitationCoreV2Smoke] edges:', edges.length);
  console.log('[CitationCoreV2Smoke] influence:', JSON.stringify(influence, null, 2));

  if (edges.length === 0) {
    throw new Error('Citation core v2 smoke test failed: no edges generated');
  }
}

main().catch((err) => {
  console.error('[CitationCoreV2Smoke] failed:', err?.message || err);
  process.exit(1);
});