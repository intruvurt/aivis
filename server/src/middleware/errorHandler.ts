import { Request, Response, NextFunction } from 'express';
import { sanitizeError } from '../lib/safeLogging.js';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log sanitized error (safe from secret leakage)
  const safeError = sanitizeError(err);
  console.error('[ErrorHandler]', safeError);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode: statusCode
  });
};

export default errorHandler;

