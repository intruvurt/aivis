import { useLocation, Link, Navigate } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import {
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildItemListSchema,
} from "../lib/seoSchema";
import {
  getPagesByCluster,
  CLUSTER_META,
  type KeywordCluster,
} from "../data/keywordPages";

const VALID_CLUSTERS = new Set<string>(Object.keys(CLUSTER_META));

export default function KeywordClusterIndex() {
  const location = useLocation();
  const cluster = location.pathname.replace(/^\//, "").replace(/\/$/, "");

  if (!cluster || !VALID_CLUSTERS.has(cluster)) {
    return <Navigate to="/" replace />;
  }

  const meta = CLUSTER_META[cluster as KeywordCluster];
  const pages = getPagesByCluster(cluster as KeywordCluster);

  return <ClusterContent meta={meta} pages={pages} />;
}

function ClusterContent({
  meta,
  pages,
}: {
  meta: (typeof CLUSTER_META)[KeywordCluster];
  pages: ReturnType<typeof getPagesByCluster>;
}) {
  usePageMeta({
    title: meta.label,
    description: meta.description,
    path: meta.basePath,
    structuredData: [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: meta.label, path: meta.basePath },
      ]),
      buildCollectionSchema(meta.label, meta.description, meta.basePath),
      buildItemListSchema(
        pages.map((p) => ({
          name: p.title,
          path: `${meta.basePath}/${p.slug}`,
        })),
        { path: meta.basePath },
      ),
    ],
  });

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-sm text-white/50 mb-8 flex items-center gap-1.5"
        >
          <Link to="/" className="hover:text-white/80 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-white/70">{meta.label}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          {meta.label}
        </h1>
        <p className="text-lg text-white/60 leading-relaxed mb-12 max-w-2xl">
          {meta.description}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pages.map((page) => (
            <Link
              key={page.slug}
              to={`${meta.basePath}/${page.slug}`}
              className="group rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all p-5"
            >
              <h2 className="text-base font-semibold mb-2 group-hover:text-white transition-colors">
                {page.title}
              </h2>
              <p className="text-sm text-white/50 leading-relaxed line-clamp-2 mb-3">
                {page.metaDescription}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-white/40 group-hover:text-white/70 transition-colors">
                Read more
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
