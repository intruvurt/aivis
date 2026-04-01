import { z } from 'zod';

export const sourceModeSchema = z.enum(['live_gsc', 'snapshot']).default('live_gsc');

export const decliningPagesInputSchema = z.object({
  propertyId: z.string().uuid(),
  currentWindowDays: z.number().int().min(7).max(120).default(60),
  previousWindowDays: z.number().int().min(7).max(120).default(60),
  minClicks: z.number().min(0).default(10),
  minLossPct: z.number().min(1).max(100).default(30),
  sourceMode: sourceModeSchema,
});

export const lowCtrOpportunitiesInputSchema = z.object({
  propertyId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  positionMin: z.number().min(1).max(100).default(8),
  positionMax: z.number().min(1).max(100).default(15),
  minImpressions: z.number().min(1).default(100),
  maxCtr: z.number().min(0).max(1).default(0.03),
  sourceMode: sourceModeSchema,
});

export const winnersLosersInputSchema = z.object({
  propertyId: z.string().uuid(),
  rangeDays: z.number().int().min(7).max(120).default(28),
  minImpressions: z.number().min(1).default(50),
  sourceMode: sourceModeSchema,
});

export const queryGapInputSchema = z.object({
  propertyId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minImpressions: z.number().min(1).default(150),
  maxCtr: z.number().min(0).max(1).default(0.02),
  sourceMode: sourceModeSchema,
});

export const pageDecayInputSchema = z.object({
  propertyId: z.string().uuid(),
  lookbackMonths: z.number().int().min(3).max(24).default(6),
  minPeakClicks: z.number().min(1).default(30),
  declineConsistencyThreshold: z.number().min(0.2).max(1).default(0.6),
  sourceMode: sourceModeSchema,
});

export const cannibalizationInputSchema = z.object({
  propertyId: z.string().uuid(),
  topic: z.string().min(2).max(200).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minSharedQueries: z.number().int().min(1).max(50).default(2),
  minOverlapScore: z.number().min(0).max(10).default(1),
  sourceMode: sourceModeSchema,
});

export const pageQueryMatrixInputSchema = z.object({
  propertyId: z.string().uuid(),
  page: z.string().url(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.number().int().min(1).max(500).default(100),
  sourceMode: sourceModeSchema,
});

export const auditJoinedRecommendationsInputSchema = z.object({
  propertyId: z.string().uuid(),
  page: z.string().url(),
  compareWindowDays: z.number().int().min(7).max(120).default(60),
  sourceMode: sourceModeSchema,
});

export const planInputSchema = z.object({
  prompt: z.string().min(5).max(1000),
  propertyId: z.string().uuid().optional(),
});

export const executeInputSchema = z.object({
  toolName: z.enum([
    'declining_pages',
    'low_ctr_opportunities',
    'winners_losers_summary',
    'query_gap_finder',
    'page_decay_detector',
    'cannibalization_detector',
    'page_query_matrix',
    'audit_joined_recommendations',
  ]),
  args: z.record(z.string(), z.unknown()).default({}),
});

export type DecliningPagesInput = z.infer<typeof decliningPagesInputSchema>;
export type LowCtrOpportunitiesInput = z.infer<typeof lowCtrOpportunitiesInputSchema>;
export type WinnersLosersInput = z.infer<typeof winnersLosersInputSchema>;
export type QueryGapInput = z.infer<typeof queryGapInputSchema>;
export type PageDecayInput = z.infer<typeof pageDecayInputSchema>;
export type CannibalizationInput = z.infer<typeof cannibalizationInputSchema>;
export type PageQueryMatrixInput = z.infer<typeof pageQueryMatrixInputSchema>;
export type AuditJoinedRecommendationsInput = z.infer<typeof auditJoinedRecommendationsInputSchema>;
