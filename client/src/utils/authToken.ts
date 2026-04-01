export function normalizeAuthToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  let token = raw.trim();
  if (!token) return null;

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  token = token.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  // Authorization header values cannot contain control chars or whitespace.
  if (/[\u0000-\u001F\u007F\s]/.test(token)) return null;

  return token;
}

export function buildBearerHeader(raw: unknown): string | null {
  const token = normalizeAuthToken(raw);
  return token ? `Bearer ${token}` : null;
}
