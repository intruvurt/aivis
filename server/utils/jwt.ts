<<<<<<<< HEAD:server/utils/jwt.ts
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import "dotenv/config"
import jwt from 'jsonwebtoken'

// SECURITY: Only use server-side JWT_SECRET (never VITE_ prefixed vars as they are exposed client-side)
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET missing - set JWT_SECRET in your .env file (DO NOT use VITE_JWT_SECRET)')

export function signUserToken(payload: { userId: string; tier: string }) {
return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyUserToken(token: string) {
return jwt.verify(token, JWT_SECRET) as { userId: string; tier: string; iat: number; exp: number }
}
export function decodeUserToken(token: string) {
  return jwt.decode(token) as { userId: string; tier: string; iat: number; exp: number } | null
=======
=======
>>>>>>> Stashed changes
// utils/jwt.ts
import "dotenv/config";
import jwt, { type JwtPayload } from "jsonwebtoken";
========
import "dotenv/config"
import jwt from 'jsonwebtoken'
>>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3:utils/jwt.ts

// SECURITY: Only use server-side JWT_SECRET (never VITE_ prefixed vars as they are exposed client-side)
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET missing - set JWT_SECRET in your .env file (DO NOT use VITE_JWT_SECRET)')

export function signUserToken(payload: { userId: string; tier: string }) {
return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyUserToken(token: string) {
return jwt.verify(token, JWT_SECRET) as { userId: string; tier: string; iat: number; exp: number }
}
<<<<<<<< HEAD:server/utils/jwt.ts

export function decodeUserToken(token: string): UserTokenPayload | null {
  // WARNING: decode() does NOT verify signature or expiry.
  // Only use for debugging or non-security UI hints.
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") return null;
  return decoded as UserTokenPayload;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
========
export function decodeUserToken(token: string) {
  return jwt.decode(token) as { userId: string; tier: string; iat: number; exp: number } | null
>>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3:utils/jwt.ts
}
