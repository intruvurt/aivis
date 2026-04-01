import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return false;
    // Allow 30s buffer to avoid race with in-flight requests
    return payload.exp * 1000 < Date.now() - 30_000;
  } catch {
    return true;
  }
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  if (!token || isTokenExpired(token)) {
    // Clear stale auth state if token is expired
    if (token) logout();
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?mode=signin&redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
