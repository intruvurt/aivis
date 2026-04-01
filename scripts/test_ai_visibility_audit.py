import sys
import unittest
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

from ai_visibility_audit import UrlAudit, build_claims_and_ledger, evidence_id, score


class AiVisibilityAuditTests(unittest.TestCase):
    def test_evidence_id_is_deterministic(self):
        a = evidence_id("web", "https://aivis.biz/robots.txt|200")
        b = evidence_id("web", "https://aivis.biz/robots.txt|200")
        c = evidence_id("web", "https://aivis.biz/llms.txt|200")
        self.assertEqual(a, b)
        self.assertNotEqual(a, c)
        self.assertTrue(a.startswith("ev-web-"))

    def test_score_no_success_pages_is_zero(self):
        audits = [
            UrlAudit(
                url="https://aivis.biz",
                status=None,
                latency_ms=10,
                title="",
                meta_description="",
                canonical="",
                h1_count=0,
                has_og_title=False,
                has_og_description=False,
                has_twitter_card=False,
                has_jsonld=False,
                schema_types=[],
                internal_links=0,
                external_links=0,
                word_count=0,
                error="blocked",
            )
        ]
        s = score(audits, robots_ok=False, llms_ok=False)
        self.assertEqual(s["overall"], 0)
        self.assertEqual(s["technical"], 0)
        self.assertEqual(s["ai_visibility"], 0)

    def test_ledger_marks_no_evidence_when_endpoints_missing(self):
        robots = {"url": "https://aivis.biz/robots.txt", "status": None, "ok": False, "error": "URLError"}
        llms = {"url": "https://aivis.biz/llms.txt", "status": None, "ok": False, "error": "URLError"}
        sitemap = {"url": "https://aivis.biz/sitemap.xml", "status": None, "ok": False, "error": "URLError"}
        audits = [
            UrlAudit(
                url="https://aivis.biz",
                status=None,
                latency_ms=5,
                title="",
                meta_description="",
                canonical="",
                h1_count=0,
                has_og_title=False,
                has_og_description=False,
                has_twitter_card=False,
                has_jsonld=False,
                schema_types=[],
                internal_links=0,
                external_links=0,
                word_count=0,
                error="URLError",
            )
        ]

        claims, evidence, ledger = build_claims_and_ledger("https://aivis.biz", robots, llms, sitemap, audits)

        self.assertEqual(len(claims), 6)
        self.assertEqual(len(evidence), 0)
        self.assertEqual(ledger["claimsNoEvidence"], 6)
        self.assertEqual(ledger["claimsExcluded"], 6)
        self.assertTrue(ledger["rescanRecommended"])
        self.assertGreaterEqual(len(ledger["collectionIssues"]), 3)


if __name__ == "__main__":
    unittest.main()
