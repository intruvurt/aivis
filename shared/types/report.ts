/**
 * Report-related types
 */

export interface Report {
  id: string;
  user_id: string;
  audit_id: string;
  title: string;
  format: ReportFormat;
  status: ReportStatus;
  download_url?: string;
  created_at: string;
  expires_at?: string;
}

export type ReportFormat = 'pdf' | 'json' | 'csv';
export type ReportStatus = 'pending' | 'generating' | 'ready' | 'expired' | 'failed';

export interface GenerateReportRequest {
  audit_id: string;
  format: ReportFormat;
  include_recommendations?: boolean;
  include_technical_details?: boolean;
}

export interface ShareableReport {
  id: string;
  report_id: string;
  share_token: string;
  expires_at: string;
  view_count: number;
  max_views?: number;
}