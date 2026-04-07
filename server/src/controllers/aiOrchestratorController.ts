import { openrouterPrompt, ollamaPrompt } from "../config/aiProviders.js";
import { PROMPT_SCHEMAS, PROMPT_STAGES } from "../constants/promptTemplates.js";
import { AnalysisAuditLogModel } from "../models/AnalysisAuditLog.js";
import { EvidenceModel } from "../models/Evidence.js";
import type { Request, Response } from "express";

export async function runAnalysisPipeline(req: Request, res: Response) {
  const { extractedFacts, evidenceSummaries } = req.body;
  
  try {
    let jsonDraft, critiqueText, finalJson, rawFlow = [];
    let providerErrs = [];

    // Stage 1: Summarizer
    console.log("Stage 1: Summarizer");
    try {
      jsonDraft = await openrouterPrompt(PROMPT_STAGES.summarizer, { extractedFacts, evidenceSummaries });
      rawFlow.push({ stage: "summarizer", provider: "openrouter", output: jsonDraft });
    } catch (e) {
      if (e instanceof Error) {
        console.error("Summarizer OpenRouter failed:", e.message);
        providerErrs.push({ stage: "summarizer", provider: "openrouter", error: e.message });
      } else {
        console.error("Summarizer OpenRouter failed:", e);
        providerErrs.push({ stage: "summarizer", provider: "openrouter", error: String(e) });
      }
      
      try {
        jsonDraft = await ollamaPrompt(PROMPT_STAGES.summarizer, { extractedFacts, evidenceSummaries });
        rawFlow.push({ stage: "summarizer", provider: "ollama", output: jsonDraft });
      } catch (ollamaErr) {
        if (ollamaErr instanceof Error) {
          providerErrs.push({ stage: "summarizer", provider: "ollama", error: ollamaErr.message });
        } else {
          providerErrs.push({ stage: "summarizer", provider: "ollama", error: String(ollamaErr) });
        }
        throw new Error("Both providers failed at summarizer stage");
      }
    }

    // Stage 2: Critic
    console.log("Stage 2: Critic");
    try {
      critiqueText = await openrouterPrompt(PROMPT_STAGES.critic, { draftJson: jsonDraft, evidenceSummaries });
      rawFlow.push({ stage: "critic", provider: "openrouter", output: critiqueText });
    } catch (e) {
      if (e instanceof Error) {
        console.error("Critic OpenRouter failed:", e.message);
        providerErrs.push({ stage: "critic", provider: "openrouter", error: e.message });
      } else {
        console.error("Critic OpenRouter failed:", e);
        providerErrs.push({ stage: "critic", provider: "openrouter", error: String(e) });
      }
      
      try {
        critiqueText = await ollamaPrompt(PROMPT_STAGES.critic, { draftJson: jsonDraft, evidenceSummaries });
        rawFlow.push({ stage: "critic", provider: "ollama", output: critiqueText });
      } catch (ollamaErr) {
        if (ollamaErr instanceof Error) {
          providerErrs.push({ stage: "critic", provider: "ollama", error: ollamaErr.message });
        } else {
          providerErrs.push({ stage: "critic", provider: "ollama", error: String(ollamaErr) });
        }
        // Critic is optional, continue without it
        critiqueText = "No critique available";
      }
    }

    // Stage 3: Validator
    console.log("Stage 3: Validator");
    try {
      finalJson = await openrouterPrompt(PROMPT_STAGES.validator, { 
        facts: extractedFacts, 
        draftJson: jsonDraft, 
        critique: critiqueText 
      });
      rawFlow.push({ stage: "validator", provider: "openrouter", output: finalJson });
    } catch (e) {
      if (e instanceof Error) {
        console.error("Validator OpenRouter failed:", e.message);
        providerErrs.push({ stage: "validator", provider: "openrouter", error: e.message });
      } else {
        console.error("Validator OpenRouter failed:", e);
        providerErrs.push({ stage: "validator", provider: "openrouter", error: String(e) });
      }
      
      try {
        finalJson = await ollamaPrompt(PROMPT_STAGES.validator, { 
          facts: extractedFacts, 
          draftJson: jsonDraft, 
          critique: critiqueText 
        });
        rawFlow.push({ stage: "validator", provider: "ollama", output: finalJson });
      } catch (ollamaErr) {
        if (ollamaErr instanceof Error) {
          providerErrs.push({ stage: "validator", provider: "ollama", error: ollamaErr.message });
        } else {
          providerErrs.push({ stage: "validator", provider: "ollama", error: String(ollamaErr) });
        }
        throw new Error("Both providers failed at validator stage");
      }
    }

    // Stage 4: Optional explainer
    console.log("Stage 4: Explainer (optional)");
    let explanation = null;
    try {
      explanation = await openrouterPrompt(PROMPT_STAGES.explainer, { finalJson });
      rawFlow.push({ stage: "explainer", provider: "openrouter", output: explanation });
    } catch (e) {
      if (e instanceof Error) {
        console.error("Explainer failed:", e.message);
        providerErrs.push({ stage: "explainer", provider: "openrouter", error: e.message });
      } else {
        console.error("Explainer failed:", e);
        providerErrs.push({ stage: "explainer", provider: "openrouter", error: String(e) });
      }
      // Explainer is optional, continue without it
    }

    // Strict validation
    if (!finalJson.evidenceList || !Array.isArray(finalJson.evidenceList)) {
      throw new Error("Missing or invalid evidenceList in response");
    }
    
    if (finalJson.evidenceList.some((ev: any) => !ev.id)) {
      throw new Error("Missing evidence IDs in response");
    }
    
    if (!finalJson.scoreBreakdown || typeof finalJson.scoreBreakdown !== "object") {
      throw new Error("Missing or invalid scoreBreakdown in response");
    }

    // Attach provider errors if any
    if (providerErrs.length > 0) {
      finalJson.providerErrors = providerErrs;
    }

    // Add explanation if available
    if (explanation) {
      finalJson.explanation = explanation;
    }

    // Audit: persist inputs, rawFlow, reviewed outputs
    await AnalysisAuditLogModel.create({
      input: req.body,
      output: finalJson,
      flow: rawFlow,
      // createdAt: new Date() // removed, not in type
    });

    res.json({
      success: true,
      data: finalJson
    });
  } catch (error) {
    console.error("Analysis pipeline error:", error);
    
    // Partial/failure reporting
    await AnalysisAuditLogModel.create({
      input: req.body,
      error: (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error),
      // createdAt: new Date() // removed, not in type
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Analysis failed. Please try again.',
      statusCode: 500
    });
  }
}
