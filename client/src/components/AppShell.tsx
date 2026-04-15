import React, { Suspense, useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppTopBar from "./AppTopBar";
import Footer from "./Footer";
import GlobalCommandPalette from "./GlobalCommandPalette";
import TrialBanner from "./TrialBanner";

const GuideBot = React.lazy(() => import("./GuideBot"));

function OutletErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-2xl">⚠️</div>
      <h2 className="text-lg font-semibold text-white">Page failed to load</h2>
      <p className="text-white/50 text-sm max-w-xs">This can happen on slow connections or after a deployment. Try reloading.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-5 py-2 rounded-xl bg-orange-400 text-slate-950 text-sm font-semibold hover:bg-orange-300 transition-colors"
      >
        Reload page
      </button>
    </div>
  );
}

class OutletErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppShell OutletError]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) return <OutletErrorFallback />;
    return this.props.children;
  }
}

function PageLoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-orange-400" />
    </div>
  );
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const close = useCallback(() => setSidebarOpen(false), []);

  // Close sidebar on every route change (handles back/forward navigation on mobile)
  const location = useLocation();
  useEffect(() => {
    close();
  }, [location.pathname, close]);

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
          <OutletErrorBoundary>
            <Suspense fallback={<PageLoadingIndicator />}>
              <Outlet />
            </Suspense>
          </OutletErrorBoundary>
          <Footer />
        </main>
      </div>

      <GlobalCommandPalette />
      <Suspense fallback={null}>
        <GuideBot />
      </Suspense>
    </div>
  );
}