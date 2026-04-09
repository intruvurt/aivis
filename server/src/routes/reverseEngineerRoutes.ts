import { callAIProvider, PROVIDERS } from '../services/aiProviders.js';
import type {
  AnswerDecomposition,
  CompetitorGhost,
  ModelPreferenceDiff,
  VisibilitySimulation,
  ModelAnalysis,
} from '../../../shared/types.js';

/** Hard deadline for any single reverse-engineer operation (ms) */
const RE_DEADLINE_MS = 30_000;

/** Maximum characters allowed for user-supplied prompt inputs */
const MAX_USER_INPUT_CHARS = 10_000;

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '';

/**
 * Sanitize and delimit user content for safe prompt inclusion.
 * Truncates to max length and wraps in XML-style delimiters so
 * the model can distinguish instructions from user data.
 */
function sanitizeUserInput(input: string, maxLen = MAX_USER_INPUT_CHARS): string {
  const trimmed = input.slice(0, maxLen);
  return `<user_content>\n${trimmed}\n</user_content>`;
}

/** Race a promise against a hard deadline */
function withDeadline<T>(promise: Promise<T>, label: string, ms = RE_DEADLINE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Answer Decompiler - Reverse engineers an AI answer into structural patterns
 */
export async function decompileAnswer(aiAnswer: string): Promise<AnswerDecomposition> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('AI provider key not configured');

  const prompt = `You are a reverse-engineering specialist who deconstructs AI-generated answers to understand what content structures the model preferred.

Analyze this AI-generated answer and decompose it into its structural DNA:

${sanitizeUserInput(aiAnswer)}

Return a JSON object with:
{
  "sourceTypes": [
    {
      "type": "authoritative_reference|how_to_guide|faq_block|definition|comparison|list_aggregation|news_synthesis|academic_citation",
      "confidence": 0.0-1.0,
      "indicators": ["specific phrases or patterns that suggest this source type"],
      "examplePatterns": ["what content shaped like this would look like"]
    }
  ],
  "structuralPatterns": [
    {
      "pattern": "numbered_list|bullet_hierarchy|qa_pair|step_sequence|comparison_table|definition_block|citation_cluster",
      "frequency": number,
      "positionBias": "opening|middle|closing|distributed",
      "weight": 0.0-1.0
    }
  ],
  "semanticClusters": [
    {
      "topic": "main topic",
      "entities": ["key entities mentioned"],
      "relationships": ["entity1 -> relationship -> entity2"],
      "density": 0.0-1.0,
      "answerContribution": 0.0-1.0
    }
  ],
  "citationVectors": [
    {
      "contentType": "what type of content would be cited here",
      "probability": 0.0-1.0,
      "requiredSignals": ["trust signals needed"],
      "missingFromYourContent": []
    }
  ],
  "answerShape": {
    "skeleton": "markdown template showing the ideal structure",
    "entityDensity": 0.0-1.0,
    "factDensity": 0.0-1.0,
    "listRatio": 0.0-1.0,
    "averageSentenceComplexity": 1-10,
    "trustSignalPlacement": ["where trust signals appeared"]
  },
  "reconstructionBlueprint": "A plain-language description of what kind of page would generate this answer"
}

Be precise. Show the SHAPES, not the sources. What structural patterns is the model rewarding?`;

  const response = await withDeadline(
    callAIProvider({
      provider: 'openrouter',
      model: PROVIDERS[0].model, // Primary paid model
      prompt,
      apiKey,
      opts: { max_tokens: 2500, temperature: 0.2 },
    }),
    'Answer Decompiler',
  );

  return parseJsonResponse<AnswerDecomposition>(response);
}

/**
 * Synthetic Competitor Ghost - Generates the ideal AI-optimized page blueprint
 */
export async function generateCompetitorGhost(query: string): Promise<CompetitorGhost> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('AI provider key not configured');

  const prompt = `You are a new age SEO search Master AI visibility architect. Your job is to design the IDEAL Next-Level page that would dominate AI answers for a given query.

Query: ${sanitizeUserInput(query, 2000)}

Think like the Top AI models that will consume this content. What structure, entities, and signals, schema, wording and intent would make content irresistible to cite?

Return a JSON object:
{
  "query": "${query}",
  "idealBlueprint": {
    "title": "SEO + AI optimized title",
    "metaDescription": "description optimized for extraction",
    "h1": "primary heading",
    "sectionHierarchy": [
      {
        "heading": "section heading",
        "level": 1-4,
        "purpose": "definition|explanation|example|comparison|faq|cta",
        "contentGuidance": "what to write here",
        "requiredEntities": ["entities to mention"],
        "targetWordCount": number,
        "children": []
      }
    ],
    "openingParagraph": "ideal opening that gets extracted",
    "closingCTA": "action-oriented close",
    "wordCountTarget": { "min": number, "max": number, "optimal": number }
  },
  "entityGraph": [
    {
      "entity": "name",
      "type": "person|organization|concept|product|location|event",
      "importance": 0.0-1.0,
      "relationships": [{ "target": "other entity", "relationship": "relates how" }],
      "mentionFrequency": number
    }
  ],
  "answerDensityMap": [
    {
      "subtopic": "specific subtopic",
      "requiredCoverage": 0.0-1.0,
      "priority": "critical|important|nice_to_have"
    }
  ],
  "trustSignals": [
    {
      "signal": "author_bio|publish_date|last_updated|citations|credentials|methodology|data_source",
      "placement": "header|inline|footer|schema",
      "impact": 0.0-1.0
    }
  ],
  "contentBands": [
    {
      "section": "section name",
      "minWords": number,
      "maxWords": number,
      "optimalWords": number,
      "reasoning": "why this length"
    }
  ],
  "schemaRecommendations": [
    {
      "schemaType": "Article|FAQPage|HowTo|etc",
      "priority": "required|recommended|optional",
      "properties": { "property": "value guidance" },
      "inclusionImpact": 0.0-1.0
    }
  ],
  "internalLinkPattern": {
    "internalLinks": [{ "anchor": "text", "targetType": "what page", "placement": "where" }],
    "externalAuthority": [{ "domain": "type of site", "purpose": "why link" }],
    "hubStructure": "pillar_cluster|silo|flat|hierarchical"
  },
  "estimatedInclusionProbability": 0.0-1.0
}

Be detailed specific. This is a BUILD SPEC, not advice.`;

  const response = await withDeadline(
    callAIProvider({
      provider: 'openrouter',
      model: PROVIDERS[0].model,
      prompt,
      apiKey,
      opts: { max_tokens: 2000, temperature: 0.3 },
    }),
    'Content Blueprint',
  );

  return parseJsonResponse<CompetitorGhost>(response);
}

/**
 * Model Preference Diff - Compares how different models would answer
 */
export async function analyzeModelPreferences(
  query: string,
  userContentSummary?: string
): Promise<ModelPreferenceDiff> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('AI provider key not configured');

  // Run the same query through 2 models in parallel (lean for Render free tier)
  const models = PROVIDERS.slice(0, 2); // Top two paid models

  const modelPromises = models.map(async (provider) => {
    const analysisPrompt = `Answer this question, then analyze your own answer:
    
Question: ${sanitizeUserInput(query, 2000)}

After triple-checking and answering, provide complete meta-analysis in JSON:
{
  "answer": "your answer",
  "selfAnalysis": {
    "emphasis": ["what you emphasized"],
    "ignored": ["what you didn't cover"],
    "sourceBias": ["types of sources you'd prefer"],
    "structuralPreference": ["structures you used"],
    "answerStyle": "concise|detailed|balanced",
    "citationBehavior": "heavy|moderate|light|none"
  }
}`;

    try {
      const response = await callAIProvider({
        provider: provider.provider,
        model: provider.model,
        prompt: analysisPrompt,
        apiKey,
        opts: { max_tokens: 1500, temperature: 0.3 },
      });
      return { model: provider.label, response };
    } catch (e: any) {
      return { model: provider.label, response: null, error: e.message };
    }
  });

  const results = await Promise.all(modelPromises);

  // Now synthesize the comparison
  const synthesisPrompt = `You are analyzing how different AI models respond to the same query.

Query: ${sanitizeUserInput(query, 2000)}
${userContentSummary ? `User's content summary: ${sanitizeUserInput(userContentSummary, 5000)}` : ''}

Model responses:
${results.map((r) => `### ${r.model}\n${r.response || 'Failed: ' + r.error}`).join('\n\n')}

Synthesize a comparison JSON:
{
  "query": "${query}",
  "modelAnalyses": [
    {
      "model": "model name",
      "emphasis": ["what this model emphasized"],
      "ignored": ["what it ignored"],
      "sourceBias": ["source types it prefers"],
      "structuralPreference": ["structural patterns"],
      "answerStyle": "concise|detailed|balanced",
      "citationBehavior": "heavy|moderate|light|none"
    }
  ],
  "alignmentMatrix": [
    {
      "model": "model name",
      "yourContentScore": 0-100,
      "gaps": ["what's missing for this model"],
      "strengths": ["what aligns well"],
      "invisibilityReasons": ["why you might not appear"]
    }
  ],
  "recommendations": [
    {
      "model": "model name",
      "action": "specific action to take",
      "impact": 0.0-1.0,
      "effort": "low|medium|high"
    }
  ],
  "visualizationData": {
    "radarData": [{ "model": "name", "dimensions": { "factuality": 0-1, "structure": 0-1, "depth": 0-1, "citations": 0-1, "recency": 0-1 }}],
    "heatmapData": [{ "model": "name", "factor": "factor name", "score": 0-1 }],
    "gapChart": [{ "factor": "name", "models": { "gpt": 0.8, "claude": 0.6 }}]
  }
}`;

  const synthesis = await withDeadline(
    callAIProvider({
      provider: 'openrouter',
      model: PROVIDERS[0].model,
      prompt: synthesisPrompt,
      apiKey,
      opts: { max_tokens: 2000, temperature: 0.2 },
    }),
    'Model Diff synthesis',
  );

  return parseJsonResponse<ModelPreferenceDiff>(synthesis);
}

/**
 * Visibility Simulator - Simulates probability changes from content modifications
 */
export async function simulateVisibility(
  url: string,
  scrapedContent: any,
  targetQuery?: string
): Promise<VisibilitySimulation> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('AI provider key not configured');

  const prompt = `You are a visibility probability engine. Analyze this content and simulate how structural changes would affect AI inclusion probability.

URL: ${sanitizeUserInput(url, 2048)}
${targetQuery ? `Target Query: ${sanitizeUserInput(targetQuery, 2000)}` : ''}

Current Content Analysis:
${sanitizeUserInput(JSON.stringify(scrapedContent, null, 2), MAX_USER_INPUT_CHARS)}

Calculate current inclusion probability and simulate 5 specific changes that would increase it.

Return JSON:
{
  "url": "${url}",
  "currentProbability": 0.0-1.0,
  "simulatedChanges": [
    {
      "element": "specific element (e.g., 'H1 tag', 'FAQ schema', 'author bio')",
      "currentState": "what it is now",
      "proposedState": "what it should become",
      "probabilityDelta": 0.0-0.3,
      "effort": "trivial|low|medium|high",
      "dependencies": ["what else needs to change"]
    }
  ],
  "projectedProbability": 0.0-1.0,
  "confidenceInterval": { "low": 0.0-1.0, "high": 0.0-1.0 },
  "modelBreakdown": [
    { "model": "GPT-4", "before": 0.0-1.0, "after": 0.0-1.0 },
    { "model": "Claude", "before": 0.0-1.0, "after": 0.0-1.0 },
    { "model": "Perplexity", "before": 0.0-1.0, "after": 0.0-1.0 },
    { "model": "Gemini", "before": 0.0-1.0, "after": 0.0-1.0 }
  ],
  "implementationPlan": [
    {
      "order": 1,
      "action": "specific action",
      "element": "what to change",
      "cumulativeProbability": 0.0-1.0,
      "timeEstimate": "e.g., '30 minutes'",
      "technicalRequirements": ["what's needed"]
    }
  ]
}

Be specific, precise and actionable with valuable tips. Show the DELTA, not just the goal. Show the good not just the bad.`;

  const response = await withDeadline(
    callAIProvider({
      provider: 'openrouter',
      model: PROVIDERS[0].model,
      prompt,
      apiKey,
      opts: { max_tokens: 2000, temperature: 0.2 },
    }),
    'Visibility Simulator',
  );

  return parseJsonResponse<VisibilitySimulation>(response);
}

/**
 * Helper to parse JSON from AI responses (handles markdown code blocks)
 */
function parseJsonResponse<T>(response: string): T {
  // Strip markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e: any) {
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
  }
}

/**
 * Brand Voice Rewrite - rewrites a content excerpt to match a selected AI citation pattern.
 *
 * voicePreset: "authoritative" | "conversational" | "data_driven" | "how_to" | "faq"
 * content: existing content to rewrite (max 4000 chars)
 * targetQuery: optional - the user query this content should rank for
 */
export async function rewriteContentVoice(
  content: string,
  voicePreset: string,
  targetQuery?: string,
): Promise<{ rewritten: string; changes: string[]; preset: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('AI provider key not configured');

  const voiceGuide: Record<string, string> = {
    authoritative: 'Write with confidence and authority. Use clear declarative statements, cite specific facts and numbers, eliminate hedging language ("might", "could", "perhaps"). Structure with clear H2/H3 hierarchy. Lead with the most definitive claim.',
    conversational: 'Write in a natural, approachable voice. Use short sentences. Address the reader directly with "you" and "your". Break complex ideas into digestible parts. Use rhetorical questions to transition between ideas.',
    data_driven: 'Ground every claim in a specific number, statistic, or measurable outcome. Add percentage improvements, time savings, or concrete benchmarks. Where data is implied, make it explicit. Format key metrics prominently.',
    how_to: 'Restructure as a sequential process. Number each step. Start each step with a verb. Include what the user will see/have after completing each step. Add a brief "Why this matters" after each key step.',
    faq: 'Restructure as question-and-answer pairs. Each question should be phrased exactly as a user would type it into a search engine. Each answer should be 2-3 sentences maximum and answerable in isolation.',
  };

  const guide = voiceGuide[voicePreset] || voiceGuide['authoritative'];

  const prompt = `You are an AI citation specialist. Rewrite the provided content to maximize its probability of being cited in AI-generated answers.

Voice preset: ${voicePreset}
${guide}

${targetQuery ? `Target query this content should rank for: "${sanitizeUserInput(targetQuery, 300)}"` : ''}

Content to rewrite:
${sanitizeUserInput(content, 4000)}

Return a JSON object (no markdown):
{
  "rewritten": "The full rewritten content block",
  "changes": ["Brief description of change 1", "Brief description of change 2", "...up to 5 changes"]
}

Rules:
- Preserve all factual claims from the original - do not invent data
- Improve structure and voice, not the accuracy of claims
- rewritten should be the complete rewrite, ready to paste into a CMS
- changes should be 3-5 bullet points explaining what was changed and why it improves AI citability`;

  const raw = await withDeadline(
    callAIProvider({
      provider: PROVIDERS[0].provider,
      model: PROVIDERS[0].model,
      prompt,
      apiKey,
      opts: { max_tokens: 3000 },
    }),
    'Content Voice Rewrite',
  );

  const parsed = parseJsonResponse<{ rewritten: string; changes: string[] }>(raw);
  return {
    rewritten: parsed.rewritten || raw,
    changes: Array.isArray(parsed.changes) ? parsed.changes.slice(0, 5) : [],
    preset: voicePreset,
  };
}
