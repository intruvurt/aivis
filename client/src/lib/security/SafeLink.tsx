import { type FC, type AnchorHTMLAttributes } from 'react';
import { isSafeUrl } from './sanitize';

interface SafeLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: React.ReactNode;
}

/**
 * Renders a link only if the href passes URL protocol validation.
 * Unsafe URLs (javascript:, data:, etc.) are rendered as plain text.
 * External links automatically get rel="noopener noreferrer" and target="_blank".
 */
const SafeLink: FC<SafeLinkProps> = ({ href, children, ...rest }) => {
  if (!isSafeUrl(href)) {
    return <span>{children}</span>;
  }

  const isExternal = href.startsWith('http://') || href.startsWith('https://');

  return (
    <a
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
    </a>
  );
};

export default SafeLink;
