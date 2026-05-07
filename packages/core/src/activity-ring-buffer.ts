/**
 * In-memory ring buffer for activity events.
 *
 * Provides a fixed-capacity FIFO store that the web API drains over SSE.
 * The singleton `activityLog` is the shared instance — plugins push events
 * here; the `/api/activity` route replays buffered events on connect and
 * polls for new ones every 2 seconds.
 */

import type { ActivityState } from "./types.js";

export interface ActivityEvent {
  /** Session that generated this event */
  sessionId: string;
  /** ISO 8601 timestamp */
  ts: string;
  /** Event type (state_change, activity, etc.) */
  type: string;
  /** Activity state, if this event represents a state transition */
  state?: ActivityState;
  /** Additional event-specific data */
  data?: Record<string, unknown>;
}

const DEFAULT_CAPACITY = 500;

export interface ActivityRingBuffer {
  push(event: ActivityEvent): void;
  getAll(limit?: number): ActivityEvent[];
  getBySession(sessionId: string, limit?: number): ActivityEvent[];
  size(): number;
}

export function createActivityRingBuffer(capacity = DEFAULT_CAPACITY): ActivityRingBuffer {
  const buf: ActivityEvent[] = [];

  return {
    push(event: ActivityEvent): void {
      buf.push(event);
      if (buf.length > capacity) {
        buf.shift();
      }
    },

    getAll(limit?: number): ActivityEvent[] {
      if (limit === undefined) return buf.slice();
      return buf.slice(-limit);
    },

    getBySession(sessionId: string, limit?: number): ActivityEvent[] {
      const filtered = buf.filter((e) => e.sessionId === sessionId);
      if (limit === undefined) return filtered;
      return filtered.slice(-limit);
    },

    size(): number {
      return buf.length;
    },
  };
}

/** Shared singleton — the one ring buffer for the entire process. */
export const activityLog: ActivityRingBuffer = createActivityRingBuffer();
