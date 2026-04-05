/**
 * SSE (Server-Sent Events) hub for real-time push to connected clients.
 *
 * Usage:
 *   - Call `addClient(userId, res)` when an SSE connection is established
 *   - Call `pushToUser(userId, event, data)` anywhere to push data to all of that user's connections
 *   - Call `pushToAll(event, data)` for broadcast messages
 *
 * Each user can have multiple browser tabs connected simultaneously.
 */
import type { Response } from 'express';

interface SseClient {
  res: Response;
  connectedAt: number;
}

const clients = new Map<string, SseClient[]>();

const HEARTBEAT_INTERVAL_MS = 25_000;

// Keep connections alive with periodic heartbeats
const heartbeatTimer = setInterval(() => {
  const comment = `: heartbeat ${Date.now()}\n\n`;
  for (const [userId, conns] of clients) {
    const alive: SseClient[] = [];
    for (const client of conns) {
      try {
        client.res.write(comment);
        alive.push(client);
      } catch {
        // connection dead - drop silently
      }
    }
    if (alive.length === 0) {
      clients.delete(userId);
    } else {
      clients.set(userId, alive);
    }
  }
}, HEARTBEAT_INTERVAL_MS);

// Prevent the timer from keeping the process alive at shutdown
if (heartbeatTimer.unref) heartbeatTimer.unref();

/** Register an SSE response for a given user. Returns a cleanup function. */
export function addClient(userId: string, res: Response): () => void {
  const client: SseClient = { res, connectedAt: Date.now() };
  const existing = clients.get(userId) || [];
  existing.push(client);
  clients.set(userId, existing);

  return () => {
    const conns = clients.get(userId);
    if (!conns) return;
    const filtered = conns.filter((c) => c !== client);
    if (filtered.length === 0) {
      clients.delete(userId);
    } else {
      clients.set(userId, filtered);
    }
  };
}

/** Push an SSE event to all connections for a specific user. */
export function pushToUser(userId: string, event: string, data: unknown): void {
  const conns = clients.get(userId);
  if (!conns || conns.length === 0) return;
  const payload = formatSseMessage(event, data);
  const alive: SseClient[] = [];
  for (const client of conns) {
    try {
      client.res.write(payload);
      alive.push(client);
    } catch {
      // dead connection
    }
  }
  if (alive.length === 0) {
    clients.delete(userId);
  } else {
    clients.set(userId, alive);
  }
}

/** Broadcast an SSE event to all connected users. */
export function pushToAll(event: string, data: unknown): void {
  const payload = formatSseMessage(event, data);
  for (const [userId, conns] of clients) {
    const alive: SseClient[] = [];
    for (const client of conns) {
      try {
        client.res.write(payload);
        alive.push(client);
      } catch {
        // dead connection
      }
    }
    if (alive.length === 0) {
      clients.delete(userId);
    } else {
      clients.set(userId, alive);
    }
  }
}

/** Returns the number of currently connected users. */
export function connectedUserCount(): number {
  return clients.size;
}

function formatSseMessage(event: string, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${event}\ndata: ${json}\n\n`;
}
