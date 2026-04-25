/**
 * System Health & Diagnostics Routes
 * 
 * Provides visibility into database connection pool, cache state, and triggers maintenance
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../services/postgresql.js';
import { triggerMaintenanceCycle } from '../services/databaseMaintenanceService.js';
import { authRequired } from '../middleware/auth.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = Router();

interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
  activeConnections: number;
}

interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  database: {
    connected: boolean;
    poolStats: PoolStats;
    responseTimeMs: number;
  };
}

/**
 * Get current database pool statistics
 */
function getPoolStats(): PoolStats {
  const pool = getPool();
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount,
    activeConnections: pool.totalCount - pool.idleCount,
  };
}

/**
 * GET /api/health-extended
 * Extended health check with DB pool metrics (admin only)
 */
router.get('/health-extended', authRequired, isAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const pool = getPool();
  const poolStats = getPoolStats();

  try {
    await pool.query('SELECT 1');
    const responseTimeMs = Date.now() - startTime;

    const report: HealthReport = {
      status: poolStats.activeConnections > poolStats.totalConnections * 0.8 ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: true,
        poolStats,
        responseTimeMs,
      },
    };

    res.json(report);
  } catch (err: any) {
    const report: HealthReport = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: false,
        poolStats,
        responseTimeMs: Date.now() - startTime,
      },
    };

    res.status(503).json(report);
  }
});

/**
 * POST /api/admin/maintenance/trigger
 * Manually trigger database maintenance cycle (admin only)
 */
router.post('/admin/maintenance/trigger', authRequired, isAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await triggerMaintenanceCycle();
    res.json({
      success: true,
      maintenance: result,
      message: `Cleaned up ${result.oauth_tokens_deleted} tokens, ${result.sessions_deleted} sessions, evicted ${result.cache_entries_evicted} cache entries, archived ${result.jobs_archived} jobs`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Maintenance cycle failed',
    });
  }
});

/**
 * GET /api/admin/diagnostics
 * Full system diagnostics (admin only)
 */
router.get('/admin/diagnostics', authRequired, isAdmin, async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const poolStats = getPoolStats();

    // Quick DB query to measure latency
    const dbStartTime = Date.now();
    const { rows: countResult } = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM audits WHERE created_at > NOW() - INTERVAL '24 hours') as audits_24h,
        (SELECT COUNT(*) FROM citation_tests WHERE created_at > NOW() - INTERVAL '24 hours') as citations_24h,
        (SELECT COUNT(*) FROM analysis_cache) as cache_entries,
        (SELECT COUNT(*) FROM oauth_tokens WHERE revoked = false AND expires_at > NOW()) as active_oauth_tokens,
        (SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()) as active_sessions`
    );
    const dbLatencyMs = Date.now() - dbStartTime;

    const diagnostics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpuUsage: process.cpuUsage(),
      },
      database: {
        poolStats,
        latencyMs: dbLatencyMs,
        idlePercentage: Math.round((poolStats.idleConnections / poolStats.totalConnections) * 100),
      },
      metrics: countResult.rows[0] || {},
      alerts: [] as string[],
    };

    // Add alerts for unhealthy conditions
    if (poolStats.activeConnections / poolStats.totalConnections > 0.9) {
      diagnostics.alerts.push('⚠️ High connection pool utilization (>90%)');
    }
    if (dbLatencyMs > 1000) {
      diagnostics.alerts.push('⚠️ Slow database response (>1s)');
    }
    if (diagnostics.system.memoryUsageMb > 800) {
      diagnostics.alerts.push('⚠️ High memory usage (>800MB)');
    }

    res.json(diagnostics);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Diagnostics failed',
    });
  }
});

export default router;
