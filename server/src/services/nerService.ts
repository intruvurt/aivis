/**
 * nerService.ts
 *
 * Pure TypeScript rule-based Named Entity Recognition (NER) for AI-response text.
 * Zero API cost, zero external dependencies.
 *
 * Approach:
 *  1. TitleCase sequence extraction (1–4 consecutive capitalised words)
 *  2. CamelCase single-token extraction (tech brand/product names e.g. "OpenAI")
 *  3. Suffix-based ORG classification
 *  4. Known LOCATION list matching
 *  5. Honorific-based PERSON detection
 *  6. Target-brand tagging via domain/name matching
 */

export type NEREntityType = 'ORG' | 'PRODUCT' | 'PERSON' | 'LOCATION' | 'BRAND';

export interface NEREntity {
    text: string;
    type: NEREntityType;
    count: number; // total occurrences summed across all processed texts
    result_count: number; // distinct result texts that contained this entity
    is_target_brand: boolean;
}

// ── Classification tables ────────────────────────────────────────────────────

/** Words that end an entity phrase and indicate ORG type. */
const ORG_SUFFIXES = new Set([
    'ai', 'inc', 'incorporated', 'llc', 'ltd', 'limited', 'corp', 'corporation',
    'co', 'company', 'technologies', 'technology', 'tech', 'software', 'systems',
    'solutions', 'group', 'labs', 'lab', 'studio', 'studios', 'media', 'capital',
    'ventures', 'partners', 'consulting', 'services', 'platform', 'platforms',
    'network', 'networks', 'digital', 'global', 'international', 'enterprises',
    'enterprise', 'agency', 'analytics', 'intelligence', 'intelligence',
    'research', 'cloud', 'io', 'dev', 'hub', 'hq',
]);

/** Honorifics or role titles that directly precede a person's name. */
const PERSON_TITLES = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'professor', 'sir', 'ceo', 'cto', 'coo',
    'cfo', 'founder', 'co-founder', 'director', 'president', 'vp', 'head',
    'author', 'researcher', 'engineer',
]);

/** Capitalised terms to skip even if they look like entities. */
const STOP_ENTITIES = new Set([
    'The', 'A', 'An', 'And', 'Or', 'But', 'For', 'Nor', 'So', 'Yet',
    'In', 'On', 'At', 'To', 'Of', 'By', 'With', 'About', 'As', 'Into',
    'Through', 'During', 'From', 'Up', 'Down',
    'Is', 'Are', 'Was', 'Were', 'Be', 'Has', 'Have', 'Had',
    'Will', 'Would', 'Could', 'Should', 'May', 'Might', 'Can', 'Do', 'Does',
    'This', 'That', 'These', 'Those', 'It', 'Its',
    'You', 'Your', 'We', 'Our', 'They', 'Their', 'He', 'His', 'She', 'Her',
    'Here', 'There', 'Where', 'When', 'How', 'Why', 'What', 'Which',
    'According', 'Also', 'Additionally', 'However', 'Therefore', 'Furthermore',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
    'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'First', 'Second', 'Third', 'Last', 'Next', 'New', 'Old', 'Best', 'Top',
    'Web', 'Site', 'Page', 'Data', 'User', 'Team', 'Year', 'Time', 'More',
    'Many', 'Most', 'Some', 'Each', 'All',
]);

/** Minimum length for a potentially interesting entity (chars). */
const MIN_ENTITY_LEN = 3;

/**
 * Known location strings for fast exact matching.
 * Ordered longest-first so multi-word locations match before their sub-parts.
 */
const LOCATION_NAMES: string[] = [
    'United States of America', 'United States', 'United Kingdom', 'United Arab Emirates',
    'South Korea', 'New Zealand', 'Saudi Arabia', 'South Africa',
    'Hong Kong', 'New York', 'San Francisco', 'Los Angeles', 'Las Vegas',
    'San Jose', 'San Diego', 'New Orleans', 'Washington DC', 'Washington D.C.',
    'Silicon Valley',
    'China', 'India', 'Germany', 'France', 'Japan', 'Canada', 'Australia',
    'Brazil', 'Mexico', 'Russia', 'Italy', 'Spain', 'Netherlands', 'Sweden',
    'Singapore', 'Israel', 'Taiwan', 'Switzerland', 'Norway', 'Denmark', 'Finland',
    'Belgium', 'Austria', 'Portugal', 'Poland', 'Ukraine', 'Argentina', 'Chile',
    'London', 'Berlin', 'Paris', 'Tokyo', 'Beijing', 'Shanghai', 'Sydney',
    'Toronto', 'Austin', 'Seattle', 'Boston', 'Chicago', 'Miami', 'Denver',
    'Amsterdam', 'Dublin', 'Stockholm', 'Zurich', 'Munich', 'Madrid', 'Barcelona',
    'Rome', 'Milan', 'Seoul', 'Bangkok', 'Jakarta', 'Mumbai', 'Bangalore',
    'Europe', 'Asia', 'Africa', 'Americas', 'Pacific', 'Antarctic',
    'US', 'UK', 'EU', 'UAE', 'USA', 'NYC',
];
const LOCATION_SET = new Set(LOCATION_NAMES);

// ── Core extraction ──────────────────────────────────────────────────────────

/**
 * Extract named entities from a single text block.
 * Returns each unique entity with its occurrence count within that text.
 */
export function extractEntitiesFromText(
    text: string,
    targetBrand: string,
    targetDomain: string,
): NEREntity[] {
    const found = new Map<string, { type: NEREntityType; count: number; is_target_brand: boolean }>();

    const brandLower = targetBrand.toLowerCase().trim();
    const domainLower = targetDomain.toLowerCase().replace(/^www\./, '').replace(/\.[^.]+$/, '');

    function isTargetBrand(entityText: string): boolean {
        const et = entityText.toLowerCase();
        return (
            et === brandLower ||
            et.includes(brandLower) ||
            brandLower.includes(et) ||
            et === domainLower ||
            et.includes(domainLower)
        );
    }

    function upsert(entityText: string, type: NEREntityType): void {
        const key = entityText.trim();
        if (key.length < MIN_ENTITY_LEN) return;
        if (STOP_ENTITIES.has(key)) return;

        const existing = found.get(key);
        if (existing) {
            existing.count++;
        } else {
            found.set(key, { type, count: 1, is_target_brand: isTargetBrand(key) });
        }
    }

    // ── Step 1: Location list matching (highest priority, multi-word first) ──
    for (const loc of LOCATION_NAMES) {
        // Count occurrences
        let idx = 0;
        let cnt = 0;
        while ((idx = text.indexOf(loc, idx)) !== -1) {
            // Check it's a word boundary (not mid-word)
            const before = idx > 0 ? text[idx - 1] : ' ';
            const after = idx + loc.length < text.length ? text[idx + loc.length] : ' ';
            if (!/\w/.test(before) && !/\w/.test(after)) cnt++;
            idx += loc.length;
        }
        if (cnt > 0) {
            const key = loc;
            const existing = found.get(key);
            if (existing) existing.count += cnt;
            else found.set(key, { type: 'LOCATION', count: cnt, is_target_brand: false });
        }
    }

    // ── Step 2: CamelCase single-token extraction (e.g. OpenAI, ChatGPT) ──
    const camelRegex = /\b([A-Z][a-z]{1,15}[A-Z][a-zA-Z0-9]{1,20})\b/g;
    let m: RegExpExecArray | null;
    while ((m = camelRegex.exec(text)) !== null) {
        const tok = m[1];
        if (STOP_ENTITIES.has(tok)) continue;
        if (tok.length < MIN_ENTITY_LEN) continue;
        // Don't override a LOCATION
        if (found.has(tok) && found.get(tok)!.type === 'LOCATION') continue;
        // Classify as ORG if ends in known suffix, else PRODUCT/BRAND
        const lower = tok.toLowerCase();
        const type: NEREntityType = ORG_SUFFIXES.has(lower) ? 'ORG' : (isTargetBrand(tok) ? 'BRAND' : 'PRODUCT');
        upsert(tok, type);
    }

    // ── Step 3: TitleCase sequences (1–4 words) ──
    // Capture runs of Title-cased words: e.g. "Google Search", "Stripe Inc"
    const titleSeqRegex = /\b((?:[A-Z][a-zA-Z0-9\-]*(?:\s+[A-Z][a-zA-Z0-9\-]*){0,3}))\b/g;
    while ((m = titleSeqRegex.exec(text)) !== null) {
        const phrase = m[1].trim();
        const words = phrase.split(/\s+/);

        // Skip single short stop words
        if (words.length === 1 && STOP_ENTITIES.has(phrase)) continue;
        if (phrase.length < MIN_ENTITY_LEN) continue;

        // Skip if already classified as LOCATION
        if (found.has(phrase) && found.get(phrase)!.type === 'LOCATION') continue;

        // Determine type
        const lastWord = words[words.length - 1].toLowerCase().replace(/[.,;:!?]$/, '');
        let type: NEREntityType;

        if (LOCATION_SET.has(phrase)) {
            type = 'LOCATION';
        } else if (ORG_SUFFIXES.has(lastWord)) {
            type = 'ORG';
        } else if (isTargetBrand(phrase)) {
            type = 'BRAND';
        } else if (words.length === 1) {
            type = 'PRODUCT'; // single capitalised word not stopped → likely product/brand
        } else {
            type = 'ORG'; // multi-word TitleCase sequences default to ORG
        }

        upsert(phrase, type);
    }

    // ── Step 4: Honorific-based PERSON detection ──
    // "Dr. Jane Smith", "CEO Elon Musk", etc.
    const honorificRegex = /\b((?:mr|mrs|ms|dr|prof|professor|sir|ceo|cto|coo|cfo|founder)\.?\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/gi;
    while ((m = honorificRegex.exec(text)) !== null) {
        const name = m[2].trim();
        if (name.length >= MIN_ENTITY_LEN) {
            const existing = found.get(name);
            if (existing) {
                existing.type = 'PERSON';
                existing.count++;
            } else {
                found.set(name, { type: 'PERSON', count: 1, is_target_brand: false });
            }
        }
    }

    // Build result array
    const entities: NEREntity[] = [];
    for (const [text_key, val] of found.entries()) {
        entities.push({
            text: text_key,
            type: val.type,
            count: val.count,
            result_count: 1,
            is_target_brand: val.is_target_brand,
        });
    }
    return entities;
}

/**
 * Aggregate NER results from multiple texts into a single deduplicated list.
 * Entities are sorted by total count descending.
 */
export function aggregateEntities(
    perTextResults: NEREntity[][],
): NEREntity[] {
    const agg = new Map<string, NEREntity>();

    for (const entities of perTextResults) {
        for (const entity of entities) {
            const key = entity.text;
            const existing = agg.get(key);
            if (existing) {
                existing.count += entity.count;
                existing.result_count += 1;
            } else {
                agg.set(key, { ...entity });
            }
        }
    }

    return Array.from(agg.values()).sort((a, b) => b.count - a.count);
}

/**
 * Filter aggregated entities to remove noise:
 * - Remove entities that only appear in 1 result and have count=1 (unique singletons)
 *   unless they are the target brand.
 * - Collapse sub-string duplicates: e.g. "Google" is kept when "Google Search" exists,
 *   but "Search" (ambiguous) is dropped.
 */
export function filterEntities(entities: NEREntity[], minResults = 1): NEREntity[] {
    const texts = new Set(entities.map((e) => e.text));

    return entities.filter((e) => {
        // Always keep the target brand entity
        if (e.is_target_brand) return true;
        // Respect min_results threshold
        if (e.result_count < minResults) return false;
        // Reject single-word all-caps stop words that slipped through (e.g. "AI" alone in short text)
        if (e.text.length <= 2 && !e.is_target_brand) return false;
        // Remove if it's a substring of a longer known entity (prefer the longer form)
        for (const other of texts) {
            if (other !== e.text && other.includes(e.text) && other.length > e.text.length + 2) {
                return false;
            }
        }
        return true;
    });
}
