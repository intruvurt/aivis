/**
 * fixValidationService.ts - Pre-PR patch validation.
 *
 * Guards every generated fix before it enters a pull request.
 * Rules:
 *   - JSON-LD schema must have @context and @type
 *   - Meta tag content must be non-empty and sane length
 *   - File paths must be relative, no traversal, safe extension
 *   - Content rewrites must preserve the original product/company name
 *   - Generated content must be non-trivially different from placeholder text
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// File extensions considered safe for automated PR commits
const SAFE_EXTENSIONS = new Set([
    '.html', '.htm', '.txt', '.xml', '.json', '.jsonld',
    '.md', '.yaml', '.yml', '.ts', '.js', '.jsx', '.tsx',
    '.css', '.svg',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(warnings: string[] = []): ValidationResult {
    return { valid: true, errors: [], warnings };
}

function fail(errors: string[], warnings: string[] = []): ValidationResult {
    return { valid: false, errors, warnings };
}

// ─── JSON-LD Schema Validator ─────────────────────────────────────────────────

/**
 * Validates a parsed JSON-LD schema object.
 * Accepts both raw objects and stringified `<script>` tag content.
 */
export function validateJsonLdSchema(content: string | object): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let parsed: unknown;

    if (typeof content === 'string') {
        // Strip `<script>` wrapper if present
        const stripped = content
            .replace(/<script[^>]*>/i, '')
            .replace(/<\/script>/i, '')
            .trim();
        try {
            parsed = JSON.parse(stripped);
        } catch {
            return fail(['Schema content is not valid JSON']);
        }
    } else {
        parsed = content;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return fail(['Schema must be a JSON object']);
    }

    const obj = parsed as Record<string, unknown>;

    // Required: @context
    if (!obj['@context']) {
        errors.push('Schema missing required @context field');
    } else if (typeof obj['@context'] !== 'string') {
        warnings.push('@context should be a string URL');
    }

    // Required: @type
    if (!obj['@type']) {
        errors.push('Schema missing required @type field');
    }

    // Cross-type validations
    const type = String(obj['@type'] || '');
    if (type === 'Organization' || type === 'LocalBusiness') {
        if (!obj['name']) errors.push('Organization schema missing name field');
        if (!obj['url']) warnings.push('Organization schema missing url field (recommended)');
    }
    if (type === 'Article' || type === 'WebPage') {
        if (!obj['name'] && !obj['headline']) warnings.push('Article/WebPage schema should have name or headline');
    }
    if (type === 'SoftwareApplication') {
        if (!obj['name']) errors.push('SoftwareApplication schema missing name field');
        if (!obj['applicationCategory']) warnings.push('SoftwareApplication should declare applicationCategory');
    }

    // Reject placeholder values
    const jsonStr = JSON.stringify(obj);
    if (jsonStr.includes('your-site.com') || jsonStr.includes('example.com')) {
        warnings.push('Schema may contain placeholder values (your-site.com / example.com)');
    }
    if (jsonStr.includes('Author Name') || jsonStr.includes('Page Title')) {
        warnings.push('Schema contains unfilled placeholder text');
    }

    return errors.length > 0 ? fail(errors, warnings) : ok(warnings);
}

// ─── Meta Tag Validator ───────────────────────────────────────────────────────

/**
 * Validates HTML meta tag content strings.
 * content is the full tag string e.g. `<meta name="description" content="..." />`
 */
export function validateMetaTag(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || !content.trim()) {
        return fail(['Meta tag content is empty']);
    }

    // Check for placeholder
    if (content.includes('Write a') || content.includes('Your Page') || content.includes('Concise page')) {
        warnings.push('Meta tag content appears to be a placeholder — fill in real content before merging');
    }

    // Meta description length
    const descMatch = content.match(/name=["']description["'][^>]*content=["']([^"']*)["']/i)
        || content.match(/content=["']([^"']*)["'][^>]*name=["']description["']/i);
    if (descMatch) {
        const desc = descMatch[1];
        if (desc.length < 50) warnings.push(`Meta description is short (${desc.length} chars). Aim for 120-160.`);
        if (desc.length > 320) errors.push(`Meta description is too long (${desc.length} chars). Max 320.`);
    }

    // Title length
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
        const title = titleMatch[1];
        if (title.length < 10) warnings.push(`Page title is very short (${title.length} chars)`);
        if (title.length > 120) errors.push(`Page title is too long (${title.length} chars). Max 120.`);
    }

    return errors.length > 0 ? fail(errors, warnings) : ok(warnings);
}

// ─── File Path Validator ──────────────────────────────────────────────────────

/**
 * Validates a repository-relative file path before committing it via API.
 * Rejects absolute paths, traversal attacks, and dangerous extensions.
 */
export function validateFilePath(filePath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!filePath || !filePath.trim()) {
        return fail(['File path is empty']);
    }

    // No absolute paths
    if (filePath.startsWith('/') || /^[A-Z]:\\/i.test(filePath)) {
        errors.push('File path must be relative to repository root');
    }

    // No traversal
    if (filePath.includes('../') || filePath.includes('..\\')) {
        errors.push('File path contains directory traversal sequence (..)');
    }

    // Null bytes
    if (filePath.includes('\0')) {
        errors.push('File path contains null byte');
    }

    // Check extension
    const ext = filePath.includes('.') ? '.' + filePath.split('.').pop()!.toLowerCase() : '';
    if (ext && !SAFE_EXTENSIONS.has(ext)) {
        warnings.push(`Extension ${ext} is unusual for auto-generated fixes — confirm this is intended`);
    }

    // No hidden system files
    const basename = filePath.split('/').pop() ?? '';
    if (basename.startsWith('.env') || basename === '.htpasswd' || basename === 'authorized_keys') {
        errors.push(`File path targets a sensitive system file: ${basename}`);
    }

    return errors.length > 0 ? fail(errors, warnings) : ok(warnings);
}

// ─── Content Rewrite Validator ────────────────────────────────────────────────

/**
 * Validates LLM-generated content rewrites.
 * Ensures the product/company name is preserved and the rewrite is not too extreme.
 */
export function validateContentRewrite(
    original: string,
    rewritten: string,
    productName: string,
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rewritten || !rewritten.trim()) {
        return fail(['Rewritten content is empty']);
    }

    // Product name preserved
    if (productName && !rewritten.toLowerCase().includes(productName.toLowerCase())) {
        errors.push(`Rewritten content does not mention the product/company name: "${productName}"`);
    }

    // Not too long (LLM hallucination guard)
    const origWords = original.split(/\s+/).length;
    const newWords = rewritten.split(/\s+/).length;
    if (newWords > origWords * 2.5) {
        warnings.push(`Rewritten content is ${Math.round(newWords / origWords * 100)}% the length of the original — review for bloat`);
    }

    // Not identical to original (no-op rewrite)
    if (original.trim() === rewritten.trim()) {
        warnings.push('Content rewrite is identical to original — no change made');
    }

    return errors.length > 0 ? fail(errors, warnings) : ok(warnings);
}

// ─── Composite Patch Validator ────────────────────────────────────────────────

export interface PatchInput {
    path: string;
    content: string;
    operation: 'create' | 'update';
    type?: 'json_ld' | 'meta_tag' | 'text' | 'html_block' | 'content_rewrite' | 'unknown';
    productName?: string;
    originalContent?: string;
}

/**
 * Run all applicable validators for a patch before it goes into a PR.
 * Returns a merged ValidationResult.
 */
export function validatePatch(patch: PatchInput): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    const merge = (r: ValidationResult) => {
        allErrors.push(...r.errors);
        allWarnings.push(...r.warnings);
    };

    // Always validate file path
    merge(validateFilePath(patch.path));

    // Validate content based on type
    if (!patch.content || !patch.content.trim()) {
        allErrors.push('Patch content is empty');
        return { valid: false, errors: allErrors, warnings: allWarnings };
    }

    if (patch.type === 'json_ld') {
        merge(validateJsonLdSchema(patch.content));
    } else if (patch.type === 'meta_tag') {
        merge(validateMetaTag(patch.content));
    } else if (patch.type === 'content_rewrite' && patch.originalContent && patch.productName) {
        merge(validateContentRewrite(patch.originalContent, patch.content, patch.productName));
    }

    // Generic non-empty check
    if (patch.content.length < 5) {
        allErrors.push('Patch content is too short to be valid');
    }

    return {
        valid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
    };
}
