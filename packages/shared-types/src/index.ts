export type EventType =
  | "ANALYZE_CREATED"
  | "SCAN_COMPLETE"
  | "ENTITIES_RESOLVED"
  | "GAPS_DETECTED"
  | "PAGE_SPEC_CREATED"
  | "PAGE_PUBLISHED";

export interface Event {
  type: EventType;
  job_id: string;
  payload: any;
  timestamp: number;
}
