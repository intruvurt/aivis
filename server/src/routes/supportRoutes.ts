// server/src/routes/supportRoutes.ts
import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import {
  createTicket,
  listTickets,
  streamTickets,
  getTicket,
  replyToTicket,
  closeTicket,
} from '../controllers/supportTicketController.js';

const router = Router();

router.post('/tickets', authRequired, createTicket);
router.get('/tickets', authRequired, listTickets);
router.get('/tickets/stream', authRequired, streamTickets);
router.get('/tickets/:id', authRequired, getTicket);
router.post('/tickets/:id/reply', authRequired, replyToTicket);
router.patch('/tickets/:id/close', authRequired, closeTicket);

export default router;
