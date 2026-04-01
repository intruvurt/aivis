import { type FC } from 'react';
import { sanitizeRichHtml, sanitizeMarkdown } from './sanitize';

interface SafeHtmlProps {
  html: string;
  /** Use 'markdown' for rendered markdown output, 'rich' (default) for general HTML */
  mode?: 'rich' | 'markdown';
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Renders sanitized HTML safely. All content is passed through DOMPurify
 * before being injected via dangerouslySetInnerHTML.
 *
 * Use this component instead of raw dangerouslySetInnerHTML throughout the app.
 */
const SafeHtml: FC<SafeHtmlProps> = ({ html, mode = 'rich', className, as: Tag = 'div' }) => {
  const clean = mode === 'markdown' ? sanitizeMarkdown(html) : sanitizeRichHtml(html);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
};

export default SafeHtml;
