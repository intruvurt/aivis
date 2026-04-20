// @ts-nocheck
import Audit from "../models/Audit.js";
import Website from "../models/Website.js";
import User from "../models/User.js";
import { validationResult } from "express-validator";
import { normalizeEvidenceArray } from "../utils/evidence.js";
import { runForensicPipeline } from "../utils/forensicPipeline.js";
import { checkUsageLimit } from "../utils/pricingUtils.js";

export const createAudit = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400
      });
    }

    const { url } = req.body;
    const userId = req.user.id;

    // Enforce usage limits
    const user = await User.findById(userId);
    const usageCheck = checkUsageLimit(user, "scan");

    if (!usageCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: usageCheck.error || "Usage limit exceeded",
        statusCode: 403
      });
    }

    // Reset usage count if needed
    if (usageCheck.resetNeeded) {
      user.usageCount = 0;
      user.lastResetDate = new Date();
      await user.save();
    }

    let domain;
    try {
      domain = new URL(url).hostname;
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: "Invalid URL format",
        statusCode: 400
      });
    }

    let website = await Website.findOne({ domain, userId });

    if (!website) {
      website = await Website.create({
        url,
        domain,
        userId
      });
    }

    website.lastAuditDate = new Date();
    website.auditCount += 1;
    await website.save();

    // Increment user usage count
    user.usageCount += 1;
    await user.save();

    const audit = await Audit.create({
      websiteId: website._id,
      userId,
      url,
      status: "pending"
    });

    // Run forensic pipeline asynchronously
    setImmediate(async () => {
      try {
        audit.status = "processing";
        await audit.save();

        const startTime = Date.now();
        const pipelineResult = await runForensicPipeline(url);
        const processingTime = Date.now() - startTime;

        if (pipelineResult.success) {
          audit.status = "completed";
          audit.overallScore = pipelineResult.scores.overall;
          audit.categoryScores = pipelineResult.scores;
          audit.visibilityStatus = pipelineResult.visibilityStatus;
          const verificationTimestamp = new Date().toISOString();
          audit.evidence = normalizeEvidenceArray(
            pipelineResult.allEvidence.map(ev => ({
              category: "Forensic Analysis",
              finding: ev.description || "Evidence collected",
              evidence: ev.description || "",
              impact: "medium",
              recommendation: "Review evidence details"
            })),
            {
              auditId: String(audit._id),
              source: 'Forensic Pipeline',
              url,
              verificationTimestamp,
              verifiedBy: 'Forensic Pipeline v1.0',
            }
          );
          audit.risks = pipelineResult.risks;
          audit.recommendations = pipelineResult.recommendations;
          audit.summary = `Forensic analysis completed with overall score of ${pipelineResult.scores.overall}/100. Status: ${pipelineResult.visibilityStatus}.`;
          audit.aiProvider = "Forensic Pipeline v1.0";
          audit.processingTime = processingTime;
        } else {
          audit.status = "failed";
          audit.errorMessage = pipelineResult.errors.join("; ");
        }

        await audit.save();
      } catch (error) {
        console.error("Pipeline execution error:", error);
        audit.status = "failed";
        audit.errorMessage = error.message;
        await audit.save();
      }
    });

    res.status(201).json({
      success: true,
      data: audit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};

export const getAudits = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 10, page = 1 } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const audits = await Audit.find(query)
      .populate("websiteId", "url domain")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Audit.countDocuments(query);

    res.json({
      success: true,
      data: {
        audits,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};

export const getAuditById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const audit = await Audit.findOne({ _id: id, userId })
      .populate("websiteId", "url domain");

    if (!audit) {
      return res.status(404).json({
        success: false,
        error: "Audit not found",
        statusCode: 404
      });
    }

    res.json({
      success: true,
      data: audit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};

export const updateAuditStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, overallScore, visibilityStatus, evidence, summary, aiProvider, processingTime, errorMessage } = req.body;

    const audit = await Audit.findById(id);

    if (!audit) {
      return res.status(404).json({
        success: false,
        error: "Audit not found",
        statusCode: 404
      });
    }

    if (status) audit.status = status;
    if (overallScore !== undefined) audit.overallScore = overallScore;
    if (visibilityStatus) audit.visibilityStatus = visibilityStatus;
    if (evidence) {
      const verificationTimestamp = new Date().toISOString();
      // Normalize evidence to ensure structured format
      audit.evidence = normalizeEvidenceArray(evidence, {
        auditId: String(audit._id),
        model: typeof req.body?.model === 'string' ? req.body.model : undefined,
        provider: typeof aiProvider === 'string' ? aiProvider : undefined,
        source: typeof req.body?.source === 'string' ? req.body.source : undefined,
        sourceModel: typeof req.body?.sourceModel === 'string' ? req.body.sourceModel : undefined,
        url: audit.url,
        verificationTimestamp,
        verifiedBy: typeof aiProvider === 'string' ? aiProvider : undefined,
      });
    }
    if (summary) audit.summary = summary;
    if (aiProvider) audit.aiProvider = aiProvider;
    if (processingTime !== undefined) audit.processingTime = processingTime;
    if (errorMessage) audit.errorMessage = errorMessage;

    await audit.save();

    res.json({
      success: true,
      data: audit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      statusCode: 500
    });
  }
};
