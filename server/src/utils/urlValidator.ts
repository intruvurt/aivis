import punycode from "punycode/punycode.ts";
import { URL } from "url";
import { buildEvidence } from "./evidence.ts";

/**
 * Safe private IP detection (replaces vulnerable private-ip package)
 */
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

/**
 * Stage 1: Input Normalization
 * Validates and normalizes URLs with SSRF protection
 */
export const validateAndNormalizeUrl = (inputUrl) => {
  const evidence = [];
  const errors = [];

  try {
    // Step 1: Validate URL syntax
    let parsedUrl;
    try {
      parsedUrl = new URL(inputUrl);
      evidence.push(buildEvidence({
        proof: `URL syntax valid: ${inputUrl}`,
        source: "URL Parser",
        verifiedBy: "Node.ts URL API",
        description: "URL passed syntax validation"
      }));
    } catch (error) {
      errors.push("Invalid URL syntax");
      evidence.push(buildEvidence({
        proof: null,
        source: "URL Parser",
        description: `URL syntax validation failed: ${error.message}`
      }));
      return { valid: false, evidence, errors, normalizedUrl: null };
    }

    // Step 2: Enforce protocols (only http/https)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      errors.push(`Protocol ${parsedUrl.protocol} not allowed. Only http and https are supported.`);
      evidence.push(buildEvidence({
        proof: null,
        source: "Protocol Validator",
        description: `Rejected protocol: ${parsedUrl.protocol}`
      }));
      return { valid: false, evidence, errors, normalizedUrl: null };
    }

    evidence.push(buildEvidence({
      proof: `Protocol ${parsedUrl.protocol} accepted`,
      source: "Protocol Validator",
      verifiedBy: "URL Normalization Pipeline",
      description: "Protocol enforcement passed"
    }));

    // Step 3: Handle Internationalized Domain Names (IDN) via punycode
    let normalizedHostname = parsedUrl.hostname;
    try {
      normalizedHostname = punycode.toASCII(parsedUrl.hostname);
      if (normalizedHostname !== parsedUrl.hostname) {
        evidence.push(buildEvidence({
          proof: `IDN converted: ${parsedUrl.hostname} → ${normalizedHostname}`,
          source: "Punycode Converter",
          verifiedBy: "Punycode Library",
          description: "Internationalized domain name normalized to ASCII"
        }));
      }
    } catch (error) {
      evidence.push(buildEvidence({
        proof: null,
        source: "Punycode Converter",
        description: `Punycode conversion failed: ${error.message}`
      }));
    }

    // Step 4: SSRF Protection - reject private/internal networks
    const hostname = normalizedHostname.toLowerCase();
    
    // Check for localhost
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      errors.push("Localhost addresses are not allowed");
      evidence.push(buildEvidence({
        proof: null,
        source: "SSRF Protection",
        description: `Rejected localhost: ${hostname}`
      }));
      return { valid: false, evidence, errors, normalizedUrl: null };
    }

    // Check for private IP ranges
    const ipMatch = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    if (ipMatch && isPrivateIP(hostname)) {
      errors.push("Private IP addresses are not allowed");
      evidence.push(buildEvidence({
        proof: null,
        source: "SSRF Protection",
        description: `Rejected private IP: ${hostname}`
      }));
      return { valid: false, evidence, errors, normalizedUrl: null };
    }

    // Check for reserved/internal domains
    const reservedPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /\.local$/,
      /\.internal$/,
      /^169\.254\./
    ];

    for (const pattern of reservedPatterns) {
      if (pattern.test(hostname)) {
        errors.push("Reserved or internal network addresses are not allowed");
        evidence.push(buildEvidence({
          proof: null,
          source: "SSRF Protection",
          description: `Rejected reserved/internal address: ${hostname}`
        }));
        return { valid: false, evidence, errors, normalizedUrl: null };
      }
    }

    evidence.push(buildEvidence({
      proof: `SSRF check passed for ${hostname}`,
      source: "SSRF Protection",
      verifiedBy: "Network Security Validator",
      description: "URL is not targeting private/internal networks"
    }));

    // Construct normalized URL
    const normalizedUrl = `${parsedUrl.protocol}//${normalizedHostname}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

    evidence.push(buildEvidence({
      proof: `Normalized URL: ${normalizedUrl}`,
      source: "URL Normalizer",
      verifiedBy: "Input Normalization Pipeline",
      description: "URL successfully normalized and validated"
    }));

    return {
      valid: true,
      evidence,
      errors: [],
      normalizedUrl,
      parsedUrl: {
        protocol: parsedUrl.protocol,
        hostname: normalizedHostname,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        hash: parsedUrl.hash
      }
    };

  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
    evidence.push(buildEvidence({
      proof: null,
      source: "URL Validator",
      description: `Unexpected validation error: ${error.message}`
    }));
    return { valid: false, evidence, errors, normalizedUrl: null };
  }
};
