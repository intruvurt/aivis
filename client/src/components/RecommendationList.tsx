import React, { useState } from 'react';
import { BRAG_TRAIL_LABEL, Recommendation } from '@shared/types';
import { AlertCircle, CheckCircle2, Zap, ArrowRight, Code, Database, ChevronDown, ChevronUp, Clipboard, Check as CheckIcon, Clock, AlertTriangle, Lock } from 'lucide-react';
import { Card } from './ui/Card';
import { Link } from 'react-router-dom';

// ─── BRAG Evidence Labels ─────────────────────────────────────────────────────
// Maps ev_* IDs from the server's evidence manifest to human-readable labels.
// When an AI recommendation cites evidence_ids, these labels tell the user
// exactly which scraped page property justified the finding.
const EV_LABELS: Record<string, string> = {
  ev_title:      'Page Title',
  ev_meta_desc:  'Meta Description',
  ev_meta_kw:    'Meta Keywords',
  ev_og_title:   'OG Title',
  ev_og_desc:    'OG Description',
  ev_h1:         'H1 Tag',
  ev_h2:         'H2 Tags',
  ev_h3:         'H3 Tags',
  ev_word_count: 'Word Count',
  ev_links_int:  'Internal Links',
  ev_links_ext:  'External Links',
  ev_images:     'Images',
  ev_https:      'HTTPS',
  ev_schema:     'Schema / JSON-LD',
  ev_body:       'Body Content',
};

function EvidenceBadge({ id }: { id: string }) {
  const label = EV_LABELS[id] ?? id;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded card-charcoal/50 text-[11px] font-mono text-white/85">
      {label}
    </span>
  );
}

// ─── Fix Implementation Guides ────────────────────────────────────────────────
// Copy-pasteable code snippets for each scorefix_category so users can act now.
const FIX_GUIDES: Record<string, { label: string; snippet: string }> = {
  schema_structured_data: {
    label: 'Add Organization + WebSite JSON-LD',
    snippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png",
  "sameAs": [
    "https://twitter.com/yourhandle",
    "https://linkedin.com/company/yourco"
  ]
}
</script>`,
  },
  meta_tags: {
    label: 'Add complete meta & Open Graph tags',
    snippet: `<head>
  <title>Primary Keyword - Brand Name</title>
  <meta name="description" content="150-160 char description with primary keyword near the start." />
  <meta property="og:title" content="Primary Keyword - Brand Name" />
  <meta property="og:description" content="Same or similar to meta description." />
  <meta property="og:image" content="https://yoursite.com/og-image.png" />
  <meta property="og:url" content="https://yoursite.com/page" />
  <link rel="canonical" href="https://yoursite.com/page" />
</head>`,
  },
  heading_structure: {
    label: 'Fix H1 and question-format H2s',
    snippet: `<!-- One H1 per page containing primary keyword -->
<h1>How [Your Product] Solves [Problem]</h1>

<!-- Question-format H2s qualify for FAQ/AEO extraction -->
<h2>What is [Your Product]?</h2>
<p>Concise answer paragraph (40-60 words ideal for AI extraction)...</p>

<h2>How does [Your Product] compare to alternatives?</h2>
<p>Comparison paragraph with concrete data points...</p>`,
  },
  content_depth: {
    label: 'Improve content depth for AI citation',
    snippet: `<!-- Target 800+ words with factual, citable statements -->
<!-- Add a TL;DR / Key Takeaways section near the top -->
<section>
  <h2>Key Takeaways</h2>
  <ul>
    <li>Specific claim with data: "X reduces Y by 40%"</li>
    <li>Concrete comparison: "Unlike Z, X does A"</li>
    <li>Actionable insight with evidence</li>
  </ul>
</section>

<!-- Add an FAQ section at the bottom -->
<section itemscope itemtype="https://schema.org/FAQPage">
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">What is [topic]?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Direct, citable answer...</p>
    </div>
  </div>
</section>`,
  },
  image_accessibility: {
    label: 'Add descriptive alt text to images',
    snippet: `<!-- Bad: empty or generic alt text -->
<img src="chart.png" alt="" />
<img src="chart.png" alt="image" />

<!-- Good: descriptive, keyword-relevant alt text -->
<img src="chart.png" alt="Bar chart showing 40% improvement in AI visibility score after adding JSON-LD schema" />
<img src="team.jpg" alt="AcmeCo engineering team at 2025 product launch event" />`,
  },
  robots_access: {
    label: 'Allow AI crawler access in robots.txt',
    snippet: `# robots.txt - allow major AI crawlers
User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: anthropic-ai
Allow: /

# Also add /llms.txt for AI-specific guidance
# See https://llmstxt.org/ for format`,
  },
  technical_seo: {
    label: 'Fix technical SEO signals',
    snippet: `<!-- Ensure canonical tag is present -->
<link rel="canonical" href="https://yoursite.com/current-page" />

<!-- Verify HTTPS is enforced -->
<!-- In your server config or .htaccess: -->
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

<!-- Keep response time under 2000ms -->
<!-- Enable compression, lazy-load images, use CDN -->`,
  },
  internal_linking: {
    label: 'Strengthen internal link structure',
    snippet: `<!-- Add 3+ internal links per page -->
<!-- Use descriptive anchor text, not "click here" -->

<!-- Bad -->
<a href="/features">Click here</a> to learn more.

<!-- Good -->
Learn how our <a href="/features">AI visibility audit features</a>
help teams identify citation gaps.

<!-- Add breadcrumb navigation -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li>Current Page</li>
  </ol>
</nav>`,
  },
  ai_readability: {
    label: 'Improve AI readability & citability',
    snippet: `<!-- Use clear, direct language in the first 200 words -->
<!-- AI models extract from the opening paragraphs first -->

<!-- Avoid: vague marketing fluff -->
"We're revolutionizing the industry with cutting-edge solutions."

<!-- Better: specific, citable facts -->
"AcmeCo processes 2M API requests daily with 99.9% uptime,
serving 400+ enterprise customers across 12 countries."

<!-- Add structured data for key claims -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AcmeCo",
  "applicationCategory": "BusinessApplication",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "1250"
  }
}
</script>`,
  },
};

function FixGuidePanel({ category }: { category?: string }) {
  const [copied, setCopied] = useState(false);
  const guide = category ? FIX_GUIDES[category] : undefined;
  if (!guide) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(guide.snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-950/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-400/15">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300/80">Quick Fix Guide: {guide.label}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-cyan-200/70 hover:text-cyan-200 hover:bg-cyan-500/15 transition-colors"
          type="button"
        >
          {copied ? <CheckIcon className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-white/75 overflow-x-auto whitespace-pre-wrap leading-relaxed">{guide.snippet}</pre>
    </div>
  );
}

interface RecommendationListProps {
  recommendations: Recommendation[];
  /** Current user tier — controls implementation code visibility */
  tier?: string;
}

function getVerificationTone(status?: Recommendation['verification_status']) {
  if (status === 'verified') return 'bg-emerald-900/40 text-emerald-300 border-emerald-500/35';
  if (status === 'partial') return 'bg-amber-900/40 text-amber-300 border-amber-500/35';
  return 'bg-charcoal text-white/65 border-white/10';
}

function getVerificationLabel(status?: Recommendation['verification_status']) {
  if (status === 'verified') return `${BRAG_TRAIL_LABEL}: verified`;
  if (status === 'partial') return `${BRAG_TRAIL_LABEL}: partial`;
  return `${BRAG_TRAIL_LABEL}: unverified`;
}

export const RecommendationList: React.FC<RecommendationListProps> = ({ recommendations, tier = 'observer' }) => {
  const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set());
  const isPaid = tier !== 'observer' && tier !== 'free';

  const toggleEvidence = (idx: number) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const getIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="w-6 h-6 text-red-400" />;
      case 'medium': return <Zap className="w-6 h-6 text-amber-400" />;
      case 'low': return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
      default: return <AlertCircle className="w-6 h-6" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-900/50 text-red-300 border-red-500/40';
      case 'medium': return 'bg-amber-900/50 text-amber-300 border-amber-500/40';
      case 'low': return 'bg-emerald-900/50 text-emerald-300 border-emerald-500/40';
      default: return 'bg-charcoal text-white/55 border-white/10';
    }
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500/50';
      case 'medium': return 'border-amber-500/50';
      case 'low': return 'border-emerald-500/50';
      default: return 'border-white/10';
    }
  };

  const getDifficultyDisplay = (d: string) => {
    switch (d) {
      case 'easy': return { label: 'Easy', color: 'text-emerald-300', dot: 'bg-emerald-400' };
      case 'hard': return { label: 'Hard', color: 'text-rose-300', dot: 'bg-rose-400' };
      default: return { label: 'Medium', color: 'text-amber-300', dot: 'bg-amber-400' };
    }
  };

  const getTimeLabel = (mins?: number) => {
    if (!mins) return null;
    if (mins <= 10) return '~5 min';
    if (mins <= 20) return '~15 min';
    if (mins <= 45) return '~30 min';
    if (mins <= 90) return '~1 hr';
    return '~2 hr';
  };

  return (
    <div className="space-y-4">
      {recommendations.map((rec, idx) => {
        const diff = getDifficultyDisplay(rec.difficulty);
        const timeLabel = getTimeLabel(rec.estimatedTimeMinutes);

        return (
          <Card key={idx} className={`border-l-4 ${getPriorityBorder(rec.priority)} overflow-hidden hover:shadow-md transition-shadow`}>
            <div className="p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-start gap-5">

                <div className="p-3 rounded-xl shrink-0 self-start bg-charcoal">
                  {getIcon(rec.priority)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <h3 className="font-bold text-lg text-white leading-tight">{rec.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide w-fit border ${getPriorityColor(rec.priority)}`}>
                      {rec.priority} Priority
                    </span>
                  </div>

                  {/* ─── Consequence Statement (survival language) ────────── */}
                  {rec.consequenceStatement && (
                    <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl border border-rose-400/15 bg-rose-500/[0.06]">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-rose-200/80 leading-relaxed">{rec.consequenceStatement}</p>
                    </div>
                  )}

                  <p className="text-white/75 mb-4 leading-relaxed">{rec.description}</p>

                  {/* ─── Impact / Difficulty / Time / Visibility Loss (compact row) ─── */}
                  <div className="flex flex-wrap gap-3 text-sm mt-4 mb-5">
                    <div className="flex items-center gap-2 px-3 py-1.5 card-charcoal/30 rounded-xl text-white/80 font-medium">
                       <ArrowRight className="w-4 h-4" />
                       Impact: {rec.impact}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-charcoal border border-white/10 rounded-xl text-white/75 font-medium">
                       <span className={`w-2 h-2 rounded-full ${diff.dot}`}></span>
                       <span className={diff.color}>{diff.label}</span>
                    </div>
                    {timeLabel && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-charcoal border border-white/10 rounded-xl text-white/70 font-medium">
                        <Clock className="w-3.5 h-3.5 text-white/50" />
                        {timeLabel}
                      </div>
                    )}
                    {rec.estimatedVisibilityLoss && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] text-rose-300 text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {rec.estimatedVisibilityLoss} visibility at risk
                      </div>
                    )}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${getVerificationTone(rec.verification_status)}`}>
                      {getVerificationLabel(rec.verification_status)}
                      <span className="opacity-80">
                        ({rec.verified_evidence_count || 0}/{rec.total_evidence_refs || 0})
                      </span>
                    </div>
                  </div>

                  {/* ─── BRAG Evidence Provenance (collapsible) ────────────── */}
                  {rec.evidence_ids && rec.evidence_ids.length > 0 && (
                    <div className="mb-5">
                      <button
                        type="button"
                        onClick={() => toggleEvidence(idx)}
                        className="flex items-center gap-2 text-xs text-white/50 hover:text-white/70 transition-colors"
                      >
                        <Database className="w-3 h-3" />
                        <span className="font-medium uppercase tracking-wide">Evidence trail ({rec.evidence_ids.length})</span>
                        {expandedEvidence.has(idx) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {expandedEvidence.has(idx) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-charcoal-deep border border-white/12">
                          {rec.evidence_ids.map((id) => (
                            <EvidenceBadge key={id} id={id} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {(!rec.evidence_ids || rec.evidence_ids.length === 0) && (
                    <div className="mb-5 px-3 py-2 rounded-xl border border-white/10 bg-charcoal text-xs text-white/55">
                      No linked evidence IDs — treat as advisory.
                    </div>
                  )}

                  {/* ─── Implementation (blurred for free tier) ────────────── */}
                  <div className="relative bg-[#323a4c] rounded-xl overflow-hidden ring-1 ring-white/40/5">
                    <div className="flex items-center gap-2 px-4 py-2 bg-charcoal-light border-b border-white/10">
                      <Code className="w-4 h-4 text-white/55" />
                      <span className="text-xs font-semibold text-white/55 uppercase tracking-wider">Implementation</span>
                    </div>
                    <div className={`p-4 overflow-x-auto ${!isPaid ? 'blur-sm select-none' : ''}`}>
                      <code className="text-sm font-mono text-white/80">
                        {rec.implementation}
                      </code>
                    </div>
                    {!isPaid && (
                      <div className="absolute inset-0 top-10 flex flex-col items-center justify-center bg-charcoal/60 backdrop-blur-[2px]">
                        <Lock className="w-5 h-5 text-white/40 mb-2" />
                        <p className="text-sm text-white/60 font-medium mb-2">Implementation code locked</p>
                        <Link
                          to="/pricing"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-xs font-semibold text-slate-950 hover:scale-[1.02] transition-transform"
                        >
                          Unlock with Starter <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>

                  <FixGuidePanel category={(rec as any).scorefix_category} />
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
