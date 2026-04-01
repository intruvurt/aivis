// server/src/lib/contactUtils.ts
// Helpers for extracting contact information from raw HTML

export function extractContactsFromHtml(html: string): { emails: string[]; phones: string[] } {
  const emails: Set<string> = new Set();
  const phones: Set<string> = new Set();
  if (html) {
    const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
    let match: RegExpExecArray | null;
    while ((match = emailRegex.exec(html))) {
      emails.add(match[0]);
    }
    const phoneRegex = /\+?\d[\d\-\s]{7,}\d/g;
    while ((match = phoneRegex.exec(html))) {
      phones.add(match[0]);
    }
  }
  return { emails: Array.from(emails), phones: Array.from(phones) };
}
