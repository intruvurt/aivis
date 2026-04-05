import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Search, BarChart3, FileText, Target,
  Users, FlaskConical, Brain, Wrench, Globe, Shield,
  Settings, CreditCard, Zap, BookOpen, Cpu, ArrowLeftRight,
  Eye, Layers, HelpCircle, X, Building2, Network, Code2,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { getDisplayAvatarUrl, getDisplayName, getIdentityInitials } from "../utils/userIdentity";
import { meetsMinimumTier } from "@shared/types";

const LOGO_URL = "/aivis-logo.png";

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  minTier?: "observer" | "alignment" | "signal";
}

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const mainNav: NavItem[] = [
  { to: "/app", labelKey: "sidebar.overview", icon: LayoutDashboard },
  { to: "/app/analyze", labelKey: "sidebar.seeVisibility", icon: Search },
  { to: "/app/reports", labelKey: "sidebar.reports", icon: FileText },
  { to: "/app/score-fix", labelKey: "sidebar.scoreFix", icon: Zap, minTier: "signal" },
];

const evidenceNav: NavItem[] = [
  { to: "/app/analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
  { to: "/app/citations", labelKey: "sidebar.citations", icon: FlaskConical, minTier: "alignment" },
  { to: "/app/competitors", labelKey: "sidebar.competitors", icon: Users, minTier: "alignment" },
  { to: "/app/benchmarks", labelKey: "sidebar.benchmarks", icon: Layers },
];

const extensionNav: NavItem[] = [
  { to: "/app/keywords", labelKey: "sidebar.keywords", icon: Target },
  { to: "/app/prompt-intelligence", labelKey: "sidebar.queryGaps", icon: Brain, minTier: "alignment" },
  { to: "/app/answer-presence", labelKey: "sidebar.answerPresence", icon: Eye, minTier: "alignment" },
  { to: "/app/reverse-engineer", labelKey: "sidebar.reverseEngineer", icon: ArrowLeftRight, minTier: "alignment" },
  { to: "/app/brand-integrity", labelKey: "sidebar.brandIntegrity", icon: Shield, minTier: "alignment" },
  { to: "/app/niche-discovery", labelKey: "sidebar.nicheDiscovery", icon: Globe },
];

const toolsNav: NavItem[] = [
  { to: "/app/schema-validator", labelKey: "sidebar.schemaValidator", icon: Shield },
  { to: "/app/server-headers", labelKey: "sidebar.serverHeaders", icon: Globe },
  { to: "/app/robots-checker", labelKey: "sidebar.aiCrawlers", icon: Cpu },
  { to: "/app/indexing", labelKey: "sidebar.indexing", icon: BookOpen },
  { to: "/app/mcp", labelKey: "sidebar.mcpConsole", icon: Wrench, minTier: "alignment" },
];

const agencyNav: NavItem[] = [
  { to: "/api-docs", labelKey: "sidebar.apiDocs", icon: Code2, minTier: "signal" },
  { to: "/integrations", labelKey: "sidebar.integrations", icon: Network, minTier: "signal" },
];

const accountNav: NavItem[] = [
  { to: "/app/billing", labelKey: "sidebar.billing", icon: CreditCard },
  { to: "/app/settings", labelKey: "sidebar.settings", icon: Settings },
  { to: "/help", labelKey: "sidebar.help", icon: HelpCircle },
];

function NavSection({ title, items, onClose, iconClass, iconBg }: { title: string; items: NavItem[]; onClose?: () => void; iconClass: string; iconBg: string }) {
  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier ?? "observer") as "observer" | "alignment" | "signal";
  const { t } = useTranslation();

  return (
    <div className="aurora-sidebar-section">
      <p className="aurora-sidebar-heading">{title}</p>
      {items.map((item) => {
        const locked = item.minTier ? !meetsMinimumTier(tier, item.minTier) : false;
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={locked ? "#" : item.to}
            end={item.to === "/app"}
            onClick={(e) => { if (locked) { e.preventDefault(); return; } onClose?.(); }}
            aria-disabled={locked || undefined}
            tabIndex={locked ? -1 : undefined}
            className={({ isActive }) =>
              `aurora-sidebar-link ${isActive ? "is-active" : ""} ${locked ? "pointer-events-none opacity-40" : ""}`
            }
          >
            <span className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-md shrink-0 ${iconBg}`}>
              <Icon className={`w-[13px] h-[13px] ${iconClass}`} />
            </span>
            <span className="truncate">{t(item.labelKey)}</span>
            {locked && <span className="aurora-sidebar-lock">{item.minTier}</span>}
          </NavLink>
        );
      })}
    </div>
  );
}

export default function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const avatarUrl = getDisplayAvatarUrl(user);
  const displayName = getDisplayName(user);
  const initials = getIdentityInitials(user);

  return (
    <aside
      className={`aurora-sidebar ${isOpen ? "is-open" : ""}`}
      aria-label="Main navigation"
      onKeyDown={(e) => { if (e.key === "Escape" && isOpen) onClose?.(); }}
    >
      {/* Brand */}
      <div className="aurora-sidebar-brand">
        <NavLink to="/app" className="flex items-center gap-2 min-w-0 flex-1" onClick={onClose}>
          <img src={LOGO_URL} alt="AiVIS" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-contain" />
          <div className="min-w-0">
            <p className="aurora-sidebar-title">AiVIS</p>
            <p className="aurora-sidebar-subtitle">AI Evidence-backed Visibility Engine</p>
          </div>
        </NavLink>
        {/* Mobile close button */}
        <button
          className="lg:hidden ml-auto p-1 rounded-md text-white/50 hover:text-white hover:bg-white/08 transition-colors"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="aurora-sidebar-nav">
        <NavSection title={t("sidebar.core")} items={mainNav} onClose={onClose} iconClass="text-blue-400" iconBg="bg-blue-500/10" />
        <NavSection title={t("sidebar.evidence")} items={evidenceNav} onClose={onClose} iconClass="text-violet-400" iconBg="bg-violet-500/10" />
        <NavSection title={t("sidebar.extensions")} items={extensionNav} onClose={onClose} iconClass="text-emerald-400" iconBg="bg-emerald-500/10" />
        <NavSection title={t("sidebar.platform")} items={toolsNav} onClose={onClose} iconClass="text-amber-400" iconBg="bg-amber-500/10" />
        <NavSection title={t("sidebar.agency")} items={agencyNav} onClose={onClose} iconClass="text-indigo-400" iconBg="bg-indigo-500/10" />
        <NavSection title={t("sidebar.account")} items={accountNav} onClose={onClose} iconClass="text-slate-400" iconBg="bg-slate-500/10" />
      </nav>

      {/* User pill */}
      {user && (
        <div className="aurora-user-pill">
          <div className="aurora-user-pill-inner">
            <div className="aurora-user-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="aurora-user-name">{user.company || displayName}</p>
              <p className="aurora-user-tier truncate">
                {user.website
                  ? user.website.replace(/^https?:\/\//, "").replace(/\/$/, "")
                  : (user.tier || "observer")}
                {user.website && (
                  <span className="ml-1.5 opacity-60">· {user.tier || "observer"}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
