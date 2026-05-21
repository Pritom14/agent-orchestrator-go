import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  KANBAN_COLLAPSE_PREFIX,
  readKanbanCollapsed,
  writeKanbanCollapsed,
} from "../useKanbanCollapse";

// Provide a full in-memory localStorage stub for each test.
function makeStorageStub(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe("readKanbanCollapsed", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorageStub());
  });

  it("returns false when key is not set", () => {
    expect(readKanbanCollapsed("working")).toBe(false);
  });

  it("returns true when key is set to 'true'", () => {
    localStorage.setItem(`${KANBAN_COLLAPSE_PREFIX}working`, "true");
    expect(readKanbanCollapsed("working")).toBe(true);
  });

  it("returns false when key has a value other than 'true'", () => {
    localStorage.setItem(`${KANBAN_COLLAPSE_PREFIX}working`, "false");
    expect(readKanbanCollapsed("working")).toBe(false);
  });

  it("uses column-specific keys so columns are independent", () => {
    localStorage.setItem(`${KANBAN_COLLAPSE_PREFIX}pending`, "true");
    expect(readKanbanCollapsed("pending")).toBe(true);
    expect(readKanbanCollapsed("working")).toBe(false);
  });

  it("returns false on localStorage error", () => {
    const spy = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(readKanbanCollapsed("working")).toBe(false);
    spy.mockRestore();
  });
});

describe("writeKanbanCollapsed", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorageStub());
  });

  it("writes 'true' to localStorage when collapsed is true", () => {
    writeKanbanCollapsed("pending", true);
    expect(localStorage.getItem(`${KANBAN_COLLAPSE_PREFIX}pending`)).toBe("true");
  });

  it("removes the key when collapsed is false", () => {
    localStorage.setItem(`${KANBAN_COLLAPSE_PREFIX}pending`, "true");
    writeKanbanCollapsed("pending", false);
    expect(localStorage.getItem(`${KANBAN_COLLAPSE_PREFIX}pending`)).toBeNull();
  });

  it("uses column-specific keys so columns are independent", () => {
    writeKanbanCollapsed("working", true);
    writeKanbanCollapsed("pending", false);
    expect(localStorage.getItem(`${KANBAN_COLLAPSE_PREFIX}working`)).toBe("true");
    expect(localStorage.getItem(`${KANBAN_COLLAPSE_PREFIX}pending`)).toBeNull();
  });

  it("handles localStorage setItem errors gracefully", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => writeKanbanCollapsed("working", true)).not.toThrow();
    spy.mockRestore();
  });

  it("handles localStorage removeItem errors gracefully", () => {
    const spy = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => writeKanbanCollapsed("working", false)).not.toThrow();
    spy.mockRestore();
  });
});
