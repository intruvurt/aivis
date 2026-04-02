// client/src/pages/HelpCenter.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from '../lib/seoSchema';
import { motion, AnimatePresence } from 'framer-motion';
import { PUBLIC_APP_ORIGIN } from '../config';
import {
  Search,
  Mail,
  BookOpen,
  BarChart3,
  Users,
  FileText,
  CreditCard,
  Shield,
  Zap,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Eye,
  FlaskConical,
  Target,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ticket,
  Send,
  X,
  ArrowRight,
  Inbox,
  Filter,
} from 'lucide-react';
import { MARKETING_CLAIMS } from '../constants/marketingClaims';
import { BRAG_ACRONYM, BRAG_EXPANSION, BRAG_TRAIL_LABEL, SUPPORT_TICKET_CATEGORIES } from '@shared/types';
import type { SupportTicketCategory, SupportTicketPriority, SupportTicket as SupportTicketType, SupportTicketStatus } from '@shared/types';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { useAuthStore } from '../stores/authStore';

/* ────────────────────────────────────────────────────────────────────────────
 * Help Center data
 * ──────────────────────────────────────────────────────────────────────────── */

interface HelpArticle {
  q: string;
  a: string;
  tags: string[];
}

interface HelpCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  linkTo?: string;
  articles: HelpArticle[];
}

const CATEGORIES: HelpCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Zap,
    description: 'First steps: accounts, audits, and scores.',
    articles: [
      {
        q: 'How do I run my first audit?',
        a: 'Sign up, verify your email, then enter any URL on the Dashboard. The audit takes 30-60 seconds and produces an evidence-backed visibility score.',
        tags: ['audit', 'start', 'url', 'dashboard'],
      },
      {
        q: 'What does the visibility score mean?',
        a: '0-19 Critical (AI will ignore you), 20-39 Poor, 40-59 Fair, 60-79 Good, 80-100 Excellent. Most sites score 30-50 on their first audit. The six category grades (Content Depth, Heading Structure, Schema, Meta Tags, Technical SEO, AI Readability) each contribute to the overall score.',
        tags: ['score', 'visibility', 'categories', 'grades'],
      },
      {
        q: 'Can I audit any website?',
        a: 'You can audit any publicly accessible URL. Private pages, localhost, and IP addresses are blocked in production for security.',
        tags: ['url', 'audit', 'blocked', 'private'],
      },
      {
        q: 'Do I need technical knowledge?',
        a: 'Not at all. Reports are in plain language with prioritized recommendations. Each suggestion tells you what to change and why.',
        tags: ['beginner', 'easy', 'technical'],
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis & Scores',
    icon: BarChart3,
    description: 'How audits work, scoring methodology, and understanding results.',
    linkTo: '/guide',
    articles: [
      {
        q: 'What does AiVIS actually audit?',
        a: 'The scraper extracts 14 evidence signals: title tag, meta description, canonical URL, Open Graph tags, JSON-LD schema blocks, H1-H6 headings, internal/external links, word count, robots meta, image alt text, content body, and HTTPS status.',
        tags: ['audit', 'scrape', 'evidence', 'signals'],
      },
      {
        q: 'How is AI visibility different from SEO?',
        a: 'Traditional SEO targets Google link-based ranking. AI visibility is about whether answer engines can understand, trust, and cite your business when answers replace links. You can rank #1 on Google and still be invisible to ChatGPT if your content lacks clear structure.',
        tags: ['seo', 'ai', 'difference', 'chatgpt'],
      },
      {
        q: 'What is the triple-check pipeline?',
        a: `${MARKETING_CLAIMS.modelAllocation} Signal and Score Fix use the triple-check flow with score adjustment and validation; Score Fix adds an evidence-driven Actual Fix Plan with issue-level implementation checkpoints. Canonical source: ${MARKETING_CLAIMS.modelTruthUrl}.`,
        tags: ['triple-check', 'signal', 'scorefix', 'models', 'pipeline'],
      },
      {
        q: 'Why is my score so low?',
        a: 'Common issues: missing JSON-LD schema, no FAQ markup, thin meta descriptions, no clear H1 tag, insufficient internal linking. Check the recommendations section of your report for exact fixes.',
        tags: ['low score', 'improve', 'fix', 'recommendations'],
      },
      {
        q: 'What is the BRAG evidence system?',
        a: `${BRAG_ACRONYM} (${BRAG_EXPANSION}) is our zero-hallucination methodology. Every finding carries an ev_* evidence ID (ev_title, ev_schema, ev_headings, etc.) linked to a specific scraped element. AI models must cite these IDs for every claim. The Evidence Ledger groups all evidence by category with pass/warn/critical status so you can verify every finding in the ${BRAG_TRAIL_LABEL}.`,
        tags: ['brag', 'evidence', 'ledger', 'ev_', 'methodology', 'hallucination'],
      },
      {
        q: 'What is the Evidence Ledger?',
        a: 'The Evidence Ledger is a full audit trail displayed in your report. It groups all 16+ ev_* evidence points into categories (Meta, Headings, Content, Technical, Links, Social) and shows pass/warn/critical status for each. Recommendations are cross-linked to the evidence they cite, so you can trace any finding back to your actual page content.',
        tags: ['evidence', 'ledger', 'audit trail', 'categories', 'verification'],
      },
    ],
  },
  {
    id: 'bra',
    label: 'BRA Authority Checker',
    icon: Eye,
    description: 'Brand Reputation Authority: Reddit, LinkedIn, Substack, and Medium scanning.',
    linkTo: '/citations',
    articles: [
      {
        q: 'What is the BRA Authority Checker?',
        a: 'A granular authority/citation/backlink checker that audits Reddit, LinkedIn, Substack, and Medium for mentions of your brand. Each result is classified as spammy, direct promo, organic pain/solution, or neutral with a confidence score.',
        tags: ['bra', 'authority', 'reddit', 'linkedin', 'substack', 'medium'],
      },
      {
        q: 'What tier do I need?',
        a: 'Alignment, Signal, or Score Fix. Observer users see an upgrade prompt. Exact pricing and limits are shown on the live Pricing page. The authority check endpoint is POST /api/citations/authority-check.',
        tags: ['tier', 'paid', 'alignment', 'signal', 'scorefix', 'pricing'],
      },
      {
        q: 'What does content nature classification mean?',
        a: 'Every mention is tagged: "spammy" (low-quality/spam), "direct_promo" (overt self-promotion), "organic_pain_solution" (genuine recommendations), or "neutral" (informational). This helps you separate real authority signals from noise.',
        tags: ['classification', 'spammy', 'promo', 'organic', 'nature'],
      },
      {
        q: 'How is the authority score calculated?',
        a: 'Based on rank position in search results, snippet relevance, platform weight, and backlink presence. Each platform produces a 0-100 score. The overall Authority Index is the average across all four platforms.',
        tags: ['score', 'authority', 'calculation', 'algorithm'],
      },
    ],
  },
  {
    id: 'features',
    label: 'Platform Features',
    icon: FlaskConical,
    description: 'Competitors, citations, reverse engineer, keywords, reports.',
    articles: [
      {
        q: 'How does competitor tracking work?',
        a: 'Add up to 3 (Alignment), 8 (Signal), or 10 (Score Fix) competitor URLs. Compare AI visibility scores side-by-side. See where competitors outperform you and what to prioritize.',
        tags: ['competitor', 'compare', 'tracking'],
      },
      {
        q: 'What are the reverse engineer tools?',
        a: 'Four tools: Decompile (break down how an AI answer was built), Ghost (blueprint for appearing in AI answers), Model Diff (compare how different models answer the same query), and Simulate (probabilistic forecast of how answer engines may respond to your site after changes).',
        tags: ['reverse engineer', 'decompile', 'ghost', 'model diff', 'simulate'],
      },
      {
        q: 'What is citation testing?',
        a: 'Signal and Score Fix feature. Generates realistic search queries, then tests them across ChatGPT, Perplexity, Claude, and Google AI to see if your brand is mentioned in the responses.',
        tags: ['citation', 'test', 'signal', 'scorefix', 'chatgpt', 'perplexity'],
      },
      {
        q: 'Can I export my report?',
        a: 'All tiers include shareable report links (Observer links are redacted). CSV, PDF, and JSON export is available on Alignment, Signal, and Score Fix. Observer tier results are viewable in-app and saved to analysis history.',
        tags: ['export', 'download', 'share', 'report'],
      },
      {
        q: 'How do share links and public reports work?',
        a: 'After running an audit, click "Share" to generate a public link. Recipients can view the report without logging in. The link is encrypted and expires based on your settings in Settings → Share Link Expiration. Observer shares are redacted; paid tiers get full reports.',
        tags: ['share', 'public', 'report', 'link', 'export'],
      },
      {
        q: 'What is the MCP Server Console?',
        a: 'The MCP (Model Context Protocol) Console lets you connect AI coding agents like Claude, Cursor, or Windsurf directly to your AiVIS account. Agents can run audits, pull reports, query analytics, and access all platform tools through their native tool interface. Requires Alignment or higher.',
        tags: ['mcp', 'server', 'console', 'agent', 'cursor', 'claude', 'protocol'],
      },
      {
        q: 'What is GSC Intelligence?',
        a: 'GSC Intelligence connects your Google Search Console data to AiVIS. It detects declining pages, surfaces low-CTR opportunities, identifies keyword cannibalization, and merges real search performance data with AI visibility audits. Requires Alignment or higher. Connect via Settings → Search Console.',
        tags: ['gsc', 'google', 'search console', 'intelligence', 'ctr', 'keywords'],
      },
      {
        q: 'How does brand mention tracking work?',
        a: 'AiVIS scans 9 free sources — Reddit, Hacker News, Mastodon, DuckDuckGo, Bing, Google News, GitHub, Quora, and Product Hunt — to find mentions of your brand. Each mention is timestamped and linked. View mention history and timeline on the Mentions page. Requires Alignment or higher.',
        tags: ['mentions', 'brand', 'tracking', 'reddit', 'hacker news', 'mastodon'],
      },
      {
        q: 'What is keyword intelligence?',
        a: 'Keyword Intelligence extracts topical keywords from your audit results and shows how they relate to AI visibility. It identifies primary topics, semantic clusters, and content gaps. Use it to align your content strategy with what AI models look for.',
        tags: ['keywords', 'intelligence', 'topical', 'semantic', 'content'],
      },
    ],
  },
  {
    id: 'billing',
    label: 'Plans & Billing',
    icon: CreditCard,
    description: 'Pricing, upgrades, cancellations, and payment questions.',
    linkTo: '/pricing',
    articles: [
      {
        q: 'What are the tiers?',
        a: 'Observer, Alignment, Signal, and Score Fix tiers are available. Plan limits and pricing are live-configured and always shown on the Pricing page. Alignment and Signal are subscriptions; Score Fix is a one-time remediation purchase.',
        tags: ['pricing', 'tiers', 'plans', 'cost'],
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes. Subscriptions (Alignment/Signal) can be managed from Billing and cancellation takes effect at the end of the current cycle. Score Fix is one-time, so there is no recurring cancellation cycle for that purchase.',
        tags: ['cancel', 'subscription', 'billing'],
      },
      {
        q: 'How is usage enforced?',
        a: 'Server-side hard caps. Your tier limit is checked before every analysis request. When you hit your monthly limit, you see a message with the next reset time.',
        tags: ['usage', 'limit', 'cap', 'audits'],
      },
    ],
  },
  {
    id: 'security',
    label: 'Privacy & Security',
    icon: Shield,
    description: 'Data handling, GDPR, and security information.',
    linkTo: '/privacy',
    articles: [
      {
        q: 'Is my data safe?',
        a: 'Payments processed through Stripe (PCI Level 1). We never see card details. Analysis results are cached in our database. We don\'t sell data or run third-party trackers. Data export and deletion controls are available in Settings.',
        tags: ['data', 'security', 'privacy', 'gdpr', 'stripe'],
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes. Go to Settings → Data Management (GDPR) section. You can download all your data or permanently delete your account and all associated data.',
        tags: ['delete', 'account', 'gdpr', 'data'],
      },
      {
        q: 'Does AiVIS detect malicious websites?',
        a: 'Yes. Every audit includes a real-time threat intelligence audit that runs in parallel with the analysis. We check your URL against URLhaus (known malicious URLs from abuse.ch), Google Safe Browsing API v4 (social engineering, malware, unwanted software), and hostname heuristics (punycode/IDN attacks, risky TLDs like .tk/.ml/.cf, raw IP hosting). Results appear in a Threat Intel banner with risk levels from Low to Critical.',
        tags: ['threat', 'malicious', 'security', 'urlhaus', 'safe browsing', 'audit'],
      },
      {
        q: 'What threat intelligence providers are used?',
        a: 'Three layers: (1) URLhaus from abuse.ch, a database of known malicious URLs with threat types and tags, (2) Google Safe Browsing API v4, which checks for social engineering, malware, and unwanted software, and (3) hostname heuristics that detect punycode homograph attacks, raw IP hosting, suspicious URL patterns, and risky top-level domains.',
        tags: ['urlhaus', 'google', 'safe browsing', 'heuristics', 'providers'],
      },
    ],
  },
];

const QUICK_LINKS = [
  { label: 'Dashboard', to: '/', icon: BarChart3 },
  { label: 'Run Audit', to: '/analyze', icon: Zap },
  { label: 'Guide', to: '/guide', icon: BookOpen },
  { label: 'FAQ', to: '/faq', icon: HelpCircle },
  { label: 'Pricing', to: '/pricing', icon: CreditCard },
  { label: 'Settings', to: '/settings', icon: Shield },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Ticket status helpers
 * ──────────────────────────────────────────────────────────────────────────── */
const STATUS_META: Record<SupportTicketStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  open: { label: 'Open', color: 'text-cyan-300', bg: 'bg-cyan-500/15 border-cyan-400/30', icon: Inbox },
  in_progress: { label: 'In Progress', color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-400/30', icon: Clock },
  waiting_on_customer: { label: 'Awaiting Reply', color: 'text-orange-300', bg: 'bg-orange-500/15 border-orange-400/30', icon: MessageSquare },
  resolved: { label: 'Resolved', color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-400/30', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'text-white/40', bg: 'bg-white/5 border-white/10', icon: CheckCircle2 },
};

const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  low: { label: 'Low', dot: 'bg-white/30' },
  normal: { label: 'Normal', dot: 'bg-cyan-400' },
  high: { label: 'High', dot: 'bg-amber-400' },
  urgent: { label: 'Urgent', dot: 'bg-red-400' },
};

type HelpTab = 'knowledge' | 'guides' | 'tickets' | 'new-ticket' | 'ticket-detail';

type GuideId = 'seo' | 'aeo' | 'geo' | 'playbook';

interface LearningGuide {
  id: GuideId;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  available: boolean;
}

const LEARNING_GUIDES: LearningGuide[] = [
  { id: 'seo', title: 'SEO', subtitle: 'Search Engine Optimization', icon: Target, available: true },
  { id: 'aeo', title: 'AEO', subtitle: 'Answer Engine Optimization', icon: MessageSquare, available: true },
  { id: 'geo', title: 'GEO', subtitle: 'Generative Engine Optimization', icon: Zap, available: true },
  { id: 'playbook', title: 'Playbook', subtitle: 'Page-by-Page SEO + AEO + GEO', icon: BookOpen, available: true },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

const HELP_FAQ_ITEMS = CATEGORIES.flatMap((cat) =>
  cat.articles.map((a) => ({ question: a.q, answer: a.a }))
);

export default function HelpCenter() {
  usePageMeta({
    title: 'Help Center | AiVIS AI Visibility Platform',
    description: 'Answers to common questions about AI visibility audits, scoring, Score Fix, citations, pricing, and platform workflow.',
    path: '/help',
    structuredData: [
      { ...buildFaqSchema(HELP_FAQ_ITEMS), '@id': `${PUBLIC_APP_ORIGIN}/help#faq` },
      buildWebPageSchema({ path: '/help', name: 'AiVIS Help Center', description: 'Platform documentation and frequently asked questions about AI visibility auditing.' }),
      buildBreadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Help Center', path: '/help' }]),
    ],
  });

  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const isLoggedIn = !!token;

  // Tab state
  const [activeTab, setActiveTab] = useState<HelpTab>('knowledge');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['getting-started']));

  // Ticket form state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicketCategory>('general');
  const [ticketPriority, setTicketPriority] = useState<SupportTicketPriority>('normal');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  // Ticket reply state
  const [replyText, setReplyText] = useState('');

  // Ticket filter
  const [ticketFilter, setTicketFilter] = useState<string>('all');

  // Learning guide modal state
  const [openGuide, setOpenGuide] = useState<GuideId | null>(null);

  const {
    tickets,
    activeTicket,
    total,
    isLoading: ticketsLoading,
    error: ticketsError,
    fetchTickets,
    fetchTicket,
    createTicket,
    replyToTicket,
    closeTicketById,
    setActiveTicket,
    clearError,
  } = useSupportTickets();

  // Load tickets when switching to tickets tab
  useEffect(() => {
    if (activeTab === 'tickets' && isLoggedIn) {
      fetchTickets(ticketFilter === 'all' ? undefined : ticketFilter);
    }
  }, [activeTab, isLoggedIn, ticketFilter, fetchTickets]);

  const handleCreateTicket = async () => {
    if (!ticketSubject.trim() || !ticketDescription.trim()) return;
    const result = await createTicket({
      subject: ticketSubject.trim(),
      category: ticketCategory,
      priority: ticketPriority,
      description: ticketDescription.trim(),
    });
    if (result) {
      setTicketSuccess(`Ticket ${result.ticket_number} created successfully.`);
      setTicketSubject('');
      setTicketDescription('');
      setTicketCategory('general');
      setTicketPriority('normal');
      setTimeout(() => {
        setTicketSuccess(null);
        setActiveTab('tickets');
        fetchTickets();
      }, 2000);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !activeTicket) return;
    const success = await replyToTicket(activeTicket.ticket.id, replyText.trim());
    if (success) setReplyText('');
  };

  const handleOpenTicket = (ticket: SupportTicketType) => {
    fetchTicket(ticket.id);
    setActiveTab('ticket-detail');
    setReplyText('');
  };

  const toggleCategory = (catId: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (a) =>
          a.q.toLowerCase().includes(q) ||
          a.a.toLowerCase().includes(q) ||
          a.tags.some((t) => t.includes(q))
      ),
    })).filter((cat) => cat.articles.length > 0);
  }, [search]);

  const totalArticles = CATEGORIES.reduce((n, c) => n + c.articles.length, 0);
  const openTicketCount = tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved').length;

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white">
      {/* Subtle background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e2536] to-[#141825]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Fixed header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#1a1f2e]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors"
                type="button"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4 text-white/50" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                  <HelpCircle className="w-4.5 h-4.5 text-cyan-400" />
                  Help Center
                </h1>
                <p className="text-xs text-white/40 leading-tight mt-0.5">
                  {totalArticles} articles &middot; {CATEGORIES.length} topics
                </p>
              </div>
            </div>

            {isLoggedIn && (
              <button
                onClick={() => setActiveTab('new-ticket')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New Ticket
              </button>
            )}
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 -mb-px">
            <TabButton
              active={activeTab === 'knowledge'}
              onClick={() => setActiveTab('knowledge')}
              icon={BookOpen}
              label="Knowledge Base"
            />
            <TabButton
              active={activeTab === 'guides'}
              onClick={() => setActiveTab('guides')}
              icon={Target}
              label="Learning Guides"
            />
            <TabButton
              active={activeTab === 'tickets' || activeTab === 'ticket-detail'}
              onClick={() => { setActiveTab('tickets'); setActiveTicket(null); }}
              icon={Ticket}
              label="My Tickets"
              badge={openTicketCount > 0 ? openTicketCount : undefined}
              requiresAuth={!isLoggedIn}
            />
            {activeTab === 'new-ticket' && (
              <TabButton active icon={Plus} label="New Ticket" onClick={() => {}} />
            )}
            {activeTab === 'ticket-detail' && activeTicket && (
              <TabButton active icon={MessageSquare} label={activeTicket.ticket.ticket_number} onClick={() => {}} />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {/* ──────────────── Knowledge Base Tab ──────────────── */}
          {activeTab === 'knowledge' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Search bar */}
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search articles, topics, features..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/30 transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-white/40" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick links */}
              {!search && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {QUICK_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.06] hover:border-white/15 transition-all group"
                      >
                        <Icon className="w-4.5 h-4.5 text-white/50 group-hover:text-cyan-400 transition-colors" />
                        <span className="text-[11px] text-white/55 font-medium group-hover:text-white/80 transition-colors">{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Categories */}
              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <Search className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">No articles match &ldquo;{search}&rdquo;</p>
                  <button onClick={() => setSearch('')} className="text-xs text-cyan-400/70 hover:text-cyan-400 mt-2 transition-colors">
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((cat) => {
                    const Icon = cat.icon;
                    const isExpanded = search.length > 0 || expandedCats.has(cat.id);
                    return (
                      <section key={cat.id} className="rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => !search && toggleCategory(cat.id)}
                          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                        >
                          <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                            <Icon className="w-4.5 h-4.5 text-white/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-white">{cat.label}</h3>
                              <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">{cat.articles.length}</span>
                            </div>
                            <p className="text-xs text-white/40 mt-0.5">{cat.description}</p>
                          </div>
                          {cat.linkTo && (
                            <Link
                              to={cat.linkTo}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-white/35 hover:text-cyan-400 flex items-center gap-1 transition-colors shrink-0"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-4 space-y-1.5">
                                {cat.articles.map((article) => {
                                  const key = `${cat.id}-${article.q}`;
                                  const isOpen = expandedId === key;
                                  return (
                                    <button
                                      key={key}
                                      onClick={() => setExpandedId(isOpen ? null : key)}
                                      className="w-full text-left rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                                      type="button"
                                    >
                                      <div className="flex items-center justify-between px-4 py-3">
                                        <span className="text-sm text-white/80 font-medium pr-4">{article.q}</span>
                                        <ChevronRight
                                          className={`w-3.5 h-3.5 text-white/30 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                                        />
                                      </div>
                                      {isOpen && (
                                        <div className="px-4 pb-3.5 border-t border-white/5 pt-3">
                                          <p className="text-sm text-white/55 leading-relaxed">{article.a}</p>
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </section>
                    );
                  })}
                </div>
              )}

              {/* Contact support CTA */}
              <div className="rounded-xl bg-gradient-to-r from-cyan-500/8 to-violet-500/8 border border-white/8 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white">Can&apos;t find what you need?</h3>
                    <p className="text-sm text-white/50 mt-1">
                      Submit a support ticket and our team will respond within 24 hours. Or chat with AiVIS Guide for instant help.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      {isLoggedIn ? (
                        <button
                          onClick={() => setActiveTab('new-ticket')}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-all"
                        >
                          <Ticket className="w-4 h-4" />
                          Submit a Ticket
                        </button>
                      ) : (
                        <Link
                          to="/auth?mode=signin"
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-all"
                        >
                          Sign in to Submit Tickets
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <a
                        href="mailto:support@aivis.biz"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:text-white hover:bg-white/8 transition-all"
                      >
                        <Mail className="w-4 h-4" />
                        Email Support
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────── Learning Guides Tab ──────────────── */}
          {activeTab === 'guides' && (
            <motion.div
              key="guides"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-white">Self-Learning Guides</h2>
                <p className="text-sm text-white/50 mt-1">
                  Plain-English tutorials on how search and AI visibility actually work. No jargon, no fluff.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {LEARNING_GUIDES.map((guide) => {
                  const Icon = guide.icon;
                  return (
                    <button
                      key={guide.id}
                      type="button"
                      onClick={() => guide.available && setOpenGuide(guide.id)}
                      disabled={!guide.available}
                      className={`text-left rounded-xl border p-6 transition-all ${
                        guide.available
                          ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-cyan-400/25 cursor-pointer group'
                          : 'bg-white/[0.015] border-white/5 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4">
                        <Icon className={`w-5 h-5 ${guide.available ? 'text-cyan-400' : 'text-white/30'}`} />
                      </div>
                      <h3 className="text-base font-bold text-white">{guide.title}</h3>
                      <p className="text-xs text-white/40 mt-1">{guide.subtitle}</p>
                      {guide.available ? (
                        <span className="inline-flex items-center gap-1 mt-4 text-xs text-cyan-400/70 group-hover:text-cyan-400 transition-colors">
                          Start learning <ArrowRight className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-block mt-4 text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                          Coming soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ──────────────── SEO Guide Modal ──────────────── */}
          <AnimatePresence>
            {openGuide === 'seo' && (
              <motion.div
                key="seo-guide-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4"
                onClick={() => setOpenGuide(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className="relative w-full max-w-3xl bg-[#1e2536] border border-white/10 rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#1e2536] border-b border-white/8 rounded-t-2xl">
                    <div>
                      <h2 className="text-lg font-bold text-white">SEO for Normal People</h2>
                      <p className="text-xs text-white/40 mt-0.5">What actually matters if you want a page to rank</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenGuide(null)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Close guide"
                    >
                      <X className="w-5 h-5 text-white/50" />
                    </button>
                  </div>

                  {/* Modal body */}
                  <div className="px-6 py-6 space-y-8 text-white/75 text-sm leading-relaxed max-h-[80vh] overflow-y-auto">
                    {/* Intro */}
                    <div className="space-y-3">
                      <p>
                        SEO is not magic. It is not tricking Google. It is making a page so clear, useful, and easy to trust
                        that search engines feel safe showing it to people.
                      </p>
                      <p>
                        If you want to succeed with almost any page, you do not need to learn everything. You need to learn
                        the few things that move a page from invisible to useful to trusted.
                      </p>
                    </div>

                    {/* The five jobs */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white">Think of SEO as five simple jobs</h3>
                      <div className="space-y-4">
                        <GuideBlock number={1} heading="Make sure the page deserves to exist">
                          A page should solve one clear problem for one clear kind of person. If the page is trying to do ten things at once,
                          it usually ranks for none of them. Before writing anything, answer in plain words: what exact question is this page
                          here to answer, and why should someone trust this page more than the others?
                        </GuideBlock>
                        <GuideBlock number={2} heading="Make sure search engines can find it">
                          A page cannot rank if it is hard to crawl or index. At the basic level, the page needs to be publicly accessible,
                          not blocked, linked from somewhere on your site, and ideally included in a sitemap.
                        </GuideBlock>
                        <GuideBlock number={3} heading="Make sure the page instantly makes sense">
                          This is where most people lose. A good page says what it is about without forcing the reader or Google to guess.
                          Your title should say what the page is. Your main heading should match the topic. The first part of the page
                          should make the answer obvious. The sections below should expand that answer cleanly.
                        </GuideBlock>
                        <GuideBlock number={4} heading="Make sure the page is genuinely useful">
                          The internet is drowning in pages that say almost the same thing. The pages that win usually explain more clearly,
                          answer faster, show proof, show examples, or cover the topic more completely.
                        </GuideBlock>
                        <GuideBlock number={5} heading="Make sure the site looks trustworthy">
                          Even a strong page struggles when the overall site feels weak, thin, or confusing. People and search engines both
                          look for signals like who is behind the site, whether the site seems maintained, whether pages are internally
                          linked well, and whether the content feels written by somebody who knows what they are talking about.
                        </GuideBlock>
                      </div>
                    </div>

                    <hr className="border-white/8" />

                    {/* The 12-step guide */}
                    <div className="space-y-6">
                      <h3 className="text-base font-semibold text-white">The step-by-step guide</h3>

                      <GuideStep num={1} title="Pick one goal for the page">
                        <p>Every page needs one main job. Not five. One.</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>A homepage can introduce the business</li>
                          <li>A service page can sell one service</li>
                          <li>A blog post can answer one question</li>
                          <li>A location page can target one place plus one service</li>
                        </ul>
                        <p className="mt-2">When a page tries to rank for everything, it usually becomes fuzzy. Fuzzy pages do not win.</p>
                        <p className="mt-2 text-cyan-300/70 text-xs italic">Good question to ask: If someone lands here from Google, what do I want them to learn or do?</p>
                      </GuideStep>

                      <GuideStep num={2} title="Know what the searcher wants">
                        <p>Before making the page, ask what kind of search this is.</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Some searches want an answer</li>
                          <li>Some want to compare options</li>
                          <li>Some want to buy</li>
                          <li>Some want to find a local business</li>
                          <li>Some want a specific brand or website</li>
                        </ul>
                        <p className="mt-2">
                          The page has to match the mood of the search. If someone searches &ldquo;best CRM for nonprofits,&rdquo; they
                          probably want comparison and recommendations. If they search &ldquo;HubSpot login,&rdquo; they want a direct path.
                        </p>
                      </GuideStep>

                      <GuideStep num={3} title="Put the main phrase in the right places">
                        <p>You do not need keyword stuffing. You need clarity. Use the main phrase naturally in:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>The page title</li>
                          <li>The main heading</li>
                          <li>The opening paragraph</li>
                          <li>One or two subheadings</li>
                          <li>The URL if possible</li>
                        </ul>
                        <p className="mt-2">That is usually enough to help a page stay focused without sounding robotic.</p>
                      </GuideStep>

                      <GuideStep num={4} title="Answer fast, then go deeper">
                        <p>Do not make people dig through filler. Give the core answer early, then expand with details, examples, steps, and proof.</p>
                        <p className="mt-2">A strong page often feels like this:</p>
                        <ol className="list-decimal list-inside space-y-1 mt-2 text-white/60">
                          <li>Here is the answer</li>
                          <li>Here is what that means</li>
                          <li>Here is how to do it</li>
                          <li>Here is proof or an example</li>
                          <li>Here is what to do next</li>
                        </ol>
                        <p className="mt-2">That format works because it respects time and builds trust.</p>
                      </GuideStep>

                      <GuideStep num={5} title="Make the page easy to scan">
                        <p>Most people do not read. They scan. Use:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Clear headings</li>
                          <li>Short paragraphs</li>
                          <li>Plain words</li>
                          <li>Lists when helpful</li>
                          <li>Real examples</li>
                          <li>Specific language instead of vague claims</li>
                        </ul>
                        <p className="mt-2">Good pages are readable. They do not feel like a legal document or a college essay.</p>
                      </GuideStep>

                      <GuideStep num={6} title="Make every page say something original">
                        <p>This is one of the biggest differences between pages that float and pages that sink. Do not just rewrite what everyone else says. Add something:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Your process</li>
                          <li>Your take</li>
                          <li>A screenshot or checklist</li>
                          <li>Real examples or mistakes to avoid</li>
                          <li>Pricing context</li>
                          <li>Before-and-after results</li>
                          <li>Actual experience</li>
                        </ul>
                      </GuideStep>

                      <GuideStep num={7} title="Help Google trust the page">
                        <p>Trust is built by little things stacking together.</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Show who wrote the content if relevant</li>
                          <li>Make it clear what the business does</li>
                          <li>Have an About page</li>
                          <li>Have contact information</li>
                          <li>Keep the site updated</li>
                          <li>Link related pages together</li>
                          <li>Avoid weird, thin, empty pages</li>
                        </ul>
                      </GuideStep>

                      <GuideStep num={8} title="Do the boring basics once">
                        <p>This is the only slightly technical part most people actually need. Make sure:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>The page can load</li>
                          <li>The page works on mobile</li>
                          <li>The page is not blocked from indexing</li>
                          <li>The site has a sitemap</li>
                          <li>Important pages are linked from other pages</li>
                          <li>Titles and descriptions are set</li>
                          <li>Images have meaningful descriptions when relevant</li>
                        </ul>
                        <p className="mt-2">You do not need to become an engineer to win. You just need the basics not to be broken.</p>
                      </GuideStep>

                      <GuideStep num={9} title="Build pages around topics, not just isolated keywords">
                        <p>One page can rank, but a cluster of related pages usually ranks better over time.</p>
                        <p className="mt-2">If you have a service, build:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>One main service page</li>
                          <li>Supporting pages for common questions</li>
                          <li>Comparison pages</li>
                          <li>Pricing or process pages</li>
                          <li>Case studies if possible</li>
                        </ul>
                        <p className="mt-2">This helps search engines understand that your site is not just mentioning a topic. It is actually about that topic.</p>
                      </GuideStep>

                      <GuideStep num={10} title="Use internal links like paths, not decoration">
                        <p>
                          When you mention something important, link to the page that explains it better. This helps people
                          move through your site and helps search engines understand how your pages connect.
                        </p>
                      </GuideStep>

                      <GuideStep num={11} title="Update pages that are almost good">
                        <ul className="list-disc list-inside space-y-1 text-white/60">
                          <li>If a page gets views but few clicks, improve the title and description</li>
                          <li>If it gets visits but no action, improve the page itself</li>
                          <li>If it ranks on page two, deepen the content and sharpen the focus</li>
                          <li>If it is outdated, refresh it</li>
                        </ul>
                        <p className="mt-2">A lot of wins do not come from new pages. They come from fixing pages that are half alive.</p>
                      </GuideStep>

                      <GuideStep num={12} title="Do not fear AI content, fear useless content">
                        <p>
                          AI-generated content is not automatically bad. What matters is whether the content is helpful, original enough,
                          and made for people rather than low-effort filler. The real problem is not using AI. The problem is publishing
                          something lazy and calling it done.
                        </p>
                      </GuideStep>
                    </div>

                    <hr className="border-white/8" />

                    {/* Quick summary */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white">The short version</h3>
                      <p>A page wins when it is:</p>
                      <ul className="space-y-1.5 text-white/60">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Easy to find</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Easy to understand</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Easy to trust</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Actually useful</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Focused on one real search need</li>
                      </ul>
                    </div>

                    {/* Pre-publish checklist */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-5 space-y-3">
                      <h3 className="text-base font-semibold text-white">Before publishing any page, ask:</h3>
                      <ul className="space-y-2 text-white/60">
                        {[
                          'What exact question or need does this page solve?',
                          'Is the title clear?',
                          'Does the heading clearly match the topic?',
                          'Does the first section answer the question fast?',
                          'Does the page have useful detail, not filler?',
                          'Does it add anything original?',
                          'Is it linked from somewhere on the site?',
                          'Can search engines crawl and index it?',
                          'Would a real person trust this page?',
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-0.5 w-4 h-4 rounded border border-white/15 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-white/50 text-xs mt-2">If the answer is yes to most of those, the page has a real chance.</p>
                    </div>

                    {/* Mistakes */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-white">Big mistakes to avoid</h3>
                      <ul className="space-y-1.5 text-white/60">
                        {[
                          'Writing pages just to target keywords',
                          'Copying competitors too closely',
                          'Burying the answer under filler',
                          'Making titles vague',
                          'Publishing thin pages with no real value',
                          'Ignoring internal links',
                          'Expecting one article to rank forever without updates',
                          'Thinking SEO is only about technical setup',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <X className="w-3 h-3 text-red-400/60 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ──────────────── AEO Guide Modal ──────────────── */}
          <AnimatePresence>
            {openGuide === 'aeo' && (
              <motion.div
                key="aeo-guide-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4"
                onClick={() => setOpenGuide(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className="relative w-full max-w-3xl bg-[#1e2536] border border-white/10 rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#1e2536] border-b border-white/8 rounded-t-2xl">
                    <div>
                      <h2 className="text-lg font-bold text-white">AEO for Normal People</h2>
                      <p className="text-xs text-white/40 mt-0.5">What actually matters for answer engines</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenGuide(null)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Close guide"
                    >
                      <X className="w-5 h-5 text-white/50" />
                    </button>
                  </div>

                  {/* Modal body */}
                  <div className="px-6 py-6 space-y-8 text-white/75 text-sm leading-relaxed max-h-[80vh] overflow-y-auto">
                    {/* Intro */}
                    <div className="space-y-3">
                      <p>
                        AEO stands for Answer Engine Optimization — the practice of shaping your page so an AI engine can
                        grab the answer fast and use it directly in a generated response.
                      </p>
                      <p>
                        SEO asks: <em className="text-cyan-300/70">&ldquo;Can this page rank?&rdquo;</em><br />
                        AEO asks: <em className="text-cyan-300/70">&ldquo;Can this page answer?&rdquo;</em>
                      </p>
                      <p>
                        When someone types a question into ChatGPT, Perplexity, Google AI Overview, or any AI assistant,
                        the model has to pick a source to pull the answer from. AEO is about making your page the one
                        that gets picked.
                      </p>
                    </div>

                    {/* What AEO looks like on a real page */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white">What AEO looks like on a real page</h3>
                      <div className="space-y-4">
                        <GuideBlock number={1} heading="A clear question is answered immediately">
                          A heading asks the question, and the very next element — a sentence or a short paragraph — delivers
                          the answer directly. No preamble, no filler, no &ldquo;in today&rsquo;s world&rdquo; warm-up. The answer comes first.
                        </GuideBlock>
                        <GuideBlock number={2} heading="The answer is machine-extractable">
                          The answer lives in clean, semantic HTML — a paragraph, a list, or a definition block — not buried
                          inside an image, a JavaScript widget, or a collapsed accordion that never renders for crawlers.
                        </GuideBlock>
                        <GuideBlock number={3} heading="Supporting detail follows logically">
                          After the direct answer, the page expands with context, steps, examples, or evidence. This mirrors
                          how an AI model structures a response: lead with the answer, then explain.
                        </GuideBlock>
                        <GuideBlock number={4} heading="Structured data backs it up">
                          Schema markup — FAQ, HowTo, Article, Product — tells the engine exactly what the content is and how
                          to extract it. This is not decoration; this is the machine-readable contract.
                        </GuideBlock>
                        <GuideBlock number={5} heading="The entity is named, not assumed">
                          The brand, product, or concept is stated explicitly on the page. AI models do not infer well from
                          context alone. If you want to be cited, say who you are and what your thing does in plain text.
                        </GuideBlock>
                        <GuideBlock number={6} heading="Recency and freshness are visible">
                          A visible publish or update date, a changelog, or a &ldquo;last reviewed&rdquo; note all signal that the page
                          is maintained. AI models with access to recency signals prefer content that is clearly current.
                        </GuideBlock>
                      </div>
                    </div>

                    <hr className="border-white/8" />

                    {/* The overlap with SEO */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-white">The overlap with SEO</h3>
                      <p>
                        AEO and SEO are not enemies. Most of what makes a page good for search engines also makes it good
                        for answer engines. Clear headings, fast load times, mobile-friendliness, internal links, HTTPS,
                        structured data — all of that matters for both.
                      </p>
                      <p>
                        The difference is emphasis. AEO shifts the priority from &ldquo;get this page into the top 10 blue links&rdquo;
                        to &ldquo;make this page the one an AI model chooses to extract the answer from.&rdquo;
                      </p>
                    </div>

                    <hr className="border-white/8" />

                    {/* What changes with AEO */}
                    <div className="space-y-6">
                      <h3 className="text-base font-semibold text-white">What changes when you think AEO</h3>

                      <GuideStep num={1} title="Answer placement becomes critical">
                        <p>
                          In SEO, you might open an article with a story or context. In AEO, the answer needs to come early — ideally
                          in the first paragraph under the heading — because the extraction window is short. If the answer is buried
                          on paragraph six, it probably will not get picked.
                        </p>
                      </GuideStep>

                      <GuideStep num={2} title="Structured data stops being optional">
                        <p>
                          Schema markup has always helped SEO, but for AEO it is closer to required. FAQ schema, HowTo schema,
                          Product schema, and Article schema give the engine a clean contract to pull from. Without it, the engine
                          is guessing — and it will often guess someone else&rsquo;s page instead.
                        </p>
                      </GuideStep>

                      <GuideStep num={3} title="Entity clarity matters more than keyword density">
                        <p>
                          SEO traditionally focused on keywords. AEO focuses on entities — who you are, what you offer, where you
                          operate, and what category you belong to. An AI model is trying to build a knowledge graph entry for your
                          brand. Give it the facts explicitly: name, description, location, offerings, differentiators.
                        </p>
                      </GuideStep>

                      <GuideStep num={4} title="Citations become the new backlinks">
                        <p>
                          In traditional SEO, backlinks are votes of trust. In AEO, citations are votes of authority. When your content
                          gets cited by an AI model — with a source link or an inline reference — that is the AEO equivalent of a
                          high-authority backlink. To earn citations, your content must be specific, factual, and directly answerable.
                        </p>
                      </GuideStep>
                    </div>

                    <hr className="border-white/8" />

                    {/* Practical AEO checklist */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-5 space-y-3">
                      <h3 className="text-base font-semibold text-white">Practical AEO checklist</h3>
                      <ul className="space-y-2 text-white/60">
                        {[
                          'Does the page answer a specific question within the first paragraph?',
                          'Is the answer in clean text (not locked inside images, tabs, or JavaScript)?',
                          'Does the page use FAQ, HowTo, Article, or Product schema?',
                          'Is the brand or entity named explicitly (not just implied)?',
                          'Does the page expand the answer with steps, examples, or evidence?',
                          'Is there a visible publish or update date?',
                          'Would an AI model be able to extract a complete, accurate answer from this page in under 5 seconds?',
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-0.5 w-4 h-4 rounded border border-white/15 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-white/50 text-xs mt-2">If most of these are yes, your page is AEO-ready.</p>
                    </div>

                    {/* Quick summary */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white">The short version</h3>
                      <p>An AEO-ready page is one where:</p>
                      <ul className="space-y-1.5 text-white/60">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> The answer is immediate and extractable</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> The entity is named, not assumed</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Structured data provides a machine-readable contract</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Supporting detail expands the answer logically</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Freshness signals are visible</li>
                      </ul>
                    </div>

                    {/* The framing */}
                    <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-400/15 p-5 space-y-2">
                      <p className="text-white/80 text-sm font-medium">
                        SEO helps your page get found.
                      </p>
                      <p className="text-cyan-300/80 text-sm font-semibold">
                        AEO helps your page get used as the answer.
                      </p>
                      <p className="text-white/50 text-xs mt-2">
                        The best pages do both — they rank in search results <em>and</em> they get cited by AI models.
                        That is the full visibility stack.
                      </p>
                    </div>

                    {/* Mistakes to avoid */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-white">Mistakes that kill AEO</h3>
                      <ul className="space-y-1.5 text-white/60">
                        {[
                          'Burying the answer below paragraphs of context or backstory',
                          'Locking key content inside JavaScript-rendered tabs or accordions',
                          'Using images or infographics as the primary content (not crawlable)',
                          'Leaving out structured data entirely',
                          'Not naming the entity — assuming the reader (or model) already knows',
                          'No publish or update date anywhere on the page',
                          'Writing for keyword density instead of answering the actual question',
                          'Treating AEO as a replacement for SEO instead of a complement',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <X className="w-3 h-3 text-red-400/60 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ──────────────── GEO Guide Modal ──────────────── */}
          <AnimatePresence>
            {openGuide === 'geo' && (
              <motion.div
                key="geo-guide-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4"
                onClick={() => setOpenGuide(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className="relative w-full max-w-3xl bg-[#1e2536] border border-white/10 rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#1e2536] border-b border-white/8 rounded-t-2xl">
                    <div>
                      <h2 className="text-lg font-bold text-white">GEO for Normal People</h2>
                      <p className="text-xs text-white/40 mt-0.5">What actually matters for generative engine visibility</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenGuide(null)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Close guide"
                    >
                      <X className="w-5 h-5 text-white/50" />
                    </button>
                  </div>

                  {/* Modal body */}
                  <div className="px-6 py-6 space-y-8 text-white/75 text-sm leading-relaxed max-h-[80vh] overflow-y-auto">
                    {/* Intro */}
                    <div className="space-y-3">
                      <p>
                        GEO stands for Generative Engine Optimization. The term comes from academic research proposing
                        a framework for improving visibility in generative engine responses.
                      </p>
                      <p>
                        Plain English: it means shaping your site so AI systems are more likely to use you,
                        mention you, or cite you when they generate an answer.
                      </p>
                      <p>
                        The easiest way to separate it from AEO:
                      </p>
                      <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 space-y-1.5">
                        <p>AEO asks: <em className="text-cyan-300/70">&ldquo;Can this page be pulled as the answer?&rdquo;</em></p>
                        <p>GEO asks: <em className="text-cyan-300/70">&ldquo;Will this brand or page be used when AI builds the answer?&rdquo;</em></p>
                      </div>
                      <p>
                        That sounds close because it is close. But the center of gravity is different. AEO is more page-level
                        and extraction-level &mdash; it cares about whether a page is easy to lift into a direct answer. GEO is broader.
                        It cares about whether your site is a trusted source in the larger AI response system at all. That includes
                        citations, mentions, grounding, source selection, and whether your brand is associated with the topic strongly
                        enough to survive when AI compresses the web into one response.
                      </p>
                    </div>

                    {/* The clean line */}
                    <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-400/15 p-5 space-y-1.5">
                      <p className="text-white/70 text-sm">SEO helps you <span className="text-white font-medium">rank</span>.</p>
                      <p className="text-white/70 text-sm">AEO helps you <span className="text-white font-medium">answer</span>.</p>
                      <p className="text-cyan-300/80 text-sm font-semibold">GEO helps you get <span className="text-cyan-300">used</span>.</p>
                    </div>

                    <hr className="border-white/8" />

                    {/* What changes with GEO */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white">What changes when you optimize for GEO</h3>
                      <p>
                        You stop thinking only about one page ranking for one keyword. You start thinking about
                        whether AI systems can clearly identify:
                      </p>
                      <ul className="space-y-1.5 text-white/60 ml-1">
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" /> who you are</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" /> what you are known for</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" /> why your claims are trustworthy</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" /> what topic cluster you actually own</li>
                        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" /> whether your content is strong enough to be cited or referenced</li>
                      </ul>
                    </div>

                    <hr className="border-white/8" />

                    {/* What GEO leans into */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white">What GEO leans harder into</h3>
                      <div className="space-y-4">
                        <GuideBlock number={1} heading="Clear brand and entity identity">
                          AI systems need to know exactly who you are before they will cite you. Your brand name,
                          what you do, and what category you belong to should be stated explicitly &mdash; not assumed,
                          not buried, not left for the model to guess.
                        </GuideBlock>
                        <GuideBlock number={2} heading="Consistent naming across the site">
                          If your homepage calls the product one thing, your about page calls it another, and your
                          blog uses a third variation, AI systems struggle to build a coherent entity entry. Consistency
                          is how you get a clean knowledge graph node.
                        </GuideBlock>
                        <GuideBlock number={3} heading="Strong topical depth">
                          One article on a topic does not make you an authority. A cluster of connected pages &mdash;
                          a main page, supporting questions, comparison pages, case studies &mdash; signals real ownership.
                          GEO rewards sites that genuinely cover a topic, not sites that mention it once.
                        </GuideBlock>
                        <GuideBlock number={4} heading="Original insights, data, or examples">
                          AI models already have access to a compressed version of generic content. What they value
                          for citation is content that adds something new: original data, real examples, specific numbers,
                          unique methodology, or first-party evidence.
                        </GuideBlock>
                        <GuideBlock number={5} heading="Credible trust signals">
                          Author bios, company information, About pages, external references &mdash; these are the signals
                          AI systems use to decide whether a source is safe to cite. The research that introduced GEO found
                          that effectiveness varied by domain, meaning trust is weighed differently depending on the topic.
                        </GuideBlock>
                        <GuideBlock number={6} heading="Content that is easy to quote, summarize, or attribute">
                          AI models compress information. If your content is structured so that key claims are in clean
                          paragraphs, lists, or definition blocks, it is easier for the model to extract and attribute.
                          Walls of text with no structure get compressed away.
                        </GuideBlock>
                        <GuideBlock number={7} heading="Off-site presence that AI can verify">
                          AI systems often favor sources that appear credible beyond their own walls. Mentions, links,
                          and references on third-party platforms &mdash; forums, news, Q&amp;A sites, open-source projects &mdash;
                          give the model independent confirmation that you exist and matter.
                        </GuideBlock>
                      </div>
                    </div>

                    <hr className="border-white/8" />

                    {/* How GEO is measured */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-white">How GEO becomes measurable</h3>
                      <p>
                        A common criticism of GEO is that it sounds theoretical. That is changing. Bing now provides
                        AI Performance reporting covering cited pages and grounding phrases. Google&rsquo;s site-owner documentation
                        for AI features says inclusion in AI experiences follows the same fundamental approach as Search.
                      </p>
                      <p>
                        The practical signals that make GEO measurable:
                      </p>
                      <ul className="space-y-1.5 text-white/60">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> AI mention / citation presence</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Cited pages in Bing AI Performance</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Grounding phrase visibility</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Source inclusion in AI-generated responses</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Brand mention frequency across third-party platforms</li>
                      </ul>
                      <p className="text-white/50 text-xs mt-1">
                        If somebody says they do GEO but they cannot measure AI mentions, cited pages, grounding visibility,
                        or source inclusion, they are probably just repainting old SEO and charging new money.
                      </p>
                    </div>

                    <hr className="border-white/8" />

                    {/* Practical GEO checklist */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-5 space-y-3">
                      <h3 className="text-base font-semibold text-white">Practical GEO checklist</h3>
                      <ul className="space-y-2 text-white/60">
                        {[
                          'Is it obvious what your company or page is about?',
                          'Do you use consistent language for your brand, product, and expertise?',
                          'Do your pages cover topics deeply, not just thin keyword slices?',
                          'Do you include real proof, examples, or original information?',
                          'Are your best pages easy to scan and easy to cite?',
                          'Are your About, author, company, and trust pages strong?',
                          'Do you have topic authority across multiple connected pages, not one lonely article?',
                          'Do you have mentions, links, or references outside your own site?',
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-0.5 w-4 h-4 rounded border border-white/15 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-white/50 text-xs mt-2">If most of these are yes, your site has real GEO readiness.</p>
                    </div>

                    {/* Quick summary */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white">The short version</h3>
                      <ul className="space-y-1.5 text-white/60">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> SEO is about being found in search results</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> AEO is about being pulled as an answer</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> GEO is about being included when AI assembles the answer</li>
                      </ul>
                      <p className="mt-2 text-white/60">Or even shorter:</p>
                      <ul className="space-y-1 text-white/60">
                        <li><span className="text-white font-medium">SEO</span> = rank</li>
                        <li><span className="text-white font-medium">AEO</span> = answer</li>
                        <li><span className="text-cyan-300 font-medium">GEO</span> = citation and presence</li>
                      </ul>
                    </div>

                    {/* The framing close */}
                    <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-400/15 p-5 space-y-2">
                      <p className="text-white/80 text-sm">
                        If SEO gets your page into the race, and AEO helps your page answer the question&hellip;
                      </p>
                      <p className="text-cyan-300/80 text-sm font-semibold">
                        GEO is what makes AI say your name while giving that answer.
                      </p>
                    </div>

                    {/* Mistakes to avoid */}
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-white">Mistakes that kill GEO</h3>
                      <ul className="space-y-1.5 text-white/60">
                        {[
                          'Inconsistent brand naming across your own pages',
                          'No About, author, or company trust pages',
                          'Thin content that mentions a topic without covering it',
                          'Zero third-party mentions or references anywhere',
                          'Generic content with nothing original to cite',
                          'Treating GEO as a label for the same old SEO work',
                          'No structured data to give AI a machine-readable contract',
                          'No measurable AI visibility metrics &mdash; just guessing',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <X className="w-3 h-3 text-red-400/60 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ──────────────── Playbook Guide Modal ──────────────── */}
          <AnimatePresence>
            {openGuide === 'playbook' && (
              <motion.div
                key="playbook-guide-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4"
                onClick={() => setOpenGuide(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className="relative w-full max-w-3xl bg-[#1e2536] border border-white/10 rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#1e2536] border-b border-white/8 rounded-t-2xl">
                    <div>
                      <h2 className="text-lg font-bold text-white">The Page-by-Page Playbook</h2>
                      <p className="text-xs text-white/40 mt-0.5">What every page should do for SEO, AEO, and GEO at once</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenGuide(null)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Close guide"
                    >
                      <X className="w-5 h-5 text-white/50" />
                    </button>
                  </div>

                  {/* Modal body */}
                  <div className="px-6 py-6 space-y-8 text-white/75 text-sm leading-relaxed max-h-[80vh] overflow-y-auto">
                    {/* Intro */}
                    <div className="space-y-3">
                      <p>
                        Every page should do three jobs at once:
                      </p>
                      <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 space-y-1.5">
                        <p><span className="text-white font-medium">SEO</span> &mdash; help the page get found in search</p>
                        <p><span className="text-white font-medium">AEO</span> &mdash; help the page answer the question fast</p>
                        <p><span className="text-cyan-300 font-medium">GEO</span> &mdash; help AI trust the page enough to use or cite it</p>
                      </div>
                      <p>
                        This is the reusable playbook. Follow it for every page you publish or update.
                      </p>
                    </div>

                    <hr className="border-white/8" />

                    {/* The 12 steps */}
                    <div className="space-y-6">
                      <GuideStep num={1} title="Give the page one job">
                        <p>Every page needs one clear purpose. Not &ldquo;rank for everything.&rdquo; Not &ldquo;kind of about this and kind of about that.&rdquo; One page, one main problem, one main promise.</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>A service page sells one service</li>
                          <li>A blog post answers one question</li>
                          <li>A location page targets one service in one place</li>
                          <li>A product page explains one product clearly</li>
                        </ul>
                        <p className="mt-2 text-cyan-300/70 text-xs italic">If the page has no sharp purpose, everything else gets blurry.</p>
                      </GuideStep>

                      <GuideStep num={2} title="Match the page to the searcher's real need">
                        <p>Before writing, ask: what is the person actually trying to do?</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Are they trying to learn?</li>
                          <li>Compare options?</li>
                          <li>Buy something?</li>
                          <li>Find a local provider?</li>
                          <li>Get a fast definition?</li>
                        </ul>
                        <p className="mt-2">Your page should match that mood. Ranking systems surface the most relevant and useful results, not just pages with matching words.</p>
                      </GuideStep>

                      <GuideStep num={3} title="Make the topic obvious immediately">
                        <p>Do not make Google, Bing, or the reader guess. Put the main idea in:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>The title tag</li>
                          <li>The main heading</li>
                          <li>The first paragraph</li>
                          <li>The URL if possible</li>
                        </ul>
                        <p className="mt-3">A simple pattern:</p>
                        <div className="rounded-lg bg-white/[0.03] border border-white/8 p-3 mt-2 space-y-1 text-white/50 text-xs">
                          <p><span className="text-white/70 font-medium">Title:</span> What the page is about</p>
                          <p><span className="text-white/70 font-medium">H1:</span> The same topic in plain language</p>
                          <p><span className="text-white/70 font-medium">Opening:</span> Direct explanation of what the page covers</p>
                        </div>
                      </GuideStep>

                      <GuideStep num={4} title="Answer fast">
                        <p>This is where AEO starts. The page should answer the core question near the top. Not after three paragraphs of throat-clearing. Not buried under brand fluff.</p>
                        <div className="rounded-lg bg-white/[0.03] border border-white/8 p-3 mt-2 text-white/50 text-xs italic">
                          &ldquo;What is AEO? AEO means making your content easy for search engines and AI systems to pull as a direct answer.&rdquo;
                        </div>
                        <p className="mt-2">That works because it is clean, direct, and extractable.</p>
                      </GuideStep>

                      <GuideStep num={5} title="Build the rest of the page with clear sections">
                        <p>After the fast answer, go deeper. Use headings that sound like real questions or clear subtopics:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>What it is</li>
                          <li>Why it matters</li>
                          <li>How it works</li>
                          <li>Examples</li>
                          <li>Mistakes to avoid</li>
                          <li>What to do next</li>
                        </ul>
                        <p className="mt-2">This helps humans scan and helps engines understand the content structure.</p>
                      </GuideStep>

                      <GuideStep num={6} title="Write like a human, not a brochure">
                        <p>The page should sound clear, grounded, and specific.</p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <p className="text-xs font-medium text-emerald-400/70 mb-1">Good</p>
                            <ul className="list-disc list-inside space-y-0.5 text-white/50 text-xs">
                              <li>Short paragraphs</li>
                              <li>Plain words</li>
                              <li>Real examples</li>
                              <li>Specific claims</li>
                              <li>Simple definitions</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-red-400/70 mb-1">Bad</p>
                            <ul className="list-disc list-inside space-y-0.5 text-white/50 text-xs">
                              <li>Vague marketing lines</li>
                              <li>Long filler intros</li>
                              <li>Keyword stuffing</li>
                              <li>Trying to sound &ldquo;smart&rdquo;</li>
                            </ul>
                          </div>
                        </div>
                      </GuideStep>

                      <GuideStep num={7} title="Add something original">
                        <p>This is where SEO starts getting stronger and GEO starts becoming real. Do not just repeat what ten other pages already say. Add something that makes your page worth using:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Your process or framework</li>
                          <li>Original examples or screenshots</li>
                          <li>A checklist</li>
                          <li>Pricing context</li>
                          <li>Mistakes you have seen in the real world</li>
                          <li>Data, proof, or experience</li>
                        </ul>
                        <p className="mt-2 text-cyan-300/70 text-xs italic">The more useful and reusable your content is, the better your odds of being included in AI-generated answers.</p>
                      </GuideStep>

                      <GuideStep num={8} title="Make the page easy to trust">
                        <p>GEO lives here. AI systems are more likely to use pages that feel safe, clear, and attributable. The page and site should make these things obvious:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Who wrote this</li>
                          <li>What company this is</li>
                          <li>What the company does</li>
                          <li>Why this source should be trusted</li>
                          <li>How to contact you</li>
                          <li>When the content was updated (if relevant)</li>
                        </ul>
                      </GuideStep>

                      <GuideStep num={9} title="Use the right structured data where it fits">
                        <p>Do not turn schema into religion. Use it where it matches the page.</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Article schema for articles</li>
                          <li>FAQ schema for real FAQ sections</li>
                          <li>QAPage only when the page truly is a question with user-submitted answers</li>
                          <li>Organization or business schema for the brand/site</li>
                        </ul>
                        <p className="mt-2">Schema supports clarity. Schema does not replace clarity.</p>
                      </GuideStep>

                      <GuideStep num={10} title="Link to your other relevant pages">
                        <p>Internal links are not decoration. They are paths.</p>
                        <p className="mt-2">If one page mentions a service, concept, tool, or related topic you explain elsewhere, link to it. That helps users keep moving and helps search engines understand your site structure.</p>
                      </GuideStep>

                      <GuideStep num={11} title="Make sure the page is reachable and indexable">
                        <p>The boring part that still matters:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>The page loads properly</li>
                          <li>It works on mobile</li>
                          <li>It is linked from somewhere on the site</li>
                          <li>It is not blocked from crawling or indexing</li>
                          <li>It is included in your sitemap if possible</li>
                        </ul>
                        <p className="mt-2">Search engines need to discover and index a page before it can compete.</p>
                      </GuideStep>

                      <GuideStep num={12} title="End with a clear next step">
                        <p>A good page does not just answer. It moves the user somewhere sensible:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-white/60">
                          <li>Contact us</li>
                          <li>Book a demo</li>
                          <li>Read the next guide</li>
                          <li>Compare plans</li>
                          <li>Request an audit</li>
                          <li>See examples</li>
                        </ul>
                        <p className="mt-2">This is not only about conversion. It also helps the page feel complete and purposeful.</p>
                      </GuideStep>
                    </div>

                    <hr className="border-white/8" />

                    {/* Quick reference box */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-5 space-y-3">
                      <h3 className="text-base font-semibold text-white">What to do on every page</h3>
                      <ul className="space-y-2 text-white/60">
                        {[
                          'Make the page about one thing.',
                          'Match what the searcher actually wants.',
                          'Make the topic obvious in the title, heading, and opening.',
                          'Answer fast.',
                          'Use clear sections and simple language.',
                          'Add something original.',
                          'Make the page easy to trust.',
                          'Use fitting schema.',
                          'Link to related pages.',
                          'Make sure the page can be found and indexed.',
                          'End with a clear next step.',
                        ].map((item, i) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-0.5 w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold shrink-0">{i + 1}</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Memory hook */}
                    <div className="rounded-xl bg-cyan-500/[0.06] border border-cyan-400/15 p-5 space-y-2">
                      <p className="text-white/80 text-sm font-medium">The one-line memory hook:</p>
                      <p className="text-white/60 text-sm">
                        <span className="text-white font-medium">SEO</span> gets the page discovered.
                        {' '}<span className="text-white font-medium">AEO</span> gets the page extracted.
                        {' '}<span className="text-cyan-300 font-semibold">GEO</span> gets the page used.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ──────────────── My Tickets Tab ──────────────── */}
          {activeTab === 'tickets' && (
            <motion.div
              key="tickets"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {!isLoggedIn ? (
                <div className="text-center py-20">
                  <Ticket className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50 mb-4">Sign in to view and manage your support tickets</p>
                  <Link
                    to="/auth?mode=signin"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-all"
                  >
                    Sign In <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <>
                  {/* Ticket list header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-white">Support Tickets</h2>
                      <p className="text-xs text-white/40 mt-0.5">{total} total ticket{total !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-lg p-0.5">
                        {['all', 'open', 'in_progress', 'resolved', 'closed'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setTicketFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                              ticketFilter === f
                                ? 'bg-white/10 text-white'
                                : 'text-white/40 hover:text-white/60'
                            }`}
                          >
                            {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setActiveTab('new-ticket')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-xs font-medium hover:bg-cyan-500/25 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        New
                      </button>
                    </div>
                  </div>

                  {ticketsError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-400/20 text-red-300 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {ticketsError}
                    </div>
                  )}

                  {ticketsLoading && tickets.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
                      <p className="text-white/40 text-sm mt-3">Loading tickets...</p>
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="text-center py-20">
                      <Inbox className="w-10 h-10 text-white/15 mx-auto mb-3" />
                      <p className="text-white/40 text-sm">No tickets found</p>
                      <button
                        onClick={() => setActiveTab('new-ticket')}
                        className="mt-3 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                      >
                        Create your first ticket
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tickets.map((ticket) => {
                        const statusMeta = STATUS_META[ticket.status as SupportTicketStatus] || STATUS_META.open;
                        const priorityMeta = PRIORITY_META[ticket.priority] || PRIORITY_META.normal;
                        const StatusIcon = statusMeta.icon;
                        return (
                          <button
                            key={ticket.id}
                            onClick={() => handleOpenTicket(ticket)}
                            className="w-full text-left rounded-xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.05] hover:border-white/12 transition-all p-4 group"
                            type="button"
                          >
                            <div className="flex items-start gap-3.5">
                              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${statusMeta.bg}`}>
                                <StatusIcon className={`w-4 h-4 ${statusMeta.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                                    {ticket.subject}
                                  </span>
                                  <span className="text-[10px] text-white/25 font-mono shrink-0">{ticket.ticket_number}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color}`}>
                                    {statusMeta.label}
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] text-white/35">
                                    <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
                                    {priorityMeta.label}
                                  </span>
                                  <span className="text-[10px] text-white/25">
                                    {SUPPORT_TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label || ticket.category}
                                  </span>
                                  <span className="text-[10px] text-white/20">
                                    {new Date(ticket.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors shrink-0 mt-1" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ──────────────── New Ticket Tab ──────────────── */}
          {activeTab === 'new-ticket' && (
            <motion.div
              key="new-ticket"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              {!isLoggedIn ? (
                <div className="text-center py-20">
                  <Ticket className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50 mb-4">Sign in to create a support ticket</p>
                  <Link
                    to="/auth?mode=signin"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-all"
                  >
                    Sign In <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Submit a Support Ticket</h2>
                    <p className="text-sm text-white/40 mt-1">
                      Describe your issue and our team will respond within 24 hours.
                    </p>
                  </div>

                  {ticketSuccess && (
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/20">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <p className="text-sm text-emerald-300">{ticketSuccess}</p>
                    </div>
                  )}

                  {ticketsError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-400/20 text-red-300 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {ticketsError}
                      <button onClick={clearError} className="ml-auto text-red-400/60 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-5 rounded-xl bg-white/[0.03] border border-white/8 p-6">
                    {/* Subject */}
                    <div>
                      <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                        Subject
                      </label>
                      <input
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="Brief summary of your issue"
                        maxLength={200}
                        className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400/25 transition-all"
                      />
                    </div>

                    {/* Category + Priority row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                          Category
                        </label>
                        <select
                          value={ticketCategory}
                          onChange={(e) => setTicketCategory(e.target.value as SupportTicketCategory)}
                          className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400/25 transition-all"
                        >
                          {SUPPORT_TICKET_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value} className="bg-[#2f3747] text-white">
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                          Priority
                        </label>
                        <select
                          value={ticketPriority}
                          onChange={(e) => setTicketPriority(e.target.value as SupportTicketPriority)}
                          className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400/25 transition-all"
                        >
                          <option value="low" className="bg-[#2f3747]">Low</option>
                          <option value="normal" className="bg-[#2f3747]">Normal</option>
                          <option value="high" className="bg-[#2f3747]">High</option>
                          <option value="urgent" className="bg-[#2f3747]">Urgent</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                        Description
                      </label>
                      <textarea
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="Describe your issue in detail. Include steps to reproduce, expected behavior, and any relevant URLs or IDs."
                        maxLength={5000}
                        rows={6}
                        className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400/25 transition-all resize-none"
                      />
                      <p className="text-[10px] text-white/25 mt-1 text-right">{ticketDescription.length}/5000</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleCreateTicket}
                        disabled={ticketsLoading || ticketSubject.trim().length < 3 || ticketDescription.trim().length < 10}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {ticketsLoading ? (
                          <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Submit Ticket
                      </button>
                      <button
                        onClick={() => setActiveTab('tickets')}
                        className="px-4 py-2.5 rounded-lg text-white/40 text-sm hover:text-white/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ──────────────── Ticket Detail Tab ──────────────── */}
          {activeTab === 'ticket-detail' && activeTicket && (
            <motion.div
              key="ticket-detail"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              {/* Ticket header */}
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono text-white/30">{activeTicket.ticket.ticket_number}</span>
                      {(() => {
                        const s = STATUS_META[activeTicket.ticket.status as SupportTicketStatus] || STATUS_META.open;
                        return (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${s.bg} ${s.color}`}>
                            {s.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const p = PRIORITY_META[activeTicket.ticket.priority] || PRIORITY_META.normal;
                        return (
                          <span className="flex items-center gap-1 text-[10px] text-white/35">
                            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                            {p.label} priority
                          </span>
                        );
                      })()}
                    </div>
                    <h2 className="text-lg font-semibold text-white">{activeTicket.ticket.subject}</h2>
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/35">
                      <span>{SUPPORT_TICKET_CATEGORIES.find((c) => c.value === activeTicket.ticket.category)?.label || activeTicket.ticket.category}</span>
                      <span>&middot;</span>
                      <span>Created {new Date(activeTicket.ticket.created_at).toLocaleString()}</span>
                      {activeTicket.ticket.resolved_at && (
                        <>
                          <span>&middot;</span>
                          <span>Resolved {new Date(activeTicket.ticket.resolved_at).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeTicket.ticket.status !== 'closed' && (
                      <button
                        onClick={() => closeTicketById(activeTicket.ticket.id).then(() => setActiveTab('tickets'))}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-medium hover:text-white/80 hover:border-white/15 transition-all"
                      >
                        Close Ticket
                      </button>
                    )}
                    <button
                      onClick={() => { setActiveTab('tickets'); setActiveTicket(null); }}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4 text-white/40" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages thread */}
              <div className="space-y-3">
                {activeTicket.messages.map((msg) => {
                  const isUser = msg.sender_type === 'user';
                  const isSystem = msg.sender_type === 'system';
                  return (
                    <div key={msg.id} className={`rounded-xl p-4 ${
                      isUser
                        ? 'bg-white/[0.03] border border-white/8'
                        : isSystem
                          ? 'bg-cyan-500/5 border border-cyan-400/15'
                          : 'bg-emerald-500/5 border border-emerald-400/15'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                          isUser ? 'bg-white/10 text-white/60' : isSystem ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {isUser ? 'Y' : isSystem ? 'S' : 'A'}
                        </div>
                        <span className="text-xs font-medium text-white/60">
                          {isUser ? 'You' : isSystem ? 'System' : 'Support Team'}
                        </span>
                        <span className="text-[10px] text-white/25 ml-auto">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  );
                })}
              </div>

              {/* Reply form */}
              {activeTicket.ticket.status !== 'closed' && (
                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    maxLength={5000}
                    rows={3}
                    className="w-full rounded-lg bg-white/[0.04] border border-white/8 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:border-cyan-400/25 transition-all resize-none mb-3"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/20">{replyText.length}/5000</p>
                    <button
                      onClick={handleReply}
                      disabled={!replyText.trim() || ticketsLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Reply
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Guide sub-components
 * ──────────────────────────────────────────────────────────────────────────── */
function GuideBlock({ number, heading, children }: { number: number; heading: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center text-xs font-bold text-cyan-300">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{heading}</p>
        <p className="text-sm text-white/60 mt-1 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function GuideStep({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/6 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="shrink-0 w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center text-[10px] font-bold text-cyan-300">
          {num}
        </span>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <div className="text-sm text-white/60 leading-relaxed">{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tab Button
 * ──────────────────────────────────────────────────────────────────────────── */
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
  requiresAuth,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  badge?: number;
  requiresAuth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={requiresAuth}
      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
        active
          ? 'border-cyan-400 text-cyan-300'
          : 'border-transparent text-white/40 hover:text-white/60 hover:border-white/10'
      } ${requiresAuth ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}
