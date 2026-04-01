import "dotenv/config";
import jwt from "jsonwebtoken";

export type UserTokenPayload = {
  userId: string;
  tier: string;
  iat?: number;
  exp?: number;
};

type JwtVerifyResult = string | Record<string, unknown>;

const JWT_SECRET = process.env.JWT_SECRET?.trim();
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET missing - set JWT_SECRET in your .env file (DO NOT use VITE_JWT_SECRET)");
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function asUserTokenPayload(decoded: unknown): UserTokenPayload {
  if (!isObject(decoded)) throw new Error("Invalid JWT payload");

  const userId = typeof decoded.userId === "string" ? decoded.userId : "";
  const tier = typeof decoded.tier === "string" ? decoded.tier : "";

  if (!userId || !tier) {
    throw new Error("JWT payload missing required fields");
  }

  const iat = typeof decoded.iat === "number" ? decoded.iat : undefined;
  const exp = typeof decoded.exp === "number" ? decoded.exp : undefined;

  return { userId, tier, iat, exp };
}

export function signUserToken(payload: Pick<UserTokenPayload, "userId" | "tier">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyUserToken(token: string): UserTokenPayload {
  const decoded: JwtVerifyResult = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === "string") throw new Error("Invalid JWT payload");
  return asUserTokenPayload(decoded);
}

export function decodeUserToken(token: string): UserTokenPayload | null {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") return null;

  try {
    return asUserTokenPayload(decoded);
  } catch {
    return null;
  }
}
