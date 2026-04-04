import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, X, Clock, Tag, Folder } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { BLOG_ENTRIES, getAllTags, getAllCategories, filterEntries, BlogTag, BlogCategory } from '../content/blogs';
import { buildBreadcrumbSchema, buildCollectionSchema, buildItemListSchema } from '../lib/seoSchema';
import PublicPageFrame from '../components/PublicPageFrame';

export default function BlogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<BlogTag[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<BlogCategory[]>([]);
  const [readTimeRange, setReadTimeRange] = useState<{ min: number; max: number }>({ min: 0, max: 20 });
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'readtime-asc' | 'readtime-desc'>('newest');

  const allTags = useMemo(() => getAllTags(), []);
  const allCategories = useMemo(() => getAllCategories(), []);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let results = filterEntries({
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      searchQuery: searchQuery || undefined,
      minReadTime: readTimeRange.min,
      maxReadTime: readTimeRange.max,
    });

    // Sort
    switch (sortBy) {
      case 'oldest':
        results.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
        break;
      case 'readtime-asc':
        results.sort((a, b) => a.readMinutes - b.readMinutes);
        break;
      case 'readtime-desc':
        results.sort((a, b) => b.readMinutes - a.readMinutes);
        break;
      case 'newest':
      default:
        results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
    }

    return results;
  }, [selectedTags, selectedCategories, searchQuery, readTimeRange, sortBy]);

  const featuredPosts = useMemo(() => BLOG_ENTRIES.filter((entry) => entry.featured).slice(0, 3), []);

  const categoryLabels: Record<BlogCategory, string> = {
    aeo: 'Answer Engine Optimization',
    seo: 'Traditional SEO',
    geo: 'Geo-Targeting',
    eeat: 'E-E-A-T & Authority',
    technology: 'AI Technology',
    strategy: 'Strategy & Growth',
    'case-study': 'Case Studies',
    implementation: 'Implementation',
  };

  const categoryIcons: Record<BlogCategory, string> = {
    aeo: '🎯',
    seo: '📊',
    geo: '📍',
    eeat: '⭐',
    technology: '⚙️',
    strategy: '🧠',
    'case-study': '📈',
    implementation: '🚀',
  };

  const toggleTag = (tag: BlogTag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const toggleCategory = (cat: BlogCategory) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setSelectedCategories([]);
    setReadTimeRange({ min: 0, max: 20 });
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || selectedTags.length > 0 || selectedCategories.length > 0 || sortBy !== 'newest';

  usePageMeta({
    title: 'AiVIS Blogs | AI Visibility, Citation, and Answer Engine Optimization Essays',
    description:
      'Enterprise blog on Answer Engine Optimization, AI visibility, content extractability, citations, and the future of search. Written by AiVIS founder.',
    path: '/blogs',
    ogTitle: 'AiVIS Blogs',
    structuredData: [
      buildCollectionSchema(
        'AiVIS Blogs',
        'Enterprise blog on AI visibility, Answer Engine Optimization, citation readiness, and visionary content strategy.',
        '/blogs'
      ),
      buildItemListSchema(filteredEntries.map((entry) => ({ name: entry.title, path: entry.path }))),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Blogs', path: '/blogs' },
      ]),
    ],
  });

  return (
    <PublicPageFrame icon={BookOpen} title="AiVIS Insights" subtitle="Enterprise blog on AI visibility, extractability, and citations." maxWidthClass="max-w-6xl">
        {/* Featured carousel */}
        {featuredPosts.length > 0 && !hasActiveFilters && (
          <section className="mb-12">
            <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4">Featured</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {featuredPosts.map((entry) => (
                <Link key={entry.slug} to={entry.path} className="group rounded-2xl border border-white/10 bg-gradient-to-br from-charcoal to-charcoal-deep p-5 hover:border-orange-400/50 transition-all">
                  <div className="flex items-center justify-between mb-3 text-xs text-white/60">
                    <span className="flex items-center gap-1">
                      <Folder className="h-3 w-3" />
                      {categoryLabels[entry.category]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {entry.readMinutes} min
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-orange-300 group-hover:text-orange-200 mb-2 line-clamp-3">{entry.title}</h3>
                  <p className="text-sm text-white/70 mb-3 line-clamp-2">{entry.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {entry.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="inline-flex text-xs px-2 py-1 rounded bg-orange-900/30 text-orange-300 border border-orange-900/50">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-white/50">{entry.publishedAt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Search and filters */}
        <section className="mb-10 space-y-4">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Search & Filter</h2>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search posts by title, topic, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-white/10 bg-charcoal text-white placeholder-white/40 focus:border-orange-400/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Category buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/60">Category</label>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    selectedCategories.includes(cat)
                      ? 'bg-orange-500/20 border-orange-400/60 text-orange-300'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                  }`}
                >
                  {categoryIcons[cat]} {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Tag cloud */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/60 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Topics
            </label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-900/30 border-blue-400/60 text-blue-300'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Reading time slider */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/60 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Reading time: {readTimeRange.min}-{readTimeRange.max} minutes
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="range"
                min="0"
                max="20"
                value={readTimeRange.min}
                onChange={(e) => setReadTimeRange((prev) => ({ ...prev, min: Math.min(parseInt(e.target.value), prev.max) }))}
                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-400"
              />
              <input
                type="range"
                min="0"
                max="20"
                value={readTimeRange.max}
                onChange={(e) => setReadTimeRange((prev) => ({ ...prev, max: Math.max(parseInt(e.target.value), prev.min) }))}
                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-400"
              />
            </div>
          </div>

          {/* Sort and clear */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2 items-center">
              <label className="text-xs font-semibold text-white/60">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-charcoal text-sm text-white focus:border-orange-400/50 focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="readtime-asc">Shortest read</option>
                <option value="readtime-desc">Longest read</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </section>

        {/* Results count */}
        <div className="mb-6 text-sm text-white/60">
          {filteredEntries.length === 0 ? (
            <p>No posts match your filters. Try adjusting your search.</p>
          ) : (
            <p>{filteredEntries.length} post{filteredEntries.length !== 1 ? 's' : ''} found</p>
          )}
        </div>

        {/* Blog grid */}
        {filteredEntries.length > 0 && (
          <section className="grid md:grid-cols-2 gap-5">
            {filteredEntries.map((entry) => (
              <article key={entry.slug} className="rounded-2xl border border-white/10 hover:border-orange-400/30 bg-charcoal p-6 transition-all hover:shadow-lg hover:shadow-orange-900/20">
                <div className="flex items-center justify-between mb-3 text-xs text-white/60 gap-2">
                  <span className="flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    {categoryLabels[entry.category]}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" />
                    {entry.readMinutes} min
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400 mb-2 line-clamp-2">
                  {entry.title}
                </h2>
                <p className="text-sm text-white/75 mb-4 leading-relaxed line-clamp-3">{entry.description}</p>

                {/* Tags */}
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => !selectedTags.includes(tag) && toggleTag(tag)}
                        className="inline-flex text-xs px-2 py-0.5 rounded bg-white/10 text-white/70 hover:bg-white/20 cursor-pointer transition-colors border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{entry.publishedAt}</span>
                  <Link to={entry.path} className="inline-flex items-center px-3 py-1.5 text-sm font-semibold text-white/85 hover:text-white rounded-lg hover:bg-white/5 transition">
                    Read →
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
    </PublicPageFrame>
  );
}
