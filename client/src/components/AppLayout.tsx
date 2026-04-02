import React from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppTopBar from "./AppTopBar";
import GlobalCommandPalette from "./GlobalCommandPalette";
import TrialBanner from "./TrialBanner";

/**
 * Authenticated app shell — fixed sidebar + top bar + scrollable main content.
 * Used for all /app/* routes.
 */
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white flex">
      {/* Skip to content — WCAG 2.1 Level A (2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-600 focus:text-white focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>

      <AppSidebar />

      {/* Main area — offset by sidebar width */}
      <div className="flex-1 ml-[220px] flex flex-col min-h-screen">
        <AppTopBar />
        <TrialBanner />

        <main id="main-content" className="flex-1 px-6 py-5 overflow-y-auto" role="main" aria-label="App content">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <GlobalCommandPalette />
    </div>
  );
}
