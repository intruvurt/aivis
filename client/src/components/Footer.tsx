import React from "react";
import { Link } from "react-router-dom";
import { Lock, Shield } from "lucide-react";

const LOGO_URL = "/full-logo.png";

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
    ],
  },
] as const;

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-20 border-t border-white/12 bg-[#111827]/80 py-10 text-white backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <img src={LOGO_URL} alt="AiVIS" className="h-10 w-auto object-contain" loading="lazy" />
          <p className="max-w-sm text-sm leading-6 text-white/70">
            Audit machine readability, extraction quality, and citation readiness across modern AI answer engines.
          </p>
          <div className="space-y-2 text-xs text-white/65">
            <p className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> TLS encrypted platform</p>
            <p className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> No data resale policy</p>
          </div>
        </div>

        {linkGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-white/80">{group.title}</h3>
            <ul className="space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-white/70 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 px-4 pt-5 text-xs text-white/55 sm:px-6 lg:px-8">
        © {currentYear} AiVIS. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
