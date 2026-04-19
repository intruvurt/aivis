import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Shield, ExternalLink, Mail, Globe, Zap } from 'lucide-react';

const linkGroups = [
  {
    title: 'Platform',
    links: [
      { label: 'Run Audit', to: '/' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Methodology', to: '/methodology' },
      { label: 'Integrations', to: '/integrations' },
      { label: 'API Docs', to: '/api-docs' },
      { label: 'DoFollow Backlink', to: '/badge' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Insights', to: '/insights' },
      { label: 'Blog', to: '/blogs' },
      { label: 'Guide', to: '/guide' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Help Center', to: '/help' },
      { label: 'Substack', to: 'https://dobleduche.substack.com/', external: true },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Press', to: '/press' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
      { label: 'Disclosures', to: '/disclosures' },
    ],
  },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-20 border-t border-white/[0.06] bg-[#060c18] text-white">
      {/* ── Top accent line ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Main grid ── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:grid-cols-4 lg:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-2 lg:pr-8">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="/aivis-logo.png"
                alt="AiVIS.biz"
                width="32"
                height="32"
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="text-lg font-bold tracking-tight text-white">
                AI<span className="text-cyan-400">VIS</span>
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/50 max-w-xs mb-5">
              AiVIS.biz is an AI visibility and entity authority system founded in 2026 that
              measures how AI systems interpret, trust, and cite web content. It operates through
              CITE LEDGER™ and BRAG (Based-Retrieval-Auditable-Grading), producing a verifiable
              record of how a brand is extracted, attributed, and cited within AI-generated answers.
            </p>
            <div className="flex flex-col gap-2 text-xs text-white/40">
              <a
                href="mailto:support@aivis.biz"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-cyan-300"
              >
                <Mail className="h-3.5 w-3.5" />
                support@aivis.biz
              </a>
              <a
                href="https://aivis.biz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-cyan-300"
              >
                <Globe className="h-3.5 w-3.5" />
                aivis.biz
              </a>
            </div>
          </div>

          {/* Link columns */}
          {linkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30 mb-4">
                {group.title}
              </h4>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-1 text-[13px] text-white/50 transition-colors hover:text-white"
                      >
                        {link.label}
                        <ExternalLink className="h-2.5 w-2.5 opacity-0 -translate-y-px group-hover:opacity-60 transition-opacity" />
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-[13px] text-white/50 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Divider ── */}
        <div className="h-px bg-white/[0.06]" />

        {/* ── Bottom bar ── */}
        <div className="flex flex-col items-center justify-between gap-4 py-5 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-white/30">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-emerald-500/60" />
              <span>TLS encrypted</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-cyan-400/50" />
              <span>No data resale</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-400/50" />
              <span>GDPR compliant</span>
            </span>
          </div>

          <p className="text-[11px] text-white/25">
            © {currentYear} AiVIS.biz. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
