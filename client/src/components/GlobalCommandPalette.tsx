import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

type PaletteCommand = {
  id: string;
  label: string;
  description: string;
  to: string;
  authRequired?: boolean;
};

const BASE_COMMANDS: PaletteCommand[] = [
  { id: "dashboard", label: "Dashboard", description: "Overview and latest visibility status", to: "/" },
  { id: "analyze", label: "Analyze", description: "Run a new AI visibility audit", to: "/analyze" },
  { id: "analytics", label: "Analytics", description: "Score trends and growth insights", to: "/analytics", authRequired: true },
  { id: "keywords", label: "Keywords", description: "AI keyword intelligence", to: "/keywords", authRequired: true },
  { id: "reports", label: "Reports", description: "Saved report history", to: "/reports", authRequired: true },
  { id: "pricing", label: "Pricing", description: "Plan comparison and upgrades", to: "/pricing" },
  { id: "billing", label: "Billing", description: "Subscription, invoices, and credits", to: "/billing", authRequired: true },
  { id: "api", label: "API Docs", description: "Developer docs and integration details", to: "/api-docs" },
  { id: "blog", label: "Blog", description: "Latest AI visibility insights", to: "/blogs" },
  { id: "settings", label: "Settings", description: "Account and notification preferences", to: "/settings", authRequired: true },
  { id: "support", label: "Support", description: "Help center and support routes", to: "/help" },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export default function GlobalCommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, token } = useAuthStore();
  const hasSession = isAuthenticated || Boolean(token);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const commands = useMemo(() => {
    return BASE_COMMANDS.filter((command) => {
      if (command.authRequired && !hasSession) return false;
      return true;
    });
  }, [hasSession]);

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;

    return commands.filter((command) => {
      const haystack = `${command.label} ${command.description} ${command.to}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (!isOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (filteredCommands.length ? (prev + 1) % filteredCommands.length : 0));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (filteredCommands.length ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0));
        return;
      }

      if (event.key === "Enter") {
        const command = filteredCommands[activeIndex];
        if (!command) return;
        event.preventDefault();
        setIsOpen(false);
        setQuery("");
        navigate(command.to);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, filteredCommands, isOpen, navigate]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    setActiveIndex(0);
  }, [isOpen, query]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-start justify-center p-4 md:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close command palette"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-2xl mt-8 border border-white/15 bg-charcoal-deep/95 rounded-2xl shadow-2xl shadow-black/45 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 bg-charcoal-light/40">
          <Search className="w-4 h-4 text-white/70" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a page name or command…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/45 outline-none border-0"
          />
          <span className="text-[10px] text-white/55 border border-white/20 px-2 py-0.5 rounded-md">Ctrl/Cmd + K</span>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-6 text-sm text-white/60">No matching command found.</div>
          ) : (
            filteredCommands.map((command, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                    navigate(command.to);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/25 to-indigo-500/20 border border-cyan-300/30"
                      : "hover:bg-charcoal-light/70 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{command.label}</span>
                    <span className="text-[11px] text-white/45">{command.to}</span>
                  </div>
                  <p className="text-[12px] text-white/60 mt-0.5">{command.description}</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
