// client/src/constants/guideBotConfig.ts
// Page-aware suggestions & greetings for the GuideBot assistant

export const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/': [
    'Run an audit on my site',
    'What does my score mean?',
    'Show my milestones & credits',
    'Fetch robots.txt for my site',
  ],
  '/analytics': [
    'How do I read the trends?',
    'Why did my score change?',
    'What affects my score most?',
  ],
  '/competitors': [
    'How does competitor tracking work?',
    'How many competitors can I track?',
    'What should I compare?',
  ],
  '/citations': [
    'What is citation tracking?',
    'Which AI platforms do you check?',
    'How do I improve citations?',
  ],
  '/reverse-engineer': [
    'What are the reverse engineer tools?',
    'What does Decompile do?',
    'How does Ghost mode work?',
  ],
  '/pricing': [
    'Compare the tiers for me',
    'What does Signal add?',
    'Can I cancel anytime?',
  ],
  '/reports': [
    'How do I export a report?',
    'Can I share my report?',
    'What format is the export?',
  ],
  '/faq': [
    'What is AI visibility?',
    'How is this different from SEO?',
    'Is my data safe?',
  ],
  '/guide': [
    'Walk me through the audit steps',
    'What are the 6 scoring categories?',
    'What is the triple-check pipeline?',
  ],
  '/help': [
    'Walk me through the audit steps',
    'What are the scoring categories?',
    'What plan should I choose?',
  ],
};

export const DEFAULT_SUGGESTIONS = [
  'What is AiVIS?',
  'How does the audit work?',
  'Show me live pricing and tier differences',
  'Read results from this share URL',
  'Audit files for my site',
];

const GREETINGS: Record<string, string> = {
  '/': " Hey! Paste a URL to run an audit, or try: 'track [URL] as competitor', 'test citations for [query]', 'scan mentions for [brand]', 'fetch robots.txt for [URL]'. What would you like to do?",
  '/analytics': " Looking at your trends? I can explain what the charts mean.",
  '/competitors': " Tracking competitors? I can help you get the most out of comparisons.",
  '/citations': " Citation tracking lets you see if AI platforms mention your site. Ask me anything!",
  '/reverse-engineer': " The reverse engineer tools let you decode AI answers. Want a walkthrough?",
  '/pricing': " Comparing plans? I can break down exactly what each tier gives you.",
  '/reports': " Need help with reports or exports? I'm here.",
  '/guide': " Reading the guide? I can clarify any step in detail.",
  '/faq': " Can't find your answer in the FAQ? Ask me directly!",
  '/help': " Welcome to the Help Center! I can answer questions in real time.",
};

const DEFAULT_GREETING =
  " Hi! I'm AiVIS Guide. Send me a URL to audit, or tell me what you need - audit, track a competitor, test citations, scan mentions, fetch robots.txt/llms.txt/sitemap.xml, or just ask a question!";

export function getGreeting(path: string): string {
  return GREETINGS[path] || DEFAULT_GREETING;
}
