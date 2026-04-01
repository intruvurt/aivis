import axios from "axios";
import robotsParser from "robots-parser";
import xml2js from "xml2js";
import { buildEvidence } from "./evidence.ts";

/**
 * Stage 2: Discovery - Fetch robots.txt and sitemap.xml
 */
export const performDiscovery = async (baseUrl) => {
  const evidence = [];
  const discoveryData = {
    robotsTxt: null,
    sitemap: null,
    urlCount: 0,
    blockedPaths: [],
    allowedPaths: []
  };

  try {
    // Fetch robots.txt
    const robotsUrl = `${baseUrl}/robots.txt`;
    try {
      const robotsResponse = await axios.get(robotsUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      if (robotsResponse.status === 200 && robotsResponse.data) {
        discoveryData.robotsTxt = robotsResponse.data;
        const robots = (robotsParser as any)(robotsUrl, robotsResponse.data);
        
        evidence.push(buildEvidence({
          proof: `robots.txt found at ${robotsUrl}`,
          source: robotsUrl,
          verifiedBy: "HTTP Fetch",
          description: `robots.txt retrieved successfully (${robotsResponse.data.length} bytes)`
        }));

        // Parse sitemap references
        const sitemapMatches = robotsResponse.data.match(/Sitemap:\s*(.+)/gi);
        if (sitemapMatches && sitemapMatches.length > 0) {
          evidence.push(buildEvidence({
            proof: `Found ${sitemapMatches.length} sitemap reference(s) in robots.txt`,
            source: robotsUrl,
            verifiedBy: "Robots.txt Parser",
            description: sitemapMatches.join(", ")
          }));
        }
      } else {
        evidence.push(buildEvidence({
          proof: null,
          source: robotsUrl,
          description: `robots.txt not found (HTTP ${robotsResponse.status})`
        }));
      }
    } catch (error) {
      evidence.push(buildEvidence({
        proof: null,
        source: robotsUrl,
        description: `Failed to fetch robots.txt: ${error.message}`
      }));
    }

    // Fetch sitemap.xml
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    try {
      const sitemapResponse = await axios.get(sitemapUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      if (sitemapResponse.status === 200 && sitemapResponse.data) {
        discoveryData.sitemap = sitemapResponse.data;
        
        // Parse XML
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(sitemapResponse.data);
        
        if (result.urlset && result.urlset.url) {
          discoveryData.urlCount = result.urlset.url.length;
          evidence.push(buildEvidence({
            proof: `sitemap.xml found with ${discoveryData.urlCount} URLs`,
            source: sitemapUrl,
            verifiedBy: "XML Parser",
            description: `Sitemap successfully parsed with ${discoveryData.urlCount} URL entries`
          }));
        } else if (result.sitemapindex && result.sitemapindex.sitemap) {
          const sitemapCount = result.sitemapindex.sitemap.length;
          evidence.push(buildEvidence({
            proof: `Sitemap index found with ${sitemapCount} sub-sitemaps`,
            source: sitemapUrl,
            verifiedBy: "XML Parser",
            description: `Sitemap index contains ${sitemapCount} sitemap references`
          }));
        }
      } else {
        evidence.push(buildEvidence({
          proof: null,
          source: sitemapUrl,
          description: `sitemap.xml not found (HTTP ${sitemapResponse.status})`
        }));
      }
    } catch (error) {
      evidence.push(buildEvidence({
        proof: null,
        source: sitemapUrl,
        description: `Failed to fetch sitemap.xml: ${error.message}`
      }));
    }

  } catch (error) {
    evidence.push(buildEvidence({
      proof: null,
      source: "Discovery Stage",
      description: `Discovery stage error: ${error.message}`
    }));
  }

  return { evidence, discoveryData };
};

/**
 * Stage 3: Crawl - Fetch homepage and key pages
 */
export const performCrawl = async (url) => {
  const evidence = [];
  const crawlData: {
    statusCode: number | null;
    headers: Record<string, any>;
    redirectChain: Array<{ count: number; finalUrl: string }>;
    timingMetrics: Record<string, number>;
    content: any;
    error: string | null;
  } = {
    statusCode: null,
    headers: {},
    redirectChain: [],
    timingMetrics: {},
    content: null,
    error: null
  };

  const startTime = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true, // Accept all status codes
      headers: {
        "User-Agent": "AI-VisibilityPro-Bot/1.0 (Forensic Web Analyzer)"
      }
    });

    const endTime = Date.now();
    crawlData.timingMetrics.totalTime = endTime - startTime;
    crawlData.statusCode = response.status;
    crawlData.headers = response.headers;
    crawlData.content = response.data;

    evidence.push(buildEvidence({
      proof: `HTTP ${response.status} received in ${crawlData.timingMetrics.totalTime}ms`,
      source: url,
      verifiedBy: "HTTP Client",
      description: `Page fetched successfully with status ${response.status}`
    }));

    // Check for redirects
    if (response.request._redirectable && response.request._redirectable._redirectCount > 0) {
      crawlData.redirectChain.push({
        count: response.request._redirectable._redirectCount,
        finalUrl: response.request.res.responseUrl
      });
      
      evidence.push(buildEvidence({
        proof: `${response.request._redirectable._redirectCount} redirect(s) detected`,
        source: url,
        verifiedBy: "HTTP Client",
        description: `Final URL: ${response.request.res.responseUrl}`
      }));
    }

    // Record key headers
    const importantHeaders = ["content-type", "content-encoding", "cache-control", "x-robots-tag"];
    importantHeaders.forEach(header => {
      if (response.headers[header]) {
        evidence.push(buildEvidence({
          proof: `${header}: ${response.headers[header]}`,
          source: url,
          verifiedBy: "HTTP Headers",
          description: `Header ${header} present`
        }));
      }
    });

  } catch (error) {
    crawlData.error = error.message;
    
    if (error.code === "ECONNABORTED") {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "Request timeout after 15 seconds"
      }));
    } else if (error.code === "ENOTFOUND") {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: "Domain not found (DNS resolution failed)"
      }));
    } else {
      evidence.push(buildEvidence({
        proof: null,
        source: url,
        description: `Crawl failed: ${error.message}`
      }));
    }
  }

  return { evidence, crawlData };
};
