import { describe, expect, it } from "vitest";
import { matchesSessionFilter } from "@/components/Dashboard";
import { makeSession } from "@/__tests__/helpers";

describe("matchesSessionFilter", () => {
  it("returns true for empty query", () => {
    const session = makeSession({ id: "abc-123" });
    expect(matchesSessionFilter(session, "")).toBe(true);
    expect(matchesSessionFilter(session, "  ")).toBe(true);
  });

  it("matches by session id (case-insensitive)", () => {
    const session = makeSession({ id: "abc-123" });
    expect(matchesSessionFilter(session, "abc")).toBe(true);
    expect(matchesSessionFilter(session, "ABC")).toBe(true);
    expect(matchesSessionFilter(session, "123")).toBe(true);
    expect(matchesSessionFilter(session, "xyz")).toBe(false);
  });

  it("matches by displayName", () => {
    const session = makeSession({ displayName: "Fix login bug" });
    expect(matchesSessionFilter(session, "login")).toBe(true);
    expect(matchesSessionFilter(session, "LOGIN")).toBe(true);
    expect(matchesSessionFilter(session, "signup")).toBe(false);
  });

  it("matches by branch", () => {
    const session = makeSession({ branch: "feat/user-auth" });
    expect(matchesSessionFilter(session, "user-auth")).toBe(true);
    expect(matchesSessionFilter(session, "FEAT")).toBe(true);
    expect(matchesSessionFilter(session, "hotfix")).toBe(false);
  });

  it("matches by issueTitle", () => {
    const session = makeSession({ issueTitle: "Add dark mode support" });
    expect(matchesSessionFilter(session, "dark mode")).toBe(true);
    expect(matchesSessionFilter(session, "DARK MODE")).toBe(true);
    expect(matchesSessionFilter(session, "light mode")).toBe(false);
  });

  it("returns false when no fields match", () => {
    const session = makeSession({
      id: "sess-001",
      displayName: "Add auth",
      branch: "feat/auth",
      issueTitle: "User authentication",
    });
    expect(matchesSessionFilter(session, "payment")).toBe(false);
  });

  it("handles null optional fields gracefully", () => {
    const session = makeSession({
      id: "sess-001",
      displayName: null,
      branch: null,
      issueTitle: null,
    });
    expect(matchesSessionFilter(session, "sess")).toBe(true);
    expect(matchesSessionFilter(session, "other")).toBe(false);
  });

  it("trims whitespace from query before matching", () => {
    const session = makeSession({ id: "abc-123" });
    expect(matchesSessionFilter(session, "  abc  ")).toBe(true);
  });
});
