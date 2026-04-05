"""AiVIS Deep Analysis Engine - FastAPI microservice.

Provides NLP-powered content analysis, cryptographic evidence ledger,
enhanced document parsing, and content fingerprinting.

Called from the Node.js backend via HTTP. Optional - Node degrades
gracefully if this service is unavailable.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .nlp_analyzer import NLPAnalyzer
from .evidence_ledger import EvidenceLedger
from .document_parser import DocumentParser
from .content_fingerprint import ContentFingerprinter

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AiVIS Deep Analysis Engine",
    version="1.0.0",
    docs_url="/docs" if os.getenv("PYTHON_ENV") != "production" else None,
    redoc_url=None,
)

# Only allow the Node backend to call us
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST"],
    allow_headers=["Content-Type", "X-Internal-Key"],
)

logger = logging.getLogger("aivis.python")

# Shared service instances
nlp = NLPAnalyzer()
ledger = EvidenceLedger()
doc_parser = DocumentParser()
fingerprinter = ContentFingerprinter()


# ---------------------------------------------------------------------------
# Auth - simple shared-secret between Node and Python
# ---------------------------------------------------------------------------

INTERNAL_KEY = os.getenv("PYTHON_INTERNAL_KEY", "")


def _check_key(key: str | None) -> None:
    """Validate internal API key if configured."""
    if INTERNAL_KEY and key != INTERNAL_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal key")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class AnalyzeContentRequest(BaseModel):
    """Deep NLP analysis of page content."""
    url: str
    html: str = ""
    text: str = ""
    title: str = ""
    meta_description: str = ""
    headings: list[str] = Field(default_factory=list)
    json_ld_blocks: list[str] = Field(default_factory=list)
    internal_key: str | None = None


class DocumentParseRequest(BaseModel):
    """Parse an uploaded document (PDF, DOCX, etc.)."""
    filename: str
    content_base64: str
    mime_type: str
    internal_key: str | None = None


class EvidenceLedgerRequest(BaseModel):
    """Record an audit evidence entry in the cryptographic ledger."""
    audit_id: str
    url: str
    evidence_entries: list[dict[str, Any]]
    internal_key: str | None = None


class FingerprintRequest(BaseModel):
    """Generate content fingerprint for deduplication."""
    text: str
    url: str = ""
    internal_key: str | None = None


class FingerprintCompareRequest(BaseModel):
    """Compare two content fingerprints for similarity."""
    fingerprint_a: str
    fingerprint_b: str
    internal_key: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Health check - Node backend polls this to know if Python is up."""
    return {
        "status": "ok",
        "service": "aivis-deep-analysis",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "nlp_ready": nlp.is_ready(),
    }


@app.post("/analyze/content")
async def analyze_content(req: AnalyzeContentRequest):
    """Deep NLP analysis of scraped page content.

    Returns readability scores, entity extraction, semantic density,
    content quality metrics, and evidence IDs.
    """
    _check_key(req.internal_key)

    start = time.monotonic()

    # Use text directly if provided, otherwise extract from HTML
    text = req.text
    if not text and req.html:
        text = nlp.extract_text_from_html(req.html)

    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Insufficient content for analysis")

    analysis = nlp.analyze(
        text=text,
        url=req.url,
        title=req.title,
        meta_description=req.meta_description,
        headings=req.headings,
        json_ld_blocks=req.json_ld_blocks,
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)
    analysis["processing_time_ms"] = elapsed_ms

    return analysis


@app.post("/analyze/document")
async def analyze_document(req: DocumentParseRequest):
    """Parse and analyze an uploaded document.

    Supports PDF, DOCX, HTML, Markdown, and plain text.
    Returns extracted text, structure, and NLP analysis.
    """
    _check_key(req.internal_key)

    start = time.monotonic()

    parsed = doc_parser.parse(
        filename=req.filename,
        content_base64=req.content_base64,
        mime_type=req.mime_type,
    )

    # Run NLP on extracted text
    if parsed.get("text") and len(parsed["text"].strip()) >= 50:
        analysis = nlp.analyze(
            text=parsed["text"],
            url=f"upload://{req.filename}",
            title=parsed.get("title", ""),
            meta_description="",
            headings=parsed.get("headings", []),
            json_ld_blocks=[],
        )
        parsed["nlp_analysis"] = analysis

    elapsed_ms = int((time.monotonic() - start) * 1000)
    parsed["processing_time_ms"] = elapsed_ms

    return parsed


@app.post("/evidence/record")
async def record_evidence(req: EvidenceLedgerRequest):
    """Record audit evidence entries in the cryptographic ledger.

    Each entry gets a SHA-256 hash chained to the previous,
    creating an immutable, verifiable audit trail.
    """
    _check_key(req.internal_key)

    result = ledger.record(
        audit_id=req.audit_id,
        url=req.url,
        evidence_entries=req.evidence_entries,
    )

    return result


@app.post("/evidence/verify")
async def verify_evidence(req: EvidenceLedgerRequest):
    """Verify integrity of an evidence chain."""
    _check_key(req.internal_key)

    verification = ledger.verify(
        audit_id=req.audit_id,
        url=req.url,
        evidence_entries=req.evidence_entries,
    )

    return verification


@app.post("/fingerprint/generate")
async def generate_fingerprint(req: FingerprintRequest):
    """Generate a SimHash content fingerprint for deduplication."""
    _check_key(req.internal_key)

    fp = fingerprinter.generate(text=req.text, url=req.url)
    return fp


@app.post("/fingerprint/compare")
async def compare_fingerprints(req: FingerprintCompareRequest):
    """Compare two fingerprints for content similarity."""
    _check_key(req.internal_key)

    result = fingerprinter.compare(req.fingerprint_a, req.fingerprint_b)
    return result
