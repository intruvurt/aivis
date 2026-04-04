import React from "react";
import { Shield, CheckCircle2, Users, Lightbulb, GitBranch, ArrowRight, Info } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "../components/PublicPageFrame";
import {
  AUTHOR_ID,
  BASE_URL,
  ORGANIZATION_ID,
  buildOrganizationSchema,
  buildWebPageSchema,
  buildBreadcrumbSchema,
  buildPersonSchema,
} from "../lib/seoSchema";
import { PLATFORM_NARRATIVE } from "../constants/platformNarrative";
import PlatformShiftBanner from "../components/PlatformShiftBanner";

const ABOUT_STRUCTURED_DATA = [
  buildOrganizationSchema(),
  buildPersonSchema({
    id: AUTHOR_ID,
    name: 'Intruvurt Labs',
    jobTitle: 'AI Visibility Engineer',
    url: `${BASE_URL}/about`,
    description: 'AiVIS author profile for AI visibility engineering, machine readability, and citation-readiness strategy.',
    worksForId: ORGANIZATION_ID,
    knowsAbout: [
      'AI visibility',
      'answer engine optimization',
      'structured SEO',
      'machine readability',
      'AI citation readiness',
    ],
    sameAs: [
      'https://linkedin.com/in/web4aidev',
      'https://twitter.com/intruvurt',
      'https://www.reddit.com/user/intruvurt/',
      'https://www.reddit.com/r/AiVIS/',
    ],
  }),
  buildWebPageSchema({
    path: '/about',
    name: 'About Intruvurt Labs – AiVIS AI Visibility Platform',
    description: 'Enterprise citation engine and AI visibility auditing platform. Founded December 2025. Named founder: Ryan Mason, Head of Intruvurt Labs.',
  }),
  buildBreadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
  ]),
];

export default function AboutPage() {
  usePageMeta({
    title: 'About Intruvurt Labs | AiVIS \u2013 AI Visibility Intelligence Audits',
    description: 'Intruvurt Labs: enterprise AI citation engine and visibility auditing platform. Founded December 2025. Ryan Mason, Head of Intruvurt Labs.',
    path: '/about',
    ogTitle: 'About AiVIS \u2013 Built by Intruvurt Labs',
    ogDescription: 'Intruvurt Labs builds enterprise-grade AI visibility intelligence tools. Named founder: Ryan Mason. US Federal Registration Pending.',
    structuredData: ABOUT_STRUCTURED_DATA,
  });
  return (
    <PublicPageFrame
      icon={Info}
      title="About Intruvurt Labs"
      subtitle="Enterprise-grade AI visibility auditing platform built for agencies, teams, and operators."
      backTo="/"
      maxWidthClass="max-w-6xl"
    >

      {/* Hero section */}
      <section className="py-4 md:py-10">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img
              src="/aivis-logo.png"
              alt="AiVIS"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-lg object-contain"
              loading="lazy"
            />
            <span className="text-xl font-bold text-white tracking-tight">AiVIS</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            About Intruvurt Labs
          </h1>
          <p className="text-lg text-white/70 max-w-3xl mx-auto">
            Enterprise-grade citation engine and AI visibility auditing platform built for agencies, teams, and organizations that demand proof of their digital authority.
          </p>
          <div className="mt-6 max-w-3xl mx-auto text-left">
            <PlatformShiftBanner
              eyebrow="Founder edge"
              title={PLATFORM_NARRATIVE.proofOfStruggle}
              body={PLATFORM_NARRATIVE.disruption}
              bullets={PLATFORM_NARRATIVE.demoSteps}
              tone="amber"
            />
          </div>
        </div>
      </section>

      {/* Company mission */}
      <section className="-mx-4 border-y border-white/10 bg-white/5 px-4 py-16 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl brand-title mb-4">Our Mission</h2>
              <p className="text-white/70 mb-4">
                We help organizations understand how AI and search engines see, extract, and cite their digital presence. In an era where AI-generated content drives discovery, citation readiness is competitive advantage.
              </p>
              <p className="text-white/70">
                Every audit is a proof point. Every recommendation is actionable. Every citation is verifiable.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                <h3 className="font-semibold mb-1 text-white/90">Founded</h3>
                <p className="text-white/60">December 2025</p>
              </div>
              <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                <h3 className="font-semibold mb-1 text-white/90">Registration Status</h3>
                <p className="text-white/60">US Federal Pending (GOV SOS)</p>
              </div>
              <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                <h3 className="font-semibold mb-1 text-white/90">Headquarters</h3>
                <p className="text-white/60">United States</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder section */}
      <section className="py-16" id="leadership">
        <div>
          <h2 className="text-3xl brand-title mb-12 text-center">Leadership</h2>

          <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5">
              {/* Founder card */}
              <div className="p-8 md:p-12">
                <div className="mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Users className="w-10 h-10 text-white/60" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold mb-1 text-blue-800 dark:text-blue-200">R. Mason</h3>
                <p className="text-lg text-white/60 mb-6">Head of Intruvurt Labs</p>

                <p className="text-white/70 leading-relaxed mb-4">
                  R. Mason leads the vision and engineering at Intruvurt Labs. With deep expertise in citation architecture, machine readability, and AI extractability, Mason drives the platform&apos;s commitment to enterprise-grade visibility auditing.
                </p>

                <p className="text-white/70 leading-relaxed mb-4">
                  The mission: help businesses survive the shift from searchable websites to AI-readable entities with evidence, remediation, and measurable movement.
                </p>

                <div className="mb-4 flex flex-wrap gap-3 text-sm">
                  <a
                    href="https://linkedin.com/in/web4aidev"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    LinkedIn
                  </a>
                  <a
                    href="https://twitter.com/intruvurt"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    X <span className="text-white/40">(Twitter)</span>
                  </a>
                  <a
                    href="https://www.reddit.com/user/intruvurt/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    Reddit u/intruvurt <span className="text-white/40">(Founder)</span>
                  </a>
                  <a
                    href="https://www.reddit.com/r/AiVIS/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    Reddit r/AiVIS <span className="text-white/40">(Community)</span>
                  </a>
                  <a
                    href="https://stackoverflow.com/users/29677022/intruvurt"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    Stack Overflow
                  </a>
                </div>

                <div className="mb-4 flex flex-wrap gap-3 text-sm">
                  <a href="mailto:hello@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">hello@aivis.biz</a>
                  <a href="mailto:founder@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">founder@aivis.biz</a>
                  <a href="mailto:partners@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">partners@aivis.biz</a>
                  <a href="mailto:sales@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">sales@aivis.biz</a>
                  <a href="mailto:info@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">info@aivis.biz</a>
                  <a href="mailto:support@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">support@aivis.biz</a>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs text-white/50 mb-3">Focus areas:</p>
                  <div className="flex flex-wrap gap-2">
                    {["Citation Parity", "Machine Readability", "AI Optimization", "Executive Audit"].map((topic) => (
                      <span key={topic} className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white/70">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 bg-white/5 border-y border-white/10" id="team">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl brand-title mb-4 text-center">The Team</h2>
          <p className="text-white/60 text-center max-w-2xl mx-auto mb-12">
            The people behind AiVIS: building visibility intelligence from research to reach.
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Sadiq Khan - Platform Marketing Specialist */}
            <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5 p-5 md:p-8">
              <div className="mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-300/5 border border-cyan-400/15 flex items-center justify-center mb-4">
                  {/* Unique soccer ball SVG for Sadiq */}
                  <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="30" stroke="currentColor" className="text-cyan-400/50" strokeWidth="2" fill="none" />
                    <circle cx="32" cy="32" r="28" className="fill-cyan-500/10" />
                    {/* Pentagon panels */}
                    <polygon points="32,12 38,20 35,28 29,28 26,20" className="fill-cyan-400/30" stroke="currentColor" strokeWidth="1" />
                    <polygon points="48,26 50,35 44,40 38,36 40,27" className="fill-cyan-400/30" stroke="currentColor" strokeWidth="1" />
                    <polygon points="16,26 24,27 26,36 20,40 14,35" className="fill-cyan-400/30" stroke="currentColor" strokeWidth="1" />
                    <polygon points="22,46 28,42 36,42 42,46 38,54 26,54" className="fill-cyan-400/30" stroke="currentColor" strokeWidth="1" />
                    {/* Connecting hexagonal seams */}
                    <path d="M32 12L26 20M32 12L38 20M38 20L40 27M40 27L48 26M40 27L38 36M38 36L44 40M38 36L36 42M36 42L42 46M36 42L28 42M28 42L22 46M28 42L26 36M26 36L20 40M26 36L24 27M24 27L16 26M24 27L26 20M26 20L29 28M29 28L35 28M35 28L38 20" className="stroke-cyan-300/25" strokeWidth="0.8" />
                    {/* Subtle highlight */}
                    <circle cx="24" cy="18" r="6" className="fill-white/5" />
                  </svg>
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-1 text-cyan-200">Sadiq Khan</h3>
              <p className="text-lg text-white/60 mb-2">Platform Marketing Specialist</p>
              <p className="text-xs text-white/40 mb-6">India (UTC+5:30)</p>

              <p className="text-white/70 leading-relaxed mb-4">
                Sadiq leads distribution, content marketing, and platform growth strategy at AiVIS. Focused on driving organic reach through SEO, Answer Engine Optimization, and community-led visibility campaigns across high-intent channels.
              </p>

              <p className="text-white/70 leading-relaxed mb-4">
                Responsible for outreach, content pipeline, partnership coordination, and ensuring the platform reaches builders and agencies who need AI visibility intelligence.
              </p>

              <div className="mt-4 rounded-lg border border-cyan-400/15 bg-cyan-500/5 p-4">
                <p className="text-xs uppercase tracking-wider text-cyan-300/70 mb-2">Private commission terms</p>
                <ul className="text-sm text-white/65 space-y-1.5">
                  <li>18.5% commission on each successful purchase via referral link</li>
                  <li>Marketing tools and methods chosen at sole discretion of specialist</li>
                  <li>Paid ads budget capped at 10% of sales minus $2,000–$5,000 reserve (refunds &amp; Stripe chargebacks)</li>
                </ul>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-white/50 mb-3">Focus areas:</p>
                <div className="flex flex-wrap gap-2">
                  {["Content Marketing", "AEO Strategy", "Community Growth", "Platform Distribution"].map((topic) => (
                    <span key={topic} className="px-3 py-1 rounded-full text-xs bg-cyan-500/10 border border-cyan-400/15 text-cyan-300/70">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Placeholder for additional team growth */}
            <div className="rounded-lg border border-dashed border-white/10 overflow-hidden bg-white/[0.02] p-8 flex flex-col items-center justify-center text-center">
              <Users className="w-10 h-10 text-white/20 mb-4" />
              <p className="text-white/30 text-sm mb-2">Growing team</p>
              <p className="text-white/20 text-xs">New roles opening as the platform scales</p>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance & Trust section */}
      <section className="px-4 py-16 bg-white/5 border-y border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl brand-title mb-4 text-center">Security & Compliance</h2>
          <p className="text-white/60 text-center max-w-2xl mx-auto mb-12">
            Live controls should be stated conservatively. This page avoids third-party attestation claims unless they are published and verifiable.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* SOC2 */}
            <div className="p-6 rounded-lg border border-white/10 bg-white/5">
              <div className="mb-4 flex items-center gap-3">
                <Shield className="w-6 h-6 text-white/80" />
                <h3 className="font-bold">SOC 2</h3>
              </div>
              <p className="text-sm text-white/70 mb-4">
                No public attestation is claimed here unless a formal report is available for review.
              </p>
              <a href="#compliance" className="text-xs text-white/50 hover:text-white/70 flex items-center gap-1">
                Review live status <ArrowRight className="w-3 h-3" />
              </a>
            </div>

            {/* VANTA */}
            <div className="p-6 rounded-lg border border-white/10 bg-white/5">
              <div className="mb-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-white/80" />
                <h3 className="font-bold">VANTA Monitoring</h3>
              </div>
              <p className="text-sm text-white/70 mb-4">
                Monitoring claims should come from the live backend status endpoint, not static marketing copy.
              </p>
              <span className="text-xs text-white/50">Shown only when configured</span>
            </div>

            {/* DRATA */}
            <div className="p-6 rounded-lg border border-white/10 bg-white/5">
              <div className="mb-4 flex items-center gap-3">
                <GitBranch className="w-6 h-6 text-white/80" />
                <h3 className="font-bold">DRATA Evidence</h3>
              </div>
              <p className="text-sm text-white/70 mb-4">
                Evidence collection is only treated as active when it is actually wired and configured.
              </p>
              <span className="text-xs text-white/50">Live status only</span>
            </div>
          </div>

          <div className="mt-12 p-6 rounded-lg border border-white/10 bg-white/5">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white/60" />
              Enterprise Security Standards
            </h4>
            <ul className="grid md:grid-cols-2 gap-3 text-sm text-white/70">
              <li>✓ Passwords hashed before storage</li>
              <li>✓ Role-based access control (RBAC)</li>
              <li>✓ Detailed audit logging and forensics</li>
              <li>✓ Public share tokens encrypted with AES-256-GCM</li>
              <li>✓ Data residency compliance (US)</li>
              <li>✓ No public SOC 2 attestation claim without proof</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Platform focus */}
      <section className="px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl brand-title mb-12 text-center">What We Build</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <Lightbulb className="w-6 h-6 text-white/80" />
                <h3 className="text-xl font-bold">Citation Auditing</h3>
              </div>
              <p className="text-white/70 mb-4">
                Discover how AI platforms and search engines reference your organization, content, and authority. Get precise citation positioning and competitive intelligence.
              </p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>✓ Multi-AI platform citation testing</li>
                <li>✓ Query pack persistence and reuse</li>
                <li>✓ AI-powered query optimization</li>
                <li>✓ Citation parity scoring</li>
              </ul>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-3">
                <Shield className="w-6 h-6 text-white/80" />
                <h3 className="text-xl font-bold">Visibility Scoring</h3>
              </div>
              <p className="text-white/70 mb-4">
                Unified AI visibility score that measures machine readability, extractability, trust architecture, and citation-readiness across all critical dimensions.
              </p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>✓ Real-time domain analysis</li>
                <li>✓ Schema.org completeness audit</li>
                <li>✓ Content hierarchy validation</li>
                <li>✓ Entity clarity scoring</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Recognition */}
      <section className="px-4 py-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl brand-title mb-6">Recognition</h2>
          <p className="text-white/70 leading-relaxed max-w-3xl">
            AiVIS was built to answer a problem most site owners still cannot see clearly. A website can rank, load fast, and still fail where AI systems now shape discovery. We built AiVIS to expose that gap with evidence. In 2026, the platform was nominated for TechCrunch Startup Battlefield Top 200, an early signal that this problem and the way we are solving it are starting to get recognized.
          </p>
        </div>
      </section>

      {/* CTA section */}
      <section className="px-4 py-16 bg-white/5 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl brand-title mb-4">Work With Us</h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Are you building with AI visibility, citation engineering, or need enterprise auditing for your agency? Let's talk.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition-colors"
          >
            Explore Tiers
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Footer micro-copy */}
      <footer className="px-4 py-12 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-white/50 text-center">
            Intruvurt Labs • Enterprise Citation & AI Visibility Platform
            <br />
            US Federal Registration Pending • Security posture shown from live controls only
          </p>
        </div>
      </footer>
    </PublicPageFrame>
  );
}
