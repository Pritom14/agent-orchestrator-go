"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type ActivityEventType =
  | "status_change"
  | "message_sent"
  | "tool_call"
  | "ci_result"
  | "review_comment";

export interface ActivityEvent {
  id: string;
  sessionId: string;
  type: ActivityEventType;
  description: string;
  timestamp: string;
  /** For ci_result events: "pass" | "fail" */
  result?: string;
}

interface ActivityFeedProps {
  sessionId?: string;
}

const MAX_EVENTS = 500;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch {
    return "--:--:--";
  }
}

function eventColor(event: ActivityEvent): string {
  switch (event.type) {
    case "status_change":
      return "var(--color-accent-blue)";
    case "message_sent":
      return "var(--color-accent-green)";
    case "tool_call":
      return "var(--color-accent-yellow)";
    case "ci_result":
      return event.result === "pass" ? "var(--color-accent-green)" : "var(--color-accent-red)";
    case "review_comment":
      return "var(--color-accent-purple)";
    default:
      return "var(--color-text-secondary)";
  }
}

export function ActivityFeed({ sessionId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  const appendEvents = useCallback((incoming: ActivityEvent[]) => {
    setEvents((prev) => {
      const combined = [...prev, ...incoming];
      return combined.length > MAX_EVENTS ? combined.slice(combined.length - MAX_EVENTS) : combined;
    });
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/activity");

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as
          | { type: "buffer"; events: ActivityEvent[] }
          | ActivityEvent;

        if ("type" in data && data.type === "buffer") {
          appendEvents(data.events);
        } else {
          appendEvents([data as ActivityEvent]);
        }
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      es.close();
    };
  }, [appendEvents]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrolledUpRef.current = !atBottom;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (userScrolledUpRef.current) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  const displayEvents = sessionId
    ? events.filter((e) => e.sessionId === sessionId)
    : events;

  return (
    <div className="activity-feed flex h-full flex-col">
      <div className="activity-feed__header flex items-center justify-between border-b border-[var(--color-border-subtle)] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          Activity
        </span>
        {sessionId && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {sessionId.slice(0, 8)}
          </span>
        )}
      </div>

      <div
        ref={listRef}
        className="activity-feed__list flex-1 overflow-y-auto px-3 py-2"
        role="log"
        aria-live="polite"
        aria-label="Activity feed"
      >
        {displayEvents.length === 0 ? (
          <p className="activity-feed__empty text-[11px] text-[var(--color-text-muted)]">
            No activity yet
          </p>
        ) : (
          displayEvents.map((event) => (
            <div
              key={event.id}
              className="activity-feed__row flex gap-2 py-0.5 font-mono text-[10px] leading-[1.6]"
            >
              <span className="shrink-0 text-[var(--color-text-tertiary)]">
                [{formatTime(event.timestamp)}]
              </span>
              <span
                className="shrink-0 truncate text-[var(--color-text-muted)]"
                title={event.sessionId}
              >
                {event.sessionId.slice(0, 8)}
              </span>
              <span
                className="flex-1 break-all"
                style={{ color: eventColor(event) }}
              >
                {event.description}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
