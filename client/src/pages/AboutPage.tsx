import React, { useRef, useEffect, useState } from "react";
import { Shield, CheckCircle2, Lightbulb, GitBranch, ArrowRight, Info, HelpCircle, BookOpen, Eye, BarChart3, FileText } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "../components/PublicPageFrame";

/** Scroll-triggered slide-in */
function SlideIn({ from = "left", children, delay = 0, className }: {
  from?: "left" | "right";
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const x = from === "left" ? -60 : 60;
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x }}
      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Fade-up on scroll */
function FadeUp({ children, delay = 0, className }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Animated counter */
function AnimatedCounter({ end, suffix = "", label, delay = 0 }: {
  end: number; suffix?: string; label: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current++;
      setCount(Math.round((current / steps) * end));
      if (current >= steps) { clearInterval(timer); setCount(end); }
    }, stepTime);
    return () => clearInterval(timer);
  }, [inView, end]);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
        {count}{suffix}
      </div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </motion.div>
  );
}
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
    title: 'About Intruvurt Labs | AiVIS \u2013 AI Visibility Intelligence Platform',
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
      subtitle="Enterprise-grade AI visibility evidence-backed auditing and Auto ScoreFix PR platform."
      backTo="/"
      maxWidthClass="max-w-6xl"
    >

      {/* ── Hero ── */}
      <section className="relative py-6 md:py-10 overflow-hidden">
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-blue-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, -20, 0], y: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative text-center">
          <FadeUp>
            <div className="flex items-center justify-center gap-3 mb-4">
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
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 className="text-3xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
              About AiVIS
            </h1>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p className="text-base md:text-lg text-white/65 max-w-2xl mx-auto leading-relaxed">
              Citation tracking engine and AI visibility platform built for freelancers, agencies, and organizations that demand proof of digital authority.
            </p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="mt-5 max-w-2xl mx-auto text-left">
              <PlatformShiftBanner
                eyebrow="Founder edge"
                title={PLATFORM_NARRATIVE.proofOfStruggle}
                body={PLATFORM_NARRATIVE.disruption}
                bullets={PLATFORM_NARRATIVE.demoSteps}
                tone="amber"
              />
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Animated Stats Strip ── */}
      <section className="py-6 border-y border-white/8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          <AnimatedCounter end={9} label="Audit dimensions" delay={0} />
          <AnimatedCounter end={3} label="AI model pipeline" delay={0.1} />
          <AnimatedCounter end={15} suffix="+" label="Free data sources" delay={0.2} />
          <AnimatedCounter end={100} label="Page SEO coverage" delay={0.3} />
        </div>
      </section>

      {/* ── Hook ── */}
      <SlideIn from="right" delay={0.05}>
        <section className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="text-lg md:text-xl text-white/85 font-medium leading-relaxed mb-2">
            Most websites are not broken.
          </p>
          <p className="text-lg md:text-xl text-white/85 font-medium leading-relaxed mb-4">
            They just aren&apos;t understood.
          </p>
          <div className="inline-block h-px w-16 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent mb-4" />
          <p className="text-base text-white/55 leading-relaxed">
            AI reads them, hesitates, and moves on. No error. No warning. Just silence.
            <br />That silence is where visibility is lost now.
          </p>
        </section>
      </SlideIn>

      {/* ── Why AiVIS exists ── */}
      <SlideIn from="left" delay={0.05}>
        <section className="mx-auto max-w-2xl px-4 py-8 text-center">
          <p className="text-lg text-white/80 font-semibold mb-3">
            AiVIS exists for one reason.
          </p>
          <p className="text-base text-white/65 leading-relaxed mb-3">
            To show what AI can actually read, trust, and cite from your site.
          </p>
          <p className="text-sm text-white/45 leading-relaxed">
            Not what you think it says. Not what your SEO tool says. What the machine actually uses.
          </p>
        </section>
      </SlideIn>

      {/* ── Founder signal ── */}
      <FadeUp delay={0.05}>
        <section className="mx-auto max-w-2xl px-4 py-6 text-center border-b border-white/8 mb-2">
          <p className="text-base text-white/70 leading-relaxed mb-2">
            Built by a solo operator who kept seeing the same problem. Real businesses. Real services. Invisible in AI answers.
          </p>
          <p className="text-sm text-white/45">Not because they were bad. Because they were unclear to machines.</p>
        </section>
      </FadeUp>

      {/* ── Mission + Facts ── */}
      <SlideIn from="left" delay={0.05}>
        <section className="border-y border-white/8 bg-white/[0.03] px-4 py-10 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="grid md:grid-cols-[1fr,auto] gap-8 items-start">
            <div>
              <h2 className="text-xl font-bold mb-3 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Our Mission</h2>
              <p className="text-white/65 text-sm leading-relaxed mb-2">
                We help organizations understand how AI and search engines see, extract, and cite their digital presence. In an era where AI-generated content drives discovery, citation readiness is competitive advantage.
              </p>
              <p className="text-white/55 text-sm leading-relaxed">
                Every audit is a proof point. Every recommendation is actionable. Every citation is verifiable.
              </p>
            </div>
            <div className="flex md:flex-col gap-3">
              {[
                { label: "Founded", value: "Dec 2025" },
                { label: "Registration", value: "US Federal Pending" },
                { label: "HQ", value: "United States" },
              ].map((f) => (
                <div key={f.label} className="px-4 py-2.5 rounded-lg border border-white/8 bg-white/[0.04] min-w-[130px]">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{f.label}</p>
                  <p className="text-sm font-medium text-white/75">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </SlideIn>

      {/* ── Leadership ── */}
      <SlideIn from="right" delay={0.05}>
        <section className="py-10" id="leadership">
          <h2 className="text-2xl font-bold mb-8 text-center bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Leadership</h2>

          <div className="max-w-4xl mx-auto grid gap-5 md:grid-cols-2">
            {/* Founder */}
            <motion.div
              className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden"
              whileHover={{ borderColor: "rgba(6,182,212,0.2)" }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src="/founder.png"
                    alt="Ryan Mason, AiVIS founder"
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-full object-cover border border-blue-400/20 shadow-lg shadow-blue-500/10"
                    loading="lazy"
                  />
                  <div>
                    <h3 className="text-lg font-bold text-blue-200">R. Mason</h3>
                    <p className="text-sm text-white/50">Head of AiVIS, Intruvurt Labs</p>
                  </div>
                </div>

                <p className="text-sm text-white/60 leading-relaxed mb-3">
                  Leads vision and engineering. Deep expertise in citation architecture, machine readability, and AI extractability.
                </p>
                <p className="text-sm text-white/55 leading-relaxed mb-4">
                  Mission: help businesses survive the shift from searchable websites to AI-readable entities.
                </p>

                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  {[
                    { label: "LinkedIn", href: "https://linkedin.com/in/web4aidev" },
                    { label: "X", href: "https://twitter.com/intruvurt" },
                    { label: "Reddit", href: "https://www.reddit.com/user/intruvurt/" },
                    { label: "r/AiVIS", href: "https://www.reddit.com/r/AiVIS/" },
                    { label: "Stack Overflow", href: "https://stackoverflow.com/users/29677022/intruvurt" },
                  ].map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/60 hover:border-white/20 hover:text-white transition"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {["hello@aivis.biz", "founder@aivis.biz", "partners@aivis.biz", "sales@aivis.biz", "support@aivis.biz"].map((e) => (
                    <a key={e} href={`mailto:${e}`} className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-white/50 hover:text-white/70 transition">
                      {e}
                    </a>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-white/8 flex flex-wrap gap-1.5">
                  {["Citation Parity", "Machine Readability", "AI Optimization", "Executive Audit"].map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.04] border border-white/8 text-white/55">{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Danielle C. Mason */}
            <motion.div
              className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden"
              whileHover={{ borderColor: "rgba(6,182,212,0.2)" }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src="/marketer.png"
                    alt="Danielle C. Mason, AiVIS Marketing"
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-full object-cover border border-cyan-400/20 shadow-lg shadow-cyan-500/10"
                    loading="lazy"
                  />
                  <div>
                    <h3 className="text-lg font-bold text-cyan-200">Danielle C. Mason</h3>
                    <p className="text-sm text-white/50">Platform Marketing</p>
                    <p className="text-[10px] text-white/30">Atlanta, GA (UTC-5)</p>
                  </div>
                </div>

                <p className="text-sm text-white/60 leading-relaxed mb-3">
                  Leads distribution, content marketing, and platform growth strategy. Drives organic reach through SEO, AEO, and community-led visibility campaigns.
                </p>
                <p className="text-sm text-white/55 leading-relaxed mb-4">
                  Handles outreach, content pipeline, and partnership coordination for agencies and builders.
                </p>

                <div className="mt-4 pt-3 border-t border-white/8 flex flex-wrap gap-1.5">
                  {["Content Marketing", "AEO Strategy", "Community Growth", "Platform Distribution"].map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/8 border border-cyan-400/10 text-cyan-300/60">{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </SlideIn>

      {/* ── What the system evaluates ── */}
      <FadeUp delay={0.05}>
        <section className="px-4 py-10">
          <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">What the system evaluates</h2>
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              {
                icon: Lightbulb, title: "Citation Auditing", color: "text-amber-400",
                desc: "Discover how AI platforms reference your organization, content, and authority.",
                items: ["Multi-AI citation testing", "Query pack persistence", "Citation parity scoring"],
              },
              {
                icon: Eye, title: "Visibility Scoring", color: "text-cyan-400",
                desc: "Unified score that measures machine readability, extractability, and citation-readiness.",
                items: ["Schema.org completeness", "Content hierarchy validation", "Entity clarity scoring"],
              },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                className="p-5 rounded-xl border border-white/8 bg-white/[0.03]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ borderColor: "rgba(255,255,255,0.15)" }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <feat.icon className={`w-5 h-5 ${feat.color}`} />
                  <h3 className="text-base font-bold text-white/90">{feat.title}</h3>
                </div>
                <p className="text-sm text-white/55 mb-3">{feat.desc}</p>
                <ul className="space-y-1 text-xs text-white/50">
                  {feat.items.map((it) => <li key={it}>&#x2713; {it}</li>)}
                </ul>
              </motion.div>
            ))}
          </div>
        </section>
      </FadeUp>

      {/* ── Security & Compliance ── */}
      <SlideIn from="left" delay={0.05}>
        <section className="px-4 py-10 bg-white/[0.03] border-y border-white/8 -mx-4 sm:-mx-6 lg:-mx-8 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-2 text-center bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Security & Compliance</h2>
          <p className="text-xs text-white/40 text-center mb-6">Live controls only. No unverified attestation claims.</p>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-6">
            {[
              { icon: Shield, title: "SOC 2", desc: "No claim without a formal report available for review." },
              { icon: CheckCircle2, title: "VANTA Monitoring", desc: "Shown only when configured and wired to live backend." },
              { icon: GitBranch, title: "DRATA Evidence", desc: "Active only when evidence collection is actually configured." },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                className="p-4 rounded-xl border border-white/8 bg-white/[0.03]"
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <c.icon className="w-5 h-5 text-white/50 mb-2" />
                <h3 className="text-sm font-bold mb-1">{c.title}</h3>
                <p className="text-xs text-white/50">{c.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-white/8 bg-white/[0.03] max-w-4xl mx-auto">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white/50" />
              Enterprise Security Standards
            </h4>
            <div className="grid md:grid-cols-2 gap-1.5 text-xs text-white/55">
              {[
                "Passwords hashed before storage",
                "Role-based access control (RBAC)",
                "Detailed audit logging and forensics",
                "Share tokens encrypted with AES-256-GCM",
                "Data residency compliance (US)",
                "No SOC 2 claim without proof",
              ].map((s) => <span key={s}>&#x2713; {s}</span>)}
            </div>
          </div>
        </section>
      </SlideIn>

      {/* ── Recognition ── */}
      <FadeUp delay={0.05}>
        <section className="px-4 py-8">
          <h2 className="text-xl font-bold mb-3 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Recognition</h2>
          <p className="text-sm text-white/60 leading-relaxed max-w-3xl">
            In 2026, AiVIS was nominated for TechCrunch Startup Battlefield Top 200 &mdash; an early signal that the problem of AI visibility and the way we are solving it are starting to get recognized.
          </p>
        </section>
      </FadeUp>

      {/* ── Quick Links: Help, Guide, Support ── */}
      <FadeUp delay={0.05}>
        <section className="px-4 py-8 border-t border-white/8">
          <h2 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Resources & Support</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { icon: HelpCircle, label: "Help Center", to: "/help", desc: "FAQs & docs" },
              { icon: BookOpen, label: "Guide", to: "/guide", desc: "How to use AiVIS" },
              { icon: BarChart3, label: "Methodology", to: "/methodology", desc: "How we score" },
              { icon: FileText, label: "FAQ", to: "/faq", desc: "Quick answers" },
            ].map((link, i) => (
              <motion.div
                key={link.to}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={link.to}
                  className="block p-4 rounded-xl border border-white/8 bg-white/[0.03] hover:border-cyan-400/20 hover:bg-white/[0.06] transition group text-center"
                >
                  <link.icon className="w-5 h-5 text-white/40 mx-auto mb-2 group-hover:text-cyan-400 transition" />
                  <p className="text-sm font-medium text-white/75 group-hover:text-white transition">{link.label}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{link.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </FadeUp>

      {/* ── Proof ── */}
      <SlideIn from="right" delay={0.05}>
        <section className="mx-auto max-w-2xl px-4 py-8 text-center">
          <p className="text-lg text-white/75 font-medium mb-2">Most first scans land between C and D.</p>
          <p className="text-sm text-white/50 mb-2">Not because the business is weak. Because structure, schema, and clarity are misaligned.</p>
          <p className="text-sm text-white/45">The system exists to move that score with real fixes, not opinions.</p>
        </section>
      </SlideIn>

      {/* ── CTA ── */}
      <FadeUp delay={0.05}>
        <section className="px-4 py-10 bg-gradient-to-b from-white/[0.03] to-transparent border-t border-white/8 -mx-4 sm:-mx-6 lg:-mx-8 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-lg md:text-xl text-white/80 font-semibold mb-2">
              If your site isn&apos;t being cited, it&apos;s already being replaced.
            </p>
            <p className="text-base text-white/55 mb-6">AiVIS shows why &mdash; and gives you a way to fix it.</p>
            <a
              href="/analyze"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/20 transition-all text-sm font-medium"
            >
              Run your first audit
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </FadeUp>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-white/8">
        <p className="text-[10px] text-white/35 text-center leading-relaxed">
          Intruvurt Labs &bull; Pro-grade Citation & AI Visibility Platform
          <br />
          US Federal Registration Pending &bull; Security posture from live controls only
        </p>
      </footer>
    </PublicPageFrame>
  );
}
