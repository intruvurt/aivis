// server/src/controllers/supportTicketController.ts
import type { Request, Response } from 'express';
import { getPool } from '../services/postgresql.js';
import crypto from 'node:crypto';
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../../shared/types.js';

/* ────────────────────────────────────────────────────────────────────────── */

const VALID_CATEGORIES: SupportTicketCategory[] = [
  'billing', 'technical', 'account', 'audit_results',
  'api_integration', 'feature_request', 'bug_report', 'general',
];
const VALID_PRIORITIES: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent'];
const VALID_STATUSES: SupportTicketStatus[] = [
  'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed',
];

function generateTicketNumber(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TK-${ts}${rand}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* POST /api/support/tickets - Create a new ticket                           */
/* ────────────────────────────────────────────────────────────────────────── */
export async function createTicket(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const { subject, category, priority, description, metadata } = req.body as {
      subject?: string;
      category?: string;
      priority?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    };

    // Zod shape validation for the feedback-like fields
    const { feedbackSchema, sanitizeHtmlServer } = await import('../middleware/securityMiddleware.js');
    // feedbackSchema covers the core risk fields; we validate the most critical ones
    const feedbackParsed = feedbackSchema.safeParse({
      message: description || '',
      category: category === 'bug_report' ? 'bug' : category === 'feature_request' ? 'feature' : 'other',
    });
    if (!feedbackParsed.success) {
      return res.status(400).json({ error: feedbackParsed.error.issues[0]?.message || 'Invalid input' });
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length < 3 || subject.trim().length > 200) {
      return res.status(400).json({ error: 'Subject must be 3–200 characters' });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 5000) {
      return res.status(400).json({ error: 'Description must be 10–5000 characters' });
    }

    const safeCategory = VALID_CATEGORIES.includes(category as SupportTicketCategory)
      ? (category as SupportTicketCategory)
      : 'general';
    const safePriority = VALID_PRIORITIES.includes(priority as SupportTicketPriority)
      ? (priority as SupportTicketPriority)
      : 'normal';

    const ticketNumber = generateTicketNumber();
    const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO support_tickets (ticket_number, user_id, subject, category, priority, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [ticketNumber, user.id, sanitizeHtmlServer(subject.trim()), safeCategory, safePriority, sanitizeHtmlServer(description.trim()), JSON.stringify(safeMetadata)],
    );

    // Insert initial message
    await pool.query(
      `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, message)
       VALUES ($1, 'user', $2, $3)`,
      [rows[0].id, user.id, sanitizeHtmlServer(description.trim())],
    );

    return res.status(201).json({ success: true, ticket: rows[0] });
  } catch (err: any) {
    console.error('[Support] Create ticket error:', err.message);
    return res.status(500).json({ error: 'Failed to create support ticket' });
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GET /api/support/tickets - List user's tickets                            */
/* ────────────────────────────────────────────────────────────────────────── */
export async function listTickets(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    let query = `SELECT * FROM support_tickets WHERE user_id = $1`;
    const params: unknown[] = [user.id];

    if (status && VALID_STATUSES.includes(status as SupportTicketStatus)) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const pool = getPool();
    const { rows } = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM support_tickets WHERE user_id = $1`,
      [user.id],
    );

    return res.json({
      success: true,
      tickets: rows,
      total: countResult.rows[0]?.total ?? 0,
    });
  } catch (err: any) {
    console.error('[Support] List tickets error:', err.message);
    return res.status(500).json({ error: 'Failed to list tickets' });
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GET /api/support/tickets/:id - Get single ticket with messages            */
/* ────────────────────────────────────────────────────────────────────────── */
export async function getTicket(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const ticketId = req.params.id;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2`,
      [ticketId, user.id],
    );

    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' });

    const messages = await pool.query(
      `SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticketId],
    );

    return res.json({
      success: true,
      ticket: rows[0],
      messages: messages.rows,
    });
  } catch (err: any) {
    console.error('[Support] Get ticket error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* POST /api/support/tickets/:id/reply - Add message to ticket               */
/* ────────────────────────────────────────────────────────────────────────── */
export async function replyToTicket(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const ticketId = req.params.id;
    const { message } = req.body as { message?: string };

    if (!message || typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 5000) {
      return res.status(400).json({ error: 'Message must be 1–5000 characters' });
    }

    const pool = getPool();

    // Verify ownership
    const ticket = await pool.query(
      `SELECT id, status FROM support_tickets WHERE id = $1 AND user_id = $2`,
      [ticketId, user.id],
    );
    if (!ticket.rows[0]) return res.status(404).json({ error: 'Ticket not found' });

    if (ticket.rows[0].status === 'closed') {
      return res.status(400).json({ error: 'Cannot reply to a closed ticket' });
    }

    // Sanitize message before storage
    const { sanitizeHtmlServer: sanitize } = await import('../middleware/securityMiddleware.js');

    const { rows } = await pool.query(
      `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, message)
       VALUES ($1, 'user', $2, $3)
       RETURNING *`,
      [ticketId, user.id, sanitize(message.trim())],
    );

    // Update ticket timestamp and set to open if it was waiting on customer
    await pool.query(
      `UPDATE support_tickets SET updated_at = NOW(),
        status = CASE WHEN status = 'waiting_on_customer' THEN 'open' ELSE status END
       WHERE id = $1`,
      [ticketId],
    );

    return res.status(201).json({ success: true, message: rows[0] });
  } catch (err: any) {
    console.error('[Support] Reply error:', err.message);
    return res.status(500).json({ error: 'Failed to send reply' });
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PATCH /api/support/tickets/:id/close - Close a ticket                     */
/* ────────────────────────────────────────────────────────────────────────── */
export async function closeTicket(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

    const ticketId = req.params.id;
    const pool = getPool();

    const { rows } = await pool.query(
      `UPDATE support_tickets SET status = 'closed', resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [ticketId, user.id],
    );

    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' });

    return res.json({ success: true, ticket: rows[0] });
  } catch (err: any) {
    console.error('[Support] Close ticket error:', err.message);
    return res.status(500).json({ error: 'Failed to close ticket' });
  }
}
