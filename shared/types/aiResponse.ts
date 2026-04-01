/**
 * AI Response types for LLM interactions
 */

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  usage?: AIUsage;
  finish_reason?: string;
  latency_ms?: number;
}

export interface AIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ParsedAIAnalysis {
  visibility_score: number;
  summary: string;
  key_takeaways: string[];
  recommendations: Array<{
    priority: string;
    category: string;
    title: string;
    description: string;
  }>;
}