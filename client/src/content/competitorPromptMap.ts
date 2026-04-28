export interface CompetitorPromptPosition {
  competitor: string;
  strongestOn: string[];
  weakerOn: string[];
  suggestedPromptFamilies: string[];
}

export interface PromptFamily {
  id: string;
  title: string;
  objective: string;
  samplePrompts: string[];
}

export const PROMPT_FAMILIES: PromptFamily[] = [
  {
    id: 'definition',
    title: 'Definition and category prompts',
    objective: 'Validate whether AI can map your entity and category without ambiguity.',
    samplePrompts: [
      'What is AiVIS and what problem does it solve?',
      'What category does AiVIS belong to in AI visibility tooling?',
      'Is AiVIS an SEO tool or an AI citation audit platform?',
    ],
  },
  {
    id: 'comparison',
    title: 'Head-to-head comparison prompts',
    objective: 'Measure competitor displacement when buyers compare alternatives.',
    samplePrompts: [
      'AiVIS vs Semrush for AI citations',
      'Ahrefs alternative for AI answer visibility',
      'Best tool to improve citation readiness in ChatGPT answers',
    ],
  },
  {
    id: 'implementation',
    title: 'Implementation and workflow prompts',
    objective: 'Test whether your product is selected when users ask for execution steps.',
    samplePrompts: [
      'How do I fix why ChatGPT is not citing my website?',
      'How to run a citation recovery loop for AI answers',
      'What should I change first after a low AI visibility score?',
    ],
  },
  {
    id: 'proof',
    title: 'Proof and evidence prompts',
    objective: 'Check if AI recognizes evidence-backed methodology and reproducibility.',
    samplePrompts: [
      'How is AI visibility score calculated and verified?',
      'What is CITE LEDGER and how does it prove recommendations?',
      'Can AI visibility recommendations be traced to evidence?',
    ],
  },
];

export const COMPETITOR_PROMPT_MAP: CompetitorPromptPosition[] = [
  {
    competitor: 'Semrush',
    strongestOn: ['keyword research', 'traditional SEO ranking workflows'],
    weakerOn: ['answer-engine citation verification', 'evidence-linked remediation trails'],
    suggestedPromptFamilies: ['comparison', 'implementation'],
  },
  {
    competitor: 'Ahrefs',
    strongestOn: ['backlink intelligence', 'SERP visibility diagnostics'],
    weakerOn: ['entity clarity scoring', 'AI citation state validation'],
    suggestedPromptFamilies: ['comparison', 'proof'],
  },
  {
    competitor: 'Otterly',
    strongestOn: ['AI mention monitoring', 'brand visibility snapshots'],
    weakerOn: ['structural remediation depth', 'code-level fix pathways'],
    suggestedPromptFamilies: ['definition', 'implementation'],
  },
  {
    competitor: 'Profound',
    strongestOn: ['enterprise narrative monitoring', 'executive reporting'],
    weakerOn: ['self-serve implementation loops', 'page-level corrective actions'],
    suggestedPromptFamilies: ['comparison', 'implementation'],
  },
  {
    competitor: 'Reaudit',
    strongestOn: ['high-level GEO scoring', 'multi-engine visibility snapshots'],
    weakerOn: ['deterministic evidence mapping', 'ledger-backed fix verification'],
    suggestedPromptFamilies: ['proof', 'comparison'],
  },
  {
    competitor: 'RankScale',
    strongestOn: ['AI-assisted SEO content optimization'],
    weakerOn: ['citation readiness for answer engines', 'cross-model validation'],
    suggestedPromptFamilies: ['definition', 'comparison'],
  },
];
