import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  LogOut,
  User,
  BookOpen,
  ChevronDown,
  Menu,
  FileText,
  Globe,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import useNotifications from '../hooks/useNotifications';
import { getDisplayAvatarUrl, getDisplayName, getIdentityInitials } from '../utils/userIdentity';
import useGlobalSearch, {
  type SearchResult,
  type SearchResultKind,
} from '../hooks/useGlobalSearch';
import { apiFetch } from '../utils/api';

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
  const [audits, setAudits] = useState<
    { id: string; url: string; name?: string; score?: number }[]
  >([]);
  const auditsFetched = useRef(false);
  useEffect(() => {
    if (auditsFetched.current) return;
    auditsFetched.current = true;
    apiFetch('/api/audits?limit=100')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: any) => {
        const list = Array.isArray(d) ? d : (d?.audits ?? []);
        setAudits(
          list.map((a: any) => ({
            id: a.id ?? a.audit_id,
            url: a.url ?? a.target_url,
            name: a.name ?? a.url ?? a.target_url,
            score: a.score ?? a.visibility_score,
          }))
        );
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
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [clear]);

  // Close on route change
  useEffect(() => {
    clear();
  }, [location.pathname, clear]);

  const kindIcon = (kind: SearchResultKind) => {
    if (kind === 'blog') return <FileText className="w-3.5 h-3.5 text-[#ffb830] flex-shrink-0" />;
    if (kind === 'audit') return <BarChart3 className="w-3.5 h-3.5 text-[#22ff6e] flex-shrink-0" />;
    return <Globe className="w-3.5 h-3.5 text-[#c8ffd8] flex-shrink-0" />;
  };

  const kindLabel = (kind: SearchResultKind) => {
    if (kind === 'blog') return 'Blog';
    if (kind === 'audit') return 'Audit';
    return 'Page';
  };

  const goTo = useCallback(
    (r: SearchResult) => {
      clear();
      navigate(r.path);
    },
    [clear, navigate]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault();
      goTo(results[activeIdx]);
    } else if (e.key === 'Escape') {
      clear();
      inputRef.current?.blur();
    }
  };

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(-1);
  }, [results]);

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-4 sm:px-6 bg-[linear-gradient(180deg,rgba(13,18,16,0.94),rgba(8,12,10,0.88))] backdrop-blur-xl border-b border-[color:var(--border)] shadow-[0_1px_0_0_rgba(34,255,110,0.08),0_16px_36px_rgba(0,0,0,0.24)]"
      role="banner"
      aria-label="App toolbar"
    >
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
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('topbar.searchAudits', 'Search audits, pages, blogs...')}
            aria-label={t('topbar.searchAudits', 'Search audits, pages, blogs')}
            aria-expanded={isOpen ? 'true' : 'false'}
            aria-controls="global-search-results"
            aria-activedescendant={activeIdx >= 0 ? `gsr-${activeIdx}` : undefined}
            role="combobox"
            autoComplete="off"
            className="w-full h-10 pl-9 pr-3 rounded-2xl bg-[rgba(17,24,20,0.78)] border border-[color:var(--border)] text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[#22ff6e]/40 focus:bg-[rgba(21,29,24,0.96)] focus:ring-2 focus:ring-[#22ff6e]/10 transition-all"
          />
          {isOpen && results.length > 0 && (
            <ul
              id="global-search-results"
              role="listbox"
              className="absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-[rgba(13,18,16,0.98)] border border-[color:var(--border)] shadow-xl shadow-black/40 z-50"
            >
              {results.map((r, i) => (
                <li
                  key={`${r.kind}-${r.path}`}
                  id={`gsr-${i}`}
                  role="option"
                  aria-selected={i === activeIdx ? 'true' : 'false'}
                  className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors ${i === activeIdx ? 'bg-[rgba(34,255,110,0.08)] text-[color:var(--text)]' : 'text-[color:var(--text-dim)] hover:bg-[rgba(17,24,20,0.92)] hover:text-[color:var(--text)]'}`}
                  onMouseDown={() => goTo(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  {kindIcon(r.kind)}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.label}</div>
                    {r.description && (
                      <div className="truncate text-xs text-[color:var(--text-muted)]">
                        {r.description}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)] flex-shrink-0">
                    {kindLabel(r.kind)}
                  </span>
                  {r.score != null && (
                    <span
                      className={`text-xs font-mono flex-shrink-0 ${r.score >= 70 ? 'text-[#22ff6e]' : r.score >= 40 ? 'text-[#ffb830]' : 'text-[#ff8a7a]'}`}
                    >
                      {r.score}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isOpen && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-[rgba(13,18,16,0.98)] border border-[color:var(--border)] shadow-xl shadow-black/40 z-50 px-4 py-3 text-sm text-[color:var(--text-muted)]">
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
            if (location.pathname === '/app/analyze') {
              const urlInput = document.getElementById('url-input');
              if (urlInput) {
                urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                urlInput.focus();
              }
            } else {
              navigate('/app/analyze');
            }
          }}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[linear-gradient(135deg,#22ff6e,#b3ff61)] text-[#08110c] text-xs font-semibold hover:brightness-110 transition-colors border border-[#dfffe9]/30 shadow-[0_10px_24px_rgba(34,255,110,0.16)]"
        >
          <Search className="w-3.5 h-3.5" />
          {t('topbar.runAudit', 'Run Audit')}
        </button>

        {/* Documentation */}
        <Link
          to="/app/api-docs"
          className="p-2 rounded-xl text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[rgba(17,24,20,0.92)] transition-colors"
          title={t('topbar.documentation', 'Documentation')}
          aria-label={t('topbar.documentation', 'Documentation')}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
        </Link>

        {/* Notifications */}
        <Link
          to="/app/notifications"
          className="relative p-2 rounded-xl text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[rgba(17,24,20,0.92)] transition-colors"
          aria-label={
            unreadCount > 0
              ? t('topbar.notificationsUnread', 'Notifications ({{count}} unread)', {
                  count: unreadCount,
                })
              : t('topbar.notifications', 'Notifications')
          }
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ffb830] ring-2 ring-[#0b100d]" />
          )}
        </Link>

        {/* Divider */}
        <div className="w-px h-6 bg-[color:var(--border)] mx-1" aria-hidden="true" />

        {/* User */}
        <Link
          to="/app/settings"
          className="flex items-center gap-2 p-1.5 rounded-xl text-[color:var(--text-dim)] hover:text-[color:var(--text)] hover:bg-[rgba(17,24,20,0.92)] transition-colors"
          aria-label={t('settings.title', 'User settings')}
        >
          <div className="w-8 h-8 rounded-xl bg-[rgba(17,24,20,0.96)] border border-[color:var(--border)] flex items-center justify-center text-[11px] font-bold text-[color:var(--text)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="User avatar"
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <span className="hidden md:inline text-xs font-medium truncate max-w-[100px]">
            {displayName}
          </span>
        </Link>

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="p-2 rounded-xl text-[color:var(--text-muted)] hover:text-[#ff8a7a] hover:bg-[rgba(17,24,20,0.92)] transition-colors"
          title={t('topbar.signOut', 'Sign out')}
          aria-label={t('topbar.signOut', 'Sign out')}
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
