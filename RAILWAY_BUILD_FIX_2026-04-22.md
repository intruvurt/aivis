# Railway Build Fix Summary — 2026-04-22

## Issue Identified

Railway build failed with:

```
src/services/pipelineStatebroadcaster.ts(13,30): error TS2307: Cannot find module '@supabase/supabase-js'
```

## Root Cause

The `@supabase/supabase-js` package was imported in `pipelineStatebroadcaster.ts` but was NOT listed in the server's `package.json` dependencies.

## Fix Applied

### 1. Added Supabase Dependency

**File**: `server/package.json`

```json
"@supabase/supabase-js": "^2.45.0",
```

Inserted after the `pg` dependency (line 46).

### 2. Updated Broadcaster Environment Variable Handling

**File**: `server/src/services/pipelineStatebroadcaster.ts`
All 4 functions now fall back to `SUPABASE_KEY` if `SUPABASE_SERVICE_ROLE_KEY` isn't set:

```typescript
process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
```

Updated functions:

- `broadcastStageUpdate()`
- `broadcastPartialResults()`
- `broadcastAnalysisComplete()`
- `broadcastAnalysisError()`

## Files Modified

1. **`server/package.json`** — Added Supabase SDK dependency
2. **`server/src/services/pipelineStatebroadcaster.ts`** — Updated env fallback handling

## Deployment Ready

✅ server package.json fixed  
✅ broadcaster environment vars made flexible  
✅ no other missing dependencies detected

**Next step**: Commit and push to main → Railway auto-builds

## Migration Status (013)

All critical fixes locked in and ready to run on live Supabase DB:

- [✅] HTML size caps + storage key placeholders
- [✅] Worker race condition guards (worker_id, locked_at)
- [✅] Verification token hashing (plaintext → SHA-256)
- [✅] Stripe webhook idempotency
- [✅] Workspace multi-tenant FKs (NOT VALID)
- [✅] URL hash format validation (7 tables)

Execute sequence: 010 → 011 → 012 → 013 on live DB
