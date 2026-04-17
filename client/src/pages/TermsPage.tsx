import React from "react";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";
import PublicPageFrame from "../components/PublicPageFrame";

export default function TermsPage() {
  usePageMeta({
    title: 'Terms of Service',
    description: 'AiVIS.biz terms of service governing use of the AI visibility auditing platform, including acceptable use, billing, IP rights, and disclaimers.',
    path: '/terms',
    structuredData: [
      buildWebPageSchema({ path: '/terms', name: 'AiVIS.biz Terms of Service', description: 'Terms and conditions for using the AiVIS.biz AI visibility auditing platform.' }),
      buildBreadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Terms of Service', path: '/terms' }]),
    ],
  });

  const linkCls = "text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200";
  const emailCls = "text-white/85 hover:text-white";

  return (
    <PublicPageFrame icon={FileText} title="Terms of Service" subtitle="Legal terms governing your use of AiVIS.biz" maxWidthClass="max-w-4xl">
      <p className="text-white/55 text-sm mb-10">Last updated: April 5, 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-white/75 leading-relaxed bg-charcoal-deep rounded-2xl p-6 border border-white/10">

          {/* ── 1 Agreement ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>By creating an account on or otherwise accessing AiVIS.biz ("the Service"), you agree to be bound by these Terms of Service ("Terms"). The Service is operated by <strong className="text-white">AiVIS.biz</strong> (a product of Intruvurt Labs, LLC), a company incorporated in the State of Georgia, United States.</p>
            <p className="mt-2">If you do not agree, you must stop using the Service immediately. These Terms form a legally binding contract between you and AiVIS.biz.</p>
            <p className="mt-2">These Terms should be read alongside our <Link to="/privacy" className={linkCls}>Privacy Policy</Link> and <Link to="/disclosures" className={linkCls}>Consumer Disclosures</Link>, which are incorporated by reference.</p>
          </section>

          {/* ── 2 Service Description ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description</h2>
            <p>AiVIS.biz is an evidence-linked AI citation audit platform that analyzes whether AI systems like ChatGPT, Perplexity AI, Google AI Overviews, and Claude can correctly read, interpret, and cite your website. The Service crawls a submitted URL using a headless browser, extracts structural and content signals, routes the data through one or more large language models, and returns a visibility score with evidence-backed findings and recommendations.</p>
            <p className="mt-2">Additional platform capabilities include competitor tracking, citation testing, brand mention scanning, scheduled rescans, report generation, team workspaces, API access, and webhook integrations. Feature availability is governed by your subscription tier.</p>
            <p className="mt-2">Every analysis report includes an <strong className="text-white">execution class badge</strong> (LIVE, DETERMINISTIC_FALLBACK, SCRAPE_ONLY, or UPLOAD) that indicates the runtime conditions under which results were generated.</p>
          </section>

          {/* ── 3 AI Disclaimer ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. AI-Generated Output Disclaimer</h2>
            <p>Analysis results are produced in part by third-party large language models accessed through OpenRouter. AI outputs may be inaccurate, incomplete, or contextually misleading. Results do not constitute professional SEO, legal, marketing, or business advice.</p>
            <p className="mt-2">AiVIS.biz applies evidence-based scoring constraints (floor/ceiling bounds) derived from deterministic page signals to reduce hallucination risk, but <strong className="text-white">does not guarantee accuracy, completeness, or fitness for any particular purpose</strong>.</p>
            <p className="mt-2">You acknowledge that:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Visibility scores are diagnostic indicators, not guarantees of search engine or AI answer engine performance.</li>
              <li>Recommendations should be evaluated using your own professional judgment before implementation.</li>
              <li>Cached results (served to reduce latency) may not reflect the current state of a page.</li>
              <li>Model availability and response quality may vary due to upstream provider conditions.</li>
              <li>The triple-check pipeline (Signal tier) uses three sequential models whose outputs may disagree.</li>
            </ul>
            <p className="mt-2">See our full <Link to="/disclosures" className={linkCls}>Consumer Disclosures</Link> for additional detail.</p>
          </section>

          {/* ── 4 Eligibility ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Eligibility and Account Requirements</h2>
            <p>You must be at least 16 years of age to use the Service. By registering, you represent that you meet this requirement.</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>A valid, verified email address is required. Accounts with unverified emails have restricted access.</li>
              <li>You are responsible for maintaining the confidentiality of your credentials.</li>
              <li>One account per individual. Automated account creation and account sharing are prohibited.</li>
              <li>You must promptly notify us at <a href="mailto:security@aivis.biz" className={emailCls}>security@aivis.biz</a> of any unauthorized access to your account.</li>
            </ul>
          </section>

          {/* ── 5 Acceptable Use ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Acceptable Use</h2>
            <p>You agree to use the Service only for lawful purposes. You shall not:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Submit URLs you are not authorized to analyze. If the site is not yours and you lack written permission, do not submit it.</li>
              <li>Attempt to bypass rate limits, authentication, or any security control.</li>
              <li>Use competitor tracking, citation testing, or reverse-engineering tools for any purpose that violates applicable law, including trade secret misappropriation or unauthorized computer access.</li>
              <li>Submit URLs containing malware, phishing payloads, or content designed to exploit the analysis pipeline.</li>
              <li>Resell, redistribute, or sublicense API access or analysis outputs without written authorization.</li>
              <li>Reverse engineer, decompile, or disassemble the Service except to the extent expressly permitted by applicable law.</li>
              <li>Scrape or programmatically access the Service outside of the documented API.</li>
            </ul>
            <p className="mt-2">AiVIS.biz performs automated threat scanning (URLhaus, Google Safe Browsing, hostname heuristics) on submitted URLs and may block or flag requests that trigger risk indicators. Repeated submission of flagged URLs may result in account suspension.</p>
            <p className="mt-2">Report abuse: <a href="mailto:abuse@aivis.biz" className={emailCls}>abuse@aivis.biz</a>.</p>
          </section>

          {/* ── 6 Pricing ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Pricing, Billing, and Refunds</h2>
            <p>The Service offers five tiers:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Observer (Free):</strong> Limited monthly scans with core audit capabilities.</li>
              <li><strong className="text-white">Starter ($15/mo or $140/yr):</strong> Full recommendations with implementation code, PDF exports, shareable links, and content highlights.</li>
              <li><strong className="text-white">Alignment ($49/mo or $458/yr):</strong> Expanded scan allowance, exports, force refresh, competitor tracking, mention digests.</li>
              <li><strong className="text-white">Signal ($149/mo or $1,394/yr):</strong> Full platform access including triple-check workflows, citation testing, team workspaces, API, webhooks, and scheduled rescans.</li>
              <li><strong className="text-white">Score Fix ($299 one-time):</strong> 250-credit pack with automated remediation, evidence-linked pull request generation, and batch operations.</li>
            </ul>
            <p className="mt-2">Subscription payments are processed by <strong className="text-white">Stripe, Inc.</strong> AiVIS.biz never receives or stores full payment card numbers. Subscriptions auto-renew at the end of each billing period unless canceled before the renewal date.</p>
            <p className="mt-2"><strong className="text-white">Refund policy:</strong> Refund requests are evaluated on a case-by-case basis if submitted within 14 calendar days of the initial charge. After this period, all charges are final. Score Fix purchases are non-refundable once any scan credits have been consumed.</p>
            <p className="mt-2">Pricing, scan limits, and feature availability are published on the <Link to="/pricing" className={linkCls}>Pricing page</Link> and may change with 30 days' notice. Billing inquiries: <a href="mailto:billing@aivis.biz" className={emailCls}>billing@aivis.biz</a>.</p>
          </section>

          {/* ── 7 URL Authorization ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. URL Submission and Authorization</h2>
            <p>By submitting a URL for analysis, you represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>You own or are authorized to analyze the website at that URL.</li>
              <li>The URL resolves to a publicly accessible page (private, authenticated, or intranet URLs are blocked in production).</li>
              <li>Your submission complies with the target site's published terms of service and robots.txt directives.</li>
            </ul>
            <p className="mt-2">AiVIS.biz blocks private, localhost, and reserved IP ranges via server-side validation. However, AiVIS.biz is not liable for any claim arising from your submission of a URL you were not authorized to analyze.</p>
          </section>

          {/* ── 8 IP ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p><strong className="text-white">Your content:</strong> Analysis results, exported reports, and any data generated from your submitted URLs belong to you. You may use them within your organization, share them with clients, or publish them at your discretion.</p>
            <p className="mt-2"><strong className="text-white">Our property:</strong> The Service - including its source code, algorithms, scoring rubrics, BRAG evidence framework, user interface design, branding, documentation, and all related intellectual property - is and remains the exclusive property of AiVIS.biz. You receive a limited, non-exclusive, non-transferable, revocable license to access and use the Service in accordance with these Terms.</p>
            <p className="mt-2"><strong className="text-white">Feedback:</strong> If you submit suggestions, enhancement requests, or other feedback about the Service, you grant AiVIS.biz an irrevocable, royalty-free, worldwide license to use that feedback for any purpose.</p>
          </section>

          {/* ── 9 Third-Party Services ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Third-Party Services</h2>
            <p>The Service integrates with third-party providers. Each has its own terms and privacy practices:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">OpenRouter</strong> - routes analysis requests to AI language models.</li>
              <li><strong className="text-white">Stripe</strong> - processes payments and manages subscriptions (PCI DSS compliant).</li>
              <li><strong className="text-white">Render</strong> - application hosting infrastructure.</li>
              <li><strong className="text-white">Neon</strong> - managed PostgreSQL database.</li>
              <li><strong className="text-white">Sentry</strong> - error tracking and performance monitoring (consent-based).</li>
              <li><strong className="text-white">Resend</strong> - transactional and notification email delivery.</li>
              <li><strong className="text-white">URLhaus / Google Safe Browsing</strong> - threat intelligence feeds.</li>
            </ul>
            <p className="mt-2">AiVIS.biz is not responsible for the availability, accuracy, or practices of these third-party services. Outages, data processing changes, or policy updates by these providers may affect Service functionality without prior notice from us.</p>
          </section>

          {/* ── 10 Webhooks & API ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. API Access and Webhooks</h2>
            <p>API keys provide programmatic access to certain Service capabilities. Keys are scoped by permission, hashed for storage, and displayed in plaintext exactly once at creation. You are responsible for securing your API keys.</p>
            <p className="mt-2">Webhook deliveries are made on a best-effort basis. AiVIS.biz does not guarantee delivery, order, or idempotency of webhook payloads. Webhook endpoints must respond within 10 seconds. Failed deliveries are logged but not automatically retried.</p>
            <p className="mt-2">API rate limits and key quotas vary by tier. Exceeding published rate limits may result in temporary throttling or key suspension.</p>
          </section>

          {/* ── 11 Warranty Disclaimer ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
            <p className="mt-2">Without limiting the foregoing, AiVIS.biz does not warrant that:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>The Service will be uninterrupted, error-free, or free of vulnerabilities.</li>
              <li>Analysis results will be accurate, current, or complete.</li>
              <li>Implementing recommendations will produce any specific business outcome, ranking improvement, or citation result.</li>
              <li>Threat intelligence data (URLhaus, Safe Browsing) reflects the most current known threats.</li>
              <li>Cached analysis results reflect the current state of the analyzed page.</li>
            </ul>
          </section>

          {/* ── 12 Liability ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AiVIS.biz SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOST PROFITS, LOST DATA, BUSINESS INTERRUPTION, REPUTATIONAL HARM, OR COST OF SUBSTITUTE SERVICES, ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE.</p>
            <p className="mt-2">THE TOTAL AGGREGATE LIABILITY OF AiVIS.biz FOR ALL CLAIMS ARISING UNDER OR RELATED TO THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO AiVIS.biz IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED US DOLLARS ($100).</p>
            <p className="mt-2">These limitations apply regardless of the legal theory (contract, tort, strict liability, or otherwise) and even if AiVIS.biz has been advised of the possibility of such damages.</p>
          </section>

          {/* ── 13 Indemnification ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Indemnification</h2>
            <p>You agree to indemnify, defend, and hold harmless AiVIS.biz and its officers, directors, employees, and agents from any claims, losses, damages, liabilities, and expenses (including reasonable attorneys' fees) arising from:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Your use of the Service in violation of these Terms.</li>
              <li>Your submission of URLs you were not authorized to analyze.</li>
              <li>Your violation of any applicable law or third-party rights.</li>
              <li>Content you generate, export, or distribute using the Service.</li>
            </ul>
          </section>

          {/* ── 14 Termination ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">14. Termination</h2>
            <p>AiVIS.biz may suspend or terminate your account at any time for violation of these Terms, suspected abuse, or at its sole discretion. Where feasible, we will provide advance notice, but immediate action may be taken without notice in cases involving security threats, fraud, or illegal activity.</p>
            <p className="mt-2">You may terminate your account by emailing <a href="mailto:support@aivis.biz" className={emailCls}>support@aivis.biz</a>. Upon receiving your request, we will process account deletion within 30 calendar days and send a confirmation. Active subscriptions must be canceled through your billing settings before account deletion to avoid further charges.</p>
            <p className="mt-2">Upon termination, Sections 3, 8, 11, 12, 13, 15, and 16 survive.</p>
          </section>

          {/* ── 15 Governing Law ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">15. Governing Law and Jurisdiction</h2>
            <p>These Terms are governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to conflict of law principles. Any legal action or proceeding arising under these Terms will be brought exclusively in the state or federal courts located in Georgia, and you consent to personal jurisdiction in those courts.</p>
          </section>

          {/* ── 16 Dispute Resolution ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">16. Dispute Resolution</h2>
            <p>Before initiating any legal proceeding, you agree to attempt informal resolution by contacting <a href="mailto:legal@aivis.biz" className={emailCls}>legal@aivis.biz</a>. Both parties will negotiate in good faith for a period of sixty (60) days. If no resolution is reached, either party may pursue remedies available under applicable law in the courts specified in Section 15.</p>
          </section>

          {/* ── 17 Modifications ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">17. Modifications to Terms</h2>
            <p>AiVIS.biz may update these Terms as the Service evolves. Material changes will be communicated via email or in-app notification at least 30 days before taking effect. Non-material changes (clarifications, formatting) may be applied without advance notice.</p>
            <p className="mt-2">Continued use of the Service after the effective date of updated Terms constitutes acceptance. If you do not agree with any update, you must discontinue use and close your account.</p>
          </section>

          {/* ── 18 Severability & Waiver ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">18. Severability and Waiver</h2>
            <p>If any provision of these Terms is held unenforceable, the remaining provisions remain in full force. The failure of AiVIS.biz to enforce any right or provision shall not constitute a waiver of that right or provision.</p>
          </section>

          {/* ── 19 Entire Agreement ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">19. Entire Agreement</h2>
            <p>These Terms, together with the <Link to="/privacy" className={linkCls}>Privacy Policy</Link> and <Link to="/disclosures" className={linkCls}>Consumer Disclosures</Link>, constitute the entire agreement between you and AiVIS.biz with respect to the Service and supersede all prior agreements and understandings.</p>
          </section>

          {/* ── 20 Contact ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">20. Contact Information</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>General: <a href="mailto:hello@aivis.biz" className={emailCls}>hello@aivis.biz</a></li>
              <li>Support: <a href="mailto:support@aivis.biz" className={emailCls}>support@aivis.biz</a></li>
              <li>Billing: <a href="mailto:billing@aivis.biz" className={emailCls}>billing@aivis.biz</a></li>
              <li>Legal: <a href="mailto:legal@aivis.biz" className={emailCls}>legal@aivis.biz</a></li>
              <li>Privacy: <a href="mailto:privacy@aivis.biz" className={emailCls}>privacy@aivis.biz</a></li>
              <li>Security: <a href="mailto:security@aivis.biz" className={emailCls}>security@aivis.biz</a></li>
              <li>Abuse: <a href="mailto:abuse@aivis.biz" className={emailCls}>abuse@aivis.biz</a></li>
              <li>Phone: <a href="tel:+17069075299" className={emailCls}>(706) 907-5299</a></li>
            </ul>
            <p className="mt-4 text-white/60 text-sm">AiVIS.biz · Georgia, USA</p>
          </section>
        </div>
    </PublicPageFrame>
  );
}
