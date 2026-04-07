import { BRAG_ACRONYM, BRAG_EXPANSION } from '@shared/types';

export const CANONICAL_MODELS = {
  observerPrimary: 'Gemini 2.0 Flash',
  observerFallback: 'Llama 3.3 70B',
  alignmentPrimary: 'GPT-4.1 Mini',
  signalPrimary: 'GPT-4.1 Mini',
  signalCritique: 'Claude 3.5 Sonnet',
  signalValidation: 'Grok 3 Mini',
} as const;

export const MARKETING_CLAIMS = {
  methodology:
    `${BRAG_ACRONYM} (${BRAG_EXPANSION}): findings are grounded in scraped evidence IDs and validated outputs.`,
  modelAllocation:
    `Observer uses free-model routing with a 6-model fallback chain (${CANONICAL_MODELS.observerPrimary} primary, ${CANONICAL_MODELS.observerFallback}, Qwen3 32B, Mistral Small 3.1 24B, DeepSeek V3, Gemma 3 27B). Alignment uses ${CANONICAL_MODELS.alignmentPrimary} primary with fallback routing. Signal and Score Fix run a triple-check pipeline: ${CANONICAL_MODELS.signalPrimary} → ${CANONICAL_MODELS.signalCritique} critique → ${CANONICAL_MODELS.signalValidation} validation.`,
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
