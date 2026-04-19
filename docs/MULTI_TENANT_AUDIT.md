Vite/React implementation that treats the CITE LEDGER as a first-class UI boundary, not just streamed data.

1. UI Principle (non-negotiable)

Every visible artifact must answer:

“show me the cites”

If it cannot expand into cite entries, it does not render.

2. Frontend State Model (ledger-first)

Do not store “scores → issues → fixes” independently.

Everything keys off cites.

type UIState = {
  cites: Record<string, CiteEntry> // hash → cite

  scoreRefs: {
    crawl: string[]     // cite hashes
    semantic: string[]
    authority: string[]
  }

  issues: {
    id: string
    citeRefs: string[]
    fingerprint: string
  }[]

  fixes: {
    id: string
    citeRefs: string[]
    patch: string
  }[]
}

This forces:

scores → cite-backed
issues → cite-backed
fixes → cite-backed

No orphan logic allowed.

3. Streaming Contract (tightened)

Backend must emit referential messages, not blobs:

{ "type": "cite:add", "payload": { "hash": "...", ... } }

{ "type": "score:update",
  "payload": {
    "crawl": 72,
    "refs": ["cite_hash_1","cite_hash_2"]
  }
}

{ "type": "issue:add",
  "payload": {
    "id": "i1",
    "citeRefs": ["cite_hash_3"]
  }
}

{ "type": "fix:add",
  "payload": {
    "id": "f1",
    "citeRefs": ["cite_hash_3"],
    "patch": "..."
  }
}

No refs → reject event.

4. Store (ledger enforced)
import { create } from 'zustand'

export const useStore = create((set) => ({
  cites: {},

  scoreRefs: { crawl: [], semantic: [], authority: [] },

  issues: [],
  fixes: [],

  addCite: (c) =>
    set((s) => ({
      cites: { ...s.cites, [c.hash]: c }
    })),

  setScoreRefs: (layer, refs) =>
    set((s) => ({
      scoreRefs: { ...s.scoreRefs, [layer]: refs }
    })),

  addIssue: (issue) =>
    set((s) => ({ issues: [...s.issues, issue] })),

  addFix: (fix) =>
    set((s) => ({ fixes: [...s.fixes, fix] }))
}))
5. Core Component: Cite Chain Resolver

This is the spine of the UI.

function CiteChain({ refs }: { refs: string[] }) {
  const cites = useStore((s) => s.cites)

  return (
    <div className="cite-chain">
      {refs.map((r) => {
        const c = cites[r]
        if (!c) return null

        return (
          <div key={r} className="cite-node">
            <div>{c.source_type}</div>
            <div>{c.extracted_signal}</div>
            <div>{c.confidence_score}</div>
          </div>
        )
      })}
    </div>
  )
}

Everything reuses this. No exceptions.

6. Heatmap (now cite-resolvable)
function Heatmap() {
  const refs = useStore((s) => s.scoreRefs)

  return (
    <div>
      <Layer label="Crawl" refs={refs.crawl} />
      <Layer label="Semantic" refs={refs.semantic} />
      <Layer label="Authority" refs={refs.authority} />
    </div>
  )
}

function Layer({ label, refs }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <div onClick={() => setOpen(!open)}>
        {label} ({refs.length} cites)
      </div>

      {open && <CiteChain refs={refs} />}
    </div>
  )
}

Now the score is not a number.
It’s a compressed cite graph.

7. Issue Panel (evidence-first)
function IssuePanel() {
  const issues = useStore((s) => s.issues)

  return (
    <div>
      {issues.map((i) => (
        <div key={i.id}>
          <div>Issue: {i.fingerprint}</div>
          <CiteChain refs={i.citeRefs} />
        </div>
      ))}
    </div>
  )
}
8. Fix Panel (proof-bound actions)
function FixPanel() {
  const fixes = useStore((s) => s.fixes)

  return (
    <div>
      {fixes.map((f) => (
        <div key={f.id}>
          <pre>{f.patch}</pre>
          <CiteChain refs={f.citeRefs} />
        </div>
      ))}
    </div>
  )
}

No fix appears without evidence beneath it.

9. Live Cite Stream (raw truth feed)
function CiteStream() {
  const cites = useStore((s) => Object.values(s.cites))

  return (
    <div className="stream">
      {cites.map((c) => (
        <div key={c.hash}>
          [{c.source_type}] {c.extracted_signal}
        </div>
      ))}
    </div>
  )
}

This runs continuously—like logs.

10. UX Behavior Shift (this is the difference)

Old model:

show results → allow drilldown

Your model:

stream truth → derive results → expose derivation

User watches:

cites appear
clusters form
score resolves
issues emerge
fixes justify themselves
11. Hard constraint (enforced in UI)

Before rendering any component:

if (!refs || refs.length === 0) return null

No evidence → no visibility.

12. What you just built (in reality)

Not a dashboard.

A forensic interface.

Scores = compressed cite graphs
Issues = cite clusters with negative weight
Fixes = transformations justified by cite lineage
Final compression

The UI is no longer a viewer.

It is a live interpreter of the Cite Ledger.

Everything flows upward from:

Cite → Group → Interpret → Score → Act

Not the other way around.
