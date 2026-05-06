import { describe, it, expect, beforeEach } from "vitest";
import { activityLog } from "../event-log.js";
import type { ActivityEvent } from "../types.js";

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    type: "status_change",
    ts: Date.now(),
    sessionId: "app-1",
    projectId: "my-app",
    from: "spawning",
    to: "working",
    ...overrides,
  } as ActivityEvent;
}

beforeEach(() => {
  activityLog.clear();
});

describe("activityLog", () => {
  it("push() appends events in order", () => {
    activityLog.push(makeEvent({ ts: 100 }));
    activityLog.push(makeEvent({ ts: 200 }));
    const events = activityLog.getAll();
    expect(events).toHaveLength(2);
    expect(events[0]!.ts).toBe(100);
    expect(events[1]!.ts).toBe(200);
  });

  it("push() evicts the oldest event when the ring buffer exceeds 500 entries", () => {
    for (let i = 0; i < 500; i++) {
      activityLog.push(makeEvent({ ts: i }));
    }
    expect(activityLog.getAll()).toHaveLength(500);
    expect(activityLog.getAll()[0]!.ts).toBe(0);

    // Push one more — should evict ts=0
    activityLog.push(makeEvent({ ts: 500 }));
    expect(activityLog.getAll()).toHaveLength(500);
    expect(activityLog.getAll()[0]!.ts).toBe(1);
    expect(activityLog.getAll()[499]!.ts).toBe(500);
  });

  it("getAll() returns all events as a readonly array", () => {
    activityLog.push(makeEvent({ ts: 1 }));
    const events = activityLog.getAll();
    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(1);
  });

  it("getByProject() filters by projectId and applies limit", () => {
    activityLog.push(makeEvent({ projectId: "proj-a", ts: 1 }));
    activityLog.push(makeEvent({ projectId: "proj-b", ts: 2 }));
    activityLog.push(makeEvent({ projectId: "proj-a", ts: 3 }));

    const projA = activityLog.getByProject("proj-a");
    expect(projA).toHaveLength(2);
    expect(projA.every((e) => e.projectId === "proj-a")).toBe(true);

    const projB = activityLog.getByProject("proj-b");
    expect(projB).toHaveLength(1);
  });

  it("getByProject() respects the limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      activityLog.push(makeEvent({ projectId: "proj-a", ts: i }));
    }
    const limited = activityLog.getByProject("proj-a", 3);
    expect(limited).toHaveLength(3);
    // Returns the last N events
    expect(limited[0]!.ts).toBe(7);
    expect(limited[2]!.ts).toBe(9);
  });

  it("clear() removes all events", () => {
    activityLog.push(makeEvent());
    activityLog.push(makeEvent());
    activityLog.clear();
    expect(activityLog.getAll()).toHaveLength(0);
  });
});
