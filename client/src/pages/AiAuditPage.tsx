import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Bot, Layers3, Play } from "lucide-react";
import AppPageFrame from "../components/AppPageFrame";
import { runAiAudit, fetchAvailableBuildSpecs, fetchAuditRun } from "../services/aiAuditService";

const defaultPrompts = [
  {
    stage: "Evidence Normalizer",
    prompt: "Purpose: turn raw crawler outputs into a normalized evidence ledger the rest of the pipeline can trust. You are the Evidence Normalizer. You do not analyze opinions. You only normalize and tag evidence. You must not invent. You must not infer. You must not guess."
  },
  { 
    stage: "Draft Analyzer", 
    prompt: "Purpose: produce the first structured analysis from evidence only. You are the Draft Analyzer for an AI search visibility audit platform. You must produce a complete analysis JSON. You are forbidden from inventing facts." 
  },
  { 
    stage: "Critic", 
    prompt: "Purpose: find holes hallucinations and weak evidence binding in the draft analysis. You are the Critic. You do not rewrite the full report. You aggressively check for unsupported claims missing evidence_refs schema violations vague recommendations and score inflation." 
  },
  { 
    stage: "Validator & Finalizer", 
    prompt: "Purpose: produce final validated JSON suitable for storage and UI. You are the Validator and Finalizer. You must output final analysis JSON only. You must remove or downgrade any claim not supported by evidence." 
  },
  { 
    stage: "UI Explainer", 
    prompt: "Purpose: generate human readable report text for display without adding new facts. You are the UI Explainer. You receive the final validated JSON only. You must produce a structured explanation for the UI that is calm direct and non-salesy." 
  }
];

export default function AiAuditPage() {
  const [prompts, setPrompts] = useState(defaultPrompts);
  const [blueprint, setBlueprint] = useState("");
  const [buildSpecs, setBuildSpecs] = useState([]);
  const [auditId, setAuditId] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAvailableBuildSpecs()
      .then(setBuildSpecs)
      .catch(() => toast.error("Failed to load build specs"));
  }, []);

  const handlePromptChange = (i, value) => {
    const update = [...prompts];
    update[i].prompt = value;
    setPrompts(update);
  };

  const handleRunAudit = async () => {
    setLoading(true);
    try {
      const audit = await runAiAudit({ prompts, blueprint });
      setAuditId(audit._id);
      toast.success("Audit started!");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Could not start audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auditId) return;
    setLoading(true);
    fetchAuditRun(auditId).then(res => {
      setAuditResult(res);
    }).catch(() => toast.error("Failed to fetch audit result")).finally(() => setLoading(false));
  }, [auditId]);

  return (
    <AppPageFrame
      icon={<Bot className="h-5 w-5 text-cyan-300" />}
      title="Multi-Stage AI Audit"
      subtitle="Configure the internal reflection pipeline, build-spec blueprint, and stage output review in a usable workspace instead of a raw prototype panel."
      maxWidthClass="max-w-5xl"
      actions={
        <div className="rounded-full border border-white/10 bg-charcoal-light px-3 py-1 text-xs text-white/70">
          {buildSpecs.length} build specs available
        </div>
      }
    >
      <motion.div
        id="src_pages_aiauditpage_main"
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <div className="mb-4 flex items-center gap-2 text-white/75">
            <Layers3 className="h-4 w-4 text-cyan-300" />
            <p className="text-sm leading-relaxed text-white/70">
              Tune each reflection stage, then execute the pipeline against a single build-spec blueprint. The output below stays inside the same review surface so the page reads like a product workflow, not an internal debug dump.
            </p>
          </div>

          <div id="src_pages_aiauditpage_prompts" className="space-y-4">
            {prompts.map((p, i) => (
              <div key={i} id={`src_pages_aiauditpage_prompt_${i}`} className="rounded-xl border border-white/10 bg-charcoal-light/40 p-4">
                <label id="src_pages_AiAuditPage_wkz6" className="mb-2 block text-sm font-semibold text-white">Stage: {p.stage}</label>
                <textarea
                  className="min-h-[120px] w-full rounded-xl border border-white/10 bg-charcoal px-4 py-3 text-sm text-white placeholder:text-white/30"
                  value={p.prompt}
                  onChange={e => handlePromptChange(i, e.target.value)}
                  id={`src_pages_aiauditpage_${i}pmt`}
                />
              </div>
            ))}
          </div>
        </div>

        <div id="src_pages_aiauditpage_blueprint" className="rounded-2xl border border-white/10 bg-charcoal p-5">
          <label id="src_pages_AiAuditPage_gd8z" className="mb-2 block text-sm font-semibold text-white">Executable Build Spec Blueprint</label>
          <textarea
            className="min-h-[120px] w-full rounded-xl border border-white/10 bg-charcoal-light/40 px-4 py-3 text-sm text-white placeholder:text-white/30"
            value={blueprint}
            onChange={e => setBlueprint(e.target.value)}
            id="src_pages_aiauditpage_blpt"
            placeholder="Enter your build spec blueprint (JSON, YAML, or Markdown)"
          />
        </div>

        <div id="src_pages_aiauditpage_actions" className="flex">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            onClick={handleRunAudit}
            disabled={loading}
            id="src_pages_aiauditpage_runbtn"
          >
            <Play className="h-4 w-4" />
            {loading ? "Running..." : "Run Audit"}
          </button>
        </div>

        {auditResult && (
          <div id="src_pages_aiauditpage_results" className="rounded-2xl border border-white/10 bg-charcoal p-5">
            <h2 id="src_pages_AiAuditPage_4xid" className="mb-4 text-lg font-semibold text-white">Audit Pipeline Results</h2>
            <div className="space-y-3">
              {auditResult.stageResults.map((stage, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-charcoal-light/40 p-4" id={`src_pages_aiauditpage_stage_${idx}`}>
                  <div id="src_pages_AiAuditPage_f3os" className="text-sm font-semibold text-white">Stage: {stage.name}</div>
                  <pre id="src_pages_AiAuditPage_de4g" className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#0a0f1d] p-3 text-xs text-gray-300">
                    {JSON.stringify(stage.output, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AppPageFrame>
  );
}
