import axios from 'axios';

// Uses env vars already loaded by server.ts (import 'dotenv/config')
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || '';

if (OPEN_ROUTER_API_KEY) {
  console.log('[AI Providers]  OpenRouter API key configured');
} else {
  console.warn(
    '[AI Providers]  OpenRouter API key not configured - OpenRouter features will be unavailable'
  );
}

if (DEEPSEEK_API_KEY) {
  console.log('[AI Providers]  DeepSeek native API key configured');
} else {
  console.log('[AI Providers]  DeepSeek native API key not configured (using OpenRouter fallback)');
}

if (OLLAMA_BASE_URL.trim()) {
  console.log('[AI Providers]  Ollama base URL configured:', OLLAMA_BASE_URL);
} else {
  console.log('[AI Providers]  Ollama base URL not configured');
}

// ── Tuned for production on Render starter plan ──
// CloudFlare proxy drops connections at ~100 s; Render/socket hard limit ~60 s.
// Pipeline budget breakdown (57 s ceiling, 3 s buffer to 60 s limit):
//   Scrape: up to 15 s
//   AI1 primary (GPT-4o Mini): up to 25 s  → 40 s elapsed
//   AI1 fallback chain:     up to 14 s  → 54 s elapsed
//   Response + buffer:       3 s
// Free-tier models (:free variants) are rate-limited and slower - the
// fallback floor is 8 s per model. The pipeline-level deadline in server.ts
// still enforces the 57 s ceiling so total elapsed never exceeds 60 s.
// Deadline timers are cleared after each Promise.race to prevent ghost
// responses from leaked timers interleaving with subsequent model calls.
// Retries are DISABLED: if OpenRouter doesn't respond in 30 s it won't
// respond on a second try. Fallback to faster model handled in server.ts.
const MAX_RETRIES = 0;
const TIMEOUT_MS = 30_000;

export const openrouterPrompt = async (
  promptTemplate: string | any,
  input: any,
  retryCount = 0,
  model = 'openai/gpt-4o-mini',
  maxTokens = 1500,
  systemPrompt?: string,
  temperature?: number,
  responseFormat: 'json_object' | 'text' = 'json_object',
): Promise<any> => {
  if (!OPEN_ROUTER_API_KEY) {
    throw new Error(
      'OpenRouter API key not configured. Please add OPEN_ROUTER_API_KEY to the root .env file or use Ollama instead.'
    );
  }

  try {
    const promptText =
      typeof promptTemplate === 'string'
        ? promptTemplate
        : promptTemplate;

    console.log(
      `[OpenRouter] Calling model: ${model}, max_tokens: ${maxTokens}, responseType: text, response_format: ${responseFormat}`
    );
    const requestBody: Record<string, unknown> = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt ||
            'You are an AI Visibility Intelligence Platform expert. Analyze websites and provide evidence-based insights. Output JSON only. Cite all evidence by ID. Mark unknowns explicitly. do this for real',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens,
      stream: false,
    };

    if (responseFormat === 'json_object') {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'HTTP-Referer': 'https://aivis.biz',
          'X-Title': 'AiVIS',
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_MS,
        // CRITICAL: Use 'text' so axios does NOT auto-parse the response as JSON.
        // With the default 'json', if the HTTP body is truncated mid-stream
        // (connection drop, timeout, large response), axios runs JSON.parse()
        // on the partial body and throws "Unexpected end of JSON input" -
        // which means our safeJsonParse/repairTruncatedJson never see the raw data.
        // By getting raw text, WE parse OpenRouter's JSON envelope ourselves,
        // and if that fails, we can still extract the AI content from the partial body.
        responseType: 'text',
      }
    );

    // Parse the OpenRouter response envelope ourselves (since responseType is 'text')
    let parsedResponse: any;
    try {
      parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (envelopeErr: any) {
      // OpenRouter response body was truncated mid-stream - try to extract content
      console.warn(`[OpenRouter] Response envelope truncated - attempting to extract AI content from partial body (${(response.data || '').length} chars)`);
      const rawBody = String(response.data || '');
      // Try to find the AI's content field in the partial response
      // OpenRouter format: {"choices":[{"message":{"content":"...AI OUTPUT HERE..."}}]}
      const contentMatch = rawBody.match(/"content"\s*:\s*"([\s\S]+)/);
      if (contentMatch) {
        // Extract everything after "content":" - this is the AI's raw output (may be truncated)
        let extracted = contentMatch[1];
        // The content is JSON-escaped inside the envelope, so unescape it
        // Remove trailing incomplete envelope: ..."},...]} etc
        // Find where the content string ends (unescaped quote)
        let result = '';
        let esc = false;
        for (let i = 0; i < extracted.length; i++) {
          const ch = extracted[i];
          if (esc) { result += ch; esc = false; continue; }
          if (ch === '\\') { esc = true; continue; } // skip the backslash, next char is literal
          if (ch === '"') break; // end of content string
          result += ch;
        }
        if (result.length > 50) {
          console.log(`[OpenRouter] Extracted ${result.length} chars of AI content from truncated envelope`);
          return result;
        }
      }
      throw new Error(`OpenRouter response truncated (${rawBody.length} chars received): ${envelopeErr.message}`);
    }

    console.log(`[OpenRouter] Response received: HTTP ${response.status} | data type=${typeof response.data} | data length=${String(response.data || '').length} | has choices=${!!parsedResponse?.choices} | finish_reason=${parsedResponse?.choices?.[0]?.finish_reason} | content length=${(parsedResponse?.choices?.[0]?.message?.content || '').length}`);

    // Check for OpenRouter-level errors in the parsed response
    if (parsedResponse.error) {
      const errMsg = typeof parsedResponse.error === 'string'
        ? parsedResponse.error
        : parsedResponse.error.message || JSON.stringify(parsedResponse.error);
      throw new Error(`OpenRouter error: ${errMsg}`);
    }

    const content = parsedResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[OpenRouter] No content in response:', JSON.stringify(parsedResponse).substring(0, 500));
      throw new Error('OpenRouter returned empty content - model may be unavailable');
    }

    const finishReason = parsedResponse.choices?.[0]?.finish_reason;
    if (finishReason === null) {
      // finish_reason=null means generation was interrupted before completion
      // (rate limit, server-side error, connection drop on OpenRouter's end).
      // The content is almost always a tiny fragment - throw so the caller
      // can try the next fallback model instead of returning garbage.
      console.warn(`[OpenRouter]  Model ${model} returned finish_reason=null - generation interrupted after ${content.length} chars. Throwing to trigger fallback.`);
      throw new Error(`Model generation interrupted (finish_reason=null): only ${content.length} chars returned. Model may be rate-limited or unavailable on OpenRouter.`);
    }
    if (finishReason === 'length') {
      console.warn(`[OpenRouter]  Model ${model} hit max_tokens (${maxTokens}) - output truncated. Consider increasing max_tokens.`);
    }

    // Strip markdown code fences (```json ... ```) and <think> blocks.
    // Return as STRING - let safeJsonParse() in server.ts handle parsing + truncation repair.
    // Previously this function tried JSON.parse() internally and returned objects, causing
    // callAIProvider to JSON.stringify() them, then safeJsonParse to re-parse - a triple-parse
    // that broke truncation repair because the raw output was already lost.
    let cleaned = content.trim();
    // Handle <think> blocks - reasoning models prepend chain-of-thought before JSON.
    // First try to strip a complete <think>...</think> block:
    cleaned = cleaned.replace(/^<think>[\s\S]*?<\/think>\s*/i, '');
    // If that didn't match (unclosed <think> - model spent all tokens on reasoning):
    if (/^<think>/i.test(cleaned)) {
      console.warn(`[OpenRouter] Unclosed <think> block detected (model spent all tokens on reasoning) - stripping to find JSON`);
      // Try to find JSON after the think block (some models mix thinking + JSON)
      const jsonStart = cleaned.search(/\{[\s\S]*"visibility_score"/);
      if (jsonStart >= 0) {
        cleaned = cleaned.substring(jsonStart);
      } else {
        // No JSON found at all - the model wasted all tokens on thinking
        cleaned = '';
      }
    }
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    cleaned = cleaned.trim();
    if (!cleaned) {
      throw new Error('Model returned only reasoning tokens (empty content after stripping <think> block). Try a non-reasoning model.');
    }
    console.log(`[OpenRouter] Returning cleaned content: length=${cleaned.length} | starts_with_brace=${cleaned.startsWith('{')} | first 200 chars: ${cleaned.substring(0, 200)}`);
    return cleaned;
  } catch (error: any) {
    // With responseType: 'text', error.response?.data is a raw string (not parsed)
    let rawMsg: string;
    if (error.response?.data) {
      try {
        const errBody = typeof error.response.data === 'string'
          ? JSON.parse(error.response.data)
          : error.response.data;
        rawMsg = errBody?.error?.message || errBody?.error || errBody?.message || error.message;
      } catch {
        rawMsg = typeof error.response.data === 'string'
          ? error.response.data.substring(0, 200)
          : error.message;
      }
    } else {
      rawMsg = error.message || 'Unknown error';
    }
    const msg = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
    const status = error.response?.status;
    console.error('[OpenRouter Error]', msg, '| Status:', status);

    if (status === 401) {
      throw new Error(
        'OpenRouter authentication failed (401). Your API key may be invalid or expired. Please verify OPEN_ROUTER_API_KEY in the root .env file.'
      );
    }

    if (status === 429) {
      throw new Error(
        'OpenRouter rate limit exceeded (429). Please wait before retrying or upgrade your plan.'
      );
    }

    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying OpenRouter (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return openrouterPrompt(promptTemplate, input, retryCount + 1, model);
    }

    throw new Error(msg);
  }
};

// ── DeepSeek native API (OpenAI-compatible) ──
// Bypasses OpenRouter for cheaper direct calls when DEEPSEEK_API_KEY is set.
// DeepSeek model names: 'deepseek-chat' (V3), 'deepseek-reasoner' (R1)
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

export const deepseekPrompt = async (
  promptTemplate: string | any,
  input: any,
  retryCount = 0,
  model = 'deepseek-chat',
  maxTokens = 1500,
  systemPrompt?: string,
  temperature?: number,
  responseFormat: 'json_object' | 'text' = 'json_object',
): Promise<any> => {
  if (!DEEPSEEK_API_KEY) {
    throw new Error(
      'DeepSeek API key not configured. Please add DEEPSEEK_API_KEY to environment variables.'
    );
  }

  try {
    const promptText = typeof promptTemplate === 'string' ? promptTemplate : promptTemplate;

    console.log(
      `[DeepSeek] Calling model: ${model}, max_tokens: ${maxTokens}, response_format: ${responseFormat}`
    );

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt ||
            'You are an AI Visibility Intelligence Platform expert. Analyze websites and provide evidence-based insights. Output JSON only. Cite all evidence by ID. Mark unknowns explicitly. do this for real',
        },
        { role: 'user', content: promptText },
      ],
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens,
      stream: false,
    };

    if (responseFormat === 'json_object') {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await axios.post(DEEPSEEK_ENDPOINT, requestBody, {
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT_MS,
      responseType: 'text',
    });

    let parsedResponse: any;
    try {
      parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (envelopeErr: any) {
      console.warn(`[DeepSeek] Response envelope truncated (${(response.data || '').length} chars)`);
      const rawBody = String(response.data || '');
      const contentMatch = rawBody.match(/"content"\s*:\s*"([\s\S]+)/);
      if (contentMatch) {
        let result = '';
        let esc = false;
        for (let i = 0; i < contentMatch[1].length; i++) {
          const ch = contentMatch[1][i];
          if (esc) { result += ch; esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') break;
          result += ch;
        }
        if (result.length > 50) {
          console.log(`[DeepSeek] Extracted ${result.length} chars from truncated envelope`);
          return result;
        }
      }
      throw new Error(`DeepSeek response truncated (${rawBody.length} chars): ${envelopeErr.message}`);
    }

    console.log(
      `[DeepSeek] Response: HTTP ${response.status} | finish_reason=${parsedResponse?.choices?.[0]?.finish_reason} | content length=${(parsedResponse?.choices?.[0]?.message?.content || '').length}`
    );

    if (parsedResponse.error) {
      const errMsg = typeof parsedResponse.error === 'string'
        ? parsedResponse.error
        : parsedResponse.error.message || JSON.stringify(parsedResponse.error);
      throw new Error(`DeepSeek error: ${errMsg}`);
    }

    const content = parsedResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('DeepSeek returned empty content');
    }

    const finishReason = parsedResponse.choices?.[0]?.finish_reason;
    if (finishReason === null) {
      console.warn(`[DeepSeek] Model ${model} finish_reason=null after ${content.length} chars`);
      throw new Error(`DeepSeek generation interrupted (finish_reason=null): ${content.length} chars`);
    }
    if (finishReason === 'length') {
      console.warn(`[DeepSeek] Model ${model} hit max_tokens (${maxTokens}) - output truncated`);
    }

    let cleaned = content.trim();
    cleaned = cleaned.replace(/^<think>[\s\S]*?<\/think>\s*/i, '');
    if (/^<think>/i.test(cleaned)) {
      console.warn(`[DeepSeek] Unclosed <think> block - stripping to find JSON`);
      const jsonStart = cleaned.search(/\{[\s\S]*"visibility_score"/);
      if (jsonStart >= 0) {
        cleaned = cleaned.substring(jsonStart);
      } else {
        cleaned = '';
      }
    }
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    cleaned = cleaned.trim();
    if (!cleaned) {
      throw new Error('DeepSeek returned only reasoning tokens (empty after stripping <think>)');
    }
    console.log(`[DeepSeek] Returning cleaned: length=${cleaned.length} | starts_with_brace=${cleaned.startsWith('{')}`);
    return cleaned;
  } catch (error: any) {
    let rawMsg: string;
    if (error.response?.data) {
      try {
        const errBody = typeof error.response.data === 'string'
          ? JSON.parse(error.response.data) : error.response.data;
        rawMsg = errBody?.error?.message || errBody?.error || errBody?.message || error.message;
      } catch {
        rawMsg = typeof error.response.data === 'string'
          ? error.response.data.substring(0, 200) : error.message;
      }
    } else {
      rawMsg = error.message || 'Unknown error';
    }
    const msg = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
    const status = error.response?.status;
    console.error('[DeepSeek Error]', msg, '| Status:', status);

    if (status === 401) {
      throw new Error('DeepSeek authentication failed (401). Verify DEEPSEEK_API_KEY.');
    }
    if (status === 429) {
      throw new Error('DeepSeek rate limit exceeded (429).');
    }

    throw new Error(msg);
  }
};

export const ollamaPrompt = async (
  promptTemplate: string | any,
  input: any,
  retryCount = 0
): Promise<any> => {
  try {
    const promptText =
      typeof promptTemplate === 'string'
        ? `${promptTemplate}\n\nInput: ${JSON.stringify(input)}`
        : promptTemplate;

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: 'llama2',
        prompt: `You are an AI Visibility Intelligence Platform expert. Analyze websites and provide evidence-based insights. Output JSON only. Cite all evidence by ID. Mark unknowns explicitly. do this for real\n\n${promptText}`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 4000,
        },
      },
      {
        timeout: 60000,
      }
    );

    const content = response.data.response;

    // Try to parse as JSON
    try {
      return JSON.parse(content);
    } catch (parseError) {
      // If not JSON, return as text
      return content;
    }
  } catch (error: any) {
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error';
    const status = error.response?.status;
    console.error('[Ollama Error]', msg, '| Status:', status);

    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      throw new Error(
        `Unable to reach Ollama server at ${OLLAMA_BASE_URL}. Please ensure: (1) Ollama is installed and running, (2) OLLAMA_BASE_URL in root .env is correct.`
      );
    }

    if (msg.includes('ETIMEDOUT')) {
      throw new Error(
        `Ollama request timed out. The server at ${OLLAMA_BASE_URL} may be overloaded or unreachable.`
      );
    }

    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying Ollama (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return ollamaPrompt(promptTemplate, input, retryCount + 1);
    }

    throw new Error(msg);
  }
};

// Legacy function for backward compatibility
export const analyzeWithOpenRouter = async (prompt: string): Promise<any> => {
  if (!OPEN_ROUTER_API_KEY) {
    throw new Error(
      'OpenRouter API key not configured. Please add OPEN_ROUTER_API_KEY to the root .env file.'
    );
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI Visibility Intelligence Platform expert. Analyze websites and provide evidence-based insights on their visibility to AI-driven search systems. do this for real',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return {
      success: true,
      data: response.data.choices[0].message.content,
      provider: 'OpenRouter',
    };
  } catch (error: any) {
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error';
    const status = error.response?.status;
    console.error('[OpenRouter Legacy Error]', msg, '| Status:', status);

    if (status === 401) {
      throw new Error(
        'OpenRouter authentication failed (401). Your API key in OPEN_ROUTER_API_KEY may be invalid.'
      );
    }

    throw new Error(msg);
  }
};

export const analyzeWithOllama = async (prompt: string): Promise<any> => {
  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: 'llama2',
        prompt: `You are an AI Visibility Intelligence Platform expert. Analyze websites and provide evidence-based insights on their visibility to AI-driven search systems. do this for real\n\n${prompt}`,
        stream: false,
      },
      {
        timeout: 60000,
      }
    );

    return {
      success: true,
      data: response.data.response,
      provider: 'Ollama',
    };
  } catch (error: any) {
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error';
    const status = error.response?.status;
    console.error('[Ollama Legacy Error]', msg, '| Status:', status);

    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      throw new Error(
        `Unable to reach Ollama server at ${OLLAMA_BASE_URL}. Ensure Ollama is running.`
      );
    }

    throw new Error(msg);
  }
};

export const analyzeWithFailover = async (prompt: string): Promise<any> => {
  try {
    return await analyzeWithOpenRouter(prompt);
  } catch (openRouterError: any) {
    console.log('OpenRouter failed, falling back to Ollama...', openRouterError?.message);
    try {
      return await analyzeWithOllama(prompt);
    } catch (ollamaError: any) {
      // Diagnostic detail: include both error messages
      const errorDetails = `Both AI providers failed. OpenRouter error: ${openRouterError?.message || 'Unknown error'}; Ollama error: ${ollamaError?.message || 'Unknown error'}`;
      console.error(errorDetails);
      throw new Error(errorDetails);
    }
  }
};
