import React from "react";
import { CheckCircle2, XCircle, Minus, ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Link } from "react-router-dom";
import { buildBreadcrumbSchema } from "../lib/seoSchema";

export default function CompareAhrefsPage() {
  usePageMeta({
    title: "AiVIS.biz vs Ahrefs: AI Visibility Audit vs Backlink Intelligence (2026 Comparison)",
    description:
      "Ahrefs maps backlinks and keyword rankings. AiVIS.biz audits whether AI answer engines can extract, trust, and cite your content. Full 2026 feature comparison.",
    path: "/compare/aivis-vs-ahrefs",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "AiVIS.biz vs Ahrefs: AI Citation Readiness vs Backlink Intelligence",
        description:
          "Ahrefs tracks the web's largest backlink index and keyword data. AiVIS.biz audits whether ChatGPT, Perplexity, Claude, and Gemini can extract, trust, and cite your content. These are different measurement layers.",
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
            name: "Is AiVIS.biz an Ahrefs alternative?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "AiVIS.biz is not a direct Ahrefs replacement. Ahrefs excels at backlink analysis, keyword research, and SERP tracking. AiVIS.biz measures a different layer entirely: whether AI answer engines can parse, extract, and cite your content. They are complementary, not competitive.",
            },
          },
          {
            "@type": "Question",
            name: "Does Ahrefs measure AI visibility?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Ahrefs tracks traditional search metrics - backlinks, referring domains, keyword rankings, and SERP features. It does not audit content extractability for AI answer engines, verify citations across ChatGPT or Perplexity, score entity clarity, or measure answer block density.",
            },
          },
          {
            "@type": "Question",
            name: "What does AiVIS.biz measure that Ahrefs cannot?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "AiVIS.biz measures AI citation readiness: content extractability, entity clarity, answer block density, schema completeness for machine consumption, and live citation verification across search engines. It validates findings across three AI models using a Triple-Check pipeline. These are signals that AI answer engines evaluate when choosing which sources to cite.",
            },
          },
        ],
      },
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Comparison", path: "/compare" },
        { name: "AiVIS.biz vs Ahrefs", path: "/compare/aivis-vs-ahrefs" },
      ]),
    ],
  });

  return (
    <div className="text-white py-10">
      <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
        <div className="card-charcoal rounded-2xl p-8 border border-white/10">
          {/* ── Category Claim ── */}
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-4">
            Answer Engine Optimization Platform vs Backlink Intelligence
          </p>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
            AiVIS.biz vs Ahrefs
          </h1>

          <p className="text-lg text-white/75 mb-8 leading-relaxed">
            <strong className="text-white">Ahrefs maps the web&rsquo;s link graph and keyword landscape.</strong>{" "}
            <strong className="text-white">CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines.</strong>{" "}
            These tools operate on different measurement layers. Backlink authority matters for Google rankings. Content extractability and entity clarity matter for AI citations. This comparison explains exactly where each tool contributes.
          </p>

          {/* ── What Ahrefs Measures ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">What Ahrefs Measures</h2>
            <p className="text-white/70 mb-4 leading-relaxed">
              Ahrefs maintains one of the largest backlink indices on the web. It tracks referring domains, link velocity, anchor text distribution, and domain authority metrics. Its keyword research covers 12+ search engines including Google, YouTube, and Amazon. Site Explorer shows organic traffic estimates, ranking keywords, and SERP position history.
            </p>
            <p className="text-white/70 leading-relaxed">
              For traditional SEO competitive intelligence, Ahrefs provides unmatched depth in link analysis and keyword gap discovery. Its content explorer surfaces pages by topic and engagement metrics. These are powerful tools for search engine optimization - but they measure search engine signals, not AI answer engine signals.
            </p>
          </section>

          {/* ── What AiVIS.biz Measures ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">What AiVIS.biz Measures</h2>
            <p className="text-white/70 mb-4 leading-relaxed">
              AiVIS.biz is not an SEO tool. It is the first platform built specifically to measure and improve whether AI answer engines can read, trust, and cite your website. It audits content extractability (can an AI model parse your page into usable knowledge?), entity clarity (does your brand, author, and organization schema form a coherent graph?), answer block density (is your content structured in citable answer fragments?), and cross-platform citation presence (are you actually showing up in AI-generated answers?).
            </p>
            <p className="text-white/70 leading-relaxed">
              The output is a quantified visibility score validated across multiple AI models using a Triple-Check pipeline, plus evidence-linked recommendations. On the Score Fix tier, AiVIS.biz generates GitHub pull requests that implement the structural fixes automatically.
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
                    <th className="p-4 border-b border-white/10 font-semibold text-white/70">Ahrefs</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    ["Primary purpose", "AI citation readiness & visibility auditing", "Backlink analysis & keyword intelligence", true, true],
                    ["Backlink analysis", "Not a focus", "Industry-leading backlink index with link intersect", false, true],
                    ["Keyword research", "Not a focus", "12+ search engine keyword databases", false, true],
                    ["Content extractability audit", "Full DOM + JSON-LD parsing for AI consumption", "Not measured", true, false],
                    ["Entity clarity analysis", "Brand/author/organization entity graph scoring", "Not measured", true, false],
                    ["Answer block density", "Evaluates quotable answer block structure", "Not measured", true, false],
                    ["AI citation testing", "Live verification across 3 search engines in parallel", "Not available", true, false],
                    ["Multi-model validation", "Triple-Check: 3 AI models, peer critique, validation gate", "Not available", true, false],
                    ["SERP tracking", "Not a focus (measures the input, not ranking positions)", "Full SERP position tracking and history", false, true],
                    ["Automated code fixes", "Score Fix generates GitHub PRs with evidence-linked changes", "Not available", true, false],
                    ["Competitor gap analysis", "AI visibility comparison with opportunity scoring", "Keyword and backlink gap analysis", true, true],
                    ["MCP protocol", "AI agents can invoke audit tools programmatically", "Not available", true, false],
                    ["Schema completeness audit", "JSON-LD validation for machine consumption", "Basic structured data in site audit", true, false],
                    ["Domain Authority metrics", "Not a focus (measures extractability, not authority)", "Domain Rating (DR), URL Rating (UR)", false, true],
                    ["Free tier", "Observer: 3 audits/mo, full fidelity", "Ahrefs Webmaster Tools (limited, site owners only)", true, false],
                  ].map(([feature, aivis, ahrefs, aivisYes, ahrefsYes], i) => (
                    <tr key={i} className="border-b border-white/5 last:border-b-0">
                      <td className="p-3 border-r border-r-white/10 font-medium text-white/80">{feature as string}</td>
                      <td className="p-3 border-r border-r-white/10 text-white/70">
                        {aivisYes ? <CheckCircle2 className="inline text-emerald-400 mr-1.5 h-4 w-4" /> : <Minus className="inline text-white/30 mr-1.5 h-4 w-4" />}
                        {aivis as string}
                      </td>
                      <td className="p-3 text-white/60">
                        {ahrefsYes ? <CheckCircle2 className="inline text-orange-400 mr-1.5 h-4 w-4" /> : <XCircle className="inline text-white/20 mr-1.5 h-4 w-4" />}
                        {ahrefs as string}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── When to Use Each ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">When to Use Ahrefs vs AiVIS.biz</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-orange-400/20 bg-orange-500/[0.06] p-5">
                <h3 className="text-lg font-bold text-orange-300 mb-2">Use Ahrefs When</h3>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>You need backlink analysis and link building intelligence</li>
                  <li>You want keyword research across multiple search engines</li>
                  <li>You need competitive keyword and content gap discovery</li>
                  <li>You are tracking SERP positions and ranking history</li>
                  <li>You need domain authority and referring domain metrics</li>
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
              Ahrefs sees links. AiVIS.biz sees structure. Both matter. One tells you how Google values your pages. The other tells you whether AI answer engines can use them as source material.
            </p>
          </section>

          {/* ── The Gap ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-3 text-white">The Measurement Gap</h2>
            <p className="text-white/70 mb-4 leading-relaxed">
              Ahrefs was built for the link-based web. Its core insight is that backlinks are votes of confidence and authority. That model works for search engines that use links as ranking signals.
            </p>
            <p className="text-white/70 leading-relaxed">
              AI answer engines like ChatGPT, Perplexity, and Claude do not rank pages by backlink count. They evaluate whether content can be extracted into structured knowledge, whether the entity graph is coherent, whether claims are verifiable, and whether the content answers the question directly. These are structural signals that no backlink tool measures. AiVIS.biz was built to measure exactly this.
            </p>
          </section>

          {/* ── FAQ ── */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-white">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: "Is AiVIS.biz an Ahrefs alternative?",
                  a: "No. Ahrefs is a backlink and keyword research platform. AiVIS.biz is an AiVIS.biz | CITE LEDGER . They measure different things. Use Ahrefs for link intelligence. Use AiVIS.biz for AI citation readiness.",
                },
                {
                  q: "Does Ahrefs measure AI visibility?",
                  a: "Ahrefs tracks traditional search metrics - backlinks, referring domains, keyword rankings, and SERP features. It does not audit content extractability for AI answer engines, verify citations across ChatGPT or Perplexity, or measure entity clarity for machine consumption.",
                },
                {
                  q: "Can I use both Ahrefs and AiVIS.biz?",
                  a: "Yes. This is the recommended approach. Ahrefs covers the link-based SEO layer. AiVIS.biz covers AI citation readiness. Together they give you visibility into both search engine rankings and AI answer engine citations.",
                },
                {
                  q: "What is the difference between backlinks and AI citation readiness?",
                  a: "Backlinks are hyperlinks from other websites pointing to your pages. They signal authority to search engines. AI citation readiness is whether your content is structurally extractable, entity-coherent, and verifiable enough for AI answer engines to use as source material when generating answers. Different signals, different outcomes.",
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
            <h3 className="text-2xl font-bold mb-3 text-white">See What Ahrefs Cannot Show You</h3>
            <p className="text-white/65 mb-5 max-w-xl mx-auto">
              Run a free AI visibility audit. See exactly how ChatGPT, Perplexity, Claude, and Gemini evaluate your content - with evidence-linked findings and prioritized fixes.
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
              <Link to="/compare/semrush" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Semrush</Link>
              <Link to="/compare/rankscale" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs RankScale</Link>
              <Link to="/compare/otterly" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Otterly</Link>
              <Link to="/compare/profound" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Profound</Link>
              <Link to="/compare/reaudit" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">vs Reaudit</Link>
            </div>
          </section>

          <p className="text-xs text-white/40 mt-6">
            Ahrefs is a trademark of Ahrefs Pte. Ltd. This comparison reflects publicly available feature information as of March 2026. AiVIS.biz is not affiliated with Ahrefs.
          </p>
        </div>
      </section>
    </div>
  );
}
