import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

/**
 * ScanShell — bare wrapper for the evidence engine routes.
 *
 * Deliberately has:
 *   - NO sidebar
 *   - NO topbar / persistent navigation
 *   - NO layout chrome
 *
 * Each route inside renders full-bleed, full-viewport UI driven
 * by internal state (idle → scanning → complete), not page navigation.
 *
 * All other app routes (evidence, settings, billing, …) remain in
 * the standard AppLayout so operator/infra surfaces retain their
 * dashboard shell.
 */
export default function ScanShell() {
  return (
    <ProtectedRoute>
      <div className="scan-shell min-h-screen bg-[#080c14] text-white">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}
