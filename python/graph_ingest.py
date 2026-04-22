"""Graph ingestion endpoint for AiVIS knowledge layer.

Receives raw HTML/text from the Node orchestrator and returns:
- Semantic chunks with embeddings
- Resolved entity candidates (by name, not UUID — Node owns DB writes)
- Extracted claims per chunk (SPO triples with weights)

Node side handles all DB writes (entities, claims, clusters, edges).
This layer handles only compute: parsing → chunking → embedding → extraction.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("aivis.graph_ingest")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
EMBEDDING_DIM = 768  # matches schema (text-embedding-3-small supports truncation)

CHUNK_SIZE_WORDS = 120
CHUNK_OVERLAP_WORDS = 20

# Predicates to attempt extraction for (extensible)
EXTRACTABLE_PREDICATES: list[tuple[str, str]] = [
    # (predicate_key, description_for_prompt)
    ("type", "what type/category of thing is this"),
    ("description", "a short description of the subject"),
    ("foundedYear", "year the entity was founded or established"),
    ("headquarters", "city or country where the entity is based"),
    ("founderName", "name of the person who founded it"),
    ("ceoName", "current CEO or leader"),
    ("primaryProduct", "main product or service offered"),
]

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class IngestRequest(BaseModel):
    scan_id: str
    url: str
    html: str = ""
    text: str = ""
    model_name: str = "graph-ingest-v1"
    internal_key: str | None = None


class ExtractedEntity(BaseModel):
    name: str
    type: str  # org | person | product | concept
    embedding: list[float]
    source_chunk_index: int


class ExtractedClaim(BaseModel):
    subject_name: str        # entity name (Node resolves to UUID)
    predicate: str
    object_value: str
    confidence: float        # 0.0 – 1.0
    source_url: str
    chunk_index: int
    extraction_method: str
    prompt_hash: str


class IngestionChunk(BaseModel):
    index: int
    text: str
    embedding: list[float]


class IngestResponse(BaseModel):
    scan_id: str
    chunks: list[IngestionChunk]
    entities: list[ExtractedEntity]
    claims: list[ExtractedClaim]
    model_used: str
    total_chunks: int
    total_entities: int
    total_claims: int


# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Call OpenAI embeddings API. Falls back to deterministic hash-based vectors."""
    if not OPENAI_KEY:
        return [_hash_embed(t) for t in texts]

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{OPENAI_BASE_URL}/embeddings",
                headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                json={"model": OPENAI_EMBEDDING_MODEL, "input": texts, "dimensions": EMBEDDING_DIM},
            )
        if resp.status_code != 200:
            logger.warning("Embedding API error %s — using fallback", resp.status_code)
            return [_hash_embed(t) for t in texts]

        data = resp.json()["data"]
        # API returns them in order
        return [item["embedding"] for item in sorted(data, key=lambda x: x["index"])]
    except Exception as exc:
        logger.warning("Embedding request failed: %s — using fallback", exc)
        return [_hash_embed(t) for t in texts]


def _hash_embed(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Deterministic hash-based embedding (zero-cost fallback)."""
    tokens = re.sub(r"[^a-z0-9 ]", "", text.lower()).split()
    vec = [0.0] * dim
    if not tokens:
        return vec
    for token in tokens:
        digest = hashlib.sha256(token.encode()).digest()
        for i, byte in enumerate(digest):
            bucket = byte % dim
            sign = 1 if digest[(i + 11) % len(digest)] % 2 == 0 else -1
            vec[bucket] += sign * (byte / 255.0 + 0.1)
    norm = sum(v * v for v in vec) ** 0.5
    if norm < 1e-9:
        return vec
    return [round(v / norm, 6) for v in vec]


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------


def _extract_text(html: str, text: str) -> str:
    """Return clean text — prefer provided text, fall back to HTML strip."""
    if text.strip():
        return re.sub(r"\s+", " ", text).strip()
    # Lightweight HTML strip (no BeautifulSoup dependency here)
    stripped = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
    stripped = re.sub(r"<[^>]+>", " ", stripped)
    stripped = re.sub(r"&[a-z]+;", " ", stripped)
    return re.sub(r"\s+", " ", stripped).strip()


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk_words = words[i : i + CHUNK_SIZE_WORDS]
        chunks.append(" ".join(chunk_words))
        if i + CHUNK_SIZE_WORDS >= len(words):
            break
        i += CHUNK_SIZE_WORDS - CHUNK_OVERLAP_WORDS
    return chunks


# ---------------------------------------------------------------------------
# NLP entity + claim extraction (regex heuristics — no LLM dependency)
# Uses spaCy if available, degrades gracefully without it.
# ---------------------------------------------------------------------------

_ENTITY_TYPE_MAP = {
    "ORG": "org",
    "PERSON": "person",
    "PRODUCT": "product",
    "GPE": "concept",
    "LOC": "concept",
    "EVENT": "concept",
    "WORK_OF_ART": "concept",
    "TECH": "product",
}

_PREDICATE_PATTERNS: list[tuple[str, str, re.Pattern[str]]] = [
    # (predicate, confidence, pattern)
    ("foundedYear", "founded in", re.compile(r"founded(?:\s+in)?\s+(\d{4})", re.IGNORECASE)),
    ("headquarters", "based in", re.compile(r"(?:based|headquartered|located)\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", re.IGNORECASE)),
    ("type", "is a", re.compile(r"\bais?\b.*?\b(platform|tool|engine|system|service|startup|company|framework|api)\b", re.IGNORECASE)),
    ("founderName", "founded by", re.compile(r"founded by\s+([A-Z][a-z]+ [A-Z][a-z]+)", re.IGNORECASE)),
    ("ceoName", "ceo is", re.compile(r"(?:ceo|chief executive)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)", re.IGNORECASE)),
    ("employeeCount", "employees", re.compile(r"(\d[\d,]+)\s+employees", re.IGNORECASE)),
]


def _extract_entities_from_chunk(
    chunk: str,
    chunk_index: int,
    embedding: list[float],
) -> list[ExtractedEntity]:
    """Extract named entities from a chunk using spaCy (or regex fallback)."""
    results: list[ExtractedEntity] = []
    try:
        import spacy  # noqa: PLC0415

        nlp = _get_spacy_model()
        if nlp:
            doc = nlp(chunk[:5000])  # cap length
            seen: set[str] = set()
            for ent in doc.ents:
                name = ent.text.strip()
                if len(name) < 2 or name.lower() in seen:
                    continue
                seen.add(name.lower())
                entity_type = _ENTITY_TYPE_MAP.get(ent.label_, "concept")
                results.append(
                    ExtractedEntity(
                        name=name,
                        type=entity_type,
                        embedding=embedding,  # reuse chunk embedding as proxy
                        source_chunk_index=chunk_index,
                    )
                )
    except Exception:
        # Regex fallback: capitalize-word pairs likely to be proper nouns
        for match in re.finditer(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b", chunk):
            name = match.group(1).strip()
            if len(name) < 3:
                continue
            results.append(
                ExtractedEntity(
                    name=name,
                    type="concept",
                    embedding=embedding,
                    source_chunk_index=chunk_index,
                )
            )
    return results[:20]  # cap per chunk


_spacy_model: Any = None


def _get_spacy_model() -> Any:
    global _spacy_model
    if _spacy_model is None:
        try:
            import spacy  # noqa: PLC0415

            try:
                _spacy_model = spacy.load("en_core_web_sm")
            except OSError:
                from spacy.cli import download  # noqa: PLC0415

                download("en_core_web_sm")
                _spacy_model = spacy.load("en_core_web_sm")
        except Exception:
            _spacy_model = False  # mark as unavailable
    return _spacy_model if _spacy_model is not False else None


def _extract_claims_from_chunk(
    chunk: str,
    chunk_index: int,
    source_url: str,
    entities: list[ExtractedEntity],
    model_name: str,
) -> list[ExtractedClaim]:
    """Extract SPO claims from a chunk using regex patterns."""
    claims: list[ExtractedClaim] = []

    # Use the first entity in this chunk as the subject (best heuristic without LLM)
    chunk_entities = [e for e in entities if e.source_chunk_index == chunk_index]
    subject_name = chunk_entities[0].name if chunk_entities else "unknown"

    for predicate, _desc, pattern in _PREDICATE_PATTERNS:
        match = pattern.search(chunk)
        if not match:
            continue
        object_value = match.group(1).strip()
        if not object_value:
            continue

        prompt_input = f"{predicate}:{chunk[:200]}"
        prompt_hash = hashlib.sha256(prompt_input.encode()).hexdigest()[:16]

        claims.append(
            ExtractedClaim(
                subject_name=subject_name,
                predicate=predicate,
                object_value=object_value,
                confidence=0.65,  # regex-extracted claims get moderate confidence
                source_url=source_url,
                chunk_index=chunk_index,
                extraction_method="regex-pattern",
                prompt_hash=prompt_hash,
            )
        )

    return claims


# ---------------------------------------------------------------------------
# Main ingest handler — called from app.py router
# ---------------------------------------------------------------------------


async def handle_ingest(req: IngestRequest) -> IngestResponse:
    """Full ingestion pipeline: text → chunks → embeddings → entities → claims."""
    # 1. Extract + clean text
    clean_text = _extract_text(req.html, req.text)
    if not clean_text:
        raise HTTPException(status_code=422, detail="No extractable text in request")

    # 2. Chunk
    raw_chunks = _chunk_text(clean_text)
    if not raw_chunks:
        raise HTTPException(status_code=422, detail="Text produced no chunks")

    # 3. Embed all chunks in a single API call
    embeddings = await _embed_texts(raw_chunks)

    chunks = [
        IngestionChunk(index=i, text=t, embedding=embeddings[i])
        for i, t in enumerate(raw_chunks)
    ]

    # 4. Entity extraction per chunk
    all_entities: list[ExtractedEntity] = []
    seen_names: set[str] = set()
    for chunk in chunks:
        for ent in _extract_entities_from_chunk(chunk.text, chunk.index, chunk.embedding):
            key = ent.name.lower()
            if key not in seen_names:
                seen_names.add(key)
                all_entities.append(ent)

    # 5. Claim extraction per chunk
    all_claims: list[ExtractedClaim] = []
    for chunk in chunks:
        all_claims.extend(
            _extract_claims_from_chunk(
                chunk.text,
                chunk.index,
                req.url,
                all_entities,
                req.model_name,
            )
        )

    model_used = (
        OPENAI_EMBEDDING_MODEL if OPENAI_KEY else "hash-fallback"
    )

    return IngestResponse(
        scan_id=req.scan_id,
        chunks=chunks,
        entities=all_entities,
        claims=all_claims,
        model_used=model_used,
        total_chunks=len(chunks),
        total_entities=len(all_entities),
        total_claims=len(all_claims),
    )
