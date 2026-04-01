// urlValidator.js
import { buildEvidence, Evidence } from "./evidenceUtils.js";

interface Stage1Result {
    valid: boolean;
    normalizedUrl?: string;
    evidence: Evidence[];
    errors: string[];
}

/**
 * Validate & normalize a URL.
 */
export function validateAndNormalizeUrl(rawUrl: string): Stage1Result {
  const evidence: Evidence[] = [];
  const errors: string[] = [];

  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    errors.push("URL must be a non-empty string");
    evidence.push(
      buildEvidence({
        proof: null,
        source: rawUrl,
        verifiedBy: "URL Validator",
        description: "Provided URL is empty or not a string"
      })
    );
    return { valid: false, evidence, errors };
  }

  let url;
  try {
    // Normalize scheme to lowercase before parsing — handles Https://, HTTP://, etc.
    const schemeLowered = rawUrl.replace(
      /^([A-Za-z][A-Za-z0-9+.-]*):[\/]{2}/,
      (_: string, scheme: string) => scheme.toLowerCase() + '://'
    );
    const prefixed = /^https?:\/\//.test(schemeLowered) ? schemeLowered : `https://${schemeLowered}`;
    url = new URL(prefixed);
  } catch {
    errors.push("Invalid URL format");
    evidence.push(
      buildEvidence({
        proof: rawUrl,
        source: rawUrl,
        verifiedBy: "URL Validator",
        description: "Failed to parse URL"
      })
    );
    return { valid: false, evidence, errors };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    errors.push("URL must use http:// or https://");
    evidence.push(
      buildEvidence({
        proof: url.protocol,
        source: url.href,
        verifiedBy: "URL Validator",
        description: "Unsupported protocol"
      })
    );
    return { valid: false, evidence, errors };
  }

  // normalize
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  const normalized = url.toString();
  evidence.push(
    buildEvidence({
      proof: normalized,
      source: rawUrl,
      verifiedBy: "URL Validator",
      description: "URL successfully validated and normalized"
    })
  );

  return { valid: true, normalizedUrl: normalized, evidence, errors };
}
