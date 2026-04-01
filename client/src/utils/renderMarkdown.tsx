// client/src/utils/renderMarkdown.tsx
// Lightweight markdown-lite renderer: **bold**, [links](url), bullet lists
import React from 'react';
import { toSafeHref } from './safeHref';

/** Parse markdown-style links inside a text fragment. */
function processLinks(text: string, keyPrefix: string): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const href = match[2];
    const safeHref = toSafeHref(href);

    if (!safeHref) {
      parts.push(match[1]);
      lastIndex = match.index + match[0].length;
      continue;
    }

    const isInternal = safeHref.startsWith('/') || safeHref.startsWith('#');
    parts.push(
      <a
        key={`${keyPrefix}-link-${match.index}`}
        href={safeHref}
        className="text-white/85 hover:text-white underline underline-offset-2 transition-colors"
        {...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

/** Render a string that may contain **bold**, [links](url), and bullet lines. */
export default function renderMarkdown(text: string): React.ReactNode {
  const normalized = (text || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    // Strip code fences (```lang ... ```) — flatten to plain text
    .replace(/```[\s\S]*?```/g, (match) => {
      const inner = match.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '');
      return inner;
    })
    // Strip inline backtick code (`text`) — keep inner text
    .replace(/`([^`]+)`/g, '$1');

  const lines = normalized.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    // Bold **text**
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const processed = line;

    while ((match = boldRegex.exec(processed)) !== null) {
      if (match.index > lastIndex) {
        parts.push(processLinks(processed.slice(lastIndex, match.index), `${i}-pre-${lastIndex}`));
      }
      parts.push(
        <strong key={`${i}-b-${match.index}`} className="font-semibold text-white">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < processed.length) {
      parts.push(processLinks(processed.slice(lastIndex), `${i}-post-${lastIndex}`));
    }

    const content = parts.length > 0 ? parts : processLinks(processed, `${i}-full`);

    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-white/75 text-sm leading-relaxed">
          {typeof content === 'string' ? content : <>{content}</>}
        </li>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      // Numbered list items (1. 2. 3.)
      const listText = line.trim().replace(/^\d+\.\s/, '');
      const numberedContent = parts.length > 0 ? parts : processLinks(listText, `${i}-num`);
      elements.push(
        <li key={i} className="ml-4 list-decimal text-white/75 text-sm leading-relaxed">
          {typeof numberedContent === 'string' ? numberedContent : <>{numberedContent}</>}
        </li>
      );
    } else if (/^#{1,4}\s/.test(line.trim())) {
      // Markdown headings — render as bold paragraph
      const headingText = line.trim().replace(/^#{1,4}\s+/, '');
      const headingContent = processLinks(headingText, `${i}-heading`);
      elements.push(
        <p key={i} className="text-white font-semibold text-sm leading-relaxed mt-1">
          {typeof headingContent === 'string' ? headingContent : <>{headingContent}</>}
        </p>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-white/75 text-sm leading-relaxed">
          {typeof content === 'string' ? content : <>{content}</>}
        </p>
      );
    }
  });

  return <>{elements}</>;
}
