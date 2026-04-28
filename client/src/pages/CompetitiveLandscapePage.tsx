import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildTechArticleSchema, buildBreadcrumbSchema } from '../lib/seoSchema';
import { COMPETITOR_PROMPT_MAP, PROMPT_FAMILIES } from '../content/competitorPromptMap';

const TITLE = 'Competitive Landscape - Where AiVIS.biz Fits';
const DESCRIPTION =
  'How AiVIS.biz compares to Otterly.ai, Reaudit, Profound, SE Visible, and LLMClicks - with a focus on intent, citation readiness, and structural authority.';
const PATH = '/competitive-landscape';

export default function CompetitiveLandscapePage() {
  usePageMeta({
    title: TITLE,
    description: DESCRIPTION,
    path: PATH,
    structuredData: [
      buildTechArticleSchema({
        title: TITLE,
        description: DESCRIPTION,
        path: PATH,
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Insights', path: '/insights' },
        { name: 'Competitive Landscape', path: PATH },
      ]),
    ],
  });

  return (
    <div className="text-white">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 rounded-2xl border border-white/10 bg-charcoal-deep/90 p-8">
          <p className="text-xs font-semibold tracking-wide uppercase text-white/70 mb-3">
            Competitive Landscape
          </p>
          <h1 className="text-3xl md:text-4xl brand-title-lg mb-4">{TITLE}</h1>
          <p className="text-white/75 leading-relaxed max-w-3xl">
            AI visibility is no longer a side project. It is a dedicated category with its own
            tools, tradeoffs, and gaps. This article maps where AiVIS.biz sits in that landscape so
            you can decide when to use it, when to pair it with other platforms, and where it is
            deliberately opinionated.
          </p>
        </header>

        <div className="mb-10 w-full rounded-2xl border border-white/10 bg-[#0F121C] p-6 shadow-2xl flex justify-center">
          <img
            src="/images/competitor-gap-chart.svg"
            alt="Competitor Gap Analysis Chart"
            className="w-full max-w-4xl h-auto object-contain rounded-xl"
            loading="lazy"
          />
        </div>

        <section className="mb-10 grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
          <div className="rounded-2xl border border-white/10 bg-charcoal p-6">
            <h2 className="text-2xl brand-title mb-3">Intent, citation, authority</h2>
            <p className="text-white/75 leading-relaxed mb-4">
              Most AI monitoring tools answer one of three questions:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-white/75 mb-4">
              <li>
                <strong className="text-white">Intent visibility:</strong> what questions are people
                asking AI, and where do you appear?
              </li>
              <li>
                <strong className="text-white">Citation readiness:</strong> when an AI system wants
                to link out, is your page structurally safe and extractable enough to win?
              </li>
              <li>
                <strong className="text-white">Authority continuity:</strong> does your content,
                schema, and technical surface give the model enough evidence to trust you across
                hundreds of adjacent queries - not just one keyword?
              </li>
            </ol>
            <p className="text-white/75 leading-relaxed">
              AiVIS.biz lives almost entirely in the second and third buckets. It does not try to be
              an all-in-one SEO platform, and it does not run live sentiment monitoring on what AI
              models say about your brand. Instead, it audits your page structure, schema, and
              content blocks to answer a narrower but critical question:{' '}
              <span className="italic">
                can this URL be safely cited as evidence in AI-generated answers?
              </span>
            </p>
          </div>

          <aside className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-6">
            <h3 className="text-lg font-semibold mb-2">Who this is for</h3>
            <p className="text-sm text-white/80 mb-3">
              This comparison is written for operators who:
            </p>
            <ul className="text-sm text-white/80 space-y-2 list-disc list-inside">
              <li>
                Own or influence content that should be cited by ChatGPT, Perplexity, Gemini, or
                Claude.
              </li>
              <li>Already understand basic SEO but need AI-specific diagnostics and evidence.</li>
              <li>Prefer concrete, page-level recommendations over abstract scores.</li>
            </ul>
          </aside>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10 bg-charcoal p-6 overflow-x-auto">
          <h2 className="text-2xl brand-title mb-4">Competitive snapshot</h2>
          <p className="text-white/75 leading-relaxed mb-4">
            The tools below all sit somewhere in the AI visibility, monitoring, or SEO-adjacent
            ecosystem. Prices are typical entry points at the time of writing and may change, but
            the structural differences are durable: what they measure, who they target, and what
            kind of evidence they give you back.
          </p>

          <div className="rounded-xl border border-white/10 bg-charcoal-deep/60">
            <table className="min-w-full text-sm text-white/90">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Tool</th>
                  <th className="px-4 py-3 font-semibold">Focus</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Price Entry</th>
                  <th className="px-4 py-3 font-semibold">AiVIS.biz Advantage</th>
                  <th className="px-4 py-3 font-semibold">AiVIS.biz Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr>
                  <td className="px-4 py-3 font-semibold">Otterly.ai</td>
                  <td className="px-4 py-3">Brand mention monitoring across AI engines</td>
                  <td className="px-4 py-3 whitespace-nowrap">$149/mo</td>
                  <td className="px-4 py-3">
                    AiVIS.biz does page-level structural auditing, not just mention tracking. It
                    tells you <span className="font-semibold">why</span> you are not being cited.
                  </td>
                  <td className="px-4 py-3">
                    No live LLM monitoring. No brand mention tracking at all.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Reaudit</td>
                  <td className="px-4 py-3">GEO scoring + 11-engine tracking</td>
                  <td className="px-4 py-3 whitespace-nowrap">$149/mo</td>
                  <td className="px-4 py-3">
                    AiVIS.biz has deeper per-page, evidence-backed findings instead of a score-only
                    output. You get <span className="font-semibold">specific blocks to fix</span>,
                    not just a geo score.
                  </td>
                  <td className="px-4 py-3">
                    Reaudit tracks 11 engines. AiVIS.biz has no multi-engine tracking yet.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Profound</td>
                  <td className="px-4 py-3">Enterprise LLM monitoring + prompt volumes</td>
                  <td className="px-4 py-3 whitespace-nowrap">$499/mo</td>
                  <td className="px-4 py-3">
                    AiVIS.biz is accessible to SMBs and agencies. Profound is enterprise-first with
                    complex deployment, while AiVIS.biz is{' '}
                    <span className="font-semibold">self-serve</span>
                    with page-level audits you can run immediately.
                  </td>
                  <td className="px-4 py-3">
                    No prompt volumes feature (what questions people ask AI). No agent analytics.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">SE Visible</td>
                  <td className="px-4 py-3">AI monitoring inside a full SEO platform</td>
                  <td className="px-4 py-3 whitespace-nowrap">$189/mo</td>
                  <td className="px-4 py-3">
                    AiVIS.biz is purpose-built for AI visibility. SE Visible bolts AI features onto
                    a broader SEO suite, while AiVIS.biz stays focused on{' '}
                    <span className="font-semibold">citation-ready structure</span> and extraction.
                  </td>
                  <td className="px-4 py-3">
                    No direct integration with broader SEO keyword/backlink workflows.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">LLMClicks</td>
                  <td className="px-4 py-3">Hallucination detection + accuracy validation</td>
                  <td className="px-4 py-3 whitespace-nowrap">$49/mo</td>
                  <td className="px-4 py-3">
                    AiVIS.biz focuses on why pages do not get cited in the first place. LLMClicks
                    looks at <span className="font-semibold">what</span> AI says; AiVIS.biz looks at
                    <span className="font-semibold">why</span> the model does not trust your page as
                    a source.
                  </td>
                  <td className="px-4 py-3">
                    No hallucination or accuracy monitoring for what AI says about AiVIS.biz users.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Competitor and prompt map</h2>
          <p className="text-white/75 leading-relaxed mb-5">
            Use prompt families to force direct comparisons where weak positioning usually appears.
            Each competitor row below maps to prompt families that expose structural gaps and
            citation-readiness differences.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white/90 rounded-xl overflow-hidden border border-white/10">
              <thead className="bg-white/5 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Competitor</th>
                  <th className="px-4 py-3 font-semibold">Strongest on</th>
                  <th className="px-4 py-3 font-semibold">Weaker on</th>
                  <th className="px-4 py-3 font-semibold">Prompt families to run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {COMPETITOR_PROMPT_MAP.map((row) => (
                  <tr key={row.competitor}>
                    <td className="px-4 py-3 font-semibold text-white">{row.competitor}</td>
                    <td className="px-4 py-3 text-white/75">{row.strongestOn.join(', ')}</td>
                    <td className="px-4 py-3 text-white/75">{row.weakerOn.join(', ')}</td>
                    <td className="px-4 py-3 text-cyan-200">
                      {row.suggestedPromptFamilies.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 mt-5">
            {PROMPT_FAMILIES.map((family) => (
              <div
                key={family.id}
                className="rounded-xl border border-white/10 bg-charcoal-deep/60 p-4"
              >
                <h3 className="text-sm font-semibold text-white mb-1">{family.title}</h3>
                <p className="text-xs text-white/65 mb-2">{family.objective}</p>
                <p className="text-xs text-cyan-200">Example: {family.samplePrompts[0]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10 space-y-6 rounded-2xl border border-white/10 bg-charcoal p-6">
          <h2 className="text-2xl brand-title">Where AiVIS.biz is intentionally narrow</h2>
          <p className="text-white/75 leading-relaxed">
            The easiest mistake in this category is to chase breadth: add yet another keyword
            explorer, half-finished rank tracker, or generic content brief generator. AiVIS.biz
            takes the opposite path. It narrows in on{' '}
            <span className="font-semibold">structural readiness</span> - the combination of
            crawlability, extractability, and trust cues that cause an AI system to either surface
            your URL or quietly skip you.
          </p>
          <p className="text-white/75 leading-relaxed">That narrowness shows up in the product:</p>
          <ul className="list-disc list-inside space-y-2 text-white/75">
            <li>
              Audits are <span className="font-semibold">page-first</span>, not domain-first. You
              see fixes tied to specific URLs, headings, schema blocks, and entity mentions.
            </li>
            <li>
              Recommendations are written for <span className="font-semibold">answer engines</span>,
              not just blue-link SERPs. They assume the reader is a model trying to cite you.
            </li>
            <li>
              The analytics views roll up{' '}
              <span className="font-semibold">structural change over time</span>, not just average
              scores, so you can see which fixes actually moved citation readiness.
            </li>
          </ul>
          <p className="text-white/75 leading-relaxed">
            If you need full-funnel attribution, live LLM transcript analysis, or keyword bidding
            recommendations, AiVIS.biz will not replace your SEO stack. It is the layer that
            explains
            <span className="font-semibold">
              why your supposedly great content still does not earn a quote
            </span>
            inside AI answers.
          </p>
        </section>

        <section className="mb-10 space-y-6 rounded-2xl border border-white/10 bg-charcoal p-6">
          <h2 className="text-2xl brand-title">When to pair AiVIS.biz with other tools</h2>
          <p className="text-white/75 leading-relaxed">
            Many teams run AiVIS.biz alongside at least one of the competitors above. The pattern
            usually looks like this:
          </p>
          <ul className="list-disc list-inside space-y-2 text-white/75">
            <li>
              <strong className="text-white">Otterly.ai + AiVIS.biz:</strong> Otterly alerts you
              when your brand appears in AI answers; AiVIS.biz shows which pages need structural
              work so that mentions turn into{' '}
              <span className="font-semibold">defensible citations</span> instead of throwaway
              references.
            </li>
            <li>
              <strong className="text-white">Reaudit + AiVIS.biz:</strong> Reaudit gives you a
              multi-engine surface-level view; AiVIS.biz is the{' '}
              <span className="font-semibold">forensics layer</span> that explains why your scores
              plateau.
            </li>
            <li>
              <strong className="text-white">Profound / SE Visible + AiVIS.biz:</strong> enterprise
              teams keep their existing monitoring and reporting stack, then plug AiVIS.biz in as a
              <span className="font-semibold">specialist diagnostic tool</span> for high-value
              landing pages.
            </li>
            <li>
              <strong className="text-white">LLMClicks + AiVIS.biz:</strong> LLMClicks flags
              hallucinations and misstatements; AiVIS.biz helps you upgrade the underlying evidence
              so that models have
              <span className="font-semibold">better material</span> to learn from.
            </li>
          </ul>
          <p className="text-white/75 leading-relaxed">
            In other words: AiVIS.biz is rarely the only tool in the stack, but it often becomes the
            <span className="font-semibold">most concrete</span>. It is the place where vague
            complaints like "AI never cites us" turn into a prioritized list of fixes on specific
            URLs.
          </p>
        </section>

        <section className="mb-12 space-y-4 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-6">
          <h2 className="text-2xl brand-title text-emerald-200">Positioning summary</h2>
          <p className="text-white/80 leading-relaxed">
            AiVIS.biz's clearest positioning: the only tool that audits why your page fails at the
            structural level - not just whether you appear, but exactly what structural and content
            failures prevent AI systems from trusting and citing you. That is the anchor for
            everything else: pricing, features, and roadmap.
          </p>
          <p className="text-white/80 leading-relaxed">
            If you want that lens on your own site, start with a single high-intent URL - your main
            product page, pricing page, or flagship resource. Run an audit, apply the top 3
            structural fixes, and then watch how often that page shows up as a cited source in
            AI-generated answers over the next quarter.
          </p>
          <p className="text-white/80 leading-relaxed">
            When you are ready to operationalize it across your catalog, step up to the Alignment or
            Signal tiers and let the Analytics views tell you where your next gains are hiding.
          </p>
          <div className="pt-2">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20"
            >
              Explore AiVIS.biz plans
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        <section className="pb-6 flex flex-wrap gap-4 justify-between text-sm text-white/60">
          <span>
            Looking for implementation detail? Read the{' '}
            <Link to="/aeo-playbook-2026" className="underline hover:text-white">
              AEO Playbook
            </Link>{' '}
            next.
          </span>
          <Link to="/insights" className="underline hover:text-white">
            ← Back to Insights hub
          </Link>
        </section>
      </main>
    </div>
  );
}
