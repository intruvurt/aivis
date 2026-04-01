/**
 * Integration-related types
 */

export type IntegrationType = 'slack' | 'zapier' | 'webhook' | 'discord';

export interface Integration {
  id: string;
  user_id: string;
  name: string;
  type: IntegrationType;
  enabled: boolean;
  config: IntegrationConfig;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConfig {
  webhook_url?: string;
  api_key?: string;
  channel_id?: string;
  events?: IntegrationEvent[];
}

export type IntegrationEvent =
  | 'audit_completed'
  | 'audit_failed'
  | 'score_changed'
  | 'weekly_report';

export interface CreateIntegrationRequest {
  name: string;
  type: IntegrationType;
  config: IntegrationConfig;
}

export interface IntegrationWebhookPayload {
  event: IntegrationEvent;
  timestamp: string;
  data: Record<string, unknown>;
}