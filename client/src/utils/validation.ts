/**
 * URL validation utility with security checks.
 * Ensures the URL uses http/https and does not point to local or private IP addresses.
 */

export type ValidateUrlResult =
  | { valid: true; url: string }
  | { valid: false; error: string };

const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/**
 * Validates a string as an IPv4 address.
 */
function isValidIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (p.length === 0 || p.length > 3) return false;
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

/**
 * Checks if an IPv4 address falls into a private or reserved range.
 */
function isPrivateIPv4(host: string): boolean {
  if (!isValidIPv4(host)) return false;

  const [a, b] = host.split(".").map(Number);

  // 10.0.0.0/8
  if (a === 10) return true;

  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;

  // 0.0.0.0/8 (this network / unspecified)
  if (a === 0) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a disallowed local/private range.
 */
function isDisallowedIPv6(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // exact loopback
  if (h === "::1") return true;

  // unique local addresses fc00::/7
  if (h.startsWith("fc") || h.startsWith("fd")) return true;

  // link-local fe80::/10
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true;

  // unspecified ::
  if (h === "::") return true;

  return false;
}

/**
 * Detects IPv4-mapped IPv6 addresses (::ffff:192.168.1.1) and checks
 * if the embedded IPv4 is private.
 */
function hasPrivateEmbeddedIPv4(hostname: string): boolean {
  if (!hostname.includes(":") || !hostname.includes(".")) return false;

  // Split on ':' and look for the last part that contains a dot.
  const parts = hostname.split(":");
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.includes(".")) {
      // This part should be an IPv4 address.
      // Ensure it's not empty and valid.
      if (isPrivateIPv4(part)) {
        return true;
      }
      // If it's a public IPv4, still not allowed if we are strict?
      // For safety, we could also block any embedded IPv4, but that may be too aggressive.
      // We'll only block private ones.
    }
  }
  return false;
}

/**
 * Validates a URL string.
 * - Adds https:// if scheme is missing.
 * - Only allows http and https protocols.
 * - Blocks localhost, private IPv4 ranges, and disallowed IPv6 ranges.
 * - Normalizes output by removing trailing slash if it's the only path.
 */
export function validateUrl(input: string): ValidateUrlResult {
  const raw = (input ?? "").trim();
  if (!raw) return { valid: false, error: "URL is required" };

  // Lowercase the scheme before passing to new URL() - handles Https://, HTTP://, etc.
  const schemeLowered = raw.replace(
    /^([A-Za-z][A-Za-z0-9+\-.]*):\/\//,
    (_: string, scheme: string) => scheme.toLowerCase() + "://"
  );
  const candidate = URL_SCHEME_RE.test(schemeLowered) ? schemeLowered : `https://${schemeLowered}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Only allow http/https
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, error: "Only http and https URLs are allowed" };
  }

  const hostname = url.hostname.toLowerCase();

  // Block localhost (and subdomains)
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { valid: false, error: "Local addresses are not allowed" };
  }

  // Block IPv6 local/private ranges
  if (hostname.includes(":") && isDisallowedIPv6(hostname)) {
    return { valid: false, error: "Local addresses are not allowed" };
  }

  // Block IPv4 private ranges
  if (isPrivateIPv4(hostname)) {
    return { valid: false, error: "Private IP ranges are not allowed" };
  }

  // Block IPv6 addresses that embed a private IPv4 (e.g., ::ffff:192.168.1.1)
  if (hasPrivateEmbeddedIPv4(hostname)) {
    return { valid: false, error: "Private IP ranges are not allowed" };
  }

  // Normalize output so `https://example.com` does NOT become `https://example.com/`
  const normalized =
    url.pathname === "/" && !url.search && !url.hash
      ? `${url.protocol}//${url.host}`
      : url.toString();

  return { valid: true, url: normalized };
}