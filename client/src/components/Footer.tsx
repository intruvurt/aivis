import React from "react";
import { Link } from "react-router-dom";
import { Lock, Shield } from "lucide-react";

const linkGroups = [
  {
    title: "Platform",
    links: [
      { label: "Run Audit", to: "/" },
      { label: "Pricing", to: "/pricing" },
      { label: "Methodology", to: "/methodology" },
      { label: "Integrations", to: "/integrations" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Insights", to: "/insights" },
      { label: "Blog", to: "/blogs" },
      { label: "Guide", to: "/guide" },
      { label: "FAQ", to: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Press", to: "/press" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Disclosures", to: "/disclosures" },
    ],
  },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-20 border-t border-white/10 bg-[#08101d] py-12 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))] lg:px-8">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">AiVIS</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">AI visibility intelligence for teams that need proof, not vibes.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/64">
            Audit whether AI systems can read, trust, and cite your site. Run evidence-backed audits, track movement, and turn blockers into execution.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-white/60">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"><Lock className="h-3.5 w-3.5" /> TLS encrypted</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"><Shield className="h-3.5 w-3.5" /> No data resale</span>
          </div>
        </div>

        {linkGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/52">{group.title}</h3>
            <ul className="space-y-2.5 text-sm">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-white/72 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-white/10 px-4 pt-5 text-xs text-white/50 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <span>© {currentYear} AiVIS. All rights reserved.</span>
        <span>Evidence-grounded AI visibility audits for operators, agencies, and in-house teams.</span>
      </div>
    </footer>
  );
}
