/**
 * Domain age lookup via IANA RDAP bootstrap.
 * Uses the public RDAP protocol (RFC 7483) — no API key required.
 * Falls back to 0 on any error, timeout, or unsupported TLD so the
 * rest of the audit pipeline is never blocked.
 */

const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const RDAP_TIMEOUT_MS = 4000;

interface RdapBootstrap {
  services: Array<[string[], string[]]>;
}

let bootstrapCache: RdapBootstrap | null = null;
let bootstrapFetchedAt = 0;
const BOOTSTRAP_TTL_MS = 1000 * 60 * 60 * 6; // 6-hour cache

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function getRdapBaseUrl(tld: string): Promise<string | null> {
  const now = Date.now();
  if (!bootstrapCache || now - bootstrapFetchedAt > BOOTSTRAP_TTL_MS) {
    try {
      const res = await fetchWithTimeout(RDAP_BOOTSTRAP_URL, RDAP_TIMEOUT_MS);
      if (!res.ok) return null;
      bootstrapCache = (await res.json()) as RdapBootstrap;
      bootstrapFetchedAt = now;
    } catch {
      return null;
    }
  }

  const normalized = tld.toLowerCase().replace(/^\./, '');
  for (const [tlds, baseUrls] of bootstrapCache.services) {
    if (tlds.some((t) => t.toLowerCase() === normalized)) {
      return baseUrls[0]?.replace(/\/$/, '') ?? null;
    }
  }
  return null;
}

/**
 * Returns the domain age in fractional years, or 0 if lookup fails.
 * Never throws.
 */
export async function lookupDomainAgeYears(hostname: string): Promise<number> {
  try {
    const parts = hostname.replace(/\.$/, '').split('.');
    if (parts.length < 2) return 0;

    // Use registrable domain (last two labels, or last three for known 2nd-level TLDs)
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    const domain = `${sld}.${tld}`;

    const baseUrl = await getRdapBaseUrl(tld);
    if (!baseUrl) return 0;

    const rdapUrl = `${baseUrl}/domain/${encodeURIComponent(domain)}`;
    const res = await fetchWithTimeout(rdapUrl, RDAP_TIMEOUT_MS);
    if (!res.ok) return 0;

    const data = await res.json() as {
      events?: Array<{ eventAction: string; eventDate: string }>;
    };

    if (!data?.events?.length) return 0;

    const registrationEvent = data.events.find(
      (e) => e.eventAction === 'registration'
    );
    if (!registrationEvent?.eventDate) return 0;

    const registeredMs = new Date(registrationEvent.eventDate).getTime();
    if (Number.isNaN(registeredMs)) return 0;

    const ageMs = Date.now() - registeredMs;
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, Math.round(ageYears * 10) / 10); // 1 decimal place
  } catch {
    return 0;
  }
}
