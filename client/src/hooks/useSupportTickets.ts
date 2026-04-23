// client/src/hooks/useSupportTickets.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import apiFetch from '../utils/api';
import { API_URL } from '../config';
import type {
  SupportTicket,
  SupportTicketMessage,
} from '@shared/types';

interface TicketWithMessages {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

/**
 * Typed request/response envelope for ticket operations.
 * Ensures consistency between client submission and server handling.
 */
interface SupportTicketRequest {
  subject: string;
  category: string;
  priority: string;
  description: string;
  requester_name?: string;
  requester_email?: string;
}

interface SupportTicketResponse {
  success: boolean;
  ticket: SupportTicket;
  error?: string;
}

type TicketOperation = 'idle' | 'list' | 'detail' | 'create' | 'reply' | 'close';
export type MotionPhase = 'idle' | 'requesting' | 'receiving' | 'resolving' | 'complete' | 'error';

export interface MotionState {
  phase: MotionPhase;
  operation: TicketOperation;
  progress: number;
  label: string;
}

function buildTicketStreamUrl(status?: string): string {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (status) params.set('status', status);
  return `${API_URL}/api/support/tickets/stream?${params.toString()}`;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

export function useSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<TicketWithMessages | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motion, setMotion] = useState<MotionState>({
    phase: 'idle',
    operation: 'idle',
    progress: 0,
    label: 'Idle',
  });
  const motionResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (motionResetTimeoutRef.current) {
        clearTimeout(motionResetTimeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
    };
  }, []);

  const stopTicketStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
  }, []);

  const updateMotion = useCallback(
    (
      phase: MotionPhase,
      operation: TicketOperation,
      progress: number,
      label: string,
      autoReset = false
    ) => {
      if (motionResetTimeoutRef.current) {
        clearTimeout(motionResetTimeoutRef.current);
        motionResetTimeoutRef.current = null;
      }

      setMotion({ phase, operation, progress, label });

      if (autoReset) {
        motionResetTimeoutRef.current = setTimeout(() => {
          setMotion({ phase: 'idle', operation: 'idle', progress: 0, label: 'Idle' });
        }, 700);
      }
    },
    []
  );

  const fetchTickets = useCallback(async (status?: string) => {
    stopTicketStream();
    setIsLoading(true);
    setError(null);
    updateMotion('requesting', 'list', 20, 'Requesting ticket list...');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', '50');
      const res = await apiFetch(`${API_URL}/api/support/tickets?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load tickets');
      updateMotion('receiving', 'list', 58, 'Receiving ticket records...');
      const data = await res.json();
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
      updateMotion('resolving', 'list', 84, 'Resolving ticket state...');
      updateMotion('complete', 'list', 100, 'Ticket list updated.', true);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load tickets');
      setError(message);
      updateMotion('error', 'list', 100, message, true);
    } finally {
      setIsLoading(false);
    }
  }, [stopTicketStream, updateMotion]);

  const streamTickets = useCallback((status?: string) => {
    stopTicketStream();

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      void fetchTickets(status);
      return () => {
        // no-op cleanup when EventSource is unavailable
      };
    }

    setTickets([]);
    setTotal(0);
    setError(null);
    setIsLoading(true);
    updateMotion('requesting', 'list', 5, 'Connecting to ticket stream...');

    const source = new EventSource(buildTicketStreamUrl(status), { withCredentials: true });
    streamRef.current = source;

    let receivedChunks = 0;
    let expectedChunks = 0;

    source.addEventListener('phase', (event) => {
      const messageEvent = event as MessageEvent;
      try {
        const data = JSON.parse(messageEvent.data) as {
          phase?: MotionPhase;
          label?: string;
          expected?: number;
        };

        if (typeof data.expected === 'number' && data.expected >= 0) {
          expectedChunks = data.expected;
        }

        const nextPhase: MotionPhase =
          data.phase === 'requesting' ||
          data.phase === 'receiving' ||
          data.phase === 'resolving' ||
          data.phase === 'complete' ||
          data.phase === 'error'
            ? data.phase
            : 'requesting';

        const progressFloor = nextPhase === 'requesting' ? 10 : nextPhase === 'resolving' ? 92 : 20;

        setMotion((prev) => ({
          phase: nextPhase,
          operation: 'list',
          progress: Math.max(prev.progress, progressFloor),
          label: data.label || prev.label,
        }));
      } catch {
        // Ignore malformed stream messages and keep stream alive.
      }
    });

    source.addEventListener('chunk', (event) => {
      const messageEvent = event as MessageEvent;
      try {
        const data = JSON.parse(messageEvent.data) as { ticket?: SupportTicket; total?: number };
        if (!data.ticket) return;

        receivedChunks += 1;
        setTickets((prev) => [...prev, data.ticket as SupportTicket]);

        const progress = expectedChunks
          ? Math.min(90, Math.round((receivedChunks / expectedChunks) * 90))
          : Math.min(90, Math.max(20, receivedChunks * 12));

        setMotion((prev) => ({
          ...prev,
          phase: 'receiving',
          operation: 'list',
          progress,
          label: 'Receiving ticket records...',
        }));

        if (typeof data.total === 'number') setTotal(data.total);
      } catch {
        // Ignore malformed stream messages and keep stream alive.
      }
    });

    source.addEventListener('complete', (event) => {
      const messageEvent = event as MessageEvent;
      let streamTotal = receivedChunks;
      try {
        const data = JSON.parse(messageEvent.data) as { total?: number };
        if (typeof data.total === 'number') streamTotal = data.total;
      } catch {
        // keep derived streamTotal
      }

      setTotal(streamTotal);
      setIsLoading(false);
      updateMotion('complete', 'list', 100, 'Ticket stream complete.', true);
      source.close();
      if (streamRef.current === source) streamRef.current = null;
    });

    source.addEventListener('error', () => {
      setIsLoading(false);
      setError('Ticket stream interrupted.');
      updateMotion('error', 'list', 100, 'Ticket stream failed.', true);
      source.close();
      if (streamRef.current === source) streamRef.current = null;
      if (receivedChunks === 0) {
        void fetchTickets(status);
      }
    });

    return () => {
      source.close();
      if (streamRef.current === source) streamRef.current = null;
    };
  }, [fetchTickets, stopTicketStream, updateMotion]);

  const fetchTicket = useCallback(async (id: string) => {
    stopTicketStream();
    setIsLoading(true);
    setError(null);
    updateMotion('requesting', 'detail', 22, 'Requesting ticket thread...');
    try {
      const res = await apiFetch(`${API_URL}/api/support/tickets/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Ticket not found');
      updateMotion('receiving', 'detail', 56, 'Receiving ticket messages...');
      const data = await res.json();
      setActiveTicket({ ticket: data.ticket, messages: data.messages || [] });
      updateMotion('resolving', 'detail', 86, 'Resolving conversation state...');
      updateMotion('complete', 'detail', 100, 'Ticket thread ready.', true);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load ticket');
      setError(message);
      updateMotion('error', 'detail', 100, message, true);
    } finally {
      setIsLoading(false);
    }
  }, [stopTicketStream, updateMotion]);

  const createTicket = useCallback(async (input: SupportTicketRequest): Promise<SupportTicket | null> => {
    setIsLoading(true);
    setError(null);
    updateMotion('requesting', 'create', 18, 'Submitting support ticket...');
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
      updateMotion('receiving', 'create', 57, 'Receiving ticket confirmation...');
      const data: SupportTicketResponse = await res.json();
      updateMotion('resolving', 'create', 86, 'Finalizing ticket...');
      updateMotion('complete', 'create', 100, 'Ticket submitted successfully.', true);
      return data.ticket;
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to create ticket');
      setError(message);
      updateMotion('error', 'create', 100, message, true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [updateMotion]);

  const replyToTicket = useCallback(async (ticketId: string, message: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    updateMotion('requesting', 'reply', 20, 'Sending reply...');
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
      updateMotion('receiving', 'reply', 58, 'Reply received by support channel...');
      // Refresh the ticket to get updated messages
      updateMotion('resolving', 'reply', 82, 'Refreshing ticket thread...');
      await fetchTicket(ticketId);
      updateMotion('complete', 'reply', 100, 'Reply sent.', true);
      return true;
    } catch (err: unknown) {
      const resolvedMessage = getErrorMessage(err, 'Failed to send reply');
      setError(resolvedMessage);
      updateMotion('error', 'reply', 100, resolvedMessage, true);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchTicket, updateMotion]);

  const closeTicketById = useCallback(async (ticketId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    updateMotion('requesting', 'close', 24, 'Closing ticket...');
    try {
      const res = await apiFetch(`${API_URL}/api/support/tickets/${encodeURIComponent(ticketId)}/close`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to close ticket');
      updateMotion('receiving', 'close', 60, 'Confirming closure...');
      updateMotion('resolving', 'close', 84, 'Refreshing ticket list...');
      await fetchTickets();
      updateMotion('complete', 'close', 100, 'Ticket closed.', true);
      return true;
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to close ticket');
      setError(message);
      updateMotion('error', 'close', 100, message, true);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchTickets, updateMotion]);

  return {
    tickets,
    activeTicket,
    total,
    isLoading,
    motion,
    error,
    fetchTickets,
    streamTickets,
    stopTicketStream,
    fetchTicket,
    createTicket,
    replyToTicket,
    closeTicketById,
    setActiveTicket,
    clearError: () => setError(null),
  };
}
