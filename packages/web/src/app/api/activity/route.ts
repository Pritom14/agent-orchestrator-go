import { activityLog } from "@composio/ao-core";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * GET /api/activity — SSE stream of activity ring-buffer events.
 *
 * Replays buffered events on connect, then pushes new events as they arrive
 * (polled every 2 s). Supports optional `project` and `limit` query params.
 */
export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  const { searchParams } = new URL(request.url);
  const projectFilter = searchParams.get("project");
  const rawLimit = searchParams.get("limit");
  const limit = Math.min(
    rawLimit !== null && /^\d+$/.test(rawLimit) ? parseInt(rawLimit, 10) : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const getEvents = (fromIndex: number) => {
        const all = projectFilter
          ? activityLog.getAll(MAX_LIMIT).filter((e) => e.sessionId.startsWith(projectFilter))
          : activityLog.getAll(MAX_LIMIT);
        return all.slice(fromIndex);
      };

      // Replay buffered events on connect
      const buffered = projectFilter
        ? activityLog.getAll(MAX_LIMIT).filter((e) => e.sessionId.startsWith(projectFilter))
        : activityLog.getAll(MAX_LIMIT);
      const initial = buffered.slice(-limit);
      // cursor tracks how many events from the full (unfiltered) buffer we've sent
      let cursor = activityLog.size();

      for (const event of initial) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          return;
        }
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          clearInterval(poll);
        }
      }, HEARTBEAT_INTERVAL_MS);

      poll = setInterval(() => {
        const newEvents = getEvents(cursor);
        cursor += newEvents.length;
        for (const event of newEvents) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            clearInterval(heartbeat);
            clearInterval(poll);
            return;
          }
        }
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      clearInterval(heartbeat);
      clearInterval(poll);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** OPTIONS — CORS preflight */
export function OPTIONS(): Response {
  return new Response(null, { status: 200 });
}
