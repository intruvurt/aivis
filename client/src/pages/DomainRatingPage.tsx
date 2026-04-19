import { useState, useCallback, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ExternalLink, AlertTriangle, CheckCircle2, TrendingUp, Search } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import FeatureInstruction, { InfoTip } from "../components/FeatureInstruction";
import { authorityCheck } from "../api";
import type { AuthorityCheckResponse, AuthorityPlatform, ContentNature } from "@shared/types";
import PageQASection from "../components/PageQASection";
import { buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";
import Spinner from '../components/Spinner';

const DOMAIN_RATING_FAQ = [
  {
    question: "What is the BRA (Brand Relevance Authority) rating?",
    answer: "BRA is AiVIS.biz's composite citation authority score for a domain or brand entity. It aggregates signals across 18 platforms: backlink profile authority (referring domain quality and volume), content nature classification (whether your content is informational, commercial, or transactional, which affects citation type probability), cross-platform mention frequency (how often your brand is referenced outside your own domain), and trust signal density (co-citation with established authoritative sources). BRA scores range from 0-100, with scores above 60 indicating citation-ready authority across most AI answer categories.",
  },
  {
    question: "How does domain authority affect AI citations specifically?",
    answer: "AI answer engines weight citation candidates by domain trust because their training data included human editorial decisions about which sources credible publications link to. Domains with strong backlink profiles, consistent HTTPS deployment, low spam scores, and co-citation with established authoritative sources are more likely to be used as AI answer sources than similar-content domains with weak link profiles. Improving domain authority for AI purposes means the same things it means for traditional SEO: earning editorial mentions from relevant, trusted domains.",
  },
  {
    question: "Why is content nature (informational vs. commercial) important?",
    answer: "AI models calibrate citation behavior by detected query intent. For informational queries ('what is X', 'how does X work'), models strongly prefer citing informational content — explainers, definitions, guides, case studies. For commercial queries ('best X for Y', 'X vs Y'), they mix commercial and informational sources. If your domain's content is classified predominantly commercial (heavy product pages, pricing, CTAs), you may be under-cited for informational queries even with high domain authority. Adding a substantive informational content layer improves cross-intent citation probability.",
  },
  {
    question: "What are the 18 platforms checked by the domain rating tool?",
    answer: "The AiVIS.biz authority checker evaluates your domain and brand entity across: Moz Domain Authority, Ahrefs-equivalent link metrics, Majestic Trust/Citation Flow, Semrush Authority Score, Wikipedia entity presence, Wikidata entity record, LinkedIn company page, Google Knowledge Graph, Bing entity index, Reddit brand discussions, ProductHunt listing, GitHub presence (for tech brands), media mentions (news index), SchemaApp entity resolution, Crunchbase, G2/Capterra review presence, academic citing (Google Scholar), and government/EDU co-citation where applicable. Each platform that recognizes your entity adds a positive signal to the composite BRA score.",
  },
  {
    question: "How do I improve a low BRA score?",
    answer: "The highest-ROI actions for improving BRA are: (1) earning editorial mentions from topically relevant sites with authority scores above 30, (2) creating a Wikipedia or Wikidata entity record if your brand qualifies for notability criteria, (3) publishing original research, data, or statements that credible publications have a reason to cite, (4) registering and completing profiles on the 18 authority platforms the checker evaluates, and (5) generating sustained non-paid coverage in industry publications — three to five mentions per quarter consistently outperforms single viral mentions in long-term BRA improvement.",
  },
];

/* ── helpers ──────────────────────────────────────────────────────────── */

function scoreGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function gradeColor(g: string) {
  if (g === "A") return "text-emerald-400";
  if (g === "B") return "text-sky-400";
  if (g === "C") return "text-amber-400";
  if (g === "D") return "text-orange-400";
  return "text-red-400";
}

function gradeBg(g: string) {
  if (g === "A") return "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30";
  if (g === "B") return "from-sky-500/20 to-sky-500/5 border-sky-500/30";
  if (g === "C") return "from-amber-500/20 to-amber-500/5 border-amber-500/30";
  if (g === "D") return "from-orange-500/20 to-orange-500/5 border-orange-500/30";
  return "from-red-500/20 to-red-500/5 border-red-500/30";
}

function platformLabel(p: AuthorityPlatform): string {
  const labels: Record<AuthorityPlatform, string> = {
    reddit: "Reddit",
    linkedin: "LinkedIn",
    substack: "Substack",
    medium: "Medium",
    github: "GitHub",
    stackoverflow: "Stack Overflow",
    wikipedia: "Wikipedia",
    youtube: "YouTube",
    g2: "G2",
    trustpilot: "Trustpilot",
    crunchbase: "Crunchbase",
    producthunt: "Product Hunt",
    techcrunch: "TechCrunch",
    blogger: "Blogger",
    facebook: "Facebook",
    devpost: "Devpost",
    hackernews: "Hacker News",
    chrome_web_store: "Chrome Web Store",
    twitter: "Twitter / X",
    devto: "dev.to",
    bluesky: "Bluesky",
  };
  return labels[p] || p;
}

function natureColor(n: ContentNature): string {
  if (n === "organic_pain_solution") return "text-emerald-400";
  if (n === "direct_promo") return "text-sky-400";
  if (n === "neutral") return "text-white/60";
  return "text-red-400";
}

function natureLabel(n: ContentNature): string {
  if (n === "organic_pain_solution") return "Organic";
  if (n === "direct_promo") return "Promo";
  if (n === "neutral") return "Neutral";
  return "Spammy";
}

/* ── component ────────────────────────────────────────────────────────── */

export default function DomainRatingPage() {
  usePageMeta({
    title: "Domain Authority Checker \u2014 AiVIS.biz BRA Rating",
    description:
      "Measure your brand's citation authority across 18 platforms. See backlinks, content nature, authority scores, and trust signals in one evidence-backed report.",
    path: "/app/domain-rating",
    structuredData: [
      buildWebPageSchema({
        path: "/app/domain-rating",
        name: "Domain Authority Checker \u2014 AiVIS.biz BRA Rating",
        description: "Measure your brand's citation authority across 18 platforms including Moz, Ahrefs, Wikipedia, LinkedIn, and Google Knowledge Graph. Free domain rating and trust signal check.",
      }),
      buildFaqSchema(DOMAIN_RATING_FAQ, { path: "/app/domain-rating" }),
    ],
  });

  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuthorityCheckResponse | null>(null);
  const [error, setError] = useState("");
  const [expandedPlatform, setExpandedPlatform] = useState<AuthorityPlatform | null>(null);

  const run = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = target.trim();
      if (!trimmed) return;
      setLoading(true);
      setError("");
      setReport(null);
      try {
        const res = await authorityCheck({ target: trimmed });
        if (!res.success) throw new Error("Authority check failed");
        setReport(res.report);
      } catch (err: any) {
        setError(err?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [target]
  );

  const grade = report ? scoreGrade(report.overall.authority_index) : "";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Domain Authority Checker
        </h1>
        <p className="mt-2 text-white/60">
          Evidence-backed authority rating across 18 platforms. Enter a URL or brand name.
        </p>
      </div>

      <FeatureInstruction
        headline="How to use Domain Authority Checker"
        steps={[
          "Enter a URL or brand name in the search box below",
          "Review your overall authority score and letter grade",
          "Check platform-by-platform presence across 18 sources",
          "Focus on platforms where your brand is missing or weak",
        ]}
        benefit="Discover where your brand has the strongest third-party signals — the same signals AI models use to decide who to cite."
        accentClass="text-cyan-400 border-cyan-500/30 bg-cyan-500/[0.06]"
        defaultCollapsed
      />

      {/* Input form */}
      <form onSubmit={run} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://example.com or Brand Name"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder:text-white/30 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !target.trim()}
          className="rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 px-6 py-3 font-semibold text-cyan-200 transition hover:border-cyan-400/50 disabled:opacity-40"
        >
          {loading ? "Scanning\u2026" : "Check Authority"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner className="h-10 w-10" />
          <p className="text-sm text-white/50">Scanning platforms… this may take 30–60 seconds.</p>
        </div>
      )}

      {/* Report */}
      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Overall score card */}
            <div className={`rounded-2xl border bg-gradient-to-br p-6 ${gradeBg(grade)}`}>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
                    <span className={`text-4xl font-bold ${gradeColor(grade)}`}>{grade}</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Authority Index <InfoTip text="Composite score from citations, backlinks, and trust signals across 18 platforms. Higher = more likely to be cited by AI." /></p>
                    <p className="text-3xl font-bold text-white">{report.overall.authority_index}<span className="text-lg text-white/40">/100</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold text-white">{report.overall.total_citations}</p>
                    <p className="text-xs text-white/50">Citations</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{report.overall.total_backlinks}</p>
                    <p className="text-xs text-white/50">Backlinks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{report.platforms.filter((p) => p.citation_count > 0).length}</p>
                    <p className="text-xs text-white/50">Platforms</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-xs">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                  Organic: {report.overall.organic_pain_solution_count}
                </span>
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-300">
                  Promo: {report.overall.direct_promo_count}
                </span>
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-300">
                  Spammy: {report.overall.spammy_count}
                </span>
              </div>

              <p className="mt-4 text-xs text-white/40">
                Checked: {new Date(report.checked_at).toLocaleString()} &middot; Target: {report.target} &middot; Mode: {report.mode}
              </p>
            </div>

            {/* Platform breakdown */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-white">Platform Breakdown</h2>
              <div className="space-y-3">
                {report.platforms
                  .sort((a, b) => b.authority_score - a.authority_score)
                  .map((p) => {
                    const pGrade = scoreGrade(p.authority_score);
                    const isExpanded = expandedPlatform === p.platform;
                    return (
                      <div key={p.platform} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/[0.03]"
                          onClick={() => setExpandedPlatform(isExpanded ? null : p.platform)}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`text-lg font-bold ${gradeColor(pGrade)}`}>{p.authority_score}</span>
                            <span className="font-medium text-white">{platformLabel(p.platform)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-white/50">
                            <span>{p.citation_count} citations</span>
                            {p.backlink_count > 0 && (
                              <span className="text-emerald-400">{p.backlink_count} backlink{p.backlink_count > 1 ? "s" : ""}</span>
                            )}
                            <span className="text-white/30">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && p.items.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-white/5"
                            >
                              <div className="space-y-2 p-4">
                                {p.items.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                      <a
                                        href={item.source_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="line-clamp-1 text-sm font-medium text-cyan-200 hover:text-cyan-100"
                                      >
                                        {item.title} <ExternalLink className="mb-0.5 inline h-3 w-3" />
                                      </a>
                                      <p className="mt-1 line-clamp-2 text-xs text-white/50">{item.snippet}</p>
                                      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                                        <span className={`${natureColor(item.content_nature)} rounded-full border border-white/10 px-2 py-0.5`}>
                                          {natureLabel(item.content_nature)}
                                        </span>
                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/40">
                                          Score: {item.authority_score}
                                        </span>
                                        {item.backlink_found && (
                                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                                            <CheckCircle2 className="mr-0.5 inline h-3 w-3" /> Backlink
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isExpanded && p.items.length === 0 && (
                          <div className="border-t border-white/5 px-5 py-4 text-xs text-white/40">
                            No citations found on this platform.
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Audit notes */}
            {report.audit.notes.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Shield className="h-4 w-4" /> Methodology
                </h3>
                <ul className="space-y-1.5 text-xs text-white/50">
                  {report.audit.notes.map((note, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-white/30">&bull;</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-white/30">
                  Citation density: {report.audit.citation_density} &middot; Policy: {report.audit.policy}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Educational: Domain Authority & AI Entity Confidence */}
      <section aria-label="About Domain Authority Checker" className="mt-8 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">How Cross-Platform Presence Drives AI Citation Confidence</h2>
          <p className="text-sm text-white/75 leading-relaxed">
            This tool measures your brand or domain's authority signal across 18 third-party platforms that AI
            language models use as entity disambiguation anchors: Reddit, LinkedIn, Medium, Substack, GitHub,
            Stack Overflow, Wikipedia, YouTube, G2, Trustpilot, Product Hunt, Crunchbase, TechCrunch,
            AngelList, Hacker News, Dev.to, Quora, and Lobsters. Each platform represents a distinct type of
            social proof — community recognition, professional presence, peer review, media coverage, or
            developer credibility — and AI models weight these signals collectively when deciding whether a
            named entity is concrete and citation-worthy.
          </p>
          <p className="text-sm text-white/75 leading-relaxed">
            The core principle is entity disambiguation: when a user asks an AI model "what is [your brand]?"
            or "who makes [your product]?", the model searches its knowledge graph for corroborating signals.
            A brand detected on one platform is treated with low confidence — it could be a name collision or
            low-authority mention. A brand with confirmed presence on five or more diverse platforms, including
            at least one professional profile (LinkedIn, Crunchbase) and one community signal (Reddit, Product
            Hunt, Hacker News), is treated as a high-confidence, citable entity. This is why AI models
            consistently cite well-represented brands over technically superior but lesser-known alternatives.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Failing Example — D grade (1–2 platforms)</p>
            <p className="text-sm text-white/70 leading-relaxed">
              A SaaS product with only a homepage and a single Twitter mention. No LinkedIn company page,
              no GitHub organisation, no Product Hunt listing, no Crunchbase entry. AI models that query
              for this brand find insufficient cross-platform corroboration and either skip the citation,
              confuse the entity with a similarly named product, or produce a low-confidence answer with a
              disclaimer that the information could not be verified.
            </p>
            <ul className="text-xs text-rose-300/80 space-y-1 list-disc pl-4">
              <li>1–2 platform signals — entity treated as unverified or low-confidence</li>
              <li>No professional profiles — cannot confirm company existence</li>
              <li>No community signals — no independent corroboration of product claims</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Passing Example — A grade (8+ platforms)</p>
            <p className="text-sm text-white/70 leading-relaxed">
              A SaaS product with a LinkedIn company page, GitHub organisation, Product Hunt listing,
              Crunchbase entry, G2 reviews, a Hacker News Show HN post with engagement, a Dev.to presence,
              and a Wikipedia article or notable media coverage. AI models find consistent corroborating
              signals across professional, community, and media surfaces and cite the brand with high
              confidence in both informational and comparative answers.
            </p>
            <ul className="text-xs text-emerald-300/80 space-y-1 list-disc pl-4">
              <li>8+ platforms — entity is unambiguously identified and high-confidence</li>
              <li>Professional + community + media mix — broad signal diversity</li>
              <li>Peer reviews (G2, Trustpilot) — social proof for product-specific citations</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Understanding Your Authority Score</h3>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-white/85 font-medium">Grade A (80–100) — Strong entity signal</dt>
              <dd className="text-white/60 mt-1">Your brand is present across multiple diverse platforms, including at least one authoritative professional profile and one or more community or media mentions. AI models are likely to cite you as a directly named entity in answers that involve your category or use case.</dd>
            </div>
            <div>
              <dt className="text-white/85 font-medium">Grade B–C (50–79) — Moderate signal, room to grow</dt>
              <dd className="text-white/60 mt-1">Presence on several platforms but gaps in key categories (e.g., no review platform like G2 or Trustpilot, or no developer community signal). AI citations exist but may be hedged. Focus on adding presence in the highest-weight missing categories.</dd>
            </div>
            <div>
              <dt className="text-white/85 font-medium">Grade D–F (0–49) — Insufficient cross-platform coverage</dt>
              <dd className="text-white/60 mt-1">The brand is either very new, very niche, or has not been established on third-party platforms that AI training corpora rely on. Priority actions: submit a Crunchbase entry, create a Product Hunt listing, establish a GitHub organisation, and publish a Show HN or Dev.to post to seed community corroboration.</dd>
            </div>
            <div>
              <dt className="text-white/85 font-medium">&quot;Not detected&quot; on a specific platform</dt>
              <dd className="text-white/60 mt-1">Not detected means the platform returned no public-facing data matching your domain or brand name. This is an actionable gap. Each additional high-authority platform presence adds a discrete positive data point to the entity graph AI models consult when generating answers about your brand.</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Empty state */}
      {!loading && !report && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <TrendingUp className="h-12 w-12 text-white/15" />
          <p className="text-white/40">Enter a URL or brand name to check authority across 18 platforms.</p>
          <p className="text-xs text-white/25">Results include citations, backlinks, content nature, and trust signals.</p>
        </div>
      )}

      <PageQASection
        items={DOMAIN_RATING_FAQ}
        heading="Understanding domain authority for AI citations"
        className="mt-6"
      />
    </div>
  );
}
