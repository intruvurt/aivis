import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppTopBar from './AppTopBar';
import Footer from './Footer';
import GlobalCommandPalette from './GlobalCommandPalette';
import TrialBanner from './TrialBanner';
import ScanFlowBanner from './ScanFlowBanner';
import RouteGuideBar from './RouteGuideBar';
import { getRouteGuide } from '../config/routeIntelligence';
import { useAuthStore } from '../stores/authStore';

const GuideBot = React.lazy(() => import('./GuideBot'));

function OutletErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl">
        ⚠️
      </div>
      <h2 className="text-lg font-semibold text-white">Page failed to load</h2>
      <p className="text-white/50 text-sm max-w-xs">
        This can happen on slow connections or after a deployment. Try reloading.
      </p>
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

// key={location.pathname} on the JSX element forces React to unmount+remount
// this class component on every navigation, resetting hasError to false so a
// crash on one route never permanently blocks subsequent routes.
class OutletErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppShell OutletError]', error, info.componentStack);
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
  const user = useAuthStore((s) => s.user);

  // Close sidebar on every route change (handles back/forward navigation on mobile)
  const location = useLocation();
  const isScanRoute = location.pathname === '/app/scan';
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  const routeGuide = getRouteGuide(location.pathname);
  const verificationGraceUntil = user?.verification_grace_until || null;
  const verificationReminderVisible =
    user?.is_verified === false &&
    user?.verification_grace_active === true &&
    !!verificationGraceUntil &&
    Number.isFinite(new Date(String(verificationGraceUntil)).getTime()) &&
    new Date(String(verificationGraceUntil)).getTime() > Date.now();

  if (isScanRoute) {
    return (
      <div className="min-h-screen bg-[#05070d] text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-600 focus:text-white focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-[60] border-b border-white/10 bg-[#070a12]/88 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Link
                to="/app/scan"
                className="text-xs font-semibold tracking-[0.18em] text-cyan-200/90 uppercase"
              >
                AiVIS Scan Workspace
              </Link>
              <span className="hidden text-[11px] text-white/35 md:inline">Live audit surface</span>
            </div>

            <nav className="hidden items-center gap-2 lg:flex">
              <Link
                to="/app/reports"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/45 hover:text-cyan-100"
              >
                Reports
              </Link>
              <Link
                to="/app/score-fix"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/45 hover:text-cyan-100"
              >
                Score Fix
              </Link>
              <Link
                to="/app/reverse-engineer"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/45 hover:text-cyan-100"
              >
                Reverse Engineer
              </Link>
              <Link
                to="/app/site-crawl"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/45 hover:text-cyan-100"
              >
                Site Crawl
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                to="/app/help"
                className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Help
              </Link>
              <Link
                to="/app/settings"
                className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Settings
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content" role="main" aria-label="Scan workspace content">
          <OutletErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageLoadingIndicator />}>
              <Outlet />
            </Suspense>
          </OutletErrorBoundary>
        </main>

        <GlobalCommandPalette />
        <Suspense fallback={null}>
          <GuideBot />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="aurora-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-600 focus:text-white focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>

      <div
        className={`aurora-overlay ${sidebarOpen ? 'is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      <AppSidebar isOpen={sidebarOpen} onClose={close} />

      <div className="aurora-main">
        <AppTopBar onMenuClick={() => setSidebarOpen(true)} />
        {verificationReminderVisible ? (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-300/35 bg-gradient-to-r from-amber-500/18 via-orange-500/12 to-rose-500/12 px-4 py-3 text-[13px] text-amber-100 shadow-[0_14px_32px_rgba(0,0,0,0.28)] sm:mx-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Verify your email to keep uninterrupted access. Grace period ends on{' '}
                <span className="font-semibold text-white">
                  {new Date(String(verificationGraceUntil)).toLocaleString()}
                </span>
                .
              </p>
              <Link
                to="/auth?mode=signin"
                className="inline-flex items-center justify-center rounded-full border border-amber-100/40 bg-amber-100/15 px-3 py-1.5 text-[12px] font-semibold text-amber-50 transition hover:bg-amber-100/25"
              >
                Resend verification
              </Link>
            </div>
          </div>
        ) : null}
        <TrialBanner />
        <ScanFlowBanner />
        {routeGuide ? <RouteGuideBar guide={routeGuide} /> : null}
        <main id="main-content" className="aurora-content" role="main" aria-label="App content">
          <OutletErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageLoadingIndicator />}>
              <Outlet />
            </Suspense>
          </OutletErrorBoundary>
        </main>
        <Footer />
      </div>

      <GlobalCommandPalette />
      <Suspense fallback={null}>
        <GuideBot />
      </Suspense>
    </div>
  );
}
