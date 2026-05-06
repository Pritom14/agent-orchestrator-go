import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed, type ActivityEvent } from "../ActivityFeed";

type MockEventSource = {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
};

let mockEventSource: MockEventSource;

beforeEach(() => {
  mockEventSource = {
    onmessage: null,
    onerror: null,
    close: vi.fn(),
    readyState: 1,
  };

  const constructor = vi.fn(() => mockEventSource as unknown as EventSource);
  global.EventSource = Object.assign(constructor, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
  }) as unknown as typeof EventSource;
});

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "evt-1",
    sessionId: "session-abc123",
    type: "status_change",
    description: "Status changed to working",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function sendMessage(data: unknown) {
  act(() => {
    mockEventSource.onmessage?.({
      data: JSON.stringify(data),
    } as MessageEvent);
  });
}

describe("ActivityFeed", () => {
  it("renders empty state when no events", () => {
    render(<ActivityFeed />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("renders events from initial SSE buffer payload", () => {
    render(<ActivityFeed />);

    sendMessage({
      type: "buffer",
      events: [
        makeEvent({ id: "e1", description: "Agent started" }),
        makeEvent({ id: "e2", description: "PR opened", type: "message_sent" }),
      ],
    });

    expect(screen.getByText("Agent started")).toBeInTheDocument();
    expect(screen.getByText("PR opened")).toBeInTheDocument();
  });

  it("renders streamed individual events", () => {
    render(<ActivityFeed />);

    sendMessage(makeEvent({ id: "e1", description: "Tool invoked", type: "tool_call" }));

    expect(screen.getByText("Tool invoked")).toBeInTheDocument();
  });

  it("filters events by sessionId prop", () => {
    render(<ActivityFeed sessionId="session-abc123" />);

    sendMessage({
      type: "buffer",
      events: [
        makeEvent({ id: "e1", sessionId: "session-abc123", description: "Matched event" }),
        makeEvent({ id: "e2", sessionId: "session-zzz999", description: "Other session event" }),
      ],
    });

    expect(screen.getByText("Matched event")).toBeInTheDocument();
    expect(screen.queryByText("Other session event")).not.toBeInTheDocument();
  });

  it("establishes SSE connection on mount and closes on unmount", () => {
    const { unmount } = render(<ActivityFeed />);

    expect(global.EventSource).toHaveBeenCalledWith("/api/activity");
    expect(mockEventSource.close).not.toHaveBeenCalled();

    unmount();

    expect(mockEventSource.close).toHaveBeenCalledOnce();
  });
});
