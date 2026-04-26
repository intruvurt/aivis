import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  Database,
  Fingerprint,
  Hash,
  Link2,
  Lock,
  Network,
  Shield,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import PublicPageFrame from '../../components/PublicPageFrame';
import { BRAG_ACRONYM } from '@shared/types';
import { buildWebPageSchema, buildBreadcrumbSchema } from '../../lib/seoSchema';

export default function CiteLedgerPage() {
  const location = useLocation();
  const canonicalPath =
    location.pathname === '/cite-ledger' ? '/cite-ledger' : '/methodology/cite-ledger';

  usePageMeta({
    title: 'What Is AiVIS CITE LEDGER? | Citation Readiness Framework',
    description:
      'AiVIS CITE LEDGER is the citation readiness and verification framework that measures whether AI systems can read, trust, and cite your website using evidence-linked signals.',
    path: canonicalPath,
    structuredData: [
      buildWebPageSchema({
        name: 'What Is AiVIS CITE LEDGER? | Citation Readiness Framework',
        description:
          'Long-form definition and disambiguation page for AiVIS CITE LEDGER, including weighted signal model and citation verification semantics.',
        path: canonicalPath,
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Methodology', path: '/methodology' },
        { name: 'CITE LEDGER', path: canonicalPath },
      ]),
    ],
  });

  return (
    <PublicPageFrame
      icon={Database}
      title="What Is AiVIS CITE LEDGER?"
      subtitle="AiVIS CITE LEDGER is the AI visibility and citation readiness framework that evaluates whether your site can be read, trusted, and cited by answer engines."
      backTo="/methodology"
    >
      <section className="mb-10 rounded-2xl border border-cyan-300/20 bg-cyan-400/6 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80 mb-3">
          Clear definition
        </p>
        <p className="text-slate-100 leading-relaxed text-lg">
          AiVIS CITE LEDGER is a proprietary AI visibility scoring and citation verification system
          developed by AiVIS.biz. It evaluates whether a page can be extracted and cited by systems
          such as ChatGPT, Perplexity, Google AI Overviews, and Claude.
        </p>
        <p className="text-slate-300 leading-relaxed mt-3">
          This is not the same as traditional SEO. Search engines rank relevance; AI systems extract
          and cite. A site can rank well in search and still be invisible in AI answers.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">What AiVIS CITE LEDGER is not</h2>
        <ul className="space-y-2 text-slate-300 leading-relaxed list-disc pl-5">
          <li>Not a blockchain or cryptocurrency ledger.</li>
          <li>Not a music project or artist identity.</li>
          <li>Not a text-to-speech product.</li>
          <li>Not an academic citation manager.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Why CITE LEDGER exists</h2>
        <div className="space-y-4 text-slate-300 leading-relaxed">
          <p>
            AI answer engines cite what they can structurally understand and trust. Many pages fail
            not because they are irrelevant, but because entity clarity, schema quality, and trust
            signals are weak or missing.
          </p>
          <p>
            CITE LEDGER ties every score to verifiable evidence found on the live page. If something
            cannot be proven from your page, it is not included in your score.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">
          How the framework evaluates citation readiness
        </h2>
        <ol className="space-y-5">
          {[
            {
              icon: <Network className="w-5 h-5 text-cyan-300" />,
              title: 'Structured signal extraction',
              desc: 'AiVIS crawls the live page and maps schema, metadata, heading hierarchy, readability, security posture, and trust-bearing signals.',
            },
            {
              icon: <Fingerprint className="w-5 h-5 text-violet-300" />,
              title: 'Evidence classification',
              desc: `Each finding is normalized and linked to deterministic evidence IDs under the ${BRAG_ACRONYM} grading model.`,
            },
            {
              icon: <Hash className="w-5 h-5 text-orange-300" />,
              title: 'Citation-state resolution',
              desc: 'Findings are resolved into citation-backed, uncited, or unavailable states so visibility claims remain auditable and reproducible.',
            },
            {
              icon: <Lock className="w-5 h-5 text-emerald-300" />,
              title: 'Action-path binding',
              desc: 'Every uncited or weak signal is paired to a corrective path so the output can drive structured remediation, not just reporting.',
            },
          ].map((step, index) => (
            <li key={step.title} className="rounded-xl border border-white/10 bg-white/4 p-4">
              <div className="flex items-center gap-2 text-white font-semibold">
                {step.icon}
                <span>
                  {index + 1}. {step.title}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Weighted signal model</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase text-slate-500 border-b border-white/10 bg-black/20">
              <tr>
                <th className="py-3 px-4">Signal Family</th>
                <th className="py-3 px-4">Weight</th>
                <th className="py-3 px-4">Scoring Function</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 px-4 text-cyan-300">Schema and structured data</td>
                <td className="py-2 px-4">20%</td>
                <td className="py-2 px-4">
                  Entity typing, Organization/WebSite/FAQ alignment, schema completeness.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-cyan-300">Content depth</td>
                <td className="py-2 px-4">18%</td>
                <td className="py-2 px-4">
                  Coverage density, self-contained explanations, and answerability.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-cyan-300">Technical trust</td>
                <td className="py-2 px-4">15%</td>
                <td className="py-2 px-4">
                  Crawlability, canonical integrity, and machine accessibility signals.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-cyan-300">Meta tags</td>
                <td className="py-2 px-4">15%</td>
                <td className="py-2 px-4">
                  Title/description quality, consistency, and identity precision.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-cyan-300">AI readability</td>
                <td className="py-2 px-4">12%</td>
                <td className="py-2 px-4">
                  Sentence clarity, extraction friendliness, and ambiguity reduction.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-cyan-300">Heading structure</td>
                <td className="py-2 px-4">10%</td>
                <td className="py-2 px-4">Logical heading hierarchy and topic segmentation.</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-cyan-300">Security and trust</td>
                <td className="py-2 px-4">10%</td>
                <td className="py-2 px-4">
                  Transport/security confidence and trust-bearing on-page cues.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Hard caps apply when critical citation signals are missing.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Integrity and state rules</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">Append-only:</strong> ledger rows are immutable after
            commit.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">No evidence, no claim:</strong> if evidence cannot be
            validated, output must degrade to unavailable or uncited state, never fabricated
            certainty.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">No fabricated confidence:</strong> output may surface
            uncited or unavailable states, but must never invent certainty.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">Server authority:</strong> client projections may
            summarize state, but ledger-backed server outputs remain authoritative on disagreement.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Disambiguation: SEO vs AI visibility</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Traditional SEO can improve ranking without improving AI citation behavior. CITE LEDGER is
          purpose-built for AI extractability and citation readiness.
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5" />
            SEO tracks keywords, rankings, and backlinks; CITE LEDGER tracks entity clarity and
            citation state.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5" />
            SEO reports traffic outcomes; CITE LEDGER maps evidence quality and trust barriers.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5" />
            SEO can signal opportunity; CITE LEDGER provides evidence-linked fix paths for AI
            citation probability.
          </li>
        </ul>
      </section>

      <nav className="grid sm:grid-cols-3 gap-4 mt-8" aria-label="Related methodology">
        <Link
          to="/brag-methodology"
          className="p-4 rounded-lg border border-white/10 hover:border-orange-500/30 transition-colors group"
        >
          <Shield className="w-4 h-4 text-orange-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-orange-200 transition-colors">
            BRAG methodology
          </div>
          <div className="text-xs text-slate-500 mt-1">Scoring and evidence semantics</div>
        </Link>
        <Link
          to="/methodology/triple-check-protocol"
          className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group"
        >
          <Hash className="w-4 h-4 text-cyan-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-200 transition-colors">
            Triple-check protocol
          </div>
          <div className="text-xs text-slate-500 mt-1">Multi-model validation gate</div>
        </Link>
        <Link
          to="/evidence/ledger-index"
          className="p-4 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-colors group"
        >
          <Database className="w-4 h-4 text-emerald-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-emerald-200 transition-colors">
            Ledger index
          </div>
          <div className="text-xs text-slate-500 mt-1">Browse evidence outputs</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
