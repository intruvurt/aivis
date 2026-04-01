import React from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";
import Footer from "./Footer";
import GuideBot from "./GuideBot";
import BixThoughtBubble from "./BixThoughtBubble";
import BackgroundDecoration from "./BackgroundDecoration";
import ScrollToTopButton from "./ScrollToTopButton";
import GlobalCommandPalette from "./GlobalCommandPalette";
import TrialBanner from "./TrialBanner";
import InfraNoticeBanner from "./InfraNoticeBanner";
import PlatformUpdateBanner from "./PlatformUpdateBanner";

export default function Layout() {
  return (
    <div className="premium-shell min-h-screen flex flex-col text-white dark:text-white">
      {/* Skip to content — WCAG 2.1 Level A */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-600 focus:text-white focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>
      <BackgroundDecoration />
      <div className="pointer-events-none fixed inset-0 z-0 elemental-vibrancy-splash" aria-hidden="true" />
      {/* Smoked glass overlays — drifting accent glows + intersecting line art */}
      <div className="smoke-drift" aria-hidden="true" />
      <div className="line-art-overlay" aria-hidden="true" />
      <TopNav />
      <PlatformUpdateBanner />
      <InfraNoticeBanner />
      <TrialBanner />
      <main id="main-content" className="flex-1 relative z-10">
        <Outlet />
      </main>
      <div className="relative z-20 flex-shrink-0">
        <Footer />
      </div>
      <GlobalCommandPalette />
      <ScrollToTopButton />
      <GuideBot />
      <BixThoughtBubble />
    </div>
  );
}
