import React, { useState, useEffect } from "react";
import {
  Star,
  Copy,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import type { CitationEvidence } from "../../../shared/types";
import { getCitationEvidence, curateEvidence, getRevCiteSuggestions } from "../api";
import RevCiteModal from "./RevCiteModal";

interface EvidenceReviewPanelProps {
  testId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EvidenceReviewPanel({ testId, isOpen, onClose }: EvidenceReviewPanelProps) {
  const [evidences, setEvidences] = useState<CitationEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<CitationEvidence | null>(null);
  const [revCiteOpen, setRevCiteOpen] = useState(false);
  const [curatingId, setCuratingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && testId) {
      loadEvidences();
    }
  }, [isOpen, testId]);

  async function loadEvidences() {
    setLoading(true);
    try {
      const response = await getCitationEvidence(testId) as any;
      setEvidences(response.evidences || []);
    } catch (err) {
      console.error("Failed to load evidences:", err);
      toast.error("Failed to load citation evidence");
    } finally {
      setLoading(false);
    }
  }

  async function handleStar(evidence: CitationEvidence) {
    setCuratingId(evidence.id);
    try {
      await curateEvidence(evidence.id, { starred: !evidence.starred });
      setEvidences(
        evidences.map((e) =>
          e.id === evidence.id ? { ...e, starred: !e.starred } : e
        )
      );
      toast.success(evidence.starred ? "Unstarred" : "Starred");
    } catch (err) {
      toast.error("Failed to update evidence");
    } finally {
      setCuratingId(null);
    }
  }

  async function handleCurate(evidence: CitationEvidence) {
    setCuratingId(evidence.id);
    try {
      await curateEvidence(evidence.id, { curated: !evidence.curated });
      setEvidences(
        evidences.map((e) =>
          e.id === evidence.id ? { ...e, curated: !e.curated } : e
        )
      );
      toast.success(evidence.curated ? "Unmarked" : "Marked for implementation");
    } catch (err) {
      toast.error("Failed to update evidence");
    } finally {
      setCuratingId(null);
    }
  }

  async function handleRevCite(evidence: CitationEvidence) {
    setSelectedEvidence(evidence);
    setRevCiteOpen(true);
  }

  function handleCopyExcerpt(excerpt: string) {
    navigator.clipboard.writeText(excerpt);
    toast.success("Excerpt copied");
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-charcoal-deep rounded-2xl border border-white/10 w-full max-w-3xl max-h-[80vh] overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                <CheckCircle2 className="w-5 h-5 text-white/85" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Citation Evidence</h2>
                <p className="text-xs text-white/55">High-confidence mentions to curate and implement</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
            </div>
          ) : evidences.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-white/40 mx-auto mb-2" />
              <p className="text-white/60">No high-confidence evidence found</p>
              <p className="text-xs text-white/40 mt-1">Run citation tests to discover evidence</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evidences.map((evidence) => (
                <div
                  key={evidence.id}
                  className={`rounded-xl border transition-all ${
                    evidence.curated
                      ? "border-white/20 bg-charcoal/40"
                      : "border-white/10 bg-charcoal"
                  } p-4`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                          {(evidence as any).platform}
                        </span>
                        <span className="text-xs text-white/55">Position #{(evidence as any).position}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            Number(evidence.confidence_score) > 0.85
                              ? "bg-white/10 text-white/85"
                              : "bg-white/5 text-white/75"
                          }`}
                        >
                          {(Number(evidence.confidence_score) * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      <p className="text-sm text-white/85 mb-2 line-clamp-2">{(evidence as any).query}</p>
                      <p className="text-xs text-white/65 italic leading-relaxed">
                        "{(evidence as any).excerpt}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleStar(evidence)}
                        disabled={curatingId === evidence.id}
                        className={`p-2 rounded-lg transition-colors ${
                          evidence.starred
                            ? "bg-white/10 text-white/85"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                        title="Star evidence"
                      >
                        <Star className="w-4 h-4" fill={evidence.starred ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => handleCopyExcerpt((evidence as any).excerpt)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors"
                        title="Copy excerpt"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevCite(evidence)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors"
                        title="Rev-Cite suggestions"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                    <button
                      onClick={() => handleCurate(evidence)}
                      disabled={curatingId === evidence.id}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        evidence.curated
                          ? "bg-white/15 text-white/85"
                          : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white/75"
                      }`}
                    >
                      {evidence.curated ? "✓ Marked for Implementation" : "Mark for Implementation"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEvidence && (
        <RevCiteModal
          evidence={selectedEvidence}
          isOpen={revCiteOpen}
          onClose={() => {
            setRevCiteOpen(false);
            setSelectedEvidence(null);
          }}
        />
      )}
    </>
  );
}
