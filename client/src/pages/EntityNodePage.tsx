import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Database, ExternalLink, FileText, Loader2, Network, ShieldCheck } from 'lucide-react';
import type { AnalysisResponse } from '@shared/types';

import { API_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import { toSafeHref } from '../utils/safeHref';

interface PublicEntityEvidenceEntry {
  identifier: string;
  title: string;
  severity: string;
  confidence: number;
  evidence_keys: string[];
  content_hash: string | null;
  chain_hash: string | null;
  timestamp: string | null;
}

interface PublicEntitySnapshotSummary {
  audit_id: string;
  share_slug: string;
  share_path: string;
  entity_audit_path: string;
  created_at: string;
  visibility_score: number;
  summary: string;
  analysis_tier: string;
  analysis_tier_display: string;
  url: string;
}

interface PublicEntityNodePayload {
  entity_slug: string;
  entity_name: string;
  canonical_target_url: string;
  canonical_entity_path: string;
  public_api_path: string;
  machine_endpoint_path: string;
  definition: string;
  latest_snapshot: PublicEntitySnapshotSummary;
  snapshots: PublicEntitySnapshotSummary[];
  evidence_layer: PublicEntityEvidenceEntry[];
  key_signals: string[];
  latest_result: AnalysisResponse | null;
  latest_owner_tier: string;
}

function shortHash(value: string | null | undefined): string {
  const source = String(value || '');
  if (!source) return 'uncomputed';
  return source.length <= 18 ? source : `${source.slice(0, 12)}...${source.slice(-6)}`;
}

export default function EntityNodePage() {
  const { entitySlug } = useParams<{ entitySlug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [node, setNode] = useState<PublicEntityNodePayload | null>(null);

  const pageMeta = useMemo(() => {
    const path = entitySlug ? `/entity/${entitySlug}` : '/entity';
    if (!node) {
      return {
        title: 'Entity Audit Node',
        description: 'Public AiVIS entity node with evidence-backed AI visibility audit snapshots and CITE ledger hashes.',
        path,
        ogTitle: 'AiVIS Entity Audit Node',
      };
    }

    const latest = node.latest_snapshot;
    const result = node.latest_result;
    const dataset = {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `AI Visibility Audit — ${node.entity_name}`,
      description: `Evidence-based AI visibility audit node for ${node.entity_name}.`,
      url: `https://aivis.biz${node.canonical_entity_path}`,
      datePublished: latest.created_at,
      creator: {
        '@type': 'Organization',
        name: 'AiVIS',
      },
      about: {
        '@type': 'Thing',
        name: node.entity_name,
        sameAs: node.canonical_target_url,
      },
      variableMeasured: [
        {
          '@type': 'PropertyValue',
          name: 'visibility_score',
          value: Number(latest.visibility_score || 0) / 100,
        },
        {
          '@type': 'PropertyValue',
          name: 'chatgpt_score',
          value: Number(result?.ai_platform_scores?.chatgpt || 0) / 100,
        },
        {
          '@type': 'PropertyValue',
          name: 'perplexity_score',
          value: Number(result?.ai_platform_scores?.perplexity || 0) / 100,
        },
      ],
    };

    const ledger = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: `${node.entity_name} Audit Evidence Ledger`,
      identifier: latest.audit_id,
      hasPart: node.evidence_layer.slice(0, 20).map((entry) => ({
        '@type': 'CreativeWork',
        identifier: entry.identifier,
        name: entry.title,
        encoding: {
          '@type': 'MediaObject',
          sha256: entry.content_hash || 'uncomputed',
        },
      })),
    };

    const webpage = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `https://aivis.biz${node.canonical_entity_path}#webpage`,
      name: `${node.entity_name} AI Visibility Audit`,
      url: `https://aivis.biz${node.canonical_entity_path}`,
      description: node.definition,
      datePublished: latest.created_at,
      mainEntity: {
        '@type': 'Thing',
        name: node.entity_name,
        sameAs: node.canonical_target_url,
      },
    };

    return {
      title: `${node.entity_name} AI Visibility Audit`,
      description: `${node.entity_name} knowledge node with score ${latest.visibility_score}/100, evidence signals, and public audit snapshots.`,
      path: node.canonical_entity_path,
      ogTitle: `${node.entity_name} AI Visibility Audit`,
      ogDescription: `${node.entity_name} is tracked by AiVIS as a public, evidence-backed AI visibility node.`,
      ogType: 'article',
      structuredData: [dataset, ledger, webpage],
    };
  }, [entitySlug, node]);

  usePageMeta(pageMeta);

  useEffect(() => {
    if (!entitySlug) {
      setError('Missing entity slug');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const path = `/api/public/entities/${encodeURIComponent(entitySlug)}`;
        const candidates = [path, `${API_URL}${path}`].filter((value, index, arr) => arr.indexOf(value) === index);
        let lastError = 'Failed to load entity node';

        for (const endpoint of candidates) {
          const res = await fetch(endpoint, { signal: controller.signal });
          const contentType = String(res.headers.get('content-type') || '').toLowerCase();
          if (!res.ok) {
            if (contentType.includes('application/json')) {
              const payload = await res.json().catch(() => ({}));
              lastError = payload?.error || `Could not load entity node (${res.status})`;
            } else {
              lastError = `Could not load entity node (${res.status})`;
            }
            continue;
          }
          if (!contentType.includes('application/json')) {
            lastError = 'Entity node endpoint returned non-JSON content';
            continue;
          }
          const payload = (await res.json()) as PublicEntityNodePayload;
          if (payload?.latest_snapshot?.audit_id) {
            setNode(payload);
            return;
          }
          lastError = 'Entity node payload was incomplete';
        }

        throw new Error(lastError);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Failed to load entity node');
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [entitySlug]);

  return (
    <div className="text-white">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to AiVIS.biz
        </Link>
        {node && (
          <a
            href={toSafeHref(node.canonical_target_url) || undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 transition-colors"
          >
            View canonical site
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-8 flex items-center gap-3 text-white/75">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-300" />
            Loading entity node...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-white/10 bg-charcoal p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-white/80 font-semibold">Unable to open entity node</p>
                <p className="text-white/80 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && node && (
          <>
            <header className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
              <div className="flex items-center gap-2 text-cyan-300 mb-2">
                <Network className="w-5 h-5" />
                <p className="text-sm font-semibold uppercase tracking-wide">Public Entity Node</p>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-400">
                {node.entity_name} AI Visibility Audit
              </h1>
              <p className="text-white/70 mt-3 text-sm leading-7">{node.definition}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Visibility Score</p>
                  <p className="text-3xl font-bold text-white mt-1">{node.latest_snapshot.visibility_score}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Latest Snapshot</p>
                  <p className="text-sm font-semibold text-white mt-2">{new Date(node.latest_snapshot.created_at).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Public Endpoint</p>
                  <a href={node.public_api_path} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100 mt-2 inline-flex items-center gap-1">
                    {node.public_api_path}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </header>

            <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
              <div className="flex items-center gap-2 mb-3 text-emerald-300">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="text-lg font-semibold text-white">Audit Snapshot</h2>
              </div>
              <p className="text-sm text-white/75 leading-7">{node.latest_snapshot.summary || node.latest_result?.summary || 'Latest public audit snapshot for this entity.'}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Definition Anchor</p>
                  <p className="text-sm text-white/75 mt-2">
                    {node.entity_name} is an AI visibility audit target measured by AiVIS to see how answer engines interpret and cite the entity.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Latest Public Audit</p>
                  <Link to={node.latest_snapshot.entity_audit_path} className="inline-flex items-center gap-2 text-cyan-200 hover:text-cyan-100 text-sm font-semibold mt-2">
                    Open snapshot page
                    <FileText className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.25fr,0.9fr]">
              <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
                <h2 className="text-lg font-semibold text-white mb-3">Evidence Signals</h2>
                {node.key_signals.length > 0 ? (
                  <ul className="space-y-2 text-sm text-white/75">
                    {node.key_signals.map((signal) => (
                      <li key={signal} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        {signal}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/55">No public evidence signals were available for this snapshot.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
                <div className="flex items-center gap-2 mb-3 text-amber-300">
                  <Database className="w-5 h-5" />
                  <h2 className="text-lg font-semibold text-white">Machine Layer</h2>
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-white/45">Canonical URL</dt>
                    <dd className="text-white/80 mt-1 break-all">{node.canonical_target_url}</dd>
                  </div>
                  <div>
                    <dt className="text-white/45">Entity Path</dt>
                    <dd className="text-white/80 mt-1">{node.canonical_entity_path}</dd>
                  </div>
                  <div>
                    <dt className="text-white/45">Snapshot Count</dt>
                    <dd className="text-white/80 mt-1">{node.snapshots.length}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
              <h2 className="text-lg font-semibold text-white mb-4">CITE Ledger Hashes</h2>
              {node.evidence_layer.length > 0 ? (
                <div className="space-y-3">
                  {node.evidence_layer.map((entry) => (
                    <div key={entry.identifier} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{entry.identifier} · {entry.title}</p>
                        <span className="text-[11px] uppercase tracking-wide text-white/45">{entry.severity}</span>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2 text-xs text-white/65">
                        <p>sha256: <span className="text-white/85">{shortHash(entry.content_hash)}</span></p>
                        <p>chain: <span className="text-white/85">{shortHash(entry.chain_hash)}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/55">No public ledger hashes were exposed for this entity yet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Audit History</h2>
              <div className="space-y-3">
                {node.snapshots.map((snapshot) => (
                  <div key={snapshot.share_slug} className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Score {snapshot.visibility_score} · {new Date(snapshot.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-white/55 mt-1">{snapshot.analysis_tier_display}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={snapshot.entity_audit_path} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20">
                        Open node snapshot
                      </Link>
                      <Link to={snapshot.share_path} className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10">
                        Legacy share path
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
