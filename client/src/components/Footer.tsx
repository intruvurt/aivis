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
      { label: "DoFollow Backlink", to: "/badge" },
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
    <footer className="relative z-20 border-t border-white/10 bg-[#08101d] py-4 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 sm:px-6 lg:px-8">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/75">AiVIS</span>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/60">
          {linkGroups.flatMap((g) => g.links).map((link) => (
            <Link key={link.to} to={link.to} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> TLS encrypted</span>
          <span className="inline-flex items-center gap-1.5"><Shield className="h-3 w-3" /> No data resale</span>
          <span>© {currentYear} AiVIS.</span>
          <a href="mailto:support@aivis.biz" className="transition hover:text-white">support@aivis.biz</a>
        </div>
      </div>
    </footer>
  );
}
