import { useState } from "react";
import { useParams, useLocation, Link, Navigate } from "react-router-dom";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildFaqSchema } from "../lib/seoSchema";
import {
  getPageBySlug,
  CLUSTER_META,
  type KeywordCluster,
} from "../data/keywordPages";

const VALID_CLUSTERS = new Set<string>(Object.keys(CLUSTER_META));

export default function KeywordPageTemplate() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  // Derive cluster from the first path segment: /platforms/wordpress → "platforms"
  const pathCluster = location.pathname.split("/")[1];

  if (!slug || !pathCluster || !VALID_CLUSTERS.has(pathCluster)) {
    return <Navigate to="/" replace />;
  }

  const cluster = pathCluster as KeywordCluster;
  const page = getPageBySlug(cluster, slug);
  if (!page) {
    return <Navigate to="/" replace />;
  }

  const meta = CLUSTER_META[cluster];
  const basePath = `${meta.basePath}/${page.slug}`;

  return <KeywordPageContent page={page} meta={meta} basePath={basePath} />;
}

/* ── Inner component (hooks are safe here — always rendered) ── */
function KeywordPageContent({
  page,
  meta,
  basePath,
}: {
  page: NonNullable<ReturnType<typeof getPageBySlug>>;
  meta: (typeof CLUSTER_META)[KeywordCluster];
  basePath: string;
}) {
  usePageMeta({
    title: page.metaTitle,
    description: page.metaDescription,
    path: basePath,
    structuredData: [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: meta.label, path: meta.basePath },
        { name: page.title, path: basePath },
      ]),
      ...(page.faqs.length > 0
        ? [buildFaqSchema(page.faqs)]
        : []),
    ],
  });

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-sm text-white/50 mb-8 flex items-center gap-1.5 flex-wrap"
        >
          <Link to="/" className="hover:text-white/80 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link
            to={meta.basePath}
            className="hover:text-white/80 transition-colors"
          >
            {meta.label}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-white/70">{page.title}</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
          {page.title}
        </h1>

        {/* Hook paragraph */}
        <p className="text-lg text-white/70 leading-relaxed mb-12">
          {page.hook}
        </p>

        {/* Sections */}
        {page.sections.map((section, i) => (
          <section key={i} className="mb-10">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4">
              {section.heading}
            </h2>
            {section.content.map((para, j) => (
              <p
                key={j}
                className="text-white/70 leading-relaxed mb-4 last:mb-0"
              >
                {para}
              </p>
            ))}
          </section>
        ))}

        {/* FAQs */}
        {page.faqs.length > 0 && (
          <section className="mt-14 mb-12">
            <h2 className="text-xl sm:text-2xl font-semibold mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {page.faqs.map((faq, i) => (
                <FaqAccordion key={i} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </section>
        )}

        {/* Internal links */}
        {page.internalLinks.length > 0 && (
          <section className="mt-12 mb-14">
            <h2 className="text-lg font-semibold mb-4 text-white/60">
              Related
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {page.internalLinks.map((link, i) => (
                <Link
                  key={i}
                  to={link.to}
                  className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 hover:text-white hover:border-white/25 transition-all"
                >
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 text-center">
          <Link
            to={page.ctaLink}
            className="inline-flex items-center gap-2 rounded-lg bg-white text-black font-semibold px-6 py-3 text-sm hover:bg-white/90 transition-colors"
          >
            {page.ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </article>
    </div>
  );
}

/* ── FAQ accordion item ── */
function FaqAccordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white/90 hover:text-white transition-colors"
        aria-expanded={open}
      >
        {question}
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-white/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-white/60 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
