import fs from 'node:fs';
import path from 'node:path';

const clientRoot = process.cwd();
const repoRoot = path.resolve(clientRoot, '..');
const sourcePath = path.resolve(repoRoot, 'blog-ready.html');
const outputPath = path.resolve(clientRoot, 'src', 'content', 'blogReady.generated.ts');

const DEFAULT_AUTHOR = {
  name: 'R. Mason / Intruvurt Labs',
  title: 'AI Visibility Research',
  expertise: ['AI Search Strategy', 'Answer Engine Optimization', 'Machine Readability'],
  credentials: ['Intruvurt Labs Editorial Team'],
  experience: '8+ years in search and AI content systems',
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);

  const mmddyyyy = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const yyyymmdd = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (yyyymmdd) return yyyymmdd[0];

  return new Date().toISOString().slice(0, 10);
}

function wordCount(text) {
  const matches = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

function paragraphSummary(content) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return paragraphs[0] || content.slice(0, 220);
}

function buildKeyPoints(content) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.length > 30 && line.split(' ').length > 7);

  const points = [];
  for (const p of paragraphs) {
    const cleaned = p.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    if (cleaned.length > 180) {
      points.push(`${cleaned.slice(0, 177).trimEnd()}...`);
    } else {
      points.push(cleaned);
    }
    if (points.length >= 5) break;
  }

  if (points.length >= 3) return points;

  return [
    'AI answer engines prioritize trust, structure, and citation readiness over legacy ranking tricks.',
    'Machine-readable formatting and entity clarity improve extraction and inclusion in generated answers.',
    'Teams that optimize for AI visibility early build compounding authority advantages over time.',
  ];
}

function deriveTags(content) {
  const text = content.toLowerCase();
  const tags = new Set(['Visibility', 'Advanced']);
  if (text.includes('seo')) tags.add('SEO');
  if (text.includes('answer engine') || text.includes('aeo')) tags.add('AEO');
  if (text.includes('schema') || text.includes('structured')) tags.add('Schema');
  if (text.includes('citation')) tags.add('Citations');
  if (text.includes('ai ') || text.includes('llm') || text.includes('agent')) tags.add('AI-Tech');
  return Array.from(tags);
}

function deriveKeywords(content, title) {
  const seed = [
    'ai visibility',
    'answer engines',
    'machine readability',
    'citation readiness',
    'search strategy',
  ];

  if (/seo/i.test(title) || /seo/i.test(content)) seed.push('seo');
  if (/saas/i.test(title) || /saas/i.test(content)) seed.push('saas');
  if (/zero-click/i.test(content)) seed.push('zero-click search');
  if (/schema/i.test(content)) seed.push('schema markup');

  return Array.from(new Set(seed));
}

function pickTitle(lines) {
  const markdownHeading = lines.find((line) => /^#{1,3}\s+/.test(line));
  if (markdownHeading) return markdownHeading.replace(/^#{1,3}\s+/, '').trim();

  const firstStrong = lines.find((line) => {
    if (!line) return false;
    if (/^here is a comprehensive guide/i.test(line)) return false;
    if (/^---+$/.test(line)) return false;
    if (/^by\s+/i.test(line)) return false;
    return line.length > 12;
  });

  return (firstStrong || lines[0] || 'Untitled').replace(/^#{1,3}\s+/, '').trim();
}

function pickBylineLine(lines) {
  return lines.find((line) => /^\*{0,2}\s*by\s+/i.test(line));
}

function sanitizeLine(line) {
  return line.replace(/^\*{1,3}|\*{1,3}$/g, '').trim();
}

if (!fs.existsSync(sourcePath)) {
  console.error(`[blog:sync] source file not found: ${sourcePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
const chunks = raw
  .split(/\n-{20,}\n+/)
  .map((chunk) => chunk.trim())
  .filter(Boolean);

const entries = [];
const skipped = [];

for (const chunk of chunks) {
  const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 4) continue;

  const title = pickTitle(lines);
  if (!title || title.length < 8) continue;

  const byline = pickBylineLine(lines) || '';
  const date = toIsoDate(byline);

  const content = lines
    .filter((line) => {
      if (sanitizeLine(line) === title) return false;
      if (byline && line === byline) return false;
      if (/^---+$/.test(line)) return false;
      return true;
    })
    .join('\n\n')
    .trim();

  if (!content) continue;

  const words = wordCount(content);

  if (words < 800) {
    skipped.push({ title, words });
    continue;
  }

  const slug = slugify(title);
  const description = paragraphSummary(content).slice(0, 220);
  const excerpt = paragraphSummary(content).slice(0, 170);
  const readMinutes = Math.max(4, Math.ceil(words / 220));

  entries.push({
    slug,
    path: `/blogs/${slug}`,
    title,
    description,
    excerpt,
    publishedAt: date,
    readMinutes,
    category: 'strategy',
    tags: deriveTags(content),
    keywords: deriveKeywords(content, title),
    author: {
      ...DEFAULT_AUTHOR,
      name: DEFAULT_AUTHOR.name,
    },
    content,
    keyPoints: buildKeyPoints(content),
    sourceMediumUrl: 'https://intruvurt.medium.com/',
    tier: 'free',
    featured: true,
  });
}

const output = `/* AUTO-GENERATED by client/scripts/sync-blog-ready.mjs. Do not edit manually. */
export const BLOG_READY_GENERATED_ENTRIES = ${JSON.stringify(entries, null, 2)};
`;

fs.writeFileSync(outputPath, output, 'utf8');

console.log(`[blog:sync] wrote ${entries.length} entries to ${path.relative(clientRoot, outputPath)}`);
if (skipped.length > 0) {
  for (const item of skipped) {
    console.warn(`[blog:sync] skipped (<800 words): ${item.title} (${item.words} words)`);
  }
}
