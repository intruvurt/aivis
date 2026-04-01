// client/src/components/ExpandableInsightCard.tsx
import React, { useState } from "react";
import { ChevronDown, ChevronUp, Zap, AlertTriangle, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react";

interface ExpandableInsightCardProps {
  insight: {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: "cyan" | "purple" | "coral";
    priority?: "critical" | "high" | "medium";
    impact?: string;
    detailedAnalysis?: string;
    actionSteps?: string[];
    expectedOutcome?: string;
    timeframe?: string;
    difficulty?: "easy" | "medium" | "hard";
    resources?: { title: string; description: string }[];
  };
}

const ExpandableInsightCard: React.FC<ExpandableInsightCardProps> = ({ insight }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const colorMap = {
    cyan: {
      gradient: "from-white/28/20 to-white/18/5",
      border: "border-white/12/30",
      text: "text-white/85",
      bg: "bg-charcoal/10",
      iconBg: "bg-charcoal/20"
    },
    purple: {
      gradient: "from-white/22/20 to-white/14/5",
      border: "border-white/10",
      text: "text-white/80",
      bg: "bg-charcoal",
      iconBg: "bg-charcoal"
    },
    coral: {
      gradient: "from-white/22/20 to-white/14/5",
      border: "border-white/10",
      text: "text-white/80",
      bg: "bg-charcoal/10",
      iconBg: "bg-charcoal/20"
    }
  };

  const config = colorMap[insight.color];

  const difficultyConfig = {
    easy: { label: "Easy Win", color: "text-emerald-300 bg-emerald-900/50 border-emerald-500/40" },
    medium: { label: "Moderate", color: "text-amber-300 bg-amber-900/50 border-amber-500/40" },
    hard: { label: "Advanced", color: "text-purple-300 bg-purple-900/50 border-purple-500/40" }
  };

  const priorityConfig = {
    critical: { icon: AlertTriangle, label: "Critical", color: "text-red-300" },
    high: { icon: TrendingUp, label: "High Priority", color: "text-orange-300" },
    medium: { icon: Zap, label: "Medium Priority", color: "text-amber-300" }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${config.gradient} border ${config.border} transition-all duration-300 ${
        isExpanded ? "col-span-full" : ""
      }`}
    >
      {/* Card Header - Always Visible */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 cursor-pointer hover:bg-charcoal-light transition-colors"
      >
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center ${config.text} flex-shrink-0`}>
              {insight.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h4 className="font-semibold text-white text-base">{insight.title}</h4>
                {insight.priority && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    insight.priority === 'critical' ? 'bg-red-900/50 border-red-500/40' :
                    insight.priority === 'high' ? 'bg-orange-900/50 border-orange-500/40' :
                    'bg-amber-900/50 border-amber-500/40'
                  } ${priorityConfig[insight.priority].color}`}>
                    {React.createElement(priorityConfig[insight.priority].icon, { className: "w-3 h-3" })}
                    {priorityConfig[insight.priority].label}
                  </span>
                )}
                {insight.difficulty && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${difficultyConfig[insight.difficulty].color}`}>
                    {difficultyConfig[insight.difficulty].label}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/55 leading-relaxed">{insight.description}</p>

              {insight.impact && !isExpanded && (
                <div className="mt-3 flex items-start gap-2 p-2 bg-charcoal rounded-xl">
                  <Zap className="w-4 h-4 text-white/80 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-white/75">
                    <span className="font-semibold">Impact:</span> {insight.impact}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            className={`p-2 rounded-xl ${config.bg} ${config.text} hover:bg-charcoal-light transition-colors flex-shrink-0`}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-6 animate-in fade-in duration-300">
          <div className="h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />

          {/* Detailed Analysis — structured */}
          {insight.detailedAnalysis && (
            <div className="bg-charcoal rounded-xl p-4 border border-white/10">
              <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-white/85" />
                Detailed Analysis
              </h5>
              <div className="space-y-3 text-sm text-white/75 leading-relaxed">
                {insight.detailedAnalysis.split("\n\n").map((block, bIdx) => {
                  const trimmed = block.trim();
                  if (!trimmed) return null;
                  // Check for numbered list lines ("1. Foo")
                  const numberedLines = trimmed.split("\n").filter(l => /^\d+\.\s/.test(l.trim()));
                  if (numberedLines.length >= 2) {
                    // May have a heading line before the list
                    const heading = trimmed.split("\n").find(l => !/^\d+\.\s/.test(l.trim()) && l.trim().length > 0);
                    return (
                      <div key={bIdx}>
                        {heading && <p className="font-semibold text-white/85 mb-1.5">{heading.trim()}</p>}
                        <ol className="space-y-1.5 list-decimal list-inside pl-1">
                          {numberedLines.map((line, i) => (
                            <li key={i} className="text-white/75">{line.replace(/^\d+\.\s*/, "")}</li>
                          ))}
                        </ol>
                      </div>
                    );
                  }
                  // Check for bullet lines ("- Foo" or "• Foo")
                  const bulletLines = trimmed.split("\n").filter(l => /^[-•]\s/.test(l.trim()));
                  if (bulletLines.length >= 2) {
                    const heading = trimmed.split("\n").find(l => !/^[-•]\s/.test(l.trim()) && l.trim().length > 0);
                    return (
                      <div key={bIdx}>
                        {heading && <p className="font-semibold text-white/85 mb-1.5">{heading.trim()}</p>}
                        <ul className="space-y-1.5 list-disc list-inside pl-1">
                          {bulletLines.map((line, i) => (
                            <li key={i} className="text-white/75">{line.replace(/^[-•]\s*/, "")}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  // Regular paragraph — check if it looks like a section heading (short, ends with ":")
                  if (trimmed.length < 80 && trimmed.endsWith(":")) {
                    return <p key={bIdx} className="font-semibold text-white/85 -mb-1">{trimmed}</p>;
                  }
                  return <p key={bIdx}>{trimmed}</p>;
                })}
              </div>
            </div>
          )}

          {/* Impact & Outcome */}
          {(insight.impact || insight.expectedOutcome) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insight.impact && (
                <div className="card-charcoal/20 rounded-xl p-4">
                  <h5 className="font-semibold text-white/80 mb-2 text-sm">Business Impact</h5>
                  <p className="text-sm text-white/75">{insight.impact}</p>
                </div>
              )}
              {insight.expectedOutcome && (
                <div className="card-charcoal/20 rounded-xl p-4">
                  <h5 className="font-semibold text-white/80 mb-2 text-sm">Expected Outcome</h5>
                  <p className="text-sm text-white/75">{insight.expectedOutcome}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Steps */}
          {insight.actionSteps && insight.actionSteps.length > 0 && (
            <div className="bg-charcoal rounded-xl p-4 border border-white/10">
              <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white/80" />
                Step-by-Step Implementation
              </h5>
              <div className="space-y-3">
                {insight.actionSteps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 group">
                    <div className={`w-6 h-6 rounded-full ${config.bg} ${config.text} flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white/75 leading-relaxed group-hover:text-white transition-colors">
                        {step}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources & Tools */}
          {insight.resources && insight.resources.length > 0 && (
            <div className="bg-charcoal rounded-xl p-4 border border-white/10">
              <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-white/80" />
                Helpful Resources
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insight.resources.map((resource, idx) => (
                  <div key={idx} className="bg-charcoal rounded-xl p-3 border border-white/10/20 hover:border-white/10 transition-colors">
                    <h6 className="font-medium text-white text-sm mb-1">{resource.title}</h6>
                    <p className="text-xs text-white/55">{resource.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeframe */}
          {insight.timeframe && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/60">Estimated Implementation Time:</span>
              <span className="font-semibold text-white/85">{insight.timeframe}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpandableInsightCard;
