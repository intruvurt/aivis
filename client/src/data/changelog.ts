/**
 * Changelog entries - newest first.
 * Each entry drives the public /changelog page AND the in-app What's New panel.
 *
 * When adding a new entry, use `today()` for the date field:
 *   { date: today(), title: "...", ... }
 */

/** Returns today's date as YYYY-MM-DD for new changelog entries. */
export const today = (): string => new Date().toISOString().slice(0, 10);

export interface ChangelogEntry {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Short title */
  title: string;
  /** What changed - 1-3 sentences */
  description: string;
  /** Why it matters */
  why: string;
  /** Which users benefit */
  audience: "all" | "free" | "paid" | "signal" | "alignment";
  /** Any action users should take (empty string if none) */
  action: string;
  /** Categorization tag */
  category: "infrastructure" | "feature" | "fix" | "improvement" | "pricing" | "security";
  /** Optional: highlight as a high-value change (renders with accent color) */
  highlight?: boolean;
}

const changelog: ChangelogEntry[] = [
  {
    date: today(),
    title: "Language Accessibility (i18n)",
    description:
      "Navigation, footer, and pricing page now respond to your selected language. English, French, Spanish, and German translations are live across all core UI surfaces.",
    why: "Users who changed the language setting saw no visible change. The translation system is now wired end-to-end.",
    audience: "all",
    action: "Switch language via the globe icon in the footer or nav to verify.",
    category: "fix",
    highlight: true,
  },
  {
    date: today(),
    title: "Team Workspace Onboarding",
    description:
      "New getting-started guide on the Team page walks you through inviting members, running shared audits, and tracking progress - shown automatically for new workspaces.",
    why: "New team workspace owners had no guidance on what to do first. The onboarding section sets clear next steps.",
    audience: "paid",
    action: "Visit the Team page with a fresh workspace to see the guide.",
    category: "improvement",
  },
  {
    date: today(),
    title: "MCP Console Explainer",
    description:
      "Added a 'What is MCP?' section to the MCP Console with plain-English use cases: IDE integration, automated workflows, and scoped security.",
    why: "The MCP page jumped straight into technical setup without explaining what MCP is or why you'd use it.",
    audience: "paid",
    action: "",
    category: "improvement",
  },
  {
    date: today(),
    title: "Pricing Comparison Table",
    description:
      "Added a scannable feature comparison matrix and social proof strip to the pricing page for quicker plan evaluation.",
    why: "Users had to read through prose to understand tier differences. The table makes it instant.",
    audience: "all",
    action: "",
    category: "improvement",
  },
  {
    date: today(),
    title: "Account Deletion - Full Data Cleanup",
    description:
      "Account deletion now explicitly removes audit chains, fix packs, license records, and orphan rows across all 72 database tables before cascading the user delete.",
    why: "The previous handler relied on CASCADE and left orphaned rows in tables without foreign key constraints.",
    audience: "all",
    action: "",
    category: "security",
  },
  {
    date: today(),
    title: "Sitemap & Prerender Sync",
    description:
      "7 blog posts added to prerender, 6 feature pages added to sitemap, robots.txt inconsistencies fixed, and llms.txt updated with all current pages.",
    why: "Crawlers were hitting SPA shells for unrendered blog posts, and several public feature pages were invisible to search engines.",
    audience: "all",
    action: "",
    category: "infrastructure",
  },
  {
    date: today(),
    title: "Streamlined Audit Output",
    description:
      "Removed non-actionable sections from the analysis view - platform benchmark, estimated costs, generic best practices, and redundant summaries are gone. Every remaining section is something you can act on to raise your score.",
    why: "The audit page was cluttered with decorative metrics that didn't help you improve. Now the output is focused on what actually moves your score.",
    audience: "all",
    action: "Run an audit to see the cleaner results layout.",
    category: "improvement",
    highlight: true,
  },
  {
    date: today(),
    title: "Writing & Editorial Audit (7-Pass Framework)",
    description:
      "Upload a blog post, article, or content draft and get a deep editorial audit powered by a 7-pass AI content intelligence framework - covering structure, entity clarity, information gain, citation readiness, fact density, readability, and chunking quality.",
    why: "Content quality is the #1 lever for AI citation. This gives writers and editors a concrete rubric to improve their work before publishing.",
    audience: "all",
    action: "Upload a document on the Analyze page and select the writing audit mode.",
    category: "feature",
    highlight: true,
  },
  {
    date: today(),
    title: "Upload Analysis: Writing vs Code/Template Split",
    description:
      "File uploads are now automatically routed to the right analysis pipeline - writing content gets the editorial 7-pass audit, while code and templates get a 5-dimension scan covering SEO, AEO, GEO, security, and AI extractability.",
    why: "A blog post and an HTML template need completely different analysis. Auto-routing ensures each upload gets the most relevant audit.",
    audience: "all",
    action: "",
    category: "feature",
  },
  {
    date: today(),
    title: "Brand Mention Tracking (15 Sources)",
    description:
      "Track where your brand appears across Reddit, Hacker News, Mastodon, DuckDuckGo, Bing, Google News, GitHub, Quora, and Product Hunt.",
    why: "AI models learn from public mentions. Knowing where you're mentioned helps you reinforce positive signals and fix gaps.",
    audience: "alignment",
    action: "Go to Brand Mentions to run your first scan.",
    category: "feature",
    highlight: true,
  },
  {
    date: "2026-03-21",
    title: "Alignment Tier Premium Upgrade",
    description:
      "Alignment plan now includes API key access, webhook integrations, scheduled rescans, and expanded page/competitor limits - making it a real productivity tier for solo founders and small teams.",
    why: "Alignment was too thin compared to Signal. Now it delivers meaningful automation without jumping to a $149/mo plan.",
    audience: "alignment",
    action: "Check Settings to configure your new API keys and webhook endpoints.",
    category: "feature",
  },
  {
    date: "2026-03-21",
    title: "Signal Tier - Agency-Grade Buff",
    description:
      "Signal now supports 15 crawled pages, 8 competitors, daily rescans, up to 5 API keys, and a higher webhook ceiling. Built for agencies and growing SMBs who need serious coverage.",
    why: "Signal users were hitting limits too quickly. The new ceilings reflect real agency workloads.",
    audience: "signal",
    action: "",
    category: "feature",
  },
  {
    date: "2026-03-21",
    title: "Notion, MS Teams & Google Chat Integrations",
    description:
      "New webhook destinations: push audit results, score alerts, and competitor updates directly into Notion databases, Microsoft Teams channels, or Google Chat spaces - no API keys needed.",
    why: "Teams live in different tools. Meeting them where they already work makes visibility data actionable, not just viewable.",
    audience: "alignment",
    action: "Go to Settings → Integrations to connect your workspace.",
    category: "feature",
  },
  {
    date: "2026-03-21",
    title: "SOC1 Security Hardening",
    description:
      "Added a security audit trail with tamper-evident logging across auth, billing, admin, data-export, and API lifecycle events. Content integrity hashing now protects every persisted audit.",
    why: "Enterprise buyers need proof that audit data hasn't been tampered with. This brings the platform closer to SOC 1 Type I readiness.",
    audience: "all",
    action: "",
    category: "security",
  },
  {
    date: "2026-03-21",
    title: "Enterprise Reports & Analytics Upgrades",
    description:
      "Reports page now supports PDF export and a score-range filter. Analytics page adds CSV export buttons for both the Trends and SEO tabs so you can pull data into your own tools.",
    why: "Power users need to share audit results with clients and stakeholders in formats they already use.",
    audience: "paid",
    action: "Visit Reports or Analytics to try the new export buttons.",
    category: "feature",
  },
  {
    date: "2026-03-21",
    title: "Feature Gating & White-Label Fixes",
    description:
      "Fixed default rescan frequency falling through to undefined for lower tiers, corrected white-label export payload to use real tier limits, and updated the landing page feature matrix.",
    why: "Tier entitlements must be consistent everywhere - settings, exports, and marketing. These fixes close the gaps.",
    audience: "all",
    action: "",
    category: "fix",
  },
  {
    date: "2026-03-20",
    title: "Database Retention & Cleanup System",
    description:
      "Automated database maintenance now runs on a 6-hour cycle - pruning expired sessions, enforcing per-tier audit storage caps, evicting stale cache entries, and cleaning aged rate-limit events and notifications.",
    why: "Keeps storage lean and predictable as the user base grows. Each tier has a defined audit retention limit (Observer 25, Alignment 100, Signal 500, scorefix 1000) so the database stays healthy without manual intervention.",
    audience: "all",
    action: "",
    category: "infrastructure",
  },
  {
    date: "2026-03-19",
    title: "Auto-Competitor Detection",
    description:
      "When you analyze a URL, the platform now automatically checks whether it could be a competitor to your own website based on shared topical keywords and brand signals.",
    why: "Helps you discover competitors you didn't know about - directly from your normal audit workflow, no extra steps required.",
    audience: "alignment",
    action:
      "Add your website URL in Settings so auto-competitor detection can activate. Alignment tier or above required for competitor tracking.",
    category: "feature",
  },
  {
    date: "2026-03-19",
    title: "Reverse Engineer UX Redesign",
    description:
      "Completely rebuilt the Reverse Engineer results UI. All four tools (Decompile, Ghost, Model Diff, Simulate) now show structured, readable results instead of raw JSON dumps.",
    why: "The old renderers dumped generic nested objects that were hard to interpret. The new layouts surface what matters - scores, strategies, divergence points, and actionable recommendations - in a scannable format.",
    audience: "all",
    action: "",
    category: "improvement",
  },
  {
    date: "2026-03-19",
    title: "Changelog & What's New System",
    description:
      "Added a public changelog page and an in-app What's New panel so you can always see what we shipped.",
    why: "Transparency. You should never have to wonder whether the platform is actively maintained.",
    audience: "all",
    action: "",
    category: "feature",
  },
  {
    date: "2026-03-18",
    title: "Free-Tier AI Model Chain Overhaul",
    description:
      "Replaced the unreliable DeepSeek R1 reasoning model with Gemini 2.0 Flash as the primary free-tier model. Added a full 6-model fallback chain so free audits no longer fail silently.",
    why: "DeepSeek R1 outputs reasoning blocks that break JSON parsing. The new chain is faster, more reliable, and gracefully falls back if any single model is unavailable.",
    audience: "free",
    action: "",
    category: "fix",
  },
  {
    date: "2026-03-18",
    title: "Infrastructure Migration to New Database",
    description:
      "Migrated the platform to a new high-availability Postgres instance. All services are stable and running on the new infrastructure.",
    why: "The previous database hit compute quota limits causing intermittent outages. The new instance removes that bottleneck entirely.",
    audience: "all",
    action:
      "If you had an existing account, re-register with the same email - your Stripe subscription will automatically re-link.",
    category: "infrastructure",
  },
  {
    date: "2026-03-18",
    title: "Batch Migration System",
    description:
      "Reduced database migration overhead by 98% - from 260 individual queries to a single batch operation.",
    why: "Faster cold starts and dramatically lower database compute usage during deployments.",
    audience: "all",
    action: "",
    category: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Graceful AI Pipeline Degradation",
    description:
      "When a multi-stage AI pipeline partially fails, the system now preserves valid earlier work and returns a usable result instead of crashing the entire audit.",
    why: "Audits are expensive in time and credits. Losing a full result because one downstream model timed out is unacceptable.",
    audience: "paid",
    action: "",
    category: "fix",
  },
];

export default changelog;
