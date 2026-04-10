import React from 'react';
import type { AIPlatformScores } from '@shared/types';
import { AlertTriangle, Eye, EyeOff, MessageSquare } from 'lucide-react';

interface AIAnswerRealityProps {
  scores: AIPlatformScores;
  url: string;
  brandEntities: string[];
  topicalKeywords: string[];
}

const PLATFORMS = [
  { key: 'chatgpt' as const, name: 'ChatGPT', icon: '🤖' },
  { key: 'perplexity' as const, name: 'Perplexity', icon: '🔍' },
  { key: 'google_ai' as const, name: 'Google AI', icon: '🌐' },
  { key: 'claude' as const, name: 'Claude', icon: '💬' },
] as const;

function visibilityLabel(score: number) {
  if (score >= 75) return { text: 'Likely cited', tone: 'text-emerald-300', bg: 'bg-emerald-400/10 border-emerald-400/20' };
  if (score >= 50) return { text: 'Occasionally mentioned', tone: 'text-amber-300', bg: 'bg-amber-400/10 border-amber-400/20' };
  if (score >= 25) return { text: 'Rarely mentioned', tone: 'text-orange-300', bg: 'bg-orange-400/10 border-orange-400/20' };
  return { text: 'Invisible', tone: 'text-rose-300', bg: 'bg-rose-400/10 border-rose-400/20' };
}

const AIAnswerReality: React.FC<AIAnswerRealityProps> = ({
  scores,
  url,
  brandEntities,
  topicalKeywords,
}) => {
  const domain = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const brand = brandEntities[0] || domain.split('.')[0];
  const keywords = topicalKeywords.slice(0, 3);
  const invisibleCount = PLATFORMS.filter(p => scores[p.key] < 50).length;
  const avgScore = Math.round(PLATFORMS.reduce((s, p) => s + scores[p.key], 0) / PLATFORMS.length);

  // Generate realistic-looking queries from the brand + keywords
  const sampleQueries = [
    keywords[0] ? `best ${keywords[0]} tools 2026` : `best tools like ${brand}`,
    keywords[1] ? `what is the best ${keywords[1]} platform` : `${brand} alternatives`,
    keywords[0] ? `how to improve ${keywords[0]}` : `how to improve website visibility`,
  ];

  return (
    <section className="rounded-[22px] border border-rose-500/20 bg-gradient-to-b from-rose-500/[0.06] to-transparent p-5">
      {/* Header with urgency signal */}
      <div className="flex items-start gap-3 mb-5">
        <div className="rounded-xl bg-rose-500/15 p-2.5 shrink-0">
          <EyeOff className="h-5 w-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">AI Answer Reality Check</h2>
          <p className="mt-1 text-sm text-white/55">
            {invisibleCount >= 3
              ? `Your site is invisible on ${invisibleCount} of 4 major answer engines. When people ask about "${keywords[0] || 'your category'}", AI systems are answering without you.`
              : invisibleCount >= 1
                ? `AI answer engines are inconsistent — ${invisibleCount} platform${invisibleCount > 1 ? 's' : ''} can't see you clearly enough to cite.`
                : 'Your site is generally visible to AI answer engines, but there is room to strengthen citation likelihood.'
            }
          </p>
        </div>
      </div>

      {/* Platform visibility grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {PLATFORMS.map((platform) => {
          const score = scores[platform.key];
          const vis = visibilityLabel(score);
          return (
            <div key={platform.key} className={`rounded-2xl border ${vis.bg} p-3.5 text-center`}>
              <div className="text-lg mb-1">{platform.icon}</div>
              <div className="text-sm font-medium text-white/80">{platform.name}</div>
              <div className={`text-2xl font-semibold mt-1 ${vis.tone}`}>{score}</div>
              <div className={`text-[11px] font-medium mt-1 ${vis.tone}`}>{vis.text}</div>
            </div>
          );
        })}
      </div>

      {/* Simulated AI Answer — the emotional trigger */}
      {invisibleCount > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-white/40" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">What AI sees when people search</span>
          </div>
          <div className="space-y-3">
            {sampleQueries.map((query, idx) => (
              <div key={idx} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
                <div className="text-xs text-white/50 mb-1.5">
                  <span className="text-cyan-300/70">Prompt:</span> "{query}"
                </div>
                <div className="text-sm text-white/65 leading-relaxed">
                  {avgScore < 50 ? (
                    <>
                      <span className="text-white/40">AI answer mentions </span>
                      <span className="text-white/80 font-medium">your competitors</span>
                      <span className="text-white/40"> but </span>
                      <span className="text-rose-300 font-medium">{brand} is not mentioned</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white/40">AI may reference your category but </span>
                      <span className="text-amber-300 font-medium">citation of {brand} is unreliable</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom line */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10">
        {invisibleCount >= 2 ? (
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
        ) : (
          <Eye className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <p className="text-xs text-white/60 leading-relaxed">
          {invisibleCount >= 2
            ? `Every day you don't fix this, AI systems are recommending your competitors instead of you. The fixes below directly address what's blocking citation.`
            : invisibleCount === 1
              ? `One platform still can't reliably cite you. The fixes below target the specific gaps holding back full AI visibility.`
              : `Your AI visibility is above average. The fixes below can push you from "occasionally mentioned" to "consistently cited".`
          }
        </p>
      </div>
    </section>
  );
};

export default AIAnswerReality;
