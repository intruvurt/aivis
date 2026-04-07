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
    name: 'Ryan Mason',
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
    name: 'About AiVIS; AI visibility intelligence platform & Remediation Platform',
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
      title="About AiVIS"
      subtitle="Enterprise-grade AI visibility Evidence-backed auditing and Auto scorefix PR platform built for agencies, teams, and operators."
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
            About AiVIS
          </h1>
          <p className="text-lg text-white/70 max-w-3xl mx-auto">
            Comprehensive citation  tracking engine and Ai visibility evidence-backed auditing platform built for freelancers, solopreneurs, agencies, teams and organizations that demand proof of their digital authority.
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

      {/* Hook — human layer */}
      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-xl md:text-2xl text-white/85 font-medium leading-relaxed mb-3">
          Most websites are not broken.
        </p>
        <p className="text-xl md:text-2xl text-white/85 font-medium leading-relaxed mb-6">
          They just aren&apos;t understood.
        </p>
        <p className="text-lg text-white/60 leading-relaxed mb-3">
          AI reads them, hesitates, and moves on.
        </p>
        <p className="text-lg text-white/60 leading-relaxed mb-3">
          No error. No warning. Just silence.
        </p>
        <p className="text-lg text-white/55 leading-relaxed">
          That silence is where visibility is lost now.
        </p>
      </section>

      {/* Why AiVIS exists */}
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-xl text-white/80 font-semibold leading-relaxed mb-4">
          AiVIS exists for one reason.
        </p>
        <p className="text-lg text-white/70 leading-relaxed mb-6">
          To show what AI can actually read, trust, and cite from your site.
        </p>
        <p className="text-base text-white/55 leading-relaxed">
          Not what you think it says.<br />
          Not what your SEO tool says.<br />
          What the machine actually uses.
        </p>
      </section>

      {/* Founder signal — trust anchor */}
      <section className="mx-auto max-w-3xl px-4 py-10 text-center border-b border-white/10 mb-4">
        <p className="text-lg text-white/75 leading-relaxed mb-4">
          Built by a solo operator who kept seeing the same problem.
        </p>
        <p className="text-base text-white/60 leading-relaxed mb-4">
          Real businesses. Real services.<br />
          Invisible in AI answers.
        </p>
        <p className="text-base text-white/55 leading-relaxed">
          Not because they were bad.<br />
          Because they were unclear to machines.
        </p>
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
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/25 to-cyan-400/10 border border-blue-400/20 flex items-center justify-center mb-4 backdrop-blur-sm shadow-lg shadow-blue-500/10">
                    {/* Glassy tech avatar — code brackets + magnifying glass */}
                    <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="rmGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                        </linearGradient>
                        <linearGradient id="rmAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#22d3ee" />
                        </linearGradient>
                      </defs>
                      {/* Glassy backdrop circle */}
                      <circle cx="32" cy="32" r="30" fill="url(#rmGlass)" stroke="url(#rmAccent)" strokeWidth="1.2" opacity="0.85" />
                      {/* Left bracket { */}
                      <path d="M18 18 C14 18, 13 22, 13 26 L13 29 C13 31, 11 32, 11 32 C11 32, 13 33, 13 35 L13 38 C13 42, 14 46, 18 46" stroke="url(#rmAccent)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
                      {/* Right bracket } */}
                      <path d="M46 18 C50 18, 51 22, 51 26 L51 29 C51 31, 53 32, 53 32 C53 32, 51 33, 51 35 L51 38 C51 42, 50 46, 46 46" stroke="url(#rmAccent)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
                      {/* Magnifying glass */}
                      <circle cx="32" cy="29" r="9" stroke="url(#rmAccent)" strokeWidth="1.8" fill="none" opacity="0.6" />
                      <circle cx="32" cy="29" r="9" fill="rgba(96,165,250,0.08)" />
                      <line x1="38.5" y1="35.5" x2="44" y2="41" stroke="url(#rmAccent)" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
                      {/* Lens glint */}
                      <path d="M27 25 Q29 22, 33 24" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" fill="none" />
                      {/* Code dot accents */}
                      <circle cx="22" cy="32" r="1.2" fill="#60a5fa" opacity="0.5" />
                      <circle cx="42" cy="32" r="1.2" fill="#22d3ee" opacity="0.5" />
                    </svg>
                  </div>
                </div>

                <h3 className="text-2xl font-bold mb-1 text-blue-800 dark:text-blue-200">R. Mason</h3>
                <p className="text-lg text-white/60 mb-6">Head of AiVIS, product of Intruvurt Labs</p>

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
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/25 to-emerald-400/10 border border-cyan-400/20 flex items-center justify-center mb-4 backdrop-blur-sm shadow-lg shadow-cyan-500/10">
                  {/* Glassy tech avatar — broadcast signal + growth chart */}
                  <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="skGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                      </linearGradient>
                      <linearGradient id="skAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                    </defs>
                    {/* Glassy backdrop */}
                    <circle cx="32" cy="32" r="30" fill="url(#skGlass)" stroke="url(#skAccent)" strokeWidth="1.2" opacity="0.85" />
                    {/* Broadcast tower */}
                    <line x1="32" y1="18" x2="32" y2="38" stroke="url(#skAccent)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                    <circle cx="32" cy="16" r="2.5" fill="url(#skAccent)" opacity="0.6" />
                    {/* Signal waves */}
                    <path d="M24 22 Q28 14, 32 16" stroke="url(#skAccent)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.4" />
                    <path d="M40 22 Q36 14, 32 16" stroke="url(#skAccent)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.4" />
                    <path d="M20 26 Q26 12, 32 16" stroke="url(#skAccent)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.25" />
                    <path d="M44 26 Q38 12, 32 16" stroke="url(#skAccent)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.25" />
                    {/* Growth chart bars */}
                    <rect x="20" y="44" width="5" height="6" rx="1.5" fill="url(#skAccent)" opacity="0.35" />
                    <rect x="27" y="40" width="5" height="10" rx="1.5" fill="url(#skAccent)" opacity="0.45" />
                    <rect x="34" y="36" width="5" height="14" rx="1.5" fill="url(#skAccent)" opacity="0.55" />
                    <rect x="41" y="32" width="5" height="18" rx="1.5" fill="url(#skAccent)" opacity="0.65" />
                    {/* Trend arrow */}
                    <path d="M22 43 L36 33 L44 30" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                    <path d="M41 28 L44 30 L42 33" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinecap="round" fill="none" />
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
            Live controls should be stated conservatively. This page avoids third party attestation claims unless they are published and verifiable.
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
          <h2 className="text-3xl brand-title mb-12 text-center">What the system actually evaluates</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <Lightbulb className="w-6 h-6 text-white/80" />
                <h3 className="text-xl font-bold">Citation Auditing</h3>
              </div>
              <p className="text-white/70 mb-4">
                Discover how AI platforms and search engines reference your organization, content and authority. Get precise citation positioning and competitive intelligence.
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
                Unified AI visibility score that measures machine readability, extractability, trust architecture and citation-readiness across all critical dimensions.
              </p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>✓ Realtime domain analysis</li>
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

      {/* Proof block */}
      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-xl text-white/80 font-medium leading-relaxed mb-4">
          Most first scans land between C and D.
        </p>
        <p className="text-base text-white/60 leading-relaxed mb-4">
          Not because the business is weak.<br />
          Because structure, schema, and clarity are misaligned.
        </p>
        <p className="text-base text-white/55 leading-relaxed">
          The system exists to move that score with real fixes, not opinions.
        </p>
      </section>

      {/* Closing — urgency + clarity */}
      <section className="px-4 py-16 bg-white/5 border-t border-white/10">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl text-white/85 font-semibold leading-relaxed mb-4">
            If your site isn&apos;t being cited, it&apos;s already being replaced.
          </p>
          <p className="text-lg text-white/70 leading-relaxed mb-4">
            AiVIS shows why.
          </p>
          <p className="text-lg text-white/60 leading-relaxed mb-8">
            And gives you a way to fix it.
          </p>
          <a
            href="/analyze"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition-colors"
          >
            Run your first audit
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Footer micro-copy */}
      <footer className="px-4 py-12 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-white/50 text-center">
            Intruvurt Labs • Pro-grade Citation & AI Visibility Platform
            <br />
            US Federal Registration Pending • Security posture shown from live controls only
          </p>
        </div>
      </footer>
    </PublicPageFrame>
  );
}
