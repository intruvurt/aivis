# Hidden Execution Exchange Map

This map defines how AiVIS can run a behavior-shaped compute market where agents only see execution states.

## 1. External contract (unchanged)

Public API response should remain minimal:

- queued
- processing
- complete
- failed

No queue position, no priority score, no reputation fields.

## 2. Reputation decay design

Goal: old behavior loses influence so new sessions can recover or degrade quickly.

Recommended model:

- Store profile signals with updated_at timestamps.
- Apply exponential decay to each signal toward neutral baseline (0.5).
- Half-life defaults:
  - 6h for retry_frequency (fast reaction to instability)
  - 24h for request_stability and success_rate
  - 72h for avg_pipeline_quality (slower, quality inertia)

Formula:

- decayFactor = 0.5 ^ (elapsedMs / halfLifeMs)
- decayedSignal = (signal _ decayFactor) + (neutral _ (1 - decayFactor))

Result:

- Recent behavior dominates.
- Historical abuse fades.
- New agents do not stay penalized forever.

## 3. Latent priority engine

Internal-only score combines:

- urgency_weight
- decayed profile signals
- fairness correction
- bounded non-linear noise

Do not persist this score in user-facing tables.

Persist only:

- input telemetry
- execution outcomes
- immutable credit and execution ledgers

## 4. Exchange semantics (order-book analog)

Treat each capability as a venue:

- scorefix.run_pipeline
- audit.run
- citation.run

For each venue:

- capacity = active slots
- inflow = queued requests
- matching = latent priority routing + fairness correction

Equivalent to a hidden limit-order match where:

- demand: request volume
- supply: pool capacity
- price: replaced by latent priority

## 5. Autonomous compute stock exchange progression

Phase A: behavior-shaping queue

- Re-rank pending requests every 2-5 seconds.
- Apply fairness floor per tenant.

Phase B: cross-pool routing

- If preferred pool saturated, route to equivalent executor class with penalty budget.
- Keep responses state-only.

Phase C: portfolio scheduler

- Pipelines become composite orders (scan + cite + fix legs).
- Scheduler allocates compute budget per leg dynamically.

Phase D: exchange governance

- Add circuit breakers per pool.
- Add volatility guardrails when failure rate spikes.
- Add anti-correlation diversification across model backends.

## 6. Anti-gaming controls

Required controls:

- random dequeue jitter (small, bounded)
- fairness rebalance window
- shape-preserving noise in latent score
- periodic threshold rotation

Purpose:

- Prevent reverse-engineering of hidden ranking logic.

## 7. Ledger alignment

All execution outcomes should append immutable records:

- request received
- reservation created
- execution started
- execution completed/failed
- credits committed/refunded

The exchange may adapt behavior online, but truth remains auditable through ledgers.

## 8. Operational KPIs (internal only)

Track internally (do not expose to agents):

- median dequeue latency by pool
- retry storm index
- fairness drift by tenant
- execution quality delta by profile cohort
- refund ratio by failure class

These drive policy tuning without exposing exploitable signals.
