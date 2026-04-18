# AiVIS.biz Deep Analysis Engine (Python)

FastAPI microservice providing NLP-powered content analysis, cryptographic evidence ledger, enhanced document parsing, and content fingerprinting.

## Architecture

The Python service runs alongside the Node.js backend as an **optional** microservice. If unavailable, the Node pipeline continues without deep analysis (graceful degradation).

```text
                ┌──────────────┐
  Browser ───▶  │  Node API    │───▶ AI providers (OpenRouter)
                │  :3001       │
                │              │───▶ PostgreSQL
                │              │
                │              │───▶ Python Deep Analysis Engine
                └──────────────┘     :3002 (optional)
```

## Services

| Endpoint | Purpose |
| -------- | ------- |
| `GET /health` | Health check (Node polls this) |
| `POST /analyze/content` | NLP analysis: readability, entities, semantic density, AI citability |
| `POST /analyze/document` | Parse + analyze uploaded PDF/DOCX/HTML/Markdown |
| `POST /evidence/record` | Record evidence in SHA-256 hash-chained ledger |
| `POST /evidence/verify` | Verify integrity of evidence chain |
| `POST /fingerprint/generate` | SimHash content fingerprint for dedup |
| `POST /fingerprint/compare` | Compare fingerprints (Hamming distance) |

## Current state

This service is a real implementation and not a placeholder stub. The main modules currently provide:

- spaCy and textstat based NLP analysis
- SHA-256 evidence ledger recording
- PDF, DOCX, HTML, Markdown, and text parsing
- SimHash-style content fingerprinting

Current limitation: the default NLP setup is English-first because the documented spaCy model is `en_core_web_sm`. The broader platform already supports locale-aware citation verification, but the deep NLP layer is not yet equally multilingual.

Another important nuance: evidence verification is real, but it is currently recomputation-based. It is not yet the same as a fully externalized persisted chain audit with independent historical proof.

## Setup

```bash
# From workspace root
cd python

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Linux/Mac)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Run (development)
python -m python.run
# OR from python/ directory:
uvicorn app:app --reload --port 3002
```

## Environment Variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PYTHON_PORT` | `3002` | Service port |
| `PYTHON_HOST` | `127.0.0.1` | Bind address |
| `PYTHON_ENV` | `development` | `production` disables docs |
| `PYTHON_INTERNAL_KEY` | (empty) | Shared secret with Node backend |
| `ALLOWED_ORIGINS` | `http://localhost:3001` | Comma-separated CORS origins |

## Node Integration

The Node server calls Python via `server/src/services/deepAnalysisClient.ts`:

- Health checking (cached 60s)
- Deep NLP content analysis (runs as background enrichment after audit)
- Evidence ledger recording (cryptographic hash chain)
- Content fingerprinting (SimHash for dedup)
- Document parsing for upload flow

If Python is unavailable, all calls return `null` and the audit proceeds normally.

## Smoke coverage reality

This repository has real platform smoke scripts, but there is not yet a clearly documented full smoke path for all Python endpoints. Treat this service as production-capable but not yet covered by comprehensive end-to-end smoke automation.

## Production Deployment

On Render, add a second service:

1. **Build Command**: `cd python && pip install -r requirements.txt && python -m spacy download en_core_web_sm`
2. **Start Command**: `cd python && uvicorn app:app --host 0.0.0.0 --port $PORT`
3. Set `PYTHON_SERVICE_URL` in the Node service's env to this service's internal URL
4. Set matching `PYTHON_INTERNAL_KEY` on both services
