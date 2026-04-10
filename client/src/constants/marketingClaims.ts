import { BRAG_ACRONYM, BRAG_EXPANSION } from '@shared/types';

export const CANONICAL_MODELS = {
  observerPrimary: 'Gemma 4 31B',
  observerFallback: 'Gemma 4 26B MoE',
  alignmentPrimary: 'GPT-5 Nano',
  signalPrimary: 'GPT-5 Mini',
  signalCritique: 'Claude Sonnet 4.6',
  signalValidation: 'Grok 4.1 Fast',
} as const;

export const MARKETING_CLAIMS = {
  methodology:
    `${BRAG_ACRONYM} (${BRAG_EXPANSION}): findings are grounded in scraped evidence IDs and validated outputs.`,
  modelAllocation:
    `Observer uses free-model routing with a 6-model fallback chain (${CANONICAL_MODELS.observerPrimary} primary, ${CANONICAL_MODELS.observerFallback}, Nemotron 3 Super 120B, MiniMax M2.5, Nemotron 3 Nano 30B, GPT-OSS 120B). Alignment uses ${CANONICAL_MODELS.alignmentPrimary} primary with fallback routing. Signal and Score Fix run a triple-check pipeline: ${CANONICAL_MODELS.signalPrimary} → ${CANONICAL_MODELS.signalCritique} critique → ${CANONICAL_MODELS.signalValidation} validation.`,
  modelTruthUrl: '/methodology',
  compareRole:
    'Compare is a positioning snapshot for category fit, not an independent benchmark publication.',
  homeRole:
    'Home focuses on outcome + proof preview + clear next action.',
  methodologyRole:
    'Methodology is the canonical source for model allocation and audit method claims.',
  observerPublicShare:
    'Observer public links are view-only snapshots with redacted implementation details.',
} as const;
