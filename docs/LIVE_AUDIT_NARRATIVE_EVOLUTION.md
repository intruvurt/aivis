# Live Audit Narrative → Next Phase: Real Audit Sessions

## What Just Changed

**Homepage Evolution:**
- **Old Model**: Declarative storytelling ("Here's what we do")
- **New Model**: Execution theater ("Watch the system audit this page")

The homepage now mirrors your Scan → Observe → Fix pipeline as a **proof surface** instead of an explanation.

---

## Architecture: Current State

### LiveAuditNarrative Component (Live)
```
Homepage Hero Section
├── Header: "AI visibility audit in progress"
├── Step 01: Crawling surface
├── Step 02: Entity resolution
├── Step 03: Citation readiness test
├── Step 04: Structural failure scan
├── Step 05: System interpretation
├── System state summary
└── Call to action: "Run a live audit below"
├── ScanShell (user input + real audit trigger)
```

**Key behaviors:**
- Steps collapse/expand on click
- Findings displayed with icons and priority
- Each observation is specific to what AI crawlers actually see
- Bottom statement: "This page is demonstrating the system, not describing it"

**Prerender safety:** Yes — all content is static HTML-first (no runtime dependency on API)

---

## Next Evolution: Live Audit Per Visitor

### Phase 2: Injected Audit Data
```
HomePage (personalized per visitor)
├── Static Narrative (current) ← prerender-safe
├── Live Audit Results (NEW) ← per-visitor generated
│   ├── Unique scan_id
│   ├── Real entity extraction (this page's entities)
│   ├── Actual mismatch score (this page vs AI interpretation)
│   ├── Real findings from this page
│   └── Timestamp: "Scanned 2s ago"
└── Call-to-action tied to actual result
```

### Implementation Path

**Option A: Pre-audit on Deploy**
- Build generates unique audit per commit
- Bakes result into prerendered HTML
- Fast (no runtime query), but stale within hours

**Option B: Server-side Render + Cache**
- `/` renders with real-time audit on first hit
- Caches result for N minutes (120-300s TTL)
- Visitors within cache window see same audit
- Cost: 1 audit per N minutes
- Benefit: Always "recent" (<5min old typically)

**Option C: Client-side Hydration (Best)**
- HTML prerendered with placeholder structure
- On page load, fetch latest audit for `https://aivis.biz` (this site)
- Inject findings into pre-positioned DOM slots
- No extra server load, instant async update
- Benefit: Proof is live + interactive

---

## Semantic & SEO Impact

### Current Homepage Messaging

**Old schema interpretation:**
```json
{
  "@type": "SoftwareApplication",
  "name": "AiVIS",
  "description": "See what AI reads" ← Generic marketing claim
}
```

**New schema interpretation:**
```json
{
  "@type": "HowTo",  ← Procedural documentation, not marketing
  "steps": [
    { "name": "Crawling surface", "description": "Extract structure..." },
    { "name": "Entity resolution", "description": "Map entities..." },
    ...
  ],
  "result": {
    "name": "AI Visibility Audit Complete",
    "description": "Comprehension: high. Verification: medium."
  }
}
```

**AI Crawler Behavior:**
- Old: Treats page as marketing → Lower citation trust
- New: Treats page as procedural documentation → Higher evidence weight

This shifts perception from "company describes their tool" to "tool demonstrates itself on real content."

---

## Unblocked Use Cases

### 1. **Social Proof at Scale**
Instead of static testimonials, homepage shows:
- "We audited https://aivis.biz and found X gaps"
- "This page is currently: 74% AI-visible" (generated in real-time)
- Visitors trust results more because they're **live and reproducible**

### 2. **Content Marketing Playbook**
Every blog post can include:
```
[Live Audit Card]
This article was audited at [timestamp].
Current visibility score: 81/100
Missing: [generated from real audit]
```

### 3. **Customer Onboarding**
First-time users land on homepage and see:
- "We're auditing this page right now"
- Narrative explains stages
- [Audit complete] → "Here's what we found on your site"
- Users immediately understand product through live demo

---

## Technical Requirements for Phase 2

### Database / Cache
- Store latest audit of `https://aivis.biz` in expedited cache
- TTL: 5 minutes (not tier-limited, internal use)
- Key: `audit:homepage:latest`
- Trigger: Every production deploy or manual refresh

### Client Component Changes
```tsx
// New component: LiveAuditResults
// Hydrates with real findings from latest homepage audit
// Replaces mock DEFAULT_MISMATCH_DATA with actual findings
// Displays in right panel or below narrative
```

### API Endpoint (New)
```
GET /api/public/audit-snapshot/homepage
- No auth required
- Returns: { findings, score, scanned_at, entities }
- Cacheable (Cache-Control: public, max-age=300)
- CDN-friendly
```

---

## Success Metrics

| Metric | Current | Phase 2 Target | Signal |
|--------|---------|---|---|
| Homepage Time-on-Page | ~2s | ~5-8s | Narrative engagement |
| Bounce Rate | TBD | -15% | Proof reduction |
| CTA Click Rate | TBD | +30% | Trust in demo |
| Audit Starts (homepage) | TBD | +25% | Users act after seeing audit |
| Return Visits | TBD | +20% | Social sharing of audit |

---

## Recommendation: Start Phase 2 Next Sprint

1. **Week 1**: Implement `/api/public/audit-snapshot/homepage`
2. **Week 2**: Create `LiveAuditResults` component (hydration pattern)
3. **Week 2**: Integrate into Landing page
4. **Week 3**: A/B test narrative + live results vs static

This keeps the proof surface **real** and turns visitors into believers through **unambiguous demonstration**.

---

## Architecture Guard Rails

✅ **Do not:**
- Hard-code audit results (breaks on next deploy)
- Fetch from unauthenticated `/api/analyze` (rate-limit exposure)
- Store stale snapshots (>5min old feels fake)
- Hide live audit behind spinner (defeats "proof" purpose)

✅ **Do:**
- Cache aggressively server-side (few seconds build+cache time)
- Regenerate on every deploy (always fresh)
- Show timestamp ("Scanned 2 seconds ago")
- Make it reproducible (users can run same audit on their URL)
