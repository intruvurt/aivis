import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Search, BarChart3, FileText, Target,
  Users, FlaskConical, Brain, Wrench, Globe, Shield,
  Settings, CreditCard, Zap, BookOpen, Cpu, ArrowLeftRight,
  Eye, Layers, HelpCircle, X,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier } from "@shared/types";

const LOGO_URL = "/aivis-logo.png";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minTier?: "observer" | "alignment" | "signal";
}

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const mainNav: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/analyze", label: "New Audit", icon: Search },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/reports", label: "Reports", icon: FileText },
];

const intelligenceNav: NavItem[] = [
  { to: "/app/citations", label: "Citations", icon: FlaskConical, minTier: "alignment" },
  { to: "/app/competitors", label: "Competitors", icon: Users, minTier: "alignment" },
  { to: "/app/benchmarks", label: "Benchmarks", icon: Layers },
  { to: "/app/keywords", label: "Keywords", icon: Target },
  { to: "/app/prompt-intelligence", label: "Query Gaps", icon: Brain, minTier: "alignment" },
  { to: "/app/answer-presence", label: "Answer Presence", icon: Eye, minTier: "alignment" },
  { to: "/app/reverse-engineer", label: "Reverse Engineer", icon: ArrowLeftRight, minTier: "alignment" },
];

const toolsNav: NavItem[] = [
  { to: "/app/score-fix", label: "Score Fix", icon: Zap, minTier: "signal" },
  { to: "/app/schema-validator", label: "Schema Validator", icon: Shield },
  { to: "/app/server-headers", label: "Server Headers", icon: Globe },
  { to: "/app/robots-checker", label: "AI Crawlers", icon: Cpu },
  { to: "/app/indexing", label: "Indexing", icon: BookOpen },
  { to: "/app/mcp", label: "MCP Console", icon: Wrench, minTier: "alignment" },
];

const accountNav: NavItem[] = [
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

function NavSection({ title, items, onClose, iconClass, iconBg }: { title: string; items: NavItem[]; onClose?: () => void; iconClass: string; iconBg: string }) {
  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier ?? "observer") as "observer" | "alignment" | "signal";

  return (
    <div className="aurora-sidebar-section">
      <p className="aurora-sidebar-heading">{title}</p>
      {items.map((item) => {
        const locked = item.minTier ? !meetsMinimumTier(tier, item.minTier) : false;
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            onClick={onClose}
            className={({ isActive }) =>
              `aurora-sidebar-link ${isActive ? "is-active" : ""} ${locked ? "pointer-events-none opacity-40" : ""}`
            }
          >
            <span className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-md shrink-0 ${iconBg}`}>
              <Icon className={`w-[13px] h-[13px] ${iconClass}`} />
            </span>
            <span className="truncate">{item.label}</span>
            {locked && <span className="aurora-sidebar-lock">{item.minTier}</span>}
          </NavLink>
        );
      })}
    </div>
  );
}

export default function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <aside
      className={`aurora-sidebar ${isOpen ? "is-open" : ""}`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="aurora-sidebar-brand">
        <NavLink to="/app" className="flex items-center gap-2 min-w-0 flex-1" onClick={onClose}>
          <img src={LOGO_URL} alt="AiVIS" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-contain" />
          <div className="min-w-0">
            <p className="aurora-sidebar-title">AiVIS</p>
            <p className="aurora-sidebar-subtitle">AI Visibility Engine</p>
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
        <NavSection title="Main" items={mainNav} onClose={onClose} iconClass="text-cyan-400" iconBg="bg-cyan-500/10" />
        <NavSection title="Intelligence" items={intelligenceNav} onClose={onClose} iconClass="text-violet-400" iconBg="bg-violet-500/10" />
        <NavSection title="Tools" items={toolsNav} onClose={onClose} iconClass="text-amber-400" iconBg="bg-amber-500/10" />
        <NavSection title="Account" items={accountNav} onClose={onClose} iconClass="text-slate-400" iconBg="bg-slate-500/10" />
      </nav>

      {/* User pill */}
      {user && (
        <div className="aurora-user-pill">
          <div className="aurora-user-pill-inner">
            <div className="aurora-user-avatar">
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="aurora-user-name">{user.name || user.email}</p>
              <p className="aurora-user-tier">{user.tier || "observer"}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
