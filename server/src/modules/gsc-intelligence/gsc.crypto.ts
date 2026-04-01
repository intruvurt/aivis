import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function deriveKeyMaterial(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function getEncryptionSecret(): string {
  const candidate =
    process.env.GSC_TOKEN_ENCRYPTION_KEY ||
    process.env.APP_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    '';

  if (!candidate) {
    throw new Error('Missing encryption secret (set GSC_TOKEN_ENCRYPTION_KEY or APP_ENCRYPTION_KEY)');
  }

  return candidate;
}

export function encryptToken(plain: string): string {
  const key = deriveKeyMaterial(getEncryptionSecret());
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(payload: string): string {
  const [ivPart, tagPart, encryptedPart] = String(payload || '').split('.');
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = deriveKeyMaterial(getEncryptionSecret());
  const iv = Buffer.from(ivPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  const encrypted = Buffer.from(encryptedPart, 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}
