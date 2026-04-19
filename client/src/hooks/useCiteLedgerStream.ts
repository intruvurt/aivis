/**
 * useCiteLedgerStream - WebSocket/EventSource hook for real-time cite streaming
 *
 * Connects to backend streaming endpoint and populates store.
 * Enforces ledger-first contract: validates all messages before store update.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCiteLedgerStore } from '../store/citeLedgerStore';
import type {
  CiteEntry,
  CiteSourceType,
} from '@shared/types';

interface StreamMessage {
  type: 'cite:add' | 'score:update' | 'issue:add' | 'fix:add' | 'error' | 'complete';
  payload: any;
}

export function useCiteLedgerStream(auditId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Store actions
  const addCite = useCiteLedgerStore((s) => s.addCite);
  const setScoreRefs = useCiteLedgerStore((s) => s.setScoreRefs);
  const setScores = useCiteLedgerStore((s) => s.setScores);
  const addIssue = useCiteLedgerStore((s) => s.addIssue);
  const addFix = useCiteLedgerStore((s) => s.addFix);
  const setStreaming = useCiteLedgerStore((s) => s.setStreaming);
  const recordTimelineEvent = useCiteLedgerStore((s) => s.recordTimelineEvent);

  /**
   * Validate cite entry structure
   */
  const validateCite = useCallback((cite: any): cite is CiteEntry => {
    return (
      cite &&
      typeof cite.id === 'string' &&
      typeof cite.url === 'string' &&
      typeof cite.source_type === 'string' &&
      typeof cite.raw_evidence === 'string' &&
      typeof cite.extracted_signal === 'string' &&
      typeof cite.confidence_score === 'number' &&
      cite.confidence_score >= 0 &&
      cite.confidence_score <= 1
    );
  }, []);

  /**
   * Handle incoming stream message
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: StreamMessage = JSON.parse(event.data);

        if (!message.type || !message.payload) {
          console.warn('[CiteLedgerStream] Invalid message structure', message);
          return;
        }

        // Hard constraint: validate all refs before accepting
        switch (message.type) {
          case 'cite:add': {
            const cite = message.payload;
            if (!validateCite(cite)) {
              console.warn('[CiteLedgerStream] Invalid cite entry', cite);
              return;
            }
            addCite(cite);
            recordTimelineEvent({
              timestamp: Date.now(),
              event: 'cite:add',
              citeHash: cite.id,
            });
            break;
          }

          case 'score:update': {
            const { crawl, semantic, authority, visibility, refs } = message.payload;

            // Validate refs exist
            if (!refs?.crawl || !Array.isArray(refs.crawl)) {
              console.warn('[CiteLedgerStream] Invalid score refs', refs);
              return;
            }

            setScoreRefs('crawl', refs.crawl || []);
            setScoreRefs('semantic', refs.semantic || []);
            setScoreRefs('authority', refs.authority || []);

            setScores({
              crawl: typeof crawl === 'number' ? crawl : 0,
              semantic: typeof semantic === 'number' ? semantic : 0,
              authority: typeof authority === 'number' ? authority : 0,
              visibility: typeof visibility === 'number' ? visibility : 0,
            });

            recordTimelineEvent({
              timestamp: Date.now(),
              event: 'score:update',
              layer: 'crawl',
            });
            break;
          }

          case 'issue:add': {
            const issue = message.payload;

            // Hard constraint: no cites → reject
            if (!issue.citeRefs || !Array.isArray(issue.citeRefs) || issue.citeRefs.length === 0) {
              console.warn('[CiteLedgerStream] Rejected issue without cite refs', issue.id);
              return;
            }

            addIssue({
              id: issue.id,
              fingerprint: issue.fingerprint,
              citeRefs: issue.citeRefs,
              severity: issue.severity || 'medium',
              category: issue.category || 'unknown',
            });

            recordTimelineEvent({
              timestamp: Date.now(),
              event: 'issue:add',
            });
            break;
          }

          case 'fix:add': {
            const fix = message.payload;

            // Hard constraint: no cites → reject
            if (!fix.citeRefs || !Array.isArray(fix.citeRefs) || fix.citeRefs.length === 0) {
              console.warn('[CiteLedgerStream] Rejected fix without cite refs', fix.id);
              return;
            }

            addFix({
              id: fix.id,
              citeRefs: fix.citeRefs,
              patch: fix.patch,
              targetPath: fix.targetPath,
              prUrl: fix.prUrl,
            });

            recordTimelineEvent({
              timestamp: Date.now(),
              event: 'fix:add',
            });
            break;
          }

          case 'complete': {
            console.log('[CiteLedgerStream] Audit streaming complete');
            setStreaming(false);
            break;
          }

          case 'error': {
            console.error('[CiteLedgerStream] Backend error:', message.payload);
            break;
          }

          default:
            console.warn('[CiteLedgerStream] Unknown message type', message.type);
        }
      } catch (err) {
        console.error('[CiteLedgerStream] Parse error:', err);
      }
    },
    [
      addCite,
      setScoreRefs,
      setScores,
      addIssue,
      addFix,
      recordTimelineEvent,
      setStreaming,
      validateCite,
    ],
  );

  /**
   * Reconnect with exponential backoff
   */
  const reconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[CiteLedgerStream] Max reconnection attempts reached');
      setStreaming(false);
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);

    console.log(
      `[CiteLedgerStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!auditId) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/stream/audit/${auditId}`;

      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.onopen = () => {
        console.log('[CiteLedgerStream] Reconnected');
        reconnectAttemptsRef.current = 0;
        setStreaming(true);
      };
      wsRef.current.onmessage = handleMessage;
      wsRef.current.onerror = () => reconnect();
      wsRef.current.onclose = () => reconnect();
    }, delay);
  }, [auditId, setStreaming, handleMessage]);

  /**
   * Setup WebSocket connection
   */
  useEffect(() => {
    if (!auditId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    setStreaming(true);
    reconnectAttemptsRef.current = 0;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/stream/audit/${auditId}`;

    console.log('[CiteLedgerStream] Connecting to', wsUrl);

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('[CiteLedgerStream] Connected');
      reconnectAttemptsRef.current = 0;
    };

    wsRef.current.onmessage = handleMessage;

    wsRef.current.onerror = (event) => {
      console.error('[CiteLedgerStream] WebSocket error:', event);
      reconnect();
    };

    wsRef.current.onclose = () => {
      console.log('[CiteLedgerStream] Disconnected');
      reconnect();
    };

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      setStreaming(false);
    };
  }, [auditId, handleMessage, setStreaming, reconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect,
  };
}

export default useCiteLedgerStream;
