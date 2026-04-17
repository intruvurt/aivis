"""BRAG Validation Gate — deterministic claim validator.

Every finding (AI-generated or rule-engine) must pass through this gate
to earn a BRAG ID. The gate cross-checks each claim against actual
evidence extracted from the page scrape.

Scoring contract:
  - 0 validated BRAG findings → score 100 (nothing is wrong)
  - Each validated finding reduces score by its severity weight
  - Score = max(0, 100 − Σ deductions)

BRAG ID format: BRAG-{source}-{sha256_first12}
  where source ∈ {rule, ai, python} and the hash covers
  the finding key + evidence snapshot.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Severity weight map — points deducted per severity level
# ---------------------------------------------------------------------------

SEVERITY_WEIGHTS: dict[str, float] = {
    "critical": 15.0,
    "high": 8.0,
    "medium": 4.0,
    "low": 1.5,
    "info": 0.0,
}

GENESIS_HASH = "0" * 64


# ---------------------------------------------------------------------------
# Hashing helpers
# ---------------------------------------------------------------------------

def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def _brag_id(source: str, key: str, evidence_snapshot: str) -> str:
    """Generate deterministic BRAG ID from source + key + evidence."""
    digest = _sha256(f"{source}|{key}|{evidence_snapshot}")[:12]
    return f"BRAG-{source}-{digest}"


# ---------------------------------------------------------------------------
# Rule ↔ evidence key mapping
# ---------------------------------------------------------------------------

RULE_EVIDENCE_MAP: dict[str, list[str]] = {
    "C01": ["robots_ai_crawlers"],
    "C02": ["ai_crawler_access"],
    "C03": ["llms_txt"],
    "I01": ["canonical"],
    "I02": ["link_profile"],
    "I03": ["link_profile"],
    "I04": ["sitemap"],
    "R01": ["page_load_ms"],
    "R02": ["lcp_ms"],
    "R03": ["image_count"],
    "R04": ["image_alt_coverage"],
    "M01": ["title"],
    "M02": ["meta_description"],
    "M03": ["og_title"],
    "M04": ["og_description"],
    "M05": ["og_image"],
    "M06": ["lang"],
    "S01": ["structured_data"],
    "S02": ["structured_data"],
    "S03": ["json_ld_completeness"],
    "S04": ["structured_data"],
    "E01": ["headings"],
    "E02": ["headings"],
    "E03": ["title", "og_title"],
    "CT01": ["word_count"],
    "CT02": ["question_h2s"],
    "CT03": ["tldr_block"],
    "CI01": ["meta_description"],
    "CI02": ["meta_description", "og_description"],
    "CI03": ["meta_description"],
    "T01": ["structured_data"],
    "T02": ["word_count"],
    "T03": ["title", "og_title"],
    "EC01": ["ecommerce_platform"],
    "EC02": ["product_schema"],
    "EC03": ["offer_schema"],
    "EC04": ["aggregate_rating_schema"],
    "EC05": ["breadcrumb_schema"],
    "AU01": ["structured_data"],
    "AU02": ["link_profile"],
    "AU03": ["structured_data"],
}

# Keyword → evidence key mapping for AI recommendation matching
KEYWORD_EVIDENCE_MAP: dict[str, list[str]] = {
    "schema": ["structured_data", "json_ld_completeness", "product_schema"],
    "json-ld": ["structured_data", "json_ld_completeness"],
    "json ld": ["structured_data", "json_ld_completeness"],
    "structured data": ["structured_data", "json_ld_completeness"],
    "title": ["title", "og_title"],
    "heading": ["headings"],
    "h1": ["headings"],
    "h2": ["headings", "question_h2s"],
    "meta description": ["meta_description", "og_description"],
    "description": ["meta_description", "og_description"],
    "open graph": ["og_title", "og_description", "og_image"],
    "og tag": ["og_title", "og_description", "og_image"],
    "canonical": ["canonical"],
    "robots": ["robots_ai_crawlers", "ai_crawler_access"],
    "crawl": ["robots_ai_crawlers", "ai_crawler_access", "llms_txt"],
    "llms.txt": ["llms_txt"],
    "sitemap": ["sitemap"],
    "image": ["image_count", "image_alt_coverage", "og_image"],
    "alt text": ["image_alt_coverage"],
    "word count": ["word_count"],
    "content": ["word_count", "tldr_block"],
    "faq": ["question_h2s"],
    "question": ["question_h2s"],
    "speed": ["page_load_ms", "lcp_ms"],
    "performance": ["page_load_ms", "lcp_ms"],
    "lcp": ["lcp_ms"],
    "ecommerce": ["ecommerce_platform", "product_schema", "offer_schema"],
    "product": ["product_schema"],
    "breadcrumb": ["breadcrumb_schema"],
    "rating": ["aggregate_rating_schema"],
    "offer": ["offer_schema"],
    "price": ["offer_schema"],
    "language": ["lang"],
    "hreflang": ["hreflang"],
    "twitter": ["twitter_card"],
    "link": ["link_profile"],
    "internal link": ["link_profile"],
    "external link": ["link_profile"],
}

# Required JSON-LD properties per schema type
REQUIRED_SCHEMA_PROPS: dict[str, list[str]] = {
    "Organization": ["name", "url"],
    "WebSite": ["name", "url"],
    "Product": ["name"],
    "Article": ["headline", "author"],
    "FAQPage": ["mainEntity"],
    "LocalBusiness": ["name", "address"],
    "Person": ["name"],
    "BreadcrumbList": ["itemListElement"],
    "HowTo": ["name", "step"],
    "Review": ["itemReviewed", "author"],
}


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

class BragValidator:
    """Validate findings against evidence and issue BRAG IDs."""

    def validate(
        self,
        audit_id: str,
        url: str,
        evidence_items: list[dict[str, Any]],
        rule_results: list[dict[str, Any]],
        ai_recommendations: list[dict[str, Any]],
        scrape_summary: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Run full validation gate.

        Returns dict with findings, rejected, cite_ledger, derived_score.
        """
        timestamp = datetime.now(timezone.utc).isoformat()

        # Build evidence lookup
        evidence_by_key: dict[str, dict[str, Any]] = {}
        for item in evidence_items:
            key = item.get("key", "")
            if key:
                evidence_by_key[key] = item

        findings: list[dict[str, Any]] = []
        rejected: list[dict[str, Any]] = []

        # ── Validate rule engine results ──────────────────────────────────
        for rule in rule_results:
            if rule.get("passed", True):
                continue  # Passing rules don't generate findings

            finding = self._validate_rule_finding(rule, evidence_by_key)
            if finding:
                findings.append(finding)
            else:
                rejected.append({
                    "source": "rule",
                    "key": rule.get("ruleId", rule.get("rule_id", "unknown")),
                    "reason": "No supporting evidence for rule violation",
                })

        # ── Validate AI recommendations ───────────────────────────────────
        for rec in ai_recommendations:
            finding = self._validate_ai_recommendation(rec, evidence_by_key)
            if finding:
                findings.append(finding)
            else:
                rejected.append({
                    "source": "ai",
                    "key": rec.get("title", "unknown")[:80],
                    "reason": "Recommendation not substantiated by evidence",
                })

        # ── Python-specific cross-checks ──────────────────────────────────
        if scrape_summary:
            extra = self._python_cross_checks(scrape_summary, evidence_by_key)
            findings.extend(extra)

        # ── Deduplicate by brag_id ────────────────────────────────────────
        seen_ids: set[str] = set()
        unique_findings: list[dict[str, Any]] = []
        for f in findings:
            bid = f.get("brag_id", "")
            if bid and bid not in seen_ids:
                seen_ids.add(bid)
                unique_findings.append(f)
        findings = unique_findings

        # ── Build cryptographic cite ledger chain ─────────────────────────
        cite_ledger = self._build_chain(audit_id, url, findings, timestamp)

        # ── Derive score from validated findings ──────────────────────────
        total_deduction = sum(
            SEVERITY_WEIGHTS.get(f.get("severity", "info"), 0)
            for f in findings
        )
        derived_score = max(0.0, min(100.0, 100.0 - total_deduction))

        return {
            "audit_id": audit_id,
            "url": url,
            "validated_at": timestamp,
            "findings": findings,
            "rejected_count": len(rejected),
            "cite_ledger": cite_ledger,
            "derived_score": round(derived_score, 2),
            "finding_count": len(findings),
            "root_hash": cite_ledger[-1]["chain_hash"] if cite_ledger else GENESIS_HASH,
            "gate_version": "brag-gate-v1",
        }

    # ------------------------------------------------------------------
    # Rule validation
    # ------------------------------------------------------------------

    def _validate_rule_finding(
        self,
        rule: dict[str, Any],
        evidence_by_key: dict[str, dict[str, Any]],
    ) -> dict[str, Any] | None:
        """Validate a failed rule against evidence."""
        rule_id = rule.get("ruleId", rule.get("rule_id", ""))

        # Try direct evidence keys from the rule
        evidence_keys = rule.get("evidenceKeys", rule.get("evidence_keys", []))
        evidence = None
        for ek in evidence_keys:
            if ek in evidence_by_key:
                evidence = evidence_by_key[ek]
                break

        # Fallback: map rule ID to known evidence keys
        if not evidence:
            for ek in RULE_EVIDENCE_MAP.get(rule_id, []):
                if ek in evidence_by_key:
                    evidence = evidence_by_key[ek]
                    break

        if not evidence:
            return None  # Cannot validate without evidence

        evidence_snapshot = _canonical_json({
            "key": evidence.get("key"),
            "status": evidence.get("status"),
            "value": str(evidence.get("value", ""))[:200],
        })

        return {
            "brag_id": _brag_id("rule", rule_id, evidence_snapshot),
            "source": "rule",
            "rule_id": rule_id,
            "title": rule.get("title", rule_id),
            "severity": rule.get("severity", "medium"),
            "is_hard_blocker": bool(rule.get("hardBlocker", rule.get("is_hard_blocker", False))),
            "evidence_keys": [evidence.get("key", "")],
            "evidence_statuses": [evidence.get("status", "")],
            "evidence_value": str(evidence.get("value", ""))[:500],
            "confidence": 1.0,  # Rule engine findings are deterministic
            "family": rule.get("family", ""),
            "remediation": rule.get("remediationKey", rule.get("remediation", "")),
        }

    # ------------------------------------------------------------------
    # AI recommendation validation
    # ------------------------------------------------------------------

    def _validate_ai_recommendation(
        self,
        rec: dict[str, Any],
        evidence_by_key: dict[str, dict[str, Any]],
    ) -> dict[str, Any] | None:
        """Validate an AI recommendation against evidence."""
        evidence_ids = rec.get("evidence_ids", []) or []
        title = rec.get("title", "")

        # Find matching evidence by evidence_ids
        matched_evidence: list[dict[str, Any]] = []
        for eid in evidence_ids:
            # evidence_ids may be "ev_title" or "title"
            clean_key = eid.replace("ev_", "") if eid.startswith("ev_") else eid
            if clean_key in evidence_by_key:
                matched_evidence.append(evidence_by_key[clean_key])
            elif eid in evidence_by_key:
                matched_evidence.append(evidence_by_key[eid])

        # Fallback: keyword matching against the recommendation title
        if not matched_evidence:
            matched_evidence = self._find_evidence_by_keywords(title, evidence_by_key)

        if not matched_evidence:
            return None  # No evidence — suppress this recommendation

        primary = matched_evidence[0]
        evidence_snapshot = _canonical_json({
            "key": primary.get("key"),
            "status": primary.get("status"),
            "value": str(primary.get("value", ""))[:200],
        })

        priority = str(rec.get("priority", "medium")).lower()
        severity_map = {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}
        severity = severity_map.get(priority, "medium")

        return {
            "brag_id": _brag_id("ai", title[:80], evidence_snapshot),
            "source": "ai",
            "title": title,
            "severity": severity,
            "is_hard_blocker": False,
            "evidence_keys": [e.get("key", "") for e in matched_evidence],
            "evidence_statuses": [e.get("status", "") for e in matched_evidence],
            "evidence_value": str(primary.get("value", ""))[:500],
            "confidence": min(1.0, len(matched_evidence) * 0.3 + 0.4),
            "remediation": rec.get("description", "")[:500],
        }

    # ------------------------------------------------------------------
    # Python-specific cross-checks
    # ------------------------------------------------------------------

    def _python_cross_checks(
        self,
        scrape_summary: dict[str, Any],
        evidence_by_key: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Deterministic Python checks that complement AI and rule engine."""
        findings: list[dict[str, Any]] = []

        # Thin content check
        word_count = scrape_summary.get("word_count", 0)
        if isinstance(word_count, (int, float)) and word_count < 100:
            findings.append({
                "brag_id": _brag_id("python", "thin_content", str(word_count)),
                "source": "python",
                "title": "Critically thin content detected",
                "severity": "critical",
                "is_hard_blocker": False,
                "evidence_keys": ["word_count"],
                "evidence_statuses": ["present"],
                "evidence_value": str(word_count),
                "confidence": 1.0,
                "family": "content",
                "remediation": f"Page has {word_count} words — below minimum for AI extraction.",
            })

        # Title length validation
        title = scrape_summary.get("title", "")
        if title and (len(title) < 10 or len(title) > 100):
            findings.append({
                "brag_id": _brag_id("python", "title_length", str(len(title))),
                "source": "python",
                "title": "Title length outside optimal range",
                "severity": "medium",
                "is_hard_blocker": False,
                "evidence_keys": ["title"],
                "evidence_statuses": ["present"],
                "evidence_value": title[:100],
                "confidence": 1.0,
                "family": "metadata",
                "remediation": f"Title is {len(title)} chars (optimal: 30-60).",
            })

        # Meta description length
        meta = scrape_summary.get("meta_description", "")
        if meta and (len(meta) < 50 or len(meta) > 320):
            findings.append({
                "brag_id": _brag_id("python", "meta_desc_length", str(len(meta))),
                "source": "python",
                "title": "Meta description length outside optimal range",
                "severity": "low",
                "is_hard_blocker": False,
                "evidence_keys": ["meta_description"],
                "evidence_statuses": ["present"],
                "evidence_value": meta[:200],
                "confidence": 1.0,
                "family": "citation",
                "remediation": f"Meta description is {len(meta)} chars (optimal: 120-160).",
            })

        # JSON-LD schema validation
        json_ld = scrape_summary.get("json_ld_blocks", [])
        if isinstance(json_ld, list):
            for i, block in enumerate(json_ld[:5]):
                issues = self._validate_json_ld(block)
                for issue in issues:
                    findings.append({
                        "brag_id": _brag_id("python", f"schema_issue_{i}", issue),
                        "source": "python",
                        "title": f"Schema validation issue in JSON-LD block {i + 1}",
                        "severity": "medium",
                        "is_hard_blocker": False,
                        "evidence_keys": ["structured_data"],
                        "evidence_statuses": ["present"],
                        "evidence_value": issue,
                        "confidence": 1.0,
                        "family": "schema",
                        "remediation": issue,
                    })

        return findings

    # ------------------------------------------------------------------
    # JSON-LD validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_json_ld(block: Any) -> list[str]:
        """Validate a JSON-LD block for missing required properties."""
        issues: list[str] = []
        if isinstance(block, str):
            try:
                block = json.loads(block)
            except (json.JSONDecodeError, TypeError):
                return ["Invalid JSON in JSON-LD block"]

        if not isinstance(block, dict):
            return ["JSON-LD block is not an object"]

        if "@type" not in block and "@context" not in block:
            issues.append("JSON-LD block missing @type and @context")

        schema_type = block.get("@type", "")
        if schema_type in REQUIRED_SCHEMA_PROPS:
            for prop in REQUIRED_SCHEMA_PROPS[schema_type]:
                if prop not in block:
                    issues.append(f"{schema_type} schema missing required property: {prop}")

        return issues

    # ------------------------------------------------------------------
    # Evidence keyword search
    # ------------------------------------------------------------------

    @staticmethod
    def _find_evidence_by_keywords(
        title: str,
        evidence_by_key: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Match recommendation title keywords to evidence keys."""
        title_lower = title.lower()
        matches: list[dict[str, Any]] = []
        seen: set[str] = set()

        for keyword, evidence_keys in KEYWORD_EVIDENCE_MAP.items():
            if keyword in title_lower:
                for ek in evidence_keys:
                    if ek in evidence_by_key and ek not in seen:
                        seen.add(ek)
                        matches.append(evidence_by_key[ek])

        return matches

    # ------------------------------------------------------------------
    # Cryptographic cite ledger chain
    # ------------------------------------------------------------------

    @staticmethod
    def _build_chain(
        audit_id: str,
        url: str,
        findings: list[dict[str, Any]],
        timestamp: str,
    ) -> list[dict[str, Any]]:
        """Build SHA-256 hash chain over validated findings."""
        chain: list[dict[str, Any]] = []
        previous_hash = GENESIS_HASH

        for i, finding in enumerate(findings):
            ev_key = ""
            ek_list = finding.get("evidence_keys", [])
            if ek_list:
                ev_key = ek_list[0]

            content_hash = _sha256(_canonical_json({
                "brag_id": finding.get("brag_id", ""),
                "source": finding.get("source", ""),
                "title": finding.get("title", ""),
                "severity": finding.get("severity", ""),
                "evidence_key": ev_key,
            }))

            chain_hash = _sha256(previous_hash + content_hash)

            chain.append({
                "sequence": i,
                "brag_id": finding.get("brag_id", f"BRAG-unknown-{i}"),
                "content_hash": content_hash,
                "previous_hash": previous_hash,
                "chain_hash": chain_hash,
                "timestamp": timestamp,
            })

            previous_hash = chain_hash

        return chain
