import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from './TopNav';
import Footer from './Footer';
import ScrollToTopButton from './ScrollToTopButton';
import RouteGuideBar from './RouteGuideBar';
import { getPublicRouteGuide } from '../config/routeIntelligence';

export default function PublicLayout() {
  const location = useLocation();
  const routeGuide = getPublicRouteGuide(location.pathname);

  return (
    <div className="aivis-theme-shell min-h-screen flex flex-col bg-[linear-gradient(180deg,#080c0a_0%,#0b100d_48%,#070a08_100%)] text-[color:var(--text)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#22ff6e] focus:text-[#08110c] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[#dfffe9]"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main-content" className="flex-1 relative bg-mesh">
        {routeGuide ? <RouteGuideBar guide={routeGuide} /> : null}
        <Outlet />
      </main>
      <Footer />
      <ScrollToTopButton />
    </div>
  );
}
