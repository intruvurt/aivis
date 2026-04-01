import { describe, it, expect } from 'vitest';
import { extractContactsFromHtml } from '../lib/contactUtils.js';

describe('contactUtils', () => {
  it('extracts a single email and phone from html', () => {
    const html = `Contact us at <a href="mailto:hello@example.com">hello@example.com</a><br/>Call +1 234-567-8901 for support.`;
    const { emails, phones } = extractContactsFromHtml(html);
    expect(emails).toContain('hello@example.com');
    expect(phones).toContain('+1 234-567-8901');
  });

  it('handles multiple contacts and dedupes', () => {
    const html = `team@example.com, team@example.com, <p>+44 1234 567890</p><p>+44 1234 567890</p>`;
    const { emails, phones } = extractContactsFromHtml(html);
    expect(emails.length).toBe(1);
    expect(phones.length).toBe(1);
  });

  it('returns empty arrays on empty input', () => {
    const { emails, phones } = extractContactsFromHtml('');
    expect(emails).toEqual([]);
    expect(phones).toEqual([]);
  });
});
