import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, FileText } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";
import PublicPageFrame from "../components/PublicPageFrame";

export default function CompliancePage() {
  usePageMeta({
    title: "Compliance & Security | AiVIS.biz",
    description:
      "AiVIS.biz compliance and security posture, including GDPR operations, controls, and SOC roadmap status.",
    path: "/compliance",
    structuredData: [
      buildWebPageSchema({
        path: "/compliance",
        name: "AiVIS.biz Compliance & Security",
        description:
          "Compliance and security operating posture for AiVIS.biz by AiVIS.biz.",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Compliance", path: "/compliance" },
      ]),
    ],
  });

  return (
    <PublicPageFrame icon={ShieldCheck} title="Compliance & Security" subtitle="Formal posture, controls, and current certification status for AiVIS.biz" maxWidthClass="max-w-5xl">
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">About This Compliance &amp; Security Page</h2>
          <p className="text-sm text-white/75 leading-relaxed">
            This page is the authoritative, machine-readable record of AiVIS.biz's security posture, data-handling
            controls, jurisdictional operating terms, and current certification status. AiVIS.biz is an AI Visibility
            Intelligence System built and operated by AiVIS.biz, a company incorporated under the laws of
            the State of Georgia, United States (postal code 30501). Every statement on this page is
            evidence-backed and deliberately scoped to what can be independently verified. We do not publish
            forward-looking compliance claims that lack a corresponding attestation.
          </p>
          <p className="text-sm text-white/75 leading-relaxed">
            AiVIS.biz applies layered security controls across all platform surfaces. Data transmitted between users
            and the platform is encrypted in transit using TLS. Authenticated access controls govern all internal
            data access paths. Application logs and security events are retained under defined operational access
            limits. Payment data is handled exclusively by Stripe; AiVIS.biz never stores, transmits, or processes
            raw card details. Data handling timelines and retention schedules are governed by the Privacy Policy,
            which is accessible from the footer of every page.
          </p>
          <p className="text-sm text-white/75 leading-relaxed">
            Every audit that runs on AiVIS.biz executes a real-time, three-layer threat intelligence scan in parallel
            with the visibility analysis. The scan checks the target URL against the abuse.ch URLhaus malicious
            URL database (covering known malware distribution, phishing, and command-and-control endpoints),
            runs a Google Safe Browsing API v4 check for social engineering and malware indicators, and applies
            hostname heuristics to detect punycode homograph attacks, raw IP hosting, suspicious URL patterns,
            and risky top-level domains such as .tk, .ml, .cf, and .gq. Threat results are surfaced in a
            dedicated banner on every audit report with risk levels ranging from Low to Critical.
          </p>
          <p className="text-sm text-white/75 leading-relaxed">
            For data-subject rights, AiVIS.biz supports GDPR-style operational controls — including data access,
            correction, deletion, and export requests — processed through privacy@aivis.biz under documented
            response timelines. Regarding certification: AiVIS.biz does not currently claim SOC 1 Type I or SOC 2
            Type II certification. This page will be updated when a certification or third-party attestation can
            be evidenced. Platform disputes are subject to the exclusive jurisdiction of courts in Georgia, USA,
            as documented in the Terms of Service. Security concerns can be reported to security@aivis.biz,
            legal inquiries to legal@aivis.biz, and abuse reports to abuse@aivis.biz.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Current posture</h2>
          <ul className="space-y-2 text-sm text-white/75 list-disc pl-5">
            <li>Data is encrypted in transit (TLS) and protected by authenticated access controls.</li>
            <li>Application logs and security events are retained with operational access limits.</li>
            <li>Payment data is processed by Stripe; card data is not stored by AiVIS.biz.</li>
            <li>Data handling and retention terms are documented in the Privacy Policy.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Jurisdiction</h2>
          <ul className="space-y-2 text-sm text-white/75 list-disc pl-5">
            <li>AiVIS.biz is operated by Intruvurt Labs, LLC, a Georgia (USA) based company.</li>
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
            <li><strong className="text-white">URLhaus</strong> - checks the target URL against the abuse.ch malicious URL database (known malware distribution, phishing, and botnet C2 endpoints).</li>
            <li><strong className="text-white">Google Safe Browsing API v4</strong> - checks for social engineering, malware, unwanted software, and potentially harmful applications (requires server-configured API key).</li>
            <li><strong className="text-white">Hostname heuristics</strong> - detects punycode/IDN homograph attacks, raw IP hosting, suspicious URL patterns, and risky top-level domains (.tk, .ml, .cf, .gq).</li>
          </ul>
          <p className="text-sm text-white/70 mt-3">
            Results are surfaced in a Threat Intel banner on the audit report with risk levels from Low to Critical.
            Full methodology is documented on the <Link to="/methodology" className="text-white/85 hover:text-white underline">Methodology</Link> page.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">GDPR operations</h2>
          <p className="text-sm text-white/75 leading-relaxed mb-3">
            AiVIS.biz supports GDPR-style operational controls including access, correction, deletion, and export requests.
            Requests can be sent to <a href="mailto:privacy@aivis.biz" className="text-white/85 hover:text-white underline">privacy@aivis.biz</a> and are processed under documented response timelines.
          </p>
          <p className="text-sm text-white/70">
            Reference: <Link to="/privacy" className="text-white/85 hover:text-white underline">Privacy Policy</Link>
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-6">
          <h2 className="text-lg font-semibold text-white mb-3">SOC status</h2>
          <p className="text-sm text-white/75 leading-relaxed">
            AiVIS.biz is <strong className="text-white">not currently claiming SOC 1 Type I or SOC 2 certification</strong>.
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
      </div>
    </PublicPageFrame>
  );
}
