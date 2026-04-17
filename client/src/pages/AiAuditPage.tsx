import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSwipeGesture } from "../hooks/useSwipeGesture";
import { Bot, Layers3, Loader2, Play, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import AppPageFrame from "../components/AppPageFrame";
import { fetchAuditRun, fetchAvailableBuildSpecs, runAiAudit } from "../services/aiAuditService";

const defaultPrompts = [
  {
    stage: "Evidence Normalizer",
    prompt:
      "Purpose: turn raw crawler outputs into a normalized evidence ledger the rest of the pipeline can trust. You do not invent. You do not infer. You do not guess.",
  },
  {
    stage: "Draft Analyzer",
    prompt:
      "Purpose: produce the first structured analysis from evidence only. You must produce a complete analysis JSON and stay grounded in evidence.",
  },
  {
    stage: "Critic",
    prompt:
      "Purpose: find holes, hallucinations, and weak evidence binding in the draft analysis. Focus on unsupported claims, schema drift, vague recommendations, and score inflation.",
  },
  {
    stage: "Validator & Finalizer",
    prompt:
      "Purpose: produce final validated JSON suitable for storage and UI. Remove or downgrade any claim not supported by evidence.",
  },
  {
    stage: "UI Explainer",
    prompt:
      "Purpose: generate human-readable report text for display without adding new facts. Stay calm, direct, and non-salesy.",
  },
];

export default function AiAuditPage() {
  const [prompts, setPrompts] = useState(defaultPrompts);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const stageContentRef = useRef<HTMLElement>(null);
  const swipeNext = useCallback(() => setActiveStageIndex((i) => Math.min(i + 1, prompts.length - 1)), [prompts.length]);
  const swipePrev = useCallback(() => setActiveStageIndex((i) => Math.max(i - 1, 0)), []);
  useSwipeGesture(stageContentRef, { onSwipeLeft: swipeNext, onSwipeRight: swipePrev });
  const [blueprint, setBlueprint] = useState("");
  const [buildSpecs, setBuildSpecs] = useState<any[]>([]);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAvailableBuildSpecs()
      .then((items) => setBuildSpecs(Array.isArray(items) ? items : []))
      .catch(() => toast.error("Failed to load build specs"));
  }, []);

  useEffect(() => {
    if (!auditId) return;
    setLoading(true);
    fetchAuditRun(auditId)
      .then((result) => setAuditResult(result))
      .catch(() => toast.error("Failed to fetch audit result"))
      .finally(() => setLoading(false));
  }, [auditId]);

  const activeStage = prompts[activeStageIndex];
  const stageResults = Array.isArray(auditResult?.stageResults) ? auditResult.stageResults : [];
  const currentResult = stageResults[activeStageIndex];
  const outputPreview = useMemo(() => {
    if (!currentResult?.output) return "No output yet for this stage.";
    const raw = JSON.stringify(currentResult.output, null, 2);
    return raw.length > 900 ? `${raw.slice(0, 900)}\n…` : raw;
  }, [currentResult]);

  const updatePrompt = (value: string) => {
    setPrompts((previous) => previous.map((item, index) => (index === activeStageIndex ? { ...item, prompt: value } : item)));
  };

  const handleRunAudit = async () => {
    setLoading(true);
    try {
      const audit = await runAiAudit({ prompts, blueprint });
      setAuditId(audit?._id || null);
      toast.success("Audit started");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || "Could not start audit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppPageFrame
      icon={<Bot className="h-5 w-5 text-orange-300" />}
      title="Multi-stage AI audit"
      subtitle="Internal workspace for prompt-stage editing, build-spec execution, and validated output review."
      maxWidthClass="max-w-[96rem]"
      actions={<div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">{buildSpecs.length} build specs available</div>}
    >
      <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_22rem]">
        <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Stages</p>
          <div className="mt-4 space-y-2">
            {prompts.map((item, index) => (
              <button
                key={item.stage}
                onClick={() => setActiveStageIndex(index)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${index === activeStageIndex ? "border-orange-300/40 bg-orange-400/10 text-white" : "border-white/10 bg-white/[0.02] text-white/64 hover:bg-white/[0.04] hover:text-white"}`}
                type="button"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">Stage {index + 1}</p>
                <p className="mt-1 text-sm font-medium">{item.stage}</p>
              </button>
            ))}
          </div>
        </aside>

        <section ref={stageContentRef} className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Layers3 className="h-4 w-4 text-cyan-200" /> Active stage editor</div>
            <h2 className="mt-3 text-xl font-semibold text-white">{activeStage.stage}</h2>
            <textarea
              value={activeStage.prompt}
              onChange={(event) => updatePrompt(event.target.value)}
              className="mt-4 min-h-[320px] w-full rounded-3xl border border-white/10 bg-[#08101d] px-4 py-4 text-sm leading-7 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400/70"
            />
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Executable build spec blueprint</p>
            <textarea
              value={blueprint}
              onChange={(event) => setBlueprint(event.target.value)}
              className="mt-4 min-h-[180px] w-full rounded-3xl border border-white/10 bg-[#08101d] px-4 py-4 text-sm leading-7 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400/70"
              placeholder="Enter JSON, YAML, or Markdown build instructions."
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleRunAudit}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 disabled:opacity-60"
                type="button"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {loading ? "Running" : "Run audit"}
              </button>
            </div>
          </article>
        </section>

        <aside className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Run status</p>
            <div className="mt-4 space-y-3 text-sm text-white/68">
              <div className="flex items-center justify-between"><span>Audit ID</span><span className="font-mono text-xs text-white/56">{auditId || "pending"}</span></div>
              <div className="flex items-center justify-between"><span>Completed stages</span><span>{stageResults.length}/{prompts.length}</span></div>
              <div className="flex items-center justify-between"><span>Build specs</span><span>{buildSpecs.length}</span></div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Sparkles className="h-4 w-4 text-orange-300" /> Output preview</div>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#08101d] p-4 text-xs leading-6 text-white/68">{outputPreview}</pre>
          </article>
        </aside>
      </div>
    </AppPageFrame>
  );
}
