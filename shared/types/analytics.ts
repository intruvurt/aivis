/**
 * Analytics-related types
 */

export interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export interface AnalyticsMetrics {
  total_scans: number;
  total_users: number;
  avg_visibility_score: number;
  period_start: string;
  period_end: string;
}

export interface PageViewEvent {
  page: string;
  referrer?: string;
  user_agent?: string;
  timestamp: string;
}

export interface AnalyticsSummary {
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  total_analyses: number;
}