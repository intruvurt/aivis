import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Bell, LogOut, User, BookOpen, ChevronDown, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import useNotifications from "../hooks/useNotifications";
import { getDisplayAvatarUrl, getDisplayName, getIdentityInitials } from "../utils/userIdentity";

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
  const [searchQuery, setSearchQuery] = useState("");
  const avatarUrl = getDisplayAvatarUrl(user);
  const displayName = getDisplayName(user);
  const initials = getIdentityInitials(user);

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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('topbar.searchAudits', 'Search audits...')}
            aria-label={t('topbar.searchAudits', 'Search audits')}
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-white/[0.06] border border-white/[0.09] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.08] transition-all"
          />
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
          to="/api-docs"
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
              <img src={avatarUrl} alt="" className="h-full w-full rounded-lg object-cover" />
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
