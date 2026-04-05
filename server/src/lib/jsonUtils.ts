// Shared utilities for robust JSON parsing and repair.
// Originally in server.ts but extracted for reuse.

export function stripMarkdownCodeFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.replace(/^<think>[\s\S]*?<\/think>\s*/i, '');
  if (/^<think>/i.test(cleaned)) {
    const jsonStart = cleaned.search(/\{[\s\S]*"visibility_score"/);
    if (jsonStart >= 0) {
      cleaned = cleaned.substring(jsonStart);
    } else {
      return '';
    }
  }
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0 && firstBrace < 200 && /"visibility_score"|"category_grades"|"recommendations"/.test(cleaned)) {
    cleaned = cleaned.substring(firstBrace);
  }
  return cleaned.trim();
}

export function repairTruncatedJson(raw: string): any | null {
  let s = raw.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return null;

  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') inString = !inString;
  }

  if (inString) s += '"';
  s = s.replace(/,\s*"[^"]*"\s*:\s*"?[^",}\]]*$/, '');
  s = s.replace(/,\s*"[^"]*"\s*$/, '');
  s = s.replace(/,\s*$/, '');

  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets--;
  }
  s = s.replace(/,\s*$/, '');
  for (let i = 0; i < openBrackets; i++) s += ']';
  for (let i = 0; i < openBraces; i++) s += '}';
  try {
    return JSON.parse(s);
  } catch {
    const cutPoints = [
      s.lastIndexOf('",'),
      s.lastIndexOf('},'),
      s.lastIndexOf('],'),
      s.lastIndexOf('"}}'),
      s.lastIndexOf('"}'),
      s.lastIndexOf('"]'),
      s.lastIndexOf('" }'),
      s.lastIndexOf('" ]'),
      s.lastIndexOf('0,'),
      s.lastIndexOf('1,'),
      s.lastIndexOf('2,'),
      s.lastIndexOf('3,'),
      s.lastIndexOf('4,'),
      s.lastIndexOf('5,'),
      s.lastIndexOf('6,'),
      s.lastIndexOf('7,'),
      s.lastIndexOf('8,'),
      s.lastIndexOf('9,'),
    ];
    let best = -1;
    for (const cp of cutPoints) if (cp > best) best = cp;
    if (best > 0) {
      try { return JSON.parse(s.substring(0, best + 1)); } catch { /* ignore */ }
    }
    return null;
  }
}

export function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const cleaned = stripMarkdownCodeFences(raw);
    return { ok: true, value: JSON.parse(cleaned) as T };
  } catch (e: any) {
    try {
      const cleaned = stripMarkdownCodeFences(raw);
      const repaired = repairTruncatedJson(cleaned);
      if (repaired !== null) {
        console.warn('[safeJsonParse] JSON was truncated - repaired successfully');
        return { ok: true, value: repaired as T };
      }
    } catch { }
    try {
      const cleaned = stripMarkdownCodeFences(raw);
      const extracted = extractPartialAnalysis(cleaned);
      if (extracted !== null) {
        console.warn('[safeJsonParse] JSON repair failed but extracted partial analysis via regex');
        return { ok: true, value: extracted as T };
      }
    } catch { }
    return { ok: false, error: e.message || 'Invalid JSON' };
  }
}

// Minimal version of partial extraction for backwards compatibility
function extractPartialAnalysis(raw: string): any | null {
  try {
    const match = /("visibility_score"\s*:\s*\d+)/.exec(raw);
    if (match) {
      return JSON.parse("{" + match[1] + "}");
    }
  } catch { }
  return null;
}
