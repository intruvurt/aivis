import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";

export default function TermsPage() {
  usePageMeta({
    title: 'Terms of Service | AiVIS AI Visibility Platform',
    description: 'AiVIS terms of service governing use of the AI visibility auditing platform by Intruvurt Labs.',
    path: '/terms',
    structuredData: [
      buildWebPageSchema({ path: '/terms', name: 'AiVIS Terms of Service', description: 'Terms and conditions for using the AiVIS AI visibility auditing platform.' }),
      buildBreadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Terms of Service', path: '/terms' }]),
    ],
  });
  const navigate = useNavigate();
  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/16 to-black" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-charcoal-deep backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <FileText className="h-5 w-5 text-orange-400" />
              Terms of Service
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">Legal terms governing your use of the AiVIS platform by Intruvurt Labs</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lonely-text mb-10">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-white/55 text-sm">Last updated: February 17, 2026</p>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-white/75 leading-relaxed bg-charcoal-deep rounded-2xl p-6 border border-white/10">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. The Deal</h2>
            <p>Look, by using AiVIS you're agreeing to play by these rules. If something here doesn't sit right with you, that's okay. Just don't use the Service. No hard feelings, but no exceptions either.</p>
            <p className="mt-2">AiVIS is operated by Intruvurt Labs, a Georgia based company. When you sign up, you're entering into a binding agreement governed by these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. What We Actually Do</h2>
            <p>AiVIS runs AI powered analysis on publicly accessible websites. We crawl your page, feed it through multiple AI models, and give you a visibility score with actionable recommendations. Think of it as a diagnostic tool for how AI systems perceive your site.</p>
            <p className="mt-2">Real talk though: these results are informational. We're not replacing your SEO consultant, your marketing team, or your common sense. The AI can miss things. It can be wrong. Use the insights as one input among many, not as gospel.</p>
            <p className="mt-2">Every analysis report includes an <strong className="text-white">execution class</strong> badge that tells you whether the analysis was live, deterministic fallback, scrape-only, or upload-based. This helps you understand the runtime conditions and confidence level of the result. Fallback modes indicate temporary unavailability, not accuracy loss.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Account Rules</h2>
            <p>To use AiVIS, you need to create an account. Here's what that means:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>You need a real email address. We verify it, so fake ones won't work.</li>
              <li>Your credentials are your responsibility. If someone logs in with your password, that's on you.</li>
              <li>One human, one account. No bots, no sharing, no automated signups.</li>
              <li>You gotta be at least 16 years old. If you're younger, sorry, come back in a few years.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. What You Can't Do</h2>
            <p>We keep the vibe clean around here. That means you agree <strong className="text-white">not</strong> to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Analyze URLs you have no business analyzing. If it's not your site and you don't have permission, don't submit it.</li>
              <li>Try to hack around rate limits, auth systems, or any security we've put in place.</li>
              <li>Use this tool to spy on competitors in ways that would make your lawyer nervous.</li>
              <li>Reverse engineer, scrape, or automate anything beyond what our official API allows.</li>
              <li>Submit malicious payloads or sketchy URLs designed to break things.</li>
            </ul>
            <p className="mt-2">To report abuse or violations, contact <a href="mailto:abuse@aivis.biz" className="text-white/85 hover:text-white/85">abuse@aivis.biz</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Pricing and Tiers</h2>
            <p>We run a four-tier system:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Observer [Free]:</strong> Includes a live monthly audit allowance for core audits.</li>
              <li><strong className="text-white">Alignment:</strong> Adds higher allowances and expanded workflows for teams shipping regularly.</li>
              <li><strong className="text-white">Signal:</strong> Premium feature access with triple-check workflows.</li>
              <li><strong className="text-white">Score Fix:</strong> Top-tier scan pack with advanced remediation and evidence-linked fix plans.</li>
            </ul>
            <p className="mt-2">Current pricing and plan limits are published on the Pricing page and may be updated from time to time. Payments go through Stripe. We don't see your card number, ever. For billing questions, contact <a href="mailto:billing@aivis.biz" className="text-white/85 hover:text-white/85">billing@aivis.biz</a>. For enterprise or volume inquiries, reach <a href="mailto:sales@aivis.biz" className="text-white/85 hover:text-white/85">sales@aivis.biz</a>. Refunds are handled case by case within 14 days of purchase. After that window closes, sales are final.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Who Owns What</h2>
            <p>Your analysis results belong to you. Use them however you want for your business.</p>
            <p className="mt-2">The Service itself, including the code, design, algorithms, branding, and everything that makes AiVIS work, that's ours. Intruvurt Labs property. You can't copy it, modify it, sell it, or redistribute it.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. No Guarantees</h2>
            <p>AiVIS is provided "as is" without warranties of any kind, express or implied. AI generated results can be inaccurate, incomplete, or just plain wrong sometimes. We don't guarantee your rankings will improve, your traffic will spike, or that any specific outcome will happen from following our recommendations.</p>
            <p className="mt-2">We work hard to make this tool useful, but we're not making promises about perfection.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Liability Limits</h2>
            <p>To the maximum extent permitted by Georgia law and applicable federal law, Intruvurt Labs shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. This includes lost profits, lost data, business interruption, or any other commercial damages.</p>
            <p className="mt-2">Our total liability for any claims under these terms is limited to the amount you paid us in the 12 months before the claim arose, or $100, whichever is greater.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Termination</h2>
            <p>We can suspend or terminate your account if you violate these terms, abuse the system, or for any other reason at our sole discretion. We'll try to give you notice when possible, but sometimes situations require immediate action.</p>
            <p className="mt-2">You can delete your account anytime by emailing <a href="mailto:support@aivis.biz" className="text-white/85 hover:text-white/85">support@aivis.biz</a>. We'll process your request within 30 days and confirm deletion.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Governing Law</h2>
            <p>These Terms are governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to conflict of law principles. Any legal action or proceeding arising under these Terms will be brought exclusively in the state or federal courts located in Georgia, and you consent to personal jurisdiction in those courts.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Dispute Resolution</h2>
            <p>Before filing any lawsuit, you agree to try resolving disputes informally by contacting us at <a href="mailto:legal@aivis.biz" className="text-white/85 hover:text-white/85">legal@aivis.biz</a>. We'll work in good faith to sort things out within 60 days. If we can't reach a resolution, either party may proceed with formal legal action in Georgia courts.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Changes to These Terms</h2>
            <p>We may update these terms as the Service evolves. When we make material changes, we'll notify you via email or through the Service at least 30 days before they take effect. Continued use after changes go live means you accept the new terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Get in Touch</h2>
            <p>Questions, concerns, or just want to say what's up? Reach us at:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>General: <a href="mailto:hello@aivis.biz" className="text-white/85 hover:text-white/85">hello@aivis.biz</a></li>
              <li>Support: <a href="mailto:support@aivis.biz" className="text-white/85 hover:text-white/85">support@aivis.biz</a></li>
              <li>Legal: <a href="mailto:legal@aivis.biz" className="text-white/85 hover:text-white/85">legal@aivis.biz</a></li>
              <li>Abuse reports: <a href="mailto:abuse@aivis.biz" className="text-white/85 hover:text-white/85">abuse@aivis.biz</a></li>
              <li>Phone: <a href="tel:+17069075299" className="text-white/85 hover:text-white/85">(706) 907-5299</a></li>
            </ul>
            <p className="mt-4 text-white/60 text-sm">Intruvurt Labs • Georgia, USA</p>
          </section>
        </div>
      </main>

    </div>
  );
}
