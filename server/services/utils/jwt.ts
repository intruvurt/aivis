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
}
