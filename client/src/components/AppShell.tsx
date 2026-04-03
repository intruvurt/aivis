import React, { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppTopBar from "./AppTopBar";
import GlobalCommandPalette from "./GlobalCommandPalette";
import TrialBanner from "./TrialBanner";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const close = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    close();
  }, [close]);

  return (
    <div className="aurora-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-600 focus:text-white focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>

      <div
        className={`aurora-overlay ${sidebarOpen ? "is-open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      <AppSidebar isOpen={sidebarOpen} onClose={close} />

      <div className="aurora-main">
        <AppTopBar onMenuClick={() => setSidebarOpen(true)} />
        <TrialBanner />
        <main id="main-content" className="aurora-content" role="main" aria-label="App content">
          <Outlet />
        </main>
      </div>

      <GlobalCommandPalette />
    </div>
  );
}