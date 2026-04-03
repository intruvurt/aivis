import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, User, BookOpen, ChevronDown, Menu } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import useNotifications from "../hooks/useNotifications";

interface AppTopBarProps {
  onMenuClick?: () => void;
}

export default function AppTopBar({ onMenuClick }: AppTopBarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 px-4 sm:px-6 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-white/[0.06]" role="banner" aria-label="App toolbar">
      {/* Left — hamburger (mobile) + search */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Mobile menu button */}
        <button
          className="aurora-menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
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
            placeholder="Search audits..."
            aria-label="Search audits"
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1.5">
        {/* Quick audit */}
        <button
          onClick={() => navigate("/app/analyze")}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
        >
          <Search className="w-3.5 h-3.5" />
          Run Audit
        </button>

        {/* Documentation */}
        <Link
          to="/docs"
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors"
          title="Documentation"
          aria-label="Documentation"
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
        </Link>

        {/* Notifications */}
        <Link
          to="/app/notifications"
          className="relative p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#0b0f1a]" />
          )}
        </Link>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.06] mx-1" aria-hidden="true" />

        {/* User */}
        <Link
          to="/app/settings"
          className="flex items-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center text-[11px] font-bold text-cyan-400">
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <span className="hidden md:inline text-xs font-medium truncate max-w-[100px]">{user?.name || user?.email}</span>
        </Link>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
