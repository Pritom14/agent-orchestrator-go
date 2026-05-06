import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { ActivityEvent } from "@composio/ao-core";

// ── Mock the activityLog singleton ─────────────────────────────────────

const { mockGetAll, mockGetBySession, mockSize, mockPush } = vi.hoisted(() => ({
  mockGetAll: vi.fn<(limit?: number) => ActivityEvent[]>(() => []),
  mockGetBySession: vi.fn<(sessionId: string, limit?: number) => ActivityEvent[]>(() => []),
  mockSize: vi.fn<() => number>(() => 0),
  mockPush: vi.fn<(event: ActivityEvent) => void>(),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    activityLog: {
      push: mockPush,
      getAll: mockGetAll,
      getBySession: mockGetBySession,
      size: mockSize,
    },
  };
});

import { GET, OPTIONS } from "@/app/api/activity/route";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(
    new URL(url, "http://localhost:3000"),
    init as ConstructorParameters<typeof NextRequest>[1],
  );
}

function makeEvent(overrides: Partial<ActivityEvent> & { sessionId: string }): ActivityEvent {
  return {
    type: "state_change",
    ts: new Date().toISOString(),
    state: "active",
    ...overrides,
  };
}

async function readSSEPayload(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const result = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), 50),
      ),
    ]);
    if (result.done) {
      done = true;
    } else {
      chunks.push(result.value);
    }
  }
  reader.cancel();
  return chunks.map((c) => new TextDecoder().decode(c)).join("");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAll.mockReturnValue([]);
  mockGetBySession.mockReturnValue([]);
  mockSize.mockReturnValue(0);
});

describe("GET /api/activity", () => {
  it("returns 200 with text/event-stream content type", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/activity"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("includes buffered events in initial SSE payload", async () => {
    const events = [
      makeEvent({ sessionId: "session-1" }),
      makeEvent({ sessionId: "session-2", type: "activity" }),
    ];
    mockGetAll.mockReturnValue(events);
    mockSize.mockReturnValue(events.length);

    const res = await GET(makeRequest("http://localhost:3000/api/activity"));
    const text = await readSSEPayload(res);

    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBe(2);

    const parsed = lines.map((l) => JSON.parse(l.replace("data: ", "")));
    expect(parsed[0].sessionId).toBe("session-1");
    expect(parsed[1].sessionId).toBe("session-2");
  });

  it("respects the limit query param", async () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ sessionId: `session-${i}` }),
    );
    mockGetAll.mockReturnValue(events);
    mockSize.mockReturnValue(events.length);

    const res = await GET(makeRequest("http://localhost:3000/api/activity?limit=3"));
    const text = await readSSEPayload(res);

    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBe(3);
  });

  it("defaults to limit=50 when limit param is absent", async () => {
    const events = Array.from({ length: 60 }, (_, i) =>
      makeEvent({ sessionId: `session-${i}` }),
    );
    mockGetAll.mockReturnValue(events);
    mockSize.mockReturnValue(events.length);

    const res = await GET(makeRequest("http://localhost:3000/api/activity"));
    const text = await readSSEPayload(res);

    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBe(50);
  });

  it("caps limit at 500", async () => {
    const events = Array.from({ length: 300 }, (_, i) =>
      makeEvent({ sessionId: `session-${i}` }),
    );
    mockGetAll.mockReturnValue(events);
    mockSize.mockReturnValue(events.length);

    // limit=999 gets capped to 500, but only 300 events exist → all 300 returned
    const res = await GET(makeRequest("http://localhost:3000/api/activity?limit=999"));
    const text = await readSSEPayload(res);

    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBe(300);
  });

  it("filters events by project prefix when project param is set", async () => {
    const all = [
      makeEvent({ sessionId: "backend-1" }),
      makeEvent({ sessionId: "frontend-1" }),
      makeEvent({ sessionId: "backend-2" }),
    ];
    mockGetAll.mockReturnValue(all);
    mockSize.mockReturnValue(all.length);

    const res = await GET(makeRequest("http://localhost:3000/api/activity?project=backend"));
    const text = await readSSEPayload(res);

    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBe(2);
    const parsed = lines.map((l) => JSON.parse(l.replace("data: ", "")) as ActivityEvent);
    expect(parsed.every((e) => e.sessionId.startsWith("backend"))).toBe(true);
  });

  it("returns empty stream when buffer is empty", async () => {
    mockGetAll.mockReturnValue([]);
    mockSize.mockReturnValue(0);

    const res = await GET(makeRequest("http://localhost:3000/api/activity"));
    const text = await readSSEPayload(res);

    const dataLines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(dataLines.length).toBe(0);
  });

  it("emitted events are valid JSON", async () => {
    mockGetAll.mockReturnValue([makeEvent({ sessionId: "session-1", state: "waiting_input" })]);
    mockSize.mockReturnValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/activity"));
    const text = await readSSEPayload(res);

    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBeGreaterThan(0);
    expect(() => JSON.parse(lines[0]!.replace("data: ", ""))).not.toThrow();
  });
});

describe("OPTIONS /api/activity", () => {
  it("returns 200 with no body for CORS preflight", async () => {
    const res = OPTIONS();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("");
  });
});
