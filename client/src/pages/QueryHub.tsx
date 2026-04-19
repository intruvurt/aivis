/**
 * Query Hub - Entry point for the query matrix system
 *
 * Lists all generated query nodes with:
 * - Search/filter
 * - Intent grouping
 * - Related clusters
 * - Dynamic expansion
 */

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

interface QueryNode {
  slug: string;
  intent: string;
  type: 'audit' | 'checker' | 'report' | 'analysis' | 'tool';
  seed: string;
  canonical: string;
}

export default function QueryHub() {
  const [queries, setQueries] = useState<QueryNode[]>([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load generated queries at build time
    const loadQueries = async () => {
      try {
        const response = await fetch('/src/generated/queries.json');
        const data = await response.json();
        setQueries(data);
      } catch (err) {
        console.error('Failed to load queries:', err);
        setQueries([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadQueries();
  }, []);

  const filtered = useMemo(() => {
    let result = queries;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (query) =>
          query.slug.includes(q) ||
          query.intent.toLowerCase().includes(q) ||
          query.seed.toLowerCase().includes(q)
      );
    }

    if (selectedType) {
      result = result.filter((query) => query.type === selectedType);
    }

    return result;
  }, [queries, search, selectedType]);

  const typeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    queries.forEach((q) => {
      dist[q.type] = (dist[q.type] || 0) + 1;
    });
    return dist;
  }, [queries]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <p className="text-slate-300 mt-4">Loading query matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero */}
      <div className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-b border-slate-700">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Query Matrix Hub</h1>
          <p className="text-lg text-slate-300 mb-8">
            Explore {queries.length} deterministic visibility audit nodes. Each query triggers your
            scan pipeline and feeds your entity graph.
          </p>

          {/* Search */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Search queries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 rounded bg-slate-800 text-white placeholder-slate-400 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType(null)}
              className={`px-4 py-2 rounded text-sm font-semibold transition-all ${
                selectedType === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All
            </button>
            {Object.entries(typeDistribution).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded text-sm font-semibold transition-all ${
                  selectedType === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {type} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <p className="text-slate-400 mb-6">
            Showing {filtered.length} of {queries.length} queries
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((query) => (
              <Link
                key={query.slug}
                to={`/query/${query.slug}`}
                className="p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/20"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white flex-1">{query.intent}</h3>
                  <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 ml-2">
                    {query.type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  <code className="text-purple-400">{query.canonical}</code>
                </p>
                <p className="text-sm text-slate-300 flex-grow">
                  Audit your site's {query.seed.toLowerCase()}
                </p>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">No queries found matching your search.</p>
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedType(null);
                }}
                className="mt-4 px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
