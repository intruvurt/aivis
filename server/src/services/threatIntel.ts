type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

type GoogleThreatMatch = {
  threatType?: string;
  platformType?: string;
  threatEntryType?: string;
  threat?: { url?: string };
};

export interface UrlRiskAssessment {
  normalized_url: string;
  hostname: string;
  risk_level: RiskLevel;
  risk_score: number;
  flags: string[];
  providers: {
    urlhaus?: {
      listed: boolean;
      status?: string;
      tags?: string[];
      threat?: string;
      source?: string;
      confidence?: string;
      error?: string;
    };
    google_safe_browsing?: {
      listed: boolean;
      matches?: GoogleThreatMatch[];
      error?: string;
      skipped?: string;
    };
  };
}

function hostnameLooksSuspicious(hostname: string): string[] {
  const flags: string[] = [];
  const host = hostname.toLowerCase();

  if (host.includes('xn--')) {
    flags.push('Punycode domain detected (possible homograph attack risk)');
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    flags.push('Direct IPv4 host used instead of domain');
  }

  const riskyTlds = ['zip', 'mov', 'xyz', 'top', 'click', 'cam', 'rest', 'gq', 'tk'];
  const tld = host.split('.').pop() || '';
  if (riskyTlds.includes(tld)) {
    flags.push(`Higher-risk TLD detected: .${tld}`);
  }

  return flags;
}

async function checkUrlhaus(url: string): Promise<UrlRiskAssessment['providers']['urlhaus']> {
  try {
    const body = new URLSearchParams({ url });
    const response = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      return {
        listed: false,
        error: `URLhaus HTTP ${response.status}`,
      };
    }

    const json = (await response.json()) as any;
    const listed = json?.query_status === 'ok' && !!json?.url;

    return {
      listed,
      status: json?.url_status,
      tags: Array.isArray(json?.tags) ? json.tags : [],
      threat: typeof json?.threat === 'string' ? json.threat : undefined,
      source: 'URLhaus',
      confidence: listed ? 'high' : 'none',
    };
  } catch (error: any) {
    return {
      listed: false,
      error: error?.message || 'URLhaus lookup failed',
    };
  }
}

async function checkGoogleSafeBrowsing(url: string): Promise<UrlRiskAssessment['providers']['google_safe_browsing']> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY || '';
  if (!apiKey) {
    return {
      listed: false,
      skipped: 'GOOGLE_SAFE_BROWSING_API_KEY not configured',
    };
  }

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client: {
            clientId: 'aivis',
            clientVersion: '1.0.0',
          },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );

    if (!response.ok) {
      return {
        listed: false,
        error: `Google Safe Browsing HTTP ${response.status}`,
      };
    }

    const json = (await response.json()) as any;
    const matches = Array.isArray(json?.matches) ? (json.matches as GoogleThreatMatch[]) : [];

    return {
      listed: matches.length > 0,
      matches,
    };
  } catch (error: any) {
    return {
      listed: false,
      error: error?.message || 'Google Safe Browsing lookup failed',
    };
  }
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export async function assessUrlRisk(normalizedUrl: string): Promise<UrlRiskAssessment> {
  const parsed = new URL(normalizedUrl);
  const flags = hostnameLooksSuspicious(parsed.hostname);

  const [urlhaus, gsb] = await Promise.all([
    checkUrlhaus(normalizedUrl),
    checkGoogleSafeBrowsing(normalizedUrl),
  ]);

  let score = 0;

  if (urlhaus?.listed) {
    score += 80;
    flags.push('Listed on URLhaus threat feed');
  }

  if (gsb?.listed) {
    score += 90;
    flags.push('Matched Google Safe Browsing threat list');
  }

  if (!urlhaus?.listed && !gsb?.listed && flags.length > 0) {
    score += 25;
  }

  score = Math.min(100, score);

  return {
    normalized_url: normalizedUrl,
    hostname: parsed.hostname,
    risk_level: toRiskLevel(score),
    risk_score: score,
    flags,
    providers: {
      urlhaus,
      google_safe_browsing: gsb,
    },
  };
}
