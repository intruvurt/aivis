import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Newspaper } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../lib/seoSchema";

const PRESS_STRUCTURED_DATA = [
  buildWebPageSchema({
    path: "/press",
    name: "Press – AiVIS AI Visibility Platform",
    description:
      "Press resources, media coverage, and public milestones for AiVIS by Intruvurt Labs.",
  }),
  buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Press", path: "/press" },
  ]),
];

const MILESTONES = [
  {
    date: "2026",
    title: "TechCrunch Startup Battlefield — Top 200 Nominee",
    description:
      "AiVIS selected as a Top 200 nominee for TechCrunch Startup Battlefield 2026, competing in the AI/ML category for AI visibility intelligence and citation-readiness auditing.",
  },
  {
    date: "Dec 2025",
    title: "Platform Launch",
    description:
      "AiVIS launched as the first evidence-backed AI visibility auditing platform with real crawl data, evidence ledger, and multi-model triple-check scoring.",
  },
];

const MEDIA_KIT = [
  { label: "Company Name", value: "Intruvurt Labs" },
  { label: "Product", value: "AiVIS — AI Visibility Intelligence Audits" },
  { label: "Founded", value: "December 2025" },
  { label: "Headquarters", value: "United States" },
  { label: "Category", value: "AI Visibility, AEO, Citation Readiness" },
  { label: "Press Contact", value: "hello@aivis.biz" },
];

export default function PressPage() {
  const navigate = useNavigate();

  usePageMeta({
    title: "Press & Media",
    description:
      "Press resources, media coverage, and public milestones for AiVIS by Intruvurt Labs. TechCrunch Startup Battlefield Top 200 nominee.",
    path: "/press",
    ogTitle: "Press – AiVIS by Intruvurt Labs",
    ogDescription:
      "Press resources and public milestones for AiVIS, the AI visibility auditing platform. TechCrunch Startup Battlefield Top 200 nominee.",
    structuredData: PRESS_STRUCTURED_DATA,
  });

  return (
    <>
      <header className="border-b border-white/10 bg-charcoal-deep sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="rounded-full p-2 transition-colors hover:bg-white/8"
            type="button"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <Newspaper className="h-5 w-5 text-orange-400" />
              Press &amp; Media
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Coverage, milestones, and media resources
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
        {/* Hero */}
        <section className="px-4 py-16 md:py-20 max-w-6xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300/90 text-xs font-semibold tracking-wide mb-6">
            Top 200 · TechCrunch Startup Battlefield 2026
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            AiVIS in the Press
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            The first evidence-backed AI visibility auditing platform — built
            for agencies, developers, and operators who need proof, not
            dashboards.
          </p>
        </section>

        {/* Milestones */}
        <section className="px-4 py-12 max-w-4xl mx-auto">
          <h3 className="text-2xl brand-title mb-8">Milestones</h3>
          <div className="space-y-6">
            {MILESTONES.map((m) => (
              <div
                key={m.title}
                className="rounded-xl border border-white/10 bg-white/5 p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/80 mb-2">
                  {m.date}
                </p>
                <h4 className="text-lg font-bold text-white/90 mb-2">
                  {m.title}
                </h4>
                <p className="text-white/65 leading-relaxed">
                  {m.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Media Kit */}
        <section className="px-4 py-12 max-w-4xl mx-auto">
          <h3 className="text-2xl brand-title mb-8">Media Kit</h3>
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {MEDIA_KIT.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-6 py-3 font-semibold text-white/70 w-1/3">
                      {row.label}
                    </td>
                    <td className="px-6 py-3 text-white/90">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 text-sm text-[#6A911E] hover:text-[#5A8018]"
            >
              About Intruvurt Labs
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/methodology"
              className="inline-flex items-center gap-1.5 text-sm text-[#6A911E] hover:text-[#5A8018]"
            >
              Claims &amp; Methodology
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section className="px-4 py-12 max-w-4xl mx-auto text-center">
          <p className="text-white/55 text-sm">
            For press inquiries, contact{" "}
            <a
              href="mailto:hello@aivis.biz"
              className="text-[#6A911E] hover:text-[#5A8018]"
            >
              hello@aivis.biz
            </a>
          </p>
        </section>
      </div>
    </>
  );
}
