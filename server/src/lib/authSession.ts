import type { Request, Response } from 'express';

export const AUTH_SESSION_COOKIE = 'aivis_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseCookieHeader(raw: string): Record<string, string> {
    return raw
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((acc, part) => {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex <= 0) return acc;

            const key = part.slice(0, separatorIndex).trim();
            const value = part.slice(separatorIndex + 1).trim();
            if (!key) return acc;

            try {
                acc[key] = decodeURIComponent(value);
            } catch {
                acc[key] = value;
            }
            return acc;
        }, {});
}

export function getSessionCookieToken(req: Request): string {
    const cookieHeader = String(req.headers.cookie || '').trim();
    if (!cookieHeader) return '';
    return parseCookieHeader(cookieHeader)[AUTH_SESSION_COOKIE] || '';
}

export function getRequestAuthToken(req: Request): string {
    const authHeader = String(req.headers.authorization || '').trim();
    if (/^Bearer\s+/i.test(authHeader)) {
        return authHeader.replace(/^Bearer\s+/i, '').trim();
    }
    return getSessionCookieToken(req);
}

export function setSessionCookie(res: Response, token: string): void {
    res.cookie(AUTH_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_MAX_AGE_MS,
        path: '/',
    });
}

export function clearSessionCookie(res: Response): void {
    res.clearCookie(AUTH_SESSION_COOKIE, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
}