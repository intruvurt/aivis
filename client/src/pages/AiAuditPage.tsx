import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
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
    <motion.div 
      id="src_pages_aiauditpage_main" 
      className="p-6 max-w-3xl mx-auto space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 id="src_pages_aiau ditpage_h1" className="text-2xl font-bold text-white">Multi-Stage AI Reflection-x3 Audit System</h1>
      <p id="src_pages_aiauditpage_desc" className="text-gray-300">
        Configure an AI reflection triple check for factual and ai searchability for extreme visibility; AiVis is a Ai-structured quality and visibility audit pipeline using custom system prompts and a single executable build spec blueprint, with cross referecing/debates for best output from multi-model orhestration.
      </p>
      <div id="src_pages_aiauditpage_prompts" className="space-y-4">
        {prompts.map((p, i) => (
          <div key={i} id={`src_pages_aiauditpage_prompt_${i}`}>
            <label id="src_pages_AiAuditPage_wkz6" className="font-semibold text-white">Stage: {p.stage}</label>
            <textarea
              className="w-full border border-gray-600 bg-gray-800 text-white rounded min-h-[88px] p-2 my-1 text-sm"
              value={p.prompt}
              onChange={e => handlePromptChange(i, e.target.value)}
              id={`src_pages_aiauditpage_${i}pmt`}
            />
          </div>
        ))}
      </div>
      <div id="src_pages_aiauditpage_blueprint">
        <label id="src_pages_AiAuditPage_gd8z" className="font-semibold text-white">Executable Build Spec Blueprint</label>
        <textarea
          className="w-full border border-gray-600 bg-gray-800 text-white rounded min-h-[72px] p-2 my-1 text-sm"
          value={blueprint}
          onChange={e => setBlueprint(e.target.value)}
          id="src_pages_aiauditpage_blpt"
          placeholder="Enter your build spec blueprint (JSON, YAML, or Markdown)"
        />
      </div>
      <div id="src_pages_aiauditpage_actions" className="flex space-x-2">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded disabled:opacity-50"
          onClick={handleRunAudit}
          disabled={loading}
          id="src_pages_aiauditpage_runbtn"
        >
          {loading ? "Running..." : "Run Audit"}
        </button>
      </div>
      {auditResult && (
        <div id="src_pages_aiauditpage_results" className="mt-6">
          <h2 id="src_pages_AiAuditPage_4xid" className="font-bold mb-2 text-white">Audit Pipeline - Rx3 Results</h2>
          {auditResult.stageResults.map((stage, idx) => (
            <div key={idx} className="border border-gray-600 rounded mb-3 p-3 bg-gray-800" id={`src_pages_aiauditpage_stage_${idx}`}>
              <div id="src_pages_AiAuditPage_f3os" className="text-sm font-semibold text-white">Stage: {stage.name}</div>
              <pre id="src_pages_AiAuditPage_de4g" className="overflow-x-auto text-xs bg-gray-900 border border-gray-700 rounded p-2 mt-2 text-gray-300">
                {JSON.stringify(stage.output, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
      <footer id="src_pages_aiauditpage_footer" className="text-xs text-center mt-12 text-gray-400">
        © {new Date().getFullYear()} AI Visibility for Business. https://AiVis.biz All rights reserved. Powered by Intruvurt Labs
      </footer>
    </motion.div>
  );
}
