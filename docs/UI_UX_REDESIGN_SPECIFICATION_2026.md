# AiVIS UI/UX Redesign Specification — 2026

## Mission

Build "THE citation model interpretation evidence registry and ledger that everyone who builds a similar platform will have to respect and implement."

Redesign the entire UI/UX to:
1. **Reflect the CITE LEDGER system** — every page surfaces evidence-backed scoring
2. **Separate technical SEO from model-only scoring** — show impact on visibility both ways
3. **Build the evidence registry from existing audit data** — establish a canonical reference
4. **Match visual design of market leaders** (HubSpot, SEMrush, Ahrefs) — clean, sharp, efficient, no blur/glass
5. **Restructure analytics** — wire directly to pipeline stages and execution outcomes

---

## PART 1: Visual Design System

### Color & Contrast Strategy

**No Blur, No Glass — Sharp & Efficient**

Current issues (implied):
- Overuse of `bg-white/[0.05]` (glassmorphism)
- Overuse of blurred backgrounds
- Unclear typography hierarchy
- Insufficient contrast in secondary elements

### New Design Tokens

```typescript
// Color Palette (high contrast, no transparency abuse)
const COLORS = {
  // Primary
  slate950: "#0f172a",  // Deep charcoal (primary bg)
  slate200: "#e2e8f0",  // Light gray (text on dark)
  orange400: "#fb923c", // Action orange (CTA, highlights)
  
  // Data Visualization
  success: "#10b981",   // Clean green (passed, positive)
  warning: "#f59e0b",   // Amber (caution, review needed)
  danger: "#ef4444",    // Red (critical, failed)
  info: "#0ea5e9",      // Sky blue (informational)
  
  // Semantic
  evidence: "#a78bfa",  // Violet (verified evidence)
  gap: "#ec4899",       // Pink (attribution gaps)
  drift: "#f97316",     // Orange-red (drift signals)
  
  // Tier indicators (clear, no opacity)
  tierObserver: "#64748b",   // Gray
  tierStarter: "#3b82f6",    // Blue
  tierAlignment: "#8b5cf6",  // Violet
  tierSignal: "#f59e0b",     // Amber
  tierScorefix: "#10b981",   // Green
};

// Typography (reduced variants, clear hierarchy)
const TYPOGRAPHY = {
  // Headings (less is more)
  h1: { size: "2.25rem", weight: 700, color: slate200 },  // Page title
  h2: { size: "1.875rem", weight: 600, color: slate200 }, // Section title
  h3: { size: "1.5rem", weight: 600, color: slate200 },   // Subsection
  h4: { size: "1.125rem", weight: 600, color: slate200 }, // Card title
  
  // Body
  body: { size: "1rem", weight: 400, color: slate200 },
  bodySmall: { size: "0.875rem", weight: 400, color: "#cbd5e1" }, // gray-400
  bodyMuted: { size: "0.875rem", weight: 400, color: "#94a3b8" }, // gray-500
};

// Spacing (efficient, no excess padding)
const SPACING = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
};

// Borders (sharp, not rounded)
const BORDERS = {
  radius: {
    none: "0",
    xs: "0.25rem",  // 4px (minimal, sharp)
    sm: "0.375rem", // 6px (cards, buttons)
    md: "0.5rem",   // 8px (modals, large cards)
  },
  width: {
    subtle: "1px",
    default: "1px",
    strong: "2px",
  },
  color: "#1e293b", // slate-800 (strong contrast)
};

// Shadows (remove glassmorphic blur, use solid edges)
const SHADOWS = {
  none: "none",
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  strong: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
};
```

### Component Guidelines

**Buttons**
- No gradient, no opacity fades
- Solid colors with clear hover state
- Primary: orange400 solid, dark text
- Secondary: slate-800 border, gray text
- Disabled: gray-600 opacity 50%
- Focus: ring-2 ring-orange-300

**Cards**
- Border: 1px slate-800, NO drop shadow
- Background: slate-950 solid
- Hover: border color shifts to slate-700
- Content padding: 1.5rem consistent
- No `bg-white/[0.05]` anywhere

**Tables/Data Views**
- Header: bold, orange-400 text, slate-950 bg
- Row: 1px border-slate-800 between rows
- Alternating rows: slight tint change acceptable, NOT transparency
- Cell padding: 0.75rem top/bottom, 1rem left/right
- Highlighted row: border orange-400 or background slate-900

**Forms/Inputs**
- Border: 1px slate-700 default
- Focus: ring-2 ring-orange-400, border-orange-400
- Error: border-red-500, error text red-400
- Label: bodySmall, muted color, above input
- No placeholder text as instructional copy (help text below)

**Badges/Indicators**
- Tier badge: solid background, white text, rounded-xs
- Status badge: success/warning/danger/info colors, solid
- Evidence tag: evidence color (violet), white text
- No gradient badges

---

## PART 2: CITE LEDGER Evidence Architecture

### Evidence Score Composition (Transparent UI)

Each audit result shows a **5-part score breakdown**:

```
┌─────────────────────────────────────────┐
│ VISIBILITY SCORE: 76/100                │
│                                         │
│ ┌──────────────────────────────────┐   │
│ │ Verified Evidence:     24/30     │   │
│ │ [████████░░] 80%               │   │
│ │                                │   │
│ │ Attribution Gaps:      12/20     │   │
│ │ [██████░░░░] 60%               │   │
│ │                                │   │
│ │ Drift Signals:         18/25     │   │
│ │ [███████░░░░░] 72%             │   │
│ │                                │   │
│ │ Technical SEO (SOP):   15/15    │   │
│ │ [██████████] 100% (PASS)      │   │
│ │                                │   │
│ │ Registry Match:        7/10     │   │
│ │ [███████░░░] 70%              │   │
│ └──────────────────────────────────┘   │
│                                         │
│ ⓘ Visibility assumes best-practice    │
│   SEO. Impact of SEO gaps: -15 points │
└─────────────────────────────────────────┘
```

### Evidence Surface Areas

**1. ComprehensiveAnalysis Component (Enhanced)**
- Show all 5 metrics
- Each metric links to detail view
- Gaps section lists blocking issues with evidence excerpts
- Registry section shows matched patterns from ledger

**2. Evidence Trail Breadcrumb**
- Audit → Evidence → Gaps → Fixes → Verification
- Each stage shows inputs + outputs from CITE LEDGER

**3. Drawer/Modal for Score Components**
- Click any metric → expand detail with:
  - Full evidence list
  - Confidence scores
  - Test results (AI engines, schema validators, etc.)
  - Recommendation chain

**4. Evidence Dashboard (New Page: `/app/evidence`)**
- Central hub for evidence registry
- List all verified patterns from audits
- Show frequency + impact of each pattern
- Link to remediation templates

### Technical SEO: Separate Yet Visible

**New Scoring Layer: "Technical SEO Standard (SOP)"**

Show two parallel views:

```
┌─ Citation Visibility (Model-based) ──────────────┐
│ 76 / 100                                          │
│ Performance: Strong, recoverable with fixes       │
└───────────────────────────────────────────────────┘

┌─ Technical SEO Compliance (Structural) ──────────┐
│ 15 / 15 (PASS)                                    │
│ • Schema.org structured data: ✓ VALID JSON-LD   │
│ • WCAG 2.1 AA compliance: ✓ PASS (automated)    │
│ • Mobile rendering: ✓ PASS (viewport exists)    │
│ • Crawlability: ✓ PASS (robots.txt allows all)  │
│                                                  │
│ Mandatory factors (non-negotiable):              │
│ If any fail → visibility floor is 40 points     │
└───────────────────────────────────────────────────┘

┌─ Impact Summary ──────────────────────────────────┐
│ Visibility with perfect SEO + perfect citations  │
│                           = 100                   │
│                                                  │
│ Current technical SEO score loss             = 0 │
│ Current citation gaps loss                   = 24│
│ ─────────────────────────────────────────────    │
│ Your current score                          = 76 │
│                                                  │
│ Roadmap: Fix all citations → +24 = 100          │
└───────────────────────────────────────────────────┘
```

### Registry Building & Display

**Registry Purpose:** 
Evidence-backed pattern library built from all past audits. Becomes the source of truth for what works.

**Registry Data Model:**
```typescript
interface RegistryPattern {
  id: string;
  type: "schema" | "content_structure" | "entity_anchor" | "citation_signal";
  name: string;
  description: string;
  evidence: {
    citationRate: number;        // % of citations that surface this
    confidenceScore: number;     // 0-100
    testCount: number;           // how many tests verified this
    lastUpdated: Date;
  };
  examples: Array<{
    url: string;
    snippet: string;
    citationOutcome: "cited" | "partial" | "not_cited";
  }>;
  impact: {
    visibility: number;          // point gain on score
    searchability: number;       // WCAG/SEO gain
  };
}
```

**Registry UI Display:**
- `/app/registry` — browse all verified patterns
- `/app/recommendations` — personalized registry actions (what this site should implement)
- `/app/evidence-templates` — download templates for missing patterns

---

## PART 3: Technical SEO Scoring Separation

### Scoring Rules

**Technical SEO (SOP) Score: 0-15 points**
- JSON-LD schema validation: up to 3 points
- WCAG 2.1 AA compliance: up to 3 points
- Mobile/responsive: up to 3 points
- Crawlability/robots.txt: up to 3 points
- Performance (Core Web Vitals): up to 3 points

**Mandatory Factors:**
If ANY factor fails → floor is 40 points on visibility, regardless of citations.

**Combined Visibility Score: 0-100 points**
- Verified Evidence (citations + attribution): 0-50
- Gaps (missing answer blocks, drift): 0-20
- Registry Alignment (patterns): 0-15
- Technical SEO: 0-15 (bonus if all pass, penalty if any fail)

### Analytics: Technical SEO Trend

New chart type: **Technical vs. Citation Lift**

```
Over 30 days:
┌─────────────────────────────┐
│ Score Movement              │
│                             │
│ +15 ↑ Technical SEO fixes   │
│ +12 ↑ Citation improvements │
│ +8  ↑ Registry patterns     │
│ ═══════════════════════════ │
│ +35 total ✓ 30-day lift     │
└─────────────────────────────┘
```

---

## PART 4: Page-by-Page Redesign Spec

### Tier 1: Critical User Paths (Must Launch)

#### 1. `/app` — Command Center (Dashboard)
**Current State:** Likely shows audit cards + recent activity
**Redesign:**

```
┌────────────────────────────────────────────────────┐
│ COMMAND CENTER — Overview & Next Actions           │
├────────────────────────────────────────────────────┤
│                                                    │
│ [Run New Audit] [View All Reports] [Settings]     │
│                                                    │
│ ┌─ YOUR VISIBILITY AT A GLANCE ──────────────────┐ │
│ │                                                │ │
│ │ Overall Visibility: 76/100                    │ │
│ │ [████████░░░░░░░░] 76% (Yellow → Action)      │ │
│ │                                                │ │
│ │ Last audit: 2 days ago | Last fix: 1 day ago  │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ 30-DAY SCORE TREND ──────────────────────────┐ │
│ │ (Simple line chart, no gradients)             │ │
│ │ +15 pts ↑ (30-day gain)                       │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ PRIORITY FIXES ──────────────────────────────┐ │
│ │ 1. [CRITICAL] Missing product schema         │ │
│ │    Fix time: 30 min | Impact: +8 pts        │ │
│ │    [View Details] [Open in Score Fix]      │ │
│ │                                              │ │
│ │ 2. [HIGH] Shipping info not extractable     │ │
│ │    Fix time: 1h | Impact: +6 pts            │ │
│ │    [View Details] [Open in Score Fix]      │ │
│ │                                              │ │
│ │ 3. [MEDIUM] Alt text gaps on product images │ │
│ │    Fix time: 2h | Impact: +4 pts            │ │
│ │    [View Details] [Open in Score Fix]      │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ RECENT AUDITS ──────────────────────────────┐ │
│ │ URL             Date       Score  Fix Count  │ │
│ │ website.com     Apr 18     76    3 CRITICAL  │ │
│ │ www.site.com    Apr 16     68    5 CRITICAL  │ │
│ │ blog.site.com   Apr 14     82    1 MEDIUM   │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Key Changes:**
- No cards with blur/glass
- Stark contrast: orange for CTAs, white for text
- Actionable priority fixes with explicit impact
- 30-day trend right on dashboard
- No secondary information density overload

#### 2. `/app/analyze` — Run AI Visibility Audit
**Current State:** Input form + results display
**Redesign:**

```
┌────────────────────────────────────────────────────┐
│ RUN AI VISIBILITY AUDIT                            │
├────────────────────────────────────────────────────┤
│                                                    │
│ Enter URL to analyze for AI citation readiness    │
│                                                    │
│ [ https://www.example.com/product/item ]          │
│ ✓ URL is valid and public                         │
│                                                    │
│ [Analyze] [See Sample Report]                     │
│                                                    │
│ ─────────────────────────────────────────────────  │
│ Analysis runs: Schema validation + Extractability │
│              + Citation pattern matching           │
│              + Gap detection                       │
│              + Registry alignment                  │
│ ─────────────────────────────────────────────────  │
│                                                    │
└────────────────────────────────────────────────────┘
```

**During Analysis:**
```
┌────────────────────────────────────────────────────┐
│ ANALYZING: website.com/product                     │
│                                                    │
│ [✓] Schema validation (2s)                        │
│ [✓] Extractability (4s)                           │
│ [→] Citation tests (running 8s)                   │
│ [ ] Gap analysis (pending)                        │
│ [ ] Registry match (pending)                      │
│                                                    │
│ Estimated time remaining: 12s                     │
│                                                    │
│ Triple-check enabled: 3 models reviewing results  │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 3. `/app/reports` — Evidence Reports
**Current State:** List of audit reports
**Redesign:**

| URL | Overall | Evidence | Gaps | Technical | Registry | Last Run | Actions |
|-----|---------|----------|------|-----------|----------|----------|---------|
| site.com | **76** | 24/30 | 12/20 | 15/15 ✓ | 7/10 | 2 days | [View] [Fix] [Share] |
| blog.com | **82** | 28/30 | 18/20 | 15/15 ✓ | 9/10 | 5 days | [View] [Fix] [Share] |

**Report Detail Page:**
```
┌────────────────────────────────────────────────────┐
│ EVIDENCE REPORT: website.com                       │
│ Analyzed: Apr 18, 2026 @ 12:45 PM UTC            │
├────────────────────────────────────────────────────┤
│                                                    │
│ [Overview] [Evidence] [Gaps] [Fixes] [Registry]   │
│                                                    │
│ ┌─ VISIBILITY SCORE: 76/100 ──────────────────┐  │
│ │                                              │  │
│ │ Verified Evidence:     24/30 [████░░░░░░]  │  │
│ │ Attribution Gaps:      12/20 [░░░░░░░░░░]  │  │
│ │ Drift Signals:         18/25 [░░░░░░░░░░]  │  │
│ │ Technical SEO:         15/15 [██████████] ✓ │  │
│ │ Registry Alignment:    7/10  [░░░░░░░░░░]  │  │
│ │                                              │  │
│ │ ⓘ Without technical SEO: 61/100 (worse)    │  │
│ │ ⓘ With all fixes: 100/100 (roadmap)        │  │
│ │                                              │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ [Export PDF] [Share Link] [Snapshot] [Reanalyze] │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 4. `/app/score-fix` — Score Fix (Execution)
**Current State:** Blockers with recommendations
**Redesign:**

```
┌────────────────────────────────────────────────────┐
│ SCORE FIX — Execute Priority Remediations          │
│                                                    │
│ [←back to report] [Save progress] [Export tasks]  │
├────────────────────────────────────────────────────┤
│                                                    │
│ ✓ 2 FIXED (last 7 days)  ✗ 3 CRITICAL  ⚠ 2 HIGH │
│                                                    │
│ ┌─ [CRITICAL] Missing JSON-LD Product Schema ────┐ │
│ │                                                 │ │
│ │ Impact: +8 visibility points                  │ │
│ │ Effort: 30 minutes                            │ │
│ │ Status: Not started                           │ │
│ │                                                 │ │
│ │ ⓘ This site: ecommerce, needs product schema │ │
│ │   Check: https://schema.org/Product           │ │
│ │                                                 │ │
│ │ Implementation:                                │ │
│ │ [ ] Add @type: "Product"                      │ │
│ │ [ ] Add name, description, price fields       │ │
│ │ [ ] Add image, brandName, sku                 │ │
│ │ [ ] Test with Schema Validator tool           │ │
│ │ [ ] Re-run citation test after deploy         │ │
│ │                                                 │
│ │ Template: [Download] [Use Template]           │ │
│ │ Registry: This pattern improves citation by   │ │
│ │           +8 pts on average (based on 156     │ │
│ │           audits of similar sites)            │ │
│ │                                                 │ │
│ │ [View in Validator] [Mark Fixed] [Details]    │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ [HIGH] Missing shipping schema ──────────────┐ │
│ │ Impact: +6 pts | Effort: 45 min | Status: Not │ │
│ │ [View Details]                                │ │
│ └─────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ [MEDIUM] Alt text on 8 images ──────────────┐ │
│ │ Impact: +4 pts | Effort: 1h | Status: Not    │ │
│ │ [View Details]                                │ │
│ └─────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 5. `/app/analytics` — Score Analytics & Trends
**Current State:** Basic chart display
**Redesign:**

```
┌────────────────────────────────────────────────────┐
│ ANALYTICS — Score Movement & Lift                  │
│                                                    │
│ [30 days] [90 days] [All time]                    │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌─ 30-DAY MOVEMENT ─────────────────────────────┐ │
│ │ +35 points ↑ (61 → 76)                        │ │
│ │                                                │ │
│ │ [████░░░░░░] Apr 18 (76 pts)                 │ │
│ │ [███░░░░░░░] Apr 11 (72 pts)                 │ │
│ │ [██░░░░░░░░] Apr 4  (68 pts)                  │ │
│ │ [█░░░░░░░░░] Mar 28 (61 pts)                  │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ SCORE BREAKDOWN BY COMPONENT ────────────────┐ │
│ │                                                │ │
│ │ Verified Evidence:  +12 points (20 → 24)     │ │
│ │ [█████░░░░░░░░░] ↑ (4 new patterns)          │ │
│ │                                                │ │
│ │ Gaps:               +8 points (12 → 20)      │ │
│ │ [████░░░░░░░░░░] ↑ (2 new answer blocks)     │ │
│ │                                                │ │
│ │ Technical SEO:      0 points (15 → 15)       │ │
│ │ [██████████] → (no changes)                   │ │
│ │                                                │ │
│ │ Registry Alignment: +5 points (2 → 7)        │ │
│ │ [███░░░░░░░░░░░░] ↑ (5 new patterns)         │ │
│ │                                                │ │
│ │ Drift Signals:      +10 points (8 → 18)      │ │
│ │ [████████░░░░░░░] ↑ (3 stabilized)           │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ ACTIONS TAKEN (Last 30 Days) ───────────────┐ │
│ │ Apr 15: Deployed product schema JSON-LD     │ │
│ │ Result: +8 pts visibility gain ✓             │ │
│ │                                                │ │
│ │ Apr 12: Updated shipping info structure      │ │
│ │ Result: +6 pts gap reduction ✓               │ │
│ │                                                │ │
│ │ Apr 9: Built content cluster for "delivery" │ │
│ │ Result: +12 pts registry match ✓             │ │
│ │                                                │ │
│ │ [View All Actions]                            │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Tier 2: Evidence Surfaces (High Priority)

#### 6. `/app/evidence` — Evidence Registry (NEW)
Central hub for all verified patterns from system

```
┌────────────────────────────────────────────────────┐
│ EVIDENCE REGISTRY — Verified Patterns              │
│                                                    │
│ [Search patterns...] [Filters: type, impact]      │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌─ SCHEMA PATTERNS (shown: 15 of 156) ──────────┐ │
│ │                                                │ │
│ │ Product Schema – JSON-LD                      │ │
│ │ ├─ Cited in: 156 audits                      │ │
│ │ ├─ Citation rate: 89% (avg vs 62% without)   │ │
│ │ ├─ Avg impact: +8 points                      │ │
│ │ ├─ Last updated: 2 days ago                   │ │
│ │ └─ [View template] [Download] [See examples] │ │
│ │                                                │ │
│ │ Shipping Schema – Action/DeliveryMethod      │ │
│ │ ├─ Cited in: 98 audits                        │ │
│ │ ├─ Citation rate: 76% (critical for ecom)    │ │
│ │ ├─ Avg impact: +6 points                      │ │
│ │ ├─ Last updated: 4 days ago                   │ │
│ │ └─ [View template] [Download] [See examples] │ │
│ │                                                │ │
│ │ [Load more patterns...]                       │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ CONTENT STRUCTURE PATTERNS ──────────────────┐ │
│ │ (How content ranks highest with citations)    │ │
│ │                                                │ │
│ │ Entity-locked product comparison (3-column)   │ │
│ │ ├─ Cited in: 204 audits (highest frequency)   │ │
│ │ ├─ Citation rate: 94%                         │ │
│ │ ├─ Avg impact: +12 points                     │ │
│ │ └─ [View template] [Download] [See examples] │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 7. `/app/citations` — Citation Testing (Enhanced)
**Current:** Run tests, show results
**Redesign:** Integrate with CITE LEDGER ledger logging

```
┌────────────────────────────────────────────────────┐
│ CITATION TESTING — Verify Answer Engine Attribution│
│                                                    │
│ [Run New Test] [View All Results] [Export Log]    │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌─ Test Run: 2026-04-18 @ 14:30 ──────────────┐  │
│ │ Query Cluster: "Product Buying Guides"      │  │
│ │ Test count: 1,200 unique queries             │  │
│ │ Coverage: GPT4, Claude-3, Gemini             │  │
│ │                                               │  │
│ │ Results:                                      │  │
│ │ ✓ Citations found: 847/1200 (71%)           │  │
│ │ ⚠ Partial citations: 203/1200 (17%)         │  │
│ │ ✗ Not cited: 150/1200 (12%)                 │  │
│ │                                               │  │
│ │ CITE Ledger: Logged as verified evidence    │  │
│ │ [View ledger entry] [Analyze trends]        │  │
│ │                                               │  │
│ └────────────────────────────────────────────────┘  │
│                                                    │
│ ┌─ Citation Confidence by Model ────────────────┐  │
│ │ GPT-5 Nano:      78% (Primary)               │  │
│ │ Claude Haiku 4.5: 69% (Fallback)             │  │
│ │ Gemini 2 Flash:   72% (Tertiary)             │  │
│ │                                               │  │
│ │ Ledger note: Using triple-check protocol     │  │
│ │ [View details]                                │  │
│ │                                               │  │
│ └────────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Tier 3: Extension Pages (Medium Priority)

#### 8. `/app/prompt-intelligence` — Gaps & Prompts
**Redesign:** Show visual map of covered vs. uncovered prompts

```
┌────────────────────────────────────────────────────┐
│ PROMPT INTELLIGENCE — Answer Block Gap Analysis    │
│                                                    │
│ [Refresh] [Export gaps] [Build fixes]             │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌─ PROMPT COVERAGE MAP ─────────────────────────┐ │
│ │                                                │ │
│ │ ✓ Covered (showing in AI answers): 24        │ │
│ │ ✗ Gaps (missing from AI answers):   8        │ │
│ │ ? Untested (low-volume):             12      │ │
│ │                                                │ │
│ │ Coverage: 75% (industry avg: 62%)             │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ TOP 5 GAPS TO CLOSE ─────────────────────────┐ │
│ │                                                │ │
│ │ 1. "Compare [product] to competitors"         │ │
│ │    Search volume: 12K/mo (HIGH)               │ │
│ │    Your visibility: NOT APPEARING             │ │
│ │    Competitors: 7 sites showing               │ │
│ │    Recommendation: Build comparison table     │ │
│ │    Time: 4h | Impact: +15 citations/month    │ │
│ │    [Build fix] [View example]                 │ │
│ │                                                │ │
│ │ 2. "How to [action] with [product]"           │ │
│ │    Search volume: 8.5K/mo (HIGH)              │ │
│ │    Your visibility: PARTIAL (no schema)       │ │
│ │    Recommendation: Add instructional schema   │ │
│ │    Time: 2h | Impact: +8 citations/month     │ │
│ │    [Build fix] [View example]                 │ │
│ │                                                │ │
│ │ [View all 8 gaps...]                          │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### 9. `/app/answer-presence` — Brand in AI Answers
```
┌────────────────────────────────────────────────────┐
│ ANSWER PRESENCE — When Do AI Engines Cite You?     │
│                                                    │
│ [Run test] [Last 30 days] [All time]             │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌─ APPEARANCE RATE (Last 30 Days) ──────────────┐ │
│ │                                                │ │
│ │ GPT-4:       42% (down 5% from Mar)          │ │
│ │ Claude 3:    56% (up 12% from Mar)           │ │
│ │ Gemini 2:    51% (stable)                    │ │
│ │                                                │ │
│ │ Average: 50% (industry avg: 38%)              │ │
│ │ Status: STRONG → but GPT-4 declining         │ │
│ │                                                │ │
│ │ Recommendation: Fix GPT-4 compatibility       │ │
│ │ [View details] [Route to fixes]              │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ DISPLACEMENT (Who ranks instead of you?) ────┐ │
│ │                                                │ │
│ │ Competitor1.com: Appearing in 38% vs 42%    │ │
│ │ (You're ahead, but they're close)             │ │
│ │                                                │ │
│ │ Competitor2.com: Appearing in 28% vs 50%    │ │
│ │ (You're winning decisively)                   │ │
│ │                                                │ │
│ │ Competitor3.com: Appearing in 71% vs 42%    │ │
│ │ (They're displacing you — priority fix)      │ │
│ │                                                │ │
│ │ [View displacement analysis]                  │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## PART 5: Registry & Ledger Integration

### Data Model: Evidence Registry

```typescript
// Built incrementally from all audits
interface EvidenceRegistry {
  schemas: RegistryPattern[];          // JSON-LD patterns that work
  contentStructures: RegistryPattern[]; // Article/product formats that cite well
  entityAnchors: RegistryPattern[];     // Entity reference patterns
  citationSignals: RegistryPattern[];   // What triggers citations
  trustSignals: RegistryPattern[];      // Schema.org + WCAG patterns
}

// Each pattern ties back to evidence trail
interface EvidenceTrail {
  auditId: string;
  url: string;
  pattern: RegistryPattern;
  outcome: "cited" | "partial" | "not_cited";
  confidence: number;        // 0-100
  testModels: string[];      // Which models verified
  timestamp: Date;
  ledgerEntry: string;       // Link to CITE LEDGER
}
```

### Building Registry from Existing Audits

**Process:**
1. Scan all past audits for successful patterns (where citation rate > 90%)
2. Extract schema, structure, entity anchors
3. Cluster by pattern type + niche
4. Calculate impact (median score gain when present)
5. Store in `evidence_registry` table with versioning

**UI for Registry Building:**
→ New page: `/app/admin/registry-builder` (internal)
- Backfill from historical audits
- Mark patterns as "verified" or "experimental"
- Merge duplicates, resolve conflicts

### Ledger Logging Integration

**Every test result → CITE LEDGER entry**

```
┌──────────────────────────────────────┐
│ CITE LEDGER ENTRY                    │
├──────────────────────────────────────┤
│ ID: ledger-874392-c1                │
│ Type: citation-test                 │
│ Date: 2026-04-18T14:30:00Z          │
│ URL: website.com                    │
│ Query: "buy [product] online"       │
│ Model: gpt5-nano                    │
│ Result: cited                       │
│ Confidence: 0.87                    │
│ Evidence: snippet with URL visible  │
│ Pattern: product_buying_guide       │
│ Impact: +3 registry alignment       │
│ [View full entry]                   │
└──────────────────────────────────────┘
```

---

## PART 6: Analytics System Restructure

### New Analytics Architecture

**Visualization by Pipeline Stage:**

```
STAGE 1: AUDIT        STAGE 2: EVIDENCE      STAGE 3: GAPS
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Scans run    │  →   │ Patterns     │  →   │ Blockers     │
│ URLs crawled │      │ found        │      │ identified   │
│ Schemas      │      │ Confidence   │      │ Fixes mapped │
│ detected     │      │ Ledger hits  │      │ Success rate │
└──────────────┘      └──────────────┘      └──────────────┘
         ↓                   ↓                      ↓
    5 audits/mo      Avg: 45 patterns/audit  76% fix rate


STAGE 4: EXECUTION     STAGE 5: VERIFICATION
┌──────────────┐      ┌──────────────┐
│ Fixes        │  →   │ Re-audit     │
│ deployed     │      │ Score gain   │
│ Regression   │      │ Drift check  │
│ tests        │      │ Commitment   │
└──────────────┘      └──────────────┘
         ↓                   ↓
   3 fixes/month      Avg: +8 pts/fix
```

### Analytics Dashboard (`/app/analytics`)

**Monthly health card:**
```
┌─────────────────────────────────────────────────┐
│ PIPELINE HEALTH — This Month                    │
│                                                 │
│ Audits started:  12 (+20% vs last month)       │
│ Evidence found:  547 (+15% vs last month)      │
│ Gaps identified: 89 (-5% vs last month) ✓      │
│ Fixes deployed:  8  (+1 vs last month)         │
│ Avg score gain:  +6.2 pts per fix (+3%)        │
│                                                 │
│ Ledger entries:  2,340 (all logged)            │
│ Registry added:  12 new patterns               │
│                                                 │
│ Status: ACCELERATING (next month target: +15%) │
└─────────────────────────────────────────────────┘
```

---

## PART 7: Implementation Timeline

### Phase 1 (Week 1-2): Visual System + Core Pages
- [ ] Implement color/typography/spacing tokens
- [ ] Remove blur/glass artifacts
- [ ] Redesign `/app` dashboard
- [ ] Redesign `/app/analyze`
- [ ] Redesign `/app/reports`
- [ ] Redesign `/app/score-fix`

### Phase 2 (Week 3): Evidence & Analytics
- [ ] Create `/app/evidence` registry page
- [ ] Enhance `/app/analytics` with stage breakdowns
- [ ] Integrate CITE LEDGER logging in results
- [ ] Build registry backfill from audits

### Phase 3 (Week 4): Extension Pages
- [ ] Redesign `/app/prompt-intelligence`
- [ ] Redesign `/app/answer-presence`
- [ ] Redesign `/app/competitors`
- [ ] Redesign `/app/citations`

### Phase 4 (Week 5): Polish & Testing
- [ ] Eliminate all remaining transparency artifacts
- [ ] Verify all pages high-contrast
- [ ] A/B test execution clarity
- [ ] Final performance audit

---

## PART 8: Success Metrics

**Visual Appeal:**
- [ ] No elements using `bg-white/[...]` (glassmorphism)
- [ ] All text contrast ≥ 4.5:1 (WCAG AA)
- [ ] All CTAs in orange-400, clickable + clear
- [ ] Page load: <1.5s (no performance regression)

**Evidence & Registry:**
- [ ] 100+ patterns in evidence registry
- [ ] Every audit result logged to CITE LEDGER
- [ ] Registry patterns >= 80% accuracy (verified by 2+ test models)
- [ ] `/app/evidence` showsall patterns with live usage stats

**Technical SEO Visibility:**
- [ ] Score broken into 5 components (visible on every page)
- [ ] Technical SEO shown separately with pass/fail indicators
- [ ] Impact of SEO gaps shown numerically on dashboard

**User Execution:**
- [ ] 90% of audit→fix flow completed in <5 actions
- [ ] Score Fix average completion time < 2 hours per blocker
- [ ] Analytics trend clear at-a-glance (no scrolling needed)

**Architecture:**
- [ ] Zero route crashes after full rebuild
- [ ] All pages use routeIntelligence config (no hardcoded labels)
- [ ] 255+ prerendered pages build without timeout

