/**
 * QueryPage - Deterministic query-driven visibility node
 *
 * Each /query/{slug} renders:
 * - Metadata with unique canonical URL
 * - Cite-ledger injection for external AI/crawler access
 * - Immediate cached insight
 * - Scan CTA (optional auto-trigger)
 * - Schema injection
 * - Related query linking
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getPrecomputedCache, getRelatedQueries, mapQueryToScanIntent } from '../lib/queryCache.js';
import { useQueryPageMetadata } from '../hooks/usePageMetadata';
import { generateCiteLedgerMeta, generateScoresFromAudit, extractCitationsFromAudit, extractEntitiesFromAudit } from '../lib/citeLedgerMeta';
import type { PrecomputedCache } from '../lib/queryCache.js';
import type { CiteLedgerMeta } from '../lib/citeLedgerMeta';

interface QueryPageProps {
  onScanTrigger?: (slug: string, url: string) => void;
}

export default function QueryPage({ onScanTrigger }: QueryPageProps) {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [cache, setCache] = useState<PrecomputedCache | null>(null);
  const [related, setRelated] = useState<string[]>([]);
  const [userUrl, setUserUrl] = useState('');
  const [showScanForm, setShowScanForm] = useState(false);

  useEffect(() => {
    const data = getPrecomputedCache(slug);
    setCache(data);
    setRelated(getRelatedQueries(slug));

    if (!data) {
      // 404 - query not found
      navigate('/');
    }
  }, [slug, navigate]);

  // Generate cite-ledger metadata (machine-readable evidence graph)
  const citeLedgerMeta: CiteLedgerMeta | undefined = useMemo(() => {
    if (!cache) return undefined;

    // Generate scores from cache (would be from actual audit in production)
    const scores = generateScoresFromAudit({
      category_grades: {
        schema_structured_data: cache.expectedScore.typical > 60 ? 'B' : 'C',
        meta_tags_open_graph: cache.expectedScore.typical > 50 ? 'B' : 'C',
        heading_structure: cache.expectedScore.typical > 55 ? 'B' : 'C',
        content_depth_quality: cache.expectedScore.typical > 65 ? 'A' : 'B',
        technical_trust: cache.expectedScore.typical > 60 ? 'B' : 'C',
      },
      visibility_score: cache.expectedScore.typical,
    });

    // Extract audit findings (would be from real audit response)
    const citations = extractCitationsFromAudit({
      url: `https://aivis.biz/query/${slug}`,
      findings: cache.insights?.map((insight, idx) => ({
        evidence_id: `query-${slug}-insight-${idx}`,
        element_type: 'insight',
        confidence: 85,
        extract_ready: true,
      })),
    });

    const entities = extractEntitiesFromAudit({
      entities: [
        {
          id: 'aivis-query-page',
          name: 'AiVIS Query Page',
          type: 'SoftwareApplication',
          clarity_score: 90,
          mention_count: 1,
        },
      ],
    });

    return generateCiteLedgerMeta({
      page: `https://aivis.biz/query/${slug}`,
      citations,
      entities,
      scores,
      auditChain: undefined, // Would be populated from server-side ledger service
    });
  }, [cache, slug]);

  // Set page metadata with cite-ledger injection
  useQueryPageMetadata(
    slug,
    cache?.title || 'Query | AiVIS',
    cache?.description || 'AiVIS Query Analysis',
    undefined,
    citeLedgerMeta
  );

  if (!cache) return null;

  const scanIntent = mapQueryToScanIntent(slug);

  const handleTriggerScan = async () => {
    const url = (userUrl || '').trim();
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    onScanTrigger?.(slug, url);
  };

  // Structured data for index (JSON-LD schema validation compliant)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: cache.title,
    description: cache.description,
    about: {
      '@type': 'Thing',
      name: slug.replace(/-/g, ' '),
    },
    mainEntity: {
      '@type': 'SoftwareApplication',
      name: 'AIVIS Query',
      applicationCategory: 'UtilitiesApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    dateModified: new Date().toISOString(),
  };

  return (

      {/* Hero */}
      <div className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {cache.title.replace(' | AIVIS', '')}
          </h1>
          <p className="text-lg text-slate-300 mb-8">{cache.description}</p>

          {/* CTA Button */}
          <button
            onClick={() => setShowScanForm(!showScanForm)}
            className="inline-flex items-center px-6 py-3 rounded-lg font-semibold transition-all bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/50"
          >
            {scanIntent.autoTrigger ? 'Run Audit' : 'Check Your Site'}
            <span className="ml-2">→</span>
          </button>
        </div>
      </div>

      {/* Scan Form (conditional) */}
      {showScanForm && (
        <div className="px-4 sm:px-6 lg:px-8 py-8 bg-slate-800/50 border-t border-b border-slate-700">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://yoursite.com"
                value={userUrl}
                onChange={(e) => setUserUrl(e.target.value)}
                className="flex-1 px-4 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleTriggerScan}
                className="px-6 py-2 rounded font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Test
              </button>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              We'll analyze your site's {cache.title.toLowerCase()} and provide a detailed report.
            </p>
          </div>
        </div>
      )}

      {/* Insights Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Key Insights</h2>
          <div className="grid gap-4">
            {cache.insights.map((insight, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                <p className="text-slate-100">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expected Score Range */}
      <div className="px-4 sm:px-6 lg:px-8 py-12 bg-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Typical Score Distribution</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-6 rounded-lg bg-slate-700 border border-slate-600">
              <p className="text-slate-400 text-sm">Minimum</p>
              <p className="text-3xl font-bold text-blue-400">{cache.expectedScore.min}</p>
            </div>
            <div className="p-6 rounded-lg bg-slate-700 border border-slate-600">
              <p className="text-slate-400 text-sm">Typical Site</p>
              <p className="text-3xl font-bold text-purple-400">{cache.expectedScore.typical}</p>
            </div>
            <div className="p-6 rounded-lg bg-slate-700 border border-slate-600">
              <p className="text-slate-400 text-sm">Maximum</p>
              <p className="text-3xl font-bold text-green-400">{cache.expectedScore.max}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Checks */}
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">What We'll Check</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {cache.recommendedChecks.map((check, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-purple-400 mr-3">✓</span>
                <span className="text-slate-100">{check}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Related Queries */}
      {related.length > 0 && (
        <div className="px-4 sm:px-6 lg:px-8 py-12 bg-slate-800/50 border-t border-slate-700">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Related Topics</h2>
            <div className="flex flex-wrap gap-3">
              {related.map((q) => (
                <a
                  key={q}
                  href={`/query/${q}`}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors text-sm"
                >
                  {q.replace(/-/g, ' ')}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CTA Footer */}
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Improve?</h2>
          <p className="text-slate-300 mb-6">
            Get a complete visibility audit and actionable recommendations.
          </p>
          <button
            onClick={() => setShowScanForm(true)}
            className="inline-flex items-center px-8 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Start Your {cache.title.split(' ')[0]} →
          </button>
        </div>
      </div>
    </div>
  );
}
