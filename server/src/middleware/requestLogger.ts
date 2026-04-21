/**
 * Request logging middleware for AiVIS.biz
 *
 * Logs all incoming requests with:
 * - Method, path, and status code
 * - Response time (ms)
 * - Bytes sent
 * - User ID (if authenticated)
 * - Client IP address
 * - Request body size
 *
 * Usage:
 *   app.use(createRequestLogger());
 *
 * This helps diagnose:
 * - Traffic spikes by endpoint
 * - Slow endpoints
 * - Error patterns (high 4xx/5xx rates)
 * - Bot activity (rapid repeating requests from same IP)
 */

import type { Request, Response, NextFunction } from "express";

interface RequestLog {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userId?: string;
  statusCode: number;
  responseTimeMs: number;
  bytesSent: number;
  bodySize: number;
}

// Store recent logs in memory (last 1000 requests)
const logBuffer: RequestLog[] = [];
const MAX_LOG_BUFFER_SIZE = 1000;

/**
 * Store a log entry in the circular buffer
 */
function storeLog(log: RequestLog): void {
  logBuffer.push(log);
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

/**
 * Get recent logs, optionally filtered by path or IP
 */
export function getRecentLogs(opts?: {
  path?: string;
  ip?: string;
  statusCode?: number;
  limit?: number;
}): RequestLog[] {
  let filtered = [...logBuffer];

  if (opts?.path) {
    filtered = filtered.filter((l) => l.path.includes(opts.path!));
  }
  if (opts?.ip) {
    filtered = filtered.filter((l) => l.ip === opts.ip);
  }
  if (opts?.statusCode) {
    filtered = filtered.filter((l) => l.statusCode === opts.statusCode);
  }

  const limit = opts?.limit ?? 100;
  return filtered.slice(-limit).reverse();
}

/**
 * Get request statistics
 */
export function getRequestStats() {
  if (logBuffer.length === 0) return null;

  const stats = {
    totalRequests: logBuffer.length,
    avgResponseTimeMs: 0,
    totalBytesSent: 0,
    errorCount: 0,
    errorRate: 0,
    statusCodeDistribution: {} as Record<number, number>,
    topEndpoints: {} as Record<string, number>,
    topIps: {} as Record<string, number>,
  };

  let totalResponseTime = 0;
  const statusCodes = new Map<number, number>();
  const endpoints = new Map<string, number>();
  const ips = new Map<string, number>();

  for (const log of logBuffer) {
    totalResponseTime += log.responseTimeMs;
    stats.totalBytesSent += log.bytesSent;

    if (log.statusCode >= 400) {
      stats.errorCount++;
    }

    // Aggregate status codes
    statusCodes.set(log.statusCode, (statusCodes.get(log.statusCode) ?? 0) + 1);

    // Aggregate endpoints
    endpoints.set(log.path, (endpoints.get(log.path) ?? 0) + 1);

    // Aggregate IPs
    ips.set(log.ip, (ips.get(log.ip) ?? 0) + 1);
  }

  stats.avgResponseTimeMs = Math.round(totalResponseTime / logBuffer.length);
  stats.errorRate = Number(
    ((stats.errorCount / logBuffer.length) * 100).toFixed(2),
  );

  // Convert to sorted objects
  stats.statusCodeDistribution = Object.fromEntries(
    Array.from(statusCodes.entries()).sort((a, b) => a[0] - b[0]),
  );

  stats.topEndpoints = Object.fromEntries(
    Array.from(endpoints.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
  );

  stats.topIps = Object.fromEntries(
    Array.from(ips.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
  );

  return stats;
}

/**
 * Create the request logging middleware
 */
export function createRequestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const bodySize = JSON.stringify(req.body || {}).length;
    const userId = (req as any).user?.id;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    // Capture the original res.end() to log when response is finished
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
      const responseTimeMs = Date.now() - startTime;
      const bytesSent = res.get("content-length")
        ? parseInt(res.get("content-length") as string, 10)
        : 0;

      const requestPath = req.originalUrl || req.path;

      const log: RequestLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: requestPath,
        ip,
        userId,
        statusCode: res.statusCode,
        responseTimeMs,
        bytesSent,
        bodySize,
      };

      storeLog(log);

      const isExpectedRefresh401 =
        res.statusCode === 401 &&
        req.method === "POST" &&
        requestPath === "/api/user/refresh" &&
        !req.headers.authorization &&
        !req.headers.cookie;

      // Log verbose details for errors or slow requests
      if (res.statusCode >= 400 || responseTimeMs > 5000) {
        const level =
          isExpectedRefresh401
            ? "[INFO]"
            : res.statusCode >= 500
            ? "[ERROR]"
            : res.statusCode >= 400
              ? "[WARN]"
              : "[SLOW]";
        console.log(
          `${level} ${req.method} ${requestPath} - ${res.statusCode} (${responseTimeMs}ms) - IP: ${ip}${userId ? ` - User: ${userId}` : ""}`,
        );
      }

      return originalEnd(...args);
    };

    next();
  };
}

/**
 * Admin endpoint to view logs and statistics (protected by admin key)
 */
export function createLogsEndpoint() {
  return {
    logs: (req: Request, res: Response) => {
      const { path, ip, statusCode, limit } = req.query;
      const logs = getRecentLogs({
        path: path ? String(path) : undefined,
        ip: ip ? String(ip) : undefined,
        statusCode: statusCode ? parseInt(statusCode as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : 100,
      });
      res.json(logs);
    },
    stats: (req: Request, res: Response) => {
      const stats = getRequestStats();
      res.json(stats);
    },
  };
}
