import React, { useState, useEffect } from "react";
import { Copy, Loader2, AlertCircle, TrendingDown } from "lucide-react";
import ModalPanel from "./ModalPanel";
import toast from "react-hot-toast";
import type { CitationEvidence, RevCiteSuggestion } from "../../../shared/types";
import { getRevCiteSuggestions } from "../api";

interface RevCiteModalProps {
  evidence: CitationEvidence;
  isOpen: boolean;
  onClose: () => void;
}

export default function RevCiteModal({ evidence, isOpen, onClose }: RevCiteModalProps) {
  const [suggestions, setSuggestions] = useState<RevCiteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && evidence) {
      loadSuggestions();
    }
  }, [isOpen, evidence]);

  async function loadSuggestions() {
    setLoading(true);
    setError(null);
    try {
      const response = await getRevCiteSuggestions(evidence.id) as any;
      setSuggestions(response.suggestions || []);
    } catch (err) {
      console.error("Failed to load Rev-Cite suggestions:", err);
      setError("Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyQuery(query: string) {
    navigator.clipboard.writeText(query);
    toast.success("Query copied");
  }

  if (!isOpen) return null;

  return (
    <ModalPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Rev-Cite Alternatives"
      subtitle={`Find less competitive search criteria with similar intent to: "${(evidence as any).query}"`}
      icon={<TrendingDown className="w-5 h-5" />}
      maxWidthClass="max-w-2xl"
      zIndexClass="z-[220]"
    >

        {/* Original Query */}
        <div className="mb-6 p-4 rounded-xl border border-white/10 bg-charcoal/50">
          <p className="text-xs text-white/55 uppercase tracking-wide mb-2">Original Query</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/85 font-medium">{(evidence as any).query}</p>
            <button
              onClick={() => handleCopyQuery((evidence as any).query)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors flex-shrink-0"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <p className="text-xs text-white/55 uppercase tracking-wide mb-3">Alternative Phrasings</p>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-white/10 bg-charcoal text-white/60">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-white/55">No suggestions available</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 transition-all ${
                    suggestion.expected_competition === "low"
                      ? "border-white/15 bg-charcoal/40"
                      : "border-white/10 bg-charcoal"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white/85">{suggestion.query}</p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${
                            suggestion.expected_competition === "low"
                              ? "bg-white/10 text-white/85"
                              : suggestion.expected_competition === "medium"
                              ? "bg-white/5 text-white/75"
                              : "bg-white/5 text-white/60"
                          }`}
                        >
                          {suggestion.expected_competition} competition
                        </span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{suggestion.rationale}</p>
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[10px] text-white/50">Intent alignment:</span>
                        <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white/50 transition-all"
                            style={{ width: `${suggestion.intent_alignment * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/50">{(suggestion.intent_alignment * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopyQuery(suggestion.query)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors flex-shrink-0"
                      title="Copy query suggestion"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-white/60">
            💡 <span className="font-medium">Tip:</span> Test these alternative queries to discover less competitive citation opportunities with the same customer intent.
          </p>
        </div>
    </ModalPanel>
  );
}
