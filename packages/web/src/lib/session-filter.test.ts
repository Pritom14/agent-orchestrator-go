import { describe, expect, it } from "vitest";
import { matchesFilter } from "@/lib/session-filter";
import { makeSession } from "@/__tests__/helpers";

describe("matchesFilter", () => {
  it("returns true for empty query", () => {
    const session = makeSession({ id: "abc-123" });
    expect(matchesFilter(session, "")).toBe(true);
  });

  it("matches by id", () => {
    const session = makeSession({ id: "session-42" });
    expect(matchesFilter(session, "session-42")).toBe(true);
    expect(matchesFilter(session, "42")).toBe(true);
  });

  it("matches by displayName", () => {
    const session = makeSession({ displayName: "Fix login bug" });
    expect(matchesFilter(session, "login")).toBe(true);
  });

  it("matches by branch", () => {
    const session = makeSession({ branch: "feat/user-auth" });
    expect(matchesFilter(session, "user-auth")).toBe(true);
  });

  it("matches by issueTitle", () => {
    const session = makeSession({ issueTitle: "Add dark mode toggle" });
    expect(matchesFilter(session, "dark mode")).toBe(true);
  });

  it("is case-insensitive", () => {
    const session = makeSession({ issueTitle: "Add Dark Mode" });
    expect(matchesFilter(session, "dark mode")).toBe(true);
    expect(matchesFilter(session, "DARK")).toBe(true);
  });

  it("returns false when no field matches", () => {
    const session = makeSession({
      id: "abc",
      displayName: "fix bug",
      branch: "feat/fix",
      issueTitle: "Fix something",
    });
    expect(matchesFilter(session, "unrelated-xyz")).toBe(false);
  });

  it("handles null fields gracefully", () => {
    const session = makeSession({
      displayName: null,
      branch: null,
      issueTitle: null,
    });
    expect(matchesFilter(session, "test-1")).toBe(true); // matches id
    expect(matchesFilter(session, "nope")).toBe(false);
  });
});
