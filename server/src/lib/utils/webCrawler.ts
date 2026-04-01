import axios from 'axios';
// xml2js ships without bundled types; declare shape we actually use
import * as xml2js from 'xml2js';
import * as robotsParserMod from 'robots-parser';
import { buildEvidence } from './evidenceUtils.js';

const robotsParserFn = (robotsParserMod as any).default ?? (robotsParserMod as any);

type EvidenceItem = ReturnType<typeof buildEvidence>;

type DiscoveryData = {
  robotsTxt: string | null;
  sitemap: string | null;
  urlCount: number;
  blockedPaths: string[];
  allowedPaths: string[];
};

type CrawlData = {
  statusCode: number | null;
  headers: Record<string, any>;
  redirectChain: Array<{ count: number; finalUrl: string }>;
  timingMetrics: { totalTime: number };
  content: any;
  error: string | null;
};

/**
 * Stage 2: Discovery - Fetch robots.txt and sitemap.xml
 */
export const performDiscovery = async (baseUrl: string) => {
  const evidence: EvidenceItem[] = [];
  const discoveryData: DiscoveryData = {
    robotsTxt: null,
    sitemap: null,
    urlCount: 0,
    blockedPaths: [],
    allowedPaths: [],
  };

  try {
    const robotsUrl = `${baseUrl.replace(/\/+$/, '')}/robots.txt`;

    try {
      const robotsResponse = await axios.get(robotsUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });

      if (robotsResponse.status === 200 && robotsResponse.data) {
        discoveryData.robotsTxt = String(robotsResponse.data);

        const robots = robotsParserFn(robotsUrl, discoveryData.robotsTxt);

        evidence.push(
          buildEvidence({
            proof: `robots.txt found at ${robotsUrl}`,
            source: robotsUrl,
            verifiedBy: 'HTTP Fetch',
            description: `robots.txt retrieved successfully (${discoveryData.robotsTxt.length} bytes)`,
          })
        );

        // basic allow/disallow extraction (best-effort)
        const lines = discoveryData.robotsTxt.split('\n').map((l) => l.trim());
        for (const line of lines) {
          if (/^disallow:/i.test(line)) {
            const p = line.split(':').slice(1).join(':').trim();
            if (p) discoveryData.blockedPaths.push(p);
          }
          if (/^allow:/i.test(line)) {
            const p = line.split(':').slice(1).join(':').trim();
            if (p) discoveryData.allowedPaths.push(p);
          }
        }

        // Parse sitemap references
        const sitemapMatches = discoveryData.robotsTxt.match(/Sitemap:\s*(.+)/gi);
        if (sitemapMatches && sitemapMatches.length > 0) {
          evidence.push(
            buildEvidence({
              proof: `Found ${sitemapMatches.length} sitemap reference(s) in robots.txt`,
              source: robotsUrl,
              verifiedBy: 'Robots.txt Parser',
              description: sitemapMatches.join(', '),
            })
          );
        }

        // note: `robots` is available if you want to check isAllowed(url, ua) later
        void robots;
      } else {
        evidence.push(
          buildEvidence({
            proof: null,
            source: robotsUrl,
            description: `robots.txt not found (HTTP ${robotsResponse.status})`,
          })
        );
      }
    } catch (error: any) {
      evidence.push(
        buildEvidence({
          proof: null,
          source: robotsUrl,
          description: `Failed to fetch robots.txt: ${error?.message ?? String(error)}`,
        })
      );
    }

    const sitemapUrl = `${baseUrl.replace(/\/+$/, '')}/sitemap.xml`;
    try {
      const sitemapResponse = await axios.get(sitemapUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });

      if (sitemapResponse.status === 200 && sitemapResponse.data) {
        discoveryData.sitemap = String(sitemapResponse.data);

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(discoveryData.sitemap);

        if (result?.urlset?.url) {
          discoveryData.urlCount = Array.isArray(result.urlset.url) ? result.urlset.url.length : 0;

          evidence.push(
            buildEvidence({
              proof: `sitemap.xml found with ${discoveryData.urlCount} URLs`,
              source: sitemapUrl,
              verifiedBy: 'XML Parser',
              description: `Sitemap successfully parsed with ${discoveryData.urlCount} URL entries`,
            })
          );
        } else if (result?.sitemapindex?.sitemap) {
          const sitemapCount = Array.isArray(result.sitemapindex.sitemap)
            ? result.sitemapindex.sitemap.length
            : 0;

          evidence.push(
            buildEvidence({
              proof: `Sitemap index found with ${sitemapCount} sub-sitemaps`,
              source: sitemapUrl,
              verifiedBy: 'XML Parser',
              description: `Sitemap index contains ${sitemapCount} sitemap references`,
            })
          );
        }
      } else {
        evidence.push(
          buildEvidence({
            proof: null,
            source: sitemapUrl,
            description: `sitemap.xml not found (HTTP ${sitemapResponse.status})`,
          })
        );
      }
    } catch (error: any) {
      evidence.push(
        buildEvidence({
          proof: null,
          source: sitemapUrl,
          description: `Failed to fetch sitemap.xml: ${error?.message ?? String(error)}`,
        })
      );
    }
  } catch (error: any) {
    evidence.push(
      buildEvidence({
        proof: null,
        source: 'Discovery Stage',
        description: `Discovery stage error: ${error?.message ?? String(error)}`,
      })
    );
  }

  return { evidence, discoveryData };
};

/**
 * Stage 3: Crawl - Fetch homepage and key pages
 */
export const performCrawl = async (url: string) => {
  const evidence: EvidenceItem[] = [];
  const crawlData: CrawlData = {
    statusCode: null,
    headers: {},
    redirectChain: [],
    timingMetrics: { totalTime: 0 },
    content: null,
    error: null,
  };

  const startTime = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'AI-VisibilityPro-Bot/1.0 (Forensic Web Analyzer)',
      },
    });

    const endTime = Date.now();
    crawlData.timingMetrics.totalTime = endTime - startTime;
    crawlData.statusCode = response.status;
    crawlData.headers = response.headers;
    crawlData.content = response.data;

    evidence.push(
      buildEvidence({
        proof: `HTTP ${response.status} received in ${crawlData.timingMetrics.totalTime}ms`,
        source: url,
        verifiedBy: 'HTTP Client',
        description: `Page fetched successfully with status ${response.status}`,
      })
    );

    const redirectable = (response as any)?.request?._redirectable;
    const redirectCount = redirectable?._redirectCount ?? 0;

    if (redirectCount > 0) {
      const finalUrl = (response as any)?.request?.res?.responseUrl;

      crawlData.redirectChain.push({
        count: redirectCount,
        finalUrl: finalUrl || url,
      });

      evidence.push(
        buildEvidence({
          proof: `${redirectCount} redirect(s) detected`,
          source: url,
          verifiedBy: 'HTTP Client',
          description: `Final URL: ${finalUrl || url}`,
        })
      );
    }

    const importantHeaders = ['content-type', 'content-encoding', 'cache-control', 'x-robots-tag'];
    for (const header of importantHeaders) {
      if (response.headers?.[header]) {
        evidence.push(
          buildEvidence({
            proof: `${header}: ${response.headers[header]}`,
            source: url,
            verifiedBy: 'HTTP Headers',
            description: `Header ${header} present`,
          })
        );
      }
    }
  } catch (error: any) {
    crawlData.error = error?.message ?? String(error);

    if (error?.code === 'ECONNABORTED') {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'Request timeout after 15 seconds',
        })
      );
    } else if (error?.code === 'ENOTFOUND') {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: 'Domain not found (DNS resolution failed)',
        })
      );
    } else {
      evidence.push(
        buildEvidence({
          proof: null,
          source: url,
          description: `Crawl failed: ${crawlData.error}`,
        })
      );
    }
  }

  return { evidence, crawlData };
};
