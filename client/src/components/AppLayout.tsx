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
    <div className="min-h-screen bg-[#060a14] text-white flex">
      <AppSidebar />

      {/* Main area — offset by sidebar width */}
      <div className="flex-1 ml-[220px] flex flex-col min-h-screen">
        <AppTopBar />
        <TrialBanner />

        <main className="flex-1 px-6 py-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <GlobalCommandPalette />
    </div>
  );
}
