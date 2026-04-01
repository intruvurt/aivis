/**
 * Error-related types
 */

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: string;
  statusCode: number;
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'USAGE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE';

export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  RATE_LIMIT_EXCEEDED: 429,
  USAGE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  SERVICE_UNAVAILABLE: 503,
};

export function createAppError(
  code: ErrorCode,
  message: string,
  details?: string
): AppError {
  return {
    code,
    message,
    details,
    statusCode: ERROR_STATUS_CODES[code],
  };
}