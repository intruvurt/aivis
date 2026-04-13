// Sensitive key names that should be masked in any object
const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|api[_-]?key|cookie|set-cookie|jwt|session|bearer|credential|private[_-]?key|stripe[_-]?key|stripe[_-]?secret|webhook[_-]?secret|openai[_-]?key|openrouter|gemini[_-]?key|anthropic[_-]?key)/i;

// Query parameters that may contain secrets
const URL_SECRET_PARAM_PATTERN = /(token|api[_-]?key|key|secret|password|jwt|auth|signature|sig|access[_-]?token)/i;

// JWT patterns (eyJ... format)
const JWT_LIKE_PATTERN = /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9._-]{8,}\b/g;

// Bearer tokens and Basic auth
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/-]{16,}/gi;
const BASIC_AUTH_PATTERN = /Basic\s+[A-Za-z0-9+/=]{16,}/gi;

// Environment variable leakage: KEY=value
const ENV_VAR_PATTERN = /(OPENROUTER_API_KEY|OPEN_ROUTER_API_KEY|GOOGLE_CLIENT_SECRET|JWT_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|DATABASE_PASSWORD|DB_PASSWORD|ADMIN_KEY|SENTRY_DSN|WEBHOOK_SECRET|API_KEY|PAYPAL_SECRET|PAYPAL_API_KEY|PAYPAL_CLIENT_ID|RESEND_API_KEY|SERP_API_KEY|DEEPSEEK_API_KEY|DATABASE_URL)[\s=:]+[^\s"'}]+/gi;

// Email addresses (partial masking)
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// AWS/GCP credentials
const AWS_KEY_PATTERN = /AKIA[0-9A-Z]{16}/g;
const GCP_PRIVATE_KEY_PATTERN = /"private_key":\s*"[^"]*-----BEGIN PRIVATE KEY-----[^"]*-----END PRIVATE KEY-----[^"]*"/g;

function maskSecret(value: string): string {
  if (!value) return value;
  if (value.length <= 8) return '[REDACTED]';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function maskEmail(email: string): string {
  try {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '[REDACTED.EMAIL]';
    const masked = local.length > 1 ? local[0] + '*'.repeat(Math.max(1, local.length - 2)) + local[local.length - 1] : local;
    return `${masked}@${domain}`;
  } catch {
    return '[REDACTED.EMAIL]';
  }
}

function sanitizeUrlString(input: string): string {
  try {
    const url = new URL(input);
    for (const key of Array.from(url.searchParams.keys())) {
      if (URL_SECRET_PARAM_PATTERN.test(key)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return url.toString();
  } catch {
    return input
      .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
      .replace(BASIC_AUTH_PATTERN, 'Basic [REDACTED]')
      .replace(JWT_LIKE_PATTERN, '[REDACTED.JWT]')
      .replace(ENV_VAR_PATTERN, '$1=[REDACTED]')
      .replace(AWS_KEY_PATTERN, '[AWS_KEY_REDACTED]')
      .replace(GCP_PRIVATE_KEY_PATTERN, '"private_key":"[REDACTED]"')
      .replace(EMAIL_PATTERN, (email) => maskEmail(email));
  }
}

function sanitizeString(input: string): string {
  let sanitized = input
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(BASIC_AUTH_PATTERN, 'Basic [REDACTED]')
    .replace(JWT_LIKE_PATTERN, '[REDACTED.JWT]')
    .replace(ENV_VAR_PATTERN, '$1=[REDACTED]')
    .replace(AWS_KEY_PATTERN, '[AWS_KEY_REDACTED]')
    .replace(GCP_PRIVATE_KEY_PATTERN, '"private_key":"[REDACTED]"')
    .replace(EMAIL_PATTERN, (email) => maskEmail(email));

  // Also attempt URL-based sanitization
  try {
    const maybeUrl = sanitizeUrlString(input);
    sanitized = maybeUrl;
  } catch {
    // Not a URL, use string sanitization only
  }

  return sanitized;
}

function sanitizeObject(input: any, depth: number, seen: WeakSet<object>): any {
  if (depth <= 0) return '[MAX_DEPTH]';
  if (input === null || input === undefined) return input;

  if (typeof input === 'string') return sanitizeString(input);
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (typeof input === 'bigint') return input.toString();

  if (input instanceof Error) {
    return {
      name: input.name,
      message: sanitizeString(String(input.message || '')),
      stack: input.stack ? sanitizeString(String(input.stack).split('\n').slice(0, 6).join('\n')) : undefined,
    };
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item, depth - 1, seen));
  }

  if (typeof input === 'object') {
    if (seen.has(input)) return '[CIRCULAR]';
    seen.add(input);

    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = typeof value === 'string' ? maskSecret(value) : '[REDACTED]';
      } else {
        output[key] = sanitizeObject(value, depth - 1, seen);
      }
    }
    return output;
  }

  return String(input);
}

export function redactSensitive<T = any>(input: T, maxDepth = 5): T {
  return sanitizeObject(input, maxDepth, new WeakSet<object>()) as T;
}

export function sanitizeError(err: unknown): Record<string, any> {
  return redactSensitive(err instanceof Error ? err : { message: String(err || 'Unknown error') });
}

let consoleWrapped = false;

export function installConsoleRedaction(): void {
  if (consoleWrapped) return;
  consoleWrapped = true;

  const wrap = <T extends (...args: any[]) => void>(fn: T): T => {
    const wrapped = ((...args: any[]) => {
      const safeArgs = args.map((arg) => redactSensitive(arg));
      fn(...safeArgs);
    }) as T;
    return wrapped;
  };

  console.log = wrap(console.log.bind(console));
  console.info = wrap(console.info.bind(console));
  console.warn = wrap(console.warn.bind(console));
  console.error = wrap(console.error.bind(console));
  console.debug = wrap(console.debug.bind(console));
}
