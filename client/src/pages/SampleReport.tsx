// SampleReport — public page showing a realistic sample audit
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { getScoreColor, getScoreBand } from '../utils/scoreUtils';

// Realistic sample data modeled on a mid-range site
const SAMPLE = {
  url: 'https://example-saas.com',
  score: 34,
  status_line: 'Significant AI visibility gaps detected',
  scanned_at: '2026-01-15T10:30:00Z',
  hard_blockers: [
    'robots.txt blocks GPTBot and ClaudeBot — score capped at 30',
    'No Organization schema — entity identity unverifiable',
  ],
  categories: [
    { name: 'Schema & Structured Data', score: 18, weight: '20%', detail: 'Basic JSON-LD present but missing Organization, FAQ, and author entities.' },
    { name: 'Content Depth', score: 42, weight: '18%', detail: 'Word count adequate but lacks question-format headings and TL;DR blocks.' },
    { name: 'Meta & Open Graph', score: 55, weight: '15%', detail: 'Title and meta description present. Missing Open Graph image and Twitter card.' },
    { name: 'Technical Trust', score: 48, weight: '15%', detail: 'Canonical URL set. Sitemap exists but missing hreflang for multi-language.' },
    { name: 'AI Readability', score: 22, weight: '12%', detail: 'AI crawlers blocked in robots.txt. No llms.txt file. Content not extractable.' },
    { name: 'Security & Trust', score: 60, weight: '10%', detail: 'HTTPS active. No sameAs links to authoritative profiles.' },
    { name: 'Heading Structure', score: 35, weight: '10%', detail: 'H1 present but generic. Sub-headings lack question format.' },
  ],
  findings: [
    { id: 'SSFR-S-001', text: 'No Organization schema detected — AI cannot verify your entity identity.', severity: 'critical' as const },
    { id: 'SSFR-S-003', text: 'robots.txt blocks GPTBot and ClaudeBot — content invisible to major AI models.', severity: 'critical' as const },
    { id: 'SSFR-S-005', text: 'No FAQ schema — question-answer pairs not machine-extractable.', severity: 'high' as const },
    { id: 'SSFR-F-002', text: 'Missing llms.txt — AI crawlers have no structured summary of your site.', severity: 'high' as const },
    { id: 'SSFR-F-004', text: 'Heading hierarchy uses generic labels — AI cannot infer topic authority.', severity: 'medium' as const },
    { id: 'SSFR-R-001', text: 'No sameAs links to verified profiles (LinkedIn, Crunchbase, Wikipedia).', severity: 'medium' as const },
    { id: 'SSFR-R-003', text: 'Missing Open Graph image — social sharing and AI previews show no visual.', severity: 'low' as const },
    { id: 'SSFR-F-006', text: 'No TL;DR or summary block at page start — AI extraction starts with noise.', severity: 'low' as const },
  ],
  recommendation: 'Add Organization JSON-LD with sameAs links, then unblock AI crawlers in robots.txt. These two fixes alone could raise the score by 20+ points.',
};

const severityColor = {
  critical: 'text-red-400 bg-red-500/10 border-red-400/25',
  high: 'text-amber-400 bg-amber-500/10 border-amber-400/25',
  medium: 'text-yellow-300 bg-yellow-500/10 border-yellow-400/20',
  low: 'text-white/50 bg-white/5 border-white/10',
};

const scoreColorLocal = (s: number) => getScoreColor(s);
const ringColor = (s: number) => {
  const b = getScoreBand(s);
  return `border-${b.band === 'excellent' ? 'emerald' : b.band === 'good' ? 'green' : b.band === 'fair' ? 'amber' : b.band === 'poor' ? 'orange' : 'red'}-400/40 bg-${b.band === 'excellent' ? 'emerald' : b.band === 'good' ? 'green' : b.band === 'fair' ? 'amber' : b.band === 'poor' ? 'orange' : 'red'}-500/10`;
};

const SampleReport = () => {
  usePageMeta({ title: 'Sample Report', description: 'See what a real AiVIS.biz AI visibility audit looks like. Score breakdown, evidence-backed findings, and priority fixes.' });

  return (
    <div className="min-h-screen bg-[#060607] text-white">
      {/* Header */}
      <div className="border-b border-white/8 bg-[#0a0a0f]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-white/60 hover:text-white text-sm transition-colors">← Back to AiVIS.biz</Link>
            <span className="px-3 py-1 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-xs font-bold uppercase tracking-widest">Sample Report</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Score header */}
        <div className="flex items-center gap-6 mb-8">
          <div className={`w-24 h-24 rounded-full border-4 ${ringColor(SAMPLE.score)} flex items-center justify-center shrink-0`}>
            <span className={`text-4xl font-black ${scoreColorLocal(SAMPLE.score)}`}>{SAMPLE.score}</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{SAMPLE.status_line}</h1>
            <p className="text-white/40 text-sm">{SAMPLE.url} · Scanned {new Date(SAMPLE.scanned_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Hard blockers */}
        {SAMPLE.hard_blockers.length > 0 && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/8 p-5 mb-8">
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">Hard Blockers — Score Capped</h2>
            <div className="space-y-2">
              {SAMPLE.hard_blockers.map((b, i) => (
                <p key={i} className="text-sm text-red-300/80">• {b}</p>
              ))}
            </div>
          </div>
        )}

        {/* Category breakdown */}
        <h2 className="text-lg font-bold text-white mb-4">Category Breakdown</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          {SAMPLE.categories.map((cat) => (
            <div key={cat.name} className="rounded-xl border border-white/10 bg-[#111827]/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
                <span className={`text-lg font-bold ${scoreColorLocal(cat.score)}`}>{cat.score}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 mb-2">
                <div className={`h-full rounded-full ${getScoreBand(cat.score).barColor}`} style={{ width: `${cat.score}%` }} />
              </div>
              <p className="text-xs text-white/45">{cat.detail}</p>
              <p className="text-[10px] text-white/25 mt-1">Weight: {cat.weight}</p>
            </div>
          ))}
        </div>

        {/* Findings */}
        <h2 className="text-lg font-bold text-white mb-4">Evidence-Backed Findings</h2>
        <div className="space-y-3 mb-10">
          {SAMPLE.findings.map((f) => (
            <div key={f.id} className={`flex items-start gap-3 rounded-xl border p-4 ${severityColor[f.severity]}`}>
              <span className="text-[10px] font-mono opacity-60 mt-0.5 shrink-0">{f.id}</span>
              <span className="text-sm">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Recommendation */}
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-6 mb-10">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">Priority Fix</h2>
          <p className="text-emerald-200/80">{SAMPLE.recommendation}</p>
        </div>

        {/* CTA */}
        <div className="text-center rounded-2xl border border-white/10 bg-[#111827]/50 p-8">
          <h2 className="text-xl font-bold text-white mb-2">Want this for your site?</h2>
          <p className="text-white/50 text-sm mb-6">Paste your URL on the homepage and get your real score in under 30 seconds. No login required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-7 py-3 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20">
              Check your site now
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
            <Link to="/pricing" className="inline-flex items-center justify-center gap-2 bg-transparent text-white/55 px-7 py-3 rounded-full text-sm font-medium border border-white/15 hover:text-white hover:border-white/25 transition-all">
              View pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SampleReport;
