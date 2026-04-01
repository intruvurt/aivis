import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";

export default function CompliancePage() {
  const navigate = useNavigate();

  usePageMeta({
    title: "Compliance & Security | AiVIS",
    description:
      "AiVIS compliance and security posture, including GDPR operations, controls, and SOC roadmap status.",
    path: "/compliance",
    structuredData: [
      buildWebPageSchema({
        path: "/compliance",
        name: "AiVIS Compliance & Security",
        description:
          "Compliance and security operating posture for AiVIS by Intruvurt Labs.",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Compliance", path: "/compliance" },
      ]),
    ],
  });

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white flex flex-col">
      <header className="border-b border-white/10 bg-charcoal-deep backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full p-2 transition-colors hover:bg-white/8"
            type="button"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
              Compliance & Security
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Formal posture, controls, and current certification status for AiVIS
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Current posture</h2>
          <ul className="space-y-2 text-sm text-white/75 list-disc pl-5">
            <li>Data is encrypted in transit (TLS) and protected by authenticated access controls.</li>
            <li>Application logs and security events are retained with operational access limits.</li>
            <li>Payment data is processed by Stripe; card data is not stored by AiVIS.</li>
            <li>Data handling and retention terms are documented in the Privacy Policy.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Jurisdiction</h2>
          <ul className="space-y-2 text-sm text-white/75 list-disc pl-5">
            <li>AiVIS is operated by Intruvurt Labs, a Georgia (USA) based company.</li>
            <li>Governing law: State of Georgia, United States (postal code 30501).</li>
            <li>Disputes are subject to the exclusive jurisdiction of courts located in Georgia, USA.</li>
            <li>Full jurisdictional terms are documented in the <Link to="/terms" className="text-white/85 hover:text-white underline">Terms of Service</Link>.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Threat detection</h2>
          <p className="text-sm text-white/75 leading-relaxed mb-3">
            Every audit includes a real-time, three-layer threat intelligence scan that runs in parallel with the visibility analysis:
          </p>
          <ul className="space-y-2 text-sm text-white/75 list-disc pl-5">
            <li><strong className="text-white">URLhaus</strong> — checks the target URL against the abuse.ch malicious URL database (known malware distribution, phishing, and botnet C2 endpoints).</li>
            <li><strong className="text-white">Google Safe Browsing API v4</strong> — checks for social engineering, malware, unwanted software, and potentially harmful applications (requires server-configured API key).</li>
            <li><strong className="text-white">Hostname heuristics</strong> — detects punycode/IDN homograph attacks, raw IP hosting, suspicious URL patterns, and risky top-level domains (.tk, .ml, .cf, .gq).</li>
          </ul>
          <p className="text-sm text-white/70 mt-3">
            Results are surfaced in a Threat Intel banner on the audit report with risk levels from Low to Critical.
            Full methodology is documented on the <Link to="/methodology" className="text-white/85 hover:text-white underline">Methodology</Link> page.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">GDPR operations</h2>
          <p className="text-sm text-white/75 leading-relaxed mb-3">
            AiVIS supports GDPR-style operational controls including access, correction, deletion, and export requests.
            Requests can be sent to <a href="mailto:privacy@aivis.biz" className="text-white/85 hover:text-white underline">privacy@aivis.biz</a> and are processed under documented response timelines.
          </p>
          <p className="text-sm text-white/70">
            Reference: <Link to="/privacy" className="text-white/85 hover:text-white underline">Privacy Policy</Link>
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">SOC status</h2>
          <p className="text-sm text-white/75 leading-relaxed">
            AiVIS is <strong className="text-white">not currently claiming SOC 1 Type I or SOC 2 certification</strong>.
            We only publish controls and attestations that can be evidenced. Certification roadmap updates are published on this page when available.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Policy links</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/methodology" className="px-3 py-1.5 rounded-full border border-white/15 bg-charcoal text-white/80 hover:text-white">Claims & Methodology</Link>
            <Link to="/privacy" className="px-3 py-1.5 rounded-full border border-white/15 bg-charcoal text-white/80 hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="px-3 py-1.5 rounded-full border border-white/15 bg-charcoal text-white/80 hover:text-white">Terms of Service</Link>
            <a href="mailto:security@aivis.biz" className="px-3 py-1.5 rounded-full border border-white/15 bg-charcoal text-white/80 hover:text-white">security@aivis.biz</a>
            <a href="mailto:legal@aivis.biz" className="px-3 py-1.5 rounded-full border border-white/15 bg-charcoal text-white/80 hover:text-white">legal@aivis.biz</a>
            <a href="mailto:abuse@aivis.biz" className="px-3 py-1.5 rounded-full border border-white/15 bg-charcoal text-white/80 hover:text-white">abuse@aivis.biz</a>
            <Link to="/help" className="px-3 py-1.5 rounded-full border border-white/15 bg-charcoal text-white/80 hover:text-white">Contact Support</Link>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <p className="text-sm text-white/65 flex items-start gap-2">
            <FileText className="w-4 h-4 mt-0.5 text-white/60" />
            Compliance statements are intentionally specific and evidence-based; this page avoids forward claims that cannot be independently verified.
          </p>
        </section>
      </main>
    </div>
  );
}
