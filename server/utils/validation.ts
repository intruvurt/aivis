import validator from 'validator';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  url?: string;
}

export function validateUrl(urlString: string): ValidationResult {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL is required and must be a string' };
  }

  const trimmedUrl = urlString.trim();

  if (!trimmedUrl) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Add https:// if no protocol specified
  const urlWithProtocol = trimmedUrl.match(/^https?:\/\//)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  // Validate URL format
  if (
    !validator.isURL(urlWithProtocol, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: true,
    })
  ) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Additional security checks
  try {
    const parsedUrl = new URL(urlWithProtocol);

    // Block localhost and private IPs
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.')
    ) {
      return { valid: false, error: 'Cannot analyze local or private network URLs' };
    }

    return { valid: true, url: urlWithProtocol };
  } catch (error) {
    return { valid: false, error: 'Invalid URL structure' };
  }
}
