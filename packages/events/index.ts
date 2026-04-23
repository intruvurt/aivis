// packages/events/index.ts

export type EventType =
  | "ANALYZE_CREATED"
  | "SCAN_DONE"
  | "ENTITIES_RESOLVED"
  | "GAPS_DETECTED"
  | "PAGE_GENERATED"
  | "PUBLISHED"
  | "FEEDBACK_TRIGGERED";

export interface Event {
  id: string;
  job_id: string;
  type: EventType;
  payload: any;
  ts: number;
}
