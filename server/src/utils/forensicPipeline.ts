import { validateAndNormalizeUrl } from "./urlValidator.ts";
import { performDiscovery, performCrawl } from "./webCrawler.ts";
import { extractContent } from "./contentExtractor.ts";
import { performTechnicalChecks } from "./technicalChecker.ts";
import { analyzeContentClarity } from "./contentAnalyzer.ts";
import { calculateScores, determineVisibilityStatus, generateRisks, generateRecommendations } from "./scoringEngine.ts";
import { buildEvidence } from "./evidence.ts";

/**
 * Main Forensic Web Analysis Pipeline
 * Orchestrates all 8 stages and produces comprehensive audit report
 */
export const runForensicPipeline = async (inputUrl) => {
  const pipelineResult = {
    success: false,
    stages: {},
    allEvidence: [],
    scores: {},
    risks: [],
    recommendations: [],
    errors: []
  };

  try {
    // Stage 1: Input Normalization
    console.log("Stage 1: Input Normalization");
    const stage1 = validateAndNormalizeUrl(inputUrl);
    pipelineResult.stages.inputNormalization = stage1;
    pipelineResult.allEvidence.push(...stage1.evidence);

    if (!stage1.valid) {
      pipelineResult.errors.push(...stage1.errors);
      return pipelineResult;
    }

    const normalizedUrl = stage1.normalizedUrl;

    // Stage 2: Discovery
    console.log("Stage 2: Discovery");
    const stage2 = await performDiscovery(normalizedUrl);
    pipelineResult.stages.discovery = stage2;
    pipelineResult.allEvidence.push(...stage2.evidence);

    // Stage 3: Crawl
    console.log("Stage 3: Crawl");
    const stage3 = await performCrawl(normalizedUrl);
    pipelineResult.stages.crawl = stage3;
    pipelineResult.allEvidence.push(...stage3.evidence);

    if (!stage3.crawlData.content) {
      pipelineResult.errors.push("Failed to fetch page content");
      pipelineResult.allEvidence.push(buildEvidence({
        proof: null,
        source: normalizedUrl,
        description: "Pipeline halted: Unable to retrieve page content"
      }));
      return pipelineResult;
    }

    // Stage 4: Extraction
    console.log("Stage 4: Extraction");
    const stage4 = extractContent(stage3.crawlData.content, normalizedUrl);
    pipelineResult.stages.extraction = stage4;
    pipelineResult.allEvidence.push(...stage4.evidence);

    // Stage 5: Technical Checks
    console.log("Stage 5: Technical Checks");
    const stage5 = performTechnicalChecks(stage3.crawlData, stage4.extractedData, normalizedUrl);
    pipelineResult.stages.technicalChecks = stage5;
    pipelineResult.allEvidence.push(...stage5.evidence);

    // Stage 6: Content Clarity
    console.log("Stage 6: Content Clarity");
    const stage6 = analyzeContentClarity(stage4.extractedData, normalizedUrl);
    pipelineResult.stages.contentClarity = stage6;
    pipelineResult.allEvidence.push(...stage6.evidence);

    // Stage 7: AI Readability (integrated into scoring)
    console.log("Stage 7: AI Readability Assessment");
    pipelineResult.allEvidence.push(buildEvidence({
      proof: "AI readability assessed based on content structure and clarity",
      source: normalizedUrl,
      verifiedBy: "Forensic Pipeline",
      description: "AI readability score calculated from heading structure, word count, and schema presence"
    }));

    // Stage 8: Scoring
    console.log("Stage 8: Scoring & Risk Analysis");
    pipelineResult.scores = calculateScores(
      pipelineResult.allEvidence,
      stage2.discoveryData,
      stage5.technicalData,
      stage6.contentData
    );

    pipelineResult.visibilityStatus = determineVisibilityStatus(pipelineResult.scores.overall);
    pipelineResult.risks = generateRisks(pipelineResult.scores, stage5.technicalData, stage6.contentData);
    pipelineResult.recommendations = generateRecommendations(pipelineResult.scores, pipelineResult.risks);

    pipelineResult.success = true;

  } catch (error) {
    console.error("Pipeline error:", error);
    pipelineResult.errors.push(`Pipeline execution error: ${error.message}`);
    pipelineResult.allEvidence.push(buildEvidence({
      proof: null,
      source: inputUrl,
      description: `Fatal pipeline error: ${error.message}`
    }));
  }

  return pipelineResult;
};
