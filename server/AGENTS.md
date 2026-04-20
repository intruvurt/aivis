1. INPUT VALIDATION
   - sanitizeInput()
   - isSafeExternalUrl()
   - Zod validation

2. AUTHENTICATION
   - authRequired
   - resolve user identity + tier

3. USAGE ENFORCEMENT
   - usageGate
   - incrementUsage (pre-execution lock)

4. ENTITY EXTRACTION
   - scraper.ts
   - build entity graph

5. PARALLEL SIGNAL LAYER (FORK)
   MUST RUN CONCURRENTLY:
   - citationTester (CORE TRUTH ENGINE)
   - webSearch (DDG + Bing HTML)
   - duckDuckGoSearch (instant graph)
   - aiProviders (multi-model inference)
   - mentionTracker (external validation)
   - serpService (Alignment+ only)

6. CITATION RESOLUTION GATE
   - every AI claim must be:
     a) citation-backed OR
     b) labeled "uncited"
   - uncited claims are downgraded

7. LEDGER COMMIT (IMMUTABLE)
   - write citation records
   - assign scan_id
   - hash lock result

8. REGISTRY DERIVATION (READ-ONLY)
   - compute metrics ONLY from ledger
   - never accept external input mutation

9. RESPONSE ASSEMBLY
   - structured output
   - include traceability metadata
