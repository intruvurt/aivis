// client/src/constants/guideBotConfig.ts
// Page-aware suggestions & greetings for the GuideBot assistant
// Preset pools are larger than displayed — getSuggestions() rotates randomly.

/** Full suggestion pools per page. getSuggestions() picks a random subset. */
const SUGGESTION_POOLS: Record<string, string[]> = {
  '/': [
    'Run an audit on my site',
    'What does my score mean?',
    'Show my milestones & credits',
    'Fetch robots.txt for my site',
    'How do I improve my AI visibility?',
    'What are the 6 scoring categories?',
    'Schedule audit for my site',
    'What can Bix do?',
  ],
  '/app': [
    'Run an audit on my site',
    'What does my score mean?',
    'Show my milestones & credits',
    'What changed since my last audit?',
    'How do I improve my score fastest?',
    'Compare my tiers',
    'Fetch robots.txt for my site',
    'Schedule audit for my site',
  ],
  '/app/analytics': [
    'How do I read the trends?',
    'Why did my score change?',
    'What affects my score most?',
    'Show me my audit history',
    'Which category am I weakest in?',
    'How often should I re-audit?',
  ],
  '/app/competitors': [
    'How does competitor tracking work?',
    'How many competitors can I track?',
    'What should I compare?',
    'Track example.com as competitor',
    'Where am I losing to competitors?',
    'How do I add a competitor?',
  ],
  '/app/citations': [
    'What is citation tracking?',
    'Which AI platforms do you check?',
    'How do I improve citations?',
    'Test citations for my brand',
    'What makes AI cite a source?',
    'How does citation testing work?',
  ],
  '/app/reverse-engineer': [
    'What are the reverse engineer tools?',
    'What does Decompile do?',
    'How does Ghost mode work?',
    'Walk me through Model Diff',
    'What is Simulate used for?',
    'How do AI models decide what to cite?',
  ],
  '/pricing': [
    'Compare the tiers for me',
    'What does Signal add?',
    'Can I cancel anytime?',
    'What is ScoreFix AutoFix PR?',
    'How do credits work?',
    'What is the triple-check pipeline?',
  ],
  '/app/reports': [
    'How do I export a report?',
    'Can I share my report?',
    'What format is the export?',
    'How do I white-label a report?',
    'Compare two audit reports',
    'Download my latest report',
  ],
  '/faq': [
    'What is AI visibility?',
    'How is this different from SEO?',
    'Is my data safe?',
    'How long does an analysis take?',
    'Can I export my report?',
    'What platforms does this cover?',
  ],
  '/guide': [
    'Walk me through the audit steps',
    'What are the 6 scoring categories?',
    'What is the triple-check pipeline?',
    'Explain the scoring methodology',
    'What does AiVIS scan exactly?',
    'How do recommendations work?',
  ],
  '/help': [
    'Walk me through the audit steps',
    'What are the scoring categories?',
    'What plan should I choose?',
    'Open a support ticket',
    'How do I contact support?',
    'Check my ticket status',
  ],
  '/app/settings': [
    'How do I change my preferences?',
    'What notification options are there?',
    'How do I delete my data?',
    'Change my email notifications',
    'What is the privacy policy?',
    'How do I export my data?',
  ],
  '/app/profile': [
    'How do I update my profile?',
    'How do I set my website URL?',
    'What is branding settings?',
    'How do I change my password?',
    'How do I add a logo?',
  ],
  '/app/billing': [
    'How do I upgrade my plan?',
    'Can I cancel anytime?',
    'How do credits work?',
    'What payment methods do you accept?',
    'How do I get a refund?',
    'Change my billing cycle',
  ],
  '/app/notifications': [
    'What notifications will I get?',
    'How do I mute a category?',
    'Check my ticket status',
    'What are notification preferences?',
    'Do I get email notifications?',
  ],
  '/app/keywords': [
    'What is keyword intelligence?',
    'How do keywords affect AI visibility?',
    'What keywords should I target?',
    'How does keyword analysis work?',
  ],
  '/app/niche-discovery': [
    'What is niche discovery?',
    'How does niche analysis work?',
    'Show trending niches',
    'What opportunities exist in my space?',
  ],
  '/app/score-fix': [
    'What is ScoreFix AutoFix PR?',
    'How does automated remediation work?',
    'How many code lines per fix?',
    'What does the MCP integration do?',
  ],
};

/** How many suggestions to show at once */
const SUGGESTIONS_DISPLAY_COUNT = 4;

/**
 * Get a rotated random subset of suggestions for a page.
 * Returns `SUGGESTIONS_DISPLAY_COUNT` items from the pool.
 */
export function getSuggestions(path: string): string[] {
  // Try exact match, then /app prefix strip, then default
  const pool =
    SUGGESTION_POOLS[path] ||
    SUGGESTION_POOLS[path.replace(/^\/app/, '')] ||
    SUGGESTION_POOLS['/'];

  if (!pool || pool.length <= SUGGESTIONS_DISPLAY_COUNT) {
    return pool || SUGGESTION_POOLS['/']!;
  }

  // Fisher-Yates shuffle on a copy, take first N
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, SUGGESTIONS_DISPLAY_COUNT);
}

/** Static fallback for when you just need deterministic suggestions */
export const DEFAULT_SUGGESTIONS = [
  'What is AiVIS?',
  'How does the audit work?',
  'Show me live pricing and tier differences',
  'Read results from this share URL',
  'Audit files for my site',
];

/** Page-to-relevant-pages mapping for contextual navigation */
export const RELATED_PAGES: Record<string, Array<{ label: string; path: string }>> = {
  '/app': [
    { label: 'Analytics', path: '/app/analytics' },
    { label: 'Reports', path: '/app/reports' },
    { label: 'Competitors', path: '/app/competitors' },
  ],
  '/app/analytics': [
    { label: 'Dashboard', path: '/app' },
    { label: 'Reports', path: '/app/reports' },
    { label: 'Competitors', path: '/app/competitors' },
  ],
  '/app/competitors': [
    { label: 'Analytics', path: '/app/analytics' },
    { label: 'Citations', path: '/app/citations' },
    { label: 'Niche Discovery', path: '/app/niche-discovery' },
  ],
  '/app/citations': [
    { label: 'Reverse Engineer', path: '/app/reverse-engineer' },
    { label: 'Competitors', path: '/app/competitors' },
    { label: 'Reports', path: '/app/reports' },
  ],
  '/app/reverse-engineer': [
    { label: 'Citations', path: '/app/citations' },
    { label: 'Analytics', path: '/app/analytics' },
    { label: 'Prompt Intelligence', path: '/app/prompt-intelligence' },
  ],
  '/app/reports': [
    { label: 'Analytics', path: '/app/analytics' },
    { label: 'Dashboard', path: '/app' },
    { label: 'Settings', path: '/app/settings' },
  ],
  '/app/keywords': [
    { label: 'Analytics', path: '/app/analytics' },
    { label: 'Niche Discovery', path: '/app/niche-discovery' },
    { label: 'Citations', path: '/app/citations' },
  ],
};

const GREETINGS: Record<string, string> = {
  '/': " Hey! Paste a URL to run an audit, or try: 'track [URL] as competitor', 'test citations for [query]', 'scan mentions for [brand]', 'fetch robots.txt for [URL]'. What would you like to do?",
  '/app': " Hey! Paste a URL to run an audit, or try: 'track [URL] as competitor', 'test citations for [query]', 'scan mentions for [brand]', 'fetch robots.txt for [URL]'. What would you like to do?",
  '/app/analytics': " Looking at your trends? I can explain what the charts mean or help you spot patterns.",
  '/app/competitors': " Tracking competitors? I can help you add one — just say 'track example.com as competitor'.",
  '/app/citations': " Citation tracking lets you see if AI platforms mention your site. Try 'test citations for [your brand]'!",
  '/app/reverse-engineer': " The reverse engineer tools let you decode AI answers. Want a walkthrough?",
  '/pricing': " Comparing plans? I can break down exactly what each tier gives you.",
  '/app/reports': " Need help with reports or exports? I'm here.",
  '/guide': " Reading the guide? I can clarify any step in detail.",
  '/faq': " Can't find your answer in the FAQ? Ask me directly!",
  '/help': " Welcome to the Help Center! I can answer questions or open a support ticket for you.",
  '/app/settings': " Need help with settings? I can walk you through any option.",
  '/app/billing': " Have billing questions? I can explain plans, credits, and upgrades.",
  '/app/score-fix': " ScoreFix generates automated GitHub PRs to fix your AI visibility issues. Need details?",
  '/app/notifications': " Here you can see all your notifications. Ask me to check a ticket status anytime!",
};

const DEFAULT_GREETING =
  " Hi! I'm BIX — your AiVIS platform agent. Send me a URL to audit, ask any platform question, open a support ticket, or tell me what to do!";

export function getGreeting(path: string): string {
  return GREETINGS[path] || GREETINGS[path.replace(/^\/app/, '')] || DEFAULT_GREETING;
}
