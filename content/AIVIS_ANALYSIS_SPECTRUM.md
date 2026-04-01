# AiVIS analysis spectrum located

Core audit orchestration
- `src/services/audit/auditOrchestrator.ts`
- `src/services/audit/contentAnalysis.ts`
- `src/services/audit/entityClarity.ts`
- `src/services/audit/technicalAnalysis.ts` *(added)*
- `src/services/audit/privateExposureLite.ts` *(added)*
- `shared/types/audit.ts`

Existing adjacent analysis engines already present in repo
- `src/services/engines/engineComposer.ts`
- `src/services/engines/citationEngine.ts`
- `src/services/engines/trustEngine.ts`
- `src/services/engines/entityEngine.ts`
- `src/services/privateExposureScanService.ts`
- `src/services/citationTester.ts`
- `src/services/citationRankingEngine.ts`
- `src/services/citationStrength.ts`
- `src/services/citationParityAudit.ts`
- `src/services/llmReadabilityValidator.ts`
- `src/services/seoRichnessValidator.ts`
- `src/lib/utils/contentExtractor.ts`
- `src/lib/utils/contentAnalyzer.ts`
- `src/lib/utils/technicalChecker.ts`
- `src/lib/utils/scoringEngine.ts`
- `src/lib/utils/webCrawler.ts`
- `src/controllers/intelligenceAnalyzeController.ts`

What was enhanced
- Replaced thin `contentAnalysis` pass with a real static-content audit module that emits:
  - findings
  - evidence
  - fixes
  - completeness
  - confidence
  - constraints
  - richer subscores
- Replaced thin `entityClarity` pass with a stronger trust/entity audit module.
- Added `technicalAnalysis.ts` for non-stubbed page-integrity checks.
- Added `privateExposureLite.ts` for passive secret/route/source-map/client leakage checks.
- Upgraded `auditOrchestrator.ts` to compose real module outputs instead of pass-through placeholders.
- Expanded `shared/types/audit.ts` to support richer evidence, fixes, completeness, and confidence.

Important honesty note
These changes make the static audit layer more real and evidence-backed, but they still do **not** replace:
- live rendered DOM crawling
- header-level fetch analysis
- robots/sitemap retrieval
- query-set citation benchmarking
- external authority graphing
- authenticated/private route verification

Those remain separate layers and should be wired into the main `/api/analyze` pipeline.
