type IdentityLike = {
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  org_logo_url?: string | null;
  orgLogoUrl?: string | null;
  org_favicon_url?: string | null;
  orgFaviconUrl?: string | null;
};

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function getDisplayAvatarUrl(identity: IdentityLike | null | undefined): string | null {
  if (!identity) return null;
  return firstNonEmpty([
    identity.avatar_url,
    identity.avatarUrl,
    identity.org_logo_url,
    identity.orgLogoUrl,
    identity.org_favicon_url,
    identity.orgFaviconUrl,
  ]);
}

export function getDisplayName(identity: IdentityLike | null | undefined): string {
  const value = firstNonEmpty([
    identity?.display_name,
    identity?.full_name,
    identity?.name,
    identity?.email ? identity.email.split("@")[0] : null,
  ]);
  return value || "User";
}

export function getIdentityInitials(identity: IdentityLike | null | undefined): string {
  const source = getDisplayName(identity);
  const parts = source.split(/[\s@._-]+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return initials || "U";
}