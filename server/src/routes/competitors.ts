import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import {
  listCompetitors,
  getCompetitorSuggestions,
  createCompetitor,
  deleteCompetitor,
  getCompetitorComparison,
  generateCompetitorFixes,
  scanCompetitor,
  updateCompetitorMonitoring,
  autoDiscoverCompetitors,
} from '../controllers/competitors.controllers.js';

const router = Router();

// All competitor routes require authentication
router.use(authRequired);
router.use(workspaceRequired);

// Tier gate: Alignment+ only (competitor tracking is a paid feature)
router.use((req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      error: 'Competitor tracking requires an Alignment or Signal plan.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
});

// List all competitors
router.get('/', listCompetitors);

// Niche-based competitor suggestions
router.get('/suggestions', getCompetitorSuggestions);

// Auto-discover competitors from audit history
router.post('/auto-discover', autoDiscoverCompetitors);

// Add a new competitor
router.post('/', createCompetitor);

// Delete a competitor
router.delete('/:id', deleteCompetitor);

// Get comparison analysis
router.get('/comparison', getCompetitorComparison);

// Generate competitor-driven page fixes
router.post('/generate-fix', generateCompetitorFixes);

// Trigger scan for a specific competitor
router.patch('/:id/scan', scanCompetitor);

// Update monitoring settings (enable/disable autopilot + frequency)
router.patch('/:id', updateCompetitorMonitoring);

export default router;
