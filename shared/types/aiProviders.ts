/**
 * AI Provider configuration types
 */

export type AIProviderName = 'openrouter' | 'openai' | 'anthropic' | 'google';

export interface AIProvider {
  name: AIProviderName;
  displayName: string;
  models: AIModel[];
  baseUrl: string;
  requiresApiKey: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderName;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  isFree?: boolean;
}

export interface AIProviderConfig {
  provider: AIProviderName;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProviderHealth {
  provider: AIProviderName;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms?: number;
  last_checked: string;
}