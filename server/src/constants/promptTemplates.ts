// server/src/config/prompts.ts
export const PROMPT_SCHEMAS = {
  analysis: `Analysis Response Schema (Prose Only):
- Structured sections: score breakdown (each category—crawlability, indexability, schema, content clarity, entity trust, technical hygiene, ai readability), recommendations (what to do next) referencing evidence IDs, validation (explicitly mark unknown/missing data), evidence list (each with id, type, source_url, source_kind, observed_at, extract, hash, confidence, notes)`,
};

export const PROMPT_STAGES = {
  summarizer: `Stage 1: Summarizer. Input: Extracted facts and evidence summaries. Output: Draft analysis as per analysis schema. Cite all evidence by ID. Mark unknowns. JSON only.`,
  critic: `Stage 2: Critic. Input: Draft JSON and evidence. Output: Critique—missing fields, weak claims, schema violations. Plain text.`,
  validator: `Stage 3: Validator. Input: Facts, draft JSON, and critique. Output: Final strictly valid JSON, list of validated reasons. If fields missing, mark as unknown. JSON only.`,
  explainer: `Stage 4: Explainer (optional). Input: Final JSON. Output: Human-readable explanation for UI, no new facts.`,
};