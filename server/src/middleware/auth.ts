/**
 * @deprecated - All routes now use `authRequired` from `./authRequired.ts`.
 * This file is kept only for reference; nothing should import from it.
 * Safe to delete once you confirm no legacy imports remain.
 */
// server/src/middleware/auth.ts - DEPRECATED: use authRequired.ts instead
import jwt from "jsonwebtoken";
import { getUserById } from "../models/User.js";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET must be set in production environment');
  }
  console.warn('  WARNING: JWT_SECRET not set! Auth will fail. Set JWT_SECRET in .env');
}

/**
 * Authentication middleware - REQUIRES VALID TOKEN
 * Use this for routes that need a logged-in user
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // No token = not authenticated
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated. Please log in.",
        statusCode: 401,
        code: "NO_TOKEN"
      });
    }

    try {
      // Verify and decode token - accept both {id} and {userId} payloads
      const decoded = jwt.verify(token, JWT_SECRET) as { id?: string; userId?: string };
      const uid = decoded.userId || decoded.id;

      // Get user from database
      const user = uid ? await getUserById(uid) : null;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "User not found. Token may be invalid.",
          statusCode: 401,
          code: "USER_NOT_FOUND"
        });
      }

      // Attach user to request (tier cast: deprecated file, authRequired.ts is canonical)
      req.user = user as any;
      next();
    } catch (error: any) {
      console.error("[Auth Error]", error.message);

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Session expired. Please log in again.",
          statusCode: 401,
          code: "TOKEN_EXPIRED"
        });
      }

      return res.status(401).json({
        success: false,
        error: "Invalid authentication token.",
        statusCode: 401,
        code: "INVALID_TOKEN"
      });
    }
  } catch (error) {
    console.error("[Auth Middleware Error]", error);
    return res.status(500).json({
      success: false,
      error: "Server error during authentication",
      statusCode: 500
    });
  }
};

/**
 * Email verification middleware - REQUIRES EMAIL TO BE VERIFIED
 * Use this for routes that require verified email (like creating audits)
 */
export const requireVerifiedEmail = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Not authenticated",
      statusCode: 401,
      code: "NOT_AUTHENTICATED"
    });
  }

  if (!req.user.is_verified) {
    return res.status(403).json({
      success: false,
      error: "Email verification required. Please check your email for the verification link.",
      statusCode: 403,
      code: "EMAIL_NOT_VERIFIED",
      requiresVerification: true,
      userEmail: req.user.email
    });
  }

  next();
};

/**
 * Role-based access control
 */
export const requireRole = (roles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
        statusCode: 401
      });
    }

    const userRole = req.user.role || 'user';
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - insufficient permissions",
        statusCode: 403
      });
    }

    next();
  };
};

/**
 * Combined middleware: Require auth + verified email
 * Use this as the standard protection for analyzer features
 */
export const protectAndVerify = [protect, requireVerifiedEmail];
