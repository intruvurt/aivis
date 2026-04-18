import React from "react";
import { CheckCircle2, XCircle, Minus, ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Link } from "react-router-dom";
import { buildBreadcrumbSchema } from "../lib/seoSchema";

export default function CompareSemrushPage() {
  usePageMeta({
    title: "AiVIS.biz vs Semrush: AI Visibility Audit vs SEO Suite (2026 Comparison)",
    description:
      "Semrush measures search engine rankings. AiVIS.biz measures whether AI answer engines can read, trust, and cite your website. Detailed feature comparison for 2026.",
    path: "/compare/aivis-vs-semrush",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "AiVIS.biz vs Semrush: AI Citation Readiness vs SEO Rankings",
        description:
          "Semrush tracks keyword rankings across 140+ databases. AiVIS.biz audits whether ChatGPT, Perplexity, Claude, and Gemini can extract, trust, and cite your content. These are different measurement layers.",
        author: { "@id": "https://aivis.biz/#author" },
        publisher: { "@id": "https://aivis.biz/#organization" },
        datePublished: "2026-03-24",
        dateModified: "2026-03-24",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is AiVIS.biz a Semrush alternative?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "AiVIS.biz is not a direct Semrush replacement. Semrush measures search engine rankings, backlinks, and keyword positions. AiVIS.biz measures AI citation readiness - whether ChatGPT, Perplexity, Claude, and Gemini can extract, trust, and cite your content. They solve different problems for the same audience.",
            },
          },
          {
            "@type": "Question",
            name: "Can AiVIS.biz replace Semrush for SEO?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Semrush excels at traditional SEO - keyword research, rank tracking, backlink analysis, and SERP feature monitoring. AiVIS.biz is not an SEO tool. It audits AI visibility: content extractability, entity clarity, schema completeness, and citation verification across AI answer engines. Use both for complete coverage.",
            },
          },
          {
            "@type": "Question",
            name: "Does Semrush measure AI visibility?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Semrush tracks AI Overviews in Google search results and provides AI-powered content suggestions. However, it does not audit content extractability for AI answer engines, verify citations across ChatGPT or Perplexity, run multi-model validation pipelines, or generate automated code fixes for structural gaps.",
            },
          },
          {
            "@type": "Question",
            name: "What is the difference between SEO tools and AI visibility tools?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "SEO tools measure how well your pages rank in search engines using signals like backlinks, keyword relevance, and page speed. AI visibility tools measure whether AI answer engines can parse, trust, and cite your content using signals like content extractability, entity clarity, answer block density, and schema completeness. Both matter. They measure different things.",
            },
          },
        ],
      },
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Comparison", path: "/compare" },
        { name: "AiVIS.biz vs Semrush", path: "/compare/aivis-vs-semrush" },
      ]),
    ],
  });

  return (
    <div className="text-white py-10">
      <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
        <div className="card-charcoal rounded-2xl p-8 border border-white/10">
          {/* ── Category Claim ── */}
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-4">
            Answer Engine Optimization Platform vs SEO Suite
          </p>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
            AiVIS.biz vs Semrush
          </h1>

          <p className="text-lg text-white/75 mb-8 leading-relaxed">
            <strong className="text-white">Semrush measures search engine rankings.</strong>{" "}
            <strong className="text-white">AiVIS.biz measures whether AI answer engines can read, trust, and cite your website.</strong>{" "}
            These are different problems requiring different measurement layers. This page explains exactly where each tool excels and where the gap between them matters.
          </p>

          {/* ── What Semrush Measures ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">What Semrush Measures</h2>
            <p className="text-white/70 mb-4 leading-relaxed">
              Semrush is a comprehensive digital marketing platform. It tracks keyword rankings across 140+ country databases, maps backlink profiles, runs site audits for crawl errors and broken links, monitors paid ad positions, and estimates organic traffic. For traditional search engine optimization, Semrush provides deep competitive intelligence.
            </p>
            <p className="text-white/70 leading-relaxed">
              Semrush added AI-related features including AI Overview tracking and AI-powered content suggestions. These tell you where AI overviews appear in Google search results. They do not tell you whether your content is structurally ready to be cited by ChatGPT, Perplexity, Claude, or Gemini.
            </p>
          </section>

          {/* ── What AiVIS.biz Measures ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">What AiVIS.biz Measures</h2>
            <p className="text-white/70 mb-4 leading-relaxed">
              AiVIS.biz is not an SEO tool. CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude. It audits five structural dimensions: crawlability, extractability, trust signals, scoring consistency via multi-model validation, and operational follow-through with automated code fixes.
            </p>
            <p className="text-white/70 leading-relaxed">
              Where Semrush tells you how you rank in Google, AiVIS.biz tells you whether AI systems can understand your content well enough to include it in generated answers. The output is a visibility score with evidence-linked recommendations and, on the Score Fix tier, automated GitHub pull requests that implement the fixes.
            </p>
          </section>

          {/* ── Comparison Table ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-white">Feature Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse bg-white/[0.03] rounded-lg overflow-hidden">
                <thead className="bg-white/[0.06]">
                  <tr>
                    <th className="p-4 border-b border-white/10 font-semibold text-white/80 border-r border-r-white/10">Capability</th>
                    <th className="p-4 border-b border-white/10 font-semibold text-cyan-300 border-r border-r-white/10">AiVIS.biz</th>
                    <th className="p-4 border-b border-white/10 font-semibold text-white/70">Semrush</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    ["Primary purpose", "AI citation readiness & visibility auditing", "Keyword rankings & SEO intelligence", true, true],
                    ["Keyword research", "Not a focus", "140+ country keyword databases", false, true],
                    ["Backlink analysis", "Not a focus", "Deep backlink index & competitive gaps", false, true],
                    ["Content extractability audit", "Full DOM + JSON-LD parsing for AI consumption", "Not measured", true, false],
                    ["Entity clarity analysis", "Brand/author/organization entity coherence scoring", "Not measured", true, false],
                    ["Answer block density", "Evaluates quotable answer block structure", "Not measured", true, false],
                    ["AI citation testing", "Live verification across 3 search engines in parallel", "Not available", true, false],
                    ["Multi-model validation", "Triple-Check: 3 AI models, peer critique, validation gate", "Single-pass AI content suggestions", true, false],
                    ["AI Overview tracking", "Not a focus (measures the input, not SERP features)", "Tracks AI Overview presence in Google SERPs", false, true],
                    ["Automated code fixes", "Score Fix generates GitHub PRs with evidence-linked changes", "Not available", true, false],
                    ["Brand mention tracking", "19 free sources: Reddit, HN, Mastodon, GitHub, etc.", "Brand Monitoring add-on (paid)", true, true],
                    ["MCP protocol", "AI agents can invoke tools programmatically", "Not available", true, false],
                    ["Schema completeness audit", "JSON-LD validation for machine consumption", "Basic technical SEO audit", true, false],
                    ["Trust signal evaluation", "Author E-E-A-T, policy pages, claim consistency", "Domain Authority metrics", true, true],
                    ["Free tier", "Observer: 3 audits/mo, full fidelity", "Limited free tools, most features require paid plan", true, false],
                  ].map(([feature, aivis, semrush, aivisYes, semrushYes], i) => (
                    <tr key={i} className="border-b border-white/5 last:border-b-0">
                      <td className="p-3 border-r border-r-white/10 font-medium text-white/80">{feature as string}</td>
                      <td className="p-3 border-r border-r-white/10 text-white/70">
                        {aivisYes ? <CheckCircle2 className="inline text-emerald-400 mr-1.5 h-4 w-4" /> : <Minus className="inline text-white/30 mr-1.5 h-4 w-4" />}
                        {aivis as string}
                      </td>
                      <td className="p-3 text-white/60">
                        {semrushYes ? <CheckCircle2 className="inline text-blue-400 mr-1.5 h-4 w-4" /> : <XCircle className="inline text-white/20 mr-1.5 h-4 w-4" />}
                        {semrush as string}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── When to Use Each ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">When to Use Semrush vs AiVIS.biz</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-400/20 bg-blue-500/[0.06] p-5">
                <h3 className="text-lg font-bold text-blue-300 mb-2">Use Semrush When</h3>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>You need keyword research and competitive position tracking in Google</li>
                  <li>You need backlink analysis and link building opportunity discovery</li>
                  <li>You want paid advertising intelligence and PPC management</li>
                  <li>You need SERP feature monitoring including AI Overview tracking</li>
                  <li>You are optimizing for traditional search engine rankings</li>
                </ul>
              </div>
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] p-5">
                <h3 className="text-lg font-bold text-cyan-300 mb-2">Use AiVIS.biz When</h3>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>You need to know if AI systems can parse and cite your content</li>
                  <li>You want validated audit findings across multiple AI models</li>
                  <li>You need live citation verification across real search engines</li>
                  <li>You want automated code fixes pushed to your repository</li>
                  <li>You need to measure extractability, entity clarity, and trust signals</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-white/55 mt-4">
              The practical recommendation: keep Semrush for search rankings. Add AiVIS.biz for AI citation readiness. Both layers matter. One without the other leaves you blind to half the discovery landscape.
            </p>
          </section>

          {/* ── Key Differentiator ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">The Measurement Gap</h2>
            <p className="text-white/70 mb-4 leading-relaxed">
              Semrush was built for a world where users click blue links. AI answer engines bypass that model entirely - they synthesize answers from extracted content. The signals they evaluate to select sources are fundamentally different from Google ranking factors.
            </p>
            <p className="text-white/70 leading-relaxed">
              Content extractability, answer block density, entity graph coherence, and cross-platform citation presence have no equivalent in traditional SEO metrics. This is not a criticism of Semrush. It was not designed to measure what AI systems evaluate because AI answer engines did not exist when it was built. AiVIS.biz was built specifically for this measurement layer.
            </p>
          </section>

          {/* ── FAQ Section ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-white">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: "Is AiVIS.biz a Semrush alternative?",
                  a: "AiVIS.biz is not a direct Semrush replacement. Semrush measures search engine rankings, backlinks, and keyword positions. AiVIS.biz measures AI citation readiness - whether ChatGPT, Perplexity, Claude, and Gemini can extract, trust, and cite your content. They solve different problems for the same audience.",
                },
                {
                  q: "Can AiVIS.biz replace Semrush for SEO?",
                  a: "No. Semrush excels at traditional SEO - keyword research, rank tracking, backlink analysis, and SERP feature monitoring. AiVIS.biz is not an SEO tool. It audits AI visibility: content extractability, entity clarity, schema completeness, and citation verification. Use both for complete coverage.",
                },
                {
                  q: "Does Semrush measure AI visibility?",
                  a: "Semrush tracks AI Overviews in Google search results and provides AI content suggestions. It does not audit content extractability for AI answer engines, verify citations across ChatGPT or Perplexity, run multi-model validation, or generate automated code fixes for structural gaps.",
                },
                {
                  q: "Do I need both Semrush and AiVIS.biz?",
                  a: "If you care about both search engine rankings and AI answer engine citations, yes. Semrush tells you how Google sees you. AiVIS.biz tells you how ChatGPT, Perplexity, Claude, and Gemini see you. The signals are different. The measurement layers are complementary.",
                },
              ].map((faq, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="font-bold text-white mb-2">{faq.q}</h3>
                  <p className="text-sm text-white/65 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/[0.08] to-violet-500/[0.08] p-8 text-center">
            <h3 className="text-2xl font-bold mb-3 text-white">See What Semrush Cannot Show You</h3>
            <p className="text-white/65 mb-5 max-w-xl mx-auto">
              Run a free AI visibility audit. See exactly how ChatGPT, Perplexity, Claude, and Gemini read your site - with evidence-linked findings and prioritized fixes.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 font-bold text-white shadow-lg hover:bg-cyan-400 transition"
            >
              Run Free AI Visibility Audit <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="mt-10">
            <h3 className="text-lg font-semibold text-white/80 mb-4">Compare AiVIS.biz with other tools</h3>
            <div className="flex flex-wrap gap-3">
              <Link to="/compare/ahrefs" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Ahrefs</Link>
              <Link to="/compare/rankscale" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs RankScale</Link>
              <Link to="/compare/otterly" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Otterly</Link>
              <Link to="/compare/profound" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Profound</Link>
              <Link to="/compare/reaudit" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Reaudit</Link>
            </div>
          </section>

          <p className="text-xs text-white/40 mt-6">
            Semrush is a trademark of Semrush Inc. This comparison reflects publicly available feature information as of March 2026. AiVIS.biz is not affiliated with Semrush.
          </p>
        </div>
      </section>
    </div>
  );
}
