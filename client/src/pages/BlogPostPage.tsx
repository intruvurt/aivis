import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Clock, ExternalLink, Folder, Tag } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { getBlogBySlug, getRelatedPosts } from '../content/blogs';
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
    <div className="min-h-screen text-white">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full border border-white/10 p-2 transition-colors hover:bg-white/[0.05]" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/60" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/72">AiVIS blog</p>
            <p className="mt-1 text-sm text-white/56">Canonical publication on aivis.biz</p>
          </div>
        </div>

        <article className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1"><Folder className="h-3.5 w-3.5" />{categoryLabels[entry.category] ?? entry.category}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{entry.readMinutes} min read</span>
            <span>{entry.publishedAt}</span>
            {entry.updatedAt ? <span>Updated {entry.updatedAt}</span> : null}
          </div>

          <h1 className="mb-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">{entry.title}</h1>
          <p className="mb-6 text-lg leading-relaxed text-white/75">{entry.description}</p>

          {entry.content ? (
            <div className="mb-8 space-y-4 text-white/80 leading-relaxed">
              {entry.content
                .split(/\n\s*\n/)
                .map((block) => block.trim())
                .filter(Boolean)
                .map((block, index) => {
                  const looksLikeHeading = /^\d+\./.test(block) || (/^[A-Z][^\n]{0,100}$/.test(block) && block.split(' ').length <= 14);
                  const looksLikeDivider = /^(---|\*\*\*|———)$/.test(block);
                  const looksLikeList = block.includes('\n- ') || block.startsWith('- ');
                  const looksLikeQuote = block.startsWith('> ') || (/^[“"].+[”"]$/.test(block) && block.length < 260);

                  if (looksLikeDivider) {
                    return <hr key={`divider-${index}`} className="my-6 border-white/10" />;
                  }

                  if (looksLikeHeading) {
                    return <h3 key={`heading-${index}`} className="pt-2 text-xl font-semibold text-white">{block}</h3>;
                  }

                  if (looksLikeQuote) {
                    return (
                      <blockquote key={`quote-${index}`} className="rounded-r-2xl border-l-4 border-orange-400/60 bg-orange-950/18 px-4 py-3 italic text-white/85">
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
                        <ul key={`list-${index}`} className="list-disc space-y-2 pl-5 text-white/75 marker:text-orange-400">
                          {items.map((item) => <li key={`${index}-${item}`}>{item}</li>)}
                        </ul>
                      );
                    }
                  }

                  return <p key={`paragraph-${index}`} className="text-white/75">{block}</p>;
                })}
            </div>
          ) : null}

          <div className="mb-7 rounded-3xl border border-orange-900/40 bg-orange-950/18 p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="font-semibold text-orange-300">{entry.author.name}</h3>
                  <span className="text-xs text-orange-300/70">{entry.author.title}</span>
                </div>
                <p className="mb-3 text-sm text-white/70">{entry.author.experience}</p>
                {entry.author.expertise.length > 0 ? (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-orange-300/80"><Award className="h-3 w-3" />Expertise</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.author.expertise.map((item) => (
                        <span key={item} className="inline-flex rounded-full border border-orange-900/50 bg-orange-900/30 px-2 py-0.5 text-xs text-orange-200">{item}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="mb-4 text-lg font-semibold text-white">Key points</h2>
            <ul className="space-y-3">
              {entry.keyPoints.map((point) => (
                <li key={point} className="flex gap-3 text-white/75">
                  <span className="mt-0.5 font-bold text-orange-400">▪</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {entry.tags?.length ? (
            <div className="mb-7">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80"><Tag className="h-4 w-4" />Topics</h3>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <Link key={tag} to={`/blogs?tag=${tag}`} className="inline-flex rounded-full border border-cyan-900/40 bg-cyan-900/16 px-3 py-1.5 text-sm text-cyan-200 transition hover:border-cyan-300/40">
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mb-7 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm text-white/70">
              This article is originally published on Medium and canonically mirrored on AiVIS for ownership clarity and schema consistency.
            </p>
            <a href={entry.sourceMediumUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white/85 transition-colors hover:text-white">
              View source on Medium <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {relatedPosts.length > 0 ? (
            <div className="border-t border-white/10 pt-7">
              <h3 className="mb-4 text-lg font-semibold text-white">Related reading</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {relatedPosts.map((post) => (
                  <Link key={post.slug} to={post.path} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-cyan-300/35 hover:bg-white/[0.04]">
                    <p className="mb-2 text-xs text-white/60">{post.publishedAt}</p>
                    <h4 className="mb-1 line-clamp-2 text-sm font-semibold text-cyan-200">{post.title}</h4>
                    <p className="mb-3 line-clamp-2 text-xs text-white/70">{post.description}</p>
                    <p className="text-xs text-white/50">{post.readMinutes} min read</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </main>
    </div>
  );
}
