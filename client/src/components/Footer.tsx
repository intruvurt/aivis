import React from "react";
import { Link } from "react-router-dom";

const LOGO_URL = "/aivis-logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-[#060a14]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">Product</h4>
            <ul className="space-y-2.5">
              {[
                { to: "/pricing", label: "Pricing" },
                { to: "/methodology", label: "Methodology" },
                { to: "/compare", label: "Comparisons" },
                { to: "/changelog", label: "Changelog" },
                { to: "/api-docs", label: "API Docs" },
                { to: "/integrations", label: "Integrations" },
              ].map(({ to, label }) => (
                <li key={to}><Link to={to} className="text-sm text-white/40 hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">Resources</h4>
            <ul className="space-y-2.5">
              {[
                { to: "/blogs", label: "Blog" },
                { to: "/guide", label: "Getting Started" },
                { to: "/faq", label: "FAQ" },
                { to: "/insights", label: "Insights" },
                { to: "/help", label: "Help Center" },
                { to: "/glossary", label: "Glossary" },
              ].map(({ to, label }) => (
                <li key={to}><Link to={to} className="text-sm text-white/40 hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">Company</h4>
            <ul className="space-y-2.5">
              {[
                { to: "/about", label: "About" },
                { to: "/press", label: "Press" },
                { to: "/privacy", label: "Privacy" },
                { to: "/terms", label: "Terms" },
                { to: "/compliance", label: "Compliance" },
              ].map(({ to, label }) => (
                <li key={to}><Link to={to} className="text-sm text-white/40 hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">Contact</h4>
            <ul className="space-y-2.5">
              <li><a href="mailto:hello@aivis.biz" className="text-sm text-white/40 hover:text-white transition-colors">hello@aivis.biz</a></li>
              <li><a href="mailto:support@aivis.biz" className="text-sm text-white/40 hover:text-white transition-colors">support@aivis.biz</a></li>
              <li><a href="https://www.reddit.com/r/AiVIS/" target="_blank" rel="noopener noreferrer" className="text-sm text-white/40 hover:text-white transition-colors">Reddit r/AiVIS</a></li>
              <li><a href="https://linkedin.com/in/web4aidev" target="_blank" rel="noopener noreferrer" className="text-sm text-white/40 hover:text-white transition-colors">LinkedIn</a></li>
              <li><a href="https://bsky.app/profile/intruvurt.bsky.social" target="_blank" rel="noopener noreferrer" className="text-sm text-white/40 hover:text-white transition-colors">Bluesky</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="AiVIS" className="h-5 w-auto opacity-60" />
            <span className="text-xs text-white/30">&copy; {currentYear} AiVIS. All rights reserved.</span>
          </div>
          <span className="text-[11px] text-white/20">U.S. Business (EIN on file) &middot; Evidence-backed AI citation diagnosis</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
