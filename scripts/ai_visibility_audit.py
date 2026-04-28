#!/usr/bin/env python3
"""Deterministic AI visibility + technical SEO audit for a domain.

- Uses live HTTP fetch by default.
- Supports --probe-file with externally collected real browser evidence.
- Emits BRAG-citable evidence IDs and NO_EVIDENCE exclusions.

Fixes applied vs v2.0:
  [C1] probe-file opened with context manager; json.load() used directly
  [C2] Sitemap parse failure emits warning instead of silent fallback
  [C3] score() return type corrected to Dict[str, object]
  [C4] word_count strips <script>/<style> content before counting
  [C5] <link> tags excluded from navigational link counting
  [C6] Scoring uses ratio-weighted points instead of all-or-nothing
  [C7] Template fingerprint buckets word_count to nearest 50
  [C8] Home audit matched by URL, not assumed to be audits[0]
  [C9] fetch_url retries on 429 with exponential backoff
  [C10] Output directory created automatically before writing files
  [C11] Evidence ID uses 16 hex chars (64-bit) instead of 12
  [C12] User-Agent updated to a neutral, non-repo-dependent string
  [C13] robots.txt Disallow rules respected before crawling sitemap URLs
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Dict, List, Optional, Set, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

# [C12] Neutral UA — no external repo dependency
USER_AGENT = "BRAG-AI-Visibility-Audit/2.1 (ai-visibility-audit-bot)"
TIMEOUT = 20


# ---------------------------------------------------------------------------
# HTML Parser
# ---------------------------------------------------------------------------

class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.in_title = False
        self.h1 = 0
        self.meta: Dict[str, str] = {}
        # [C5] Separate storage for <a> links vs all <link> elements
        self.a_links: List[Tuple[str, Dict[str, str]]] = []
        self.link_tags: List[Tuple[str, Dict[str, str]]] = []
        self.jsonld_blocks: List[str] = []
        self._in_jsonld = False
        self._jsonld_buf: List[str] = []
        # [C4] Track whether we are inside a script or style tag
        self._in_skip_tag = False

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attrs_dict = {k.lower(): (v or "") for k, v in attrs}
        t = tag.lower()

        # [C4] Mark script/style regions so handle_data ignores their content
        if t in ("script", "style"):
            if t == "script" and "application/ld+json" in attrs_dict.get("type", ""):
                self._in_jsonld = True
                self._jsonld_buf = []
            else:
                self._in_skip_tag = True
            return

        if t == "title":
            self.in_title = True
        if t == "h1":
            self.h1 += 1
        if t == "meta":
            key = attrs_dict.get("name") or attrs_dict.get("property")
            if key:
                self.meta[key.lower()] = attrs_dict.get("content", "")
        if t == "link":
            href = attrs_dict.get("href", "")
            self.link_tags.append((href, attrs_dict))
        # [C5] Only collect navigational <a href> links
        if t == "a":
            href = attrs_dict.get("href", "")
            if href:
                self.a_links.append((href, attrs_dict))

    def handle_data(self, data: str) -> None:
        if self._in_skip_tag:
            return
        if self.in_title:
            self.title += data
        if self._in_jsonld:
            self._jsonld_buf.append(data)

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "title":
            self.in_title = False
        if t in ("script", "style"):
            if self._in_jsonld:
                payload = "".join(self._jsonld_buf).strip()
                if payload:
                    self.jsonld_blocks.append(payload)
                self._in_jsonld = False
                self._jsonld_buf = []
            self._in_skip_tag = False


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class UrlAudit:
    url: str
    status: Optional[int]
    latency_ms: Optional[int]
    title: str
    meta_description: str
    canonical: str
    h1_count: int
    has_og_title: bool
    has_og_description: bool
    has_twitter_card: bool
    has_jsonld: bool
    schema_types: List[str]
    internal_links: int
    external_links: int
    word_count: int
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def evidence_id(source: str, key: str) -> str:
    # [C11] 16 hex chars (64-bit) instead of 12 to reduce collision risk
    digest = hashlib.sha256(f"{source}|{key}".encode("utf-8")).hexdigest()[:16]
    return f"ev-{source}-{digest}"


def classify_error(err: Optional[str], status: Optional[int]) -> str:
    if not err and status and 200 <= status < 300:
        return "unknown"
    if status == 429:
        return "rate_limited"
    if status and 500 <= status <= 599:
        return "server_error"
    if err and "timed out" in err.lower():
        return "timeout"
    if err and "tls" in err.lower():
        return "tls_error"
    if status in (401, 403):
        return "auth_error"
    if err and "unreachable" in err.lower():
        return "source_unreachable"
    return "source_unreachable" if err else "unknown"


# ---------------------------------------------------------------------------
# HTTP fetch with retry
# ---------------------------------------------------------------------------

def fetch_url(
    url: str,
    retries: int = 2,
    backoff: float = 2.0,
) -> Tuple[Optional[int], bytes, Dict[str, str], Optional[str], Optional[int]]:
    """Fetch a URL, retrying on 429 with exponential backoff. [C9]"""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    last_err: Optional[str] = None
    last_status: Optional[int] = None
    last_latency: Optional[int] = None

    for attempt in range(retries + 1):
        started = time.time()
        try:
            with urlopen(req, timeout=TIMEOUT) as resp:
                body = resp.read()
                latency = int((time.time() - started) * 1000)
                headers = {k.lower(): v for k, v in resp.headers.items()}
                return resp.status, body, headers, None, latency
        except HTTPError as e:
            latency = int((time.time() - started) * 1000)
            last_status = e.code
            last_err = f"HTTPError: {e}"
            last_latency = latency
            if e.code == 429 and attempt < retries:
                wait = backoff * (attempt + 1)
                print(f"[warn] 429 on {url}, retrying in {wait:.1f}s (attempt {attempt + 1}/{retries})", flush=True)
                time.sleep(wait)
                continue
            return e.code, b"", {}, last_err, latency
        except URLError as e:
            latency = int((time.time() - started) * 1000)
            return None, b"", {}, f"URLError: {e}", latency

    return last_status, b"", {}, last_err, last_latency


# ---------------------------------------------------------------------------
# robots.txt compliance
# ---------------------------------------------------------------------------

def parse_disallowed_paths(robots_body: bytes, agent: str) -> Set[str]:
    """Return a set of disallowed path prefixes for our user-agent. [C13]"""
    disallowed: Set[str] = set()
    body = robots_body.decode("utf-8", errors="ignore")
    lines = body.splitlines()
    agent_lower = agent.lower().split("/")[0]  # e.g. "brag-ai-visibility-audit"
    active = False
    for line in lines:
        line = line.strip()
        if line.lower().startswith("user-agent:"):
            ua = line.split(":", 1)[1].strip().lower()
            active = ua in ("*", agent_lower)
        elif active and line.lower().startswith("disallow:"):
            path = line.split(":", 1)[1].strip()
            if path:
                disallowed.add(path)
    return disallowed


def is_allowed(url: str, disallowed: Set[str]) -> bool:
    path = urlparse(url).path or "/"
    for prefix in disallowed:
        if path.startswith(prefix):
            return False
    return True


# ---------------------------------------------------------------------------
# HTML analysis
# ---------------------------------------------------------------------------

def extract_schema_types(jsonld_blocks: List[str]) -> List[str]:
    types: List[str] = []
    for block in jsonld_blocks:
        try:
            parsed = json.loads(block)
        except json.JSONDecodeError:
            continue
        items = parsed if isinstance(parsed, list) else [parsed]
        for item in items:
            if isinstance(item, dict) and "@type" in item:
                t = item["@type"]
                if isinstance(t, list):
                    types.extend([str(x) for x in t])
                else:
                    types.append(str(t))
    return sorted(set(types))


def audit_html(
    url: str,
    html: str,
    status: Optional[int],
    latency: Optional[int],
    error: Optional[str],
) -> UrlAudit:
    parser = MetaParser()
    parser.feed(html)
    parsed_home = urlparse(url)
    internal = 0
    external = 0
    canonical = ""

    # [C5] canonical comes from <link rel="canonical"> (link_tags), not a_links
    for href, attrs in parser.link_tags:
        rel = attrs.get("rel", "").lower()
        if "canonical" in rel:
            canonical = href

    # [C5] Only count <a href> links for internal/external
    for href, _ in parser.a_links:
        if not href or href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        absolute = urljoin(url, href)
        dom = urlparse(absolute).netloc
        if dom == parsed_home.netloc:
            internal += 1
        else:
            external += 1

    # [C4] Strip <script>/<style> before word count — parser already ignores
    # their content in handle_data, so re-strip from the raw string for safety
    clean = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text_only = re.sub(r"<[^>]+>", " ", clean)
    words = re.findall(r"\b[a-zA-Z]\w*\b", text_only)

    schema_types = extract_schema_types(parser.jsonld_blocks)

    return UrlAudit(
        url=url,
        status=status,
        latency_ms=latency,
        title=parser.title.strip(),
        meta_description=parser.meta.get("description", "").strip(),
        canonical=canonical.strip(),
        h1_count=parser.h1,
        has_og_title=bool(parser.meta.get("og:title")),
        has_og_description=bool(parser.meta.get("og:description")),
        has_twitter_card=bool(parser.meta.get("twitter:card")),
        has_jsonld=bool(parser.jsonld_blocks),
        schema_types=schema_types,
        internal_links=internal,
        external_links=external,
        word_count=len(words),
        error=error,
    )


# ---------------------------------------------------------------------------
# Sitemap
# ---------------------------------------------------------------------------

def pull_sitemap_urls(base_url: str, max_urls: int, disallowed: Set[str]) -> List[str]:
    candidates = [
        urljoin(base_url, "/sitemap.xml"),
        urljoin(base_url, "/sitemap_index.xml"),
    ]
    urls: List[str] = []
    for sm in candidates:
        status, body, _, _, _ = fetch_url(sm)
        if status and 200 <= status < 300 and body:
            text = body.decode("utf-8", errors="ignore")
            for loc in re.findall(r"<loc>(.*?)</loc>", text, re.DOTALL):
                u = loc.strip()
                # [C13] Skip disallowed paths
                if u and u not in urls and is_allowed(u, disallowed):
                    urls.append(u)
            if urls:
                break

    # [C2] Emit explicit warning instead of silently falling back
    if not urls:
        print(
            f"[warn] No crawlable <loc> entries found in sitemap; "
            f"falling back to base URL only: {base_url}",
            flush=True,
        )
        return [base_url]

    return urls[:max_urls]


# ---------------------------------------------------------------------------
# Scoring  [C3, C6, C7]
# ---------------------------------------------------------------------------

def _pct(pages: List[UrlAudit], pred) -> float:
    """Ratio of pages satisfying pred. [C6]"""
    if not pages:
        return 0.0
    return sum(1 for p in pages if pred(p)) / len(pages)


def score(audits: List[UrlAudit], robots_ok: bool, llms_ok: bool) -> Dict[str, object]:
    # [C3] Return type is Dict[str, object] — mixes int and float
    success_pages = [a for a in audits if a.status and 200 <= a.status < 300]
    if not success_pages:
        return {
            "overall": 0,
            "technical": 0,
            "ai_visibility": 0,
            "template_duplication_penalty": 0,
            "template_duplication_ratio": 0.0,
            "template_unique_pages": 0,
            "template_total_pages": 0,
        }

    # [C6] Ratio-weighted scoring — partial credit for partial compliance
    technical: float = 20.0
    technical += round(10 * _pct(success_pages, lambda a: bool(a.title)))
    technical += round(10 * _pct(success_pages, lambda a: bool(a.meta_description)))
    technical += round(8  * _pct(success_pages, lambda a: bool(a.canonical)))
    technical += round(8  * _pct(success_pages, lambda a: a.h1_count >= 1))
    technical += 6 if robots_ok else 0

    ai_visibility: float = 0.0
    ai_visibility += 15 if any(a.has_jsonld for a in success_pages) else 0
    ai_visibility += round(10 * _pct(success_pages, lambda a: a.has_og_title and a.has_og_description))
    ai_visibility += round(5  * _pct(success_pages, lambda a: a.has_twitter_card))
    ai_visibility += 10 if llms_ok else 0
    ai_visibility += round(8  * _pct(success_pages, lambda a: a.word_count >= 250))

    # [C7] Bucket word_count to nearest 50 so minor body-length differences
    # don't prevent template duplicate detection
    fingerprints = [
        "|".join([
            a.title.strip().lower(),
            a.meta_description.strip().lower(),
            a.canonical.strip().lower(),
            str(a.h1_count),
            str((a.word_count // 50) * 50),      # bucketed
            ",".join(sorted(a.schema_types)).lower(),
        ])
        for a in success_pages
    ]
    unique_count = len(set(fingerprints))
    total_count = len(fingerprints)
    duplicate_ratio = 0.0 if total_count == 0 else round((total_count - unique_count) / total_count, 3)

    duplication_penalty = 0
    if total_count >= 3:
        if duplicate_ratio >= 0.8:
            duplication_penalty = 22
        elif duplicate_ratio >= 0.5:
            duplication_penalty = 12

    final = max(0, min(100, int(technical + ai_visibility - duplication_penalty)))
    return {
        "overall": final,
        "technical": int(technical),
        "ai_visibility": int(ai_visibility),
        "template_duplication_penalty": duplication_penalty,
        "template_duplication_ratio": duplicate_ratio,
        "template_unique_pages": unique_count,
        "template_total_pages": total_count,
    }


# ---------------------------------------------------------------------------
# Claims + evidence ledger
# ---------------------------------------------------------------------------

def build_claims_and_ledger(
    base_url: str,
    robots: Dict,
    llms: Dict,
    sitemap: Dict,
    audits: List[UrlAudit],
) -> Tuple[List[Dict], List[Dict], Dict]:

    # [C8] Match home audit by URL, not positional index
    _blank = UrlAudit(base_url, None, None, "", "", "", 0, False, False, False, False, [], 0, 0, 0, "no_audit")
    home = next(
        (a for a in audits if a.url.rstrip("/") == base_url.rstrip("/")),
        audits[0] if audits else _blank,
    )

    checks = [
        ("robots_reachable",         bool(robots.get("ok")),      f"robots.txt reachable ({robots.get('status')})"),
        ("llms_reachable",           bool(llms.get("ok")),        f"llms.txt reachable ({llms.get('status')})"),
        ("sitemap_reachable",        bool(sitemap.get("ok")),     f"sitemap.xml reachable ({sitemap.get('status')})"),
        ("homepage_title",           bool(home.title),            "Homepage has title"),
        ("homepage_meta_description",bool(home.meta_description), "Homepage has meta description"),
        ("homepage_jsonld",          bool(home.has_jsonld),       "Homepage exposes JSON-LD"),
    ]

    evidence: List[Dict] = []
    claims: List[Dict] = []
    no_evidence_claims: List[Dict] = []
    issues: List[Dict] = []

    endpoint_map = {
        "robots_reachable":  robots,
        "llms_reachable":    llms,
        "sitemap_reachable": sitemap,
    }

    for cid, passed, label in checks:
        ids: List[str] = []
        if cid in endpoint_map:
            ep = endpoint_map[cid]
            if ep.get("status") is not None:
                eid = evidence_id("web", f"{ep.get('url')}|{ep.get('status')}")
                ids = [eid]
                evidence.append({
                    "id": eid,
                    "source": "web",
                    "url": ep.get("url"),
                    "snippet": f"status={ep.get('status')} ok={ep.get('ok')}",
                    "retrievedAt": now_iso(),
                })
            elif ep.get("error"):
                issues.append({
                    "source": "web",
                    "errorClass": classify_error(ep.get("error"), ep.get("status")),
                    "httpStatus": ep.get("status"),
                    "message": ep.get("error"),
                    "timestamp": now_iso(),
                    "traceId": evidence_id("web", f"trace|{ep.get('url')}|{ep.get('error')}")[3:],
                })
        else:
            value = {
                "homepage_title":           home.title,
                "homepage_meta_description":home.meta_description,
                "homepage_jsonld":          ",".join(home.schema_types),
            }[cid]
            if value:
                eid = evidence_id("web", f"{base_url}|{cid}|{value[:100]}")
                ids = [eid]
                evidence.append({
                    "id": eid,
                    "source": "web",
                    "url": home.url,
                    "snippet": f"{cid}={value}",
                    "retrievedAt": now_iso(),
                })

        claims.append({
            "claim": label,
            "evidenceIds": ids,
            "status": "SUPPORTED" if passed and ids else "NO_EVIDENCE",
        })
        if not (passed and ids):
            no_evidence_claims.append({
                "claimId": cid,
                "claim": label,
                "evidenceIds": ids,
                "missingEvidenceIds": ids or [f"missing:{cid}"],
                "exclusionReason": "Evidence ID missing or unresolved at audit time",
                "severity": "critical",
                "excludedFromDecision": True,
                "rescanRecommended": True,
                "rescanReason": "Retry collection when connectivity/source errors are resolved",
            })

    ledger = {
        "runId": evidence_id("internal", f"{base_url}|{now_iso()}"),
        "auditTimestamp": now_iso(),
        "claimsTotal": len(claims),
        "claimsSupported": len([c for c in claims if c["status"] == "SUPPORTED"]),
        "claimsNoEvidence": len(no_evidence_claims),
        "claimsExcluded": len(no_evidence_claims),
        "severeFindingsCount": len(no_evidence_claims),
        "rescanRecommended": len(no_evidence_claims) > 0,
        "rescanReasons": (
            ["One or more claims are NO_EVIDENCE; rerun after source/connectivity stabilization"]
            if no_evidence_claims else []
        ),
        "noEvidenceClaims": no_evidence_claims,
        "collectionIssues": issues,
    }
    return claims, evidence, ledger


# ---------------------------------------------------------------------------
# Probe-file ingestion
# ---------------------------------------------------------------------------

def from_probe(
    base_url: str, probe: Dict
) -> Tuple[Dict, Dict, Dict, List[UrlAudit]]:
    robots = {
        "url": urljoin(base_url, "/robots.txt"),
        "status": probe.get("robots", {}).get("status"),
        "ok": probe.get("robots", {}).get("ok", False),
        "error": probe.get("robots", {}).get("error"),
    }
    llms = {
        "url": urljoin(base_url, "/llms.txt"),
        "status": probe.get("llms", {}).get("status"),
        "ok": probe.get("llms", {}).get("ok", False),
        "error": probe.get("llms", {}).get("error"),
    }
    sitemap = {
        "url": urljoin(base_url, "/sitemap.xml"),
        "status": probe.get("sitemap", {}).get("status"),
        "ok": probe.get("sitemap", {}).get("ok", False),
        "error": probe.get("sitemap", {}).get("error"),
    }
    home = probe.get("home", {})
    audits = [
        UrlAudit(
            url=home.get("url", base_url),
            status=home.get("status"),
            latency_ms=home.get("latency_ms"),
            title=home.get("title", ""),
            meta_description=home.get("meta_description", ""),
            canonical=home.get("canonical", ""),
            h1_count=home.get("h1_count", 0),
            has_og_title=home.get("has_og_title", False),
            has_og_description=home.get("has_og_description", False),
            has_twitter_card=home.get("has_twitter_card", False),
            has_jsonld=home.get("has_jsonld", False),
            schema_types=home.get("schema_types", []),
            internal_links=home.get("internal_links", 0),
            external_links=home.get("external_links", 0),
            word_count=home.get("word_count", 0),
            error=home.get("error"),
        )
    ]
    return robots, llms, sitemap, audits


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Deterministic AI visibility + technical SEO audit for a domain."
    )
    ap.add_argument("--url", required=True, help="Target domain or URL")
    ap.add_argument("--max-urls", type=int, default=6, help="Max sitemap URLs to audit")
    ap.add_argument("--out-prefix", default="reports/aivis-biz-audit", help="Output file prefix")
    ap.add_argument("--probe-file", help="Optional JSON probe captured from a real browser run")
    args = ap.parse_args()

    base_url = args.url if args.url.startswith("http") else f"https://{args.url}"
    base_url = base_url.rstrip("/")

    # [C10] Ensure output directory exists before writing any files
    out_dir = os.path.dirname(args.out_prefix)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    if args.probe_file:
        # [C1] Use context manager + json.load() to avoid file handle leak
        with open(args.probe_file, "r", encoding="utf-8") as f:
            probe = json.load(f)
        robots, llms, sitemap, audits = from_probe(base_url, probe)
        disallowed: Set[str] = set()
    else:
        robots_status, robots_body, _, robots_err, _ = fetch_url(urljoin(base_url, "/robots.txt"))
        llms_status,   llms_body,   _, llms_err,   _ = fetch_url(urljoin(base_url, "/llms.txt"))
        sitemap_status,sitemap_body,_, sitemap_err, _ = fetch_url(urljoin(base_url, "/sitemap.xml"))

        robots = {
            "url": urljoin(base_url, "/robots.txt"),
            "status": robots_status,
            "ok": bool(robots_status and 200 <= robots_status < 300 and robots_body),
            "error": robots_err,
        }
        llms = {
            "url": urljoin(base_url, "/llms.txt"),
            "status": llms_status,
            "ok": bool(llms_status and 200 <= llms_status < 300 and llms_body),
            "error": llms_err,
        }
        sitemap = {
            "url": urljoin(base_url, "/sitemap.xml"),
            "status": sitemap_status,
            "ok": bool(sitemap_status and 200 <= sitemap_status < 300 and sitemap_body),
            "error": sitemap_err,
        }

        # [C13] Parse disallowed paths from robots.txt before crawling
        disallowed = (
            parse_disallowed_paths(robots_body, USER_AGENT)
            if robots.get("ok") and robots_body
            else set()
        )

        targets = pull_sitemap_urls(base_url, args.max_urls, disallowed)

        # Ensure homepage is always included as first target for [C8]
        if base_url not in targets and (base_url + "/") not in targets:
            targets = [base_url] + targets

        audits = []
        for u in targets:
            status, body, _, err, latency = fetch_url(u)
            html = body.decode("utf-8", errors="ignore") if body else ""
            audits.append(audit_html(u, html, status, latency, err))

    scores = score(audits, bool(robots.get("ok")), bool(llms.get("ok")))
    claims, evidence, ledger = build_claims_and_ledger(base_url, robots, llms, sitemap, audits)

    output = {
        "generatedAt": now_iso(),
        "target": base_url,
        "robots": robots,
        "llms_txt": llms,
        "sitemap": sitemap,
        "scores": scores,
        "urlsAudited": [asdict(a) for a in audits],
        "claims": claims,
        "evidence": evidence,
        "ledger": ledger,
        "fixes": [
            "Keep robots.txt, llms.txt, and sitemap.xml consistently reachable from all crawler networks.",
            "Maintain citation-ready pages with canonical URL, author/date fields, and source links.",
            "Expand JSON-LD coverage (Organization, WebSite, Service, FAQPage) across core pages.",
            "Track weekly competitor citation share and trend movement using identical deterministic checks.",
        ],
    }

    json_path    = f"{args.out_prefix}.json"
    md_path      = f"{args.out_prefix}.md"
    ledger_path  = f"{args.out_prefix}.ledger.json"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    with open(ledger_path, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2)

    lines = [
        f"# AI Visibility & Technical SEO Audit: {base_url}",
        "",
        f"Generated: {output['generatedAt']}",
        "",
        "## Scores",
        f"- Overall: **{scores['overall']}/100**",
        f"- Technical: **{scores['technical']}**",
        f"- AI Visibility: **{scores['ai_visibility']}**",
        f"- Template duplication penalty: **-{scores['template_duplication_penalty']}**",
        "",
        "## Crawl Health",
        f"- robots.txt: status={robots.get('status')} ok={robots.get('ok')} error={robots.get('error')}",
        f"- llms.txt:   status={llms.get('status')} ok={llms.get('ok')} error={llms.get('error')}",
        f"- sitemap.xml: status={sitemap.get('status')} ok={sitemap.get('ok')} error={sitemap.get('error')}",
        "",
        "## Template Diversity",
        (
            f"- unique_pages={scores['template_unique_pages']} "
            f"total_pages={scores['template_total_pages']} "
            f"duplicate_ratio={scores['template_duplication_ratio']}"
        ),
        "",
        "## URL Findings",
    ]

    for audit in audits:
        lines.append(
            f"- {audit.url} | status={audit.status} "
            f"title={'yes' if audit.title else 'no'} "
            f"meta_desc={'yes' if audit.meta_description else 'no'} "
            f"canonical={'yes' if audit.canonical else 'no'} "
            f"h1={audit.h1_count} "
            f"jsonld={audit.has_jsonld} "
            f"schema_types={','.join(audit.schema_types) if audit.schema_types else '-'} "
            f"words={audit.word_count}"
        )
        if audit.error:
            lines.append(f"  - error: {audit.error}")

    lines.extend(["", "## BRAG Claim Evidence", ""])
    for c in claims:
        evidence_refs = ", ".join(c["evidenceIds"]) if c["evidenceIds"] else "NO_EVIDENCE"
        lines.append(f"- {c['claim']} => {c['status']} [{evidence_refs}]")

    lines.extend([
        "",
        "## NO_EVIDENCE Ledger Summary",
        "",
        f"- claimsNoEvidence: {ledger['claimsNoEvidence']}",
        f"- claimsExcluded:   {ledger['claimsExcluded']}",
        f"- rescanRecommended: {ledger['rescanRecommended']}",
    ])

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"Wrote {ledger_path}")


if __name__ == "__main__":
    main()