"""NLP-powered content analysis using spaCy and textstat.

Provides:
- Readability scoring (Flesch-Kincaid, Gunning Fog, etc.)
- Named entity extraction (organizations, products, technologies)
- Semantic density metrics
- Content quality indicators
- BRAG evidence ID generation
"""

from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import Any

from bs4 import BeautifulSoup

# Lazy-load spaCy to avoid startup delay if not used
_nlp_model = None


def _get_spacy():
    global _nlp_model
    if _nlp_model is None:
        import spacy
        try:
            _nlp_model = spacy.load("en_core_web_sm")
        except OSError:
            # Model not installed — download it
            from spacy.cli import download
            download("en_core_web_sm")
            _nlp_model = spacy.load("en_core_web_sm")
    return _nlp_model


def _evidence_id(source: str, key: str) -> str:
    """Generate a deterministic evidence ID matching the BRAG convention."""
    digest = hashlib.sha256(f"{source}|{key}".encode("utf-8")).hexdigest()[:12]
    return f"ev-{source}-{digest}"


class NLPAnalyzer:
    """Deep NLP content analyzer."""

    def is_ready(self) -> bool:
        """Check if spaCy model is loaded."""
        try:
            _get_spacy()
            return True
        except Exception:
            return False

    def extract_text_from_html(self, html: str) -> str:
        """Extract visible text from HTML, stripping tags and scripts."""
        soup = BeautifulSoup(html, "lxml")

        # Remove non-visible elements
        for tag in soup(["script", "style", "noscript", "svg", "path"]):
            tag.decompose()

        text = soup.get_text(separator=" ", strip=True)
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def analyze(
        self,
        text: str,
        url: str,
        title: str = "",
        meta_description: str = "",
        headings: list[str] | None = None,
        json_ld_blocks: list[str] | None = None,
    ) -> dict[str, Any]:
        """Run full NLP analysis on content text.

        Returns a dict with readability, entities, quality metrics,
        and evidence entries.
        """
        headings = headings or []
        json_ld_blocks = json_ld_blocks or []

        result: dict[str, Any] = {
            "url": url,
            "analysis_type": "deep_nlp",
        }

        # --- Readability ---
        result["readability"] = self._readability_scores(text)

        # --- Entity extraction ---
        result["entities"] = self._extract_entities(text)

        # --- Semantic density ---
        result["semantic_density"] = self._semantic_density(text)

        # --- Content quality ---
        result["content_quality"] = self._content_quality(
            text, title, meta_description, headings
        )

        # --- Question coverage ---
        result["question_coverage"] = self._question_coverage(text)

        # --- Evidence entries ---
        result["evidence"] = self._generate_evidence(result, url)

        return result

    def _readability_scores(self, text: str) -> dict[str, Any]:
        """Compute readability metrics using textstat."""
        import textstat

        sentences = textstat.sentence_count(text)
        words = textstat.lexicon_count(text, removepunct=True)
        syllables = textstat.syllable_count(text)

        return {
            "flesch_reading_ease": round(textstat.flesch_reading_ease(text), 1),
            "flesch_kincaid_grade": round(textstat.flesch_kincaid_grade(text), 1),
            "gunning_fog": round(textstat.gunning_fog(text), 1),
            "coleman_liau": round(textstat.coleman_liau_index(text), 1),
            "automated_readability": round(
                textstat.automated_readability_index(text), 1
            ),
            "dale_chall": round(textstat.dale_chall_readability_score(text), 1),
            "sentence_count": sentences,
            "word_count": words,
            "syllable_count": syllables,
            "avg_sentence_length": round(words / max(sentences, 1), 1),
            "avg_syllables_per_word": round(syllables / max(words, 1), 2),
            "reading_level": self._reading_level(
                textstat.flesch_kincaid_grade(text)
            ),
        }

    @staticmethod
    def _reading_level(grade: float) -> str:
        if grade <= 6:
            return "easy"
        if grade <= 10:
            return "moderate"
        if grade <= 14:
            return "advanced"
        return "expert"

    def _extract_entities(self, text: str) -> dict[str, Any]:
        """Extract named entities using spaCy."""
        nlp_model = _get_spacy()

        # Process max 100k chars to stay fast
        doc = nlp_model(text[:100_000])

        entities_by_type: dict[str, list[str]] = {}
        for ent in doc.ents:
            label = ent.label_
            if label not in entities_by_type:
                entities_by_type[label] = []
            normalized = ent.text.strip()
            if normalized and normalized not in entities_by_type[label]:
                entities_by_type[label].append(normalized)

        # Key entity categories for AI visibility
        return {
            "organizations": entities_by_type.get("ORG", [])[:20],
            "products": entities_by_type.get("PRODUCT", [])[:20],
            "technologies": [
                e
                for label in ("PRODUCT", "ORG", "WORK_OF_ART")
                for e in entities_by_type.get(label, [])
                if self._looks_like_tech(e)
            ][:15],
            "people": entities_by_type.get("PERSON", [])[:15],
            "locations": entities_by_type.get("GPE", [])[:10],
            "total_entity_count": sum(
                len(v) for v in entities_by_type.values()
            ),
            "unique_entity_types": len(entities_by_type),
            "entity_density": round(
                len(doc.ents) / max(len(list(doc.sents)), 1), 2
            ),
        }

    @staticmethod
    def _looks_like_tech(text: str) -> bool:
        """Heuristic: does this entity look like a technology name?"""
        tech_patterns = [
            r"(?i)\b(api|sdk|ai|ml|nlp|css|html|json|xml|sql|http|react|vue|angular)\b",
            r"(?i)\b(python|java|node|typescript|javascript|rust|golang)\b",
            r"(?i)\b(docker|kubernetes|aws|azure|gcp|redis|postgres)\b",
            r"(?i)\b(tensorflow|pytorch|spacy|transformers|openai|claude)\b",
        ]
        return any(re.search(p, text) for p in tech_patterns)

    def _semantic_density(self, text: str) -> dict[str, Any]:
        """Measure semantic richness of content."""
        words = re.findall(r"\b[a-z]+\b", text.lower())
        total = len(words)
        if total == 0:
            return {"lexical_diversity": 0, "content_words_ratio": 0}

        unique = len(set(words))

        # Stop words (common function words)
        stop_words = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "shall", "can",
            "to", "of", "in", "for", "on", "with", "at", "by", "from",
            "as", "into", "through", "during", "before", "after", "above",
            "below", "between", "and", "but", "or", "nor", "not", "so",
            "yet", "both", "either", "neither", "each", "every", "all",
            "any", "few", "more", "most", "other", "some", "such", "no",
            "only", "own", "same", "than", "too", "very", "just", "it",
            "its", "this", "that", "these", "those", "i", "me", "my",
            "we", "our", "you", "your", "he", "him", "his", "she", "her",
            "they", "them", "their", "what", "which", "who", "whom",
        }
        content_words = [w for w in words if w not in stop_words]
        content_ratio = len(content_words) / total

        # Type-token ratio (TTR) — normalized for text length
        # Use root TTR to reduce length sensitivity
        root_ttr = unique / math.sqrt(total) if total > 0 else 0

        return {
            "lexical_diversity": round(unique / total, 3),
            "root_ttr": round(root_ttr, 2),
            "content_words_ratio": round(content_ratio, 3),
            "total_words": total,
            "unique_words": unique,
            "content_words": len(content_words),
            "density_grade": (
                "high" if content_ratio > 0.55
                else "moderate" if content_ratio > 0.45
                else "low"
            ),
        }

    def _content_quality(
        self,
        text: str,
        title: str,
        meta_description: str,
        headings: list[str],
    ) -> dict[str, Any]:
        """Assess content quality for AI citability."""
        words = text.split()
        word_count = len(words)

        # Sentence structure variety
        sentences = re.split(r"[.!?]+", text)
        sentence_lengths = [len(s.split()) for s in sentences if s.strip()]
        length_variety = (
            round(
                (max(sentence_lengths) - min(sentence_lengths))
                / max(max(sentence_lengths), 1),
                2,
            )
            if sentence_lengths
            else 0
        )

        # Topic coherence: check if title words appear in content
        title_words = set(re.findall(r"\b[a-z]+\b", title.lower())) - {
            "the", "a", "an", "is", "and", "or", "of", "in", "to", "for"
        }
        title_in_content = sum(
            1 for w in title_words if w in text.lower()
        )
        title_coherence = (
            round(title_in_content / max(len(title_words), 1), 2)
        )

        # Heading coverage: do headings preview content sections?
        heading_words = set()
        for h in headings:
            heading_words.update(re.findall(r"\b[a-z]+\b", h.lower()))
        heading_words -= {"the", "a", "an", "is", "and", "or", "of", "in", "to"}

        # Meta description relevance
        meta_words = set(re.findall(r"\b[a-z]+\b", meta_description.lower()))
        meta_words -= {"the", "a", "an", "is", "and", "or", "of", "in", "to", "for"}
        meta_overlap = sum(1 for w in meta_words if w in text.lower())
        meta_relevance = round(meta_overlap / max(len(meta_words), 1), 2)

        # Definition patterns (AI models love clear definitions)
        definition_patterns = len(
            re.findall(r"(?i)\b(is defined as|refers to|means that|is a|is the)\b", text)
        )

        # List/enumeration patterns
        list_patterns = len(re.findall(r"(?m)^\s*[-•*]\s+", text))

        return {
            "word_count": word_count,
            "sentence_count": len(sentence_lengths),
            "sentence_length_variety": length_variety,
            "title_coherence": title_coherence,
            "meta_relevance": meta_relevance,
            "heading_count": len(headings),
            "definition_patterns": definition_patterns,
            "list_patterns": list_patterns,
            "has_structured_content": definition_patterns > 0 or list_patterns > 2,
            "content_depth": (
                "comprehensive"
                if word_count > 2000 and definition_patterns > 2
                else "detailed" if word_count > 1000
                else "moderate" if word_count > 500
                else "thin"
            ),
            "ai_citability_signals": {
                "has_definitions": definition_patterns > 0,
                "has_lists": list_patterns > 2,
                "has_headings": len(headings) > 2,
                "good_readability": True,  # Filled later from readability grades
                "title_aligned": title_coherence > 0.5,
                "meta_aligned": meta_relevance > 0.5,
            },
        }

    def _question_coverage(self, text: str) -> dict[str, Any]:
        """Detect question-answer patterns that AI models prefer to cite."""
        # Find questions in content
        questions = re.findall(r"[^.!?]*\?", text)
        questions = [q.strip() for q in questions if len(q.strip()) > 10]

        # Common AI query patterns
        query_patterns = {
            "what_is": len(re.findall(r"(?i)\bwhat is\b", text)),
            "how_to": len(re.findall(r"(?i)\bhow to\b", text)),
            "why": len(re.findall(r"(?i)\bwhy\b.*\?", text)),
            "comparison": len(
                re.findall(r"(?i)\b(vs|versus|compared to|difference between)\b", text)
            ),
            "best_practices": len(
                re.findall(r"(?i)\b(best practice|recommended|tip|guideline)\b", text)
            ),
            "step_by_step": len(
                re.findall(r"(?i)\b(step \d|first|second|third|finally)\b", text)
            ),
        }

        total_patterns = sum(query_patterns.values())

        return {
            "questions_found": len(questions),
            "question_samples": questions[:5],
            "query_pattern_counts": query_patterns,
            "total_query_patterns": total_patterns,
            "ai_query_readiness": (
                "high" if total_patterns > 10
                else "moderate" if total_patterns > 4
                else "low"
            ),
        }

    def _generate_evidence(
        self, analysis: dict[str, Any], url: str
    ) -> list[dict[str, Any]]:
        """Generate BRAG evidence entries from analysis results."""
        evidence = []

        # Readability evidence
        r = analysis.get("readability", {})
        if r.get("flesch_reading_ease") is not None:
            score = r["flesch_reading_ease"]
            evidence.append({
                "id": _evidence_id("nlp", "readability_flesch"),
                "source": "nlp_analysis",
                "key": "readability_flesch",
                "value": score,
                "verdict": (
                    "pass" if score >= 30 else "warn" if score >= 20 else "fail"
                ),
                "detail": f"Flesch Reading Ease: {score} ({r.get('reading_level', 'unknown')} level)",
            })

        # Entity density evidence
        e = analysis.get("entities", {})
        density = e.get("entity_density", 0)
        evidence.append({
            "id": _evidence_id("nlp", "entity_density"),
            "source": "nlp_analysis",
            "key": "entity_density",
            "value": density,
            "verdict": "pass" if density >= 1.0 else "warn" if density >= 0.5 else "fail",
            "detail": f"Entity density: {density} entities/sentence ({e.get('total_entity_count', 0)} total)",
        })

        # Semantic density evidence
        sd = analysis.get("semantic_density", {})
        content_ratio = sd.get("content_words_ratio", 0)
        evidence.append({
            "id": _evidence_id("nlp", "semantic_density"),
            "source": "nlp_analysis",
            "key": "semantic_density",
            "value": content_ratio,
            "verdict": (
                "pass" if content_ratio > 0.55
                else "warn" if content_ratio > 0.45
                else "fail"
            ),
            "detail": f"Content word ratio: {content_ratio} ({sd.get('density_grade', 'unknown')})",
        })

        # Content quality evidence
        q = analysis.get("content_quality", {})
        depth = q.get("content_depth", "thin")
        evidence.append({
            "id": _evidence_id("nlp", "content_depth"),
            "source": "nlp_analysis",
            "key": "content_depth",
            "value": depth,
            "verdict": (
                "pass" if depth in ("comprehensive", "detailed")
                else "warn" if depth == "moderate"
                else "fail"
            ),
            "detail": f"Content depth: {depth} ({q.get('word_count', 0)} words, {q.get('definition_patterns', 0)} definitions)",
        })

        # AI query readiness evidence
        qc = analysis.get("question_coverage", {})
        readiness = qc.get("ai_query_readiness", "low")
        evidence.append({
            "id": _evidence_id("nlp", "ai_query_readiness"),
            "source": "nlp_analysis",
            "key": "ai_query_readiness",
            "value": readiness,
            "verdict": (
                "pass" if readiness == "high"
                else "warn" if readiness == "moderate"
                else "fail"
            ),
            "detail": f"AI query readiness: {readiness} ({qc.get('total_query_patterns', 0)} patterns found)",
        })

        return evidence
