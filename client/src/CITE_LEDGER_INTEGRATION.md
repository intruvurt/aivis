/\*\*

- CITE LEDGER FRONTEND ARCHITECTURE
-
- Complete integration guide for ledger-first, cite-backed UI layer.
- Every visible artifact must answer: "show me the cites"
  \*/

# Cite Ledger Frontend - Architecture & Integration Guide

## Overview

The frontend is restructured as a **forensic interface**, not a dashboard. Every element flows upward from immutable cite entries:

```
Cite Entry (raw evidence + hash)
    ↓
Registry Pattern (learned from cites)
    ↓
Score (aggregated cite confidence)
    ↓
Issue Cluster (negative weight cites)
    ↓
Fix (transformation justified by cites)
    ↓
UI Visualization (cite-backed rendering)
```

## Core Principle

**Hard Constraint**: If it has no cite backing, it does not render.

```typescript
// This is enforced in the store
if (!refs || refs.length === 0) {
  return null; // No evidence → no visibility
}
```

## Architecture Layers

### 1. State Layer (`citeLedgerStore.ts`)

**Zustand store** with ledger-first shape:

```typescript
{
  cites: Record<string, CiteEntry>,          // Primary source of truth
  scoreRefs: {
    crawl: string[],                         // Cite IDs backing crawl score
    semantic: string[],
    authority: string[]
  },
  issues: [{
    id: string,
    citeRefs: string[],                      // Must have backing cites
    fingerprint: string,
    severity: 'critical' | 'high' | 'medium' | 'low'
  }],
  fixes: [{
    id: string,
    citeRefs: string[],                      // Must have backing cites
    patch: string,
    targetPath: string,
    prUrl?: string
  }],
  timeline: [{ event, timestamp }]           // For replay
}
```

**Key invariant**: All `issues` and `fixes` MUST have `citeRefs.length > 0`.

### 2. Component Layer

#### CiteChain (Spine Component)

- **Purpose**: Core reusable primitive
- **Usage**: Every score, issue, fix, and layer expands via CiteChain
- **Principle**: No refs → renders nothing
- **File**: `CiteChain.tsx`

```typescript
<CiteChain
  refs={scoreRefs.crawl}      // Cite entry IDs
  compact={true}               // Mode
  label="Crawl Evidence"
/>
```

#### Heatmap (Score Visualization)

- **Purpose**: Three-layer score with cite expansion
- **Principle**: Score is a compressed cite graph, not a number
- **File**: `Heatmap.tsx`

Clicking a layer expands to show backing cites:

```
Crawl Analysis: 72%
├─ Cite 1: Schema extraction (92%)
├─ Cite 2: Meta tags (85%)
└─ Cite 3: Microdata (76%)
```

#### IssuePanel & FixPanel (Evidence-First)

- **Purpose**: Issues and fixes backed by evidence chains
- **Principle**: Issue without cites → store rejects it
- **Files**: `IssueFixPanels.tsx`

```typescript
// Store enforces this
addIssue(issue) {
  if (!issue.citeRefs || issue.citeRefs.length === 0) {
    console.warn('Rejected: no cite backing');
    return state;
  }
  // Accept and render
}
```

#### CiteStream (Live Feed)

- **Purpose**: Real-time evidence streaming
- **Behavior**: Appends cites as they arrive, newest at top
- **Style**: Terminal-like dark mode
- **File**: `CiteStream.tsx`

#### Advanced Features

- **Replay**: Time slider to watch visibility evolve
- **DiffMode**: Before/after cite delta visualization
- **EntityGravity**: Which entities dominate citation weight
- **GitHubIntegration**: Apply fix → PR with cite references

### 3. Streaming Layer (`useCiteLedgerStream.ts`)

WebSocket hook connects backend to store:

```typescript
// Backend sends:
{ "type": "cite:add", "payload": { ...cite } }
{ "type": "score:update", "payload": { crawl: 72, refs: [...] } }
{ "type": "issue:add", "payload": { id, citeRefs, ... } }

// Hook validates and dispatches to store
const { isConnected } = useCiteLedgerStream(auditId);
```

**Hard constraint**: If a message has no `refs`, it's rejected before store update.

## Integration into Audit Result Page

### Step 1: Import Components

```typescript
import { ForensicAuditView } from '../components/ForensicAuditView';
import useCiteLedgerStream from '../hooks/useCiteLedgerStream';
```

### Step 2: Replace Old Result Page

```typescript
export function AuditResultPage() {
  const { auditId, url } = getParams();

  return (
    <ForensicAuditView
      auditId={auditId}
      url={url}
    />
  );
}
```

### Step 3: Backend Contract

Server must emit referential streaming messages:

```typescript
// ❌ OLD (blobs)
res.write(JSON.stringify({
  score: 72,
  issues: [...],
  fixes: [...]
}));

// ✅ NEW (references)
res.write(JSON.stringify({
  type: "cite:add",
  payload: { id: "...", source_type: "crawl", ... }
}));
res.write(JSON.stringify({
  type: "score:update",
  payload: { crawl: 72, refs: ["cite_1", "cite_2"] }
}));
```

## Selectors & Computed Values

```typescript
// From store
const allCites = useCiteLedgerStore(selectAllCites);
const citesForIssue = useCiteLedgerStore(selectCitesForIssue(issueId));
const avgConfidence = useCiteLedgerStore(selectScoreConfidence);
const coverage = useCiteLedgerStore(selectCiteCoverage); // by source type
```

## UX Flow

### User Lands on Audit

1. Streaming starts
2. Cites appear in CiteStream (terminal-like)
3. Heatmap updates as score refs populate
4. Issues appear as cite clusters form
5. Fixes appear justified by evidence

### User Clicks a Layer

1. Heatmap expands to CiteChain
2. Shows all backing cites
3. Each cite is clickable with full raw + extracted
4. Confidence % visible

### User Wants to Fix

1. Click "Apply Fix" in FixPanel
2. GitHub integration creates PR
3. Commit message includes cite lineage
4. PR body shows evidence chain

### User Wants to Understand Evolution

1. Open "Replay" tab
2. Drag time slider
3. State rebuilds from timeline
4. See visibility evolve in real-time

### User Wants to Compare Snapshots

1. Open "Diff Mode"
2. Select baseline and comparison indices
3. See added, removed, changed cites
4. Visual delta

## CSS Structure

All styles are in `styles/` folder:

```
CiteChain.css              # Spine component styling
Heatmap.css                # Score layer visualization
IssueFixPanels.css         # Evidence-backed panels
CiteStream.css             # Terminal-style live feed
AdvancedFeatures.css       # Replay, Diff, Gravity, GitHub
ForensicAuditView.css      # Main layout and orchestration
```

Colors:

- Excellent (80%+): Green (#10b981)
- Good (60-79%): Orange (#ea580c)
- Fair (40-59%): Yellow (#eab308)
- Poor (20-39%): Red (#ef4444)
- Critical (<20%): Dark Red (#7f1d1d)

## Store Actions Reference

```typescript
// Add cite (primary entry point)
addCite(cite: CiteEntry)

// Set score layer references
setScoreRefs(layer: 'crawl' | 'semantic' | 'authority', refs: string[])

// Set computed scores
setScores({ crawl, semantic, authority, visibility })

// Add issue (must have citeRefs)
addIssue(issue)

// Add fix (must have citeRefs)
addFix(fix)

// Timeline for replay
recordTimelineEvent(event)
seekTimeline(index)

// Reset everything
reset()
```

## Backend Integration Checklist

- [ ] WebSocket endpoint at `/api/stream/audit/:auditId`
- [ ] Emit `cite:add` messages with full CiteEntry objects
- [ ] Emit `score:update` with cite references, not just scores
- [ ] Emit `issue:add` with cite references
- [ ] Emit `fix:add` with cite references
- [ ] Emit `complete` when analysis finishes
- [ ] Validate all refs point to existing cites before sending
- [ ] `POST /api/github/create-pr` endpoint for PR automation
- [ ] Include cite lineage in PR commit messages

## Performance Considerations

- CiteChain uses useMemo to avoid re-renders
- Heatmap layers are individually collapsible
- CiteStream caps history at 100 entries
- Zustand store uses shallow equality comparisons
- All selectors are memoized

## Dark Mode

Terminal-like dark mode for CiteStream:

```
Background: #0f172a
Text: #e5e7eb
Accents: #3b82f6
```

Other components use light theme with blue accents (CSS variables can be added for theme switching).

## Testing

Key test scenarios:

1. **No cites**: All panels show "No evidence" states
2. **Single cite**: CiteChain renders single node
3. **Missing refs**: Store rejects and logs warning
4. **Timeline replay**: State rebuilds correctly
5. **Score update**: Heatmap recalculates
6. **GitHub integration**: PR created with cite lineage

## Error Handling

```typescript
// Store validation
if (!cite.id || !cite.source_type) {
  console.warn('Invalid cite entry', cite);
  return; // Silent rejection
}

// WebSocket reconnection
- Max 5 reconnection attempts
- Exponential backoff: 3s → 6s → 12s → 24s → 48s
- User sees "Disconnected" indicator

// Component safety
// All components check refs length before render
if (!refs || refs.length === 0) return null;
```

## What This Replaces

Old findings-based model:

```
Score (number) → Issues (list) → Fixes (code)
```

New cite-ledger model:

```
Cites → Score (graph compressed) → Issues (cite clusters) → Fixes (justified)
       ↑
       (everything traceable to raw evidence)
```

The UI is no longer a viewer—it is a **live interpreter of the Cite Ledger**.

---

**Constitutional principle**: _Every score becomes explainable. Every issue becomes traceable. Every fix becomes provable._
