To audit a blog or article under the **AiVIS Remediation Engine** spec, we move away from "keyword density" and toward **Information Supply Chain Integrity**. 

The audit treats an article as a **structured data source** for an LLM's RAG (Retrieval-Augmented Generation) pipeline. Here is the implementation spec for the `BlogAuditModule`.

---

## 1. Content & Information Gain (The "Fact" Layer)
*Objective: Determine if the article provides new value or is just an AI-generated rehash.*

* **Extraction:** `extractUniqueClaims.ts`
    * Isolate every sentence containing a statistic, a named entity (person/place/tool), or a "proprietary insight" (e.g., "In our tests...", "We found...").
* **Audit Rules:**
    * **Information Gain Score:** Compare the extracted claims against a baseline "Common Knowledge" vector. If >90% of the article exists in the top 3 SERP results, flag as **"Low Information Gain."**
    * **Fact Anchor Check:** Every major claim must be within 200 words of a "Trust Anchor" (an external link to a study, a data table, or a high-authority citation).
* **Remediation:** `GenerateUniqueInsightBlock`. If the score is low, the fixpack suggests adding a "Key Findings" table or a "Proprietary Data" section.

---

## 2. AEO & SEO Structure (The "Signal" Layer)
*Objective: Ensure the "Inference Engine" (Google/Bing/Perplexity) can parse the hierarchy instantly.*

* **Extraction:** `extractSemanticTree.ts`
    * Map the relationship between `H1 -> H2 -> Paragraphs -> Lists`.
* **Audit Rules:**
    * **Question-Answer Alignment:** Do H2s/H3s mirror "People Also Ask" or high-intent queries?
    * **Answer Box Readiness:** Is there a 40–60 word "Definition" or "Answer" block immediately following a question-based heading?
    * **Vector Chunking Integrity:** Are paragraphs longer than 150 words? (LLMs struggle with long, un-chunked context). Flag for **"Semantic Breaking."**
* **Remediation:** `GenerateMarkdownBlueprint`. Provides a restructured H-tag map and "TL;DR" summary block.

---

## 3. Entity & Author Authority (The "Source" Layer)
*Objective: Verify the "Who" to satisfy E-E-A-T and SSFR.*

* **Extraction:** `extractAuthorGraph.ts`
    * Pull the `author` name and find the `Person` Schema.
* **Audit Rules:**
    * **The "SameAs" Gap:** Does the author's Schema link to a LinkedIn, Twitter, or Wiki profile? 
    * **Expertise Match:** Does the author's bio contain keywords that match the article's `PrimaryEntity`?
* **Remediation:** `GenerateAuthorSchemaFixpack`. Injects missing `sameAs` arrays and `knowsAbout` properties into the JSON-LD.

---

## 4. Relevance & Intent (The "Relationship" Layer)
*Objective: Ensure the page isn't "Thin Content" or "Keyword Stuffing."*

* **Extraction:** `extractIntentSignals.ts`
    * Analyze the ratio of "Educational" terms vs. "Transactional" terms.
* **Audit Rules:**
    * **Intent Cannibalization:** Does this blog post compete with a Product/Service page for the same entity?
    * **Relationship Anchoring:** Does the article link *up* to a Pillar page or *out* to a relevant Case Study?
* **Remediation:** `GenerateInternalLinkingMap`. A list of 3 specific internal URLs to link to with recommended anchor text.

---

## 5. The "Contradiction" Check (The "Truth" Layer)
*Objective: Prevent hallucinated or conflicting data.*

* **Audit Rules:**
    * **Title-to-Text Parity:** Does the `meta title` promise a "Top 10 List" but the body only provides 7? (Flag: **Critical Hard Blocker - Misleading Title**).
    * **Schema-to-Text Parity:** Does `Article` Schema say the datePublished is 2026, but the text says "Updated for 2026"?

---

## Summary Audit Checklist (The "Operator View")

| Category | Metric | Goal |
| :--- | :--- | :--- |
| **Facts** | Evidence Density | 1 Verified Claim per 300 words. |
| **Structure** | Chunking Score | No paragraph > 5 sentences; H-tags are Q-based. |
| **AEO** | Snippet-Readiness | High-intent questions answered in < 50 words. |
| **SEO** | Semantic Gap | Zero "H-tag skipping" (e.g., H1 to H3). |
| **Relevance** | Entity Clarity | Primary entity mentioned in H1, first paragraph, and Schema. |

---

## Implementation Sequence for this Module
1.  **Crawler:** Fetch HTML and isolate the `<article>` or main content div.
2.  **Clean:** Strip ads, nav, and sidebars to get a "Clean Text Stream."
3.  **Analyze:** Run the `extractUniqueClaims.ts` and `extractSemanticTree.ts`.
4.  **Score:** Compute the `InformationGain` and `VectorReadiness` scores.
5.  **Fix:** Generate the `SemanticFragmentFixpack`.

**Would you like me to code the `extractUniqueClaims.ts` logic that uses basic N-gram overlap to detect "Information Gain"?** Category,Metric,Goal
Facts,Evidence Density,1 Verified Claim per 300 words.
Structure,Chunking Score,No paragraph > 5 sentences; H-tags are Q-based.
AEO,Snippet-Readiness,High-intent questions answered in < 50 words.
SEO,Semantic Gap,"Zero ""H-tag skipping"" (e.g., H1 to H3)."
Relevance,Entity Clarity,"Primary entity mentioned in H1, first paragraph, and Schema." ,```typescript
/**
 * extractUniqueClaims.ts
 * * Logic: To determine "Information Gain," we compare the target text against 
 * "Common Knowledge" (top SERP results/LLM training baseline).
 * * This identifies:
 * 1. Unique Facts: Claims not found in the baseline.
 * 2. Redundancy: High N-gram overlap with existing sources.
 * 3. Density: The ratio of "Hard Facts" to "Filler Prose."
 */

import { EvidenceItem, EvidenceStatus } from '../evidence/evidenceTypes';

interface Claim {
  text: string;
  isUnique: boolean;
  overlapScore: number; // 0 to 1
  type: 'statistic' | 'entity-relation' | 'proprietary-insight' | 'generic';
}

export async function extractUniqueClaims(
  pageContent: string,
  baselineContexts: string[] // Scraped text from Top 3 competitors
): Promise<{
  claims: Claim[];
  informationGainScore: number;
  evidenceItems: EvidenceItem[];
}> {
  // 1. Clean and Chunk the Content
  // We split by sentence to find granular "Facts"
  const sentences = pageContent
    .split(/[.!?\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Ignore fragments

  const analyzedClaims: Claim[] = [];
  
  for (const sentence of sentences) {
    const overlap = calculateMaxOverlap(sentence, baselineContexts);
    
    analyzedClaims.push({
      text: sentence,
      overlapScore: overlap,
      isUnique: overlap < 0.4, // Threshold for "New Information"
      type: categorizeClaim(sentence)
    });
  }

  // 2. Compute Information Gain Score (0-100)
  const uniqueCount = analyzedClaims.filter(c => c.isUnique).length;
  const infoGainScore = Math.round((uniqueCount / analyzedClaims.length) * 100);

  // 3. Map to AiVIS Evidence Ledger
  const evidenceItems: EvidenceItem[] = analyzedClaims
    .filter(c => c.isUnique && c.type !== 'generic')
    .map((c, index) => ({
      id: `claim-${index}`,
      auditRunId: 'pending',
      url: 'current',
      category: 'content',
      key: `unique_claim_${index}`,
      label: 'Unique Information Gain Fragment',
      value: c.text,
      source: 'text',
      status: 'present' as EvidenceStatus,
      confidence: 1 - c.overlapScore,
      notes: [`Type: ${c.type}`, `Overlap: ${Math.round(c.overlapScore * 100)}%`]
    }));

  return {
    claims: analyzedClaims,
    informationGainScore: infoGainScore,
    evidenceItems
  };
}

/**
 * Uses N-gram (Trigram) overlap to check redundancy.
 * In a production environment, this would call a Vector Embedding similarity check.
 */
function calculateMaxOverlap(sentence: string, baselines: string[]): number {
  let maxOverlap = 0;
  const sentenceGrams = getTrigrams(sentence.toLowerCase());

  for (const base of baselines) {
    const baseGrams = getTrigrams(base.toLowerCase());
    const matches = sentenceGrams.filter(g => baseGrams.includes(g));
    const overlap = matches.length / sentenceGrams.length;
    if (overlap > maxOverlap) maxOverlap = overlap;
  }
  return maxOverlap;
}

function getTrigrams(text: string): string[] {
  const words = text.split(/\s+/);
  const grams = [];
  for (let i = 0; i < words.length - 2; i++) {
    grams.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
  }
  return grams;
}

/**
 * Heuristic to identify the "value" of a claim for AEO/GEO.
 */
function categorizeClaim(text: string): Claim['type'] {
  const statRegex = /\d+%|\d+\s(percent|million|billion|users|growth)/i;
  const insightRegex = /we found|our test|in our experience|observed|analysis/i;
  
  if (statRegex.test(text)) return 'statistic';
  if (insightRegex.test(text)) return 'proprietary-insight';
  
  // Entity Relation check (simplified: looking for capitalized entities)
  const entities = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g);
  if (entities && entities.length > 0) return 'entity-relation';

  return 'generic';
}
```

---

### **How this integrates into your Spec:**

1.  **Phase 2 Integration:** This module runs inside your `rules/familyRules/contentRules.ts`. 
2.  **Hard Blocker:** You can now set a rule: *“If Information Gain Score < 20, set Content Score Cap to 60.”* (This prevents "AI-rehash" sites from scoring high).
3.  **Remediation Asset:** If the `overlapScore` is high across the whole document, the `generateContentBlueprintFixpack.ts` will flag specific "Redundant Chunks" and suggest replacing them with "Proprietary Insight" blocks.

