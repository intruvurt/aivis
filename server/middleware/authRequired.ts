import type { Request, Response, NextFunction } from 'express'
import { verifyUserToken } from '../utils/jwt.ts'

export function authRequired(req: Request, res: Response, next: NextFunction) {
  // Development bypass: allow unauthenticated requests when DEV_BYPASS_AUTH=true
  // and NODE_ENV is not 'production'. This is for local debugging only.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    ;(req as any).user = { userId: '00000000-0000-0000-0000-000000000000', tier: 'observer' }
    return next()
  }

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const token = auth.slice('Bearer '.length)
    const decoded = verifyUserToken(token)
    ;(req as any).user = { userId: decoded.userId, tier: decoded.tier }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
