import { usePageMeta } from "../hooks/usePageMeta";
import changelog, { type ChangelogEntry } from "../data/changelog";
import {
  Wrench,
  Sparkles,
  Bug,
  Zap,
  DollarSign,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import PublicPageFrame from "../components/PublicPageFrame";

const categoryMeta: Record<
  ChangelogEntry["category"],
  { label: string; color: string; Icon: React.ElementType }
> = {
  infrastructure: { label: "Infrastructure", color: "bg-orange-500/15 text-orange-300 border-orange-500/20", Icon: Wrench },
  feature:        { label: "Feature",        color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",       Icon: Sparkles },
  fix:            { label: "Bug Fix",        color: "bg-red-500/15 text-red-300 border-red-500/20",          Icon: Bug },
  improvement:    { label: "Improvement",    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20", Icon: Zap },
  pricing:        { label: "Pricing",        color: "bg-violet-500/15 text-violet-300 border-violet-500/20", Icon: DollarSign },
  security:       { label: "Security",       color: "bg-amber-500/15 text-amber-300 border-amber-500/20",    Icon: ShieldCheck },
};

const audienceLabel: Record<ChangelogEntry["audience"], string> = {
  all: "Everyone",
  free: "Free-tier users",
  paid: "Paid plans",
  signal: "Signal plan",
  alignment: "Alignment plan",
};

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ChangelogPage() {
  usePageMeta({
    title: "Changelog",
    description:
      "A permanent ledger of every update, fix, and improvement shipped to AiVIS.biz.",
    path: "/changelog",
  });

  return (
    <PublicPageFrame icon={ScrollText} title="Changelog" subtitle="A permanent ledger of every update, fix, and improvement we ship. Transparency is non-negotiable." maxWidthClass="max-w-3xl">
      <ol className="relative border-l border-white/10 pl-6 space-y-10">
          {changelog.map((entry, i) => {
            const meta = categoryMeta[entry.category];
            return (
              <li key={i} className={`relative ${entry.highlight ? 'pl-4 border-l-2 border-amber-400/50 -ml-1' : ''}`}>
                {/* Dot on timeline */}
                <span className={`absolute -left-[33px] top-1.5 w-3 h-3 rounded-full bg-charcoal border-2 ${entry.highlight ? 'border-amber-400' : 'border-cyan-500'}`} />

                {/* Date + category */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <time className="text-xs text-white/45 font-mono">
                    {formatDate(entry.date)}
                  </time>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.color}`}
                  >
                    <meta.Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                  {entry.highlight && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
                      HIGH VALUE
                    </span>
                  )}
                  <span className="text-[11px] text-white/35">
                    {audienceLabel[entry.audience]}
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-lg font-semibold text-white/90">
                  {entry.title}
                </h2>

                {/* Description */}
                <p className="mt-1 text-sm text-white/65 leading-relaxed">
                  {entry.description}
                </p>

                {/* Why it matters */}
                <p className="mt-2 text-sm text-white/50 italic">
                  Why it matters: {entry.why}
                </p>

                {/* Action needed */}
                {entry.action && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-sm text-cyan-200">
                    <strong>Action needed:</strong> {entry.action}
                  </div>
                )}
              </li>
            );
          })}
      </ol>
    </PublicPageFrame>
  );
}
