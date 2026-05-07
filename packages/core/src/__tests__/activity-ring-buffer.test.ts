import { describe, it, expect } from "vitest";
import { createActivityRingBuffer } from "../activity-ring-buffer.js";

const event = (id: string) => ({
  sessionId: id,
  ts: new Date().toISOString(),
  type: "state_change" as const,
});

describe("createActivityRingBuffer", () => {
  describe("push / size", () => {
    it("starts empty", () => {
      const buf = createActivityRingBuffer();
      expect(buf.size()).toBe(0);
    });

    it("increments size on push", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("s1"));
      expect(buf.size()).toBe(1);
      buf.push(event("s2"));
      expect(buf.size()).toBe(2);
    });

    it("evicts oldest entry when capacity is exceeded", () => {
      const buf = createActivityRingBuffer(3);
      buf.push(event("a"));
      buf.push(event("b"));
      buf.push(event("c"));
      buf.push(event("d")); // evicts "a"
      expect(buf.size()).toBe(3);
      expect(buf.getAll().map((e) => e.sessionId)).toEqual(["b", "c", "d"]);
    });
  });

  describe("getAll", () => {
    it("returns all events when called with no limit", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("s1"));
      buf.push(event("s2"));
      expect(buf.getAll()).toHaveLength(2);
    });

    it("returns last N events when limit is provided", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("s1"));
      buf.push(event("s2"));
      buf.push(event("s3"));
      const result = buf.getAll(2);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.sessionId)).toEqual(["s2", "s3"]);
    });

    it("returns defensive copy so mutations do not affect buffer", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("s1"));
      const copy = buf.getAll();
      copy.pop();
      expect(buf.size()).toBe(1);
    });

    it("returns empty array from empty buffer", () => {
      expect(createActivityRingBuffer().getAll()).toEqual([]);
    });
  });

  describe("getBySession", () => {
    it("returns only events matching sessionId", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("backend-1"));
      buf.push(event("frontend-1"));
      buf.push(event("backend-2"));
      const result = buf.getBySession("backend-1");
      expect(result).toHaveLength(1);
      expect(result[0]!.sessionId).toBe("backend-1");
    });

    it("returns empty array when no matching events", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("other"));
      expect(buf.getBySession("missing")).toHaveLength(0);
    });

    it("respects limit on filtered results", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("s1"));
      buf.push(event("s1"));
      buf.push(event("s1"));
      const result = buf.getBySession("s1", 2);
      expect(result).toHaveLength(2);
    });

    it("returns all matching when no limit is provided", () => {
      const buf = createActivityRingBuffer();
      buf.push(event("s1"));
      buf.push(event("s1"));
      buf.push(event("s2"));
      expect(buf.getBySession("s1")).toHaveLength(2);
    });
  });
});
