/**
 * BrandingProvider - White-label CSS variable injection for Agency / Enterprise.
 *
 * Fetches the active workspace's branding on mount and injects CSS custom
 * properties onto `document.documentElement` so any component can consume
 * `var(--brand-primary)`, `var(--brand-accent)`, `var(--brand-name)` etc.
 *
 * Silently no-ops on non-agency tiers (no network request is made).
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier } from "@shared/types";
import type { CanonicalTier } from "@shared/types";

const API = API_URL.replace(/\/+$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrandingConfig {
  company_name?: string | null;
  logo_url?: string | null;
  logo_base64?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  footer_text?: string | null;
  tagline?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
  show_cover_page?: boolean | null;
}

interface BrandingContextValue {
  branding: BrandingConfig | null;
  isLoading: boolean;
  reload: () => void;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  isLoading: false,
  reload: () => {},
});

// ── CSS injection helpers ─────────────────────────────────────────────────────

const BRAND_VAR_DEFAULTS = {
  "--brand-primary": "#6366f1",
  "--brand-accent": "#8b5cf6",
  "--brand-name": "AiVIS",
};

function injectBrandVars(b: BrandingConfig | null) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", b?.primary_color || BRAND_VAR_DEFAULTS["--brand-primary"]);
  root.style.setProperty("--brand-accent", b?.accent_color || BRAND_VAR_DEFAULTS["--brand-accent"]);
  root.style.setProperty("--brand-name", b?.company_name || BRAND_VAR_DEFAULTS["--brand-name"]);
}

function clearBrandVars() {
  const root = document.documentElement;
  Object.entries(BRAND_VAR_DEFAULTS).forEach(([k, v]) => root.style.setProperty(k, v));
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const tier = (user?.tier ?? "observer") as CanonicalTier;

  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function load() {
    if (!meetsMinimumTier(tier, "signal") || !token) {
      clearBrandVars();
      return;
    }
    setIsLoading(true);
    try {
      // Try to get the first org the user owns
      const orgRes = await fetch(`${API}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!orgRes.ok) return;
      const orgData = await orgRes.json();
      const firstOrg = orgData?.data?.[0];
      if (!firstOrg?.id) return;

      const brandRes = await fetch(`${API}/api/orgs/${firstOrg.id}/branding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!brandRes.ok) return;
      const brandData = await brandRes.json();
      const b: BrandingConfig = brandData?.data ?? null;
      setBranding(b);
      injectBrandVars(b);
    } catch {
      // silent - branding is cosmetic, never block the app
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => clearBrandVars();
  }, [user?.id, tier]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, reload: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBranding() {
  return useContext(BrandingContext);
}
