import type { ActivityEvent } from "./types.js";

const MAX_EVENTS = 500;

class ActivityLog {
  private readonly _events: ActivityEvent[] = [];

  push(event: ActivityEvent): void {
    this._events.push(event);
    if (this._events.length > MAX_EVENTS) {
      this._events.shift();
    }
  }

  getAll(): readonly ActivityEvent[] {
    return this._events;
  }

  getByProject(projectId: string, limit = 50): ActivityEvent[] {
    const filtered = this._events.filter((e) => e.projectId === projectId);
    return filtered.slice(-limit);
  }

  /** Clear all events. Primarily for use in tests. */
  clear(): void {
    this._events.length = 0;
  }
}

export const activityLog = new ActivityLog();
