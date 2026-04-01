// client/src/hooks/useSupportTickets.ts
import { useState, useCallback } from 'react';
import apiFetch from '../utils/api';
import { API_URL } from '../config';
import type {
  SupportTicket,
  SupportTicketMessage,
  CreateSupportTicketInput,
} from '@shared/types';

interface TicketWithMessages {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

export function useSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<TicketWithMessages | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async (status?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', '50');
      const res = await apiFetch(`${API_URL}/api/support/tickets?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load tickets');
      const data = await res.json();
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTicket = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/support/tickets/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Ticket not found');
      const data = await res.json();
      setActiveTicket({ ticket: data.ticket, messages: data.messages || [] });
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTicket = useCallback(async (input: CreateSupportTicketInput): Promise<SupportTicket | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create ticket');
      }
      const data = await res.json();
      return data.ticket;
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const replyToTicket = useCallback(async (ticketId: string, message: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/support/tickets/${encodeURIComponent(ticketId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send reply');
      }
      // Refresh the ticket to get updated messages
      await fetchTicket(ticketId);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
      return false;
    }
  }, [fetchTicket]);

  const closeTicketById = useCallback(async (ticketId: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/support/tickets/${encodeURIComponent(ticketId)}/close`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to close ticket');
      await fetchTickets();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to close ticket');
      return false;
    }
  }, [fetchTickets]);

  return {
    tickets,
    activeTicket,
    total,
    isLoading,
    error,
    fetchTickets,
    fetchTicket,
    createTicket,
    replyToTicket,
    closeTicketById,
    setActiveTicket,
    clearError: () => setError(null),
  };
}
