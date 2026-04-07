import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "./PublicPageFrame";
import type { KeywordPage, ClusterMeta } from "../data/keywordPages/types";

interface Props {
  page: KeywordPage;
  clusterMeta: ClusterMeta;
  icon: LucideIcon;
}

export default function KeywordPageShell({ page, clusterMeta, icon }: Props) {
  usePageMeta({
    title: page.metaTitle,
    description: page.metaDescription,
    path: `${clusterMeta.basePath}/${page.slug}`,
    ogTitle: page.metaTitle,
    ogDescription: page.metaDescription,
    ogType: "article",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: page.title,
        description: page.metaDescription,
        url: `https://aivis.biz${clusterMeta.basePath}/${page.slug}`,
        mainEntity: {
          "@type": "FAQPage",
          mainEntity: page.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://aivis.biz/" },
          { "@type": "ListItem", position: 2, name: clusterMeta.label, item: `https://aivis.biz${clusterMeta.basePath}` },
          { "@type": "ListItem", position: 3, name: page.title },
        ],
      },
    ],
  });

  return (
    <PublicPageFrame
      icon={icon}
      title={page.title}
      subtitle={page.hook}
      backTo={clusterMeta.basePath}
      maxWidthClass="max-w-4xl"
    >
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1 text-sm text-white/50">
        <Link to="/" className="hover:text-white/80 transition-colors">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to={clusterMeta.basePath} className="hover:text-white/80 transition-colors">{clusterMeta.label}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/70">{page.title}</span>
      </nav>

      {/* Content sections */}
      <div className="space-y-10">
        {page.sections.map((section) => (
          <section key={section.heading} id={section.heading.toLowerCase().replace(/\s+/g, "-")}>
            <h2 className="text-2xl font-semibold tracking-tight text-white mb-4">{section.heading}</h2>
            <div className="space-y-4">
              {section.content.map((paragraph, i) => (
                <p key={i} className="text-[15px] leading-7 text-white/72">{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* FAQs */}
      {page.faqs.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Frequently asked questions</h2>
          <div className="mt-5 space-y-3">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="text-[15px] font-medium text-white/90">{faq.question}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/45 transition group-open:rotate-180" />
                </summary>
                <p className="mt-4 text-sm leading-7 text-white/64">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Internal links */}
      {page.internalLinks.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-white/80 mb-4">Related resources</h2>
          <div className="flex flex-wrap gap-3">
            {page.internalLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white/90"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mt-14 rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent p-8 text-center">
        <h2 className="text-xl font-semibold text-white mb-3">Ready to find out what AI can see?</h2>
        <p className="text-white/64 mb-6 max-w-lg mx-auto">{page.ctaText}</p>
        <Link
          to={page.ctaLink}
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-orange-400"
        >
          Run your audit <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PublicPageFrame>
  );
}
