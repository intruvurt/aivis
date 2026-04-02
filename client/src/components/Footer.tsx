import React from "react";
import { Link } from "react-router-dom";
import { Shield, Lock, Building2 } from "lucide-react";
import { PLATFORM_NARRATIVE } from "../constants/platformNarrative";
import { useTranslation } from "react-i18next";

const LOGO_URL = "/full-logo.png";
const INTRUVURT_LOGO_URL = "/intruvurtlabs-logo.png";

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-20 footer-geo-blend premium-surface text-white dark:text-white py-6 mt-6 border-t border-white/12 dark:border-white/10 overflow-hidden">
      {/* Abstract geometric overlay — subtle uneven tiles blended with logo gradient */}
      <div className="footer-geo-pattern" aria-hidden="true" />
      <div className="footer-geo-gradient" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          {/* Brand */}
          <div>
            <div className="mb-2 flex items-center">
              <img src={LOGO_URL} alt="AiVIS" className="h-[72px] w-auto object-contain mix-blend-screen brightness-110 saturate-125" />
            </div>
            <p className="text-white/65 dark:text-white/55 text-sm leading-relaxed max-w-xs">
              {PLATFORM_NARRATIVE.oneLiner}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">{t('footer.product')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Run an Audit</Link></li>
              <li><Link to="/pricing" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/analytics" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Analytics</Link></li>
              <li><Link to="/citations" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Citations</Link></li>
              <li><Link to="/competitors" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Competitors</Link></li>
              <li><Link to="/prompt-intelligence" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Decision Query Gaps</Link></li>
              <li><Link to="/mcp" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">MCP Console</Link></li>
              <li><Link to="/reports" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Reports</Link></li>
              <li><Link to="/reverse-engineer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Reverse Engineer</Link></li>
              <li><Link to="/indexing" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Indexing</Link></li>
              <li><Link to="/server-headers" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Server Headers</Link></li>
              <li><Link to="/tools/schema-validator" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Schema Validator</Link></li>
              <li><Link to="/tools/robots-checker" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">AI Crawler Checker</Link></li>
              <li><Link to="/tools/content-extractability" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Extractability Grader</Link></li>
              <li><Link to="/benchmarks" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Benchmarks</Link></li>
              <li><Link to="/changelog" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Changelog</Link></li>
            </ul>
          </div>

          {/* Learn */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">{t('footer.resources')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/blogs" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/insights" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Insights Hub</Link></li>
              <li><Link to="/guide" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Getting Started Guide</Link></li>
              <li><Link to="/faq" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">FAQ</Link></li>
              <li><Link to="/api-docs" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">API Documentation</Link></li>
              <li><Link to="/why-ai-visibility" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Why AI Visibility Matters</Link></li>
              <li><Link to="/aeo-playbook-2026" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">AEO Playbook 2026</Link></li>
              <li><Link to="/geo-ai-ranking-2026" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Geo AI Ranking 2026</Link></li>
              <li><Link to="/competitive-landscape" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Competitive Landscape</Link></li>
              <li><Link to="/integrations" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Integrations</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">{t('footer.legal')} &amp; Compliance</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/methodology" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Claims &amp; Methodology</Link></li>
              <li><Link to="/compliance" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Compliance &amp; Security</Link></li>
              <li><Link to="/privacy" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/partnership-terms" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Partnership Terms (Private)</Link></li>
              <li><Link to="/verify-license" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Verify License</Link></li>
              <li><Link to="/help" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Contact Support</Link></li>
              <li><Link to="/about" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">About</Link></li>
              <li><Link to="/press" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Press</Link></li>
              <li><a href="/sitemap.xml" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Sitemap</a></li>
            </ul>
          </div>

          {/* Trust */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">Trust &amp; Security</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-1.5 text-white/70 dark:text-white/55"><Lock className="w-3.5 h-3.5 text-white/80" /> 256-bit SSL Encrypted</li>
              <li className="flex items-center gap-1.5 text-white/70 dark:text-white/55"><Shield className="w-3.5 h-3.5 text-white/80" /> No Data Resale Policy</li>
              <li className="flex items-center gap-1.5 text-white/70 dark:text-white/55"><Building2 className="w-3.5 h-3.5 text-white/80" /> U.S. Business (EIN on file)</li>
            </ul>

            <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mt-5 mb-3">Community &amp; Contact</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://www.reddit.com/r/AiVIS/" target="_blank" rel="noopener noreferrer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Reddit Community r/AiVIS</a></li>
              <li><a href="https://linkedin.com/in/web4aidev" target="_blank" rel="noopener noreferrer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">LinkedIn</a></li>
              <li><a href="https://bsky.app/profile/intruvurt.bsky.social" target="_blank" rel="noopener noreferrer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Bluesky</a></li>
              <li><a href="mailto:hello@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">hello@aivis.biz</a></li>
              <li><a href="mailto:support@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">support@aivis.biz</a></li>
              <li><a href="mailto:sales@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">sales@aivis.biz</a></li>
              <li><a href="mailto:partners@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">partners@aivis.biz</a></li>
              <li><a href="tel:+17069075299" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">(706) 907-5299</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/12/45 dark:border-white/10/45 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-white/60 dark:text-white/60 text-xs">
              &copy; {currentYear} AiVIS. {t('footer.copyright', { year: currentYear })}
            </p>
            <p className="text-white/45 text-[11px]">
              TechCrunch Startup Battlefield Top 200 nominee · Evidence-backed AI citation diagnosis + fix execution
            </p>
          </div>
          <a
            href="https://intruvurt.space"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-white/60 dark:text-white/60 hover:text-white dark:hover:text-white transition-colors"
          >
            <img
              src={INTRUVURT_LOGO_URL}
              alt="Intruvurt Labs"
              className="h-4 w-auto object-contain opacity-85"
              loading="lazy"
            />
            Produced by Intruvurt Labs
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
export default Footer;
