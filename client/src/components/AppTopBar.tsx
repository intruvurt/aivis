import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, User } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import useNotifications from "../hooks/useNotifications";

export default function AppTopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 px-6 bg-[#0a0e18]/80 backdrop-blur-xl border-b border-white/[0.06]">
      {/* Left — page context */}
      <div className="flex items-center gap-3 min-w-0" />

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        {/* Quick audit */}
        <button
          onClick={() => navigate("/app/analyze")}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          Run Audit
        </button>

        {/* Notifications */}
        <Link
          to="/app/notifications"
          className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />
          )}
        </Link>

        {/* Profile */}
        <Link
          to="/app/settings"
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <User className="w-4 h-4" />
        </Link>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
