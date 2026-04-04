import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ChevronDown, User, Settings, CreditCard, LogOut, Gift,
  BarChart3, Target, Users, Eye, FlaskConical, FileText, BookOpen, Shield, Bell,
  Search, Cpu, Globe, Wrench, Zap, Layers, HelpCircle, Brain, ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import useFeatureStatus from "../hooks/useFeatureStatus";
import useNotifications, { getNotificationDestination } from "../hooks/useNotifications";
import { TIER_LIMITS, meetsMinimumTier } from "@shared/types";
import WhatsNewPanel from "./WhatsNewPanel";
import LanguageSwitcher from "./LanguageSwitcher";
import { CompetitorRadarIcon, AnswerDecompilerIcon } from "./icons";
import { useTranslation } from "react-i18next";

const LOGO_URL = "/aivis-logo.png";
const LOCKED_FEATURE_IMAGE_URL = "/feature-locked.png";

type ToolTier = "observer" | "alignment" | "signal" | "scorefix";
type ToolLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  minTier: ToolTier;
  color: string; // accent color class for the icon chip
};

type ToolGroup = {
  heading: string;
  accent: string; // heading text color
  links: ToolLink[];
};

/** Research & Analysis tools — data/insights gathering */
const RESEARCH_GROUPS: ToolGroup[] = [
  {
    heading: "Analysis",
    accent: "text-cyan-400",
    links: [
      { to: "/analytics", label: "Analytics", icon: BarChart3, desc: "Score history & trends", minTier: "observer", color: "text-cyan-400" },
      { to: "/reports", label: "Reports", icon: FileText, desc: "Saved audit reports", minTier: "observer", color: "text-cyan-300" },
    ],
  },
  {
    heading: "Research",
    accent: "text-emerald-400",
    links: [
      { to: "/keywords", label: "Keywords", icon: Search, desc: "AI keyword research", minTier: "observer", color: "text-emerald-400" },
      { to: "/niche-discovery", label: "Niche Discovery", icon: Globe, desc: "Top 100 niche rankings", minTier: "observer", color: "text-emerald-300" },
      { to: "/competitors", label: "Competitors", icon: CompetitorRadarIcon, desc: "Side-by-side benchmarks", minTier: "alignment", color: "text-emerald-500" },
    ],
  },
];

/** AI Intelligence & Technical tools — action/optimization */
const AI_TOOL_GROUPS: ToolGroup[] = [
  {
    heading: "AI Intelligence",
    accent: "text-violet-400",
    links: [
      { to: "/citations", label: "Citations", icon: Eye, desc: "AI citation tracking", minTier: "alignment", color: "text-violet-400" },
      { to: "/reverse-engineer", label: "Reverse Engineer", icon: AnswerDecompilerIcon, desc: "Deconstruct AI answers", minTier: "alignment", color: "text-violet-300" },
      { to: "/prompt-intelligence", label: "Prompt Intelligence", icon: Brain, desc: "AI query pattern analysis", minTier: "alignment", color: "text-violet-200" },
      { to: "/answer-presence", label: "Answer Presence", icon: Globe, desc: "AI answer inclusion tracking", minTier: "alignment", color: "text-cyan-400" },
      { to: "/brand-integrity", label: "Brand Integrity", icon: ShieldCheck, desc: "Brand accuracy monitoring", minTier: "alignment", color: "text-emerald-400" },
    ],
  },
  {
    heading: "Technical",
    accent: "text-amber-400",
    links: [
      { to: "/server-headers", label: "Server Headers", icon: Shield, desc: "HTTP headers, cache, security", minTier: "observer", color: "text-amber-400" },
      { to: "/indexing", label: "Indexing", icon: Layers, desc: "Index check & IndexNow", minTier: "observer", color: "text-amber-300" },
      { to: "/score-fix", label: "Score Fix", icon: FlaskConical, desc: "Remediation workflows", minTier: "scorefix", color: "text-amber-500" },
    ],
  },
  {
    heading: "Platform",
    accent: "text-indigo-400",
    links: [
      { to: "/mcp", label: "MCP Console", icon: Cpu, desc: "AI agent tool server", minTier: "alignment", color: "text-indigo-400" },
      { to: "/gsc", label: "Search Console", icon: BarChart3, desc: "GSC performance intelligence", minTier: "alignment", color: "text-emerald-400" },
    ],
  },
];

// Flat tool links for path-matching
const RESEARCH_LINKS: ToolLink[] = RESEARCH_GROUPS.flatMap((g) => g.links);
const AI_TOOL_LINKS: ToolLink[] = AI_TOOL_GROUPS.flatMap((g) => g.links);
const ALL_TOOL_LINKS: ToolLink[] = [...RESEARCH_LINKS, ...AI_TOOL_LINKS];

type DocsLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const DOCS_LINKS: DocsLink[] = [
  { to: "/guide", label: "Guide", icon: BookOpen, color: "text-sky-300" },
  { to: "/api-docs", label: "API Docs", icon: Cpu, color: "text-indigo-300" },
  { to: "/blogs", label: "Blog", icon: FileText, color: "text-cyan-300" },
  { to: "/methodology", label: "Methodology", icon: FlaskConical, color: "text-violet-300" },
  { to: "/help", label: "Help Center", icon: HelpCircle, color: "text-emerald-300" },
  { to: "/compliance", label: "Compliance & Security", icon: Shield, color: "text-rose-300" },
  { to: "/insights", label: "Insights", icon: Eye, color: "text-cyan-300" },
  { to: "/benchmarks", label: "Benchmarks", icon: Target, color: "text-orange-300" },
  { to: "/changelog", label: "Changelog", icon: FileText, color: "text-white/70" },
  { to: "/compare", label: "Compare", icon: BarChart3, color: "text-indigo-300" },
  { to: "/competitive-landscape", label: "Competitive Landscape", icon: Globe, color: "text-teal-300" },
  { to: "/integrations", label: "Integrations", icon: Wrench, color: "text-fuchsia-300" },
  { to: "/workflow", label: "Workflow", icon: Zap, color: "text-amber-300" },
];

type UserMenuLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

/** Extra links moved into the user menu for discoverability */
const USER_EXTRA_LINKS: UserMenuLink[] = [
  { to: "/about", label: "About", icon: BookOpen, color: "text-sky-300" },
  { to: "/support", label: "Support", icon: Users, color: "text-emerald-300" },
  { to: "/integrations", label: "Integrations", icon: Target, color: "text-violet-300" },
];

/* ── Compact workspace switcher ──────────────── */
function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, fetchWorkspaces } = useWorkspaceStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) fetchWorkspaces();
  }, [isAuthenticated, fetchWorkspaces]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!isAuthenticated || workspaces.length <= 1) return null;

  const active = workspaces.find((w) => w.workspaceId === activeWorkspaceId) || workspaces[0];

  return (
    <div className="relative hidden md:block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 social-pill bg-charcoal-light/60 hover:bg-charcoal-light transition-colors text-xs"
        title="Switch workspace"
      >
        <Layers className="w-3.5 h-3.5 text-cyan-400/70" />
        <span className="text-white/70 truncate max-w-[100px]">{active?.workspaceName || "Workspace"}</span>
        <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-56 bg-gradient-to-b from-[#2d3548] to-[#272f3e] border border-white/12 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-[200]">
          <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">Workspaces</p>
          {workspaces.map((w) => (
            <button
              key={w.workspaceId}
              onClick={() => { setActiveWorkspaceId(w.workspaceId); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                w.workspaceId === activeWorkspaceId
                  ? "text-cyan-300 bg-cyan-500/10"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{w.workspaceName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, isAuthenticated, logout } = useAuthStore();
  const { status: featureStatus } = useFeatureStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [aiToolsOpen, setAiToolsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [mobileResearchOpen, setMobileResearchOpen] = useState(false);
  const [mobileAiToolsOpen, setMobileAiToolsOpen] = useState(false);
  const [mobileDocsOpen, setMobileDocsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const researchRef = useRef<HTMLDivElement>(null);
  const aiToolsRef = useRef<HTMLDivElement>(null);
  const docsRef = useRef<HTMLDivElement>(null);
  const researchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const aiToolsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const docsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const {
    notifications,
    unreadCount: unreadNotifications,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
  } = useNotifications();

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as globalThis.Node)) setMenuOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as globalThis.Node)) setNotificationsOpen(false);
      if (researchRef.current && !researchRef.current.contains(e.target as globalThis.Node)) setResearchOpen(false);
      if (aiToolsRef.current && !aiToolsRef.current.contains(e.target as globalThis.Node)) setAiToolsOpen(false);
      if (docsRef.current && !docsRef.current.contains(e.target as globalThis.Node)) setDocsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setResearchOpen(false);
    setAiToolsOpen(false);
    setDocsOpen(false);
    setMenuOpen(false);
    setMobileResearchOpen(false);
    setMobileAiToolsOpen(false);
    setMobileDocsOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : "U";
  const hasSession = isAuthenticated || !!token;
  const tierKey = (user?.tier === 'alignment' || user?.tier === 'signal' || user?.tier === 'scorefix' || user?.tier === 'observer')
    ? user.tier
    : 'observer';
  const tierLimits = TIER_LIMITS[tierKey] || TIER_LIMITS.observer;
  const monthlyScanTotal = Number(featureStatus?.usage?.monthlyLimit ?? tierLimits.scansPerMonth ?? 0);
  const scansUsed = Math.max(0, Number(featureStatus?.usage?.usedThisMonth ?? 0));
  const scansRemaining = Math.max(0, Number(featureStatus?.usage?.remainingThisMonth ?? monthlyScanTotal));
  const usagePercent = monthlyScanTotal > 0 ? Math.min(100, Math.round((scansUsed / monthlyScanTotal) * 100)) : 0;
  const packCreditsBalance = Math.max(0, Number(featureStatus?.credits?.packCreditsRemaining ?? 0));
  const referralCreditsTotal = Math.max(0, Number(featureStatus?.credits?.referralCreditsEarnedTotal ?? 0));
  const formatCreditBalance = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));
  const packCreditsLabel = formatCreditBalance(packCreditsBalance);

  const tierTheme = {
    observer: {
      label: 'Observer',
      className: 'bg-gradient-to-r from-charcoal-deep via-charcoal to-charcoal-light border border-white/25 text-white',
      navActive: 'bg-emerald-500/20 border border-emerald-300/45 text-emerald-100',
      navHover: 'hover:bg-emerald-500/12 hover:text-emerald-100',
      menuBorder: 'border-emerald-300/40',
      mobileMenuBorder: 'border-emerald-300/45',
      tierImage: '/observer.png',
    },
    alignment: {
      label: 'Alignment',
      className: 'bg-gradient-to-r from-[#f97316] via-[#fbbf24] to-[#22d3ee] border border-white/25 text-charcoal-deep',
      navActive: 'bg-indigo-500/20 border border-indigo-300/45 text-indigo-100',
      navHover: 'hover:bg-indigo-500/12 hover:text-indigo-100',
      menuBorder: 'border-indigo-300/40',
      mobileMenuBorder: 'border-indigo-300/45',
      tierImage: null,
    },
    signal: {
      label: 'Signal',
      className: 'bg-gradient-to-r from-[#0a6ea8] via-[#118ad1] to-[#37a6de] border border-white/25 text-white',
      navActive: 'bg-cyan-500/20 border border-cyan-300/45 text-cyan-100',
      navHover: 'hover:bg-cyan-500/12 hover:text-cyan-100',
      menuBorder: 'border-cyan-300/40',
      mobileMenuBorder: 'border-cyan-300/45',
      tierImage: '/signal.png',
    },
    scorefix: {
      label: 'Score Fix',
      className: 'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-pink-500 border border-white/25 text-white',
      navActive: 'bg-amber-500/20 border border-amber-300/45 text-amber-100',
      navHover: 'hover:bg-amber-500/12 hover:text-amber-100',
      menuBorder: 'border-amber-300/40',
      mobileMenuBorder: 'border-amber-300/45',
      tierImage: '/resell--aivis-outputs.png',
    },
  }[tierKey];

  const navActiveClass = `${tierTheme.navActive}`;
  const navInactiveClass = `text-white/65 ${tierTheme.navHover}`;
  const menuPanelClass = `bg-charcoal-deep border ${tierTheme.menuBorder} rounded-xl shadow-2xl shadow-black/25 overflow-hidden`;

  const isToolLocked = useCallback(
    (link: ToolLink) => !meetsMinimumTier(tierKey, link.minTier),
    [tierKey]
  );

  // Check if current page is under a menu
  const isResearchActive = RESEARCH_LINKS.some((t) => location.pathname === t.to);
  const isAiToolActive = AI_TOOL_LINKS.some((t) => location.pathname === t.to);
  const isDocsActive = DOCS_LINKS.some((l) => location.pathname === l.to);

  // Hover-intent handlers for desktop menus
  const openResearch = useCallback(() => { clearTimeout(researchTimeout.current); setResearchOpen(true); }, []);
  const closeResearch = useCallback(() => { researchTimeout.current = setTimeout(() => setResearchOpen(false), 150); }, []);
  const openAiTools = useCallback(() => { clearTimeout(aiToolsTimeout.current); setAiToolsOpen(true); }, []);
  const closeAiTools = useCallback(() => { aiToolsTimeout.current = setTimeout(() => setAiToolsOpen(false), 150); }, []);
  const openDocs = useCallback(() => { clearTimeout(docsTimeout.current); setDocsOpen(true); }, []);
  const closeDocs = useCallback(() => { docsTimeout.current = setTimeout(() => setDocsOpen(false), 150); }, []);

  return (
    <nav className="sticky top-0 z-[90] border-b border-white/8 bg-charcoal-light overflow-visible">

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-2 shrink-0">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 py-1">
            <img src={LOGO_URL} alt="AiVIS" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-contain" />
            <span className="text-[15px] font-bold text-white tracking-tight">AiVIS</span>
          </Link>

          <span
            className="hidden min-[1700px]:inline-flex items-center px-3 py-1 rounded-md border border-white/10 bg-charcoal/40 text-[10px] xl:text-[11px] text-white/70 tracking-[0.08em] uppercase whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            title="Ai Visibility Intelligence Audits"
          >
            Ai Visibility Intelligence Audits
          </span>
        </div>

        {/* Center nav — desktop */}
        <div className="hidden lg:flex flex-1 min-w-0 items-center justify-center px-2 xl:px-4">
          <div className="flex min-w-0 max-w-full items-center gap-1 text-sm font-medium whitespace-nowrap overflow-visible">
          {/* Home */}
          <Link
            to="/"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              location.pathname === "/" ? navActiveClass : navInactiveClass
            }`}
          >
            {t('nav.home')}
          </Link>

          {/* Research cascade */}
          <div ref={researchRef} className="relative" onMouseEnter={openResearch} onMouseLeave={closeResearch}>
            <button type="button" onClick={() => setResearchOpen(!researchOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${isResearchActive ? navActiveClass : navInactiveClass}`}
              aria-expanded={researchOpen} aria-haspopup="menu">
              {t('nav.research')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${researchOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`absolute left-0 top-full pt-1.5 z-[200] transition-all duration-200 origin-top ${researchOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"}`}>
              <div className={`w-72 ${menuPanelClass}`}>
                <div className="p-1.5">
                  {RESEARCH_GROUPS.map((group, gi) => (
                    <div key={group.heading}>
                      {gi > 0 && <div className="mx-3 my-1 border-t border-white/5" />}
                      <p className={`px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider ${group.accent}`}>{group.heading}</p>
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        const isGated = isToolLocked(link);
                        const isActive = location.pathname === link.to;
                        return (
                          <Link key={link.to} to={link.to}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${isActive ? navActiveClass : isGated ? "text-white/45 hover:text-white/70 hover:bg-charcoal-light" : "text-white/75 hover:text-white hover:bg-charcoal-light"}`}
                            title={isGated ? `${link.label}: Upgrade required` : undefined}>
                            <div className={`p-1.5 social-icon-chip transition-colors ${isActive ? "bg-charcoal text-white" : isGated ? "bg-charcoal-light text-white/45" : `bg-charcoal-light ${link.color} group-hover:bg-charcoal group-hover:text-white`}`}>
                              <Icon className="w-8 h-8" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-inherit">{link.label}</span>
                                {isGated && <img src={LOCKED_FEATURE_IMAGE_URL} alt="Locked feature" className="w-8 h-8 rounded-sm object-cover opacity-95" loading="lazy" />}
                              </div>
                              <p className="text-[11px] text-white/50 leading-tight">{link.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Tools cascade */}
          <div ref={aiToolsRef} className="relative" onMouseEnter={openAiTools} onMouseLeave={closeAiTools}>
            <button type="button" onClick={() => setAiToolsOpen(!aiToolsOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${isAiToolActive ? navActiveClass : navInactiveClass}`}
              aria-expanded={aiToolsOpen} aria-haspopup="menu">
              {t('nav.aiTools')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${aiToolsOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`absolute left-0 top-full pt-1.5 z-[200] transition-all duration-200 origin-top ${aiToolsOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"}`}>
              <div className={`w-72 ${menuPanelClass}`}>
                <div className="p-1.5">
                  {AI_TOOL_GROUPS.map((group, gi) => (
                    <div key={group.heading}>
                      {gi > 0 && <div className="mx-3 my-1 border-t border-white/5" />}
                      <p className={`px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider ${group.accent}`}>{group.heading}</p>
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        const isGated = isToolLocked(link);
                        const isActive = location.pathname === link.to;
                        return (
                          <Link key={link.to} to={link.to}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${isActive ? navActiveClass : isGated ? "text-white/45 hover:text-white/70 hover:bg-charcoal-light" : "text-white/75 hover:text-white hover:bg-charcoal-light"}`}
                            title={isGated ? `${link.label}: Upgrade required` : undefined}>
                            <div className={`p-1.5 social-icon-chip transition-colors ${isActive ? "bg-charcoal text-white" : isGated ? "bg-charcoal-light text-white/45" : `bg-charcoal-light ${link.color} group-hover:bg-charcoal group-hover:text-white`}`}>
                              <Icon className="w-8 h-8" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-inherit">{link.label}</span>
                                {isGated && <img src={LOCKED_FEATURE_IMAGE_URL} alt="Locked feature" className="w-8 h-8 rounded-sm object-cover opacity-95" loading="lazy" />}
                              </div>
                              <p className="text-[11px] text-white/50 leading-tight">{link.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Docs cascade */}
          <div ref={docsRef} className="relative" onMouseEnter={openDocs} onMouseLeave={closeDocs}>
            <button type="button" onClick={() => setDocsOpen(!docsOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${isDocsActive ? navActiveClass : navInactiveClass}`}
              aria-expanded={docsOpen} aria-haspopup="menu">
              {t('nav.docs')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${docsOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`absolute right-0 top-full pt-1.5 z-[200] transition-all duration-200 origin-top ${docsOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"}`}>
              <div className={`w-56 ${menuPanelClass}`}>
                <div className="p-1.5">
                  {DOCS_LINKS.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname === link.to;
                    return (
                      <Link key={link.to} to={link.to}
                        className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? navActiveClass : "text-white/75 hover:text-white hover:bg-charcoal-light"}`}>
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : link.color}`} />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <Link to="/pricing"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${location.pathname === "/pricing" ? navActiveClass : navInactiveClass}`}>
            {t('nav.pricing')}
          </Link>

          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
          {hasSession && (
            <div
              className="md:hidden px-2 py-1 rounded-md border border-white/10 bg-charcoal-light/60"
              title="Current audit credit balance"
              aria-label={`Credit balance ${packCreditsLabel}`}
            >
              <span className="text-[10px] text-amber-300 font-medium">Bal {packCreditsLabel}</span>
            </div>
          )}

          {hasSession && tierTheme && (
            <div className="hidden xl:flex items-center gap-2 pl-2">
              <Link
                to="/app/billing"
                className={`relative inline-flex items-center gap-1.5 px-2.5 pr-4 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap transition-colors hover:opacity-90 ${tierTheme.className}`}
                title={`Current tier: ${tierTheme.label}`}
              >
                {tierTheme.tierImage && (
                  <img src={tierTheme.tierImage} alt={`${tierTheme.label} tier`} className="w-3.5 h-3.5 rounded-sm object-cover" loading="lazy" />
                )}
                {tierTheme.label}
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 border border-white/20 bg-charcoal text-[8px] leading-none tracking-[0.12em] text-white/80 rounded-sm rotate-[-10deg] [clip-path:polygon(0_0,88%_0,100%_50%,88%_100%,0_100%)] shadow-sm shadow-black/30">
                  TIER
                </span>
              </Link>

              <div
                className="hidden 2xl:flex h-7 px-2.5 rounded-lg border border-white/12 bg-charcoal-light/50 items-center gap-2 min-w-[5.25rem]"
                title={`${scansUsed}/${monthlyScanTotal} audits used`}
                aria-label={`${scansRemaining} scans remaining`}
              >
                <div className="w-10 h-1.5 rounded-full bg-charcoal overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-white/50 via-white/65 to-white/80"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-white/60 whitespace-nowrap leading-none">
                  {scansRemaining} left
                </span>
              </div>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-white/65 hover:text-white transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {hasSession ? (
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <WhatsNewPanel />
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  className="relative p-2 rounded-lg border border-white/10 bg-charcoal-light/50 text-white/80 hover:text-white hover:bg-charcoal-light transition-colors"
                  aria-label="Notifications"
                  title={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : "Notifications"}
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-[10px] font-semibold text-black flex items-center justify-center">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-[#323a4c] border border-white/10 rounded-xl shadow-xl shadow-black/30 overflow-hidden z-[220]">
                    <div className="px-3 py-2.5 border-b border-white/10 bg-charcoal-light/30 flex items-center justify-between">
                      <p className="text-sm font-medium text-white">Notifications</p>
                      <button
                        type="button"
                        onClick={() => { void markAllNotificationsRead(); }}
                        className="text-[11px] text-cyan-200 hover:text-cyan-100"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-1.5">
                      {notifications.length === 0 ? (
                        <p className="px-3 py-5 text-sm text-white/60">No notifications yet.</p>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              void markNotificationRead(item.id);
                              const dest = getNotificationDestination(item);
                              if (dest) {
                                setNotificationsOpen(false);
                                navigate(dest);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                              item.is_read
                                ? "text-white/65 hover:bg-charcoal-light"
                                : "text-white bg-charcoal/70 hover:bg-charcoal"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-semibold truncate">{item.title}</span>
                              <span className="text-[10px] text-white/45 shrink-0">{item.scope === "platform" ? "Platform" : "Account"}</span>
                            </div>
                            <p className="text-[11px] text-white/70 mt-0.5">{item.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="px-2 pb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate("/app/notifications");
                        }}
                        className="w-full text-center text-xs px-3 py-2 rounded-lg border border-white/10 bg-charcoal-light text-cyan-200 hover:text-cyan-100"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Workspace switcher — compact */}
              <WorkspaceSwitcher />

              <div className="relative" ref={dropdownRef}>
                <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 p-1 pr-3 social-pill bg-charcoal-light/60 hover:bg-charcoal-light transition-colors">
                  <div className="w-7 h-7 social-icon-chip bg-gradient-to-br from-white/28 to-white/14 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{initials}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/65 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-64 bg-gradient-to-b from-[#2d3548] to-[#272f3e] border border-white/12 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-[200]"
                  >
                    {/* Identity header */}
                    <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-charcoal-light/50 to-charcoal-deep/60">
                      <p className="text-sm font-semibold text-white truncate">{user?.email || "Signed in"}</p>
                      <p className="text-xs text-cyan-300/80 capitalize font-medium mt-0.5">{user?.tier || "Observer"} Plan</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-violet-300">Referral +{referralCreditsTotal}</span>
                        <span className="text-[10px] text-white/40">•</span>
                        <span className="text-[10px] text-amber-300">Balance {packCreditsLabel}</span>
                      </div>
                    </div>
                    {/* Account section */}
                    <div className="p-1.5">
                      <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">Account</p>
                      <button onClick={() => { setMenuOpen(false); navigate("/app/profile"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/8 rounded-lg transition-colors">
                        <User className="w-4 h-4 text-cyan-400" /> Profile
                      </button>
                      <button onClick={() => { setMenuOpen(false); navigate("/app/settings"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/8 rounded-lg transition-colors">
                        <Settings className="w-4 h-4 text-amber-400" /> Settings
                      </button>
                      <button onClick={() => { setMenuOpen(false); navigate("/app/billing"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/8 rounded-lg transition-colors">
                        <CreditCard className="w-4 h-4 text-emerald-400" /> Billing
                      </button>
                      <button onClick={() => { setMenuOpen(false); navigate("/app/referrals"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/8 rounded-lg transition-colors">
                        <Gift className="w-4 h-4 text-violet-400" /> Referrals
                      </button>
                    </div>
                    {/* Platform section */}
                    <div className="p-1.5 border-t border-white/8">
                      <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">Platform</p>
                      {USER_EXTRA_LINKS.map((link) => {
                        const Icon = link.icon;
                        return (
                          <button key={link.to} onClick={() => { setMenuOpen(false); navigate(link.to); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/8 rounded-lg transition-colors">
                            <Icon className={`w-4 h-4 ${link.color}`} /> {link.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Team / Workspace */}
                    <div className="p-1.5 border-t border-white/8">
                      <button onClick={() => { setMenuOpen(false); navigate("/app/team"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/8 rounded-lg transition-colors">
                        <Users className="w-4 h-4 text-cyan-400" /> Team &amp; Workspaces
                      </button>
                    </div>
                    {/* Admin section — role-gated */}
                    {String(user?.role || "").toLowerCase() === "admin" && (
                      <div className="p-1.5 border-t border-white/10">
                        <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">Admin</p>
                        <button onClick={() => { setMenuOpen(false); navigate("/app/admin"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/8 rounded-lg transition-colors">
                          <Shield className="w-4 h-4 text-rose-400" /> Admin Portal
                        </button>
                      </div>
                    )}
                    {/* Sign out */}
                    <div className="p-1.5 border-t border-white/10">
                      <button onClick={() => { logout(); setMenuOpen(false); navigate("/auth?mode=signin"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-300/80 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors">
                        <LogOut className="w-4 h-4" /> {t('nav.signOut')}
                      </button>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>


            </div>
          ) : (
            <>
              <LanguageSwitcher />
              <WhatsNewPanel />
              <Link to="/auth?mode=signin" className="text-sm text-white/60 dark:text-white/75 hover:text-white dark:hover:text-white transition-colors font-medium">{t('nav.logIn')}</Link>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 text-[10px] font-black tracking-[0.1em] uppercase">
                {t('nav.free')}
              </span>
                  <Link to="/auth?mode=signup" className="text-sm px-4 py-1.5 bg-gradient-to-r from-white/20 to-white/12 dark:from-white/28 dark:to-white/14 rounded-lg text-white font-medium hover:opacity-90 transition-opacity">
                {t('nav.getStarted')}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-nav-menu" className="lg:hidden border-t border-white/12 dark:border-white/10 bg-charcoal-deep dark:bg-charcoal-solid">
          <div className="px-4 py-3 space-y-1">
            {hasSession && tierTheme && (
              <div className="px-3 pb-2">
                <div className="flex items-center gap-2.5">
                  <Link
                    to="/app/billing"
                    onClick={() => setMobileOpen(false)}
                    className={`relative inline-flex items-center gap-1.5 px-2.5 pr-4 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide uppercase ${tierTheme.className}`}
                  >
                    {tierTheme.tierImage && (
                      <img src={tierTheme.tierImage} alt={`${tierTheme.label} tier`} className="w-3.5 h-3.5 rounded-sm object-cover" loading="lazy" />
                    )}
                    {tierTheme.label}
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.5 border border-white/20 bg-charcoal text-[8px] leading-none tracking-[0.12em] text-white/80 rounded-sm rotate-[-10deg] [clip-path:polygon(0_0,88%_0,100%_50%,88%_100%,0_100%)] shadow-sm shadow-black/30">
                      TIER
                    </span>
                  </Link>
                  <div
                    className="w-28 h-7 px-2 rounded-lg border border-white/12 bg-charcoal-light/50 flex items-center"
                    title={`${scansUsed}/${monthlyScanTotal} audits used • ${scansRemaining} remaining`}
                    aria-label={`Usage ${usagePercent}% this month`}
                  >
                    <div className="w-full h-1.5 rounded-full bg-charcoal overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-white/50 via-white/65 to-white/80"
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] mt-1" title="Referral audit credits and current credit balance">
                  <span className="text-violet-300">Referral +{referralCreditsTotal}</span>
                  <span className="text-white/40"> • </span>
                  <span className="text-amber-300">Balance {packCreditsLabel}</span>
                </p>
              </div>
            )}

            {/* Home */}
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                location.pathname === "/" ? navActiveClass : navInactiveClass
              }`}
            >
              {t('nav.home')}
            </Link>

            {!hasSession && (
              <div className="px-3 py-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 text-[10px] font-black tracking-[0.1em] uppercase">
                  FREE TO START
                </span>
              </div>
            )}

            {/* Research — collapsible group */}
            <div>
              <button
                type="button"
                onClick={() => setMobileResearchOpen(!mobileResearchOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mobileResearchOpen || isResearchActive
                    ? navActiveClass
                    : `text-white/90 bg-charcoal-light/70 ${tierTheme.menuBorder} hover:text-white ${tierTheme.navHover}`
                }`}
                aria-expanded={mobileResearchOpen}
              >
                <span className="font-semibold tracking-wide">{t('nav.research')}</span>
                <ChevronDown className={`w-4 h-4 text-white/85 transition-transform duration-200 ${mobileResearchOpen ? "rotate-180" : ""}`} />
              </button>

              {mobileResearchOpen && (
                <div className={`mt-2 ml-3 pl-3 border-l-2 ${tierTheme.mobileMenuBorder} space-y-1`}>
                  {RESEARCH_GROUPS.map((group) => (
                    <div key={group.heading}>
                      <p className={`px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider ${group.accent}`}>
                        {group.heading}
                      </p>
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        const isGated = isToolLocked(link);
                        return (
                          <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                              isGated ? "text-white/75 bg-charcoal-light/65 border-white/10 hover:text-white hover:bg-charcoal-light/80"
                                : location.pathname === link.to ? navActiveClass
                                : `text-white/90 bg-charcoal-light/65 ${tierTheme.menuBorder} hover:text-white ${tierTheme.navHover}`
                            }`}>
                            <Icon className={`w-8 h-8 ${isGated ? "text-white/45" : link.color}`} />
                            {link.label}
                            {isGated && <img src={LOCKED_FEATURE_IMAGE_URL} alt="Locked feature" className="w-8 h-8 rounded-sm object-cover opacity-95" loading="lazy" />}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Tools — collapsible group */}
            <div>
              <button
                type="button"
                onClick={() => setMobileAiToolsOpen(!mobileAiToolsOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mobileAiToolsOpen || isAiToolActive
                    ? navActiveClass
                    : `text-white/90 bg-charcoal-light/70 ${tierTheme.menuBorder} hover:text-white ${tierTheme.navHover}`
                }`}
                aria-expanded={mobileAiToolsOpen}
              >
                <span className="font-semibold tracking-wide">{t('nav.aiTools')}</span>
                <ChevronDown className={`w-4 h-4 text-white/85 transition-transform duration-200 ${mobileAiToolsOpen ? "rotate-180" : ""}`} />
              </button>

              {mobileAiToolsOpen && (
                <div className={`mt-2 ml-3 pl-3 border-l-2 ${tierTheme.mobileMenuBorder} space-y-1`}>
                  {AI_TOOL_GROUPS.map((group) => (
                    <div key={group.heading}>
                      <p className={`px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider ${group.accent}`}>
                        {group.heading}
                      </p>
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        const isGated = isToolLocked(link);
                        return (
                          <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                              isGated ? "text-white/75 bg-charcoal-light/65 border-white/10 hover:text-white hover:bg-charcoal-light/80"
                                : location.pathname === link.to ? navActiveClass
                                : `text-white/90 bg-charcoal-light/65 ${tierTheme.menuBorder} hover:text-white ${tierTheme.navHover}`
                            }`}>
                            <Icon className={`w-8 h-8 ${isGated ? "text-white/45" : link.color}`} />
                            {link.label}
                            {isGated && <img src={LOCKED_FEATURE_IMAGE_URL} alt="Locked feature" className="w-8 h-8 rounded-sm object-cover opacity-95" loading="lazy" />}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Docs — collapsible group */}
            <div>
              <button
                type="button"
                onClick={() => setMobileDocsOpen(!mobileDocsOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mobileDocsOpen || isDocsActive
                    ? navActiveClass
                    : `text-white/75 bg-charcoal-light/50 border-white/10 hover:text-white ${tierTheme.navHover}`
                }`}
                aria-expanded={mobileDocsOpen}
              >
                <span className="font-semibold tracking-wide">{t('nav.docs')}</span>
                <ChevronDown className={`w-4 h-4 text-white/85 transition-transform duration-200 ${mobileDocsOpen ? "rotate-180" : ""}`} />
              </button>

              {mobileDocsOpen && (
                <div className="mt-2 ml-3 pl-3 border-l-2 border-white/25 space-y-1">
                  {DOCS_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                          location.pathname === link.to ? navActiveClass : "text-white/75 hover:text-white hover:bg-charcoal-light"
                        }`}>
                        <Icon className={`w-4 h-4 ${link.color}`} />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <Link
              to="/pricing"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                location.pathname === "/pricing" ? navActiveClass : navInactiveClass
              }`}
            >
              {t('nav.pricing')}
            </Link>

          </div>
        </div>
      )}
    </nav>
  );
}
