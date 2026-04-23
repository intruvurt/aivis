export function sanitizeInput(input: string, maxLen = 2000): string {
    return String(input || '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

export function sanitizeStrictInput(input: string, maxLen = 2000): string {
    return String(input || '')
        .slice(0, maxLen)
        .replace(/[<>'"]/g, '');
}

export function sanitizePromptInput(input: string, maxLen = 8000): string {
    return `<user_content>\n${String(input || '').slice(0, maxLen)}\n</user_content>`;
}
