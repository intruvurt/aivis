import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Bell, LogOut, User, BookOpen, ChevronDown, Menu, FileText, Globe, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import useNotifications from "../hooks/useNotifications";
import { getDisplayAvatarUrl, getDisplayName, getIdentityInitials } from "../utils/userIdentity";
import useGlobalSearch, { type SearchResult, type SearchResultKind } from "../hooks/useGlobalSearch";
import { apiFetch } from "../utils/api";

interface AppTopBarProps {
  onMenuClick?: () => void;
}

export default function AppTopBar({ onMenuClick }: AppTopBarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const { t } = useTranslation();
  const avatarUrl = getDisplayAvatarUrl(user);
  const displayName = getDisplayName(user);
  const initials = getIdentityInitials(user);

  // ─── audits for global search ────────────────────────────────────
  const [audits, setAudits] = useState<{ id: string; url: string; name?: string; score?: number }[]>([]);
  const auditsFetched = useRef(false);
  useEffect(() => {
    if (auditsFetched.current) return;
    auditsFetched.current = true;
    apiFetch("/api/audits?limit=100")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: any) => {
        const list = Array.isArray(d) ? d : d?.audits ?? [];
        setAudits(list.map((a: any) => ({ id: a.id ?? a.audit_id, url: a.url ?? a.target_url, name: a.name ?? a.url ?? a.target_url, score: a.score ?? a.visibility_score })));
      })
      .catch(() => {});
  }, []);

  const { query, setQuery, results, clear, isOpen } = useGlobalSearch({ audits });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) clear();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [clear]);

  // Close on route change
  useEffect(() => { clear(); }, [location.pathname, clear]);

  const kindIcon = (kind: SearchResultKind) => {
    if (kind === "blog") return <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    if (kind === "audit") return <BarChart3 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
    return <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  };

  const kindLabel = (kind: SearchResultKind) => {
    if (kind === "blog") return "Blog";
    if (kind === "audit") return "Audit";
    return "Page";
  };

  const goTo = useCallback((r: SearchResult) => {
    clear();
    navigate(r.path);
  }, [clear, navigate]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) { e.preventDefault(); goTo(results[activeIdx]); }
    else if (e.key === "Escape") { clear(); inputRef.current?.blur(); }
  };

  // Reset active index when results change
  useEffect(() => { setActiveIdx(-1); }, [results]);

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 px-4 sm:px-6 bg-[#0c1221]/95 backdrop-blur-md border-b border-white/[0.08]" role="banner" aria-label="App toolbar">
      {/* Left - hamburger (mobile) + search */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Mobile menu button */}
        <button
          className="aurora-menu-btn"
          onClick={onMenuClick}
          aria-label={t('topbar.openMenu', 'Open navigation menu')}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-md" ref={wrapperRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('topbar.searchAudits', 'Search audits, pages, blogs...')}
            aria-label={t('topbar.searchAudits', 'Search audits, pages, blogs')}
            aria-expanded={isOpen}
            aria-controls="global-search-results"
            aria-activedescendant={activeIdx >= 0 ? `gsr-${activeIdx}` : undefined}
            role="combobox"
            autoComplete="off"
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-white/[0.06] border border-white/[0.09] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.08] transition-all"
          />
          {isOpen && results.length > 0 && (
            <ul
              id="global-search-results"
              role="listbox"
              className="absolute top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-lg bg-[#111827] border border-white/[0.1] shadow-xl shadow-black/40 z-50"
            >
              {results.map((r, i) => (
                <li
                  key={`${r.kind}-${r.path}`}
                  id={`gsr-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm transition-colors ${i === activeIdx ? "bg-white/[0.08] text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}
                  onMouseDown={() => goTo(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  {kindIcon(r.kind)}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.label}</div>
                    {r.description && <div className="truncate text-xs text-slate-500">{r.description}</div>}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 flex-shrink-0">{kindLabel(r.kind)}</span>
                  {r.score != null && (
                    <span className={`text-xs font-mono flex-shrink-0 ${r.score >= 70 ? "text-emerald-400" : r.score >= 40 ? "text-amber-400" : "text-red-400"}`}>
                      {r.score}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isOpen && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[#111827] border border-white/[0.1] shadow-xl shadow-black/40 z-50 px-4 py-3 text-sm text-slate-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Right - actions */}
      <div className="flex items-center gap-1.5">
        {/* Quick audit */}
        <button
          onClick={() => {
            if (location.pathname === "/app/analyze") {
              const urlInput = document.getElementById("url-input");
              if (urlInput) {
                urlInput.scrollIntoView({ behavior: "smooth", block: "center" });
                urlInput.focus();
              }
            } else {
              navigate("/app/analyze");
            }
          }}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-md shadow-blue-700/30 border border-blue-400/20"
        >
          <Search className="w-3.5 h-3.5" />
          {t('topbar.runAudit', 'Run Audit')}
        </button>

        {/* Documentation */}
        <Link
          to="/app/api-docs"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title={t('topbar.documentation', 'Documentation')}
          aria-label={t('topbar.documentation', 'Documentation')}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
        </Link>

        {/* Notifications */}
        <Link
          to="/app/notifications"
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label={unreadCount > 0 ? t('topbar.notificationsUnread', 'Notifications ({{count}} unread)', { count: unreadCount }) : t('topbar.notifications', 'Notifications')}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#0c1221]" />
          )}
        </Link>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] mx-1" aria-hidden="true" />

        {/* User */}
        <Link
          to="/app/settings"
          className="flex items-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label={t('settings.title', 'User settings')}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/25 flex items-center justify-center text-[11px] font-bold text-blue-300">
            {avatarUrl ? (
              <img src={avatarUrl} alt="User avatar" className="h-full w-full rounded-lg object-cover" />
            ) : (
              initials
            )}
          </div>
          <span className="hidden md:inline text-xs font-medium truncate max-w-[100px]">{displayName}</span>
        </Link>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
          title={t('topbar.signOut', 'Sign out')}
          aria-label={t('topbar.signOut', 'Sign out')}
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
