import { Audit } from "../models/Audit.js";
import type { Request, Response } from "express";
import { analyzeWithFailover } from "../config/aiProviders.js";
import { normalizeEvidenceArray } from "../utils/evidence.js";

export const analyzeWebsite = async (req: Request, res: Response) => {
  try {
    const { auditId } = req.body;
    const userId = req.user.id;

    const audit = await Audit.findOne({ _id: auditId, userId });

    if (!audit) {
      return res.status(404).json({
        success: false,
        error: "Audit not found",
        statusCode: 404
      });
    }

    audit.status = "processing";
    await audit.save();

    const startTime = Date.now();

    const prompt = `Analyze the following website for AI search visibility: ${audit.url}

Please provide a comprehensive analysis with the following structure:

1. Overall Visibility Score (0-100)
2. Visibility Status (visible/partially-visible/invisible)
3. Evidence-based findings in these categories:
   - Content Quality & Structure
   - Technical SEO for AI
   - Semantic Markup & Schema
   - Mobile & Performance
   - Authority & Trust Signals

For each finding, provide:
- Category
- Specific finding
- Verifiable evidence
- Impact level (high/medium/low)
- Actionable recommendation

Format your response as JSON with this structure:
{
  "overallScore": number,
  "visibilityStatus": "visible|partially-visible|invisible",
  "summary": "brief summary",
  "evidence": [
    {
      "category": "string",
      "finding": "string",
      "evidence": "string",
      "impact": "high|medium|low",
      "recommendation": "string"
    }
  ]
}`;

    const aiResponse = await analyzeWithFailover(prompt);

    const processingTime = Date.now() - startTime;

    let analysisData;
    try {
      const jsonMatch = aiResponse.data.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      analysisData = {
        overallScore: 50,
        visibilityStatus: "unknown",
        summary: aiResponse.data.substring(0, 500),
        evidence: [
          {
            category: "Analysis",
            finding: "AI analysis completed",
            evidence: aiResponse.data.substring(0, 200),
            impact: "medium",
            recommendation: "Review the full analysis for detailed insights"
          }
        ]
      };
    }

    const verificationTimestamp = new Date().toISOString();

    // Normalize evidence array to include structured evidence objects
    const normalizedEvidence = normalizeEvidenceArray(analysisData.evidence || [], {
      auditId: String(audit._id),
      provider: typeof aiResponse?.provider === 'string' ? aiResponse.provider : undefined,
      model: typeof aiResponse?.model === 'string' ? aiResponse.model : undefined,
      source: 'AI Analysis',
      url: audit.url,
      verificationTimestamp,
    });

    audit.status = "completed";
    audit.overallScore = analysisData.overallScore;
    audit.visibilityStatus = analysisData.visibilityStatus;
    audit.summary = analysisData.summary;
    audit.evidence = normalizedEvidence;
    audit.aiProvider = aiResponse.provider;
    audit.processingTime = processingTime;

    await audit.save();

    res.json({
      success: true,
      data: audit
    });
  } catch (error) {
    const audit = await Audit.findById(req.body.auditId);
    if (audit) {
      audit.status = "failed";
      audit.errorMessage = error.message;
      await audit.save();
    }

    res.status(500).json({
      success: false,
      error: 'Analysis failed. Please try again.',
      statusCode: 500
    });
  }
};
