type CitableExtractRequest = {
  url?: string;
  brand_name?: string;
  max_queries?: number;
  max_blocks?: number;
};

type CitableBlock = {
  text: string;
  reason: string;
  source: 'body';
};

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlToText(html: string): string {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(p|section|article|div|li|h1|h2|h3)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function extractSingleTag(html: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(html);
  return cleanText(match?.[1] || '');
}

function extractMetaDescription(html: string): string {
  const match = /<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i.exec(html)
    || /<meta\s+content=["']([^"']+)["']\s+name=["']description["'][^>]*>/i.exec(html);
  return cleanText(match?.[1] || '');
}

function extractHeadings(html: string, tag: 'h1' | 'h2'): string[] {
  const out: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const value = cleanText(match[1] || '');
    if (value.length >= 6) out.push(value);
  }
  return Array.from(new Set(out));
}

function scoreParagraph(para: string, brand: string): { score: number; reason: string } {
  const lower = para.toLowerCase();
  const brandLower = brand.toLowerCase();

  const hasBrand = brandLower.length > 1 && lower.includes(brandLower);
  const hasNumericClaim = /\b\d+(?:\.\d+)?%?\b/.test(para);
  const hasCitationVerb = /(according to|source|cited|evidence|study|report|data)/i.test(para);
  const hasDefinition = /(is |means |defined as|refers to)/i.test(para);

  let score = 0;
  if (hasBrand) score += 5;
  if (hasNumericClaim) score += 3;
  if (hasCitationVerb) score += 3;
  if (hasDefinition) score += 2;
  if (para.length >= 120 && para.length <= 420) score += 2;

  const reasons: string[] = [];
  if (hasBrand) reasons.push('brand-mention');
  if (hasNumericClaim) reasons.push('numeric-claim');
  if (hasCitationVerb) reasons.push('evidence-language');
  if (hasDefinition) reasons.push('definition-signal');
  if (reasons.length === 0) reasons.push('structural-context');

  return { score, reason: reasons.join(',') };
}

function extractCitableBlocks(bodyText: string, brand: string, maxBlocks: number): CitableBlock[] {
  const rawParagraphs = bodyText
    .split(/\n{2,}/g)
    .map((p) => cleanText(p))
    .filter((p) => p.length >= 90);

  const ranked = rawParagraphs
    .map((paragraph) => {
      const { score, reason } = scoreParagraph(paragraph, brand);
      return { paragraph, score, reason };
    })
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxBlocks);

  return ranked.map((entry) => ({
    text: entry.paragraph.slice(0, 420),
    reason: entry.reason,
    source: 'body',
  }));
}

function extractTopicCandidates(title: string, h1: string, h2s: string[]): string[] {
  const merged = [title, h1, ...h2s]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .flatMap((value) => value.split(/[|:\-–,]/g).map((part) => cleanText(part)))
    .filter((value) => value.length >= 5 && value.length <= 80)
    .slice(0, 20);
  return Array.from(new Set(merged)).slice(0, 10);
}

function extractEntityCandidates(brand: string, title: string, h1: string): string[] {
  const candidates = [brand, title, h1]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .map((value) => value.split(/\s+/g).slice(0, 4).join(' '));
  return Array.from(new Set(candidates)).slice(0, 6);
}

function buildBrandQueries(params: {
  brand: string;
  title: string;
  topicCandidates: string[];
  citableBlocks: CitableBlock[];
  maxQueries: number;
}): string[] {
  const { brand, title, topicCandidates, citableBlocks, maxQueries } = params;
  const queries: string[] = [
    `${brand} review`,
    `${brand} pricing`,
    `${brand} alternatives`,
    `best ${brand} use cases`,
    `is ${brand} legit`,
  ];

  for (const topic of topicCandidates.slice(0, 8)) {
    queries.push(`${brand} for ${topic.toLowerCase()}`);
    queries.push(`best ${topic.toLowerCase()} tools like ${brand}`);
  }

  if (title) {
    queries.push(`what is ${title.toLowerCase()}`);
  }

  for (const block of citableBlocks.slice(0, 6)) {
    const fragment = block.text
      .split(/[.!?]/g)[0]
      ?.replace(/"/g, '')
      .trim()
      .slice(0, 80);
    if (fragment && fragment.length >= 28) {
      queries.push(`"${fragment}" ${brand}`);
    }
  }

  return Array.from(new Set(queries.map((q) => cleanText(q)))).slice(0, maxQueries);
}

async function handleCitableExtract(request: Request): Promise<Response> {
  let payload: CitableExtractRequest;
  try {
    payload = (await request.json()) as CitableExtractRequest;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const rawUrl = String(payload.url || '').trim();
  if (!rawUrl) {
    return Response.json({ error: 'url_required' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return Response.json({ error: 'invalid_url' }, { status: 400 });
  }

  if (!/^https?:$/.test(target.protocol)) {
    return Response.json({ error: 'invalid_protocol' }, { status: 400 });
  }
  if (isPrivateOrLocalHost(target.hostname)) {
    return Response.json({ error: 'private_or_local_host_blocked' }, { status: 400 });
  }

  const brand = cleanText(payload.brand_name || target.hostname.replace(/^www\./i, '').split('.')[0] || 'brand');
  const maxQueries = Math.min(Math.max(Number(payload.max_queries || 20) || 20, 5), 20);
  const maxBlocks = Math.min(Math.max(Number(payload.max_blocks || 12) || 12, 4), 20);

  const upstream = await fetch(target.toString(), {
    method: 'GET',
    headers: {
      'user-agent': 'AiVIS-CITE-LEDGER/1.0 (+https://aivis.biz)',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });

  if (!upstream.ok) {
    return Response.json({ error: 'upstream_fetch_failed', status: upstream.status }, { status: 502 });
  }

  const html = await upstream.text();
  const title = extractSingleTag(html, 'title');
  const metaDescription = extractMetaDescription(html);
  const h1 = extractHeadings(html, 'h1')[0] || '';
  const h2s = extractHeadings(html, 'h2');
  const bodyText = stripHtmlToText(html);
  const wordCount = bodyText.split(/\s+/g).filter(Boolean).length;

  const citableBlocks = extractCitableBlocks(bodyText, brand, maxBlocks);
  const topicCandidates = extractTopicCandidates(title, h1, h2s);
  const entityCandidates = extractEntityCandidates(brand, title, h1);
  const brandQueries = buildBrandQueries({
    brand,
    title: title || h1,
    topicCandidates,
    citableBlocks,
    maxQueries,
  });

  return Response.json({
    url: target.toString(),
    fetched_at: new Date().toISOString(),
    page_signals: {
      title,
      meta_description: metaDescription,
      h1,
      h2_count: h2s.length,
      word_count: wordCount,
    },
    citable_blocks: citableBlocks,
    topic_candidates: topicCandidates,
    entity_candidates: entityCandidates,
    brand_queries: brandQueries,
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/citable-extract') {
      return handleCitableExtract(request);
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'browser-worker' });
    }

    return Response.json({ error: 'not_found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
