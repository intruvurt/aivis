# UI/UX Overhaul — Glassmorphism Removal & Implementation Schedule

## Status: CRITICAL CLEANUP PHASE

**Date:** April 18, 2026  
**Scope:** Remove glassmorphic effects (bg-white/[...], backdrop-blur, mix-blend-mode) across entire codebase and replace with solid, high-contrast design system.

---

## Phase 1: HIGH-IMPACT COMPONENTS (This Week)

### Priority 1: ComprehensiveAnalysis.tsx (40+ instances)
**Impact:** Core reporting page, user sees this immediately after first audit  
**Current Issues:**
- Heavy use of `bg-white/[0.05]` in cards and borders
- Multiple `backdrop-blur` effects
- Layering with low contrast  

**Fix:**
- Replace all `bg-white/[0.05]` with `bg-slate-800` (COLORS.bg.secondary)
- Remove all `backdrop-blur-sm/md/lg`
- Use solid borders: `border-slate-700` (COLORS.border.default)
- Rewrite using new `ComprehensiveScoreDisplay` component

**Estimated Time:** 2-3 hours  
**Test:** Verify 5-score breakdown displays correctly, all metrics visible without scroll

---

### Priority 2: AppShell.tsx + AppTopBar.tsx
**Impact:** Global layout, affects every single page  
**Current Issues:**
- Overlay with glassmorphism
- TopBar navigation blurred background

**Fix:**
- Replace sidebar overlay bg with solid COLORS.bg.primary  
- TopBar: solid bg-slate-950, no blur  
- Proper contrast for icons and text

**Estimated Time:** 1 hour  
**Test:** All routes render, no visual lag, mobile responsive

---

### Priority 3: AppPageFrame.tsx + Major Card Components
**Impact:** Page containers, outer layout  

**Files:**
- AdvancedFeaturesPanel.tsx
- AuditReportCard.tsx
- AuditDetails.tsx
- CardUI components

**Fix:** Replace all panel backdrop effects with solid `COLORS.bg.*`  
**Estimated Time:** 1.5 hours

---

## Phase 2: MEDIUM-IMPACT PAGES (Mid-Week)

### Priority 4: Views (Dashboard, Reports, Analytics)
**Files:**
- Views/Dashboard.tsx
- Views/ReportsPage.tsx
- Views/AnalyticsPage.tsx
- Views/KeywordsPage.tsx
- Views/CompetitorsPage.tsx

**Fix:** Rewrite using new component library + solid colors  
**Estimated Time:** 4-5 hours total

---

### Priority 5: Info Panels & Modals
**Files:**
- FAQPanel.tsx
- InfoPanels/*.tsx
- Modal overlays
- Drawer components

**Fix:** Solid overlays, proper z-index layering, no blend modes  
**Estimated Time:** 2 hours

---

## Phase 3: POLISH (Late Week)

### Priority 6: Remaining Components
- Charts/Graphs (remove blur overlays)
- Tooltips
- Badges
- Status indicators

**Estimated Time:** 2-3 hours

---

## Replacement Mapping (Quick Reference)

| Old (Remove) | New (Use) | Reason |
|---|---|---|
| `bg-white/[0.05]` | `bg-slate-800` | Solid surface |
| `bg-white/[0.1]` | `bg-slate-700` | Solid surface |
| `bg-white/[0.2]` | `bg-slate-600` | Solid surface |
| `backdrop-blur-sm` | (remove) | No blur |
| `backdrop-blur-md` | (remove) | No blur |
| `backdrop-blur-lg` | (remove) | No blur |
| `mix-blend-mode: multiply` | (remove) | Solid rendering |
| `mix-blend-mode: overlay` | (remove) | Solid rendering |
| Transparent shadows | `shadow-sm` from designSystem | Solid shadow |

---

## Build & Verification Checklist

After each phase:
- [ ] Run `npm.cmd run build` (client) — must complete with zero errors
- [ ] Verify no console errors in browser dev tools
- [ ] Test on mobile (iOS Safari, Chrome)
- [ ] Verify contrast ratio ≥ 4.5:1 (WCAG AA) on all text
- [ ] Screenshot each page and compare visual before/after

---

## Files to Skip (Already Clean)

- Design system files (just created)
- New component library (ComprehensiveScoreDisplay.tsx)
- Public/static resources
- Test files

---

## Testing After Cleanup

### Visual Regression Tests
1. Take screenshots of all pages before
2. Implement changes
3. Take screenshots of all pages after
4. Compare for unexpected changes

### Functional Tests
1. [ ] Audit run flow works end-to-end
2. [ ] Reports display all 5 score metrics  
3. [ ] Evidence cards all visible
4. [ ] Blockers can be clicked/expanded
5. [ ] No performance degradation
6. [ ] Responsive on all breakpoints

### Accessibility Audit
1. [ ] All text passes WCAG AA contrast (4.5:1)
2. [ ] Focus indicators are visible (orange ring)
3. [ ] Keyboard navigation works
4. [ ] Screen reader friendly

---

## Success Criteria

✅ **Week 1 End:**
- All glassmorphic artifacts removed
- Core pages (Dashboard, Reports, Analyze) redesigned with new components
- No blur or glass effects visible anywhere
- All colors use solid values from design system
- Build passes with zero errors
- 255+ prerendered pages generate without issue

✅ **Visual:**
- Sharp, efficient, high-contrast appearance
- Matches SEMrush/HubSpot/Ahrefs design standards
- No performance degradation from current build

✅ **Evidence/Registry Integration:**
- 5-part score visible on every analysis page
- Technical SEO shown separately
- Evidence cards include registry match info
- Blockers show pattern frequency from registry

---

## Command Quick Reference

```bash
# Build client (watch for errors)
cd client
npm.cmd run build

# Type check both layers
npm.cmd --prefix client run typecheck
npm.cmd --prefix server run typecheck

# View current glassmorphism artifacts
node scripts/find-glassmorphism.js
```

---

## Progress Tracking

**Status: STARTING**

- [x] Design system created
- [ ] Phase 1 started
- [ ] Phase 1 complete
- [ ] Phase 2 started
- [ ] Phase 2 complete
- [ ] Phase 3 started
- [ ] Phase 3 complete
- [ ] Full testing pass
- [ ] Launch ready
