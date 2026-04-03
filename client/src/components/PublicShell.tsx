import React from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";
import Footer from "./Footer";
import ScrollToTopButton from "./ScrollToTopButton";

export default function PublicShell() {
  return (
    <div className="min-h-screen flex flex-col bg-[#060a14] text-white">
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
      <ScrollToTopButton />
    </div>
  );
}