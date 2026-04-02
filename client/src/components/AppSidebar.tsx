import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Search, BarChart3, FileText, Target,
  Users, FlaskConical, Brain, Wrench, Globe, Shield,
  Settings, CreditCard, Zap, BookOpen, Cpu, ArrowLeftRight,
  Eye, Layers, HelpCircle,
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

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier ?? "observer") as "observer" | "alignment" | "signal";

  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const locked = item.minTier ? !meetsMinimumTier(tier, item.minTier) : false;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/app"}
                className={({ isActive }) =>
                  `group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                  } ${locked ? "opacity-40 pointer-events-none" : ""}`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {locked && (
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded">
                    {item.minTier}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AppSidebar() {
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[220px] z-40 flex flex-col bg-[#0a0e18]/95 backdrop-blur-xl border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 shrink-0 border-b border-white/[0.06]">
        <NavLink to="/" className="flex items-center gap-2">
          <img src={LOGO_URL} alt="AiVIS" className="h-7 w-auto" />
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin">
        <NavSection title="Main" items={mainNav} />
        <NavSection title="Intelligence" items={intelligenceNav} />
        <NavSection title="Tools" items={toolsNav} />
        <NavSection title="Account" items={accountNav} />
      </nav>

      {/* User pill */}
      {user && (
        <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-[11px] font-bold text-cyan-300">
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">{user.name || user.email}</p>
              <p className="text-[10px] text-white/40 capitalize">{user.tier || "observer"}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
