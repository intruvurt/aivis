/**
 * XSS audit checklist for the AiVIS codebase.
 *
 * Each entry documents a known risk surface, its current mitigation status,
 * and references to the relevant code. Run this as a living security register:
 * review when adding new rendering or storage paths.
 */
export const XSS_AUDIT_CHECKLIST = [
  {
    id: 'DANGEROUSLY_SET_INNER_HTML',
    risk: 'high',
    description: 'All dangerouslySetInnerHTML usage must pass through SafeHtml or equivalent DOMPurify sanitization.',
    locations: ['client/src/views/ScoreFixPage.tsx (JSON-LD - escaped via replace)'],
    status: 'mitigated',
    notes: 'Only 1 instance in source. Uses JSON.stringify + replace(/</, "\\u003c"). SafeHtml component available for any future rich-HTML rendering.',
  },
  {
    id: 'LOCAL_STORAGE_JWT',
    risk: 'medium',
    description: 'JWT tokens stored in localStorage are accessible to any JS on the page. Migrate to HttpOnly cookies when possible.',
    locations: [
      'client/src/stores/authStore.ts - key: "aivis_auth_v2"',
      'client/src/auth/neonAuthClient.ts - key: "aivis_session_token"',
    ],
    status: 'flagged',
    notes: 'HttpOnly cookie migration recommended for production hardening. CSP and subresource integrity reduce XSS risk in the meantime.',
  },
  {
    id: 'BOOTSTRAP_STATE_INJECTION',
    risk: 'low',
    description: 'Server-rendered inline JSON in HTML must escape < to prevent script breakout.',
    locations: ['client/index.html - window.__AIVIS_RECAPTCHA_SITE_KEY (public, non-sensitive)'],
    status: 'not-applicable',
    notes: 'No sensitive bootstrap state is injected. escapeBootstrapState() available server-side if needed in the future.',
  },
  {
    id: 'USER_PROFILE_BIO',
    risk: 'medium',
    description: 'Profile bio accepts rich text and is stored in DB. Must be sanitized before storage and before rendering.',
    locations: [
      'server/src/controllers/authControllerFixed.ts - updateProfile',
    ],
    status: 'mitigated',
    notes: 'Server-side sanitizeHtmlServer() applied before SQL insert. Client should use SafeHtml when rendering bio.',
  },
  {
    id: 'SUPPORT_TICKET_BODY',
    risk: 'medium',
    description: 'Support ticket subject, description, and replies accept user text. Must be sanitized before storage.',
    locations: [
      'server/src/controllers/supportTicketController.ts - createTicket, replyToTicket',
    ],
    status: 'mitigated',
    notes: 'sanitizeHtmlServer() applied to all user-content fields before SQL insert.',
  },
  {
    id: 'URL_INPUT_VALIDATION',
    risk: 'high',
    description: 'User-supplied URLs (analyze target, profile website) must be validated for protocol safety and reject private/local hosts in production.',
    locations: [
      'server/src/server.ts - /api/analyze',
      'server/src/controllers/authControllerFixed.ts - updateProfile (website field)',
    ],
    status: 'mitigated',
    notes: 'analyzeRequestSchema validates URL format via Zod. isSafeExternalUrl() and isPrivateOrLocalHost() enforce runtime safety.',
  },
  {
    id: 'AI_RESPONSE_RENDERING',
    risk: 'medium',
    description: 'AI model responses may contain HTML/markdown. Client must sanitize before rendering.',
    locations: [
      'client/src/components/analysis/* - recommendation rendering',
    ],
    status: 'mitigated',
    notes: 'sanitizeRichHtml() and sanitizeMarkdown() available. SafeHtml component provided for any rich-content rendering paths.',
  },
  {
    id: 'CSV_PDF_EXPORT_INJECTION',
    risk: 'low',
    description: 'Exported reports could contain formula injection (=cmd) in CSV or script injection in PDF HTML.',
    locations: ['client/src/lib/export*'],
    status: 'flagged',
    notes: 'Review export paths to ensure field values are escaped. Low risk since exports are user-initiated and consumed locally.',
  },
  {
    id: 'EVAL_OR_FUNCTION_CONSTRUCTOR',
    risk: 'critical',
    description: 'No eval(), new Function(), or innerHTML assignments from untrusted data.',
    locations: [],
    status: 'clean',
    notes: 'No instances found in source. CSP script-src blocks inline eval.',
  },
  {
    id: 'OPEN_REDIRECT',
    risk: 'medium',
    description: 'Any redirect based on user-supplied URL must validate the destination.',
    locations: ['server/src/controllers/authControllerFixed.ts - OAuth callback redirects'],
    status: 'flagged',
    notes: 'Review OAuth callback redirect_uri validation. SafeLink component enforces protocol checks on client.',
  },
] as const;

export type AuditChecklistEntry = (typeof XSS_AUDIT_CHECKLIST)[number];
