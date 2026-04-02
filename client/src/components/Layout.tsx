import React from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";
import Footer from "./Footer";
import ScrollToTopButton from "./ScrollToTopButton";
import GlobalCommandPalette from "./GlobalCommandPalette";

/**
 * Public marketing shell — clean, premium, no app clutter.
 * Used for /, /pricing, /faq, /methodology, /blogs, etc.
 */
export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#060a14] text-white">
      {/* Skip to content — WCAG 2.1 Level A */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-600 focus:text-white focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main-content" className="flex-1 relative">
        <Outlet />
      </main>
      <Footer />
      <GlobalCommandPalette />
      <ScrollToTopButton />
    </div>
  );
}
