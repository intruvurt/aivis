import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Globe, Newspaper } from "lucide-react";
import PublicPageFrame from "../components/PublicPageFrame";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildWebPageSchema, buildBreadcrumbSchema, buildOrganizationSchema } from "../lib/seoSchema";

const PRESS_STRUCTURED_DATA = [
  buildOrganizationSchema(),
  buildWebPageSchema({
    path: "/press",
    name: "Press – AiVIS AI Visibility Audit",
    description:
      "Press resources, media coverage, and public milestones for AiVIS.",
  }),
  buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Press", path: "/press" },
  ]),
];

const FEATURED_POSTS = [
  {
    date: "Apr 2026",
    platform: "DEV.to",
    title: "I Audited 500+ Websites. JSON-LD Is the #1 Factor for AI Citation.",
    description:
      "The exact JSON-LD templates that get websites cited by ChatGPT, Perplexity, Claude, and Google AI Overview — with copy-paste code and validation steps.",
    url: "https://dev.to/aivisbiz/i-audited-500-websites-json-ld-is-the-1-factor-for-ai-citation-29m4",
  },
  {
    date: "Apr 2026",
    platform: "Substack",
    title: "Best Startup Launch Platforms for AI Visibility and Authority in 2026",
    description:
      "The 10 platforms that still convert founder work into real visibility — and why AI readability now matters as much as human attention.",
    url: "https://dobleduche.substack.com/p/best-startup-launch-platforms-for",
  },
  {
    date: "Apr 2026",
    platform: "Blogger",
    title: "The 10 Platforms That Still Move Builders in the TechCrunch Lane",
    description:
      "Full deep-dive into TechCrunch, Product Hunt, Hacker News, Y Combinator, and the media surfaces that still shape startup perception in the age of AI answers.",
    url: "https://intruvurt.blogspot.com/2026/04/platforms-that-move-builders-ai-visibility.html",
  },
  {
    date: "Apr 2026",
    platform: "Blogger",
    title: "I Tracked 9 Free Sources for Brand Mentions and Found Where AI Models Actually Pull From",
    description:
      "Reddit, Hacker News, GitHub, Quora, Product Hunt, Mastodon, Google News, DuckDuckGo, Bing — the nine platforms that feed AI training data and how to monitor all of them.",
    url: "https://intruvurt.blogspot.com/2026/04/ai-brand-mentions-9-sources-citation.html",
  },
  {
    date: "Apr 2026",
    platform: "LinkedIn",
    title: "AiVIS audits how AI systems read a website",
    description:
      "Founder post walking through the origin story — why most websites are invisible to AI answer engines and how AiVIS was built to surface the structural gaps they miss.",
    url: "https://www.linkedin.com/posts/web4aidev_aivis-audits-how-ai-systems-read-a-website-share-7447000684455071745-tDOK",
  },
];

const MILESTONES = [
  {
    date: "2026",
    title: "TechCrunch Startup Battlefield - Top 200 Nominee",
    description:
      "AiVIS selected as a Top 200 nominee for TechCrunch Startup Battlefield 2026, competing in the AI/ML category for AI visibility auditing and citation-readiness.",
  },
  {
    date: "Dec 2025",
    title: "Platform Launch",
    description:
      "AiVIS launched as the first evidence-backed AiVIS | CITE LEDGER  with real crawl data, evidence ledger, and multi-model triple-check scoring.",
  },
];

const MEDIA_KIT = [
  { label: "Company Name", value: "AiVIS" },
  { label: "Product", value: "AiVIS.biz \u2014 AI Visibility Audit" },
  { label: "Founded", value: "December 2025" },
  { 
    label: "Founder", 
    value: <Link to="/about" className="text-cyan-400 hover:underline">Ryan Mason</Link> 
  },
  { label: "Headquarters", value: "United States" },
  { label: "Category", value: "AI Visibility, AEO, Citation Readiness" },
  { label: "Press Contact", value: "hello@aivis.biz" },
];

export default function PressPage() {
  usePageMeta({
    title: "Press & Media",
    description:
      "Press resources, media coverage, and public milestones for AiVIS. TechCrunch Startup Battlefield Top 200 nominee.",
    path: "/press",
    ogTitle: "Press - AiVIS AI Visibility Audit",
    ogDescription:
      "Press resources and public milestones for AiVIS, the AiVIS | CITE LEDGER . TechCrunch Startup Battlefield Top 200 nominee.",
    structuredData: PRESS_STRUCTURED_DATA,
  });

  return (
    <PublicPageFrame
      icon={Newspaper}
      title="Press & Media"
      subtitle="Coverage, milestones, and media resources."
      backTo="/"
      maxWidthClass="max-w-6xl"
    >
        {/* Hero */}
        <section className="py-4 text-center md:py-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300/90 text-xs font-semibold tracking-wide mb-6">
            Top 200 · TechCrunch Startup Battlefield 2026
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            AiVIS in the Press
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            The first evidence-backed AiVIS | CITE LEDGER  — built
            for agencies, developers, and operators who need proof, not
            dashboards.
          </p>
        </section>

        {/* Featured Posts */}
        <section className="mx-auto max-w-4xl py-12">
          <h3 className="text-2xl brand-title mb-8">Featured</h3>
          <div className="space-y-4">
            {FEATURED_POSTS.map((post) => (
              <a
                key={post.url}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-white/10 bg-white/5 p-6 hover:border-white/20 hover:bg-white/[0.07] transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">
                    {post.platform}
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="text-xs text-white/50">{post.date}</span>
                </div>
                <h4 className="text-lg font-bold text-white/90 mb-2 group-hover:text-white transition-colors">
                  {post.title}
                  <ExternalLink className="inline w-3.5 h-3.5 ml-1.5 text-white/40 group-hover:text-white/60" />
                </h4>
                <p className="text-white/60 leading-relaxed text-sm">
                  {post.description}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* Milestones */}
        <section className="mx-auto max-w-4xl py-12">
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

        {/* Product Hunt Badge */}
        <section className="mx-auto max-w-4xl py-12">
          <h3 className="text-2xl brand-title mb-8">Product Hunt</h3>
          <a
            href="https://www.producthunt.com/products/aivis-ai-visibility-intelligence-audit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-6 py-5 hover:border-orange-400/30 hover:bg-white/[0.07] transition-colors group"
          >
            <img
              src="https://ph-files.imgix.net/c949b139-9ecd-41b9-80be-2a4723cb752e.png?auto=format&fit=crop&w=80&h=80"
              alt="AiVIS on Product Hunt"
              width={64}
              height={64}
              className="rounded-lg object-cover shrink-0"
              loading="lazy"
              decoding="async"
            />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-white/90 group-hover:text-white transition-colors">
                AiVIS – AI Visibility Audit
              </p>
              <p className="mt-1 text-sm text-white/60">
                See exactly what AI gets wrong about your website
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#ff6154]/15 px-3 py-1 text-xs font-semibold text-[#ff6154]">
                Check it out on Product Hunt →
              </span>
            </div>
          </a>
        </section>

        {/* Media Kit */}
        <section className="mx-auto max-w-4xl py-12">
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
              About AiVIS
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

        {/* Directory Listings */}
        <section className="mx-auto max-w-4xl py-12">
          <h3 className="text-2xl brand-title mb-8">Directory Listings</h3>
          <div className="flex flex-wrap gap-4">
            <a
              href="http://www.usafreewebdirectory.com"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.07] transition-colors group"
            >
              <Globe className="w-4 h-4 text-cyan-400/70" />
              USA Business Listing Directory
              <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-white/50" />
            </a>
          </div>
        </section>

        {/* Contact */}
        <section className="mx-auto max-w-4xl py-12 text-center">
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
    </PublicPageFrame>
  );
}
