import React from "react";
import { Shield } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";
import PublicPageFrame from "../components/PublicPageFrame";

export default function PrivacyPage() {
  usePageMeta({
    title: 'Privacy Policy | AiVIS AI Visibility Platform',
    description: 'How AiVIS and Intruvurt Labs collect, use, and protect your data. Read our full privacy policy.',
    path: '/privacy',
    structuredData: [
      buildWebPageSchema({ path: '/privacy', name: 'AiVIS Privacy Policy', description: 'Data collection, usage, and protection practices for the AiVIS platform.' }),
      buildBreadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Privacy Policy', path: '/privacy' }]),
    ],
  });

  return (
    <PublicPageFrame icon={Shield} title="Privacy Policy" subtitle="How Intruvurt Labs collects, uses, and protects your data on the AiVIS platform" maxWidthClass="max-w-4xl">
      <p className="text-white/55 text-sm mb-10">Last updated: February 17, 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-white/75 leading-relaxed bg-charcoal-deep rounded-2xl p-6 border border-white/10">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">The Short Version</h2>
            <p>Your data is yours. We collect what we need to run the Service, we don't sell it to anyone, and we give you control over what's stored. If you want something deleted, just ask. That's the vibe.</p>
            <p className="mt-2">Aivis.biz is operated by Intruvurt Labs, a company based in Georgia, USA. We're the data controller for any personal information collected through this Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What We Collect</h2>
            <p>When you use Ai Visibility Intelligence Audits & Monitoring, the system collects a few categories of information:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Account stuff:</strong> Your email address and a hashed version of your password. We never store passwords in plain text.</li>
              <li><strong className="text-white">Usage data:</strong> The URLs you submit for analysis, your analysis results, and how you interact with features. This helps us improve the product.</li>
              <li><strong className="text-white">Device info:</strong> Browser type, IP address, and approximate location. We use this for security (detecting suspicious login attempts) and basic analytics.</li>
              <li><strong className="text-white">Payment info:</strong> If you upgrade to a paid tier, Stripe handles all payment processing. We never see or store your full card number. We only keep a record of your subscription status.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Info</h2>
            <p>Pretty straightforward stuff:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>To run the Service and process your analysis requests</li>
              <li>To manage your account, verify your email, and provide support</li>
              <li>To send you important updates about the Service (security alerts, billing issues, major changes)</li>
              <li>To detect and prevent abuse, fraud, and security threats</li>
              <li>To improve AiVIS based on aggregate usage patterns</li>
            </ul>
            <p className="mt-2">We don't use your data for targeted advertising. We don't build profiles to sell to third parties. That business model isn't ours.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Who We Share With</h2>
            <p>We don't sell your personal data. Full stop. But we do work with some partners to keep the Service running:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">AI analysis providers:</strong> When you submit a URL, that URL (not your personal info) gets sent to our AI pipeline via OpenRouter. They process the page content and return analysis.</li>
              <li><strong className="text-white">Infrastructure:</strong> We use Render for hosting, Neon for our PostgreSQL database, and Sentry for error tracking and performance monitoring. When you consent to analytics, Sentry may also capture anonymised session replays (with all text masked and media blocked) to help us diagnose issues. These services process data on our behalf under strict agreements.</li>
              <li><strong className="text-white">Payments:</strong> Stripe handles subscription billing. They have their own privacy policy and are PCI compliant.</li>
            </ul>
            <p className="mt-2">If we're ever legally required to disclose information (like a valid court order), we'll comply with applicable law. But we'll push back on overly broad requests and notify you when legally permitted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Retention</h2>
            <p>We keep different types of data for different periods:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Analysis cache:</strong> Results are cached for up to 7 days for Observer tier, longer for paid tiers. Cached results are returned faster but may differ from a fresh live run. When you force a refresh (paid tiers), we bypass cache and execute a new analysis. Each analysis report indicates whether it was cached or fresh via the execution class badge.</li>
              <li><strong className="text-white">Account data:</strong> Kept as long as your account exists. When you delete your account, we remove your personal information within 30 days.</li>
              <li><strong className="text-white">Usage logs:</strong> Security and access logs are retained for up to 90 days, then automatically purged.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Cookies and Similar Tech</h2>
            <p>We keep browser storage minimal:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Essential (sessionStorage):</strong> Authentication tokens are stored in your browser's sessionStorage and are automatically cleared when you close the browser. Your cookie-consent preference is stored in localStorage. These are not browser cookies and are never sent to third parties.</li>
              <li><strong className="text-white">Analytics (consent required):</strong> If you click "Got it" on the consent banner, we enable Sentry error tracking, performance monitoring, and anonymised session replays. Sentry helps us detect bugs and improve reliability. If you dismiss the banner, none of this is activated.</li>
            </ul>
            <p className="mt-2">We don't use tracking cookies for advertising. No Facebook pixels, no Google remarketing tags, none of that. You can withdraw your analytics consent at any time from Settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Security Measures</h2>
            <p>We take security seriously. Here's what we do:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>All connections encrypted via TLS (that padlock in your browser)</li>
              <li>Passwords hashed using bcrypt before storage</li>
              <li>Rate limiting to prevent brute force attacks</li>
              <li>SSRF protection to prevent malicious URL submissions</li>
              <li>Email verification required before account access</li>
              <li>JWT tokens with expiration for session management</li>
            </ul>
            <p className="mt-2">That said, no system is 100% bulletproof. If you discover a security vulnerability, email us at <a href="mailto:security@aivis.biz" className="text-white/85 hover:text-white/85">security@aivis.biz</a> and we'll address it promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
            <p>Depending on where you live, you have certain rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Access:</strong> You can request a copy of the personal data we hold about you.</li>
              <li><strong className="text-white">Correction:</strong> If something's wrong, let us know and we'll fix it.</li>
              <li><strong className="text-white">Deletion:</strong> You can request deletion of your account and associated data.</li>
              <li><strong className="text-white">Export:</strong> We can provide your data in a portable format upon request.</li>
              <li><strong className="text-white">Opt out:</strong> You can opt out of analytics and non-essential cookies.</li>
            </ul>
            <p className="mt-2"><strong className="text-white">For California residents (CCPA):</strong> You have the right to know what personal information we collect, request deletion, and opt out of any "sale" of personal info. We don't sell personal information, but you can still exercise your rights by contacting us.</p>
            <p className="mt-2"><strong className="text-white">For Georgia residents:</strong> Georgia doesn't currently have a comprehensive consumer privacy law like California, but we extend the same rights to all users regardless of location.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Children's Privacy</h2>
            <p>Ai Visibility Intelligence Audits & Monitoring is not intended for anyone under 16 years old. We don't knowingly collect personal information from children. If you believe a child has provided us with personal data, contact us immediately and we'll delete it.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. International Users</h2>
            <p>Ai Visibility Intelligence Audits & Monitoring is operated from the United States. If you're accessing the Service from outside the US, your data will be transferred to and processed in the United States. By using Ai Visibility Intelligence Audits & Monitoring, you consent to this transfer.</p>
            <p className="mt-2">We implement appropriate safeguards for international data transfers where required by applicable law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>Privacy practices evolve, and so does this policy. When we make material changes, we'll notify you via email or through the Service at least 30 days before they take effect. We'll also update the "Last updated" date at the top.</p>
            <p className="mt-2">Minor changes (typos, clarifications) might happen without notice, but anything that affects your rights gets communicated properly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact Us</h2>
            <p>Got questions about privacy? Want to exercise your rights? Just want to know more about how we handle data? Hit us up:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Privacy inquiries: <a href="mailto:privacy@aivis.biz" className="text-white/85 hover:text-white/85">privacy@aivis.biz</a></li>
              <li>Security reports: <a href="mailto:security@aivis.biz" className="text-white/85 hover:text-white/85">security@aivis.biz</a></li>
              <li>General support: <a href="mailto:support@aivis.biz" className="text-white/85 hover:text-white/85">support@aivis.biz</a></li>
              <li>Phone: <a href="tel:+17069075299" className="text-white/85 hover:text-white/85">(706) 907-5299</a></li>
            </ul>
            <p className="mt-4">We respond to privacy inquiries within 30 days, usually faster.</p>
            <p className="mt-4 text-white/60 text-sm">Intruvurt Labs • Georgia, USA</p>
          </section>
        </div>
    </PublicPageFrame>
  );
}
