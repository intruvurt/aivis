import React from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";
import PublicPageFrame from "../components/PublicPageFrame";

export default function DisclosuresPage() {
  usePageMeta({
    title: 'Consumer Disclosures | AiVIS AI Visibility Platform',
    description: 'AiVIS consumer disclosures covering AI accuracy limitations, competitive intelligence boundaries, threat detection scope, third-party dependencies and platform disclaimers.',
    path: '/disclosures',
    structuredData: [
      buildWebPageSchema({ path: '/disclosures', name: 'AiVIS Consumer Disclosures', description: 'Consumer-facing disclosures and disclaimers for the AiVIS AI visibility auditing platform.' }),
      buildBreadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Consumer Disclosures', path: '/disclosures' }]),
    ],
  });

  const linkCls = "text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200";
  const emailCls = "text-white/85 hover:text-white";

  return (
    <PublicPageFrame icon={AlertTriangle} title="Consumer Disclosures" subtitle="Disclaimers, limitations, and transparency notices for the AiVIS platform" maxWidthClass="max-w-4xl">
      <p className="text-white/55 text-sm mb-10">Last updated: April 5, 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-white/75 leading-relaxed bg-charcoal-deep rounded-2xl p-6 border border-white/10">

          {/* ── Preamble ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">About This Document</h2>
            <p>This page provides consumer-facing disclosures and transparency notices about the AiVIS platform operated by Intruvurt Labs. It supplements our <Link to="/terms" className={linkCls}>Terms of Service</Link> and <Link to="/privacy" className={linkCls}>Privacy Policy</Link> with specific information about how the platform works, what it can and cannot do, and the boundaries of its outputs.</p>
            <p className="mt-2">These disclosures are written in plain language to help you make informed decisions about using the Service.</p>
          </section>

          {/* ── 1 AI Accuracy ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. AI Analysis Accuracy and Limitations</h2>
            <p>AiVIS uses large language models (LLMs) to evaluate web page structure, content and machine-readability signals. These models are provided by third-party organizations through an intermediary routing service (OpenRouter).</p>

            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">What AI gets right</h3>
            <p>The AI pipeline excels at identifying structural signals: missing Schema.org markup, absent meta descriptions, broken heading hierarchies, poor FAQ formatting, missing structured data, and content extractability issues. These findings are grounded in deterministic page signals that can be independently verified.</p>

            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">What AI may get wrong</h3>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Hallucinated recommendations:</strong> LLMs may suggest changes to elements that don't exist on the page, misidentify technologies used, or recommend practices that are not applicable to your site's architecture.</li>
              <li><strong className="text-white">Score variability:</strong> The same page analyzed at different times may produce different scores due to model non-determinism, model availability changes, or content that has changed between scans.</li>
              <li><strong className="text-white">Context limitations:</strong> The AI analyzes a single page in isolation. It does not observe site-wide architecture, internal linking depth, domain authority, backlink profile, or historical search performance.</li>
              <li><strong className="text-white">Temporal lag:</strong> When cached results are served, they reflect the page state at the original analysis time, not the current state.</li>
            </ul>
            <p className="mt-2">AiVIS applies deterministic floor and ceiling bounds to constrain AI-generated scores within evidence-supported ranges. However, the final score should be treated as a <strong className="text-white">diagnostic indicator</strong>, not an absolute measurement.</p>

            <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">Triple-check pipeline (Signal tier)</h3>
            <p>Signal-tier analyses route through three sequential models: a deep analysis model, a peer critique model (which can adjust scores by −15 to +10 points), and a validation gate. Despite this multi-model architecture, the outputs remain AI-generated and are subject to the same fundamental limitations of large language models.</p>
          </section>

          {/* ── 2 Not Professional Advice ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Not Professional Advice</h2>
            <p>AiVIS analysis reports do not constitute professional advice of any kind. Specifically:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Analysis results are <strong className="text-white">not SEO advice</strong>. They measure structural machine-readability, not search engine ranking factors.</li>
              <li>Visibility scores are <strong className="text-white">not performance guarantees</strong>. Following recommendations does not guarantee improvements in search rankings, AI citation rates, or website traffic.</li>
              <li>Threat detection results are <strong className="text-white">not security audits</strong>. They represent automated lookups against public threat feeds, not a comprehensive security assessment.</li>
              <li>Competitor analysis outputs are <strong className="text-white">not market research</strong>. They compare structural signals, not business competitive positioning.</li>
              <li>Citation test results are <strong className="text-white">not legal evidence</strong>. They capture a point-in-time AI model response that may differ on subsequent queries.</li>
            </ul>
            <p className="mt-2">Always consult qualified professionals for SEO/AEO strategy, cybersecurity, legal, or business decisions.</p>
          </section>

          {/* ── 3 Competitive Intelligence ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Competitive Intelligence Boundaries</h2>
            <p>AiVIS competitor tracking analyzes the publicly accessible version of competitor web pages. It does not:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Access password-protected, login gated, or otherwise private content.</li>
              <li>Circumvent access controls, CAPTCHAs or IP-based restrictions.</li>
              <li>Monitor real time competitor traffic, revenue or internal analytics.</li>
              <li>Intercept, decode, or reverse-engineer proprietary competitor systems.</li>
            </ul>
            <p className="mt-2">Users are responsible for ensuring that their use of competitor analysis features complies with all applicable laws, including the Computer Fraud and Abuse Act (CFAA) and applicable state computer trespass statutes. Do not submit competitor URLs that you are legally prohibited from analyzing.</p>
          </section>

          {/* ── 4 Threat Detection ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Threat Detection Scope and Limitations</h2>
            <p>AiVIS performs automated threat scanning on submitted URLs using:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">URLhaus</strong> (abuse.ch) - community-maintained malware URL database.</li>
              <li><strong className="text-white">Google Safe Browsing API v4</strong> - Google's phishing and malware feed.</li>
              <li><strong className="text-white">Hostname heuristics</strong> - punycode detection, raw IP detection, risky TLD flagging.</li>
            </ul>
            <p className="mt-2"><strong className="text-white">What threat detection does not cover:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Zero-day threats not yet cataloged by URLhaus or Safe Browsing.</li>
              <li>Threats embedded in JavaScript that only execute after specific user interactions.</li>
              <li>Supply chain compromises in third-party scripts loaded by the target page.</li>
              <li>Server-side vulnerabilities, misconfigurations, or data exposure.</li>
              <li>Malware delivered through non-HTTP protocols.</li>
            </ul>
            <p className="mt-2">Threat detection is a supplementary signal, not a substitute for a dedicated security audit or penetration test.</p>
          </section>

          {/* ── 5 Brand Mentions ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Brand Mention Scanning Disclosures</h2>
            <p>The brand mention feature searches 15 public sources for references to your brand, domain, or configured keywords. These sources include community forums (Reddit, Hacker News, Lobsters), developer platforms (GitHub, Stack Overflow, Dev.to), social media (Mastodon, YouTube), knowledge bases (Wikipedia, Medium), Q&A sites (Quora), product directories (Product Hunt), and web search engines (DuckDuckGo, Bing, Google News).</p>
            <p className="mt-2"><strong className="text-white">Limitations:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Results depend on each source's public API availability and search index coverage.</li>
              <li>Sources may rate-limit, temporarily block or change their APIs without notice, causing incomplete results.</li>
              <li>Mentions in private groups, direct messages, paywalled articles, or non-indexed content will not be discovered.</li>
              <li>False positives may occur when common words or phrases overlap with your brand name.</li>
              <li>AiVIS does not guarantee comprehensive coverage of all online mentions.</li>
            </ul>
          </section>

          {/* ── 6 Citation Testing ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Citation Testing Disclosures</h2>
            <p>Citation testing (Signal tier) sends queries to live AI models to determine whether they reference your site in their responses. Each test captures a point-in-time snapshot.</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>AI model responses are <strong className="text-white">non-deterministic</strong>. The same query submitted seconds apart may produce different results.</li>
              <li>Citation presence in one query does not guarantee citation presence in subsequent queries by other users.</li>
              <li>Model training data has a knowledge cutoff date. Recent changes to your site may not be reflected.</li>
              <li>Citation test results are informational snapshots, not guarantees of ongoing citation.</li>
            </ul>
          </section>

          {/* ── 7 Web Scraping ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Web Scraping and Page Analysis</h2>
            <p>AiVIS uses a headless browser (Puppeteer) to load and extract content from the URL you submit. This process:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Executes JavaScript on the target page to capture dynamically rendered content.</li>
              <li>Respects robots.txt directives where they apply to our user agent.</li>
              <li>Fetches the page's llms.txt, sitemap, and structured data endpoints if publicly accessible.</li>
              <li>Analyzes page structure including HTML headings, meta tags, Schema.org markup, internal/external links, images, and word count.</li>
            </ul>
            <p className="mt-2">AiVIS blocks analysis of private IP ranges, localhost, and reserved addresses in production. However, users bear responsibility for ensuring they have authorization to analyze the submitted URL.</p>
          </section>

          {/* ── 8 Third Party Dependencies ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Third-Party Service Dependencies</h2>
            <p>AiVIS depends on external services to operate. Outages, policy changes, or disruptions at any of these providers may affect Service availability or functionality:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">OpenRouter</strong> - AI model routing. If OpenRouter or upstream model providers experience downtime, analyses may fail or fall back to alternative models.</li>
              <li><strong className="text-white">Stripe</strong> - Payment processing. Stripe outages may prevent subscription changes, upgrades, or checkout completion.</li>
              <li><strong className="text-white">Render</strong> - Infrastructure hosting. Hosting outages will make the Service unavailable.</li>
              <li><strong className="text-white">Neon</strong> - PostgreSQL database. Database outages will prevent data persistence and retrieval.</li>
              <li><strong className="text-white">Sentry</strong> - Error monitoring. Sentry outages do not affect Service functionality but may delay our awareness of issues.</li>
              <li><strong className="text-white">Resend</strong> - Email delivery. Resend outages may delay transactional emails (verification, reports, notifications).</li>
            </ul>
            <p className="mt-2">Intruvurt Labs does not guarantee the uptime or performance of third-party providers. We monitor these dependencies and implement fallback chains where feasible (e.g., the AI provider fallback chain includes up to 6 models for free-tier analyses).</p>
          </section>

          {/* ── 9 Webhooks ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Webhook and Integration Reliability</h2>
            <p>AiVIS supports webhook delivery to external endpoints (Slack, Discord, Zapier, Notion, Microsoft Teams, Google Chat, and generic HTTPS endpoints). Webhooks are delivered on a <strong className="text-white">best-effort basis</strong>.</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>There is no guaranteed delivery SLA for webhook payloads.</li>
              <li>Failed deliveries are logged but not automatically retried.</li>
              <li>Payloads are signed with HMAC-SHA256 using your configured secret. Verifying signatures on your end is strongly recommended but is your responsibility.</li>
              <li>Delivery order is not guaranteed. Events may arrive out of sequence.</li>
              <li>Webhook endpoints must respond within 10 seconds or the delivery is considered failed.</li>
            </ul>
            <p className="mt-2">Do not build mission critical workflows that depend solely on webhook delivery without independent verification.</p>
          </section>

          {/* ── 10 Caching ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Data Caching and Freshness</h2>
            <p>Analysis results are cached server-side for performance. Cache behavior varies by tier:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Observer (Free):</strong> Results cached for up to 7 days. No force-refresh option.</li>
              <li><strong className="text-white">Alignment / Signal / AutoFix PR:</strong> Results cached for up to 30 days. Force-refresh bypasses cache and executes a fresh analysis (consumes a scan credit).</li>
            </ul>
            <p className="mt-2">Cached results reflect the state of the page at the time of the original analysis, not the current state. If you make changes to your site, use force-refresh (paid tiers) to generate updated results.</p>
            <p className="mt-2">Each analysis report displays an <strong className="text-white">execution class badge</strong> (LIVE, DETERMINISTIC_FALLBACK, SCRAPE_ONLY, or UPLOAD) indicating the conditions under which the analysis was performed.</p>
          </section>

          {/* ── 11 Model Transparency ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Model Selection and Cost Transparency</h2>
            <p>The AI models used in your analysis depend on your subscription tier:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Observer (Free):</strong> Free-tier model variants (non-reasoning models selected for reliable JSON output). Extended fallback chain of up to 6 models. $0.00 cost per scan to Intruvurt Labs.</li>
              <li><strong className="text-white">Alignment ($49/mo):</strong> Higher-capability models. Approximately $0.002 cost per scan to Intruvurt Labs.</li>
              <li><strong className="text-white">Signal ($149/mo):</strong> Triple-check pipeline (3 sequential models). Approximately $0.004 cost per scan to Intruvurt Labs.</li>
            </ul>
            <p className="mt-2">Model names, providers, and routing are subject to change as model availability and pricing evolves on upstream platforms. The analysis response includes model attribution metadata so you can verify which models processed your request.</p>
          </section>

          {/* ── 12 Scheduled Rescans ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Scheduled Rescans</h2>
            <p>Paid-tier users can configure automatic rescans on daily, weekly, or monthly schedules. Each scheduled rescan consumes a scan credit from your tier allowance.</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Scheduled rescans are executed on a best-effort basis. Server maintenance, provider outages, or rate limiting may delay execution.</li>
              <li>If your scan allowance is exhausted, scheduled rescans will be skipped until the next billing cycle.</li>
              <li>Notifications for completed rescans are delivered via your configured channels (email, webhook) subject to those delivery mechanisms' own reliability constraints.</li>
            </ul>
          </section>

          {/* ── 13 Exports ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Report Exports and Shared Links</h2>
            <p>AiVIS supports PDF report generation and shareable link creation.</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Exported reports capture the analysis state at the time of export. They are not dynamically updated.</li>
              <li>Shared links provide read-only access to a specific audit and may expire based on your tier's sharing policy.</li>
              <li>You are responsible for the distribution of exported reports and shared links. Once shared, Intruvurt Labs cannot control who accesses the content.</li>
              <li>GDPR data exports (JSON format) are available via account settings or by emailing <a href="mailto:privacy@aivis.biz" className={emailCls}>privacy@aivis.biz</a>.</li>
            </ul>
          </section>

          {/* ── 14 Score Fix ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">14. Score Fix and Automated Remediation</h2>
            <p>Score Fix ($1499 one-time) includes automated code-level remediation that can generate pull requests with evidence-linked fixes.</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Generated code changes are <strong className="text-white">suggestions</strong>, not guaranteed fixes. Always review auto-generated pull requests before merging.</li>
              <li>Automated remediation targets structural issues (missing markup, heading fixes, metadata additions). It does not rewrite content, redesign pages, or refactor application logic.</li>
              <li>Score Fix credits are non-refundable once any credits have been consumed.</li>
              <li>Generated PRs require GitHub App authorization. Intruvurt Labs accesses only the repositories you explicitly authorize.</li>
            </ul>
          </section>

          {/* ── 15 Team / API ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">15. Team Workspaces and API Access</h2>
            <p><strong className="text-white">Team workspaces</strong> (Signal+ tiers) enable multi-user access with role-based permissions. Workspace data is isolated per team. Team administrators control member access and can remove members at any time.</p>
            <p className="mt-2"><strong className="text-white">API keys</strong> provide programmatic access scoped by permission. API keys grant access equivalent to your account's tier. You are responsible for securing API keys and monitoring their usage. Compromised keys should be revoked immediately in account settings.</p>
            <p className="mt-2">API rate limits are enforced per key and per tier. Exceeding limits results in HTTP 429 responses, not account suspension (unless abuse patterns are detected).</p>
          </section>

          {/* ── 16 Email ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">16. Email Delivery</h2>
            <p>Transactional emails (verification, password reset, analysis reports, billing receipts) and optional marketing emails are delivered through Resend. Intruvurt Labs does not guarantee email delivery. Factors outside our control include:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Recipient spam filters, quarantine rules, or mailbox full conditions.</li>
              <li>Email provider reputation filtering or temporary blocks.</li>
              <li>DNS propagation delays for domain verification.</li>
              <li>Resend platform outages or rate limiting.</li>
            </ul>
            <p className="mt-2">If you do not receive expected emails, check your spam folder and add <strong className="text-white">noreply@aivis.biz</strong> to your contacts. For persistent delivery issues, contact <a href="mailto:support@aivis.biz" className={emailCls}>support@aivis.biz</a>.</p>
          </section>

          {/* ── 17 Uptime ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">17. Service Availability</h2>
            <p>AiVIS does not offer a formal Service Level Agreement (SLA). We target high availability but the Service may experience downtime for maintenance, infrastructure updates, or provider outages. We will communicate planned maintenance in advance when possible.</p>
            <p className="mt-2">The platform includes graceful degradation: if the AI pipeline partially fails, earlier valid results are preserved and the response shape remains stable. However, total outages of critical dependencies (database, hosting) will render the Service unavailable.</p>
          </section>

          {/* ── 18 Reverse Engineering Tools ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">18. Reverse Engineering and Prompt Intelligence</h2>
            <p>AiVIS includes tools that analyze how AI models perceive and process web content (prompt decompilation, ghost queries, model-diff, answer simulation). These tools:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Produce <strong className="text-white">inferred approximations</strong>, not actual model internals. They do not access proprietary model weights, training data, or architecture.</li>
              <li>Are subject to the same AI accuracy limitations described in Section 1.</li>
              <li>Should be used in compliance with all applicable laws, including the terms of service of the AI platforms being analyzed.</li>
            </ul>
          </section>

          {/* ── 19 Referral ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">19. Referral Program</h2>
            <p>AiVIS may offer referral credits for inviting new users. Referral credits are promotional and may be modified or discontinued at any time without notice. Credits cannot be exchanged for cash, transferred between accounts, or combined with other promotions unless explicitly stated.</p>
          </section>

          {/* ── 20 Regulatory ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">20. Regulatory and Compliance Notice</h2>
            <p>AiVIS is a software tool, not a regulated financial, legal, medical, or cybersecurity service. Outputs should not be relied upon to satisfy regulatory compliance obligations (SOC 2, HIPAA, PCI DSS, etc.) unless independently validated.</p>
            <p className="mt-2">If you operate in a regulated industry, consult your compliance team before using AiVIS outputs in compliance documentation or audit evidence.</p>
          </section>

          {/* ── 21 Contact ── */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">21. Questions About These Disclosures</h2>
            <p>If you have questions about any disclosure on this page, contact us:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>General: <a href="mailto:hello@aivis.biz" className={emailCls}>hello@aivis.biz</a></li>
              <li>Legal: <a href="mailto:legal@aivis.biz" className={emailCls}>legal@aivis.biz</a></li>
              <li>Privacy: <a href="mailto:privacy@aivis.biz" className={emailCls}>privacy@aivis.biz</a></li>
              <li>Phone: <a href="tel:+17069075299" className={emailCls}>(706) 907-5299</a></li>
            </ul>
            <p className="mt-4 text-white/60 text-sm">Intruvurt Labs · Georgia, USA</p>
          </section>
        </div>
    </PublicPageFrame>
  );
}
