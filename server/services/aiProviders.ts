// Modular AI provider interface for multi-model support (OpenRouter, Ollama, etc.)
// Add new providers/models here as needed

export type AIProvider = 'openrouter' | 'ollama';
export type AIModel = string; // Dynamic model names from OpenRouter

export interface ProviderConfig {
  provider: AIProvider;
  model: string;
  label: string;
  isFree: boolean;
  endpoint?: string;
}

// Using OpenRouter low-cost models for analysis
// Note: Free models require data training consent; using cheap paid models instead
export const PROVIDERS: ProviderConfig[] = [
  {
    provider: 'openrouter',
    model: 'openai/gpt-5-nano',
    label: 'GPT-5 Nano',
    isFree: true, // Very cheap ~$0.05/1M tokens
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    isFree: true, // Very cheap
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    provider: 'openrouter',
    model: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    isFree: true, // Cheap ~$1/1M tokens
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    isFree: true, // Very cheap
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    provider: 'openrouter',
    model: 'mistralai/mistral-small-2503',
    label: 'Mistral Small',
    isFree: true, // Cheap
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
];

export async function callAIProvider({
  provider,
  model,
  prompt,
  apiKey,
  endpoint,
  opts = {},
}: {
  provider: AIProvider;
  model: AIModel;
  prompt: string;
  apiKey: string;
  endpoint?: string;
  opts?: Record<string, any>;
}): Promise<string> {
  if (provider === 'openrouter') {
    const url = endpoint || 'https://openrouter.ai/api/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://intruvurt.space',
        'X-Title': 'Intruvurt',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: String(prompt ?? '') }],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.max_tokens ?? 1200,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter error: ${res.status} - ${err}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content;
    }
    throw new Error('No content returned from OpenRouter');
  }
  // Add Ollama or other provider logic here
  throw new Error(`Provider not implemented: ${provider}`);
}
