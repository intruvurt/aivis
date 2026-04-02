import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Tag, Folder, Clock, Award } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { BLOG_ENTRIES, getBlogBySlug, getRelatedPosts } from '../content/blogs';
import { buildArticleSchema, buildBreadcrumbSchema, buildWebPageSchema } from '../lib/seoSchema';

const categoryLabels: Record<string, string> = {
  aeo: 'Answer Engine Optimization',
  seo: 'Traditional SEO',
  geo: 'Geo-Targeting',
  eeat: 'E-E-A-T & Authority',
  technology: 'AI Technology',
  strategy: 'Strategy & Growth',
  'case-study': 'Case Studies',
  implementation: 'Implementation',
};

export default function BlogPostPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const entry = slug ? getBlogBySlug(slug) : undefined;
  const relatedPosts = entry ? getRelatedPosts(entry) : [];

  if (!entry) return <Navigate to="/blogs" replace />;

  usePageMeta({
    title: `${entry.title} | AiVIS Blogs`,
    description: entry.description,
    path: entry.path,
    ogTitle: entry.title,
    ogType: 'article',
    structuredData: [
      buildArticleSchema({
        title: entry.title,
        description: entry.description,
        path: entry.path,
        datePublished: entry.publishedAt,
      }),
      buildWebPageSchema({
        path: entry.path,
        name: entry.title,
        description: entry.description,
        mainEntityId: `https://aivis.biz${entry.path}#article`,
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Blogs', path: '/blogs' },
        { name: entry.title, path: entry.path },
      ]),
    ],
  });

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
      <header className="border-b border-white/10 bg-charcoal-deep sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl brand-title">AiVIS Blog</h1>
            <p className="text-sm text-white/60 leading-relaxed">Canonical publication on aivis.biz</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <article className="rounded-2xl border border-white/10 bg-charcoal p-7">
          {/* Metadata row */}
          <div className="flex items-center gap-4 mb-4 text-xs text-white/60 flex-wrap">
            <span className="flex items-center gap-1">
              <Folder className="h-3.5 w-3.5" />
              {categoryLabels[entry.category] ?? entry.category}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {entry.readMinutes} min read
            </span>
            <span>{entry.publishedAt}</span>
            {entry.updatedAt && <span>Updated {entry.updatedAt}</span>}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl brand-title mb-4">{entry.title}</h1>

          {/* Description */}
          <p className="text-white/75 leading-relaxed mb-6 text-lg">{entry.description}</p>

          {entry.content && (
            <div className="mb-8 space-y-4 text-white/80 leading-relaxed">
              {entry.content
                .split(/\n\s*\n/)
                .map((block) => block.trim())
                .filter(Boolean)
                .map((block, index) => {
                  const looksLikeHeading =
                    /^\d+\./.test(block) ||
                    (/^[A-Z][^\n]{0,100}$/.test(block) && block.split(' ').length <= 14);
                  const looksLikeDivider = /^(-{3,}|—{3,}|\*{3,})$/.test(block);
                  const looksLikeList = block.includes('\n- ') || block.startsWith('- ');
                  const looksLikeQuote =
                    block.startsWith('> ') ||
                    (/^[“"].+[”"]$/.test(block) && block.length < 260);

                  if (looksLikeDivider) {
                    return <hr key={`content-divider-${index}`} className="border-white/10 my-6" />;
                  }

                  if (looksLikeHeading) {
                    return (
                      <h3 key={`content-heading-${index}`} className="text-xl font-semibold text-white pt-2">
                        {block}
                      </h3>
                    );
                  }

                  if (looksLikeQuote) {
                    return (
                      <blockquote
                        key={`content-quote-${index}`}
                        className="border-l-4 border-orange-400/60 bg-orange-950/20 rounded-r-lg px-4 py-3 italic text-white/85"
                      >
                        {block.replace(/^>\s*/, '')}
                      </blockquote>
                    );
                  }

                  if (looksLikeList) {
                    const items = block
                      .split('\n')
                      .map((line) => line.trim())
                      .filter((line) => line.startsWith('- '))
                      .map((line) => line.replace(/^-\s+/, ''));

                    if (items.length > 0) {
                      return (
                        <ul key={`content-list-${index}`} className="space-y-2 text-white/75 pl-5 list-disc marker:text-orange-400">
                          {items.map((item) => (
                            <li key={`${index}-${item}`}>{item}</li>
                          ))}
                        </ul>
                      );
                    }
                  }

                  return (
                    <p key={`content-paragraph-${index}`} className="text-white/75">
                      {block}
                    </p>
                  );
                })}
            </div>
          )}

          {/* Author EEAT card */}
          <div className="rounded-xl border border-orange-900/50 bg-orange-900/10 p-5 mb-7">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-orange-300">{entry.author.name}</h3>
                  <span className="text-xs text-orange-300/70">{entry.author.title}</span>
                </div>
                <p className="text-sm text-white/70 mb-3">{entry.author.experience}</p>
                <div className="space-y-2">
                  {entry.author.expertise.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-orange-300/80 mb-1 flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        Expertise
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.author.expertise.map((exp) => (
                          <span key={exp} className="inline-flex text-xs px-2 py-0.5 rounded bg-orange-900/30 text-orange-200 border border-orange-900/50">
                            {exp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {entry.author.credentials && entry.author.credentials.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-orange-300/80 mb-1">Credentials</p>
                      <ul className="text-xs text-white/70 space-y-0.5">
                        {entry.author.credentials.map((cred) => (
                          <li key={cred}>✓ {cred}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Key points */}
          <div className="mb-7">
            <h2 className="text-lg font-semibold text-white mb-4">Key points</h2>
            <ul className="space-y-3">
              {entry.keyPoints.map((point) => (
                <li key={point} className="flex gap-3 text-white/75">
                  <span className="text-orange-400 font-bold mt-0.5">▪</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="mb-7">
              <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/blogs?tag=${tag}`}
                    className="inline-flex text-sm px-3 py-1.5 rounded-lg bg-blue-900/20 text-blue-300 border border-blue-900/50 hover:border-blue-400/50 transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Source link */}
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4 mb-7">
            <p className="text-sm text-white/70">
              This article is originally published on Medium and canonically mirrored on AiVIS for ownership clarity and schema consistency.
            </p>
            <a
              href={entry.sourceMediumUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-white/85 hover:text-white transition-colors"
            >
              View source on Medium <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <div className="border-t border-white/10 pt-7">
              <h3 className="text-lg font-semibold text-white mb-4">Related reading</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {relatedPosts.map((post) => (
                  <Link
                    key={post.slug}
                    to={post.path}
                    className="rounded-lg border border-white/10 bg-charcoal-deep p-4 hover:border-blue-400/50 hover:bg-charcoal transition-all"
                  >
                    <p className="text-xs text-white/60 mb-2">{post.publishedAt}</p>
                    <h4 className="text-sm font-semibold text-blue-300 mb-1 line-clamp-2">{post.title}</h4>
                    <p className="text-xs text-white/70 mb-3 line-clamp-2">{post.description}</p>
                    <p className="text-xs text-white/50">{post.readMinutes} min read</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="border-t border-white/10 pt-7">
            <Link to="/blogs" className="inline-flex items-center text-sm font-semibold text-white/85 hover:text-white transition-colors">
              ← Back to all posts
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
