/**
 * Trust Layer Engine
 * 
 * Analyzes whether AI systems should surface this site as trusted
 * Checks: HTTPS, domain age, TLS, contact info, privacy policy, risk signals
 */

import * as cheerio from 'cheerio';
import { parse } from 'url';
import type { TrustLayerOutput } from '../../../../shared/types.js';

interface TrustEngineInput {
  html: string;
  domain: string;
  target_url: string;
  https_enabled?: boolean;
  domain_age_years?: number;
  tls_certificate_trusted?: boolean;
}

/**
 * Extract contact information
 */
function extractContactInfo(html: string): {
  emails: string[];
  phones: string[];
  addresses: string[];
} {
  const emails = new Set<string>();
  const phones = new Set<string>();
  const addresses = new Set<string>();

  // Email regex
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  const emailMatches = html.match(emailRegex) || [];
  emailMatches.forEach((email) => {
    if (!email.includes('@example') && !email.includes('@test')) {
      emails.add(email.toLowerCase());
    }
  });

  // Phone regex (simplified)
  const phoneRegex = /\b(?:\+1|1)?[\s.-]?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/g;
  const phoneMatches = html.match(phoneRegex) || [];
  phoneMatches.forEach((phone) => phones.add(phone));

  // Address (simple heuristic)
  const addressRegex = /(\d+\s+[A-Z][a-z]+(?:\s+(?:St|Ave|Blvd|Rd|Ln|Way|Dr|Ct|Pl|Terr|Mt|Sq|Tr|Cr|Cir)\.?)+[,\s]+(?:[A-Z]{2}|[A-Z][a-z\s]+),?\s+\d{5}(?:-\d{4})?)/g;
  const addressMatches = html.match(addressRegex) || [];
  addressMatches.forEach((addr) => addresses.add(addr));

  return {
    emails: Array.from(emails),
    phones: Array.from(phones),
    addresses: Array.from(addresses),
  };
}

/**
 * Check for trust signals in HTML
 */
function extractTrustSignals(html: string): {
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  hasSSL: boolean;
  externalTrustSignals: string[];
} {
  const $ = cheerio.load(html);

  // Look for common trust links
  const text = html.toLowerCase();
  const hasPrivacy = /privacy\s+policy|privacy|data\s+protection/i.test(text);
  const hasTerms = /terms\s+of\s+service|terms\s+&\s+conditions|legal|terms/i.test(text);

  // Look for trust badges
  const trustedSites: Record<string, boolean> = {
    google_reviews: /google\s+reviews|trusted\s+business|safe\s+browsing|verified\s+by\s+google/i.test(
      text
    ),
    verified_site: /verified\s+site|badge|certification|certified/i.test(text),
    https_only: /secure|ssl|encrypted|https/i.test(text),
  };

  const signals = Object.entries(trustedSites)
    .filter(([_, has]) => has)
    .map(([key]) => key);

  return {
    hasPrivacyPolicy: hasPrivacy,
    hasTermsOfService: hasTerms,
    hasSSL: /ssl|https|secure/i.test(text),
    externalTrustSignals: signals,
  };
}

/**
 * Calculate trust score
 */
function calculateTrustScore(
  https: boolean,
  domainAge: number,
  tlsTrusted: boolean,
  contactInfo: any,
  trustSignals: any
): number {
  let score = 60; // Base score

  // HTTPS check
  if (https) score += 20;
  else score -= 10;

  // Domain age check
  if (domainAge >= 2) score += 10;
  else if (domainAge >= 1) score += 5;
  else score -= 5;

  // TLS certificate
  if (tlsTrusted) score += 15;
  else score -= 5;

  // Contact info
  if (contactInfo.emails.length > 0) score += 8;
  if (contactInfo.addresses.length > 0) score += 7;
  if (contactInfo.phones.length > 0) score += 5;

  // Trust signals
  if (trustSignals.hasPrivacyPolicy) score += 8;
  if (trustSignals.hasTermsOfService) score += 7;
  if (trustSignals.externalTrustSignals.length > 0) score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Extract entity consistency signals
 */
function analyzeEntityConsistency(
  html: string,
  domain: string
): {
  nameVariance: number;
  locationMatches: boolean;
  businessCategoryConsistent: boolean;
  contactTrustworthy: boolean;
} {
  // Extract business name mentions
  const $ = cheerio.load(html);
  const titleText = $('title').text();
  const h1Text = $('h1').first().text();
  const ogSite = $('meta[property="og:site_name"]').attr('content') || '';

  // Simple variance check: if title, h1, and og:site_name are similar
  const names = [titleText, h1Text, ogSite].filter((n) => n && n.length > 0);
  const variance = names.length > 1 ? 0.1 : 0;

  // Check if domain is mentioned in content (indicates self-awareness)
  const domainInContent = html.toLowerCase().includes(domain.toLowerCase());

  return {
    nameVariance: variance,
    locationMatches: domainInContent,
    businessCategoryConsistent: true, // Simplified
    contactTrustworthy: domain.length > 5, // Heuristic
  };
}

/**
 * Generate trust tier classification
 */
function classifyTrustTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * Main Trust Layer Engine
 */
export async function runTrustLayerEngine(input: TrustEngineInput): Promise<TrustLayerOutput> {
  const startTime = Date.now();

  try {
    // Extract signals
    const contactInfo = extractContactInfo(input.html);
    const trustSignals = extractTrustSignals(input.html);
    const entityConsistency = analyzeEntityConsistency(input.html, input.domain);

    // Defaults if not provided
    const httpsEnabled = input.https_enabled !== false;
    const domainAgeYears = input.domain_age_years ?? 2;
    const tlsCertTrusted = input.tls_certificate_trusted !== false;

    // Calculate score
    const trustScore = calculateTrustScore(httpsEnabled, domainAgeYears, tlsCertTrusted, contactInfo, trustSignals);

    // Risk flags
    const riskFlags: string[] = [];
    if (!httpsEnabled) riskFlags.push('Site is not HTTPS (security risk)');
    if (domainAgeYears < 1) riskFlags.push('Domain is less than 1 year old');
    if (contactInfo.emails.length === 0) riskFlags.push('No email contact found');
    if (!trustSignals.hasPrivacyPolicy) riskFlags.push('Missing privacy policy');
    if (entityConsistency.nameVariance > 0.2) riskFlags.push('Brand name is inconsistent');

    // Recommendations
    const recommendations: string[] = [];
    if (trustScore < 60) {
      recommendations.push('Add HTTPS if not already enabled');
      recommendations.push('Display privacy policy and contact information');
      recommendations.push('Consider trust badges or certifications');
    }
    if (contactInfo.emails.length === 0) {
      recommendations.push('Add a clear email contact on your main page');
    }

    return {
      status: 'success',
      timeMs: Date.now() - startTime,
      data: {
        trust_score: trustScore,
        signal_status: {
          https_enabled: httpsEnabled,
          domain_age_years: domainAgeYears,
          tls_certificate_trusted: tlsCertTrusted,
          contact_info_present: contactInfo.emails.length > 0 || contactInfo.phones.length > 0,
          privacy_policy_accessible: trustSignals.hasPrivacyPolicy,
          external_trust_signals: trustSignals.externalTrustSignals,
        },
        entity_consistency: {
          name_variance: entityConsistency.nameVariance,
          location_matches: entityConsistency.locationMatches,
          business_category_consistent: entityConsistency.businessCategoryConsistent,
          contact_info_trustworthy: entityConsistency.contactTrustworthy,
        },
        risk_flags: riskFlags,
        recommendations,
      },
    };
  } catch (error) {
    return {
      status: 'failed',
      timeMs: Date.now() - startTime,
      errors: [String(error)],
      data: {
        trust_score: 0,
        signal_status: {
          https_enabled: false,
          domain_age_years: 0,
          tls_certificate_trusted: false,
          contact_info_present: false,
          privacy_policy_accessible: false,
          external_trust_signals: [],
        },
        entity_consistency: {
          name_variance: 1,
          location_matches: false,
          business_category_consistent: false,
          contact_info_trustworthy: false,
        },
        risk_flags: ['Engine error: ' + String(error)],
        recommendations: [],
      },
    };
  }
}
