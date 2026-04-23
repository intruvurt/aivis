# Eventized Audit Rendering Model

## Correction Applied

The homepage proof surface now prioritizes traceability over story continuity.

- Deprecated model: live narrative progression
- Required model: immutable audit trace stream

Trust in AI visibility systems comes from discrete execution evidence, not cinematic continuity.

---

## Core Principle

Users and crawlers should not feel they are watching a story unfold.

Users and crawlers should feel they are reading a system log that already happened.

Every event must be:

- timestamped
- independently verifiable
- bound to a real execution ID
- replayable under deterministic input

---

## Runtime Surface

Homepage hero now renders an event stream with this shape:

- [EVENT] crawl.started
- [EVENT] dom.structure.extract
- [EVENT] entity.resolve
- [EVENT] schema.validate
- [EVENT] citation.simulation.run
- [EVENT] failure.scan.completed
- [EVENT] audit.finalized

Each line includes status markers and event details.

---

## Corrected Phase 2 Architecture

### Per-Visitor Audit Trace Session

```ts
interface AuditSession {
  session_id: string;
  target_url: string;
  execution_id: string;
  event_stream: Array<{
    timestamp: string;
    event_name: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
  entity_graph_snapshot: {
    entities: string[];
    ambiguous_entities: string[];
    canonicalized_count: number;
  };
  failure_points: Array<{
    code: string;
    severity: "low" | "medium" | "high";
    message: string;
  }>;
  final_score_vector: {
    comprehension: number;
    verification_confidence: number;
    citation_confidence: number;
  };
  execution_time_ms: number;
}
```

---

## Frontend Rendering Contract

Replace:

- collapsible step narrative
- guided progression language
- implied continuous execution

With:

- scrollable immutable trace log
- event-first rendering
- explicit execution metadata (session_id, execution_id, timestamps)

Reference line style:

- ✓ crawl.dom_extracted (142 nodes)
- ✓ schema.org detected (3 entities)
- ✓ citation simulation run (ChatGPT / Perplexity / Claude)
- ⚠ entity ambiguity detected: AiVIS -> 2 competing definitions
- ✗ citation confidence threshold not met (0.62 < 0.75)
- ✓ audit finalized

---

## API Contract Change

Rename endpoint model from snapshot to session artifact.

Deprecated:

- `/api/public/audit-snapshot/homepage`

Required:

- `/api/public/audit/session/:id`

Optional convenience resolver:

- `/api/public/audit/session/latest?target_url=https://aivis.biz/`

Session response must be immutable after finalize.

---

## Determinism Requirement

Hard requirement for trust:

- same input + same execution class => identical event stream ordering and equivalent final score vector

To support this:

- lock event schema version in payload
- include execution class (`observer|starter|alignment|signal`)
- persist event stream as append-only ledger rows
- prohibit post-finalize event mutation

---

## Product Risk Removed

Risk in prior model:

- narrative UX could be interpreted as simulation
- technical users ask: executed trace or UI theater?
- trust degrades when provenance is unclear

Eventized model removes ambiguity by making provenance first-class.

---

## What This Unlocks

1. Machine-verifiable artifact output

- AI systems can parse events as structured evidence

1. Homepage as reference execution artifact

- Not a marketing surface, a reproducible run log

1. Self-explanatory product behavior

- Output becomes explanation

---

## Minimal Implementation Plan (Delta)

1. Keep current hero shell and scan entry
2. Render immutable event stream component as primary proof block
3. Back API with server-generated session artifacts
4. Cache by target_url + event schema version + execution class
5. Expose replay metadata (`session_id`, `execution_id`, `event_schema_version`)

---

## Guard Rails

Do not:

- fabricate event timestamps client-side for authoritative sessions
- stream pseudo-events that are not persisted
- mutate finalized streams for UX polish

Do:

- persist events server-side before rendering as authoritative
- label demo streams as demo until bound to a real session
- include replay identity in every rendered trace block
