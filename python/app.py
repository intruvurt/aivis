"""AiVIS.biz Deep Analysis Engine - FastAPI microservice.

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
from .brag_validator import BragValidator

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AiVIS.biz Deep Analysis Engine",
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
brag_gate = BragValidator()


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


class OcrCrossCheckRequest(BaseModel):
    """Cross-check OCR-extracted text against scraped body content."""
    url: str
    scraped_text: str = ""
    ocr_texts: list[str] = Field(default_factory=list)
    scraped_word_count: int = 0
    ocr_word_count: int = 0
    internal_key: str | None = None


class BragValidateRequest(BaseModel):
    """BRAG Validation Gate — validate all findings against evidence."""
    audit_id: str
    url: str
    evidence_items: list[dict[str, Any]] = Field(default_factory=list)
    rule_results: list[dict[str, Any]] = Field(default_factory=list)
    ai_recommendations: list[dict[str, Any]] = Field(default_factory=list)
    scrape_summary: dict[str, Any] | None = None
    internal_key: str | None = None


class RawDocumentEngagement(BaseModel):
    likes: int = 0
    upvotes: int = 0
    comments: int = 0
    shares: int = 0


class RawDocumentEvent(BaseModel):
    docId: str
    url: str
    source: str
    text: str
    timestamp: int
    engagement: RawDocumentEngagement | None = None
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


# ---------------------------------------------------------------------------
# OCR Cross-Check — validates OCR-extracted image text against scraped body
# ---------------------------------------------------------------------------

@app.post("/analyze/ocr-crosscheck")
async def ocr_crosscheck(req: OcrCrossCheckRequest):
    """Cross-check OCR text against scraped body content.

    Returns evidence quality score (0–100) indicating how well
    the OCR data corroborates and extends the scraped content.
    Used by Signal+ tiers for dynamic fallback decisions.
    """
    _check_key(req.internal_key)

    start = time.monotonic()

    scraped_words = set(
        w.lower()
        for w in re.split(r"\s+", req.scraped_text)
        if len(w) > 2
    )
    scraped_count = len(scraped_words)

    # Combine all OCR text fragments
    combined_ocr = " ".join(req.ocr_texts)
    ocr_words = set(
        w.lower()
        for w in re.split(r"\s+", combined_ocr)
        if len(w) > 2
    )
    ocr_count = len(ocr_words)

    if ocr_count == 0:
        return {
            "url": req.url,
            "evidence_quality": 0,
            "overlap_ratio": 0.0,
            "unique_ocr_terms": 0,
            "scrape_coverage_ratio": 1.0,
            "recommendation": "no_ocr_content",
            "processing_time_ms": int((time.monotonic() - start) * 1000),
        }

    # How many OCR words overlap with scraped body
    overlap = scraped_words & ocr_words
    overlap_ratio = len(overlap) / ocr_count if ocr_count > 0 else 0.0

    # Unique content from OCR not in scrape
    unique_ocr = ocr_words - scraped_words
    unique_ocr_count = len(unique_ocr)

    # Scrape coverage: what fraction of expected content did the scrape capture?
    # If OCR found substantial unique content, scrape coverage is lower
    total_content_words = scraped_count + unique_ocr_count
    scrape_coverage_ratio = (
        scraped_count / total_content_words
        if total_content_words > 0
        else 1.0
    )

    # Evidence quality: how trustworthy is the OCR data?
    # High overlap = OCR confirms scraped content (good corroboration)
    # Meaningful unique words = OCR found content scrape missed
    evidence_quality = 0

    # Base: overlap quality (OCR confirms what scrape found)
    if overlap_ratio > 0.3:
        evidence_quality += 40  # Good corroboration
    elif overlap_ratio > 0.1:
        evidence_quality += 25
    else:
        evidence_quality += 10  # Low overlap — OCR may be noise

    # Bonus: unique meaningful content found by OCR
    if unique_ocr_count > 20:
        evidence_quality += 30
    elif unique_ocr_count > 10:
        evidence_quality += 20
    elif unique_ocr_count > 5:
        evidence_quality += 10

    # Bonus: OCR word volume relative to scrape
    if req.ocr_word_count > 50:
        evidence_quality += 15
    elif req.ocr_word_count > 20:
        evidence_quality += 10

    # Bonus: NLP quality check on OCR text (if substantial)
    if len(combined_ocr.strip()) >= 100 and nlp.is_ready():
        try:
            mini_analysis = nlp.analyze(
                text=combined_ocr[:5000],
                url=req.url,
                title="",
                meta_description="",
                headings=[],
                json_ld_blocks=[],
            )
            # Readability and entity signals boost quality
            if mini_analysis.get("readability", {}).get("flesch_reading_ease", 0) > 30:
                evidence_quality += 10
            if mini_analysis.get("entities", {}).get("total_entity_count", 0) > 0:
                evidence_quality += 5
        except Exception:
            pass  # NLP failure is non-fatal

    evidence_quality = min(100, evidence_quality)

    # Recommendation for dynamic fallback
    recommendation = "use_scrape"  # default
    if scrape_coverage_ratio < 0.6 and evidence_quality >= 85:
        recommendation = "use_python_payload"
    elif scrape_coverage_ratio < 0.6 and evidence_quality >= 60:
        recommendation = "augment_with_ocr"

    elapsed_ms = int((time.monotonic() - start) * 1000)

    return {
        "url": req.url,
        "evidence_quality": evidence_quality,
        "overlap_ratio": round(overlap_ratio, 3),
        "unique_ocr_terms": unique_ocr_count,
        "scrape_coverage_ratio": round(scrape_coverage_ratio, 3),
        "recommendation": recommendation,
        "processing_time_ms": elapsed_ms,
    }


# ---------------------------------------------------------------------------
# BRAG Validation Gate — single source of truth for scoring
# ---------------------------------------------------------------------------

@app.post("/validate/brag")
async def validate_brag(req: BragValidateRequest):
    """Run the BRAG validation gate over all findings.

    Every finding (AI-generated, rule-engine, or Python cross-check) must
    pass through this gate to earn a BRAG ID. Findings without evidence
    are rejected and suppressed from the user-facing response.

    Scoring contract:
      - 0 validated BRAG findings → score 100 (nothing is wrong)
      - Each validated finding reduces score by its severity weight
      - Score = max(0, 100 − Σ deductions)
    """
    _check_key(req.internal_key)

    start = time.monotonic()

    result = brag_gate.validate(
        audit_id=req.audit_id,
        url=req.url,
        evidence_items=req.evidence_items,
        rule_results=req.rule_results,
        ai_recommendations=req.ai_recommendations,
        scrape_summary=req.scrape_summary,
    )

    result["processing_time_ms"] = int((time.monotonic() - start) * 1000)

    return result


def _semantic_chunks(text: str, max_chunk_len: int = 700) -> list[str]:
    """Split text into stable semantic chunks using paragraph-first strategy."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    if not paragraphs:
        paragraphs = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        plen = len(paragraph)
        if current and current_len + plen > max_chunk_len:
            chunks.append("\n\n".join(current))
            current = [paragraph]
            current_len = plen
            continue
        current.append(paragraph)
        current_len += plen

    if current:
        chunks.append("\n\n".join(current))

    return chunks


def _tokenize(text: str) -> set[str]:
    return {t.lower() for t in re.findall(r"[a-zA-Z0-9_\-.]{3,}", text)}


def _jaccard_similarity(a: str, b: str) -> float:
    ta = _tokenize(a)
    tb = _tokenize(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


def _extract_entity_candidates(text: str, url: str) -> list[str]:
    host = ""
    try:
        host = url.split("//", 1)[-1].split("/", 1)[0].lower()
    except Exception:
        host = ""

    candidates: set[str] = set()
    if host:
        host_name = host.replace("www.", "")
        candidates.add(host_name)
        candidates.add(host_name.split(".")[0])

    # Lightweight named phrase heuristic.
    for phrase in re.findall(r"\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b", text[:4000]):
        if len(phrase) >= 4:
            candidates.add(phrase.lower())

    return [c for c in candidates if c]


def _classify_edge(explicit: bool, semantic: float) -> str | None:
    if explicit and semantic > 0.6:
        return "direct"
    if semantic > 0.82:
        return "semantic"
    if semantic > 0.75:
        return "paraphrase"
    return None


@app.post("/process/raw-document")
async def process_raw_document(req: RawDocumentEvent):
    """Process normalized ingestion events in the Python intelligence layer.

    This endpoint intentionally avoids crawling/fetching concerns and focuses on:
      1) semantic chunking
      2) entity candidate resolution
      3) citation edge detection
      4) score update payload generation
    """
    _check_key(req.internal_key)

    text = (req.text or "").strip()
    if len(text) < 20:
        raise HTTPException(status_code=400, detail="Insufficient text content")

    chunks = _semantic_chunks(text)
    entity_candidates = _extract_entity_candidates(text, req.url)

    edges: list[dict[str, Any]] = []
    updated_entities: set[str] = set()

    engagement_total = 0
    if req.engagement:
        engagement_total = (
            int(req.engagement.likes or 0)
            + int(req.engagement.upvotes or 0)
            + int(req.engagement.comments or 0)
            + int(req.engagement.shares or 0)
        )

    for idx, chunk in enumerate(chunks):
        chunk_id = f"{req.docId}:{idx}"
        for entity in entity_candidates:
            explicit = entity in chunk.lower()
            semantic = _jaccard_similarity(chunk, entity)
            edge_type = _classify_edge(explicit, semantic)
            if not edge_type:
                continue

            confidence = min(1.0, (0.3 if explicit else 0.0) + semantic)

            edges.append(
                {
                    "entityId": entity,
                    "chunkId": chunk_id,
                    "docId": req.docId,
                    "type": edge_type,
                    "similarity": round(semantic, 4),
                    "confidence": round(confidence, 4),
                    "sourceAuthority": 0.55,
                    "engagementScore": engagement_total,
                    "timestamp": req.timestamp,
                }
            )
            updated_entities.add(entity)

    return {
        "docId": req.docId,
        "edgesCreated": len(edges),
        "entitiesUpdated": sorted(updated_entities),
    }
