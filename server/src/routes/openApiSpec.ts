/**
 * OpenAPI 3.0 Specification Endpoint
 * Serves the machine-readable API spec at GET /api/v1/openapi.json
 * Public endpoint — no auth required — for third-party tool discovery.
 */
import { Router, Request, Response } from 'express';

const router = Router();

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'AiVIS API',
    version: '1.0.0',
    description:
      'AI Visibility Engine REST API. Audit whether websites are machine-readable, structurally extractable, and citation-ready inside AI-generated answers.',
    contact: { name: 'AiVIS Support', url: 'https://aivis.biz', email: 'support@aivis.biz' },
    license: { name: 'Proprietary' },
  },
  servers: [
    { url: 'https://api.aivis.biz', description: 'Production' },
  ],
  security: [{ apiKeyAuth: [] }],
  tags: [
    { name: 'Audits', description: 'AI visibility audit CRUD' },
    { name: 'Analytics', description: 'Score history and platform analytics' },
    { name: 'Competitors', description: 'Competitor tracking records' },
    { name: 'Evidence', description: 'Evidence-linked audit payloads' },
    { name: 'Page Validation', description: 'Technical page validation checks' },
    { name: 'Usage', description: 'API metering and usage stats' },
    { name: 'Compliance', description: 'Consumer policy and consent management' },
  ],
  paths: {
    '/api/v1/audits': {
      get: {
        operationId: 'listAudits',
        tags: ['Audits'],
        summary: 'List audits with pagination',
        security: [{ apiKeyAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 }, description: 'Number of results per page' },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 }, description: 'Pagination offset' },
        ],
        responses: {
          '200': {
            description: 'Paginated list of audits',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditListResponse' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/InsufficientScope' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/v1/audits/{id}': {
      get: {
        operationId: 'getAudit',
        tags: ['Audits'],
        summary: 'Get full audit payload by ID',
        security: [{ apiKeyAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Audit ID' },
        ],
        responses: {
          '200': {
            description: 'Full audit with result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditDetailResponse' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/InsufficientScope' },
          '404': { description: 'Audit not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/v1/analytics': {
      get: {
        operationId: 'getAnalytics',
        tags: ['Analytics'],
        summary: 'Get score history grouped by URL',
        security: [{ apiKeyAuth: [] }],
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 365, default: 90 }, description: 'Lookback window in days' },
        ],
        responses: {
          '200': {
            description: 'Analytics data with score history and platform averages',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AnalyticsResponse' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/InsufficientScope' },
        },
      },
    },
    '/api/v1/competitors': {
      get: {
        operationId: 'listCompetitors',
        tags: ['Competitors'],
        summary: 'Get competitor tracking records',
        security: [{ apiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'Competitor list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CompetitorListResponse' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/InsufficientScope' },
        },
      },
    },
    '/api/v1/evidence/{auditId}': {
      get: {
        operationId: 'getEvidence',
        tags: ['Evidence'],
        summary: 'Get evidence manifest and recommendation evidence for an audit',
        security: [{ apiKeyAuth: [] }],
        parameters: [
          { name: 'auditId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Audit ID' },
        ],
        responses: {
          '200': {
            description: 'Evidence payload',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EvidenceResponse' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Audit not found' },
        },
      },
    },
    '/api/v1/usage': {
      get: {
        operationId: 'getUsage',
        tags: ['Usage'],
        summary: 'Get current-month metered API usage',
        security: [{ apiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'API usage snapshot for current billing month',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UsageResponse' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/page-validation': {
      post: {
        operationId: 'runPageValidation',
        tags: ['Page Validation'],
        summary: 'Run and store technical page validation',
        security: [{ apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: { url: { type: 'string', format: 'uri', description: 'Public URL to validate' } },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Validation result created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PageValidationResponse' } } },
          },
          '400': { description: 'Invalid or private URL' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/page-validation/{id}': {
      get: {
        operationId: 'getPageValidation',
        tags: ['Page Validation'],
        summary: 'Fetch stored page validation by ID',
        security: [{ apiKeyAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Validation record ID' },
        ],
        responses: {
          '200': {
            description: 'Stored validation record',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PageValidationResponse' } } },
          },
          '404': { description: 'Validation record not found' },
        },
      },
    },
    '/api/compliance/policy': {
      get: {
        operationId: 'getPolicy',
        tags: ['Compliance'],
        summary: 'Get consumer policy and disclaimer metadata',
        security: [],
        responses: {
          '200': { description: 'Policy metadata' },
        },
      },
    },
    '/api/compliance/consent': {
      get: {
        operationId: 'getConsent',
        tags: ['Compliance'],
        summary: 'List consent records for account/workspace',
        description: 'Requires session authentication (not API key).',
        security: [],
        responses: {
          '200': { description: 'Consent records' },
          '401': { description: 'Session authentication required' },
        },
      },
      post: {
        operationId: 'updateConsent',
        tags: ['Compliance'],
        summary: 'Create or update consent status',
        description: 'Requires session authentication (not API key).',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  consent_type: { type: 'string' },
                  granted: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Consent updated' },
          '401': { description: 'Session authentication required' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'avis_*',
        description: 'API key authentication. Keys are prefixed with avis_ and managed from your AiVIS account settings.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          code: { type: 'string', enum: ['INVALID_API_KEY', 'API_KEY_EXPIRED', 'FEATURE_LOCKED', 'INSUFFICIENT_SCOPE', 'RATE_LIMITED'] },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          has_more: { type: 'boolean' },
        },
      },
      AuditSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          visibility_score: { type: 'number' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AuditListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array', items: { $ref: '#/components/schemas/AuditSummary' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      AuditDetailResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              url: { type: 'string', format: 'uri' },
              visibility_score: { type: 'number' },
              result: { type: 'object', description: 'Full audit result payload including recommendations, content analysis, technical signals, and AI platform scores' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      AnalyticsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                scores: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      score: { type: 'number' },
                      date: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
          summary: {
            type: 'object',
            properties: {
              total_audits: { type: 'integer' },
              avg_score: { type: 'number' },
              best_score: { type: 'number' },
              worst_score: { type: 'number' },
            },
          },
          platform_averages: {
            type: 'object',
            properties: {
              chatgpt: { type: 'number' },
              perplexity: { type: 'number' },
              google_ai: { type: 'number' },
              claude: { type: 'number' },
            },
          },
          period_days: { type: 'integer' },
        },
      },
      CompetitorListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                competitor_url: { type: 'string' },
                nickname: { type: 'string' },
                latest_score: { type: 'number' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      EvidenceResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              audit_id: { type: 'string', format: 'uuid' },
              url: { type: 'string' },
              scanned_at: { type: 'string', format: 'date-time' },
              evidence_fields: { type: 'object', description: 'Evidence manifest keyed by signal category' },
              content_highlights: { type: 'array', items: { type: 'object' } },
              recommendation_evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    priority: { type: 'string' },
                    category: { type: 'string' },
                    evidence_ids: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
      UsageResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              monthStart: { type: 'string', format: 'date' },
              monthEnd: { type: 'string', format: 'date' },
              apiKeyRequestsThisMonth: { type: 'integer' },
              workspaceRequestsThisMonth: { type: 'integer' },
            },
          },
        },
      },
      PageValidationResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              url: { type: 'string' },
              result: {
                type: 'object',
                properties: {
                  status_code: { type: 'integer' },
                  final_url: { type: 'string' },
                  checks: {
                    type: 'object',
                    properties: {
                      hasTitle: { type: 'boolean' },
                      hasMetaDescription: { type: 'boolean' },
                      hasCanonical: { type: 'boolean' },
                      hasSingleH1: { type: 'boolean' },
                      hasJsonLd: { type: 'boolean' },
                      minWordCount300: { type: 'boolean' },
                      usesHttps: { type: 'boolean' },
                    },
                  },
                  metrics: {
                    type: 'object',
                    properties: {
                      title_length: { type: 'integer' },
                      meta_description_length: { type: 'integer' },
                      h1_count: { type: 'integer' },
                      json_ld_count: { type: 'integer' },
                      word_count: { type: 'integer' },
                    },
                  },
                  summary: {
                    type: 'object',
                    properties: {
                      passed: { type: 'integer' },
                      total: { type: 'integer' },
                      score_percent: { type: 'integer' },
                    },
                  },
                },
              },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Invalid or missing API key',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      InsufficientScope: {
        description: 'API key lacks required scope',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      RateLimited: {
        description: 'Rate limit exceeded (120 requests / 60 seconds per key)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
} as const;

// Public endpoint — no auth required
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(OPENAPI_SPEC);
});

export default router;
