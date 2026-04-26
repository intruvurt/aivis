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
  const isAuditDetailRoute = /^\/app\/audits\/[^/]+$/.test(location.pathname);
  const isImmersiveScanSurface = isScanRoute || isAuditDetailRoute;
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

  if (isImmersiveScanSurface) {
    const surfaceLabel = isAuditDetailRoute ? 'AiVIS Audit Review' : 'AiVIS Scan Workspace';
    const surfaceHint = isAuditDetailRoute ? 'Evidence review surface' : 'Live audit surface';

    return (
      <div className="aivis-theme-shell min-h-screen bg-[linear-gradient(180deg,#080c0a_0%,#0b100d_48%,#070a08_100%)] text-[color:var(--text)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#22ff6e] focus:text-[#08110c] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[#dfffe9]"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-[60] border-b border-[color:var(--border)] bg-[rgba(8,12,10,0.92)] backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <Link
                to="/app/scan"
                className="text-[11px] font-semibold tracking-[0.14em] text-[#22ff6e] uppercase"
              >
                {surfaceLabel}
              </Link>
              <span className="hidden text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)] md:inline">
                {surfaceHint}
              </span>
            </div>

            <nav className="hidden items-center gap-1.5 lg:flex">
              <Link
                to="/app/reports"
                className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] text-[color:var(--text-dim)] uppercase transition hover:border-[#22ff6e]/35 hover:text-[#dfffe9]"
              >
                Reports
              </Link>
              <Link
                to="/app/score-fix"
                className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] text-[color:var(--text-dim)] uppercase transition hover:border-[#22ff6e]/35 hover:text-[#dfffe9]"
              >
                Score Fix
              </Link>
              <Link
                to="/app/reverse-engineer"
                className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] text-[color:var(--text-dim)] uppercase transition hover:border-[#22ff6e]/35 hover:text-[#dfffe9]"
              >
                Reverse Engineer
              </Link>
              <Link
                to="/app/site-crawl"
                className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] text-[color:var(--text-dim)] uppercase transition hover:border-[#22ff6e]/35 hover:text-[#dfffe9]"
              >
                Site Crawl
              </Link>
            </nav>

            <div className="flex items-center gap-1.5">
              <Link
                to="/app/help"
                className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] tracking-[0.04em] text-[color:var(--text-dim)] uppercase transition hover:border-[#2d4038] hover:text-[color:var(--text)]"
              >
                Help
              </Link>
              <Link
                to="/app/settings"
                className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] tracking-[0.04em] text-[color:var(--text-dim)] uppercase transition hover:border-[#2d4038] hover:text-[color:var(--text)]"
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
    <div className="aurora-shell aivis-theme-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#22ff6e] focus:text-[#08110c] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[#dfffe9]"
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
          <div className="mx-4 mt-4 rounded-2xl border border-[#ffb830]/30 bg-[linear-gradient(135deg,rgba(255,184,48,0.12),rgba(17,24,20,0.96))] px-4 py-3 text-[13px] text-[#ffe0a3] shadow-[0_14px_32px_rgba(0,0,0,0.28)] sm:mx-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Verify your email to keep uninterrupted access. Grace period ends on{' '}
                <span className="font-semibold text-[color:var(--text)]">
                  {new Date(String(verificationGraceUntil)).toLocaleString()}
                </span>
                .
              </p>
              <Link
                to="/auth?mode=signin"
                className="inline-flex items-center justify-center rounded-full border border-[#ffb830]/35 bg-[#ffb830]/10 px-3 py-1.5 text-[12px] font-semibold text-[#ffe0a3] transition hover:bg-[#ffb830]/18"
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
